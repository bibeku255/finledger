import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  collection,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPIN } from '../../utils/cryptoUtils';
import {
  HiOutlinePlus,
  HiOutlineX,
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineLibrary,
  HiOutlineSearch,
  HiOutlineRefresh,
  HiOutlineLockClosed,
  HiOutlineExclamationCircle,
  HiOutlineTrendingUp,
  HiOutlineTrendingDown,
  HiOutlineDownload,
  HiOutlineDocumentText,
  HiOutlineTable,
  HiOutlineCalendar,
  HiOutlineShieldCheck,
  HiOutlineCheckCircle,
  HiOutlineInformationCircle,
  HiCheck,
} from 'react-icons/hi';
import {
  FaGlobe,
  FaUniversity,
  FaShieldAlt,
  FaArrowDown,
  FaArrowUp,
  FaPiggyBank,
} from 'react-icons/fa';

import { fiatFlagMap } from '../../utils/marketConstants';

// ============================================
// 🚀 MINI TOAST SYSTEM (Self-contained)
// ============================================
const ToastContext = React.createContext(null);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };
  const removeToast = id => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-24 right-4 z-[10000] space-y-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 fade-in duration-300 ${
              toast.type === 'success'
                ? 'bg-green-50/95 dark:bg-green-900/90 border-green-200 dark:border-green-700'
                : toast.type === 'error'
                ? 'bg-red-50/95 dark:bg-red-900/90 border-red-200 dark:border-red-700'
                : toast.type === 'warning'
                ? 'bg-amber-50/95 dark:bg-amber-900/90 border-amber-200 dark:border-amber-700'
                : 'bg-blue-50/95 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700'
            }`}
          >
            {toast.type === 'success' && (
              <HiOutlineCheckCircle className="text-green-600 dark:text-green-400 w-5 h-5 flex-shrink-0" />
            )}
            {toast.type === 'error' && (
              <HiOutlineExclamationCircle className="text-red-600 dark:text-red-400 w-5 h-5 flex-shrink-0" />
            )}
            {toast.type === 'warning' && (
              <HiOutlineExclamationCircle className="text-amber-600 dark:text-amber-400 w-5 h-5 flex-shrink-0" />
            )}
            {toast.type === 'info' && (
              <HiOutlineInformationCircle className="text-blue-600 dark:text-blue-400 w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <HiOutlineX size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

// ============================================
// 🧩 CONSTANTS
// ============================================
const bankTransferTypes = [
  'UPI',
  'IMPS',
  'NEFT / RTGS',
  'Wire Transfer / SWIFT',
  'Cheque',
  'Direct Deposit',
];

const getLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// ============================================
// 🧩 SUB COMPONENTS
// ============================================
const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br ${color} text-white shadow-xl group hover:scale-[1.02] transition-all duration-300`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_70%)]" />
    <Icon className="absolute right-[-10%] bottom-[-10%] text-7xl sm:text-8xl opacity-10 group-hover:scale-110 transition-transform duration-500" />
    <div className="relative z-10 flex flex-col h-full">
      <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-80 mb-2">{title}</p>
      <h3 className="text-2xl sm:text-3xl font-black tracking-tight truncate">{value}</h3>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-[10px] sm:text-xs font-bold w-fit px-2 py-1 rounded-lg backdrop-blur-sm bg-white/10 ${trend >= 0 ? 'text-emerald-100' : 'text-rose-100'}`}>
          {trend >= 0 ? <HiOutlineTrendingUp size={14} /> : <HiOutlineTrendingDown size={14} />}
          {Math.abs(trend)}% from last month
        </div>
      )}
      {subtitle && <p className="text-[10px] font-medium opacity-70 mt-2">{subtitle}</p>}
    </div>
  </div>
);

const TickerBar = ({ tickerData, currencySymbol }) => {
  if (!tickerData || tickerData.length === 0) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm mt-6 flex items-center">
      <div className="absolute left-0 z-10 h-full px-4 sm:px-5 flex items-center gap-2 font-black text-[10px] sm:text-xs uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
        <FaGlobe className="text-white/80" /> <span className="hidden sm:inline">Live Fiat</span>
      </div>
      <div className="flex-1 overflow-hidden ml-[80px] sm:ml-[140px] py-3">
        <div className="animate-ticker-scroll flex gap-8 px-4">
          {[...tickerData, ...tickerData, ...tickerData].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 font-bold text-sm cursor-default group shrink-0">
              <img src={`https://flagcdn.com/w40/${fiatFlagMap[item.symbol] || 'un'}.png`} alt={item.symbol} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover shadow-sm group-hover:scale-110 transition-transform" />
              <span className="text-slate-800 dark:text-slate-300 font-black text-xs sm:text-sm">{item.symbol}</span>
              <span className="text-slate-900 dark:text-white font-black text-xs sm:text-sm">
                {currencySymbol}{Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
              <span className={`text-[10px] sm:text-[11px] font-black flex items-center gap-0.5 px-2 py-0.5 rounded-full ${item.change >= 0 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
                {item.change >= 0 ? <HiOutlineTrendingUp size={12} /> : <HiOutlineTrendingDown size={12} />} {Math.abs(item.change)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const BankBadge = ({ bank, currency, amount }) => (
  <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 shrink-0 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 group shadow-sm min-w-[200px]">
    <div className="relative">
      <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
      <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
        <FaUniversity size={18} className="text-white" />
      </div>
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 mb-0.5">
        <img src={`https://flagcdn.com/w40/${fiatFlagMap[currency] || 'un'}.png`} alt="" className="w-3.5 h-3.5 rounded-full object-cover shadow-sm shrink-0" />
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">{bank}</p>
      </div>
      <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate" title={`${amount.toLocaleString()} ${currency}`}>
        {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-500">{currency}</span>
      </p>
    </div>
  </div>
);

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const BankWalletContent = () => {
  const { user, baseCurrency = 'INR', selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  const availableCurrencies = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);

  const [tickerData, setTickerData] = useState([]);

  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [formData, setFormData] = useState({
    title: '', bankName: '', transferType: 'UPI', referenceNo: '', isP2P: false,
    foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '',
    date: getLocalDateTimeString(), isSynced: false,
  });

  // Fetch Live Rates
  useEffect(() => {
    const displayFiats = selectedFiats.filter(f => f !== baseCurrency);
    if (displayFiats.length === 0) { setTickerData([]); return; }
    const fetchTickerData = async () => {
      try {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        if (!res.ok) return;
        const data = await res.json();
        const formattedFiat = displayFiats.map(fiat => {
            const rate = data.rates[fiat];
            return rate ? { symbol: fiat, price: (1 / rate).toFixed(4), change: (Math.random() * 0.5 - 0.25).toFixed(2) } : null;
          }).filter(Boolean);
        setTickerData(formattedFiat);
      } catch (error) {}
    };
    fetchTickerData();
    const interval = setInterval(fetchTickerData, 60000);
    return () => clearInterval(interval);
  }, [baseCurrency, selectedFiats]);

  // Fetch Transactions
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'bankWallet'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setIsLoading(false);
      },
      error => {
        addToast('Failed to load bank transactions. Please refresh.', 'error');
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, addToast]);

  const existingBanks = useMemo(() => Array.from(new Set(transactions.map(t => t.bankName).filter(b => b && b.trim() !== ''))), [transactions]);
  const uniqueCurrenciesCount = useMemo(() => new Set(transactions.map(t => t.currency || baseCurrency)).size, [transactions, baseCurrency]);

  const subWalletBalances = useMemo(() => {
    const balances = {};
    transactions.forEach(t => {
      const curr = t.currency || baseCurrency;
      const bank = t.bankName?.trim() ? t.bankName.trim() : 'Main Vault';
      const key = `${bank.toUpperCase()}_${curr.toUpperCase()}`;
      if (!balances[key]) balances[key] = { bank, currency: curr, value: 0 };
      
      const amt = Number(t.foreignAmount || t.amount || 0);
      const fee = Number(t.fee || 0);
      
      if (t.type === 'in') {
        balances[key].value += amt;
      } else {
        balances[key].value -= (amt + fee);
      }
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
      let feeAmount = t.fee && t.feeExchangeRate ? Number(t.fee) * Number(t.feeExchangeRate) : Number(t.fee || 0);
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
      }).filter(m => m.records.length > 0 || searchTerm === '');
  }, [transactions, searchTerm, filterType, formatGlobalDate]);

  const totalBalance = processedLedger.length > 0 && searchTerm === '' && filterType === 'all'
      ? processedLedger[0].closingBalance
      : transactions.reduce((acc, t) => acc + (t.type === 'in' ? Number(t.finalBaseAmount || t.amount || 0) : -(Number(t.finalBaseAmount || t.amount || 0) + Number(t.fee || 0))), 0);

  const totalInflows = useMemo(() => transactions.filter(t => t.type === 'in').reduce((acc, t) => acc + (Number(t.finalBaseAmount) || 0), 0), [transactions]);

  const totalOutflows = useMemo(() => {
      return transactions.filter(t => t.type === 'out').reduce((acc, t) => {
          let feeAmount = t.fee && t.feeExchangeRate ? Number(t.fee) * Number(t.feeExchangeRate) : Number(t.fee || 0);
          return acc + (Number(t.finalBaseAmount) || 0) + feeAmount;
      }, 0);
  }, [transactions]);

  const handleDownloadReport = async format => {
    setIsExportMenuOpen(false);
    const filteredRecords = processedLedger.flatMap(month => month.records);
    if (filteredRecords.length === 0) { addToast('No bank records found for current filters.', 'warning'); return; }
    setIsGeneratingReport(true);

    const reportData = filteredRecords.map(rec => {
      const isIncome = rec.type === 'in';
      const cleanNote = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, ' ');
      const rawDate = rec.date ? rec.date.split('T')[0] : 'N/A';
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rawDate,
        type: isIncome ? 'Deposit (+)' : 'Withdrawal (-)',
        bankName: rec.bankName || 'Main Bank',
        method: rec.transferType || 'N/A',
        reference: rec.referenceNo || 'N/A',
        grossAmount: Number(rec.finalAmount || 0),
        fee: Number(rec.feeAmount || 0),
        netAmount: Number(rec.netChange || 0),
        notes: cleanNote,
      };
    });

    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Type', key: 'type' }, { header: 'Bank Vault', key: 'bankName' },
      { header: 'Method', key: 'method' }, { header: 'Ref/UTR', key: 'reference' },
      { header: `Gross (${currencySymbol})`, key: 'grossAmount', isNumeric: true },
      { header: `Bank Fee (${currencySymbol})`, key: 'fee', isNumeric: true },
      { header: `Net Impact (${currencySymbol})`, key: 'netAmount', isNumeric: true },
      { header: 'Description', key: 'notes' },
    ];

    const fileName = 'Bank_Vault_Ledger';
    const filterTitle = searchTerm || filterType !== 'all' ? ' (Filtered)' : '';
    const reportTitle = `Bank Vault Ledger${filterTitle}`;

    if (format === 'pdf') { await downloadPDFReport(reportData, columns, fileName, reportTitle, { onSuccess: () => addToast('PDF report downloaded!', 'success'), onError: msg => addToast(`PDF Error: ${msg}`, 'error') }); } 
    else { await downloadExcelReport(reportData, columns, fileName, reportTitle, { onSuccess: () => addToast('Excel report downloaded!', 'success'), onError: msg => addToast(`Excel Error: ${msg}`, 'error') }); }
    setIsGeneratingReport(false);
  };

  const fetchLiveRate = async () => {
    if (formData.currency === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
      const data = await res.json();
      const rate = data.rates[baseCurrency];
      if (rate) setFormData(prev => ({ ...prev, exchangeRate: rate.toFixed(4) }));
      else addToast('Exchange rate not available for selected pair.', 'warning');
    } catch (error) { addToast('Failed to fetch live market rate.', 'error'); } 
    finally { setIsFetchingRate(false); }
  };

  const isForeign = formData.currency !== baseCurrency;
  const grossAmount = (parseFloat(formData.foreignAmount) || 0) * (isForeign ? parseFloat(formData.exchangeRate) || 1 : 1);
  const feeDeduction = parseFloat(formData.fee) || 0;
  const calculatedFinalAmount = grossAmount - feeDeduction;

  const handleSaveEntry = async e => {
    e.preventDefault();
    if (!user) { addToast('Please login first.', 'error'); return; }
    if (!formData.bankName.trim()) { addToast('Please provide a Bank Name (e.g. SBI)', 'warning'); return; }
    setIsSaving(true);
    try {
      if (editingId) {
        if (formData.isSynced) {
          await setDoc(doc(db, 'users', user.uid, 'bankWallet', editingId), { bankName: formData.bankName.trim() }, { merge: true });
        } else {
          const recordData = {
            title: formData.title, bankName: formData.bankName.trim(), transferType: formData.transferType, referenceNo: formData.referenceNo || '',
            isP2P: formData.isP2P || false, date: formData.date, currency: formData.currency, foreignAmount: parseFloat(formData.foreignAmount) || 0,
            exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1, fee: feeDeduction, finalBaseAmount: calculatedFinalAmount,
          };
          await setDoc(doc(db, 'users', user.uid, 'bankWallet', editingId), recordData, { merge: true });
        }
      } else {
        const recordData = {
          title: formData.title, bankName: formData.bankName.trim(), transferType: formData.transferType, referenceNo: formData.referenceNo || '',
          isP2P: formData.isP2P || false, type: 'in', date: formData.date, timestamp: new Date(formData.date).getTime(), currency: formData.currency,
          foreignAmount: parseFloat(formData.foreignAmount) || 0, exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1, fee: feeDeduction, finalBaseAmount: calculatedFinalAmount,
        };
        await addDoc(collection(db, 'users', user.uid, 'bankWallet'), recordData);
      }
      addToast(editingId ? 'Record updated successfully!' : 'Deposit logged to vault!', 'success');
      closeModal();
    } catch (error) { addToast('System Error: Failed to save record.', 'error'); } 
    finally { setIsSaving(false); }
  };

  const handleEdit = rec => {
    const isSyncedEntry = !!(rec.linkedExpenseId || rec.linkedIncomeId || rec.shiftId || rec.linkedPartyId || rec.isGoalLock);
    setFormData({
      title: rec.title || '', bankName: rec.bankName || '', transferType: rec.transferType || 'UPI', referenceNo: rec.referenceNo || '',
      isP2P: rec.isP2P || false, foreignAmount: rec.foreignAmount || rec.amount || '', currency: rec.currency || baseCurrency,
      exchangeRate: rec.exchangeRate || 1, fee: rec.fee || '', date: rec.date || getLocalDateTimeString(), isSynced: isSyncedEntry,
    });
    setEditingId(rec.id); setIsModalOpen(true);
  };

  const initiateDelete = rec => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

  const executeSecureDelete = async e => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError('Please enter your Security PIN.');
    setIsVerifying(true); setPinError('');
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const storedHash = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin;
      const { valid, newHash } = await verifyPIN(pinInput.trim(), storedHash, user.uid);

      if (!valid) { setPinError('Incorrect PIN. Deletion blocked! 🛑'); setIsVerifying(false); return; }
      if (newHash) { await setDoc(doc(db, 'users', user.uid), { security: { pinHash: newHash } }, { merge: true }); }

      await deleteDoc(doc(db, 'users', user.uid, 'bankWallet', deleteContext.id));
      setDeleteContext(null); addToast('Entry deleted successfully.', 'info');
    } catch (error) { setPinError('System error during verification. Try again.'); } 
    finally { setIsVerifying(false); }
  };

  const openModal = () => {
    setEditingId(null);
    const lastBank = existingBanks.length > 0 ? existingBanks[0] : '';
    setFormData({ title: '', bankName: lastBank, transferType: 'UPI', referenceNo: '', isP2P: false, foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '', date: getLocalDateTimeString(), isSynced: false });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

  const LedgerSkeleton = () => (
    <div className="space-y-6 sm:space-y-8">
      {[1, 2].map(i => (
        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm animate-pulse">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
            <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(j => (
              <div key={j} className="flex items-center gap-6">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full h-auto pb-24">
      <div className="pt-20 sm:pt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <style>{`
          @keyframes scrollTicker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
          .animate-ticker-scroll { display: inline-flex; white-space: nowrap; animation: scrollTicker 45s linear infinite; }
          .animate-ticker-scroll:hover { animation-play-state: paused; }
        `}</style>

        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 lg:p-10 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <FaUniversity size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">Bank Ledger</h1>
                <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">Track bank deposits, transfers, and P2P transactions</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:flex-none">
                <button
                  onClick={() => !isGeneratingReport && setIsExportMenuOpen(!isExportMenuOpen)}
                  onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
                  disabled={isGeneratingReport}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 active:scale-95 shadow-sm disabled:opacity-50"
                >
                  {isGeneratingReport ? <><HiOutlineRefresh className="animate-spin" size={18} /> Generating...</> : <><HiOutlineDownload size={18} /> Export</>}
                </button>
                {isExportMenuOpen && !isGeneratingReport && (
                  <div className="absolute top-[110%] right-0 w-full lg:w-48 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl flex flex-col p-1.5 z-50 animate-in fade-in zoom-in-95">
                    <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700 text-slate-200 text-[11px] font-black rounded-xl transition-colors"><HiOutlineDocumentText className="text-rose-400" size={18} /> PDF Document</button>
                    <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700 text-slate-200 text-[11px] font-black rounded-xl transition-colors"><HiOutlineTable className="text-emerald-400" size={18} /> Excel (CSV)</button>
                  </div>
                )}
              </div>

              <button
                onClick={openModal}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/30"
              >
                <HiOutlinePlus size={18} /> Log Deposit
              </button>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-8 pt-6 border-t border-white/10">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5 col-span-2 lg:col-span-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineShieldCheck size={14} /> Total Vault Balance</p>
              <p className="text-xl sm:text-2xl font-black text-white truncate" title={`${currencySymbol}${totalBalance.toLocaleString()}`}>
                {currencySymbol}{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><FaGlobe size={12} /> Currencies</p>
              <p className="text-xl sm:text-2xl font-black text-white">{uniqueCurrenciesCount}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineLibrary size={14} /> Transactions</p>
              <p className="text-xl sm:text-2xl font-black text-white">{transactions.length}</p>
            </div>
          </div>
        </div>

        <TickerBar tickerData={tickerData} currencySymbol={currencySymbol} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <StatCard title="Total Balance" value={`${currencySymbol}${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} icon={FaPiggyBank} color="from-blue-600 to-indigo-600" trend={2.5} />
          <StatCard title="Total Deposits" value={`${currencySymbol}${totalInflows.toLocaleString(undefined, { minimumFractionDigits: 0 })}`} icon={HiOutlineTrendingUp} color="from-emerald-500 to-teal-600" />
          <StatCard title="Total Withdrawals" value={`${currencySymbol}${totalOutflows.toLocaleString(undefined, { minimumFractionDigits: 0 })}`} icon={HiOutlineTrendingDown} color="from-rose-500 to-pink-600" />
          <StatCard title="Active Banks" value={existingBanks.length} icon={FaUniversity} color="from-purple-500 to-violet-600" subtitle="Connected institutions" />
        </div>

        {subWalletBalances.length > 0 && (
          <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FaUniversity className="text-blue-500" /> Bank Holdings by Currency</h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3">
              {subWalletBalances.map((item, idx) => (
                <BankBadge key={idx} bank={item.bank} currency={item.currency} amount={item.value} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search by details, bank, or reference..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full sm:w-auto px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 cursor-pointer transition-all uppercase tracking-widest"
            >
              <option value="all">All Records</option>
              <option value="p2p">⚠️ P2P Only</option>
              <option value="in">Deposits (+)</option>
              <option value="out">Withdrawals (-)</option>
            </select>
          </div>
        </div>

        {/* 🚀 LEDGER WITH MOBILE-FRIENDLY CARDS (NO TEXT CLIPPING) */}
        {isLoading ? (
          <LedgerSkeleton />
        ) : processedLedger.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm px-4 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-5 shadow-inner">
              <FaUniversity className="text-5xl text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-lg font-black text-slate-700 dark:text-slate-300">No bank records found</p>
            <p className="text-sm font-medium text-slate-500 mt-2 text-center max-w-sm">
              {searchTerm || filterType !== 'all' ? 'Try adjusting your search or filters.' : 'Log your first deposit to get started with your digital vault.'}
            </p>
            {!searchTerm && filterType === 'all' && (
              <button onClick={openModal} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95">Log Deposit Now</button>
            )}
          </div>
        ) : (
          processedLedger.map(month => (
            <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5 truncate">
                  <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                    <HiOutlineCalendar size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="truncate">{month.monthName}</span>
                </h2>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Opening</p>
                  <p className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">{currencySymbol}{month.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* ========== MOBILE CARDS (NO TRUNCATION, FULL TEXT WRAP) ========== */}
              <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                {month.records.map(rec => {
                  const dateObj = new Date(rec.date);
                  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={rec.id} className={`p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col gap-3 group ${rec.isP2P ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                      {/* Top row: type icon + title + bank/transfer + net change */}
                      <div className="flex justify-between items-start gap-2 w-full">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${rec.type === 'in' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                            {rec.type === 'in' ? <FaArrowDown size={16} /> : <FaArrowUp size={16} />}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-black text-sm sm:text-base text-slate-800 dark:text-white break-words" title={rec.title}>
                                {rec.title}
                              </h3>
                              {rec.isP2P && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 border border-amber-200 dark:border-amber-500/30 shrink-0">
                                  <FaShieldAlt size={8} /> P2P
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 break-words flex flex-wrap items-center gap-x-1.5">
                              <FaUniversity className="shrink-0" />
                              <span className="text-slate-700 dark:text-slate-300 font-black">{rec.bankName || 'Main Bank'}</span>
                              <span className="opacity-50 shrink-0">•</span>
                              <span>{rec.transferType || 'Transfer'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-2">
                          <p className={`text-base sm:text-lg font-black tracking-tight whitespace-nowrap ${rec.netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {rec.netChange >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(rec.netChange).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </p>
                          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest whitespace-nowrap">Net Change</p>
                        </div>
                      </div>

                      {/* Gross Amount + Fee */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 flex flex-row justify-between items-center border border-slate-200 dark:border-slate-800/50 mt-1 gap-2">
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <div className="min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Gross Amount</p>
                            <p className="font-black text-slate-800 dark:text-slate-200 text-xs sm:text-sm break-words">
                              {rec.currency !== baseCurrency 
                                ? `${(rec.foreignAmount || 0).toLocaleString()} ${rec.currency}` 
                                : `${currencySymbol}${(rec.finalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                            </p>
                            {rec.currency !== baseCurrency && (
                              <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 break-words">≈ {currencySymbol}{rec.finalAmount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                            )}
                          </div>
                          {rec.feeAmount > 0 && (
                            <div className="border-l border-slate-300 dark:border-slate-700 pl-2 sm:pl-4 shrink-0">
                              <p className="text-[9px] sm:text-[10px] font-black text-rose-500 uppercase tracking-widest mb-0.5">Bank Fee</p>
                              <p className="font-black text-rose-600 dark:text-rose-400 text-xs sm:text-sm truncate">-{currencySymbol}{rec.feeAmount.toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Date, Reference & Actions */}
                      <div className="flex items-end justify-between mt-1">
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 w-fit shrink-0">
                            <HiOutlineCalendar size={12} className="text-slate-500 shrink-0" /> 
                            <span className="whitespace-nowrap">{formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}</span> 
                            <span className="opacity-50 ml-1 whitespace-nowrap">{timeStr}</span>
                          </p>
                          {rec.referenceNo && (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded w-fit uppercase tracking-widest border border-slate-200 dark:border-slate-700 break-words max-w-full">
                              Ref: {rec.referenceNo}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                          <button onClick={() => handleEdit(rec)} className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg sm:rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors border border-blue-200 dark:border-blue-500/30 active:scale-95 shadow-sm">
                            <HiOutlinePencil size={14} className="sm:w-[16px] sm:h-[16px]"/>
                          </button>
                          <button onClick={() => initiateDelete(rec)} className="p-2 sm:p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg sm:rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border border-rose-200 dark:border-rose-500/30 active:scale-95 shadow-sm">
                            <HiOutlineTrash size={14} className="sm:w-[16px] sm:h-[16px]"/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ========== DESKTOP TABLE (unchanged) ========== */}
              <div className="hidden md:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4 pl-6 w-20">Type</th>
                      <th className="p-4">Details</th>
                      <th className="p-4 text-right">Gross Amount</th>
                      <th className="p-4 text-right">Net Change</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {month.records.map(rec => {
                      const dateObj = new Date(rec.date);
                      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group ${rec.isP2P ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                          <td className="p-4 pl-6">
                            <div className={`w-10 h-10 rounded-[0.8rem] flex items-center justify-center shadow-sm ${rec.type === 'in' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                              {rec.type === 'in' ? <FaArrowDown size={14} /> : <FaArrowUp size={14} />}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-start gap-3.5">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${rec.isP2P ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20'}`}>
                                {rec.isP2P ? <FaShieldAlt size={14} /> : <FaUniversity size={14} />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2 truncate">
                                  {rec.title}
                                  {rec.isP2P && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 border border-amber-200 dark:border-amber-500/30"><FaShieldAlt size={8}/> P2P</span>
                                  )}
                                </p>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">
                                  <span className="text-slate-700 dark:text-slate-300 font-black">{rec.bankName || 'Main Bank'}</span> • {rec.transferType || 'Transfer'}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                    {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}
                                    <span className="opacity-50 mx-1">•</span>{timeStr}
                                  </p>
                                  {rec.referenceNo && (
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[120px]">Ref: {rec.referenceNo}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right align-top">
                            <p className="font-black text-slate-800 dark:text-slate-200">
                              {rec.currency !== baseCurrency 
                                ? `${(rec.foreignAmount || 0).toLocaleString()} ${rec.currency}`
                                : `${currencySymbol}${(rec.finalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                              }
                            </p>
                            {rec.currency !== baseCurrency && (
                              <p className="text-[10px] font-bold text-slate-500 mt-1">≈ {currencySymbol}{rec.finalAmount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                            )}
                            {rec.feeAmount > 0 && (
                              <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1">Fee: -{currencySymbol}{rec.feeAmount.toLocaleString()}</p>
                            )}
                          </td>
                          <td className="p-4 text-right align-top">
                            <p className={`text-base font-black ${rec.netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {rec.netChange >= 0 ? '+' : ''}{currencySymbol}{rec.netChange.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </p>
                          </td>
                          <td className="p-4 pr-6 align-top">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleEdit(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-all active:scale-95 shadow-sm border border-slate-200 dark:border-slate-700">
                                <HiOutlinePencil size={14} />
                              </button>
                              <button onClick={() => initiateDelete(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-all active:scale-95 shadow-sm border border-slate-200 dark:border-slate-700">
                                <HiOutlineTrash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-5 sm:px-6 py-4 sm:py-5 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/30">
                <div className="text-right bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Closing Balance</p>
                  <p className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-400 whitespace-nowrap">
                    {currencySymbol}{month.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD/EDIT MODAL (unchanged) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-6 sm:px-8 py-4 sm:py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center shrink-0">
              <h3 className="text-lg sm:text-xl font-black flex items-center gap-2">
                <FaUniversity size={20} className="sm:w-[24px] sm:h-[24px]" /> {editingId ? 'Edit Record' : 'Log Deposit'}
              </h3>
              <button onClick={closeModal} className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors active:scale-90">
                <HiOutlineX size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 pb-2">
              {formData.isSynced && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-2xl shadow-sm mb-2">
                  <p className="text-[10px] sm:text-xs font-bold text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <HiOutlineExclamationCircle size={18} className="shrink-0 mt-0.5" />
                    <span className="leading-relaxed">Auto-synced entry. To maintain ledger accuracy, you can only update the Bank Name here.</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Bank Name *</label>
                  <input type="text" list="bank-names" required value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} placeholder="e.g., SBI, Chase" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" />
                  <datalist id="bank-names">
                    {existingBanks.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Method</label>
                  <select disabled={formData.isSynced} value={formData.transferType} onChange={e => setFormData({ ...formData, transferType: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 cursor-pointer transition-all shadow-sm">
                    {bankTransferTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Description *</label>
                <input disabled={formData.isSynced} type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Salary, Client Payment" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 transition-all shadow-sm" />
              </div>

              <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all shadow-sm ${formData.isSynced ? 'opacity-60 pointer-events-none' : 'cursor-pointer'} ${formData.isP2P ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-500/50' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'}`}>
                <div className="relative flex items-center justify-center mt-0.5">
                  <input disabled={formData.isSynced} type="checkbox" checked={formData.isP2P} onChange={e => setFormData({ ...formData, isP2P: e.target.checked })} className="sr-only" />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${formData.isP2P ? 'bg-amber-500 border-amber-500' : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900'}`}>
                    {formData.isP2P && <HiCheck size={14} className="text-white" />}
                  </div>
                </div>
                <div>
                  <p className={`font-black text-sm ${formData.isP2P ? 'text-amber-800 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>Tag as P2P / Crypto Origin</p>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">Isolate for tax and risk monitoring</p>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Currency</label>
                  <select disabled={formData.isSynced} value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : '', })} className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 cursor-pointer transition-all shadow-sm">
                    {availableCurrencies.map(c => <option key={c} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Amount *</label>
                  <input disabled={formData.isSynced} type="number" step="any" required value={formData.foreignAmount} onChange={e => setFormData({ ...formData, foreignAmount: e.target.value })} placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 transition-all shadow-sm" />
                </div>
              </div>

              {formData.currency !== baseCurrency && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest">Exchange Rate</label>
                    <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate || formData.isSynced} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 shadow-sm active:scale-95 transition-all">
                      <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={12} /> Live Rate
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300 shrink-0">1 {formData.currency} =</span>
                    <input disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} onChange={e => setFormData({ ...formData, exchangeRate: e.target.value, })} className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none disabled:opacity-60 transition-colors shadow-sm" />
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300 shrink-0">{baseCurrency}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Bank Fee (Opt)</label>
                  <input disabled={formData.isSynced} type="number" step="any" value={formData.fee} onChange={e => setFormData({ ...formData, fee: e.target.value })} placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 transition-all shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Ref / UTR (Opt)</label>
                  <input disabled={formData.isSynced} type="text" value={formData.referenceNo} onChange={e => setFormData({ ...formData, referenceNo: e.target.value })} placeholder="e.g., UTR123" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 transition-all shadow-sm" />
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner mt-2">
                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
                  <span>Gross Deposit:</span>
                  <span className="font-black">{currencySymbol}{grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm font-bold text-rose-500 mt-2">
                  <span>Deductions:</span>
                  <span className="font-black">-{currencySymbol}{feeDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-300 dark:border-slate-600">
                  <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Net Credit:</span>
                  <span className="text-xl font-black text-blue-600 dark:text-blue-400">{currencySymbol}{calculatedFinalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                   <span>Date & Time *</span>
                   <span className="text-blue-500">{formatGlobalDate && formData.date ? formatGlobalDate(formData.date.split('T')[0], 'short') : ''}</span>
                </label>
                <input disabled={formData.isSynced} type="datetime-local" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 transition-all shadow-sm cursor-pointer" />
              </div>

              <div className="sticky bottom-0 pt-3 pb-1 bg-white dark:bg-slate-900 z-10 border-t border-slate-100 dark:border-slate-800 mt-4 sm:mt-0 sm:border-none">
                <button type="submit" disabled={isSaving} className={`w-full p-4 sm:p-5 rounded-2xl font-black text-sm uppercase tracking-widest text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 ${formData.isP2P ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30'}`}>
                  {isSaving ? <HiOutlineRefresh className="animate-spin" size={20} /> : <FaUniversity size={16} />}
                  {isSaving ? 'Processing...' : editingId ? 'Update Ledger' : 'Log Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL (unchanged) */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border border-rose-200 dark:border-rose-800 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                  <HiOutlineShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">Security Verification</h3>
                  <p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest">Permanent Deletion</p>
                </div>
              </div>
            </div>

            <form onSubmit={executeSecureDelete} className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-2xl shadow-sm">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed">
                  You are deleting <span className="font-black">"{deleteContext.title}"</span> worth <span className="font-black"> {currencySymbol}{deleteContext.finalBaseAmount?.toLocaleString()}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 text-center block">Security PIN</label>
                <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full text-center tracking-[0.4em] text-2xl p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm placeholder-slate-400" placeholder="••••" />
                {pinError && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-2 text-center animate-bounce">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors shadow-sm active:scale-95 uppercase tracking-widest">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 active:scale-95 uppercase tracking-widest">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : <HiOutlineTrash size={18} />} Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const BankWallet = () => (
  <ToastProvider>
    <BankWalletContent />
  </ToastProvider>
);

export default BankWallet;