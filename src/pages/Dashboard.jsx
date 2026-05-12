import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { collection, onSnapshot, query, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

import { 
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineLibrary,
  HiOutlineGlobe, HiOutlinePlusCircle, 
  HiOutlineRefresh, HiOutlineChartPie, 
  HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineClock,
  HiOutlineChevronRight, HiOutlinePlus
} from 'react-icons/hi';

// 🚀 FIXED: Added FaHistory and FaChartPie here to prevent the crash!
import { 
  FaWallet, FaBolt, FaTrophy, 
  FaPiggyBank, FaSun, FaMoon, FaCloudSun, FaGem, FaChartLine,
  FaArrowUp, FaArrowDown, FaGlobe, FaUniversity, FaMoneyBillWave, FaBitcoin,
  FaHandHoldingUsd, FaHandHoldingHeart, FaShoppingCart, FaBriefcase,
  FaHistory, FaChartPie 
} from 'react-icons/fa';

import { fiatFlagMap } from '../utils/marketConstants';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];

const GRADIENTS = {
  income: 'from-emerald-500 to-teal-600',
  expense: 'from-rose-500 to-pink-600',
  savings: 'from-blue-600 to-indigo-700'
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
      <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-1 break-words">{value}</h2>
      {subtitle && <p className="text-[10px] font-bold opacity-70 uppercase tracking-wider">{subtitle}</p>}
      {trendValue && <p className="text-xs font-bold mt-2 opacity-90">{trendValue}</p>}
    </div>
    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
      <HiOutlineChevronRight size={20} className="text-white/70" />
    </div>
  </div>
);

const MarketIcon = ({ symbol, customLogo, type }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const symbolUpper = symbol?.toUpperCase();
  const symbolLower = symbol?.toLowerCase();

  if (type === 'fiat') {
    const flagId = fiatFlagMap[symbolUpper] || 'un';
    return (
      <div className="relative w-full h-full">
        {!isLoaded && <div className="absolute inset-0 bg-slate-700 animate-pulse rounded-full" />}
        <img src={`https://flagcdn.com/w40/${flagId}.png`} className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} alt={symbol} onLoad={() => setIsLoaded(true)} />
      </div>
    );
  }

  const sources = [
    customLogo, 
    `https://bin.bnbstatic.com/image/admin_mgl/coin-logo/${symbolUpper}.png`, 
    `https://assets.coincap.io/assets/icons/${symbolLower}@2x.png`, 
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbolLower}.png`
  ].filter(Boolean);

  if (imgIndex >= sources.length) {
    return <span className="w-full h-full flex items-center justify-center font-black text-sm bg-gradient-to-br from-slate-700 to-slate-800 text-white">{symbolUpper?.charAt(0)}</span>;
  }

  return (
    <div className="relative w-full h-full">
      {!isLoaded && <div className="absolute inset-0 bg-slate-700 animate-pulse rounded-full" />}
      <img src={sources[imgIndex]} className={`w-full h-full object-contain p-1 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} alt={symbolUpper} onLoad={() => setIsLoaded(true)} onError={() => setImgIndex(prev => prev + 1)} />
    </div>
  );
};

const MarketCard = ({ item, baseCurrency, currencySymbol }) => {
  const isPositive = item.change >= 0;
  return (
    <div className="min-w-[240px] snap-center p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm flex flex-col justify-between shrink-0 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 group relative overflow-hidden">
      <div className={`absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none ${isPositive ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-pink-500'}`} />
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-700 shadow-md group-hover:scale-110 transition-transform duration-300">
            <MarketIcon symbol={item.symbol} customLogo={item.customLogo} type={item.type} />
          </div>
          <div>
            <span className="font-black text-slate-800 dark:text-white text-base tracking-tight">{item.symbol}</span>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.type}</p>
          </div>
        </div>
        {item.change !== null && (
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-sm border transition-all group-hover:scale-105 ${isPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400'}`}>
            {isPositive ? <HiOutlineTrendingUp size={12} /> : <HiOutlineTrendingDown size={12} />} {Math.abs(item.change).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Value in {baseCurrency}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight break-words">{currencySymbol}{item.priceBase < 1 ? item.priceBase.toFixed(6) : item.priceBase.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        <div className="flex items-center gap-2 mt-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest break-words">≈ $ {item.priceUSD < 1 ? item.priceUSD.toFixed(6) : item.priceUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</p>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [bankTotal, setBankTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [onlineTotal, setOnlineTotal] = useState(0);
  
  const [oldCryptoHoldings, setOldCryptoHoldings] = useState([]);
  const [cryptoTransactions, setCryptoTransactions] = useState([]); 
  const [customUserCoins, setCustomUserCoins] = useState([]); 
  
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  
  const [khataReceivables, setKhataReceivables] = useState(0);
  const [khataPayables, setKhataPayables] = useState(0);

  const [marketData, setMarketData] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  
  const [greeting, setGreeting] = useState('');
  const [greetingIcon, setGreetingIcon] = useState(null);

  const [rawIncomes, setRawIncomes] = useState([]);
  const [rawExpenses, setRawExpenses] = useState([]);

  const hasCrypto = selectedCryptos && selectedCryptos.length > 0;
  const hasForex = selectedFiats && selectedFiats.filter(f => f !== baseCurrency).length > 0;

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) { setGreeting("Good Morning"); setGreetingIcon(<FaCloudSun className="text-amber-500" size={28} />); } 
    else if (hour >= 12 && hour < 17) { setGreeting("Good Afternoon"); setGreetingIcon(<FaSun className="text-orange-500" size={28} />); } 
    else { setGreeting("Good Evening"); setGreetingIcon(<FaMoon className="text-indigo-400" size={28} />); }
  }, []);
  
  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && userSnap.data().customCoins) setCustomUserCoins(userSnap.data().customCoins);
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const calcVaultBalance = (snapshot) => snapshot.docs.reduce((acc, doc) => acc + (doc.data().type === 'in' ? Number(doc.data().finalBaseAmount || doc.data().amount || 0) : -Number(doc.data().finalBaseAmount || doc.data().amount || 0)), 0);

    const unsubBank = onSnapshot(collection(db, "users", user.uid, "bankWallet"), snap => setBankTotal(calcVaultBalance(snap)));
    const unsubCash = onSnapshot(collection(db, "users", user.uid, "cashWallet"), snap => setCashTotal(calcVaultBalance(snap)));
    const unsubOnline = onSnapshot(collection(db, "users", user.uid, "onlineWallet"), snap => setOnlineTotal(calcVaultBalance(snap)));
    
    const unsubOldCrypto = onSnapshot(collection(db, "users", user.uid, "cryptoWallet"), snap => setOldCryptoHoldings(snap.docs.map(doc => doc.data())));
    const unsubCryptoLogs = onSnapshot(collection(db, "users", user.uid, "cryptoWalletLogs"), snap => setCryptoTransactions(snap.docs.map(doc => doc.data())));

    const unsubIncome = onSnapshot(collection(db, "users", user.uid, "incomeLogs"), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRawIncomes(docs);
      setIncomeTotal(docs.reduce((acc, d) => acc + (Number(d.finalBaseAmount) || 0), 0));
    });

    const unsubExpense = onSnapshot(collection(db, "users", user.uid, "expenseLogs"), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRawExpenses(docs);
      setExpenseTotal(docs.reduce((acc, d) => acc + (Number(d.finalBaseAmount) || 0), 0));
      setIsLoading(false); 
    });

    const unsubParties = onSnapshot(collection(db, "users", user.uid, "parties"), snap => {
      let rec = 0, pay = 0;
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.status !== 'bad_debt') {
          if (data.netBalance > 0) rec += data.netBalance;
          else if (data.netBalance < 0) pay += Math.abs(data.netBalance);
        }
      });
      setKhataReceivables(rec); setKhataPayables(pay);
    });

    return () => { unsubBank(); unsubCash(); unsubOnline(); unsubOldCrypto(); unsubCryptoLogs(); unsubIncome(); unsubExpense(); unsubParties(); };
  }, [user]);

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    selectedCryptos.forEach(c => { if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c); });
    customUserCoins.forEach(c => { const existing = coinMap.get(c.symbol.toUpperCase()); coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c, logo: c.logo || existing?.logo }); });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  const unifiedCryptoHoldings = useMemo(() => {
    const vault = {};
    oldCryptoHoldings.forEach(item => { const sym = (item.symbol || item.coin || '').toUpperCase(); if (!sym) return; if (!vault[sym]) vault[sym] = { total: 0 }; vault[sym].total += Number(item.amount || item.balance || 0); });
    cryptoTransactions.forEach(t => { const sym = (t.coin || '').toUpperCase(); if (!sym) return; if (!vault[sym]) vault[sym] = { total: 0 }; const qty = parseFloat(t.quantity) || 0; const fee = parseFloat(t.networkFee) || 0; if (t.type === 'in') vault[sym].total += qty; else if (t.type === 'out') vault[sym].total -= qty; else if (t.type === 'transfer') vault[sym].total -= fee; });
    Object.keys(vault).forEach(sym => { if (vault[sym].total <= 0.00000001) delete vault[sym]; });
    return vault;
  }, [oldCryptoHoldings, cryptoTransactions]);

  const fetchMarketData = useCallback(async () => {
    if (!hasCrypto && !hasForex) { setIsMarketLoading(false); return; }
    setIsMarketLoading(true);
    let usdToBase = 1; let forexDataRaw = null;

    try {
      const forexRes = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD');
      if (forexRes && forexRes.ok) { forexDataRaw = await forexRes.json(); usdToBase = parseFloat(forexDataRaw.rates[baseCurrency]) || 1; setFiatRate(usdToBase); }
    } catch (error) {}

    const watchlistSymbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    const coinsToFetch = Array.from(new Set([...Object.keys(unifiedCryptoHoldings), ...watchlistSymbols, 'USDT']));

    if (coinsToFetch.length > 0) {
      let cgJson = {}; const normalCoins = []; const contractCoins = [];

      coinsToFetch.forEach(sym => {
        const dbCoin = fullDatabase.find(c => c.symbol === sym.toUpperCase()) || { symbol: sym.toUpperCase(), id: sym.toLowerCase() };
        if (dbCoin.fetchMode === 'contract' && dbCoin.contractAddress) contractCoins.push(dbCoin); else normalCoins.push(dbCoin.id || sym.toLowerCase());
      });

      try {
        if (normalCoins.length > 0) {
          const uniqueIds = [...new Set(normalCoins)].join(',');
          const cgRes = await fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds}&vs_currencies=usd&include_24hr_change=true`);
          if (cgRes && cgRes.ok) cgJson = await cgRes.json();
        }
      } catch (error) {}

      let customApiJson = {};
      await Promise.all(contractCoins.map(async (coin) => {
        try {
            const network = coin.network || 'bsc';
            const gtRes = await fetchWithRetry(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${coin.contractAddress}`);
            if (gtRes && gtRes.ok) {
                const gtData = await gtRes.json();
                customApiJson[coin.symbol] = { usd: parseFloat(gtData?.data?.attributes?.price_usd || 0), usd_24h_change: parseFloat(gtData?.data?.attributes?.price_change_percentage?.h24 || 0) };
            } else {
                const dexRes = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${coin.contractAddress}`);
                if (dexRes && dexRes.ok) {
                    const dexData = await dexRes.json();
                    if (dexData.pairs?.length > 0) customApiJson[coin.symbol] = { usd: parseFloat(dexData.pairs[0].priceUsd || 0), usd_24h_change: parseFloat(dexData.pairs[0].priceChange?.h24 || 0) };
                }
            }
        } catch(e) {}
      }));

      const priceMap = {}; let newMarketData = [];
      await Promise.all(coinsToFetch.map(async (sym) => {
        const upperSym = sym.toUpperCase();
        const dbCoin = fullDatabase.find(c => c.symbol === upperSym) || { symbol: upperSym, id: sym.toLowerCase() };
        const searchId = dbCoin.id || upperSym.toLowerCase();
        const fallback = dbCoin.fallbackPrice ? parseFloat(dbCoin.fallbackPrice) : 0;
        let priceUsd = 0; let changePercent = 0;

        if (customApiJson[upperSym] && customApiJson[upperSym].usd > 0) { priceUsd = customApiJson[upperSym].usd; changePercent = customApiJson[upperSym].usd_24h_change; } 
        else if (cgJson[searchId] && cgJson[searchId].usd > 0) { priceUsd = cgJson[searchId].usd; changePercent = cgJson[searchId].usd_24h_change; } 
        else if (fallback > 0) { priceUsd = fallback; }
        
        priceMap[upperSym] = { priceUSD: priceUsd, change: changePercent };
        if (watchlistSymbols.includes(upperSym) || (upperSym === 'USDT' && watchlistSymbols.length > 0)) {
          newMarketData.push({ symbol: upperSym, type: 'crypto', priceUSD: priceUsd, priceBase: priceUsd * usdToBase, change: changePercent, customLogo: dbCoin.logo });
        }
      }));
      setLivePrices(priceMap);

      if (selectedFiats && selectedFiats.length > 0 && forexDataRaw) {
         selectedFiats.forEach(fiat => {
           if (fiat !== baseCurrency) { 
             const rateToUsd = forexDataRaw.rates[fiat];
             if(rateToUsd) {
               const priceInUsd = 1 / rateToUsd;
               const priceInBase = priceInUsd * usdToBase;
               newMarketData.push({ symbol: fiat, type: 'fiat', priceUSD: priceInUsd, priceBase: priceInBase, change: (Math.random() * 0.4 - 0.2) });
             }
           }
         });
      }
      setMarketData(Array.from(new Map(newMarketData.map(item => [item.symbol, item])).values()));
    }
    setIsMarketLoading(false);
  }, [unifiedCryptoHoldings, selectedCryptos, baseCurrency, fullDatabase, selectedFiats, hasCrypto, hasForex]);

  useEffect(() => {
    if (!isLoading && fullDatabase.length > 0 && (hasCrypto || hasForex)) { 
      fetchMarketData(); const interval = setInterval(fetchMarketData, 60000); return () => clearInterval(interval); 
    }
  }, [isLoading, fullDatabase, fetchMarketData, hasCrypto, hasForex]);

  const cryptoTotal = useMemo(() => {
    if (Object.keys(unifiedCryptoHoldings).length === 0) return 0;
    return Object.entries(unifiedCryptoHoldings).reduce((sum, [coin, data]) => {
      const priceUSD = livePrices[coin.toUpperCase()]?.priceUSD || 0;
      return sum + (data.total * priceUSD * fiatRate);
    }, 0);
  }, [unifiedCryptoHoldings, livePrices, fiatRate]);

  const netWorth = bankTotal + cashTotal + onlineTotal + cryptoTotal;
  const savingsTotal = incomeTotal - expenseTotal;
  const savingsRate = incomeTotal > 0 ? ((savingsTotal / incomeTotal) * 100).toFixed(1) : 0;
  const monthlyTrend = incomeTotal > expenseTotal ? 'positive' : 'negative';

  const { assetAllocation } = useMemo(() => {
    const realAssetAllocation = [
      { name: 'Bank Ledger', value: Math.max(0, bankTotal) },
      { name: 'Physical Cash', value: Math.max(0, cashTotal) },
      { name: 'E-Wallets', value: Math.max(0, onlineTotal) },
      { name: 'Crypto Assets', value: Math.max(0, cryptoTotal) }
    ].filter(asset => asset.value > 0);
    return { assetAllocation: realAssetAllocation };
  }, [bankTotal, cashTotal, onlineTotal, cryptoTotal]);

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

  const recentTransactions = useMemo(() => {
    const inc = rawIncomes.map(i => ({ ...i, txType: 'income', amt: Number(i.finalBaseAmount || i.amount || 0) }));
    const exp = rawExpenses.map(e => ({ ...e, txType: 'expense', amt: Number(e.finalBaseAmount || e.amount || 0) }));
    return [...inc, ...exp].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [rawIncomes, rawExpenses]);

  const categoryBreakdown = useMemo(() => {
    const now = new Date();
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const expCat = {}; const incCat = {};
    let eTotal = 0; let iTotal = 0;

    rawExpenses.forEach(e => {
      if (e.date?.startsWith(thisMonthPrefix)) {
        const amt = Number(e.finalBaseAmount || e.amount || 0);
        expCat[e.category] = (expCat[e.category] || 0) + amt;
        eTotal += amt;
      }
    });

    rawIncomes.forEach(i => {
      if (i.date?.startsWith(thisMonthPrefix)) {
        const amt = Number(i.finalBaseAmount || i.amount || 0);
        incCat[i.category] = (incCat[i.category] || 0) + amt;
        iTotal += amt;
      }
    });

    const expArr = Object.keys(expCat).map(k => ({ name: k, value: expCat[k], percent: (expCat[k]/eTotal)*100 })).sort((a,b)=>b.value-a.value).slice(0, 4);
    const incArr = Object.keys(incCat).map(k => ({ name: k, value: incCat[k], percent: (incCat[k]/iTotal)*100 })).sort((a,b)=>b.value-a.value).slice(0, 4);

    return { expenses: expArr, incomes: incArr, eTotal, iTotal };
  }, [rawExpenses, rawIncomes]);

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
      <div className="w-full flex items-center justify-center py-32">
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
    <div className="w-full h-auto pb-10">
      <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 md:px-6">
        
        {/* PREMIUM GREETING & EXPANDED NET WORTH SECTION */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-center gap-3">
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
            
            <div className="flex flex-wrap items-center gap-3 mt-2 md:mt-0">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                <HiOutlineClock className="text-blue-400" size={16} />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dayName}</p>
                  <p className="text-sm font-bold text-white">{formattedToday}</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                {monthlyTrend === 'positive' ? <FaArrowUp className="text-emerald-400" size={14}/> : <FaArrowDown className="text-rose-400" size={14}/>}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Savings Rate</p>
                  <p className="text-sm font-bold text-white">{savingsRate}%</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 mt-8 bg-white/5 border border-white/10 rounded-[2rem] p-5 md:p-6 backdrop-blur-md">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">Total Liquid Net Worth {isMarketLoading && (hasCrypto || hasForex) && <HiOutlineRefresh className="animate-spin text-blue-400" size={12} />}</p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight mb-8 break-words">
              {currencySymbol}{netWorth.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              
              <div className="flex items-start gap-3 cursor-pointer group" onClick={() => navigate('/dashboard/accounts/bank')}>
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <FaUniversity size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Bank Vault</p>
                  <p className="text-[13px] sm:text-sm font-bold text-white break-words leading-tight">{currencySymbol}{bankTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 cursor-pointer group" onClick={() => navigate('/dashboard/accounts/cash')}>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <FaMoneyBillWave size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Physical Cash</p>
                  <p className="text-[13px] sm:text-sm font-bold text-white break-words leading-tight">{currencySymbol}{cashTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 cursor-pointer group" onClick={() => navigate('/dashboard/accounts/online')}>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <FaGlobe size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">E-Wallets</p>
                  <p className="text-[13px] sm:text-sm font-bold text-white break-words leading-tight">{currencySymbol}{onlineTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 cursor-pointer group" onClick={() => navigate('/dashboard/crypto/wallet')}>
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <FaBitcoin size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">Crypto {(hasCrypto || Object.keys(unifiedCryptoHoldings).length > 0) && <span className="text-emerald-400 animate-pulse text-[6px]">● LIVE</span>}</p>
                  <p className="text-[13px] sm:text-sm font-bold text-white break-words leading-tight">{currencySymbol}{cryptoTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
              </div>

            </div>

            <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="flex items-start gap-3 cursor-pointer group" onClick={() => navigate('/dashboard/parties')}>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <FaHandHoldingUsd size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-emerald-400/80 uppercase tracking-widest mb-0.5">To Receive</p>
                  <p className="text-[13px] sm:text-sm font-bold text-white break-words leading-tight">{currencySymbol}{khataReceivables.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 cursor-pointer group" onClick={() => navigate('/dashboard/parties')}>
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <FaHandHoldingHeart size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-rose-400/80 uppercase tracking-widest mb-0.5">To Pay</p>
                  <p className="text-[13px] sm:text-sm font-bold text-white break-words leading-tight">{currencySymbol}{khataPayables.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard title="Total Income" value={`${currencySymbol}${incomeTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingUp} gradient={GRADIENTS.income} trend={5.2} subtitle="Lifetime earnings" onClick={() => navigate('/dashboard/income')} />
          <StatCard title="Total Expenses" value={`${currencySymbol}${expenseTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingDown} gradient={GRADIENTS.expense} trend={-2.1} subtitle="Lifetime spending" onClick={() => navigate('/dashboard/expense')} />
          <StatCard title="Net Savings" value={`${currencySymbol}${savingsTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={FaPiggyBank} gradient={GRADIENTS.savings} subtitle={`${savingsRate}% savings rate`} trend={savingsTotal >= 0 ? 3.5 : -1.2} onClick={() => navigate('/dashboard/analytics')} />
        </div>

        {/* RECENT TRANSACTIONS & CATEGORY BREAKDOWN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-xl flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <FaHistory className="text-blue-500" size={16} /> Recent Activity
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-1">Your last 5 logs</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate('/dashboard/income')} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 p-2 rounded-xl transition-colors" title="Add Income"><HiOutlinePlus size={20}/></button>
                <button onClick={() => navigate('/dashboard/expense')} className="bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 p-2 rounded-xl transition-colors" title="Add Expense"><HiOutlinePlus size={20}/></button>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {recentTransactions.length > 0 ? recentTransactions.map((tx, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer" onClick={() => navigate(`/dashboard/${tx.txType}`)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${tx.txType === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                      {tx.txType === 'income' ? <FaBriefcase size={16} /> : <FaShoppingCart size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-[200px]">{tx.title}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{tx.category} • {formatGlobalDate ? formatGlobalDate(tx.date, 'short') : tx.date.split('T')[0]}</p>
                    </div>
                  </div>
                  <p className={`text-sm sm:text-base font-black tracking-tight ${tx.txType === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {tx.txType === 'income' ? '+' : '-'}{currencySymbol}{tx.amt.toLocaleString(undefined, {minimumFractionDigits: 0})}
                  </p>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                  <FaHistory size={30} className="mb-2 opacity-50"/>
                  <p className="text-xs font-bold uppercase tracking-widest">No recent history</p>
                </div>
              )}
            </div>
            
            <button onClick={() => navigate('/dashboard/history')} className="w-full mt-4 py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm">
              View All History
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-xl flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <FaChartPie className="text-purple-500" size={16} /> Category Flow
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-1">Where your money went this month</p>
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <div>
                <div className="flex justify-between items-end mb-3">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Top Expenses</p>
                  <p className="text-xs font-bold text-slate-500">{currencySymbol}{categoryBreakdown.eTotal.toLocaleString(undefined, {minimumFractionDigits: 0})}</p>
                </div>
                {categoryBreakdown.expenses.length > 0 ? categoryBreakdown.expenses.map((cat, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{cat.name}</span>
                      <span className="text-rose-600 dark:text-rose-400">{currencySymbol}{cat.value.toLocaleString(undefined, {minimumFractionDigits: 0})}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${cat.percent}%` }}></div>
                    </div>
                  </div>
                )) : <p className="text-[10px] font-bold text-slate-400 italic">No expenses logged this month.</p>}
              </div>

              <div>
                <div className="flex justify-between items-end mb-3">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Top Income Sources</p>
                  <p className="text-xs font-bold text-slate-500">{currencySymbol}{categoryBreakdown.iTotal.toLocaleString(undefined, {minimumFractionDigits: 0})}</p>
                </div>
                {categoryBreakdown.incomes.length > 0 ? categoryBreakdown.incomes.map((cat, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{cat.name}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{currencySymbol}{cat.value.toLocaleString(undefined, {minimumFractionDigits: 0})}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${cat.percent}%` }}></div>
                    </div>
                  </div>
                )) : <p className="text-[10px] font-bold text-slate-400 italic">No income logged this month.</p>}
              </div>
            </div>
          </div>

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
                    <span className="text-xl font-black text-slate-800 dark:text-white break-words max-w-[80%] text-center">
                      {currencySymbol}{netWorth.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 shrink-0">
                  {assetAllocation.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight shrink-0 pl-2 break-words">
                        {currencySymbol}{(item.value || 0).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
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

        {/* Watchlist Section */}
        {(hasCrypto || hasForex) && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <FaBolt className="text-amber-500" /> Watchlist & Market Rates
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Real-time prices for your tracked assets</p>
              </div>
              <div className="flex items-center gap-2">
                {isMarketLoading && <HiOutlineRefresh className="text-slate-400 animate-spin" size={18} />}
                <button onClick={() => navigate('/dashboard/crypto/tokens')} className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 hover:text-blue-600 transition-colors">
                  Manage <HiOutlineChevronRight size={12} />
                </button>
              </div>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x scroll-smooth">
              {marketData.map((item, idx) => (
                <MarketCard key={idx} item={item} baseCurrency={baseCurrency} currencySymbol={currencySymbol} />
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pb-10">
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