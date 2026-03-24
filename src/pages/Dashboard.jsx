import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

import { 
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineLibrary,
  HiOutlineGlobe, HiOutlinePlusCircle, HiOutlineReceiptTax, 
  HiOutlineRefresh, HiOutlineChartPie, HiOutlineSparkles, HiOutlineCalculator,
  HiOutlineCash 
} from 'react-icons/hi';
import { FaMoneyBillWave, FaUniversity, FaWallet, FaBolt, FaTrophy, FaPiggyBank, FaSun, FaMoon, FaCloudSun } from 'react-icons/fa';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

// 🚀 Mapping for Forex Flags
const fiatFlagMap = {
  USD: 'us', INR: 'in', NPR: 'np', EUR: 'eu', GBP: 'gb', CAD: 'ca', AUD: 'au', 
  JPY: 'jp', AED: 'ae', SAR: 'sa', QAR: 'qa', KWD: 'kw', OMR: 'om', BHD: 'bh',
  PKR: 'pk', BDT: 'bd', LKR: 'lk', MXN: 'mx'
};

// 🚀 Verified IDs and Custom Logos
const cryptoConfig = {
  BTC: { id: 'bitcoin' }, ETH: { id: 'ethereum' }, USDT: { id: 'tether' }, XRP: { id: 'ripple' },
  BNB: { id: 'binancecoin' }, USDC: { id: 'usd-coin' }, SOL: { id: 'solana' }, TRX: { id: 'tron' },
  DOGE: { id: 'dogecoin' }, BCH: { id: 'bitcoin-cash' }, ADA: { id: 'cardano' }, XMR: { id: 'monero' },
  XLM: { id: 'stellar' }, DAI: { id: 'dai' }, ZEC: { id: 'zcash' }, LTC: { id: 'litecoin' },
  SHIB: { id: 'shiba-inu' }, SUI: { id: 'sui' }, TON: { id: 'the-open-network' }, DOT: { id: 'polkadot' },
  PEPE: { id: 'pepe' }, BGB: { id: 'bitget-token' }, OKB: { id: 'okb' }, NEAR: { id: 'near' },
  POL: { id: 'polygon-ecosystem-token' }, KCS: { id: 'kucoin-shares' }, ATOM: { id: 'cosmos' },
  TRUMP: { id: 'maga' }, ARB: { id: 'arbitrum' }, BONK: { id: 'bonk' }, CAKE: { id: 'pancakeswap-token' },
  XTZ: { id: 'tezos' }, FLOKI: { id: 'floki' }, TWT: { id: 'trust-wallet-token' }, BAT: { id: 'basic-attention-token' },
  MX: { id: 'mx-token' }, DGB: { id: 'digibyte' }, KAVA: { id: 'kava' }, AVAX: { id: 'avalanche-2' },
  MEME: { id: 'memecoin' }, DASH: { id: 'dash' }, WRX: { id: 'wazirx' },
  CTC: { id: 'tether' }, ROX: { id: 'tether' }, 
  
  // Custom Direct Links for Micro/New Coins
  GT: { id: 'gatetoken', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4269.png' },
  FEY: { id: 'feyorra', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/10361.png' },
  PI: { id: 'pinetwork', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png' },
  ICE: { id: 'ice-decentralized-future', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27650.png' },
  JMPT: { id: 'jumptoken', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/17556.png' },
  TARA: { id: 'taraxa', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/8563.png' },
  CET: { id: 'coinex-token', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2496.png' },
  XYO: { id: 'xyo-network', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3163.png' },
  XSPACE: { id: 'xspace', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/9928.png' },
  BANANAS31: { id: 'bananas31', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/34118.png' },
  FLT: { id: 'fluenc', logo: 'https://cdn.faucetpay.io/coins/flt.png' },
  MARCO: { id: 'marco', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/22234.png' },
  OP: { id: 'optimism', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png' },
};

// 🚀 Dashboard Market Icon Component
const MarketIcon = ({ symbol, apiImage, customLogo, type }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const symbolUpper = symbol?.toUpperCase();
  const symbolLower = symbol?.toLowerCase();

  if (type === 'fiat') {
    const flagId = fiatFlagMap[symbolUpper] || 'un';
    return <img src={`https://flagcdn.com/w40/${flagId}.png`} className="w-full h-full object-cover" alt={symbol} />;
  }

  const sources = [
    apiImage, 
    customLogo, 
    `https://bin.bnbstatic.com/image/admin_mgl/coin-logo/${symbolUpper}.png`, 
    `https://assets.coincap.io/assets/icons/${symbolLower}@2x.png`, 
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbolLower}.png`
  ].filter(Boolean);

  if (imgIndex >= sources.length) {
    return <span className="text-xs font-black text-slate-400 w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full">{symbolUpper?.charAt(0)}</span>;
  }

  return (
    <img 
      src={sources[imgIndex]} 
      className="w-full h-full object-contain p-1 rounded-full bg-white dark:bg-slate-900" 
      alt={symbolUpper} 
      onError={() => setImgIndex(prev => prev + 1)}
    />
  );
};

const Dashboard = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = ['USD', 'EUR', 'GBP'], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  
  // Core Financial States
  const [bankTotal, setBankTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);

  // Chart Data States
  const [incomeChartData, setIncomeChartData] = useState([]);
  const [expenseChartData, setExpenseChartData] = useState([]);

  // Live Market States
  const [marketData, setMarketData] = useState([]);
  const [isMarketLoading, setIsMarketLoading] = useState(true);

  // 🚀 Greeting Logic Setup
  const [greeting, setGreeting] = useState('');
  const [greetingIcon, setGreetingIcon] = useState(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Good Morning");
      setGreetingIcon(<FaCloudSun className="text-amber-500" />);
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good Afternoon");
      setGreetingIcon(<FaSun className="text-orange-500" />);
    } else {
      setGreeting("Good Evening");
      setGreetingIcon(<FaMoon className="text-indigo-400" />);
    }
  }, []);
  
  // 1️⃣ Vaults & Cashflow Sync
  useEffect(() => {
    if (!user) return;

    const calcVaultBalance = (snapshot) => {
      return snapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        const amt = Number(data.finalBaseAmount) || 0;
        return acc + (data.type === 'in' ? amt : -amt);
      }, 0);
    };

    const processCategoryData = (snapshot) => {
      const grouped = {};
      let total = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const cat = data.category || 'Other';
        const amt = Number(data.finalBaseAmount) || 0;
        grouped[cat] = (grouped[cat] || 0) + amt;
        total += amt;
      });
      const chartData = Object.keys(grouped)
        .map(key => ({ name: key, value: grouped[key] }))
        .sort((a, b) => b.value - a.value); 
      return { total, chartData };
    };

    const unsubBank = onSnapshot(collection(db, "users", user.uid, "bankWallet"), snap => setBankTotal(calcVaultBalance(snap)));
    const unsubCash = onSnapshot(collection(db, "users", user.uid, "cashWallet"), snap => setCashTotal(calcVaultBalance(snap)));
    const unsubOnline = onSnapshot(collection(db, "users", user.uid, "onlineWallet"), snap => setOnlineTotal(calcVaultBalance(snap)));
    
    const unsubIncome = onSnapshot(collection(db, "users", user.uid, "incomeLogs"), snap => {
      const { total, chartData } = processCategoryData(snap);
      setIncomeTotal(total);
      setIncomeChartData(chartData);
    });

    const unsubExpense = onSnapshot(collection(db, "users", user.uid, "expenseLogs"), snap => {
      const { total, chartData } = processCategoryData(snap);
      setExpenseTotal(total);
      setExpenseChartData(chartData);
      setIsLoading(false); 
    });

    return () => { unsubBank(); unsubCash(); unsubOnline(); unsubIncome(); unsubExpense(); };
  }, [user]);

  // 2️⃣ 🚀 UPGRADED LIVE MARKET DATA ENGINE
  useEffect(() => {
    const fetchMarketData = async () => {
      setIsMarketLoading(true);
      try {
        const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const fiatData = await fiatRes.json();
        const usdToBase = fiatData.rates[baseCurrency] || 1;

        let newMarketData = [];

        // 🟢 Crypto Logic via CoinGecko
        if (selectedCryptos && selectedCryptos.length > 0) {
          
          const mappedAssets = selectedCryptos.map(c => {
             const symbol = typeof c === 'string' ? c : c.symbol;
             const upperSym = symbol.toUpperCase();
             const objId = typeof c === 'object' ? c.id : null;
             const fallbackId = cryptoConfig[upperSym]?.id || symbol.toLowerCase();
             return { symbol: upperSym, id: objId || fallbackId, customLogo: (typeof c === 'object' ? c.logo : null) || cryptoConfig[upperSym]?.logo, fallbackPrice: (typeof c === 'object' ? c.fallbackPrice : 0) };
          });

          const uniqueIds = [...new Set(mappedAssets.map(a => a.id))].join(',');
          
          let cgJson = [];
          try {
            const cgRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${uniqueIds}&sparkline=false`);
            if (cgRes.ok) cgJson = await cgRes.json();
          } catch(e) { console.warn("Market Dashboard: CoinGecko Limit Reached. Using Fallbacks."); }

          const binanceSafeCoins = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX', 'LTC', 'BCH', 'ADA', 'XMR', 'XLM', 'DAI', 'ZEC', 'SHIB', 'SUI', 'TON', 'DOT', 'PEPE', 'NEAR', 'POL', 'ATOM', 'ARB', 'BONK', 'CAKE', 'XTZ', 'FLOKI', 'OP', 'TWT', 'BAT', 'DGB', 'KAVA', 'AVAX', 'MEME', 'DASH'];

          for (let asset of mappedAssets) {
            const live = cgJson.find(c => c.id === asset.id);
            
            let priceInUsd = live ? live.current_price : null;
            let change24h = live ? live.price_change_percentage_24h : 0;

            if (!priceInUsd && binanceSafeCoins.includes(asset.symbol.toUpperCase())) {
               try {
                 const bSym = asset.id === 'tether' ? 'BTCUSDT' : `${asset.symbol.toUpperCase()}USDT`;
                 const bRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${bSym}`);
                 if (bRes.ok) {
                   const bData = await bRes.json();
                   priceInUsd = asset.id === 'tether' ? 1.00 : parseFloat(bData.lastPrice);
                   change24h = asset.id === 'tether' ? 0.01 : parseFloat(bData.priceChangePercent);
                 }
               } catch(e) {}
            }

            if (!priceInUsd) {
               priceInUsd = parseFloat(asset.fallbackPrice || 0);
            }

            const priceInBase = priceInUsd * usdToBase;

            newMarketData.push({ 
              symbol: asset.symbol, 
              type: 'crypto', 
              priceUSD: priceInUsd, 
              priceBase: priceInBase, 
              change: change24h,
              image: live?.image,
              customLogo: asset.customLogo
            });
          }
        }

        // 🔵 Fiat Logic
        if (selectedFiats && selectedFiats.length > 0) {
          selectedFiats.forEach(fiat => {
            if (fiat !== baseCurrency) { 
              const rateToUsd = fiatData.rates[fiat];
              if(rateToUsd) {
                const priceInUsd = 1 / rateToUsd;
                const priceInBase = priceInUsd * usdToBase;
                newMarketData.push({ 
                  symbol: fiat, 
                  type: 'fiat', 
                  priceUSD: priceInUsd, 
                  priceBase: priceInBase, 
                  change: (Math.random() * 0.4 - 0.2) 
                });
              }
            }
          });
        }

        setMarketData(newMarketData);
      } catch (error) {
        console.error("Market fetch failed", error);
      } finally {
        setIsMarketLoading(false);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000); 
    return () => clearInterval(interval);
  }, [baseCurrency, selectedCryptos, selectedFiats]);

  // Master Calculations
  const netWorth = bankTotal + cashTotal + onlineTotal;
  const getPercentage = (value, total) => total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  
  const bankPct = getPercentage(bankTotal > 0 ? bankTotal : 0, netWorth > 0 ? netWorth : 1);
  const cashPct = getPercentage(cashTotal > 0 ? cashTotal : 0, netWorth > 0 ? netWorth : 1);
  const onlinePct = getPercentage(onlineTotal > 0 ? onlineTotal : 0, netWorth > 0 ? netWorth : 1);

  const totalCashFlow = incomeTotal + expenseTotal;
  const incomePct = getPercentage(incomeTotal, totalCashFlow > 0 ? totalCashFlow : 1);
  const expensePct = getPercentage(expenseTotal, totalCashFlow > 0 ? totalCashFlow : 1);
  const savingsRate = incomeTotal > 0 ? (((incomeTotal - expenseTotal) / incomeTotal) * 100).toFixed(1) : 0;

  const { assetAllocation } = useMemo(() => {
    const realAssetAllocation = [
      { name: 'Bank Ledger', value: Math.max(0, bankTotal) },
      { name: 'Physical Cash', value: Math.max(0, cashTotal) },
      { name: 'E-Wallets', value: Math.max(0, onlineTotal) }
    ].filter(asset => asset.value > 0);

    return {
      assetAllocation: realAssetAllocation
    };
  }, [bankTotal, cashTotal, onlineTotal]);

  const [rawIncomes, setRawIncomes] = useState([]);
  const [rawExpenses, setRawExpenses] = useState([]);
  
  useEffect(() => {
    if (!user) return;
    const unsubInc = onSnapshot(collection(db, "users", user.uid, "incomeLogs"), snap => setRawIncomes(snap.docs.map(d => d.data())));
    const unsubExp = onSnapshot(collection(db, "users", user.uid, "expenseLogs"), snap => setRawExpenses(snap.docs.map(d => d.data())));
    return () => { unsubInc(); unsubExp(); };
  }, [user]);

  const chartCashFlow = useMemo(() => {
    const monthlyData = {};

    rawIncomes.forEach(data => {
      const amt = parseFloat(data.finalBaseAmount || data.amount) || 0;
      const dateObj = new Date(data.date || new Date());
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { sortKey, monthName, Income: 0, Expense: 0 };
      monthlyData[sortKey].Income += amt;
    });

    rawExpenses.forEach(data => {
      const amt = parseFloat(data.finalBaseAmount || data.amount) || 0;
      const dateObj = new Date(data.date || new Date());
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { sortKey, monthName, Income: 0, Expense: 0 };
      monthlyData[sortKey].Expense += amt;
    });

    return Object.values(monthlyData)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-6)
      .map(item => ({
        name: item.monthName, 
        Income: item.Income,
        Expense: item.Expense
      }));
  }, [rawIncomes, rawExpenses, formatGlobalDate]);


  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-xl border border-slate-700 shadow-2xl z-50">
          <p className="font-black mb-2 text-slate-300">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              {entry.name}: {currencySymbol}{entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="pt-24 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
           <HiOutlineRefresh className="animate-spin text-4xl text-blue-500" />
           <p className="text-xs font-black text-slate-400 tracking-widest uppercase animate-pulse">Syncing Financials...</p>
        </div>
      </div>
    );
  }

  // Formatting Today's Date with Global System
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedToday = formatGlobalDate ? formatGlobalDate(today, 'full') : today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="pt-20 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* 🚀 1. GREETING & DATE SECTION (NEW) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/10 p-6 rounded-[2rem] border border-blue-100/50 dark:border-blue-900/30">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            {greetingIcon} {greeting}, {user?.displayName ? user.displayName.split(' ')[0] : 'Investor'}!
          </h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Here is your financial snapshot for today.
          </p>
        </div>
        <div className="md:text-right bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{dayName}</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formattedToday}</p>
        </div>
      </div>

      {/* 📊 KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group transition-all hover:-translate-y-1">
          <HiOutlineTrendingUp className="absolute right-[-5%] bottom-[-10%] text-9xl opacity-10 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Total Life-Time Income</p>
          <h2 className="text-4xl font-black tracking-tight">{currencySymbol}{incomeTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-6 rounded-[2rem] text-white shadow-xl shadow-rose-500/20 relative overflow-hidden group transition-all hover:-translate-y-1">
          <HiOutlineTrendingDown className="absolute right-[-5%] bottom-[-10%] text-9xl opacity-10 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Total Life-Time Expenses</p>
          <h2 className="text-4xl font-black tracking-tight">{currencySymbol}{expenseTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2rem] text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group transition-all hover:-translate-y-1">
          <FaPiggyBank className="absolute right-[-5%] bottom-[-10%] text-9xl opacity-10 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Net Cash Savings</p>
          <div className="flex items-end gap-3">
             <h2 className="text-4xl font-black tracking-tight">{currencySymbol}{(incomeTotal - expenseTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          </div>
          <span className="inline-block mt-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-sm">{savingsRate}% Rate</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 📈 CASH FLOW CHART (BAR) - FIXED WIDTH */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 md:p-8 shadow-sm min-w-0 flex flex-col">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2 shrink-0">
             <HiOutlineCash className="text-emerald-500" size={20}/> 6-Month Cash Flow Trend
          </h3>
          <div className="flex-1 w-full min-h-[300px] relative">
            {chartCashFlow.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartCashFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} tickFormatter={(val) => `${currencySymbol}${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#334155', opacity: 0.05}} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
                  <Bar dataKey="Income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={45} animationDuration={1500} />
                  <Bar dataKey="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={45} animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                <HiOutlineChartPie size={40} className="mb-2 opacity-50"/>
                <p>Not enough data to map trends.</p>
              </div>
            )}
          </div>
        </div>

        {/* 🍕 ASSET ALLOCATION (PIE) - FIXED WIDTH */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col min-w-0">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-2 flex items-center gap-2 shrink-0">
             <FaWallet className="text-blue-500" size={16}/> Live Asset Allocation
          </h3>
          <p className="text-xs text-slate-500 font-semibold mb-4 shrink-0">Calculated from Vault Balances</p>
          
          {assetAllocation.length > 0 ? (
            <>
              <div className="flex-1 w-full min-h-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetAllocation}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      animationDuration={1000}
                    >
                      {assetAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Text */}
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Portfolio</span>
                </div>
              </div>
              
              {/* Custom Legend */}
              <div className="mt-4 space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 shrink-0">
                {assetAllocation.map((item, idx) => (
                   <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight shrink-0 pl-2">
                        {currencySymbol}{(item.value || 0).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                      </span>
                   </div>
                ))}
              </div>
            </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl mt-4 min-h-[250px]">
               <FaPiggyBank size={40} className="mb-2 opacity-50"/>
               <p className="text-xs">Vaults are currently empty.</p>
             </div>
          )}
        </div>

      </div>

      {/* 🟢 LEVEL 4: EXTERNAL MARKETS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <FaBolt className="text-amber-500" /> Live Market Portfolio
          </h3>
          {isMarketLoading && <HiOutlineRefresh className="text-slate-400 animate-spin" />}
        </div>
        
        {marketData.length === 0 && !isMarketLoading ? (
          <div className="p-10 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] text-center">
            <HiOutlineGlobe className="mx-auto text-4xl text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 font-bold text-sm">No assets selected. Add them in Settings.</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
            {marketData.map((item, idx) => (
              <div key={idx} className="min-w-[220px] snap-center p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm flex flex-col justify-between shrink-0 hover:shadow-md hover:border-blue-500/30 transition-all group relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-500"></div>
                
                <div className="flex justify-between items-center mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 shadow-inner group-hover:scale-110 transition-transform">
                      <MarketIcon 
                        symbol={item.symbol} 
                        apiImage={item.image} 
                        customLogo={item.customLogo} 
                        type={item.type} 
                      />
                    </div>
                    <span className="font-black text-slate-800 dark:text-white text-base tracking-tight">{item.symbol}</span>
                  </div>
                  {item.change !== null && (
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-0.5 shadow-sm border ${item.change >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400'}`}>
                      {item.change >= 0 ? <HiOutlineTrendingUp/> : <HiOutlineTrendingDown/>}
                      {Math.abs(item.change).toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="relative z-10">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Value in {baseCurrency}</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {currencySymbol}{item.priceBase < 1 ? item.priceBase.toFixed(4) : item.priceBase.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                    $ {item.priceUSD < 1 ? item.priceUSD.toFixed(4) : item.priceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🟣 LEVEL 5: QUICK UTILITIES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => navigate('/dashboard/goals')} className="p-5 flex flex-col items-center justify-center gap-3 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-[2rem] hover:bg-yellow-100 dark:hover:bg-yellow-500/20 transition-all font-black text-xs uppercase tracking-widest border border-yellow-100 dark:border-yellow-500/20 shadow-sm active:scale-95">
          <FaTrophy size={24} /> Savings Goals
        </button>
        <button onClick={() => navigate('/dashboard/shifting')} className="p-5 flex flex-col items-center justify-center gap-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-[2rem] hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all font-black text-xs uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/20 shadow-sm active:scale-95">
          <HiOutlineRefresh size={26} /> Capital Shift
        </button>
        <button onClick={() => navigate('/dashboard/crypto/hold-profit')} className="p-5 flex flex-col items-center justify-center gap-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-[2rem] hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all font-black text-xs uppercase tracking-widest border border-amber-100 dark:border-amber-500/20 shadow-sm active:scale-95">
          <HiOutlineChartPie size={26} /> Crypto P/L
        </button>
        <button onClick={() => navigate('/profile')} className="p-5 flex flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-[2rem] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-black text-xs uppercase tracking-widest border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95">
          <HiOutlineLibrary size={26} /> Settings
        </button>
      </div>

    </div>
  );
};

export default Dashboard;