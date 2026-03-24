import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  HiOutlineRefresh, HiOutlineSwitchVertical, HiOutlineCalculator, 
  HiOutlineCurrencyDollar, HiOutlineTrendingUp 
} from 'react-icons/hi';
import { FaExchangeAlt, FaBitcoin, FaWallet } from 'react-icons/fa';

// 🚀 Mapping for Forex Flags & Names
const fiatCurrencies = [
  { symbol: 'USD', name: 'US Dollar', flag: 'us' },
  { symbol: 'EUR', name: 'Euro', flag: 'eu' },
  { symbol: 'GBP', name: 'British Pound', flag: 'gb' },
  { symbol: 'INR', name: 'Indian Rupee', flag: 'in' },
  { symbol: 'NPR', name: 'Nepalese Rupee', flag: 'np' },
  { symbol: 'AED', name: 'UAE Dirham', flag: 'ae' },
  { symbol: 'SAR', name: 'Saudi Riyal', flag: 'sa' },
  { symbol: 'AUD', name: 'Australian Dollar', flag: 'au' },
  { symbol: 'CAD', name: 'Canadian Dollar', flag: 'ca' },
  { symbol: 'SGD', name: 'Singapore Dollar', flag: 'sg' },
  { symbol: 'JPY', name: 'Japanese Yen', flag: 'jp' },
  { symbol: 'CNY', name: 'Chinese Yuan', flag: 'cn' },
  { symbol: 'PKR', name: 'Pakistani Rupee', flag: 'pk' },
  { symbol: 'BDT', name: 'Bangladeshi Taka', flag: 'bd' }
];

// 🚀 Fallback Database for Crypto
const defaultCryptoDatabase = {
  BTC: { id: 'bitcoin', fallbackPrice: 65000 },
  ETH: { id: 'ethereum', fallbackPrice: 3000 },
  USDT: { id: 'tether', fallbackPrice: 1.00 },
  BNB: { id: 'binancecoin', fallbackPrice: 500 },
  SOL: { id: 'solana', fallbackPrice: 140 },
  XRP: { id: 'ripple', fallbackPrice: 0.60 },
  DOGE: { id: 'dogecoin', fallbackPrice: 0.15 },
  TRX: { id: 'tron', fallbackPrice: 0.12 },
  LTC: { id: 'litecoin', fallbackPrice: 80 },
  FEY: { id: 'feyorra', fallbackPrice: 0.0091 },
  FLT: { id: 'fluenc', fallbackPrice: 0.05 },
  CTC: { id: 'tether', fallbackPrice: 1.00 },
  ROX: { id: 'tether', fallbackPrice: 1.00 }
};

const binanceSafeCoins = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX', 'LTC'];

const CryptoForex = () => {
  const { selectedCryptos = [], baseCurrency = 'USD', formatGlobalDate } = useAuth();
  
  const [ratesUSD, setRatesUSD] = useState({}); 
  const [isFetching, setIsFetching] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Extracted Cryptos from User Context
  const activeCryptos = useMemo(() => {
    const list = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    if (!list.includes('USDT')) list.push('USDT');
    if (!list.includes('BTC')) list.push('BTC');
    return [...new Set(list)];
  }, [selectedCryptos]);

  // Calculator State
  const [assetFrom, setAssetFrom] = useState(activeCryptos[0] || 'BTC');
  const [assetTo, setAssetTo] = useState(baseCurrency);
  const [amountFrom, setAmountFrom] = useState('1');
  const [amountTo, setAmountTo] = useState('0');

  const fetchAllRates = async () => {
    setIsFetching(true);
    try {
      const newRates = { USD: 1 }; 

      // 1. Fetch Fiat Rates (Base USD)
      const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fiatData = await fiatRes.json();
      fiatCurrencies.forEach(fiat => {
        if (fiatData.rates[fiat.symbol]) {
          newRates[fiat.symbol] = 1 / fiatData.rates[fiat.symbol]; 
        }
      });

      // 2. Fetch Crypto Rates
      const cgIds = activeCryptos.map(sym => {
        const obj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === sym.toUpperCase());
        return obj?.id || defaultCryptoDatabase[sym]?.id || sym.toLowerCase();
      }).join(',');

      let cgJson = {};
      try {
        const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=usd`);
        if (cgRes.ok) cgJson = await cgRes.json();
      } catch (e) { console.warn("CoinGecko API limit, utilizing fallbacks."); }

      await Promise.all(activeCryptos.map(async (sym) => {
        const upperSym = sym.toUpperCase();
        const obj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === upperSym) || {};
        const fallback = defaultCryptoDatabase[upperSym] || {};
        const searchId = obj.id || fallback.id || sym.toLowerCase();

        let priceUsd = null;

        if (cgJson[searchId]?.usd) {
          priceUsd = parseFloat(cgJson[searchId].usd);
        }

        // Binance Fallback
        if (!priceUsd && binanceSafeCoins.includes(upperSym)) {
          try {
            const bSym = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
            const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${bSym}`);
            if (bRes.ok) {
              const bData = await bRes.json();
              priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
            }
          } catch(e) {}
        }

        if (!priceUsd) {
          priceUsd = parseFloat(obj.fallbackPrice || fallback.fallbackPrice || 0);
        }

        newRates[upperSym] = priceUsd;
      }));

      setRatesUSD(newRates);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Rates fetch error", error);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchAllRates();
    const interval = setInterval(fetchAllRates, 120000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCryptos, baseCurrency]);

  // Handle Conversion Math
  useEffect(() => {
    if (Object.keys(ratesUSD).length === 0) return;
    
    const rateFrom = ratesUSD[assetFrom] || 0;
    const rateTo = ratesUSD[assetTo] || 0;

    if (rateFrom > 0 && rateTo > 0 && amountFrom !== '') {
      const valueInUSD = parseFloat(amountFrom) * rateFrom;
      const convertedValue = valueInUSD / rateTo;
      
      if (convertedValue < 0.0001) {
        setAmountTo(convertedValue.toFixed(8));
      } else if (convertedValue < 1) {
        setAmountTo(convertedValue.toFixed(4));
      } else {
        setAmountTo(convertedValue.toFixed(2));
      }
    } else {
      setAmountTo('');
    }
  }, [amountFrom, assetFrom, assetTo, ratesUSD]);

  const handleSwapAssets = () => {
    setAssetFrom(assetTo);
    setAssetTo(assetFrom);
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-4xl mx-auto px-4 md:px-0">
      
      {/* 🚀 HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-indigo-500/10 text-indigo-600 rounded-3xl ring-1 ring-indigo-500/20 shadow-lg">
              <HiOutlineCalculator size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Smart Converter</h1>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Live Global Rates for Crypto & Fiat Currencies.
              </p>
            </div>
          </div>
        </div>
        <button onClick={fetchAllRates} disabled={isFetching} className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-5 py-3 rounded-xl font-black text-xs transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50">
          <HiOutlineRefresh className={isFetching ? 'animate-spin text-blue-500' : ''} size={18} />
          {isFetching ? 'Syncing...' : 'Refresh Rates'}
        </button>
      </div>

      {/* 🧮 CALCULATOR CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 md:p-10 relative overflow-hidden">
        
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 md:gap-8">
          
          {/* FROM SECTION */}
          <div className="flex-1 w-full bg-slate-50 dark:bg-slate-800/50 p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
            <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 block">You Send</label>
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              {/* 🚀 FIXED: Mobile responsive text sizes and min-w-0 prevents blowout */}
              <input 
                type="number" 
                value={amountFrom}
                onChange={(e) => setAmountFrom(e.target.value)}
                placeholder="0.00"
                className="w-full min-w-0 flex-1 bg-transparent text-2xl sm:text-3xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
              />
              <select 
                value={assetFrom}
                onChange={(e) => setAssetFrom(e.target.value)}
                className="shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-black text-sm sm:text-lg py-2 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl cursor-pointer outline-none shadow-sm w-[100px] sm:w-[120px] appearance-none text-center"
              >
                <optgroup label="Fiat Currencies">
                  {fiatCurrencies.map(f => <option key={`from-fiat-${f.symbol}`} value={f.symbol}>{f.symbol}</option>)}
                </optgroup>
                <optgroup label="Cryptocurrencies">
                  {activeCryptos.map(c => <option key={`from-crypto-${c}`} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            {ratesUSD[assetFrom] && (
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-3 sm:mt-4 tracking-wider">
                1 {assetFrom} ≈ ${ratesUSD[assetFrom].toLocaleString(undefined, {maximumFractionDigits: 6})}
              </p>
            )}
          </div>

          {/* SWAP BUTTON */}
          <button 
            onClick={handleSwapAssets}
            className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl sm:text-2xl shadow-xl shadow-blue-500/30 hover:scale-110 active:scale-95 transition-all z-10 -my-6 md:my-0 md:-mx-8 border-4 border-white dark:border-slate-900"
          >
            <HiOutlineSwitchVertical className="md:hidden" />
            <FaExchangeAlt className="hidden md:block" />
          </button>

          {/* TO SECTION */}
          <div className="flex-1 w-full bg-slate-50 dark:bg-slate-800/50 p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
            <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 block">You Get</label>
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              {/* 🚀 FIXED: Mobile responsive text sizes and min-w-0 prevents blowout */}
              <input 
                type="text" 
                readOnly
                value={amountTo}
                placeholder="0.00"
                className="w-full min-w-0 flex-1 bg-transparent text-2xl sm:text-3xl md:text-5xl font-black tracking-tighter text-emerald-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
              />
              <select 
                value={assetTo}
                onChange={(e) => setAssetTo(e.target.value)}
                className="shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-black text-sm sm:text-lg py-2 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl cursor-pointer outline-none shadow-sm w-[100px] sm:w-[120px] appearance-none text-center"
              >
                <optgroup label="Fiat Currencies">
                  {fiatCurrencies.map(f => <option key={`to-fiat-${f.symbol}`} value={f.symbol}>{f.symbol}</option>)}
                </optgroup>
                <optgroup label="Cryptocurrencies">
                  {activeCryptos.map(c => <option key={`to-crypto-${c}`} value={c}>{c}</option>)}
                </optgroup>
              </select>
            </div>
            {ratesUSD[assetTo] && (
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-3 sm:mt-4 tracking-wider">
                1 {assetTo} ≈ ${ratesUSD[assetTo].toLocaleString(undefined, {maximumFractionDigits: 6})}
              </p>
            )}
          </div>

        </div>

        {/* INFO FOOTER */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
           {ratesUSD[assetFrom] && ratesUSD[assetTo] && (
             <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300">
               <HiOutlineTrendingUp className="text-emerald-500 text-lg"/> 
               1 {assetFrom} = {(ratesUSD[assetFrom] / ratesUSD[assetTo]).toLocaleString(undefined, {maximumFractionDigits: 6})} {assetTo}
             </div>
           )}
           
           <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
              <HiOutlineRefresh className={isFetching ? 'animate-spin' : ''} />
              Rates updated: {formatGlobalDate ? formatGlobalDate(lastUpdated, 'short') : lastUpdated.toLocaleTimeString()}
           </div>
        </div>
      </div>

      {/* QUICK MARKET GLANCE */}
      <div>
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Quick Market Reference</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['BTC', 'ETH', 'SOL', 'USDT'].filter(sym => activeCryptos.includes(sym)).map(sym => {
            const usdRate = ratesUSD[sym];
            const targetRate = ratesUSD[assetTo];
            const localVal = usdRate && targetRate ? (usdRate / targetRate) : 0;
            
            return (
              <div key={sym} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setAssetFrom(sym)}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><FaBitcoin /></div>
                  <span className="font-black text-slate-800 dark:text-white">{sym}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-500">{localVal > 1 ? localVal.toLocaleString(undefined, {maximumFractionDigits: 2}) : localVal.toFixed(4)}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{assetTo}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default CryptoForex;