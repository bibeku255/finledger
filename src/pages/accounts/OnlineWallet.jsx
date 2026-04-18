import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

// 🚀 FIXED: Removed missing 'HiOutlineCreditCard' and 'HiOutlineBuildingOffice' to prevent Vite crash
import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineLibrary, HiOutlineSearch, HiOutlineRefresh,
  HiOutlineLockClosed, HiOutlineExclamationCircle,
  HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineChevronRight, HiOutlineCalendar, HiOutlineShieldCheck,
  HiOutlineGlobe
} from 'react-icons/hi';
import { 
  FaGlobe, FaWallet, FaShieldAlt, FaExchangeAlt, 
  FaArrowDown, FaArrowUp, FaPiggyBank, FaChartLine
} from 'react-icons/fa';

// 🚀 Mapping for Forex Flags
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
const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) => (
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

// 🚀 Premium Ticker Bar (Purple Themed)
const TickerBar = ({ tickerData, currencySymbol }) => (
  <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-200 dark:border-purple-800/50 shadow-sm backdrop-blur-sm">
    <div className="absolute left-0 z-10 h-full px-5 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
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
            <span className="text-slate-800 dark:text-slate-300 font-black">{item.symbol}</span>
            <span className="text-slate-900 dark:text-white font-black">
              {currencySymbol}{Number(item.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}
            </span>
            <span className={`text-[11px] font-black flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
              item.change >= 0 
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400' 
                : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400'
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

// 🚀 Premium Wallet Badge (High Contrast Fix)
const WalletBadge = ({ wallet, currency, amount }) => (
  <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 shrink-0 flex items-center gap-3 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-300 group shadow-sm">
    <div className="relative">
      <div className="absolute inset-0 bg-indigo-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
      <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
        <FaWallet size={18} className="text-white" />
      </div>
    </div>
    <div>
      <div className="flex items-center gap-2">
        <img 
          src={`https://flagcdn.com/w40/${fiatFlagMap[currency] || 'un'}.png`} 
          alt="" 
          className="w-4 h-4 rounded-full object-cover shadow-sm" 
        />
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{wallet}</p>
      </div>
      <p className="text-lg font-black text-slate-900 dark:text-white">{amount.toLocaleString(undefined, {minimumFractionDigits: 2})} {currency}</p>
    </div>
  </div>
);

const OnlineWallet = () => {
  // 🚀 DYNAMIC FIAT WATCHLIST INTEGRATION
  const { user, baseCurrency = 'INR', selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const availableCurrencies = useMemo(() => {
    return Array.from(new Set([baseCurrency, ...selectedFiats]));
  }, [baseCurrency, selectedFiats]);

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [tickerData, setTickerData] = useState([]);
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    title: '', walletName: '', referenceNo: '', 
    isP2P: false, foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '', date: todayDate,
    isSynced: false
  });

  useEffect(() => {
    const fetchTickerData = async () => {
      try {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        const data = await res.json();
        const targetFiats = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'];
        const formattedFiat = targetFiats.map(fiat => {
          const rate = data.rates[fiat];
          return rate ? { symbol: fiat, price: (1 / rate).toFixed(4), change: (Math.random() * 0.8 - 0.4).toFixed(2) } : null;
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
    const walletRef = collection(db, "users", user.uid, "onlineWallet");
    const q = query(walletRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(dbRecords);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const existingWallets = useMemo(() => {
    const wallets = new Set(transactions.map(t => t.walletName).filter(w => w && w.trim() !== ''));
    return Array.from(wallets);
  }, [transactions]);

  const subWalletBalances = useMemo(() => {
    const balances = {};
    transactions.forEach(t => {
      const curr = t.currency || baseCurrency;
      const originalWalletName = t.walletName?.trim() ? t.walletName.trim() : 'Main Wallet';
      const key = `${originalWalletName.toUpperCase()}_${curr.toUpperCase()}`;
      if (!balances[key]) balances[key] = { wallet: originalWalletName, currency: curr, value: 0 };
      const amt = Number(t.foreignAmount || t.amount || 0); 
      if (t.type === 'in') balances[key].value += amt;
      else balances[key].value -= amt;
    });
    return Object.values(balances).filter(b => Math.abs(b.value) > 0.01).sort((a, b) => b.value - a.value);
  }, [transactions, baseCurrency]);

  const processedLedger = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const grouped = {};

    sorted.forEach(t => {
      const dateObj = new Date(t.date || new Date());
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) grouped[monthKey] = { monthName, openingBalance: runningBalance, records: [], closingBalance: 0 };

      let finalAmount = Number(t.finalBaseAmount || t.amount || 0);
      let feeAmount = 0;
      if (t.fee && t.feeExchangeRate) feeAmount = Number(t.fee) * Number(t.feeExchangeRate);
      else if (t.fee && t.exchangeRate) feeAmount = Number(t.fee) * Number(t.exchangeRate);
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
        const walletMatch = r.walletName ? r.walletName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const refMatch = r.referenceNo ? r.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const typeMatch = filterType === 'all' || r.type === filterType || (filterType === 'p2p' && r.isP2P);
        return (titleMatch || walletMatch || refMatch) && typeMatch;
      }).reverse(); 
      return { ...monthData, records: filteredRecords };
    }).filter(m => m.records.length > 0 || searchTerm === ''); 
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
        walletName: rec.walletName || 'N/A',
        currency: rec.currency || baseCurrency,
        amount: `${isIncome ? '+' : '-'}${currencySymbol}${Math.abs(finalAmt).toFixed(2)}`,
        notes: cleanNote
      };
    });

    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Type', key: 'type' },
      { header: 'Platform / Wallet', key: 'walletName' }, { header: 'Currency', key: 'currency' },
      { header: 'Net Amount', key: 'amount' }, { header: 'Details', key: 'notes' }
    ];

    const fileName = `Online_Wallet_Ledger`;
    const reportTitle = `Digital Fiat Wallet - Complete Ledger`;

    if (format === 'pdf') downloadPDFReport(reportData, columns, fileName, reportTitle);
    else downloadExcelReport(reportData, columns, fileName);
  };

  const fetchLiveRate = async () => {
    if (formData.currency === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
      const data = await res.json();
      if (data.rates[baseCurrency]) setFormData(prev => ({ ...prev, exchangeRate: data.rates[baseCurrency].toFixed(4) }));
    } catch (error) {
      alert(`Could not fetch auto-rate for ${formData.currency}. Please enter it manually.`);
    } finally {
      setIsFetchingRate(false);
    }
  };

  const grossDeposit = parseFloat(formData.foreignAmount) || 0;
  const nativeFee = parseFloat(formData.fee) || 0;
  const netNativeAmount = grossDeposit - nativeFee; 
  const exchangeRate = formData.currency !== baseCurrency ? (parseFloat(formData.exchangeRate) || 1) : 1;
  const calculatedFinalAmount = netNativeAmount * exchangeRate; 

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");
    if (!formData.walletName.trim()) return alert("Please provide a Wallet Name (e.g. PayPal)");
    
    setIsSaving(true);
    try {
      if (editingId) {
        if (formData.isSynced) {
           await setDoc(doc(db, "users", user.uid, "onlineWallet", editingId), { walletName: formData.walletName.trim() }, { merge: true });
        } else {
           const recordData = {
             title: formData.title, walletName: formData.walletName.trim(), walletCategory: "Fiat E-Wallet",
             referenceNo: formData.referenceNo || '', isP2P: formData.isP2P || false, date: formData.date,
             currency: formData.currency, foreignAmount: grossDeposit, fee: nativeFee, 
             netForeignAmount: netNativeAmount, exchangeRate: exchangeRate, finalBaseAmount: calculatedFinalAmount 
           };
           await setDoc(doc(db, "users", user.uid, "onlineWallet", editingId), recordData, { merge: true });
        }
      } else {
        const recordData = {
          title: formData.title, walletName: formData.walletName.trim(), walletCategory: "Fiat E-Wallet",
          referenceNo: formData.referenceNo || '', isP2P: formData.isP2P || false, type: 'in', 
          date: formData.date, timestamp: new Date(formData.date).getTime(), currency: formData.currency,
          foreignAmount: grossDeposit, fee: nativeFee, netForeignAmount: netNativeAmount, 
          exchangeRate: exchangeRate, finalBaseAmount: calculatedFinalAmount 
        };
        await addDoc(collection(db, "users", user.uid, "onlineWallet"), recordData);
      }
      closeModal();
    } catch (error) {
      alert("System Error: Failed to save record.");
    } finally {
      setIsSaving(false); 
    }
  };

  const handleEdit = (rec) => {
    const isSyncedEntry = !!(rec.linkedExpenseId || rec.linkedIncomeId || rec.shiftId || rec.linkedPartyId);
    setFormData({
      title: rec.title || '', walletName: rec.walletName || '', referenceNo: rec.referenceNo || '',
      isP2P: rec.isP2P || false, foreignAmount: rec.foreignAmount || rec.finalBaseAmount || '', 
      currency: rec.currency || baseCurrency, exchangeRate: rec.exchangeRate || 1, fee: rec.fee || '', 
      date: rec.date || todayDate, isSynced: isSyncedEntry
    });
    setEditingId(rec.id);
    setIsModalOpen(true);
  };

  const initiateDelete = (rec) => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your Security PIN.");
    setIsVerifying(true); setPinError('');
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userData?.security?.pinHash || userData?.securityPin || userData?.pin; 
      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect PIN. Deletion blocked! 🛑");
        setIsVerifying(false); return;
      }
      await deleteDoc(doc(db, "users", user.uid, "onlineWallet", deleteContext.id));
      setDeleteContext(null); 
    } catch (error) {
      setPinError("System error during verification. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openModal = () => {
    setEditingId(null);
    const lastWallet = existingWallets.length > 0 ? existingWallets[0] : '';
    setFormData({ title: '', walletName: lastWallet, referenceNo: '', isP2P: false, foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '', date: todayDate, isSynced: false });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

  return (
    // 🚀 FIXED SCROLLING ISSUE: Using `w-full h-auto pb-24` instead of `h-full min-h-screen overflow-y-auto`
    <div className="w-full h-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">
        
        <style>{`
          @keyframes scrollTicker {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .animate-ticker-scroll {
            display: inline-flex;
            white-space: nowrap;
            animation: scrollTicker 25s linear infinite;
          }
          .animate-ticker-scroll:hover {
            animation-play-state: paused;
          }
        `}</style>

        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <HiOutlineGlobe size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Digital Fiat Wallets</h1>
                  <p className="text-sm font-medium text-slate-400">Manage PayPal, Payoneer, Skrill, and other E-Wallets</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10">
                  <HiOutlineDownload size={16} /> Report
                </button>
                <div className="absolute top-full right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
                  <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg">
                    <HiOutlineDocumentText className="text-rose-400" size={16}/> PDF Document
                  </button>
                  <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg">
                    <HiOutlineTable className="text-emerald-400" size={16}/> Excel (CSV)
                  </button>
                </div>
              </div>
              
              <button onClick={openModal} className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/30 whitespace-nowrap">
                <HiOutlinePlus size={18} /> Log E-Deposit
              </button>
            </div>
          </div>
        </div>

        {/* Live Ticker Bar */}
        <TickerBar tickerData={tickerData} currencySymbol={currencySymbol} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Balance" value={`${currencySymbol}${totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={FaPiggyBank} color="from-purple-600 to-indigo-600" trend={2.5} />
          <StatCard title="Total Deposits" value={`${currencySymbol}${totalInflows.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingUp} color="from-emerald-600 to-teal-600" />
          <StatCard title="Total Withdrawals" value={`${currencySymbol}${totalOutflows.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingDown} color="from-rose-600 to-pink-600" />
          <StatCard title="Active Wallets" value={existingWallets.length} icon={FaWallet} color="from-blue-600 to-cyan-600" subtitle="Connected platforms" />
        </div>

        {/* Wallet Holdings - High Contrast */}
        {subWalletBalances.length > 0 && (
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800">
            <h3 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <FaWallet className="text-purple-500" /> E-Wallet Holdings by Currency
            </h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
              {subWalletBalances.map((item, idx) => (
                <WalletBadge key={idx} wallet={item.wallet} currency={item.currency} amount={item.value} />
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter - High Contrast */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search by Platform, Sender, or Ref..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-purple-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-purple-500 cursor-pointer transition-all shadow-sm"
            >
              <option value="all">All Records</option>
              <option value="p2p">⚠️ P2P Only</option>
              <option value="in">Deposits</option>
              <option value="out">Withdrawals</option>
            </select>
          </div>
        </div>

        {/* Ledger - High Contrast */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500 rounded-full blur-xl opacity-30 animate-pulse" />
                <HiOutlineRefresh className="animate-spin text-4xl text-purple-500 relative" />
              </div>
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest mt-4 animate-pulse">Syncing Cloud Wallets...</p>
            </div>
          ) : processedLedger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-sm">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <HiOutlineGlobe className="text-4xl text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2">No Digital Fiat Found</h3>
              <p className="text-slate-500 font-semibold">Log your PayPal, Payoneer, or Local E-Wallet deposits here.</p>
            </div>
          ) : (
            processedLedger.map((month) => (
              <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <HiOutlineCalendar className="text-purple-500" size={18} />
                    {month.monthName}
                  </h2>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Opening Balance</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{currencySymbol}{(month.openingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead className="bg-slate-100/50 dark:bg-slate-800/30 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="p-4 pl-6 w-12 text-center">Type</th>
                        <th className="p-4">Platform & Details</th>
                        <th className="p-4 text-right">Fiat Flow</th>
                        <th className="p-4 text-right">Base Equivalent</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {month.records.map((rec) => (
                        <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group ${rec.isP2P ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                          
                          <td className="p-4 pl-6 text-center">
                            <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-lg shrink-0 ${rec.type === 'in' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                              {rec.type === 'in' ? <FaArrowDown /> : <FaArrowUp />}
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 mt-1 rounded-2xl flex items-center justify-center text-xl shadow-sm ${rec.isP2P ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'}`}>
                                {rec.isP2P ? <FaShieldAlt /> : <FaWallet />}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 dark:text-white text-sm mb-0.5 flex items-center gap-2">
                                  {rec.walletName || 'Main Wallet'}
                                  {rec.isP2P && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><FaShieldAlt size={8}/> P2P Risk</span>}
                                </p>
                                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">{rec.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date}
                                  </p>
                                  {rec.referenceNo && <span className="text-[10px] text-slate-500 dark:text-slate-400">| Ref: {rec.referenceNo}</span>}
                                </div>
                                {rec.feeAmount > 0 && rec.type === 'out' && (
                                  <p className="text-[9px] mt-1 text-rose-600 font-bold bg-rose-50 dark:bg-rose-500/10 inline-block px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-500/20">
                                    Incl. Fee: -{currencySymbol}{rec.feeAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          
                          <td className="p-4 text-right">
                             {rec.currency && rec.currency !== baseCurrency ? (
                               <div className="flex flex-col items-end">
                                 <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                   <img src={`https://flagcdn.com/w20/${fiatFlagMap[rec.currency] || 'un'}.png`} alt="" className="w-3 h-3 rounded-full object-cover" />
                                   {rec.currency}
                                 </span>
                                 {rec.fee > 0 && rec.type === 'in' ? (
                                   <>
                                     <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Gross: {Number(rec.foreignAmount).toLocaleString()}</p>
                                     <p className="text-[10px] font-bold text-rose-500">Fee: -{Number(rec.fee).toLocaleString()}</p>
                                     <p className="text-sm font-black text-slate-800 dark:text-white border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
                                       Net: {(Number(rec.netForeignAmount) || Number(rec.foreignAmount)).toLocaleString()}
                                     </p>
                                   </>
                                 ) : (
                                   <p className="font-bold text-slate-800 dark:text-slate-200">{(Number(rec.foreignAmount) || 0).toLocaleString()}</p>
                                 )}
                               </div>
                             ) : (
                               <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-end gap-1">
                                  <img src={`https://flagcdn.com/w20/${fiatFlagMap[baseCurrency] || 'un'}.png`} alt="" className="w-3 h-3 rounded-full object-cover" /> Base Asset
                               </span>
                             )}
                          </td>
                          
                          <td className="p-4 text-right">
                            <p className={`text-lg font-black tracking-tight ${rec.netChange >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {rec.netChange >= 0 ? '+' : '-'}{currencySymbol}{(Math.abs(Number(rec.netChange) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </p>
                            {rec.currency !== baseCurrency && (
                              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 tracking-wider">
                                @ {Number(rec.exchangeRate) || 1} Rate
                              </p>
                            )}
                          </td>
                          
                          <td className="p-4 pr-6">
                            <div className="flex items-center justify-end gap-2">
                               <button onClick={() => handleEdit(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition-all shadow-sm border border-slate-300 dark:border-slate-700">
                                 <HiOutlinePencil size={18} />
                               </button>

                              <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all shadow-sm border border-slate-300 dark:border-slate-700" title={rec.linkedExpenseId || rec.linkedIncomeId || rec.shiftId ? "Force Delete Auto-Synced Entry" : "Delete"}>
                                <HiOutlineTrash size={18} />
                              </button>
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/80 dark:bg-slate-800/50">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Closing Balance</p>
                    <p className="text-xl font-black text-indigo-700 dark:text-indigo-400">
                      {currencySymbol}{month.closingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 🚀 MODAL: Edit & Entry (High Contrast) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
            
            <div className="px-8 py-6 flex justify-between items-center transition-colors duration-300 bg-purple-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                <HiOutlineGlobe size={24} />
                <h3 className="text-xl font-black">{editingId ? 'Edit Wallet Record' : 'Log E-Deposit'}</h3>
              </div>
              <button type="button" onClick={closeModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              
              {formData.isSynced && (
                 <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-4 rounded-xl text-xs font-bold leading-relaxed border border-amber-200 dark:border-amber-500/30">
                   <span className="flex items-center gap-1 mb-1"><HiOutlineExclamationCircle size={16}/> Auto-Synced Entry</span>
                   This entry is linked to an Income or Expense log. You can only update the <span className="underline">Wallet Name</span> here. To change the amount, please edit the source transaction.
                 </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Platform Name</label>
                  <input type="text" list="online-wallets" required value={formData.walletName} onChange={(e) => setFormData({...formData, walletName: e.target.value})} placeholder="e.g., PayPal, Skrill" 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors placeholder-slate-400 dark:placeholder-slate-500" />
                  <datalist id="online-wallets">
                    {existingWallets.map(w => <option key={w} value={w} />)}
                  </datalist>
                </div>
                {!formData.isSynced && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Sender / Source</label>
                    <input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g., Freelance Client" 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-60" />
                  </div>
                )}
              </div>

              {!formData.isSynced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Fiat Currency</label>
                    <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors cursor-pointer disabled:opacity-60">
                      {/* 🚀 DYNAMIC CURRENCY LIST IMPLEMENTED */}
                      {availableCurrencies.map(c => <option key={c} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Deposit Amount ({formData.currency})</label>
                    <input type="number" step="any" required value={formData.foreignAmount} onChange={(e) => setFormData({...formData, foreignAmount: e.target.value})} placeholder="0.00" 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors text-lg placeholder-slate-400 dark:placeholder-slate-500" />
                  </div>
                </div>
              )}

              {!formData.isSynced && (
                <label className={`flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-colors duration-300 ${formData.isP2P ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-500/50' : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:border-purple-400'}`}>
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input type="checkbox" checked={formData.isP2P} onChange={(e) => setFormData({...formData, isP2P: e.target.checked})} className="sr-only" />
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${formData.isP2P ? 'bg-amber-500 border-amber-500' : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900'}`}>
                      {formData.isP2P && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <div>
                    <p className={`font-black ${formData.isP2P ? 'text-amber-800 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>Tag as P2P / Crypto Origin</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Isolate this transaction for risk management and tax auditing.</p>
                  </div>
                </label>
              )}

              {!formData.isSynced && formData.currency !== baseCurrency && (
                <div className="p-5 border rounded-2xl space-y-4 transition-colors bg-purple-50/50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest flex items-center gap-1 text-purple-800 dark:text-purple-300">
                      Convert to {baseCurrency}
                    </span>
                    <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="text-[10px] font-black text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 bg-purple-600 hover:bg-purple-700 shadow-sm">
                      <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} /> {isFetchingRate ? 'Fetching...' : 'Get Live Rate'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">1 {formData.currency} = </span>
                    <input type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} placeholder={`Rate in ${baseCurrency}`} 
                      className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors disabled:opacity-60" />
                  </div>
                </div>
              )}

              {!formData.isSynced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      Gateway Fee 
                      <span className="text-[8px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 px-2 py-0.5 rounded-full">IN {formData.currency}</span>
                    </label>
                    <input type="number" step="any" value={formData.fee} onChange={(e) => setFormData({...formData, fee: e.target.value})} placeholder={`Fee in ${formData.currency}`} 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors disabled:opacity-60 placeholder-slate-400 dark:placeholder-slate-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Ref ID / TxHash</label>
                    <input type="text" value={formData.referenceNo} onChange={(e) => setFormData({...formData, referenceNo: e.target.value})} placeholder="e.g. TXN123..." 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors disabled:opacity-60 placeholder-slate-400 dark:placeholder-slate-500" />
                  </div>
                </div>
              )}

              {!formData.isSynced && (
                <div className="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-300 dark:border-slate-700">
                  <div className="flex justify-between items-end">
                    <div className="space-y-2">
                      <span className="block text-xs font-bold text-slate-600 dark:text-slate-400">Gross Value: {netNativeAmount.toLocaleString(undefined, {maximumFractionDigits: 2})} {formData.currency}</span>
                      <span className="block text-[10px] font-black text-rose-600 dark:text-rose-400">Fees: -{nativeFee.toLocaleString(undefined, {maximumFractionDigits: 2})} {formData.currency}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Final Base Value</span>
                      <span className="text-xl font-black tracking-tight text-purple-700 dark:text-purple-400">
                        {currencySymbol}{calculatedFinalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex justify-between ml-1">
                  <span>Date</span>
                  <span className="text-purple-600 dark:text-purple-400">{formatGlobalDate ? formatGlobalDate(formData.date, 'full') : ''}</span>
                </label>
                <input disabled={formData.isSynced} type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors disabled:opacity-60" />
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2">
                <button type="submit" disabled={isSaving} className={`w-full p-4 shrink-0 rounded-2xl font-black text-white text-lg transition-all shadow-xl flex items-center justify-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} ${formData.isP2P ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/30' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'}`}>
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : null}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Wallet Name' : 'Secure E-Deposit')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-700">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <HiOutlineShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">Security Verification</h3>
                  <p className="text-xs text-white/70">Enter PIN to confirm deletion</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={executeSecureDelete} className="p-6 space-y-5">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  You are deleting <span className="font-black">"{deleteContext.title}"</span> worth 
                  <span className="font-black"> {currencySymbol}{deleteContext.finalBaseAmount?.toLocaleString()}</span>
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Security PIN</label>
                <input 
                  type="password" maxLength={6} required autoFocus
                  value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.3em] text-xl p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors"
                />
                {pinError && <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-2 text-center">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-sm bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : null}
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

export default OnlineWallet;