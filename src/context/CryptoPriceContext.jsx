import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';              // ✅ सही path
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { fetchWithRetry } from '../utils/helpers';

const CryptoPriceContext = createContext(null);

export const useCryptoPrice = () => useContext(CryptoPriceContext);

export const CryptoPriceProvider = ({ children }) => {
  const { user, baseCurrency = 'INR', selectedCryptos = [] } = useAuth();
  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [walletCoinSymbols, setWalletCoinSymbols] = useState([]);

  // 1. Fetch custom coins from user doc
  useEffect(() => {
    if (!user) return;
    const fetchCustomCoins = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().customCoins) {
        setCustomUserCoins(snap.data().customCoins);
      }
    };
    fetchCustomCoins();
  }, [user]);

  // 2. Listen to crypto wallet logs to extract unique coin symbols
  useEffect(() => {
    if (!user) return;
    const q = collection(db, "users", user.uid, "cryptoWalletLogs");
    const unsub = onSnapshot(q, (snap) => {
      const symbols = new Set();
      snap.docs.forEach(d => {
        const coin = d.data().coin;
        if (coin) symbols.add(coin.toUpperCase());
      });
      setWalletCoinSymbols(Array.from(symbols));
    });
    return () => unsub();
  }, [user]);

  // 3. Build full database from selectedCryptos + customUserCoins
  const fullDatabase = useMemo(() => {
    const map = new Map();
    selectedCryptos.forEach(c => {
      if (typeof c === 'object') map.set(c.symbol.toUpperCase(), c);
      else map.set(c.toUpperCase(), { symbol: c.toUpperCase(), id: c.toLowerCase() });
    });
    customUserCoins.forEach(c => {
      const existing = map.get(c.symbol.toUpperCase());
      map.set(c.symbol.toUpperCase(), { ...existing, ...c });
    });
    return Array.from(map.values());
  }, [selectedCryptos, customUserCoins]);

  // 4. Merge all symbols that need prices
  const allSymbols = useMemo(() => {
    const set = new Set([
      ...selectedCryptos.map(c => typeof c === 'string' ? c.toUpperCase() : c.symbol.toUpperCase()),
      ...walletCoinSymbols,
      'USDT'
    ]);
    return Array.from(set);
  }, [selectedCryptos, walletCoinSymbols]);

  // 5. Fetch live prices and forex rate
  const fetchPrices = useCallback(async () => {
    if (allSymbols.length === 0) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    let usdToBase = 1;

    // Forex rate
    try {
      const forexRes = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD');
      if (forexRes && forexRes.ok) {
        const forexData = await forexRes.json();
        usdToBase = parseFloat(forexData.rates[baseCurrency]) || 1;
        setFiatRate(usdToBase);
      }
    } catch (e) {}

    // Separate normal coins and contract coins
    const normalIds = [];
    const contractCoins = [];
    allSymbols.forEach(sym => {
      const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === sym.toUpperCase());
      if (dbCoin?.fetchMode === 'contract' && dbCoin.contractAddress) {
        contractCoins.push({ symbol: sym.toUpperCase(), ...dbCoin });
      } else {
        const id = dbCoin?.id || sym.toLowerCase();
        normalIds.push({ id, symbol: sym.toUpperCase() });
      }
    });

    let cgPrices = {};
    try {
      if (normalIds.length > 0) {
        const uniqueIds = [...new Set(normalIds.map(c => c.id))].join(',');
        const cgRes = await fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds}&vs_currencies=usd&include_24hr_change=true`);
        if (cgRes && cgRes.ok) cgPrices = await cgRes.json();
      }
    } catch (e) {}

    // Contract coins prices (DexScreener / GeckoTerminal)
    let contractPrices = {};
    for (const coin of contractCoins) {
      let priceUsd = 0, change = 0;
      try {
        const dexRes = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${coin.contractAddress}`);
        if (dexRes && dexRes.ok) {
          const dexData = await dexRes.json();
          if (dexData.pairs?.length > 0) {
            priceUsd = parseFloat(dexData.pairs[0].priceUsd) || 0;
            change = parseFloat(dexData.pairs[0].priceChange?.h24) || 0;
          }
        }
        if (!priceUsd && coin.network) {
          const gtRes = await fetchWithRetry(`https://api.geckoterminal.com/api/v2/networks/${coin.network}/tokens/${coin.contractAddress}`);
          if (gtRes && gtRes.ok) {
            const gtData = await gtRes.json();
            priceUsd = parseFloat(gtData.data?.attributes?.price_usd) || 0;
          }
        }
      } catch (e) {}
      contractPrices[coin.symbol] = { priceUSD: priceUsd, change };
    }

    // Build final price map
    const priceMap = {};
    for (const sym of allSymbols) {
      const upperSym = sym.toUpperCase();
      const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === upperSym) || {};
      const normalId = dbCoin.id || sym.toLowerCase();
      let priceUsd = 0, change = 0;

      if (dbCoin.fetchMode === 'contract') {
        priceUsd = contractPrices[upperSym]?.priceUSD || 0;
        change = contractPrices[upperSym]?.change || 0;
      } else {
        priceUsd = cgPrices[normalId]?.usd || 0;
        change = cgPrices[normalId]?.usd_24h_change || 0;
      }

      // Fallbacks
      if (!priceUsd) {
        try {
          if (['USDT', 'USDC', 'DAI'].includes(upperSym)) {
            priceUsd = 1.00;
          } else {
            const bRes = await fetchWithRetry(`https://api.binance.com/api/v3/ticker/24hr?symbol=${upperSym}USDT`);
            if (bRes && bRes.ok) {
              const bData = await bRes.json();
              priceUsd = parseFloat(bData.lastPrice);
              change = parseFloat(bData.priceChangePercent);
            }
          }
        } catch (e) {}
      }
      if (!priceUsd && dbCoin.fallbackPrice) {
        priceUsd = parseFloat(dbCoin.fallbackPrice);
      }

      priceMap[upperSym] = { priceUSD: priceUsd, change };
    }

    setLivePrices(priceMap);
    setIsLoading(false);
  }, [allSymbols, baseCurrency, fullDatabase]);

  // Initial fetch and 60s interval
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return (
    <CryptoPriceContext.Provider value={{ livePrices, fiatRate, isLoading }}>
      {children}
    </CryptoPriceContext.Provider>
  );
};