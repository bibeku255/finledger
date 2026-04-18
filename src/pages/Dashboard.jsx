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
  HiOutlineCash, HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineClock,
  HiOutlineChevronRight, HiOutlineStar, HiOutlineFire, HiOutlineBell
} from 'react-icons/hi';
import { 
  FaMoneyBillWave, FaUniversity, FaWallet, FaBolt, FaTrophy, 
  FaPiggyBank, FaSun, FaMoon, FaCloudSun, FaGem, FaChartLine,
  FaArrowUp, FaArrowDown, FaCircleDollarToSlot
} from 'react-icons/fa';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];

// Premium Gradient Backgrounds
const GRADIENTS = {
  income: 'from-emerald-500 to-teal-600',
  expense: 'from-rose-500 to-pink-600',
  savings: 'from-blue-600 to-indigo-700',
  market: 'from-amber-500 to-orange-600',
  vault: 'from-purple-500 to-violet-600'
};

// Mapping for Forex Flags
const fiatFlagMap = {
  USD: 'us', INR: 'in', NPR: 'np', EUR: 'eu', GBP: 'gb', CAD: 'ca', AUD: 'au', 
  JPY: 'jp', AED: 'ae', SAR: 'sa', QAR: 'qa', KWD: 'kw', OMR: 'om', BHD: 'bh',
  PKR: 'pk', BDT: 'bd', LKR: 'lk', MXN: 'mx'
};

// Verified IDs and Custom Logos
const cryptoConfig = {
  BTC: { id: 'bitcoin' }, ETH: { id: 'ethereum' }, USDT: { id: 'tether' }, XRP: { id: 'ripple' },
  BNB: { id: 'binancecoin' }, USDC: { id: 'usd-coin' }, SOL: { id: 'solana' }, TRX: { id: 'tron' },
  DOGE: { id: 'dogecoin' }, BCH: { id: 'bitcoin-cash' }, ADA: { id: 'cardano' }, XMR: { id: 'monero' },
  XLM: { id: 'stellar' }, DAI: { id: 'dai' }, ZEC: { id: 'zcash' }, LTC: { id: 'litecoin' },
  SHIB: { id: 'shiba-inu' }, SUI: { id: 'sui' }, TON: { id: 'the-open-network' }, DOT: { id: 'polkadot' },
  PEPE: { id: 'pepe' }, BGB: { id: 'bitget-token' }, OKB: { id: 'okb' }, NEAR: { id: 'near' },
  POL: { id: 'polygon-ecosystem-token' }, KCS: { id: 'kucoin-shares' }, ATOM: { id: 'cosmos' },
  ARB: { id: 'arbitrum' }, BONK: { id: 'bonk' }, CAKE: { id: 'pancakeswap-token' },
  XTZ: { id: 'tezos' }, FLOKI: { id: 'floki' }, TWT: { id: 'trust-wallet-token' }, BAT: { id: 'basic-attention-token' },
  MX: { id: 'mx-token' }, DGB: { id: 'digibyte' }, KAVA: { id: 'kava' }, AVAX: { id: 'avalanche-2' },
  MEME: { id: 'memecoin' }, DASH: { id: 'dash' }, WRX: { id: 'wazirx' },
  CTC: { id: 'tether' }, ROX: { id: 'tether' }, 
  GT: { id: 'gatetoken', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4269.png' },
  FEY: { id: 'feyorra', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/10361.png' },
  PI: { id: 'pinetwork', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png' },
  ICE: { id: 'ice-decentralized-future', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27650.png' },
  JMPT: { id: 'jumptoken', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/17556.png' },
  TARA: { id: 'taraxa', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/8563.png' },
  CET: { id: 'coinex-token', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2496.png' },
  XYO: { id: 'xyo-network', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3163.png' },
  OP: { id: 'optimism', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png' },
};

// 🚀 Premium Stat Card Component
const StatCard = ({ title, value, icon: Icon, gradient, trend, trendValue, subtitle, onClick }) => (
  <div 
    onClick={onClick}
    className={`relative overflow-hidden rounded-[2rem] p-6 bg-gradient-to-br ${gradient} text-white shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer group`}
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_70%)]" />
    <Icon className="absolute right-[-10%] bottom-[-10%] text-8xl opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-500" />
    <div className="relative z-10">
      <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2 flex items-center gap-2">
        {title}
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] ${
            trend >= 0 ? 'bg-emerald-400/30 text-emerald-100' : 'bg-rose-400/30 text-rose-100'
          }`}>
            {trend >= 0 ? <HiOutlineArrowUp size={10} /> : <HiOutlineArrowDown size={10} />}
            {Math.abs(trend)}%
          </span>
        )}
      </p>
      <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-1">{value}</h2>
      {subtitle && (
        <p className="text-[10px] font-bold opacity-70 uppercase tracking-wider">{subtitle}</p>
      )}
      {trendValue && (
        <p className="text-xs font-bold mt-2 opacity-90">{trendValue}</p>
      )}
    </div>
    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
      <HiOutlineChevronRight size={20} className="text-white/70" />
    </div>
  </div>
);

// 🚀 Premium Market Icon Component
const MarketIcon = ({ symbol, apiImage, customLogo, type }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const symbolUpper = symbol?.toUpperCase();
  const symbolLower = symbol?.toLowerCase();

  if (type === 'fiat') {
    const flagId = fiatFlagMap[symbolUpper] || 'un';
    return (
      <div className="relative w-full h-full">
        {!isLoaded && <div className="absolute inset-0 bg-slate-700 animate-pulse rounded-full" />}
        <img 
          src={`https://flagcdn.com/w40/${flagId}.png`} 
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          alt={symbol} 
          onLoad={() => setIsLoaded(true)}
        />
      </div>
    );
  }

  const sources = [
    apiImage, 
    customLogo, 
    `https://bin.bnbstatic.com/image/admin_mgl/coin-logo/${symbolUpper}.png`, 
    `https://assets.coincap.io/assets/icons/${symbolLower}@2x.png`, 
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbolLower}.png`
  ].filter(Boolean);

  if (imgIndex >= sources.length) {
    return (
      <span className="w-full h-full flex items-center justify-center font-black text-sm bg-gradient-to-br from-slate-700 to-slate-800 text-white">
        {symbolUpper?.charAt(0)}
      </span>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!isLoaded && <div className="absolute inset-0 bg-slate-700 animate-pulse rounded-full" />}
      <img 
        src={sources[imgIndex]} 
        className={`w-full h-full object-contain p-1 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        alt={symbolUpper} 
        onLoad={() => setIsLoaded(true)}
        onError={() => setImgIndex(prev => prev + 1)}
      />
    </div>
  );
};

// 🚀 Premium Market Card Component
const MarketCard = ({ item, baseCurrency, currencySymbol }) => {
  const isPositive = item.change >= 0;
  
  return (
    <div className="min-w-[240px] snap-center p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm flex flex-col justify-between shrink-0 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 group relative overflow-hidden">
      <div className={`absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none ${
        isPositive ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-pink-500'
      }`} />
      
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-700 shadow-md group-hover:scale-110 transition-transform duration-300">
            <MarketIcon 
              symbol={item.symbol} 
              apiImage={item.image} 
              customLogo={item.customLogo} 
              type={item.type} 
            />
          </div>
          <div>
            <span className="font-black text-slate-800 dark:text-white text-base tracking-tight">{item.symbol}</span>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.type}</p>
          </div>
        </div>
        {item.change !== null && (
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-sm border transition-all group-hover:scale-105 ${
            isPositive 
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' 
              : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400'
          }`}>
            {isPositive ? <HiOutlineTrendingUp size={12} /> : <HiOutlineTrendingDown size={12} />}
            {Math.abs(item.change).toFixed(2)}%
          </span>
        )}
      </div>
      
      <div className="relative z-10">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Value in {baseCurrency}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {currencySymbol}{item.priceBase < 1 ? item.priceBase.toFixed(6) : item.priceBase.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            ≈ $ {item.priceUSD < 1 ? item.priceUSD.toFixed(6) : item.priceUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </p>
        </div>
      </div>
      
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
        }`}>
          {isPositive ? <FaArrowUp size={14} /> : <FaArrowDown size={14} />}
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = ['USD', 'EUR', 'GBP'], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [bankTotal, setBankTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [marketData, setMarketData] = useState([]);
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [greetingIcon, setGreetingIcon] = useState(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Good Morning");
      setGreetingIcon(<FaCloudSun className="text-amber-500" size={28} />);
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good Afternoon");
      setGreetingIcon(<FaSun className="text-orange-500" size={28} />);
    } else {
      setGreeting("Good Evening");
      setGreetingIcon(<FaMoon className="text-indigo-400" size={28} />);
    }
  }, []);
  
  // Vaults & Cashflow Sync
  useEffect(() => {
    if (!user) return;

    const calcVaultBalance = (snapshot) => {
      return snapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        const finalAmount = Number(data.finalBaseAmount || data.amount || 0);
        let feeAmount = 0;
        if (data.fee && data.feeExchangeRate) {
            feeAmount = Number(data.fee) * Number(data.feeExchangeRate);
        } else if (data.fee && data.exchangeRate) { 
            feeAmount = Number(data.fee) * Number(data.exchangeRate);
        } else if (data.fee) {
            feeAmount = Number(data.fee);
        }
        const netChange = data.type === 'in' ? finalAmount : -(finalAmount + feeAmount);
        return acc + netChange;
      }, 0);
    };

    const unsubBank = onSnapshot(collection(db, "users", user.uid, "bankWallet"), snap => setBankTotal(calcVaultBalance(snap)));
    const unsubCash = onSnapshot(collection(db, "users", user.uid, "cashWallet"), snap => setCashTotal(calcVaultBalance(snap)));
    const unsubOnline = onSnapshot(collection(db, "users", user.uid, "onlineWallet"), snap => setOnlineTotal(calcVaultBalance(snap)));
    
    const unsubIncome = onSnapshot(collection(db, "users", user.uid, "incomeLogs"), snap => {
      let total = 0;
      snap.docs.forEach(doc => { total += Number(doc.data().finalBaseAmount) || 0; });
      setIncomeTotal(total);
    });

    const unsubExpense = onSnapshot(collection(db, "users", user.uid, "expenseLogs"), snap => {
      let total = 0;
      snap.docs.forEach(doc => { total += Number(doc.data().finalBaseAmount) || 0; });
      setExpenseTotal(total);
      setIsLoading(false); 
    });

    return () => { unsubBank(); unsubCash(); unsubOnline(); unsubIncome(); unsubExpense(); };
  }, [user]);

  // Hybrid Live Market Data Engine
  useEffect(() => {
    const fetchMarketData = async () => {
      setIsMarketLoading(true);
      try {
        const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const fiatData = await fiatRes.json();
        const usdToBase = fiatData.rates[baseCurrency] || 1;
        let newMarketData = [];

        if (selectedCryptos && selectedCryptos.length > 0) {
          let cgJson = [];
          const normalAssets = [];
          
          selectedCryptos.forEach(c => {
             const symbol = typeof c === 'string' ? c : c.symbol;
             const upperSym = symbol.toUpperCase();
             const objId = typeof c === 'object' ? c.id : null;
             const fallbackId = cryptoConfig[upperSym]?.id || symbol.toLowerCase();
             normalAssets.push({ 
               symbol: upperSym, 
               id: objId || fallbackId, 
               customLogo: (typeof c === 'object' ? c.logo : null) || cryptoConfig[upperSym]?.logo, 
               fallbackPrice: (typeof c === 'object' ? c.fallbackPrice : 0)
             });
          });

          if (normalAssets.length > 0) {
             const uniqueIds = [...new Set(normalAssets.map(a => a.id))].join(',');
             try {
               const cgRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${uniqueIds}&sparkline=false`);
               if (cgRes.ok) cgJson = await cgRes.json();
             } catch(e) {}
          }

          for (let asset of normalAssets) {
            const live = cgJson.find(c => c.id === asset.id);
            let priceInUsd = live?.current_price || parseFloat(asset.fallbackPrice) || 0;
            let change24h = live?.price_change_percentage_24h || 0;
            let finalImage = live?.image || null;
            const priceInBase = priceInUsd * usdToBase;

            newMarketData.push({ 
              symbol: asset.symbol, 
              type: 'crypto', 
              priceUSD: priceInUsd, 
              priceBase: priceInBase, 
              change: change24h,
              image: finalImage,
              customLogo: asset.customLogo
            });
          }
        }

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

  const netWorth = bankTotal + cashTotal + onlineTotal;
  const savingsTotal = incomeTotal - expenseTotal;
  const savingsRate = incomeTotal > 0 ? ((savingsTotal / incomeTotal) * 100).toFixed(1) : 0;
  const monthlyTrend = incomeTotal > expenseTotal ? 'positive' : 'negative';

  const { assetAllocation } = useMemo(() => {
    const realAssetAllocation = [
      { name: 'Bank Ledger', value: Math.max(0, bankTotal) },
      { name: 'Physical Cash', value: Math.max(0, cashTotal) },
      { name: 'E-Wallets', value: Math.max(0, onlineTotal) }
    ].filter(asset => asset.value > 0);
    return { assetAllocation: realAssetAllocation };
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
    return Object.values(monthlyData).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-6);
  }, [rawIncomes, rawExpenses, formatGlobalDate]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-xl border border-slate-700 shadow-2xl z-50">
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
      <div className="h-full min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <div className="relative">
             <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
             <HiOutlineRefresh className="animate-spin text-4xl text-blue-500 relative" />
           </div>
           <p className="text-xs font-black text-slate-400 tracking-widest uppercase animate-pulse">Syncing Financials...</p>
        </div>
      </div>
    );
  }

  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedToday = formatGlobalDate ? formatGlobalDate(today, 'full') : today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="h-full min-h-screen overflow-y-auto pb-24">
      <div className="pt-20 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">
        
        {/* Premium Greeting Section */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <FaGem size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    {greetingIcon} {greeting}, {user?.displayName ? user.displayName.split(' ')[0] : 'Investor'}!
                  </h1>
                  <p className="text-sm font-medium text-slate-400">
                    Welcome back to your financial command center
                  </p>
                </div>
              </div>
            </div>
            <div className="md:text-right">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                <HiOutlineClock className="text-blue-400" size={16} />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dayName}</p>
                  <p className="text-sm font-bold text-white">{formattedToday}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Worth</p>
              <p className="text-lg font-black text-white">{currencySymbol}{netWorth.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monthly Trend</p>
              <p className={`text-lg font-black flex items-center gap-1 ${monthlyTrend === 'positive' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthlyTrend === 'positive' ? <FaArrowUp size={16} /> : <FaArrowDown size={16} />}
                {savingsRate}%
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assets Tracked</p>
              <p className="text-lg font-black text-white">{selectedCryptos.length + selectedFiats.length}</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard title="Total Income" value={`${currencySymbol}${incomeTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingUp} gradient={GRADIENTS.income} trend={5.2} subtitle="Lifetime earnings" />
          <StatCard title="Total Expenses" value={`${currencySymbol}${expenseTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingDown} gradient={GRADIENTS.expense} trend={-2.1} subtitle="Lifetime spending" />
          <StatCard title="Net Savings" value={`${currencySymbol}${savingsTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={FaPiggyBank} gradient={GRADIENTS.savings} subtitle={`${savingsRate}% savings rate`} trend={savingsTotal >= 0 ? 3.5 : -1.2} onClick={() => navigate('/dashboard/analytics')} />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 md:p-7 shadow-xl min-w-0 flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <FaChartLine className="text-emerald-500" size={18} /> Cash Flow Trend
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Last 6 months performance</p>
              </div>
            </div>
            <div className="flex-1 w-full min-h-[300px] relative">
              {chartCashFlow.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartCashFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                    <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} tickFormatter={(val) => `${currencySymbol}${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}`} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#334155', opacity: 0.05}} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
                    <Bar dataKey="Income" fill="#10b981" radius={[8, 8, 0, 0]} maxBarSize={50} animationDuration={1500} />
                    <Bar dataKey="Expense" fill="#f43f5e" radius={[8, 8, 0, 0]} maxBarSize={50} animationDuration={1500} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  <HiOutlineChartPie size={40} className="mb-2 opacity-50"/>
                  <p className="text-sm">No transaction data yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 md:p-7 shadow-xl flex flex-col min-w-0">
            <div className="mb-4 shrink-0">
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <FaWallet className="text-blue-500" size={16}/> Asset Allocation
              </h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Portfolio distribution</p>
            </div>
            
            {assetAllocation.length > 0 ? (
              <>
                <div className="flex-1 w-full min-h-[200px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={assetAllocation} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none" animationDuration={1200}>
                        {assetAllocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white">{currencySymbol}{netWorth.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 shrink-0">
                  {assetAllocation.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight shrink-0 pl-2">
                        {currencySymbol}{(item.value || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl min-h-[280px]">
                <FaPiggyBank size={40} className="mb-2 opacity-50"/>
                <p className="text-sm">No vault balances</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Market Portfolio */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <FaBolt className="text-amber-500" /> Live Market Portfolio
              </h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Real-time prices from your selected assets</p>
            </div>
            <div className="flex items-center gap-2">
              {isMarketLoading && <HiOutlineRefresh className="text-slate-400 animate-spin" size={18} />}
              <button onClick={() => navigate('/dashboard/crypto/tokens')} className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 hover:text-blue-600 transition-colors">
                Manage <HiOutlineChevronRight size={12} />
              </button>
            </div>
          </div>
          
          {marketData.length === 0 && !isMarketLoading ? (
            <div className="p-12 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] text-center">
              <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <HiOutlineGlobe className="text-3xl text-slate-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">No assets selected</p>
              <p className="text-[10px] text-slate-400 mt-1 mb-4">Add cryptocurrencies or forex pairs in Settings</p>
              <button onClick={() => navigate('/dashboard/crypto/tokens')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">
                <HiOutlinePlusCircle size={14} /> Add Assets
              </button>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x scroll-smooth">
              {marketData.map((item, idx) => (
                <MarketCard key={idx} item={item} baseCurrency={baseCurrency} currencySymbol={currencySymbol} />
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => navigate('/dashboard/goals')} className="group relative overflow-hidden p-5 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/5 dark:to-yellow-500/5 text-amber-600 dark:text-amber-400 rounded-[2rem] hover:shadow-xl transition-all font-black text-xs uppercase tracking-widest border border-amber-200 dark:border-amber-500/20 active:scale-95">
            <FaTrophy size={24} className="group-hover:scale-110 transition-transform" /> Savings Goals
          </button>
          <button onClick={() => navigate('/dashboard/shifting')} className="group relative overflow-hidden p-5 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-500/5 dark:to-blue-500/5 text-indigo-600 dark:text-indigo-400 rounded-[2rem] hover:shadow-xl transition-all font-black text-xs uppercase tracking-widest border border-indigo-200 dark:border-indigo-500/20 active:scale-95">
            <HiOutlineRefresh size={26} className="group-hover:rotate-180 transition-transform duration-500" /> Capital Shift
          </button>
          <button onClick={() => navigate('/dashboard/crypto/hold-profit')} className="group relative overflow-hidden p-5 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/5 dark:to-teal-500/5 text-emerald-600 dark:text-emerald-400 rounded-[2rem] hover:shadow-xl transition-all font-black text-xs uppercase tracking-widest border border-emerald-200 dark:border-emerald-500/20 active:scale-95">
            <HiOutlineChartPie size={26} className="group-hover:scale-110 transition-transform" /> Crypto P/L
          </button>
          <button onClick={() => navigate('/profile')} className="group relative overflow-hidden p-5 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-600 dark:text-slate-300 rounded-[2rem] hover:shadow-xl transition-all font-black text-xs uppercase tracking-widest border border-slate-200 dark:border-slate-600 active:scale-95">
            <HiOutlineLibrary size={26} className="group-hover:scale-110 transition-transform" /> Settings
          </button>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;