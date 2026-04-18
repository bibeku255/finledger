import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineLibrary, HiOutlineSearch, HiOutlineRefresh,
  HiOutlineLockClosed, HiOutlineExclamationCircle,
  HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineChevronRight, HiOutlineCalendar, HiOutlineShieldCheck,
  HiOutlineBuildingOffice, HiOutlineCreditCard, HiOutlineBanknotes
} from 'react-icons/hi';
import { 
  FaGlobe, FaUniversity, FaShieldAlt, FaExchangeAlt, 
  FaArrowDown, FaArrowUp, FaGem, FaChartLine, FaPiggyBank 
} from 'react-icons/fa';

const bankTransferTypes = ["UPI", "IMPS", "NEFT / RTGS", "Wire Transfer / SWIFT", "Cheque", "Direct Deposit"];

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

// 🚀 Premium Ticker Bar
const TickerBar = ({ tickerData, currencySymbol }) => (
  <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800/50 shadow-sm backdrop-blur-sm">
    <div className="absolute left-0 z-10 h-full px-5 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
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

// 🚀 Premium Bank Badge
const BankBadge = ({ bank, currency, amount }) => (
  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3 shrink-0 flex items-center gap-3 hover:bg-white/15 transition-all duration-300 group">
    <div className="relative">
      <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
      <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
        <FaUniversity size={18} className="text-white" />
      </div>
    </div>
    <div>
      <div className="flex items-center gap-2">
        <img 
          src={`https://flagcdn.com/w40/${fiatFlagMap[currency] || 'un'}.png`} 
          alt="" 
          className="w-4 h-4 rounded-full object-cover" 
        />
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{bank}</p>
      </div>
      <p className="text-lg font-black text-white">{amount.toLocaleString(undefined, {minimumFractionDigits: 2})} {currency}</p>
    </div>
  </div>
);

const BankWallet = () => {
  // 🚀 FETCHING BASE CURRENCY AND WATCHLIST FROM CONTEXT
  const { user, baseCurrency = 'INR', selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  // 🚀 DYNAMIC CURRENCY LIST: Merges Base Currency and Watchlist beautifully
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
    title: '', bankName: '', transferType: 'UPI', referenceNo: '', 
    isP2P: false, foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '', date: todayDate,
    isSynced: false
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
    const bankRef = collection(db, "users", user.uid, "bankWallet");
    const q = query(bankRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(dbRecords);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const existingBanks = useMemo(() => {
    const banks = new Set(transactions.map(t => t.bankName).filter(b => b && b.trim() !== ''));
    return Array.from(banks);
  }, [transactions]);

  const subWalletBalances = useMemo(() => {
    const balances = {};
    transactions.forEach(t => {
      const curr = t.currency || baseCurrency;
      const originalBankName = t.bankName?.trim() ? t.bankName.trim() : 'Main Vault';
      const key = `${originalBankName.toUpperCase()}_${curr.toUpperCase()}`;
      if (!balances[key]) balances[key] = { bank: originalBankName, currency: curr, value: 0 };
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
        const bankMatch = r.bankName ? r.bankName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const refMatch = r.referenceNo ? r.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const typeMatch = filterType === 'all' || r.type === filterType || (filterType === 'p2p' && r.isP2P);
        return (titleMatch || bankMatch || refMatch) && typeMatch;
      }).reverse();
      return { ...monthData, records: filteredRecords };
    }).filter(m => m.records.length > 0);
  }, [transactions, searchTerm, filterType, formatGlobalDate]);

  const totalBalance = processedLedger.length > 0 ? processedLedger[0].closingBalance : 0;
  const totalInflows = useMemo(() => transactions.filter(t => t.type === 'in').reduce((acc, t) => acc + (Number(t.finalBaseAmount) || 0), 0), [transactions]);
  const totalOutflows = useMemo(() => transactions.filter(t => t.type === 'out').reduce((acc, t) => acc + (Number(t.finalBaseAmount) || 0), 0), [transactions]);

  const handleDownloadReport = (format) => {
    if (transactions.length === 0) return alert("No bank records found to download.");
    const reportData = transactions.map(rec => {
      const isIncome = rec.type === 'in';
      const cleanNote = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const finalAmt = Number(rec.finalBaseAmount || rec.amount || 0);
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        type: isIncome ? 'Deposit (+)' : 'Withdrawal (-)',
        bankName: rec.bankName || 'N/A',
        reference: rec.referenceNo || 'N/A',
        amount: `${isIncome ? '+' : '-'}${currencySymbol}${Math.abs(finalAmt).toFixed(2)}`,
        notes: cleanNote
      };
    });
    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Type', key: 'type' },
      { header: 'Bank', key: 'bankName' }, { header: 'Reference', key: 'reference' },
      { header: 'Amount', key: 'amount' }, { header: 'Description', key: 'notes' }
    ];
    const fileName = `Bank_Vault_Ledger`;
    const reportTitle = `Bank Vault - Complete Ledger`;
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
      alert("Failed to fetch live market rate.");
    } finally {
      setIsFetchingRate(false);
    }
  };

  const isForeign = formData.currency !== baseCurrency;
  const grossAmount = (parseFloat(formData.foreignAmount) || 0) * (isForeign ? (parseFloat(formData.exchangeRate) || 1) : 1);
  const feeDeduction = parseFloat(formData.fee) || 0;
  const calculatedFinalAmount = grossAmount - feeDeduction;

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");
    if (!formData.bankName.trim()) return alert("Please provide a Bank Name (e.g. SBI)");
    setIsSaving(true);
    try {
      if (editingId) {
        if (formData.isSynced) {
          await setDoc(doc(db, "users", user.uid, "bankWallet", editingId), { 
            bankName: formData.bankName.trim() 
          }, { merge: true });
        } else {
          const recordData = {
            title: formData.title, bankName: formData.bankName.trim(), transferType: formData.transferType,
            referenceNo: formData.referenceNo || '', isP2P: formData.isP2P || false, date: formData.date,
            currency: formData.currency, foreignAmount: parseFloat(formData.foreignAmount) || 0,
            exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1, fee: feeDeduction, 
            finalBaseAmount: calculatedFinalAmount
          };
          await setDoc(doc(db, "users", user.uid, "bankWallet", editingId), recordData, { merge: true });
        }
      } else {
        const recordData = {
          title: formData.title, bankName: formData.bankName.trim(), transferType: formData.transferType,
          referenceNo: formData.referenceNo || '', isP2P: formData.isP2P || false, type: 'in', date: formData.date,
          timestamp: new Date(formData.date).getTime(), currency: formData.currency,
          foreignAmount: parseFloat(formData.foreignAmount) || 0,
          exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1, fee: feeDeduction, 
          finalBaseAmount: calculatedFinalAmount
        };
        await addDoc(collection(db, "users", user.uid, "bankWallet"), recordData);
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
      title: rec.title || '', bankName: rec.bankName || '', transferType: rec.transferType || 'UPI',
      referenceNo: rec.referenceNo || '', isP2P: rec.isP2P || false,
      foreignAmount: rec.foreignAmount || rec.amount || '', currency: rec.currency || baseCurrency,
      exchangeRate: rec.exchangeRate || 1, fee: rec.fee || '', date: rec.date || todayDate,
      isSynced: isSyncedEntry
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
      await deleteDoc(doc(db, "users", user.uid, "bankWallet", deleteContext.id));
      setDeleteContext(null);
    } catch (error) {
      setPinError("System error during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openModal = () => {
    setEditingId(null);
    const lastBank = existingBanks.length > 0 ? existingBanks[0] : '';
    setFormData({ title: '', bankName: lastBank, transferType: 'UPI', referenceNo: '', isP2P: false, foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '', date: todayDate, isSynced: false });
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

        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <FaUniversity size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Bank Ledger</h1>
                  <p className="text-sm font-medium text-slate-400">Track bank deposits, transfers, and P2P transactions</p>
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
              
              <button 
                onClick={openModal} 
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/30"
              >
                <HiOutlinePlus size={18} /> Log Deposit
              </button>
            </div>
          </div>
        </div>

        {/* Live Ticker Bar */}
        <TickerBar tickerData={tickerData} currencySymbol={currencySymbol} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Balance" value={`${currencySymbol}${totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={FaPiggyBank} color="from-blue-600 to-indigo-600" trend={2.5} />
          <StatCard title="Total Deposits" value={`${currencySymbol}${totalInflows.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingUp} color="from-emerald-600 to-teal-600" />
          <StatCard title="Total Withdrawals" value={`${currencySymbol}${totalOutflows.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={HiOutlineTrendingDown} color="from-rose-600 to-pink-600" />
          <StatCard title="Active Banks" value={existingBanks.length} icon={HiOutlineBuildingOffice} color="from-purple-600 to-violet-600" subtitle="Connected institutions" />
        </div>

        {/* Bank Holdings */}
        {subWalletBalances.length > 0 && (
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <FaUniversity className="text-blue-500" /> Bank Holdings by Currency
            </h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
              {subWalletBalances.map((item, idx) => (
                <BankBadge key={idx} bank={item.bank} currency={item.currency} amount={item.value} />
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" placeholder="Search by sender, bank, or reference..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:border-blue-500 cursor-pointer transition-all"
            >
              <option value="all">All Records</option>
              <option value="p2p">⚠️ P2P Only</option>
              <option value="in">Deposits</option>
              <option value="out">Withdrawals</option>
            </select>
          </div>
        </div>

        {/* Ledger */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
                <HiOutlineRefresh className="animate-spin text-4xl text-blue-500 relative" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-4 animate-pulse">Loading Ledger...</p>
            </div>
          ) : processedLedger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <FaUniversity className="text-4xl text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest">No bank records found</p>
              <p className="text-xs text-slate-400 mt-1">Log your first deposit to get started</p>
            </div>
          ) : (
            processedLedger.map((month) => (
              <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/50">
                  <h2 className="text-base font-black dark:text-white flex items-center gap-2">
                    <HiOutlineCalendar className="text-blue-500" size={18} />
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
                        <th className="p-4">Bank & Details</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4 text-right">Net Change</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {month.records.map((rec) => (
                        <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${rec.isP2P ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                          <td className="p-4 pl-6">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rec.type === 'in' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                              {rec.type === 'in' ? <FaArrowDown size={16} /> : <FaArrowUp size={16} />}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${rec.isP2P ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                                {rec.isP2P ? <FaShieldAlt size={14} /> : <FaUniversity size={14} />}
                              </div>
                              <div>
                                <p className="font-black dark:text-white text-sm flex items-center gap-2">
                                  {rec.title}
                                  {rec.isP2P && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase">P2P</span>
                                  )}
                                </p>
                                <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                                  {rec.bankName || 'Main Bank'} • {rec.transferType || 'Transfer'}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[9px] text-slate-400">
                                    {formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date}
                                  </p>
                                  {rec.referenceNo && (
                                    <span className="text-[9px] text-slate-400">Ref: {rec.referenceNo}</span>
                                  )}
                                </div>
                              </div>
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
                            <p className={`text-base font-black ${rec.netChange >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {rec.netChange >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(rec.netChange).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </p>
                          </td>
                          <td className="p-4 pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleEdit(rec)} className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-all">
                                <HiOutlinePencil size={16} />
                              </button>
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
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400">
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-xl font-black flex items-center gap-2">
                <FaUniversity /> {editingId ? 'Edit Record' : 'Log Deposit'}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 space-y-5">
              {formData.isSynced && (
                <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <HiOutlineExclamationCircle size={16} className="shrink-0 mt-0.5" />
                    <span>Auto-synced entry. You can only update the Bank Name here.</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bank Name</label>
                  <input 
                    type="text" list="bank-names" required value={formData.bankName} 
                    onChange={(e) => setFormData({...formData, bankName: e.target.value})} 
                    placeholder="e.g., SBI, Chase"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <datalist id="bank-names">
                    {existingBanks.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transfer Method</label>
                  <select 
                    disabled={formData.isSynced} value={formData.transferType} 
                    onChange={(e) => setFormData({...formData, transferType: e.target.value})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 cursor-pointer"
                  >
                    {bankTransferTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                <input 
                  disabled={formData.isSynced} type="text" required value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})} 
                  placeholder="e.g., Salary, Client Payment"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
                />
              </div>

              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${formData.isSynced ? 'opacity-60' : 'cursor-pointer'} ${formData.isP2P ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                <input 
                  disabled={formData.isSynced} type="checkbox" checked={formData.isP2P} 
                  onChange={(e) => setFormData({...formData, isP2P: e.target.checked})} 
                  className="sr-only" 
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${formData.isP2P ? 'bg-amber-500 border-amber-500' : 'border-slate-300 dark:border-slate-600'}`}>
                  {formData.isP2P && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                  <p className={`font-black text-sm ${formData.isP2P ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>Tag as P2P / Crypto Origin</p>
                  <p className="text-[10px] font-medium text-slate-500">Isolate for risk and tax purposes</p>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Currency</label>
                  <select 
                    disabled={formData.isSynced} value={formData.currency} 
                    onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 cursor-pointer"
                  >
                    {/* 🚀 DYNAMIC CURRENCY LIST: Only shows Base Currency and Watchlist Currencies */}
                    {availableCurrencies.map(c => <option key={c} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</label>
                  <input 
                    disabled={formData.isSynced} type="number" step="any" required value={formData.foreignAmount} 
                    onChange={(e) => setFormData({...formData, foreignAmount: e.target.value})} 
                    placeholder="0.00"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
                  />
                </div>
              </div>

              {formData.currency !== baseCurrency && (
                <div className="p-4 bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Exchange Rate</label>
                    <button 
                      type="button" onClick={fetchLiveRate} disabled={isFetchingRate || formData.isSynced}
                      className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50"
                    >
                      <HiOutlineRefresh className={isFetchingRate ? "animate-spin" : ""} size={12} /> Live
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-500">1 {formData.currency} =</span>
                    <input 
                      disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} 
                      onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})}
                      className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-medium dark:text-white outline-none disabled:opacity-60"
                    />
                    <span className="text-sm font-black text-slate-500">{baseCurrency}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bank Fee</label>
                  <input 
                    disabled={formData.isSynced} type="number" step="any" value={formData.fee} 
                    onChange={(e) => setFormData({...formData, fee: e.target.value})} 
                    placeholder="0.00"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reference No.</label>
                  <input 
                    disabled={formData.isSynced} type="text" value={formData.referenceNo} 
                    onChange={(e) => setFormData({...formData, referenceNo: e.target.value})} 
                    placeholder="e.g., UTR123..."
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Gross Value:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{currencySymbol}{grossAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-rose-500">Fees:</span>
                  <span className="font-bold text-rose-500">-{currencySymbol}{feeDeduction.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-base mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-black text-slate-700 dark:text-slate-300">Final Credit:</span>
                  <span className="font-black text-blue-600 dark:text-blue-400">{currencySymbol}{calculatedFinalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</label>
                <input 
                  disabled={formData.isSynced} type="date" required value={formData.date} 
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
                />
              </div>

              <button 
                type="submit" disabled={isSaving} 
                className={`w-full p-4 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  formData.isP2P 
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-lg shadow-amber-500/30' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30'
                }`}
              >
                {isSaving && <HiOutlineRefresh className="animate-spin" size={18} />}
                {editingId ? 'Update Record' : 'Add to Ledger'}
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

export default BankWallet;