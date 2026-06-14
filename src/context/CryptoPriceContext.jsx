// src/context/CryptoPriceContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { secureFetch } from '../utils/secureFetch'; // Removed unused secureFetchSafe to avoid warnings
import {
  validateForexResponse,
  validateCoinGeckoResponse,
  validateBinanceResponse,
  validateDexScreenerResponse,
  validateGeckoTerminalResponse,
  safeParsePrice,
  safeParseChange,
} from '../utils/apiResponseValidator';

const CryptoPriceContext = createContext(null);

export const useCryptoPrice = () => {
  const context = useContext(CryptoPriceContext);
  if (!context) {
    throw new Error('useCryptoPrice must be used within CryptoPriceProvider');
  }
  return context;
};

export const CryptoPriceProvider = ({ children }) => {
  const { user, baseCurrency = 'INR', selectedCryptos = [] } = useAuth();
  
  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [walletCoinSymbols, setWalletCoinSymbols] = useState([]);
  const [lastError, setLastError] = useState(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // 1. Fetch custom coins directly from user profile
  useEffect(() => {
    if (!user) return;
    const fetchCustomCoins = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().customCoins && isMounted.current) {
          setCustomUserCoins(snap.data().customCoins);
        }
      } catch (error) {
        console.error('[CryptoPriceContext] Failed to fetch custom coins:', error);
      }
    };
    fetchCustomCoins();
  }, [user]);

  // 🚀 2. ENTERPRISE FIX: Fetch all active coins across ALL modules using 4 summary docs (O(1) Reads)
  useEffect(() => {
    if (!user) return;
    
    // Listen to the walletSummary collection instead of massive log collections
    const q = collection(db, 'users', user.uid, 'walletSummary');
    const unsub = onSnapshot(
      q,
      (snap) => {
        const symbols = new Set();

        snap.docs.forEach(d => {
          const data = d.data();
          
          // 🏦 1. Main Crypto Vault
          if (d.id === 'crypto' && data.holdings) {
            Object.keys(data.holdings).forEach(coin => symbols.add(coin.toUpperCase()));
          }
          
          // ⚡ 2. Staking & Yield
          if (d.id === 'staking' && data.activeStakes) {
            data.activeStakes.forEach(s => {
              if (s.coin) symbols.add(s.coin.toUpperCase());
              if (s.poolCoin2) symbols.add(s.poolCoin2.toUpperCase());
            });
          }
          
          // 🎯 3. Hold & Swap AI Targets
          if (d.id === 'holdAndSwap' && data.holdingsByCoin) {
            Object.keys(data.holdingsByCoin).forEach(coin => symbols.add(coin.toUpperCase()));
          }
          
          // 🎁 4. Micro Earn Platforms
          if (d.id === 'microEarn' && data.platforms) {
            data.platforms.forEach(p => {
              if (p.coins) p.coins.forEach(coin => symbols.add(coin.toUpperCase()));
            });
          }
        });

        if (isMounted.current) setWalletCoinSymbols(Array.from(symbols));
      },
      (error) => {
        console.error('[CryptoPriceContext] Summary listener error:', error);
      }
    );
    return () => unsub();
  }, [user]);

  // 3. Build full database mappings (Watchlist + Custom Coins)
  const fullDatabase = useMemo(() => {
    const map = new Map();
    selectedCryptos.forEach(c => {
      if (typeof c === 'object' && c.symbol) {
        map.set(c.symbol.toUpperCase(), c);
      } else if (typeof c === 'string') {
        map.set(c.toUpperCase(), { symbol: c.toUpperCase(), id: c.toLowerCase() });
      }
    });
    customUserCoins.forEach(c => {
      if (typeof c === 'object' && c.symbol) {
        const existing = map.get(c.symbol.toUpperCase());
        map.set(c.symbol.toUpperCase(), { ...existing, ...c });
      }
    });
    return Array.from(map.values());
  }, [selectedCryptos, customUserCoins]);

  // 4. Merge all symbols that need fetching
  const allSymbols = useMemo(() => {
    const set = new Set([
      ...selectedCryptos.map(c => 
        typeof c === 'string' ? c.toUpperCase() : (c.symbol ? c.symbol.toUpperCase() : null)
      ).filter(Boolean),
      ...walletCoinSymbols,
      'USDT' // Base stablecoin guaranteed
    ]);
    return Array.from(set);
  }, [selectedCryptos, walletCoinSymbols]);

  // 5. Secure Fetch Logic
  const fetchPrices = useCallback(async () => {
    if (allSymbols.length === 0) {
      if (isMounted.current) setIsLoading(false);
      return;
    }

    if (isMounted.current) {
      setIsLoading(true);
      setLastError(null);
    }
    
    let usdToBase = 1;

    try {
      // 🌍 A. Fetch Forex Multiplier
      if (baseCurrency !== 'USD') {
        try {
          const forexData = await secureFetch(
            'https://api.exchangerate-api.com/v4/latest/USD',
            validateForexResponse,
            { timeoutMs: 8000, retries: 2 }
          );
          
          const rate = safeParsePrice(forexData.rates[baseCurrency]);
          if (rate > 0) {
            usdToBase = rate;
            if (isMounted.current) setFiatRate(usdToBase);
          }
        } catch (error) {
          console.warn('[CryptoPriceContext] Forex fetch failed:', error.message);
        }
      }

      // Separate Standard vs Contract Coins
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

      // 🪙 B. Fetch CoinGecko Standard Coins
      let cgPrices = {};
      try {
        if (normalIds.length > 0) {
          const uniqueIds = [...new Set(normalIds.map(c => c.id))].join(',');
          const cgData = await secureFetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds}&vs_currencies=usd&include_24hr_change=true`,
            validateCoinGeckoResponse,
            { timeoutMs: 10000, retries: 2 }
          );
          cgPrices = cgData;
        }
      } catch (error) {
        console.warn('[CryptoPriceContext] CoinGecko fetch failed:', error.message);
      }

      // 📜 C. Fetch Contract/Meme Coins
      let contractPrices = {};
      for (const coin of contractCoins) {
        let priceUsd = 0, change = 0;

        // Try DexScreener First
        try {
          const dexData = await secureFetch(
            `https://api.dexscreener.com/latest/dex/tokens/${coin.contractAddress}`,
            validateDexScreenerResponse,
            { timeoutMs: 8000, retries: 1 }
          );

          if (dexData.pairs?.length > 0) {
            priceUsd = safeParsePrice(dexData.pairs[0].priceUsd);
            change = safeParseChange(dexData.pairs[0].priceChange?.h24);
            if (priceUsd > 0) {
              contractPrices[coin.symbol] = { priceUSD: priceUsd, change };
              continue;
            }
          }
        } catch (error) {
          console.warn(`[CryptoPriceContext] DexScreener failed for ${coin.symbol}:`, error.message);
        }

        // Fallback to GeckoTerminal
        if (!priceUsd && coin.network) {
          try {
            const gtData = await secureFetch(
              `https://api.geckoterminal.com/api/v2/networks/${coin.network}/tokens/${coin.contractAddress}`,
              validateGeckoTerminalResponse,
              { timeoutMs: 8000, retries: 1 }
            );
            priceUsd = safeParsePrice(gtData.data?.attributes?.price_usd);
            if (priceUsd > 0) {
              contractPrices[coin.symbol] = { priceUSD: priceUsd, change };
              continue;
            }
          } catch (error) {
            console.warn(`[CryptoPriceContext] GeckoTerminal failed for ${coin.symbol}:`, error.message);
          }
        }

        contractPrices[coin.symbol] = { priceUSD: priceUsd, change };
      }

      // 🧩 D. Compile Final Master Map with Fallbacks
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

        // Hard Fallback: Pegged Stablecoins
        if (!priceUsd && ['USDT', 'USDC', 'DAI', 'BUSD', 'FDUSD'].includes(upperSym)) {
          priceUsd = 1.00;
          change = 0;
        }

        // Heavy Fallback: Binance Exchange API
        if (!priceUsd) {
          try {
            const bData = await secureFetch(
              `https://api.binance.com/api/v3/ticker/24hr?symbol=${upperSym}USDT`,
              validateBinanceResponse,
              { timeoutMs: 5000, retries: 1 }
            );
            priceUsd = safeParsePrice(bData.lastPrice);
            change = safeParseChange(bData.priceChangePercent);
          } catch (error) {
            console.warn(`[CryptoPriceContext] Binance fallback failed for ${upperSym}:`, error.message);
          }
        }

        // Absolute Final Fallback: Database Value
        if (!priceUsd && dbCoin.fallbackPrice) {
          priceUsd = safeParsePrice(dbCoin.fallbackPrice);
        }

        priceMap[upperSym] = { 
          priceUSD: safeParsePrice(priceUsd), 
          change: safeParseChange(change) 
        };
      }

      if (isMounted.current) {
        setLivePrices(priceMap);
        setLastError(null);
      }

    } catch (error) {
      console.error('[CryptoPriceContext] Fatal fetch error:', error);
      if (isMounted.current) setLastError(error.message);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [allSymbols, baseCurrency, fullDatabase]);

  // Initial fetch and 60s background sync
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const value = useMemo(() => ({
    livePrices,
    fiatRate,
    isLoading,
    lastError,
  }), [livePrices, fiatRate, isLoading, lastError]);

  return (
    <CryptoPriceContext.Provider value={value}>
      {children}
    </CryptoPriceContext.Provider>
  );
};