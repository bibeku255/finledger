// src/pages/tools/CryptoForex.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { useCryptoPrice } from '../../context/CryptoPriceContext';   // ✅ global prices
import { 
  HiOutlineRefresh, HiOutlineSwitchVertical, HiOutlineCalculator, 
  HiOutlineTrendingUp
} from 'react-icons/hi';
import { FaExchangeAlt } from 'react-icons/fa';

import { currenciesList } from '../../utils/marketConstants';

// Fallback Database for Crypto Icons & Default Prices
const defaultCryptoDatabase = {
  BTC: { id: 'bitcoin', fallbackPrice: 65000, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ETH: { id: 'ethereum', fallbackPrice: 3000, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  USDT: { id: 'tether', fallbackPrice: 1.00, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  BNB: { id: 'binancecoin', fallbackPrice: 500, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  SOL: { id: 'solana', fallbackPrice: 140, color: 'text-purple-500', bg: 'bg-purple-500/10' },
};

const fetchWithRetry = async (url, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status !== 429) return res;
      if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch (e) {
      if (i === retries) return null;
    }
  }
  return null;
};

const CryptoForex = () => {
  const { user, selectedCryptos = [], baseCurrency = 'USD', formatGlobalDate } = useAuth();
  
  // ✅ Global crypto prices
  const { livePrices } = useCryptoPrice();

  const [fiatRatesUSD, setFiatRatesUSD] = useState({});   // fiat only
  const [isFetchingFiat, setIsFetchingFiat] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [customUserCoins, setCustomUserCoins] = useState([]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const sn = await getDoc(doc(db, "users", user.uid));
      if (sn.exists() && sn.data().customCoins) setCustomUserCoins(sn.data().customCoins);
    };
    fetchUserData();
  }, [user]);

  const fullDatabase = useMemo(() => {
    const m = new Map();
    selectedCryptos.forEach(c => {
      if (typeof c === 'object') m.set(c.symbol.toUpperCase(), c);
      else m.set(c.toUpperCase(), { symbol: c.toUpperCase(), id: c.toLowerCase() });
    });
    customUserCoins.forEach(c => {
      const e = m.get(c.symbol.toUpperCase());
      m.set(c.symbol.toUpperCase(), { ...e, ...c });
    });
    return Array.from(m.values());
  }, [customUserCoins, selectedCryptos]);

  const activeCryptos = useMemo(() => {
    const list = fullDatabase.map(c => c.symbol.toUpperCase());
    if (!list.includes('USDT')) list.push('USDT');
    if (!list.includes('BTC')) list.push('BTC');
    return [...new Set(list)];
  }, [fullDatabase]);

  // 🧮 Combine crypto (from context) + fiat (from API) into one rates object
  const ratesUSD = useMemo(() => {
    const combined = { USD: 1, ...fiatRatesUSD };   // fiat rates already in USD per unit
    // add crypto rates
    activeCryptos.forEach(sym => {
      const price = livePrices[sym]?.priceUSD;
      if (price && price > 0) {
        combined[sym] = price;
      } else {
        // fallback
        const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === sym.toUpperCase()) || {};
        const fallback = parseFloat(dbCoin.fallbackPrice || defaultCryptoDatabase[sym]?.fallbackPrice || 0);
        if (fallback > 0) combined[sym] = fallback;
      }
    });
    return combined;
  }, [livePrices, fiatRatesUSD, activeCryptos, fullDatabase]);

  const [assetFrom, setAssetFrom] = useState(activeCryptos[0] || 'BTC');
  const [assetTo, setAssetTo] = useState(baseCurrency);
  const [amountFrom, setAmountFrom] = useState('1');
  const [amountTo, setAmountTo] = useState('0');

  // ---------- Fetch fiat rates only ----------
  const fetchFiatRates = useCallback(async () => {
    setIsFetchingFiat(true);
    try {
      const newRates = {};
      const fr = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD');
      if (fr && fr.ok) {
        const fd = await fr.json();
        currenciesList.forEach(f => {
          if (fd.rates[f.code]) newRates[f.code] = 1 / fd.rates[f.code];   // USD per unit
        });
      }
      setFiatRatesUSD(newRates);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Fiat fetch failed', e);
    } finally {
      setIsFetchingFiat(false);
    }
  }, []);

  useEffect(() => {
    fetchFiatRates();
    const i = setInterval(fetchFiatRates, 60000);
    return () => clearInterval(i);
  }, [fetchFiatRates]);

  // ---------- Conversion ----------
  useEffect(() => {
    if (Object.keys(ratesUSD).length === 0) return;
    const rf = ratesUSD[assetFrom] || 0;
    const rt = ratesUSD[assetTo] || 0;
    if (rf > 0 && rt > 0 && amountFrom !== '') {
      const v = parseFloat(amountFrom) * rf / rt;
      setAmountTo(v < 0.0001 ? v.toFixed(8) : v < 1 ? v.toFixed(4) : v.toFixed(2));
    } else {
      setAmountTo('');
    }
  }, [amountFrom, assetFrom, assetTo, ratesUSD]);

  const handleSwapAssets = () => {
    setAssetFrom(assetTo);
    setAssetTo(assetFrom);
  };

  const isLoading = isFetchingFiat;

  return (
    <div className="h-full min-h-screen overflow-y-auto pb-24">
      <div className="pt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto px-4 md:px-6">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                  <HiOutlineCalculator size={24} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight truncate">Smart Converter</h1>
                  <p className="text-sm font-medium text-slate-400 truncate">Live global rates for crypto & fiat</p>
                </div>
              </div>
            </div>
            <button
              onClick={fetchFiatRates}
              disabled={isLoading}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 disabled:opacity-50 active:scale-95 shadow-sm"
            >
              <HiOutlineRefresh className={isLoading ? 'animate-spin text-blue-400' : ''} size={16} />
              {isLoading ? 'Syncing Fiat...' : 'Refresh Rates'}
            </button>
          </div>
          <div className="relative z-10 mt-4">
            <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {isLoading
                ? 'Updating fiat rates...'
                : `Updated: ${formatGlobalDate ? formatGlobalDate(lastUpdated, 'short') : lastUpdated.toLocaleTimeString()}`
              }
            </p>
          </div>
        </div>

        {/* 🧮 Calculator Card */}
        <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 md:p-8">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/3 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/3 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center gap-4 md:gap-6">
            
            {/* FROM BOX */}
            <div className="flex-1 w-full bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 focus-within:border-blue-400/60 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all shadow-sm flex flex-col">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">You Send</label>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input 
                  type="number" 
                  value={amountFrom} 
                  onChange={(e) => setAmountFrom(e.target.value)} 
                  placeholder="0.00" 
                  className="w-full min-w-0 bg-transparent text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all" 
                />
                <select 
                  value={assetFrom} 
                  onChange={(e) => setAssetFrom(e.target.value)} 
                  className="w-full sm:w-[110px] shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-black text-sm py-3 px-3 rounded-xl cursor-pointer outline-none shadow-sm appearance-none text-center"
                >
                  <optgroup label="Fiat Currencies">
                    {currenciesList.map(f => <option key={`from-${f.code}`} value={f.code}>{f.code}</option>)}
                  </optgroup>
                  <optgroup label="Cryptocurrencies">
                    {activeCryptos.map(c => <option key={`from-${c}`} value={c}>{c}</option>)}
                  </optgroup>
                </select>
              </div>
              {ratesUSD[assetFrom] > 0 && (
                <p className="text-[10px] font-bold text-slate-400 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                  1 {assetFrom} ≈ ${ratesUSD[assetFrom].toLocaleString(undefined, {maximumFractionDigits: 6})}
                </p>
              )}
            </div>

            {/* SWAP BUTTON */}
            <button 
              onClick={handleSwapAssets} 
              className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl shadow-xl shadow-blue-500/30 hover:scale-110 active:scale-95 transition-all z-10 -my-7 md:my-0 md:-mx-8 border-4 border-white dark:border-slate-900"
            >
              <HiOutlineSwitchVertical className="md:hidden" size={20} />
              <FaExchangeAlt className="hidden md:block" size={20} />
            </button>

            {/* TO BOX */}
            <div className="flex-1 w-full bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all shadow-sm flex flex-col">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">You Get</label>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input 
                  type="text" 
                  readOnly 
                  value={amountTo} 
                  placeholder="0.00" 
                  className="w-full min-w-0 bg-transparent text-3xl sm:text-4xl md:text-5xl font-black text-emerald-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all" 
                />
                <select 
                  value={assetTo} 
                  onChange={(e) => setAssetTo(e.target.value)} 
                  className="w-full sm:w-[110px] shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-black text-sm py-3 px-3 rounded-xl cursor-pointer outline-none shadow-sm appearance-none text-center"
                >
                  <optgroup label="Fiat Currencies">
                    {currenciesList.map(f => <option key={`to-${f.code}`} value={f.code}>{f.code}</option>)}
                  </optgroup>
                  <optgroup label="Cryptocurrencies">
                    {activeCryptos.map(c => <option key={`to-${c}`} value={c}>{c}</option>)}
                  </optgroup>
                </select>
              </div>
              {ratesUSD[assetTo] > 0 && (
                <p className="text-[10px] font-bold text-slate-400 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                  1 {assetTo} ≈ ${ratesUSD[assetTo].toLocaleString(undefined, {maximumFractionDigits: 6})}
                </p>
              )}
            </div>
          </div>

          {/* Rate Info Footer */}
          {ratesUSD[assetFrom] > 0 && ratesUSD[assetTo] > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300">
              <HiOutlineTrendingUp className="text-emerald-500 shrink-0" size={18} />
              <span className="truncate">
                1 {assetFrom} = {(ratesUSD[assetFrom] / ratesUSD[assetTo]).toLocaleString(undefined, {maximumFractionDigits: 6})} {assetTo}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CryptoForex;