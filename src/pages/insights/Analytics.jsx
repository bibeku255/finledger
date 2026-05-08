import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { useNavigate } from 'react-router-dom';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  HiOutlineChartPie, HiOutlineTrendingUp, HiOutlineTrendingDown, 
  HiOutlineCash, HiOutlineRefresh, HiOutlineArrowUp, HiOutlineArrowDown,
  HiOutlineCalendar, HiOutlineFilter, HiOutlineDownload, HiOutlineEye,
  HiOutlineLightningBolt, HiOutlineScale
} from 'react-icons/hi';
import { 
  FaWallet, FaPiggyBank, FaChartLine, FaChartBar, FaChartPie,
  FaMoneyBillWave, FaCoins, FaPercentage
} from 'react-icons/fa';

// 🚀 IMPORT ONLY THE FLAG MAP / BASE CONSTANTS
import { fiatFlagMap } from '../../utils/marketConstants';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#f43f5e', '#06b6d4', '#ec4899', '#84cc16'];

// ============================================
// 🚀 PREMIUM COMPONENTS
// ============================================

const KPICard = ({ icon: Icon, label, value, subValue, gradient, isPositive, isCurrency }) => (
  <div className={`group relative p-5 sm:p-6 rounded-[2rem] text-white shadow-xl overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl ${gradient}`}>
    {/* Background decoration */}
    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 pointer-events-none">
      <Icon size={120} />
    </div>
    
    {/* Glow on hover */}
    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-[2rem] pointer-events-none" />
    
    <div className="relative z-10 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] opacity-80">{label}</p>
        <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
          <Icon size={16} className="text-white" />
        </div>
      </div>
      
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight truncate mt-auto">
        {value}
      </h2>
      
      {subValue && (
        <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider backdrop-blur-sm border border-white/20 w-fit
          ${isPositive ? 'bg-emerald-400/20 text-emerald-100' : 'bg-rose-400/20 text-rose-100'}`}>
          {isPositive ? <HiOutlineArrowUp size={12} className="shrink-0"/> : <HiOutlineArrowDown size={12} className="shrink-0"/>}
          <span className="truncate">{subValue}</span>
        </div>
      )}
    </div>
  </div>
);

const ChartCard = ({ title, icon: Icon, subtitle, children, isEmpty }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-5 sm:p-7 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col min-w-0 h-full">
    {/* Card header */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 shrink-0">
      <div>
        <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10">
            <Icon size={16} className="text-blue-500 dark:text-blue-400" />
          </div>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 ml-9">{subtitle}</p>
        )}
      </div>
    </div>
    
    {/* Chart area */}
    <div className="flex-1 w-full min-h-[250px] sm:min-h-[300px] relative">
      {isEmpty ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30">
          <FaChartBar size={40} className="mb-3 opacity-30" />
          <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500">Insufficient data</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Add transactions to see trends</p>
        </div>
      ) : children}
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label, currencySymbol }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xl text-white p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-2xl z-50">
        <p className="font-black text-[10px] sm:text-xs mb-3 text-slate-400 uppercase tracking-widest border-b border-slate-700/50 pb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-6 py-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shadow-md" style={{ backgroundColor: entry.color }} />
              <span className="text-[10px] sm:text-xs font-bold text-slate-300">{entry.name}</span>
            </div>
            <span className="text-[10px] sm:text-xs font-black tracking-tight" style={{ color: entry.color }}>
              {currencySymbol}{entry.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const LegendList = ({ data, colors }) => (
  <div className="grid grid-cols-2 gap-2 mt-6 p-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
    {data.map((item, idx) => (
      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: colors[idx % colors.length] }} />
          <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{item.name}</span>
        </div>
        <span className="text-[10px] sm:text-xs font-black text-slate-900 dark:text-white shrink-0 sm:ml-auto">
          {item.value?.toLocaleString ? item.value.toLocaleString(undefined, {maximumFractionDigits: 0}) : item.value}
        </span>
      </div>
    ))}
  </div>
);

const Skeleton = () => (
  <div className="pt-20 sm:pt-24 space-y-6 sm:space-y-8 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      <div className="space-y-2">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {[1,2,3].map(i => <div key={i} className="h-36 sm:h-40 bg-slate-200 dark:bg-slate-800 rounded-[2rem]" />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
      <div className="lg:col-span-2 h-[400px] bg-slate-200 dark:bg-slate-800 rounded-[2.5rem]" />
      <div className="h-[400px] bg-slate-200 dark:bg-slate-800 rounded-[2.5rem]" />
    </div>
  </div>
);

// ============================================
// 🚀 MAIN COMPONENT
// ============================================

const Analytics = () => {
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [isLoading, setIsLoading] = useState(true);
  
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({ bank: 0, cash: 0, online: 0 });
  const [cryptoTransactions, setCryptoTransactions] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  const [customUserCoins, setCustomUserCoins] = useState([]);

  // 🚀 Real-time data fetching (Double Entry Sync)
  useEffect(() => {
    if (!user) return;

    let loadedStatus = { inc: false, exp: false, bnk: false, csh: false, onl: false, cry: false };
    const checkLoading = () => {
      if (Object.values(loadedStatus).every(Boolean)) setIsLoading(false);
    };

    const unsubInc = onSnapshot(collection(db, "users", user.uid, "incomeLogs"), snap => {
      setIncomes(snap.docs.map(d => d.data()));
      loadedStatus.inc = true; checkLoading();
    });

    const unsubExp = onSnapshot(collection(db, "users", user.uid, "expenseLogs"), snap => {
      setExpenses(snap.docs.map(d => d.data()));
      loadedStatus.exp = true; checkLoading();
    });

    const calcBal = (snap) => snap.docs.reduce((acc, doc) => {
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

    const unsubBank = onSnapshot(collection(db, "users", user.uid, "bankWallet"), snap => {
      setBalances(p => ({ ...p, bank: calcBal(snap) }));
      loadedStatus.bnk = true; checkLoading();
    });
    
    const unsubCash = onSnapshot(collection(db, "users", user.uid, "cashWallet"), snap => {
      setBalances(p => ({ ...p, cash: calcBal(snap) }));
      loadedStatus.csh = true; checkLoading();
    });
    
    const unsubOnline = onSnapshot(collection(db, "users", user.uid, "onlineWallet"), snap => {
      setBalances(p => ({ ...p, online: calcBal(snap) }));
      loadedStatus.onl = true; checkLoading();
    });

    const unsubCrypto = onSnapshot(collection(db, "users", user.uid, "cryptoWalletLogs"), snap => {
      setCryptoTransactions(snap.docs.map(d => d.data()));
      loadedStatus.cry = true; checkLoading();
    });

    const fetchUserData = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().customCoins) {
          setCustomUserCoins(userSnap.data().customCoins);
        }
      } catch (e) {}
    };
    fetchUserData();

    // Failsafe to hide loader
    const timeout = setTimeout(() => setIsLoading(false), 2000);

    return () => { unsubInc(); unsubExp(); unsubBank(); unsubCash(); unsubOnline(); unsubCrypto(); clearTimeout(timeout); };
  }, [user]);

  // 🚀 Crypto Holdings Calculation (Exact Quantities)
  const cryptoHoldings = useMemo(() => {
    const vault = {};
    cryptoTransactions.forEach(t => {
      if (!t.coin) return;
      const coinSym = t.coin.toUpperCase();
      if (!vault[coinSym]) vault[coinSym] = 0;
      const qty = parseFloat(t.quantity) || 0;
      const fee = parseFloat(t.networkFee) || 0;
      
      if (t.type === 'in') vault[coinSym] += qty;
      else if (t.type === 'out') vault[coinSym] -= qty;
      else if (t.type === 'transfer') vault[coinSym] -= fee;
    });
    
    Object.keys(vault).forEach(coin => {
      if (vault[coin] <= 0.000001) delete vault[coin];
    });
    return vault;
  }, [cryptoTransactions]);

  const cryptoSymbols = useMemo(() => 
    selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean), 
    [selectedCryptos]
  );

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    selectedCryptos.forEach(c => {
      if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c);
    });
    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  // 🚀 Live price fetching (Convert Crypto Quantities to FIAT Value)
  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        let userBaseRate = 1;
        if (fiatRes && fiatRes.ok) userBaseRate = (await fiatRes.json()).rates[baseCurrency] || 1;
        setFiatRate(userBaseRate);

        const coinsToFetch = Array.from(new Set([...Object.keys(cryptoHoldings), ...cryptoSymbols])).filter(Boolean);
        if (coinsToFetch.length === 0) return;

        let cgJson = {};
        let geckoTerminalData = {};
        const normalCoins = [];
        const contractCoins = [];

        coinsToFetch.forEach(sym => {
          const dbCoin = fullDatabase.find(c => c.symbol === sym.toUpperCase());
          if (dbCoin?.fetchMode === 'contract' && dbCoin.network && dbCoin.contractAddress) {
            contractCoins.push(dbCoin);
          } else {
            normalCoins.push(dbCoin?.id || sym.toLowerCase());
          }
        });

        if (normalCoins.length > 0) {
          try {
            const ids = [...new Set(normalCoins)].join(',');
            const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
            if (cgRes.ok) cgJson = await cgRes.json();
          } catch(e) {}
        }

        for (const customCoin of contractCoins) {
          try {
            const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${customCoin.network}/tokens/${customCoin.contractAddress}`);
            if (gtRes.ok) {
              const gtJson = await gtRes.json();
              geckoTerminalData[customCoin.id] = { usd: parseFloat(gtJson.data.attributes.price_usd) };
            }
          } catch (error) {}
        }

        const priceMap = {};
        
        await Promise.all(coinsToFetch.map(async (sym) => {
          const upperSym = sym.toUpperCase();
          const dbCoin = fullDatabase.find(c => c.symbol === upperSym) || {};
          const searchId = dbCoin.id || sym.toLowerCase();
          
          let priceUsd = dbCoin.fetchMode === 'contract' ? geckoTerminalData[searchId]?.usd : cgJson[searchId]?.usd;

          if (!priceUsd) {
            try {
              const bSym = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
              const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${bSym}`);
              if (bRes.ok) priceUsd = searchId === 'tether' ? 1.00 : parseFloat((await bRes.json()).price);
            } catch(e) {}
          }

          if (!priceUsd && dbCoin.fallbackPrice) priceUsd = dbCoin.fallbackPrice;
          if(priceUsd) priceMap[upperSym] = priceUsd * userBaseRate;
        }));

        setLivePrices(priceMap);
      } catch (error) {}
    };
    
    if (!isLoading) {
      fetchLivePrices();
      const interval = setInterval(fetchLivePrices, 120000); 
      return () => clearInterval(interval);
    }
  }, [isLoading, cryptoHoldings, cryptoSymbols, baseCurrency, fullDatabase]);

  const totalCryptoLiveValue = useMemo(() => {
    return Object.entries(cryptoHoldings).reduce((total, [coin, qty]) => {
      const priceBase = livePrices[coin.toUpperCase()] || 0;
      return total + (qty * priceBase);
    }, 0);
  }, [cryptoHoldings, livePrices]);

  // 🚀 Metrics calculation (Double Entry Merging)
  const { metrics, cashFlowData, assetAllocation, expenseCategories } = useMemo(() => {
    let tIncome = 0;
    let tExpense = 0;
    const monthlyData = {};
    const expCatMap = {};

    incomes.forEach(data => {
      const amt = parseFloat(data.finalBaseAmount || data.amount) || 0;
      tIncome += amt;
      const dateObj = new Date(data.date || new Date());
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { sortKey, monthName, Income: 0, Expense: 0 };
      monthlyData[sortKey].Income += amt;
    });

    expenses.forEach(data => {
      const amt = parseFloat(data.finalBaseAmount || data.amount) || 0;
      tExpense += amt;
      const dateObj = new Date(data.date || new Date());
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { sortKey, monthName, Income: 0, Expense: 0 };
      monthlyData[sortKey].Expense += amt;

      const cat = data.category || 'Other';
      expCatMap[cat] = (expCatMap[cat] || 0) + amt;
    });

    const sortedCashFlow = Object.values(monthlyData)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-6)
      .map(item => ({ name: item.monthName, Income: Math.round(item.Income * 100) / 100, Expense: Math.round(item.Expense * 100) / 100 }));

    const realAssetAllocation = [
      { name: 'Bank Vault', value: Math.max(0, Math.round(balances.bank * 100) / 100) },
      { name: 'Physical Cash', value: Math.max(0, Math.round(balances.cash * 100) / 100) },
      { name: 'Digital Wallets', value: Math.max(0, Math.round(balances.online * 100) / 100) },
      { name: 'Crypto Portfolio', value: Math.max(0, Math.round(totalCryptoLiveValue * 100) / 100) }
    ].filter(asset => asset.value > 0);

    const expCategories = Object.entries(expCatMap)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      metrics: { totalIncome: tIncome, totalExpense: tExpense, netSavings: tIncome - tExpense },
      cashFlowData: sortedCashFlow,
      assetAllocation: realAssetAllocation,
      expenseCategories: expCategories
    };
  }, [incomes, expenses, balances, totalCryptoLiveValue, formatGlobalDate]);

  const savingsRate = metrics.totalIncome > 0 ? ((metrics.netSavings / metrics.totalIncome) * 100).toFixed(1) : 0;
  const expenseRatio = metrics.totalIncome > 0 ? ((metrics.totalExpense / metrics.totalIncome) * 100).toFixed(1) : 0;

  // ============================================
  // RENDER
  // ============================================
  if (isLoading) return <Skeleton />;

  return (
    <div className="pt-24 space-y-6 sm:space-y-8 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">
      
      {/* 🚀 HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl sm:rounded-[2rem] shadow-xl shadow-blue-500/30 ring-1 ring-blue-500/20">
            <HiOutlineChartPie size={26} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Analytics Center
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
              Real-time financial intelligence & wealth insights
            </p>
          </div>
        </div>
        
        {/* Quick stats */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
          <HiOutlineCalendar size={16} />
          {formatGlobalDate ? formatGlobalDate(new Date().toISOString(), 'full') : new Date().toLocaleDateString()}
        </div>
      </div>

      {/* 🚀 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <KPICard
          icon={HiOutlineTrendingUp}
          label="Lifetime Income"
          value={`${currencySymbol}${metrics.totalIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          isCurrency={true}
          subValue={`${savingsRate}% Saved Overall`}
          isPositive={true}
        />
        <KPICard
          icon={HiOutlineTrendingDown}
          label="Lifetime Expenses"
          value={`${currencySymbol}${metrics.totalExpense.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
          gradient="bg-gradient-to-br from-rose-500 to-rose-600"
          isCurrency={true}
          subValue={`${expenseRatio}% Burn Rate`}
          isPositive={false}
        />
        <KPICard
          icon={FaPiggyBank}
          label="Net Savings / Retained"
          value={`${currencySymbol}${metrics.netSavings.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
          gradient={`bg-gradient-to-br ${metrics.netSavings >= 0 ? 'from-blue-600 to-indigo-600' : 'from-red-600 to-rose-700'}`}
          isCurrency={true}
          subValue={metrics.netSavings >= 0 ? "Positive Cashflow" : "Negative Cashflow"}
          isPositive={metrics.netSavings >= 0}
        />
      </div>

      {/* 🚀 CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        
        {/* Cash Flow Bar Chart */}
        <div className="lg:col-span-2">
          <ChartCard 
            title="Cash Flow Analysis" 
            icon={FaChartBar}
            subtitle="Last 6-months income vs expenses trend"
            isEmpty={cashFlowData.length === 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.2} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  tickFormatter={(val) => `${currencySymbol}${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}`}
                />
                <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} cursor={{ fill: '#94a3b8', opacity: 0.05 }} />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '10px', fontWeight: 800, paddingTop: '15px' }}
                />
                <Bar 
                  dataKey="Income" 
                  fill="url(#incomeGradient)" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={40} 
                  animationDuration={1200}
                />
                <Bar 
                  dataKey="Expense" 
                  fill="url(#expenseGradient)" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={40} 
                  animationDuration={1200}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Asset Allocation Pie Chart */}
        <div>
          <ChartCard 
            title="Portfolio Allocation" 
            icon={FaChartPie}
            subtitle="Cross-vault wealth distribution"
            isEmpty={assetAllocation.length === 0}
          >
            <ResponsiveContainer width="100%" height="60%">
              <PieChart>
                <Pie
                  data={assetAllocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  animationDuration={1000}
                >
                  {assetAllocation.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      className="hover:opacity-80 transition-opacity cursor-pointer drop-shadow-md"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} />
              </PieChart>
            </ResponsiveContainer>
            
            <LegendList data={assetAllocation} colors={COLORS} />
          </ChartCard>
        </div>
      </div>

      {/* 🚀 EXPENSE BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {expenseCategories.length > 0 && (
          <ChartCard 
            title="Top Expense Categories" 
            icon={FaMoneyBillWave}
            subtitle="Where is your money going?"
            isEmpty={false}
          >
            <div className="space-y-4 sm:space-y-5 pt-2">
              {expenseCategories.map((cat, idx) => {
                const maxVal = expenseCategories[0]?.value || 1;
                const pct = (cat.value / maxVal) * 100;
                
                return (
                  <div key={idx} className="group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 truncate max-w-[60%]">
                        {cat.name}
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white shrink-0">
                        {currencySymbol}{cat.value.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ 
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${COLORS[idx % COLORS.length]}, ${COLORS[(idx + 1) % COLORS.length]})`
                        }}
                      >
                        <div className="h-full w-full bg-white/20 rounded-full animate-shimmer" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        )}
      </div>

      {/* 🚀 FOOTER */}
      <div className="text-center py-6 px-4 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm mt-8">
        <p className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 flex-wrap uppercase tracking-widest">
          <HiOutlineLightningBolt className="text-blue-500" size={16} />
          Real-time analytics powered by cross-vault transaction data
          <span className="text-blue-500 hidden sm:inline">•</span>
          Updates Automatically
        </p>
      </div>

    </div>
  );
};

export default Analytics;