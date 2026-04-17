import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth'; 
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

import { 
  TrendingUp, 
  TrendingDown, 
  Pause, 
  Play, 
  Bitcoin, 
  Globe, 
  RefreshCcw,
  Zap,
  ArrowRight,
  Activity,
  Bell,
  BellOff
} from 'lucide-react';

// Mapping for Forex Flags
const fiatFlagMap = {
  USD: 'us', INR: 'in', NPR: 'np', EUR: 'eu', GBP: 'gb', CAD: 'ca', AUD: 'au', 
  JPY: 'jp', AED: 'ae', SAR: 'sa', QAR: 'qa', KWD: 'kw', OMR: 'om', BHD: 'bh',
  PKR: 'pk', BDT: 'bd', LKR: 'lk', MXN: 'mx'
};

// ⚡ PRO FIX: Retry Fetch Engine for Ticker to bypass rate limits smoothly
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

// 🚀 PREMIUM: Sparkline Mini Chart Component
const MiniSparkline = ({ trend, color }) => {
  const points = trend === 'up' 
    ? [8, 12, 6, 15, 10, 18, 12, 20] 
    : [12, 18, 10, 15, 8, 12, 6, 8];
  
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  
  const normalizedPoints = points.map(p => 20 - ((p - min) / range) * 16);
  const pathData = normalizedPoints.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * 3},${y}`).join(' ');
  
  return (
    <svg width="24" height="20" viewBox="0 0 21 20" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <path 
        d={pathData} 
        fill="none" 
        stroke={color === 'up' ? '#10b981' : '#f43f5e'} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <circle 
        cx="21" 
        cy={normalizedPoints[normalizedPoints.length - 1]} 
        r="2" 
        fill={color === 'up' ? '#10b981' : '#f43f5e'}
        className="animate-pulse"
      />
    </svg>
  );
};

// 🚀 PREMIUM: Enhanced Ticker Icon with Glow Effect
const TickerIcon = ({ symbol, apiImage, customLogo, isForex, flagId, bg, color, hasAlert }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const symbolUpper = symbol?.toUpperCase();
  const symbolLower = symbol?.toLowerCase();

  useEffect(() => { 
    setImgIndex(0); 
    setIsLoaded(false);
  }, [symbol, customLogo, apiImage, isForex]);

  if (isForex) {
    return (
      <div className="relative w-full h-full">
        {!isLoaded && (
          <div className="absolute inset-0 bg-slate-700 animate-pulse rounded-full" />
        )}
        <img 
          src={`https://flagcdn.com/w40/${flagId}.png`} 
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          alt={symbolUpper} 
          onLoad={() => setIsLoaded(true)}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      </div>
    );
  }

  const sources = [
    customLogo, 
    apiImage,
    `https://bin.bnbstatic.com/image/admin_mgl/coin-logo/${symbolUpper}.png`,
    `https://assets.coincap.io/assets/icons/${symbolLower}@2x.png`
  ].filter(url => typeof url === 'string' && url.trim() !== '');

  if (sources.length === 0 || imgIndex >= sources.length) {
    return (
      <span className={`w-full h-full flex items-center justify-center font-black text-[10px] bg-gradient-to-br ${bg || 'from-slate-700 to-slate-800'} ${color || 'text-white'}`}>
        {symbolUpper?.substring(0, 2)}
      </span>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-700 animate-pulse rounded-full" />
      )}
      {hasAlert && (
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full z-10 animate-pulse shadow-lg shadow-amber-500/50" />
      )}
      <img 
        src={sources[imgIndex]} 
        className={`w-full h-full object-contain p-0.5 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        alt={symbolUpper} 
        onLoad={() => setIsLoaded(true)}
        onError={() => setImgIndex(prev => prev + 1)}
      />
    </div>
  );
};

// 🚀 PREMIUM: Price Change Badge with Animation
const PriceChangeBadge = ({ changePercent }) => {
  const isPositive = changePercent >= 0;
  const absChange = Math.abs(changePercent || 0);
  const intensity = Math.min(Math.abs(changePercent) / 10, 1);
  
  return (
    <div 
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black transition-all duration-300 group-hover:scale-105 ${
        isPositive 
          ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 text-emerald-400 border border-emerald-500/20' 
          : 'bg-gradient-to-r from-rose-500/10 to-rose-500/5 text-rose-400 border border-rose-500/20'
      }`}
      style={{
        boxShadow: isPositive 
          ? `0 0 ${8 + intensity * 8}px rgba(16, 185, 129, ${0.1 + intensity * 0.15})`
          : `0 0 ${8 + intensity * 8}px rgba(244, 63, 94, ${0.1 + intensity * 0.15})`
      }}
    >
      {isPositive ? <TrendingUp size={10} className="animate-in slide-in-from-bottom-1" /> : <TrendingDown size={10} className="animate-in slide-in-from-top-1" />}
      <span>{absChange.toFixed(2)}%</span>
    </div>
  );
};

// 🚀 PREMIUM: Alert Indicator
const AlertIndicator = ({ symbol, changePercent }) => {
  const hasAlert = Math.abs(changePercent) >= 5;
  if (!hasAlert) return null;
  
  return (
    <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50">
      <div className={`px-2 py-1 rounded-lg text-[9px] font-black shadow-xl backdrop-blur-md border ${
        changePercent >= 5 
          ? 'bg-emerald-500/90 text-white border-emerald-400' 
          : 'bg-rose-500/90 text-white border-rose-400'
      }`}>
        {changePercent >= 5 ? '🚀 PUMP' : '📉 DUMP'} {Math.abs(changePercent).toFixed(1)}%
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-inherit border-inherit border-t-0 border-l-0" />
      </div>
    </div>
  );
};

const NewsTicker = () => {
  const { 
    user, 
    baseCurrency = 'USD', 
    selectedCryptos = [], 
    selectedFiats = []
  } = useAuth();
  
  const [isPaused, setIsPaused] = useState(false);
  const [activeTicker, setActiveTicker] = useState('crypto');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const tickerRef = useRef(null);
  
  const [cryptoData, setCryptoData] = useState([]);
  const [forexData, setForexData] = useState([]);
  const [marketStats, setMarketStats] = useState({ gainers: 0, losers: 0, totalVolume: 0 });

  const currencySymbols = {
    USD: '$', INR: '₹', NPR: 'रू', PKR: '₨', 
    AED: 'د.إ', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$'
  };
  const currentSymbol = currencySymbols[baseCurrency] || baseCurrency + ' ';

  const formatLivePrice = (num) => {
    const val = parseFloat(num);
    if (isNaN(val) || val === 0) return "0.00"; 
    if (val < 0.0001) return new Intl.NumberFormat('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 }).format(val);
    if (val < 1) return new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(val);
    if (val < 1000) return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    return new Intl.NumberFormat('en-US', { notation: 'compact', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  // 🚀 SILENT MARKET ALERT TRIGGER
  const triggerMarketAlert = async (symbol, changePercent) => {
    if (!user || !showAlerts) return;
    if (Math.abs(changePercent) < 5) return;

    const todayDate = new Date().toISOString().split('T')[0];
    const uniqueNotifId = `MARKET_ALERT_${symbol}_${todayDate}`;

    try {
      const notifQ = query(collection(db, "users", user.uid, "notifications"), where("uniqueId", "==", uniqueNotifId));
      const notifSnap = await getDocs(notifQ);

      if (notifSnap.empty) {
        const isPump = changePercent >= 5;
        const formattedChange = Math.abs(changePercent).toFixed(1);
        
        await addDoc(collection(db, "users", user.uid, "notifications"), {
          uniqueId: uniqueNotifId,
          title: isPump ? `🚀 Market Pump!` : `📉 Market Dump!`,
          message: `${symbol} is ${isPump ? 'up' : 'down'} by ${formattedChange}% in the last 24h.`,
          type: 'market_alert',
          isRead: false,
          timestamp: new Date().getTime(),
          link: '/dashboard/crypto/wallet'
        });
      }
    } catch (error) {
      console.error("Market Alert Error:", error);
    }
  };

  // 🚀 5-LAYER UNIVERSAL FETCHING ENGINE
  const fetchMarketData = useCallback(async () => {
    if (selectedCryptos.length === 0 && selectedFiats.length === 0) return;

    setIsRefreshing(true);
    let usdToBase = 1;
    let fiatRates = {};

    // Layer 0: Forex Base Fetch
    try {
      const forexRes = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD');
      if (forexRes && forexRes.ok) {
        const forexJson = await forexRes.json();
        fiatRates = forexJson.rates || {};
        usdToBase = parseFloat(fiatRates[baseCurrency]) || 1;
      }
    } catch (error) { console.warn("Forex API Error."); }

    if (selectedCryptos.length > 0) {
      let cgJson = {};
      const normalCoins = [];
      const contractCoins = [];

      selectedCryptos.forEach(c => {
        const coinObj = typeof c === 'string' ? { id: c.toLowerCase(), symbol: c.toUpperCase() } : c;
        const sym = (coinObj.symbol || '').toUpperCase();
        
        if (['ROX', 'CTC', 'HSH'].includes(sym)) {
           // Handled manually later
        } else if (coinObj.fetchMode === 'contract' && coinObj.contractAddress) {
           contractCoins.push(coinObj);
        } else {
           normalCoins.push(coinObj.id || coinObj.symbol.toLowerCase());
        }
      });

      // Layer 1: Mass CoinGecko Fetch
      try {
        if (normalCoins.length > 0) {
          const uniqueIds = [...new Set(normalCoins)].join(',');
          const cgRes = await fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds}&vs_currencies=usd&include_24hr_change=true`);
          if (cgRes && cgRes.ok) cgJson = await cgRes.json();
        }
      } catch (error) { console.warn("CoinGecko API blocked or failed."); }

      // Process Every Token
      const newCryptoData = await Promise.all(selectedCryptos.map(async (coinInfo) => {
        const isString = typeof coinInfo === 'string';
        const upperSym = isString ? coinInfo.toUpperCase() : (coinInfo.symbol || '').toUpperCase();
        const searchId = isString ? coinInfo.toLowerCase() : (coinInfo.id || upperSym.toLowerCase());
        const isContractMode = !isString && coinInfo.fetchMode === 'contract';
        const fallback = !isString && coinInfo.fallbackPrice ? parseFloat(coinInfo.fallbackPrice) : 0;
        
        let priceUsd = 0;
        let changePercent = 0;

        // Layer 2: Rare Coin Permanent Peg
        if (['ROX', 'CTC'].includes(upperSym)) {
            priceUsd = fallback > 0 ? fallback : 1.00;
            changePercent = (Math.random() * 2 - 1) * 0.5;
        } else if (upperSym === 'HSH') {
            priceUsd = fallback > 0 ? fallback : 0.0001; 
            changePercent = (Math.random() * 4 - 2);
        }
        // Layer 3 & 4: Deep Contract Fetching
        else if (isContractMode && coinInfo.contractAddress) {
          try {
            const dexRes = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${coinInfo.contractAddress}`);
            if (dexRes && dexRes.ok) {
              const dexData = await dexRes.json();
              if (Array.isArray(dexData.pairs) && dexData.pairs.length > 0) {
                priceUsd = parseFloat(dexData.pairs[0].priceUsd) || 0;
                changePercent = parseFloat(dexData.pairs[0].priceChange?.h24) || 0;
              }
            }
            if (!priceUsd && coinInfo.network) {
              const gtRes = await fetchWithRetry(`https://api.geckoterminal.com/api/v2/networks/${coinInfo.network}/tokens/${coinInfo.contractAddress}`);
              if (gtRes && gtRes.ok) {
                const gtData = await gtRes.json();
                priceUsd = parseFloat(gtData.data?.attributes?.price_usd) || 0;
              }
            }
          } catch(e) {}
        } 
        else {
          priceUsd = cgJson[searchId]?.usd || 0;
          changePercent = cgJson[searchId]?.usd_24h_change || 0;
        }

        // Layer 5: Binance Live API Check
        if (!priceUsd && upperSym !== 'ROX' && upperSym !== 'CTC' && upperSym !== 'HSH') {
          try {
            const bRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${upperSym}USDT`);
            if (bRes.ok) {
              const bData = await bRes.json();
              priceUsd = parseFloat(bData.lastPrice);
              changePercent = parseFloat(bData.priceChangePercent);
            }
          } catch(e) {}
        }

        if (!priceUsd && fallback > 0) {
          priceUsd = fallback;
          changePercent = 0;
        }

        const priceInBase = priceUsd * usdToBase;

        if (changePercent !== 0) triggerMarketAlert(upperSym, changePercent);

        return {
          symbol: upperSym,
          pair: `${upperSym}/${baseCurrency}`,
          price: priceInBase,
          changePercent: changePercent,
          customLogo: isString ? null : coinInfo.logo,
          bg: isString ? 'from-slate-700 to-slate-800' : (coinInfo.bg || 'from-slate-700 to-slate-800'),
          color: isString ? 'text-white' : (coinInfo.color || 'text-white'),
          hasAlert: Math.abs(changePercent) >= 5,
          apiImage: coinInfo.apiImage
        };
      }));
      
      setCryptoData(newCryptoData);
      
      // Calculate market stats
      const gainers = newCryptoData.filter(c => c.changePercent > 0).length;
      const losers = newCryptoData.filter(c => c.changePercent < 0).length;
      setMarketStats({ gainers, losers, totalVolume: newCryptoData.length });
    }

    if (selectedFiats.length > 0) {
      const newForexData = selectedFiats
        .filter(fiat => fiat !== baseCurrency)
        .map(fiat => {
          const fiatInUsd = parseFloat(fiatRates[fiat]);
          const rate = (usdToBase / fiatInUsd) || 0;
          const simulatedChange = (Math.random() * 0.4 - 0.2); 

          return {
            pair: `${fiat}/${baseCurrency}`,
            code: fiat,
            rate: rate,
            changePercent: simulatedChange, 
            flagId: fiatFlagMap[fiat] || 'un',
            hasAlert: Math.abs(simulatedChange) >= 0.3
          };
        });
      setForexData(newForexData);
    }

    setIsRefreshing(false);
  }, [baseCurrency, selectedCryptos, selectedFiats, user, showAlerts]);

  useEffect(() => {
    fetchMarketData(); 
    const interval = setInterval(fetchMarketData, 60000); 
    return () => clearInterval(interval); 
  }, [fetchMarketData]);

  // Handle pause on hover
  const handleMouseEnter = () => {
    if (!isPaused) {
      const ticker = tickerRef.current;
      if (ticker) {
        ticker.style.animationPlayState = 'paused';
      }
    }
  };

  const handleMouseLeave = () => {
    if (!isPaused) {
      const ticker = tickerRef.current;
      if (ticker) {
        ticker.style.animationPlayState = 'running';
      }
    }
  };

  const currentData = activeTicker === 'crypto' ? cryptoData : forexData;
  const animationSpeed = `${Math.max(25, currentData.length * 3.5)}s`;

  if (selectedCryptos.length === 0 && selectedFiats.length === 0) return null;

  return (
    <div className="w-full bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800/50 select-none overflow-hidden sticky top-0 z-[60] shadow-xl shadow-black/20">
      
      {/* 🚀 CSS Animation via Tailwind utilities extension */}
      <style>{`
        @keyframes ticker-slide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker-pro {
          animation: ticker-slide linear infinite;
        }
      `}</style>

      {/* Premium Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-900/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-800/50 rounded-xl backdrop-blur-sm">
            <button 
              onClick={() => setActiveTicker('crypto')} 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                activeTicker === 'crypto' 
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 scale-105' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Bitcoin size={12} className={activeTicker === 'crypto' ? 'animate-pulse' : ''} /> 
              Crypto
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[8px] ${
                activeTicker === 'crypto' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {selectedCryptos.length}
              </span>
            </button>
            <button 
              onClick={() => setActiveTicker('forex')} 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                activeTicker === 'forex' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-105' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Globe size={12} /> 
              Forex
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[8px] ${
                activeTicker === 'forex' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {selectedFiats.filter(f => f !== baseCurrency).length}
              </span>
            </button>
          </div>

          {/* Market Mood Indicator */}
          {activeTicker === 'crypto' && cryptoData.length > 0 && (
            <div className="hidden md:flex items-center gap-3 px-3 py-1 rounded-full bg-slate-800/30 border border-slate-700/30">
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-slate-500" />
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[9px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-400">{marketStats.gainers}</span>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1 text-[9px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span className="text-rose-400">{marketStats.losers}</span>
                  </span>
                </div>
              </div>
              <div className="w-px h-4 bg-slate-700/50" />
              <div className={`flex items-center gap-1 ${marketStats.gainers >= marketStats.losers ? 'text-emerald-400' : 'text-rose-400'}`}>
                {marketStats.gainers >= marketStats.losers ? (
                  <Zap size={12} className="fill-current" />
                ) : (
                  <TrendingDown size={12} />
                )}
                <span className="text-[9px] font-black">
                  {marketStats.gainers >= marketStats.losers ? 'BULLISH' : 'BEARISH'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Alert Toggle */}
          <button 
            onClick={() => setShowAlerts(!showAlerts)} 
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              showAlerts 
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800'
            }`}
            title={showAlerts ? 'Alerts On' : 'Alerts Off'}
          >
            {showAlerts ? <Bell size={14} /> : <BellOff size={14} />}
          </button>

          {/* Refresh Status */}
          <div className={`hidden xs:flex items-center gap-2 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest font-black transition-all duration-300 ${
            isRefreshing 
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
              : 'bg-slate-800/50 text-slate-500 border border-slate-700/30'
          }`}>
            <RefreshCcw size={10} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'UPDATING' : 'LIVE'}</span>
            {!isRefreshing && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            )}
          </div>

          {/* Play/Pause */}
          <button 
            onClick={() => setIsPaused(!isPaused)} 
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              isPaused 
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={14} className="fill-current" /> : <Pause size={14} className="fill-current" />}
          </button>
        </div>
      </div>

      {/* Premium Ticker Content */}
      <div 
        className="relative overflow-hidden py-2 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Gradient Fade Edges */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />
        
        <div 
          ref={tickerRef}
          className={`flex w-max items-center whitespace-nowrap gap-8 ${isPaused ? '' : 'animate-ticker-pro'}`} 
          style={{ animationDuration: animationSpeed }}
        >
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex w-max items-center gap-8 pr-8">
              {currentData.map((item, idx) => (
                <div 
                  key={idx} 
                  className="relative flex items-center gap-4 shrink-0 group px-3 py-1.5 rounded-xl transition-all duration-300 hover:bg-slate-800/30 hover:shadow-lg"
                  onMouseEnter={() => setHoveredItem(`${item.symbol || item.code}-${idx}`)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Alert Popup */}
                  <AlertIndicator symbol={item.symbol || item.code} changePercent={item.changePercent} />
                  
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="relative w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50">
                      <TickerIcon 
                         symbol={item.symbol || item.code} 
                         apiImage={item.apiImage} 
                         customLogo={item.customLogo} 
                         isForex={activeTicker === 'forex'} 
                         flagId={item.flagId}
                         bg={item.bg}
                         color={item.color}
                         hasAlert={item.hasAlert}
                      />
                    </div>
                    
                    {/* Info */}
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-black text-slate-300 uppercase tracking-wide">
                          {item.pair}
                        </span>
                        <span className="text-xs font-mono font-black text-white">
                          {activeTicker === 'crypto' ? currentSymbol : ''}{formatLivePrice(item.price ?? item.rate)}
                        </span>
                      </div>
                      
                      {/* Mini Sparkline */}
                      {activeTicker === 'crypto' && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <MiniSparkline trend={item.changePercent >= 0 ? 'up' : 'down'} color={item.changePercent >= 0 ? 'up' : 'down'} />
                          <PriceChangeBadge changePercent={item.changePercent} />
                        </div>
                      )}
                      
                      {activeTicker === 'forex' && (
                        <div className="mt-0.5">
                          <PriceChangeBadge changePercent={item.changePercent} />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-700/50 to-transparent"></div>
                  
                  {/* Hover Action Indicator */}
                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ArrowRight size={12} className="text-slate-500" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Glow Bar */}
      <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      
    </div>
  );
};

export default NewsTicker;