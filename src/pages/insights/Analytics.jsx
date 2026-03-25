import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  HiOutlineChartPie, HiOutlineTrendingUp, HiOutlineTrendingDown, 
  HiOutlineCash, HiOutlineRefresh 
} from 'react-icons/hi';
import { FaWallet, FaPiggyBank } from 'react-icons/fa';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#f43f5e'];

const Analytics = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [isLoading, setIsLoading] = useState(true);
  
  // 🚀 Real-time State Arrays
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({ bank: 0, cash: 0, online: 0 });

  // Crypto specific tracking states
  const [cryptoTransactions, setCryptoTransactions] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  const [customUserCoins, setCustomUserCoins] = useState([]);

  // 🚀 1. SECURE REAL-TIME DATA FETCHER
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
      const d = doc.data();
      const amt = Number(d.finalBaseAmount || d.amount || 0);
      return acc + (d.type === 'in' ? amt : -amt);
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

    const unsubUser = onSnapshot(doc(db, "users", user.uid), snap => {
       if (snap.exists() && snap.data().customCoins) {
         setCustomUserCoins(snap.data().customCoins);
       }
    });

    return () => { unsubInc(); unsubExp(); unsubBank(); unsubCash(); unsubOnline(); unsubCrypto(); unsubUser(); };
  }, [user]);

  // 🚀 LIVE CRYPTO VALUATION ENGINE
  const cryptoHoldings = useMemo(() => {
    const vault = {};
    cryptoTransactions.forEach(t => {
      if (!vault[t.coin]) vault[t.coin] = 0;
      const qty = parseFloat(t.quantity) || 0;
      const fee = parseFloat(t.networkFee) || 0;
      
      if (t.type === 'in') vault[t.coin] += qty;
      else if (t.type === 'out') vault[t.coin] -= qty;
      else if (t.type === 'transfer') vault[t.coin] -= fee;
    });
    
    // Clean dust
    Object.keys(vault).forEach(coin => {
      if (vault[coin] <= 0.000001) delete vault[coin];
    });
    return vault;
  }, [cryptoTransactions]);

  const cryptoSymbols = useMemo(() => selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean), [selectedCryptos]);

  // Merge Context Selected Cryptos + Custom Coins
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

  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const fiatData = await fiatRes.json();
        const userBaseRate = fiatData.rates[baseCurrency] || 1;
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

        // 1. Fetch Normal Coins (CoinGecko)
        if (normalCoins.length > 0) {
           try {
             const ids = [...new Set(normalCoins)].join(',');
             const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
             if (cgRes.ok) {
                 cgJson = await cgRes.json();
             }
           } catch(e) { console.warn("CoinGecko API Limit Reached"); }
        }

        // 2. Fetch Custom Contract Coins (GeckoTerminal)
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
          
          let priceUsd = null;

          if (dbCoin.fetchMode === 'contract') {
              priceUsd = geckoTerminalData[searchId]?.usd;
          } else {
              priceUsd = cgJson[searchId]?.usd;
          }

          // Binance Fallback
          if (!priceUsd) {
            try {
              const bSym = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
              const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${bSym}`);
              if (bRes.ok) {
                 const bData = await bRes.json();
                 priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
              }
            } catch(e) {}
          }

          if (!priceUsd && dbCoin.fallbackPrice) {
              priceUsd = dbCoin.fallbackPrice;
          }
          
          if(priceUsd) {
             priceMap[upperSym] = priceUsd * userBaseRate;
          }
        }));

        setLivePrices(priceMap);
      } catch (error) {}
    };
    if (!isLoading) {
       fetchLivePrices();
       const interval = setInterval(fetchLivePrices, 120000); // 2 Min Refresh for Analytics
       return () => clearInterval(interval);
    }
  }, [isLoading, cryptoHoldings, cryptoSymbols, baseCurrency, fullDatabase]);

  const totalCryptoLiveValue = useMemo(() => {
    return Object.entries(cryptoHoldings).reduce((total, [coin, qty]) => {
      const priceBase = livePrices[coin.toUpperCase()] || 0;
      return total + (qty * priceBase);
    }, 0);
  }, [cryptoHoldings, livePrices]);

  // 🚀 2. DYNAMIC METRICS CALCULATOR
  const { metrics, cashFlowData, assetAllocation } = useMemo(() => {
    let tIncome = 0;
    let tExpense = 0;
    const monthlyData = {};

    // Process Incomes
    incomes.forEach(data => {
      const amt = parseFloat(data.finalBaseAmount || data.amount) || 0;
      tIncome += amt;
      const dateObj = new Date(data.date || new Date());
      // 🚀 Global Format for Chart Labels
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { sortKey, monthName, Income: 0, Expense: 0 };
      monthlyData[sortKey].Income += amt;
    });

    // Process Expenses
    expenses.forEach(data => {
      const amt = parseFloat(data.finalBaseAmount || data.amount) || 0;
      tExpense += amt;
      const dateObj = new Date(data.date || new Date());
      // 🚀 Global Format for Chart Labels
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { sortKey, monthName, Income: 0, Expense: 0 };
      monthlyData[sortKey].Expense += amt;
    });

    // Sort Chronologically & Format
    const sortedCashFlow = Object.values(monthlyData)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-6) // Last 6 active months
      .map(item => ({
        name: item.monthName,
        Income: item.Income,
        Expense: item.Expense
      }));

    // Generate REAL Asset Allocation
    const realAssetAllocation = [
      { name: 'Bank Ledger', value: Math.max(0, balances.bank) },
      { name: 'Physical Cash', value: Math.max(0, balances.cash) },
      { name: 'E-Wallets', value: Math.max(0, balances.online) },
      { name: 'Crypto Holdings', value: Math.max(0, totalCryptoLiveValue) }
    ].filter(asset => asset.value > 0);

    return {
      metrics: { totalIncome: tIncome, totalExpense: tExpense, netSavings: tIncome - tExpense },
      cashFlowData: sortedCashFlow,
      assetAllocation: realAssetAllocation
    };
  }, [incomes, expenses, balances, totalCryptoLiveValue, formatGlobalDate]);

  const savingsRate = metrics.totalIncome > 0 ? ((metrics.netSavings / metrics.totalIncome) * 100).toFixed(1) : 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-xl border border-slate-700 shadow-2xl">
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

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* 🚀 HEADER */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3.5 bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-2xl ring-1 ring-blue-500/20 shadow-sm">
          <HiOutlineChartPie size={26} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Financial Intelligence</h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Deep real-time insights into your cash flow and net worth.</p>
        </div>
      </div>

      {/* 📊 KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group transition-all hover:-translate-y-1">
          <HiOutlineTrendingUp className="absolute right-[-5%] bottom-[-10%] text-9xl opacity-10 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Total Life-Time Income</p>
          <h2 className="text-4xl font-black tracking-tight">{currencySymbol}{metrics.totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-6 rounded-[2rem] text-white shadow-xl shadow-rose-500/20 relative overflow-hidden group transition-all hover:-translate-y-1">
          <HiOutlineTrendingDown className="absolute right-[-5%] bottom-[-10%] text-9xl opacity-10 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Total Life-Time Expenses</p>
          <h2 className="text-4xl font-black tracking-tight">{currencySymbol}{metrics.totalExpense.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2rem] text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group transition-all hover:-translate-y-1">
          <FaPiggyBank className="absolute right-[-5%] bottom-[-10%] text-9xl opacity-10 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Net Cash Savings</p>
          <div className="flex items-end gap-3">
             <h2 className="text-4xl font-black tracking-tight">{currencySymbol}{metrics.netSavings.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          </div>
          <span className="inline-block mt-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-sm">{savingsRate}% Rate</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 📈 CASH FLOW CHART (BAR) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 md:p-8 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
             <HiOutlineCash className="text-emerald-500" size={20}/> 6-Month Cash Flow Trend
          </h3>
          <div className="h-[300px] w-full">
            {cashFlowData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                <HiOutlineChartPie size={40} className="mb-2 opacity-50"/>
                <p>Not enough data to map trends.</p>
              </div>
            )}
          </div>
        </div>

        {/* 🍕 ASSET ALLOCATION (PIE) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-2 flex items-center gap-2">
             <FaWallet className="text-blue-500" size={16}/> Live Asset Allocation
          </h3>
          <p className="text-xs text-slate-500 font-semibold mb-4">Calculated from Vault Balances</p>
          
          {assetAllocation.length > 0 ? (
            <>
              <div className="flex-1 min-h-[250px] relative">
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
              <div className="mt-4 space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                {assetAllocation.map((item, idx) => (
                   <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight">
                        {currencySymbol}{(item.value || 0).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                      </span>
                   </div>
                ))}
              </div>
            </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl mt-4">
               <FaPiggyBank size={40} className="mb-2 opacity-50"/>
               <p className="text-xs">Vaults are currently empty.</p>
             </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Analytics;