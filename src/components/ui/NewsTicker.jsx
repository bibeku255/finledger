import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth'; 
// 🚀 Kept Firebase logic for silent Bell Notifications
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

import { 
  TrendingUp, 
  TrendingDown, 
  Pause, 
  Play, 
  Bitcoin, 
  Globe, 
  RefreshCcw 
} from 'lucide-react';

// Mapping for Forex Flags
const fiatFlagMap = {
  USD: 'us', INR: 'in', NPR: 'np', EUR: 'eu', GBP: 'gb', CAD: 'ca', AUD: 'au', 
  JPY: 'jp', AED: 'ae', SAR: 'sa', QAR: 'qa', KWD: 'kw', OMR: 'om', BHD: 'bh',
  PKR: 'pk', BDT: 'bd', LKR: 'lk', MXN: 'mx'
};

const TickerIcon = ({ symbol, apiImage, customLogo, isForex, flagId, bg, color }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const symbolUpper = symbol?.toUpperCase();
  const symbolLower = symbol?.toLowerCase();

  useEffect(() => { setImgIndex(0); }, [symbol, customLogo, apiImage, isForex]);

  if (isForex) {
    return (
      <img 
        src={`https://flagcdn.com/w40/${flagId}.png`} 
        className="w-full h-full object-cover bg-slate-800" 
        alt={symbolUpper} 
        onError={(e) => { e.target.style.display = 'none'; }}
      />
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
      <span className={`w-full h-full flex items-center justify-center font-black text-[10px] ${bg || 'bg-slate-800'} ${color || 'text-white'}`}>
        {symbolUpper?.substring(0, 2)}
      </span>
    );
  }

  return (
    <img 
      src={sources[imgIndex]} 
      className="w-full h-full object-contain p-0.5 bg-slate-900" 
      alt={symbolUpper} 
      onError={() => setImgIndex(prev => prev + 1)}
    />
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
  
  const [cryptoData, setCryptoData] = useState([]);
  const [forexData, setForexData] = useState([]);

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
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  // 🚀 SILENT MARKET ALERT TRIGGER (NO VOICE)
  const triggerMarketAlert = async (symbol, changePercent) => {
    if (!user) return;
    
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
          title: isPump ? `Market Pump! 🚀` : `Market Dump! 📉`,
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

  // 🚀 THE HYBRID FETCHING ENGINE (CoinGecko + GeckoTerminal)
  const fetchMarketData = useCallback(async () => {
    if (selectedCryptos.length === 0 && selectedFiats.length === 0) return;

    setIsRefreshing(true);
    let usdToBase = 1;
    let fiatRates = {};

    // 1. Fetch Forex Rates
    try {
      const forexRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (forexRes.ok) {
        const forexJson = await forexRes.json();
        fiatRates = forexJson.rates || {};
        usdToBase = parseFloat(fiatRates[baseCurrency]) || 1;
      }
    } catch (error) { console.warn("Forex API Error."); }

    // 2. Fetch Crypto Data
    if (selectedCryptos.length > 0) {
      let cgJson = {};
      let geckoTerminalData = {}; // Store custom token data here
      
      // Separate normal coins (CoinGecko) and Custom Contracts (GeckoTerminal)
      const normalCoins = [];
      const contractCoins = [];

      selectedCryptos.forEach(c => {
        if (typeof c === 'string') {
           normalCoins.push(c.toLowerCase());
        } else if (c.fetchMode === 'contract' && c.network && c.contractAddress) {
           contractCoins.push(c);
        } else {
           normalCoins.push(c.id || c.symbol.toLowerCase());
        }
      });

      // --- A: FETCH NORMAL COINS FROM COINGECKO ---
      try {
        if (normalCoins.length > 0) {
          const uniqueIds = [...new Set(normalCoins)].join(',');
          const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds}&vs_currencies=usd&include_24hr_change=true`);
          if (cgRes.ok) cgJson = await cgRes.json();
        }
      } catch (error) { console.warn("CoinGecko API blocked or failed."); }

      // --- B: FETCH CUSTOM CONTRACTS FROM GECKOTERMINAL ---
      // Note: We loop through them. (GeckoTerminal has limits, so we handle failures gracefully)
      for (const customCoin of contractCoins) {
        try {
          const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${customCoin.network}/tokens/${customCoin.contractAddress}`);
          if (gtRes.ok) {
            const gtJson = await gtRes.json();
            geckoTerminalData[customCoin.id] = {
              usd: parseFloat(gtJson.data.attributes.price_usd),
              usd_24h_change: 0 // GeckoTerminal token API doesn't always give simple 24h change, so we default to 0 to avoid crashes
            };
          }
        } catch (error) { console.warn(`GeckoTerminal failed for ${customCoin.symbol}`); }
      }

      // --- C: COMPILE FINAL DATA ---
      const newCryptoData = await Promise.all(selectedCryptos.map(async (coinInfo) => {
        const upperSym = typeof coinInfo === 'string' ? coinInfo.toUpperCase() : coinInfo.symbol.toUpperCase();
        const searchId = typeof coinInfo === 'string' ? coinInfo.toLowerCase() : (coinInfo.id || upperSym.toLowerCase());
        const isContractMode = coinInfo.fetchMode === 'contract';
        
        let priceUsd = 0;
        let changePercent = 0;

        if (isContractMode && geckoTerminalData[searchId]) {
            // Live Price from GeckoTerminal
            priceUsd = geckoTerminalData[searchId].usd;
            changePercent = geckoTerminalData[searchId].usd_24h_change;
        } else if (!isContractMode) {
            // Live Price from CoinGecko
            priceUsd = cgJson[searchId]?.usd;
            changePercent = cgJson[searchId]?.usd_24h_change || 0;
        }

        // --- D: FALLBACK TO BINANCE OR DEFAULT PRICE ---
        if (!priceUsd) {
          try {
            const fetchSym = searchId === 'tether' ? 'BTC' : upperSym; 
            const bRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${fetchSym}USDT`);
            if (bRes.ok) {
              const bData = await bRes.json();
              priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.lastPrice);
              changePercent = searchId === 'tether' ? 0.01 : parseFloat(bData.priceChangePercent);
            }
          } catch(e) {}
        }

        // Final safe price (Uses live if available, otherwise uses the fallback price you manually typed)
        const finalPriceUsd = priceUsd || (typeof coinInfo === 'object' ? coinInfo.fallbackPrice : 0) || 0;
        const priceInBase = finalPriceUsd * usdToBase;

        if (changePercent !== 0) {
          triggerMarketAlert(upperSym, changePercent);
        }

        return {
          symbol: upperSym,
          pair: `${upperSym}/${baseCurrency}`,
          price: priceInBase,
          changePercent: changePercent,
          customLogo: typeof coinInfo === 'object' ? coinInfo.logo : null,
          bg: typeof coinInfo === 'object' ? coinInfo.bg : 'bg-slate-800',
          color: typeof coinInfo === 'object' ? coinInfo.color : 'text-white'
        };
      }));
      setCryptoData(newCryptoData);
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
            flagId: fiatFlagMap[fiat] || 'un' 
          };
        });
      setForexData(newForexData);
    }

    setIsRefreshing(false);
  }, [baseCurrency, selectedCryptos, selectedFiats, user]);

  useEffect(() => {
    fetchMarketData(); 
    // Auto Refresh Every 60 Seconds
    const interval = setInterval(fetchMarketData, 60000); 
    return () => clearInterval(interval); 
  }, [fetchMarketData]);

  const currentData = activeTicker === 'crypto' ? cryptoData : forexData;
  const animationSpeed = `${Math.max(20, currentData.length * 3)}s`;

  return (
    <div className="w-full bg-slate-950 border-b border-slate-800 select-none overflow-hidden sticky top-0 z-[60]">
      <div className="flex items-center justify-between px-4 py-1 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveTicker('crypto')} className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase transition-all ${activeTicker === 'crypto' ? 'bg-orange-500/20 text-orange-500 ring-1 ring-orange-500/20' : 'text-slate-500 hover:bg-slate-800'}`}>
            <Bitcoin size={12} /> Crypto ({selectedCryptos.length})
          </button>
          <button onClick={() => setActiveTicker('forex')} className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase transition-all ${activeTicker === 'forex' ? 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/20' : 'text-slate-500 hover:bg-slate-800'}`}>
            <Globe size={12} /> Forex ({selectedFiats.filter(f => f !== baseCurrency).length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className={`hidden xs:flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-bold ${isRefreshing ? 'text-blue-500' : 'text-slate-500'}`}>
            <RefreshCcw size={10} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Updating...' : 'Live'}
          </div>
          <button onClick={() => setIsPaused(!isPaused)} className="p-1 text-slate-500 hover:text-white transition-colors">
            {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden py-1.5 bg-slate-950">
        <div className={`flex w-max items-center whitespace-nowrap gap-10 ${isPaused ? '' : 'animate-ticker'}`} style={{ animationDuration: animationSpeed }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex w-max items-center gap-10 pr-10">
              {currentData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 shrink-0 group">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform bg-slate-800">
                      <TickerIcon 
                         symbol={item.symbol || item.code} 
                         apiImage={item.image} 
                         customLogo={item.customLogo} 
                         isForex={activeTicker === 'forex'} 
                         flagId={item.flagId}
                         bg={item.bg}
                         color={item.color}
                      />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{item.pair}</span>
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {activeTicker === 'crypto' ? currentSymbol : ''}{formatLivePrice(item.price ?? item.rate)}
                      </span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.changePercent >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Math.abs(item.changePercent || 0).toFixed(2)}%
                  </div>
                  <div className="w-px h-3 bg-slate-800"></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsTicker;