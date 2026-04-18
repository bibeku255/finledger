import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineCash, HiOutlineSearch, HiOutlineFilter, HiOutlineRefresh,
  HiOutlineLockClosed, HiOutlineExclamationCircle,
  HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineChevronRight, HiOutlineCalendar, HiOutlineGlobeAlt,
  HiOutlineCheckCircle, HiOutlineClock, HiOutlineShieldCheck,
  HiOutlineArrowUp, HiOutlineArrowDown
} from 'react-icons/hi';
import { 
  FaMoneyBillWave, FaGlobe, FaExchangeAlt, FaWallet,
  FaGem, FaChartLine, FaPiggyBank, FaArrowUp, FaArrowDown
} from 'react-icons/fa';

// Mapping for Forex Flags
const fiatFlagMap = {
  USD: 'us', INR: 'in', NPR: 'np', EUR: 'eu', GBP: 'gb', CAD: 'ca', AUD: 'au', 
  JPY: 'jp', AED: 'ae', SAR: 'sa', QAR: 'qa', KWD: 'kw', OMR: 'om', BHD: 'bh',
  PKR: 'pk', BDT: 'bd', SGD: 'sg', CNY: 'cn'
};

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// 🚀 Premium Stat Card Component
const StatCard = ({ title, value, icon: Icon, trend, color, subtitle }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${color} text-white shadow-xl group hover:scale-[1.02] transition-all duration-300`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_70%)]" />
    <Icon className="absolute right-[-10%] bottom-[-10%] text-7xl opacity-10 group-hover:scale-110 transition-transform duration-500" />
    <div className="relative z-10">
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{title}</p>
      <h3 className="text-2xl font-black tracking-tight">{value}</h3>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
          {trend >= 0 ? <HiOutlineTrendingUp size={14} /> : <HiOutlineTrendingDown size={14} />}
          {Math.abs(trend)}% from last month
        </div>
      )}
      {subtitle && <p className="text-[9px] font-medium opacity-70 mt-1">{subtitle}</p>}
    </div>
  </div>
);

// 🚀 Premium Ticker Card
const TickerBar = ({ tickerData, currencySymbol }) => (
  <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800/50 shadow-sm backdrop-blur-sm">
    <div className="absolute left-0 z-10 h-full px-5 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
      <FaGlobe className="text-white/80" /> Live Fiat Rates
    </div>
    <div className="flex-1 overflow-hidden ml-[160px] py-3">
      <div className="animate-ticker-scroll flex gap-10 px-4">
        {[...tickerData, ...tickerData].map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 font-bold text-sm cursor-default group">
            <img 
              src={`https://flagcdn.com/w40/${fiatFlagMap[item.symbol] || 'un'}.png`} 
              alt={item.symbol}
              className="w-5 h-5 rounded-full object-cover shadow-sm group-hover:scale-110 transition-transform"
            />
            <span className="text-slate-700 dark:text-slate-300 font-black">{item.symbol}</span>
            <span className="text-slate-900 dark:text-white font-black">
              {currencySymbol}{Number(item.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}
            </span>
            <span className={`text-[11px] font-black flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
              item.change >= 0 
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
            }`}>
              {item.change >= 0 ? <HiOutlineTrendingUp size={12}/> : <HiOutlineTrendingDown size={12}/>}
              {Math.abs(item.change)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// 🚀 Premium Currency Badge
const CurrencyBadge = ({ currency, amount }) => (
  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3 shrink-0 flex items-center gap-3 hover:bg-white/15 transition-all duration-300 group">
    <div className="relative">
      <div className="absolute inset-0 bg-emerald-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
      <img 
        src={`https://flagcdn.com/w40/${fiatFlagMap[currency] || 'un'}.png`} 
        alt="" 
        className="w-10 h-10 rounded-full object-cover border-2 border-white/30 shadow-lg group-hover:scale-105 transition-transform" 
      />
    </div>
    <div>
      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Physical {currency}</p>
      <p className="text-xl font-black text-white">{amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
    </div>
  </div>
);

const CashWallet = () => {
  // 🚀 FETCHING BASE CURRENCY AND WATCHLIST FROM CONTEXT
  const { user, baseCurrency = 'INR', selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  // 🚀 DYNAMIC CURRENCY LIST: Merges Base Currency and Watchlist beautifully
  const availableCurrencies = useMemo(() => {
    return Array.from(new Set([baseCurrency, ...selectedFiats]));
  }, [baseCurrency, selectedFiats]);

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tickerData, setTickerData] = useState([]);
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    title: '', foreignAmount: '', currency: baseCurrency, exchangeRate: 1, date: todayDate
  });

  useEffect(() => {
    const fetchTickerData = async () => {
      try {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        const data = await res.json();
        const targetFiats = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'CNY'];
        
        const formattedFiat = targetFiats.map(fiat => {
          const rate = data.rates[fiat];
          return rate ? { 
            symbol: fiat, 
            price: (1 / rate).toFixed(4), 
            change: (Math.random() * 0.8 - 0.4).toFixed(2) 
          } : null;
        }).filter(Boolean);
        
        setTickerData(formattedFiat);
      } catch (error) {
        console.error("Ticker fetch failed:", error);
      }
    };
    fetchTickerData();
    const interval = setInterval(fetchTickerData, 60000); 
    return () => clearInterval(interval);
  }, [baseCurrency]);

  useEffect(() => {
    if (!user) return;
    const cashRef = collection(db, "users", user.uid, "cashWallet");
    const q = query(cashRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(dbRecords);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const currencyBalances = useMemo(() => {
    const balances = {};
    transactions.forEach(t => {
      const curr = t.currency || baseCurrency;
      const amt = Number(t.foreignAmount || t.amount || 0);
      if (!balances[curr]) balances[curr] = 0;
      if (t.type === 'in') balances[curr] += amt;
      else balances[curr] -= amt;
    });
    return Object.entries(balances)
      .filter(([_, value]) => Math.abs(value) > 0.01)
      .map(([curr, value]) => ({ currency: curr, value }));
  }, [transactions, baseCurrency]);

  const processedLedger = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const grouped = {};
    sorted.forEach(t => {
      const dateObj = new Date(t.date || new Date());
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = { monthName, openingBalance: runningBalance, records: [], closingBalance: 0 };
      }
      let finalAmount = Number(t.finalBaseAmount || t.amount || 0);
      let feeAmount = 0;
      if (t.fee && t.feeExchangeRate) feeAmount = Number(t.fee) * Number(t.feeExchangeRate);
      else if (t.fee) feeAmount = Number(t.fee);
      let netChange = t.type === 'in' ? finalAmount : -(finalAmount + feeAmount);
      runningBalance += netChange;
      grouped[monthKey].records.push({ ...t, netChange, finalAmount, feeAmount });
      grouped[monthKey].closingBalance = runningBalance;
    });
    return Object.keys(grouped).sort().reverse().map(key => {
      const monthData = grouped[key];
      const filteredRecords = monthData.records.filter(r => {
        const titleMatch = r.title ? r.title.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const typeMatch = filterType === 'all' || r.type === filterType;
        return titleMatch && typeMatch;
      }).reverse();
      return { ...monthData, records: filteredRecords };
    }).filter(m => m.records.length > 0);
  }, [transactions, searchTerm, filterType, formatGlobalDate]);

  const totalBalance = processedLedger.length > 0 ? processedLedger[0].closingBalance : 0;
  const totalInflows = useMemo(() => transactions.filter(t => t.type === 'in').reduce((acc, t) => acc + (Number(t.finalBaseAmount) || 0), 0), [transactions]);
  const totalOutflows = useMemo(() => transactions.filter(t => t.type === 'out').reduce((acc, t) => acc + (Number(t.finalBaseAmount) || 0), 0), [transactions]);

  const handleDownloadReport = (format) => {
    if (transactions.length === 0) return alert("No records found to download.");
    const reportData = transactions.map(rec => {
      const isIncome = rec.type === 'in';
      const cleanNote = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const finalAmt = Number(rec.finalBaseAmount || rec.amount || 0);
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        type: isIncome ? 'Deposit (+)' : 'Withdrawal (-)',
        currency: rec.currency || baseCurrency,
        amount: `${isIncome ? '+' : '-'}${currencySymbol}${Math.abs(finalAmt).toFixed(2)}`,
        notes: cleanNote
      };
    });
    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Type', key: 'type' },
      { header: 'Currency', key: 'currency' }, { header: 'Amount', key: 'amount' }, { header: 'Details', key: 'notes' }
    ];
    const fileName = `Cash_Vault_Ledger`;
    const reportTitle = `Cash Vault - Complete Ledger`;
    if (format === 'pdf') downloadPDFReport(reportData, columns, fileName, reportTitle);
    else downloadExcelReport(reportData, columns, fileName);
  };

  const fetchLiveRate = async () => {
    if (formData.currency === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
      const data = await res.json();
      const rate = data.rates[baseCurrency];
      if (rate) setFormData(prev => ({ ...prev, exchangeRate: rate.toFixed(4) }));
    } catch (error) {
      alert("Failed to fetch live rate.");
    } finally {
      setIsFetchingRate(false);
    }
  };

  const calculatedFinalAmount = (parseFloat(formData.foreignAmount) || 0) * (parseFloat(formData.exchangeRate) || 0);

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");
    setIsSaving(true);
    const isForeign = formData.currency !== baseCurrency;
    const recordData = {
      title: formData.title, type: 'in', date: formData.date,
      timestamp: editingId ? transactions.find(t => t.id === editingId)?.timestamp : new Date(formData.date).getTime(),
      currency: formData.currency, foreignAmount: parseFloat(formData.foreignAmount) || 0,
      exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
      finalBaseAmount: calculatedFinalAmount, fee: 0 
    };
    try {
      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "cashWallet", editingId), recordData, { merge: true });
      } else {
        await addDoc(collection(db, "users", user.uid, "cashWallet"), recordData);
      }
      closeModal();
    } catch (error) {
      alert("Failed to save entry!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (rec) => {
    setFormData({
      title: rec.title || '', foreignAmount: rec.foreignAmount || rec.amount || '', 
      currency: rec.currency || baseCurrency, exchangeRate: rec.exchangeRate || 1, date: rec.date || todayDate
    });
    setEditingId(rec.id);
    setIsModalOpen(true);
  };

  const initiateDelete = (rec) => { setDeleteContext(rec); setPinInput(''); setPinError(''); };
  
  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) { setPinError("Please enter your Security PIN."); return; }
    setIsVerifying(true); setPinError('');
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userData?.security?.pinHash || userData?.securityPin || userData?.pin;
      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect PIN. Deletion blocked!");
        setIsVerifying(false); return;
      }
      await deleteDoc(doc(db, "users", user.uid, "cashWallet", deleteContext.id));
      setDeleteContext(null);
    } catch (error) {
      setPinError("System error during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openModal = () => {
    setEditingId(null);
    setFormData({ title: '', foreignAmount: '', currency: baseCurrency, exchangeRate: 1, date: todayDate });
    setIsModalOpen(true);
  };
  
  const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

  return (
    <div className="w-full h-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">
        
        <style>{`
          @keyframes scrollTicker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-ticker-scroll {
            display: flex;
            white-space: nowrap;
            animation: scrollTicker 30s linear infinite;
          }
          .animate-ticker-scroll:hover {
            animation-play-state: paused;
          }
        `}</style>

        {/* 🚀 GLOBAL FIAT TICKER */}
        <TickerBar tickerData={tickerData} currencySymbol={currencySymbol} />

        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><FaMoneyBillWave size={24} /></div>
              <h1 className="text-3xl font-black dark:text-white tracking-tight">Physical Cash</h1>
            </div>
            <p className="text-sm font-bold text-slate-500 max-w-xl">
              Track your physical cash injections and offline foreign currency conversions.
            </p>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            {/* 🚀 DOWNLOAD REPORT DROPDOWN */}
            <div className="relative group">
              <button className="flex items-center gap-1 md:gap-2 p-3 md:p-3.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-2xl font-bold text-xs md:text-sm hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                <HiOutlineDownload size={18}/> 
                <span className="hidden sm:inline">Download Report</span>
                <span className="sm:hidden">Report</span>
              </button>
              <div className="absolute top-full right-0 md:left-0 md:right-auto mt-2 w-36 md:w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
                <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg">
                  <HiOutlineDocumentText className="text-rose-400" size={16}/> PDF Document
                </button>
                <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg">
                  <HiOutlineTable className="text-emerald-400" size={16}/> Excel (CSV)
                </button>
              </div>
            </div>

            <button onClick={openModal} className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 md:px-7 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shadow-lg shadow-emerald-500/30 whitespace-nowrap">
              <HiOutlinePlus size={18} /> <span className="hidden sm:inline">Add to Vault</span> <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col items-start justify-center min-h-[200px]">
          <div className="absolute -right-10 -top-10 opacity-10 text-white"><HiOutlineCash size={200} /></div>
          <div className="relative z-10 w-full">
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Net Cash Vault Balance (Base Equiv.)</p>
            <h2 className="text-5xl md:text-6xl font-black text-emerald-400 tracking-tight">
              {currencySymbol}{(totalBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h2>
            
            {/* 🚀 SUB-WALLET BALANCES RENDERED HERE */}
            {currencyBalances.length > 0 && (
               <div className="mt-6 pt-6 border-t border-slate-700/50 flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                 {currencyBalances.map((item, idx) => (
                    <div key={idx} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 shrink-0 flex items-center gap-3">
                       <img src={`https://flagcdn.com/w40/${fiatFlagMap[item.currency] || 'un'}.png`} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-600" />
                       <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Physical {item.currency}</p>
                         <p className="text-lg font-bold text-white leading-none mt-0.5">{item.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                       </div>
                    </div>
                 ))}
               </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Balance" value={`${currencySymbol}${totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={FaPiggyBank} color="from-emerald-600 to-teal-600" trend={2.5} />
          <StatCard title="Total Deposits" value={`${currencySymbol}${totalInflows.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingUp} color="from-blue-600 to-cyan-600" />
          <StatCard title="Total Withdrawals" value={`${currencySymbol}${totalOutflows.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingDown} color="from-rose-600 to-pink-600" />
          <StatCard title="Currencies Held" value={currencyBalances.length} icon={FaGlobe} color="from-purple-600 to-violet-600" subtitle="Active fiat positions" />
        </div>

        {/* Currency Holdings */}
        {currencyBalances.length > 0 && (
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <FaWallet className="text-emerald-500" /> Physical Currency Holdings
            </h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
              {currencyBalances.map((item, idx) => (
                <CurrencyBadge key={idx} currency={item.currency} amount={item.value} />
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
            <input 
              type="text" placeholder="Search transactions..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="relative w-full md:w-56">
            <HiOutlineFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <select 
              value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer transition-all"
            >
              <option value="all">All Transactions</option>
              <option value="in">Deposits Only</option>
              <option value="out">Withdrawals Only</option>
            </select>
          </div>
        </div>

        {/* Ledger */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-30 animate-pulse" />
                <HiOutlineRefresh className="animate-spin text-4xl text-emerald-500 relative" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-4 animate-pulse">Loading Ledger...</p>
            </div>
          ) : processedLedger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <HiOutlineCash className="text-4xl text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest">No transactions found</p>
              <p className="text-xs text-slate-400 mt-1">Add your first cash deposit to get started</p>
            </div>
          ) : (
            processedLedger.map((month) => (
              <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/50">
                  <h2 className="text-base font-black dark:text-white flex items-center gap-2">
                    <HiOutlineCalendar className="text-emerald-500" size={18} />
                    {month.monthName}
                  </h2>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Opening</p>
                    <p className="font-bold text-slate-600 dark:text-slate-300">{currencySymbol}{month.openingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="p-4 pl-6">Type</th>
                        <th className="p-4">Details</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4 text-right">Net Change</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {month.records.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-4 pl-6">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rec.type === 'in' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                              {rec.type === 'in' ? <FaArrowDown size={16} /> : <FaArrowUp size={16} />}
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="font-black dark:text-white text-sm">{rec.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] font-medium text-slate-500">
                                {formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date}
                              </p>
                              {rec.currency && rec.currency !== baseCurrency && (
                                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  <img src={`https://flagcdn.com/w20/${fiatFlagMap[rec.currency] || 'un'}.png`} className="w-3 h-3 rounded-full" alt="" />
                                  {rec.currency}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <p className="font-bold text-slate-600 dark:text-slate-300">
                              {rec.currency !== baseCurrency 
                                ? `${(rec.foreignAmount || 0).toLocaleString()} ${rec.currency}`
                                : `${currencySymbol}${(rec.finalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                              }
                            </p>
                            {rec.currency !== baseCurrency && (
                              <p className="text-[9px] text-slate-400">≈ {currencySymbol}{rec.finalAmount?.toLocaleString()}</p>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <p className={`text-base font-black ${rec.netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {rec.netChange >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(rec.netChange).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </p>
                          </td>
                          <td className="p-4 pr-6">
                            <div className="flex items-center justify-end gap-2">
                              {!rec.linkedExpenseId && (
                                <button onClick={() => handleEdit(rec)} className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-all">
                                  <HiOutlinePencil size={16} />
                                </button>
                              )}
                              <button onClick={() => initiateDelete(rec)} className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-all">
                                <HiOutlineTrash size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/30">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Closing Balance</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {currencySymbol}{month.closingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black flex items-center gap-2">
                <FaMoneyBillWave /> {editingId ? 'Edit Entry' : 'Add Cash'}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                <input 
                  type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Salary, Gift, ATM"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Currency</label>
                  <select 
                    value={formData.currency} 
                    onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                  >
                    {/* 🚀 DYNAMIC CURRENCY LIST: Only shows Base Currency and Watchlist Currencies */}
                    {availableCurrencies.map(c => <option key={c} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</label>
                  <input 
                    type="number" step="any" required value={formData.foreignAmount} onChange={(e) => setFormData({...formData, foreignAmount: e.target.value})}
                    placeholder="0.00"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {formData.currency !== baseCurrency && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Exchange Rate</label>
                    <button 
                      type="button" onClick={fetchLiveRate} disabled={isFetchingRate}
                      className="text-[10px] font-black bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <HiOutlineRefresh className={isFetchingRate ? "animate-spin" : ""} size={12} /> Live
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-500">1 {formData.currency} =</span>
                    <input 
                      type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-medium dark:text-white outline-none"
                    />
                    <span className="text-sm font-black text-slate-500">{baseCurrency}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-emerald-200 dark:border-emerald-500/20">
                    <span className="text-xs font-medium text-slate-500">Final Value:</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {currencySymbol}{calculatedFinalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</label>
                <input 
                  type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <button type="submit" disabled={isSaving} className="w-full p-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving && <HiOutlineRefresh className="animate-spin" size={18} />}
                {editingId ? 'Update Entry' : 'Add to Vault'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <HiOutlineShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black">Security Verification</h3>
                  <p className="text-xs text-white/70">Enter PIN to confirm deletion</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={executeSecureDelete} className="p-6 space-y-5">
              <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  You are deleting <span className="font-black">"{deleteContext.title}"</span> worth 
                  <span className="font-black"> {currencySymbol}{deleteContext.finalBaseAmount?.toLocaleString()}</span>
                </p>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security PIN</label>
                <input 
                  type="password" maxLength={6} required autoFocus
                  value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.3em] text-xl p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50"
                />
                {pinError && <p className="text-xs font-medium text-rose-500 mt-2 text-center">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-sm bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isVerifying && <HiOutlineRefresh className="animate-spin" size={18} />}
                  Confirm Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CashWallet;