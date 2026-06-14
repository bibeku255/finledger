// src/pages/accounts/OnlineWallet.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  collection, addDoc, doc, setDoc, deleteDoc,
  getDocs, query, where, documentId, getDoc
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPINEnhanced } from '../../utils/securityUtils';
import { useToast } from '../../hooks/useToastNotification';

// ✅ IMPORTING ENTERPRISE HOOKS
import { useSecureSnapshot } from '../../hooks/useSecureSnapshot';
import { usePaginatedMonthlyLogs } from '../../hooks/usePaginatedMonthlyLogs';

import {
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineLibrary, HiOutlineSearch, HiOutlineRefresh,
  HiOutlineExclamationCircle, HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineCalendar, HiOutlineShieldCheck, HiOutlineGlobe,
  HiOutlineCheckCircle, HiOutlineInformationCircle, HiOutlineChevronDown,
  HiOutlineArrowDown, HiOutlineArrowUp, HiCheck,
} from 'react-icons/hi';
import {
  FaGlobe, FaWallet, FaShieldAlt, FaArrowDown, FaArrowUp,
} from 'react-icons/fa';
import { fiatFlagMap } from '../../utils/marketConstants';

// ============================================
// 🧩 HELPER
// ============================================
const getLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// 🚀 ENTERPRISE ENGINE: Automatically syncs perfect math to a summary document
const syncOnlineSummary = async (userId, baseCurr) => {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'onlineWallet'));
    const logs = snap.docs.map(d => d.data());

    let totalBalance = 0, totalFees = 0, totalInflows = 0, totalOutflows = 0;
    const balances = {};

    logs.forEach(t => {
      const curr = t.currency || baseCurr;
      const wallet = t.walletName?.trim() ? t.walletName.trim() : 'Main Wallet';
      const key = `${wallet.toUpperCase()}_${curr.toUpperCase()}`;
      if (!balances[key]) balances[key] = { wallet, currency: curr, value: 0 };

      const finalAmount = Number(t.finalBaseAmount || t.amount || 0);
      const grossForeign = Number(t.foreignAmount !== undefined ? t.foreignAmount : (t.amount !== undefined ? t.amount : finalAmount));
      const foreignFee = Number(t.foreignFee !== undefined ? t.foreignFee : (t.currency !== baseCurr ? (t.fee || 0) / (t.exchangeRate || 1) : (t.fee || 0)));
      const baseFee = Number(t.fee || 0);
      const rawType = (t.type || '').toLowerCase();

      if (rawType === 'out' || rawType === 'expense') {
        const feeType = (t.feeType || 'inclusive').toLowerCase();
        const deductForeign = feeType === 'exclusive' ? grossForeign + foreignFee : grossForeign;
        const deductBase = feeType === 'exclusive' ? finalAmount + baseFee : finalAmount;

        totalOutflows += deductBase;
        totalBalance -= deductBase;
        balances[key].value -= deductForeign;
      } else {
        totalInflows += finalAmount;
        totalBalance += finalAmount;
        balances[key].value += (grossForeign - foreignFee);
      }
      totalFees += baseFee;
    });

    const subWalletBalances = Object.values(balances)
      .filter(b => Math.abs(b.value) > 0.01)
      .sort((a, b) => b.value - a.value);

    const existingWallets = Array.from(new Set(logs.map(t => t.walletName).filter(w => w && w.trim() !== '')));
    const uniqueCurrenciesCount = new Set(logs.map(t => t.currency || baseCurr)).size;

    const summaryData = {
      totalBalance, totalFees, totalInflows, totalOutflows,
      existingWallets, uniqueCurrenciesCount, subWalletBalances,
      totalLogs: logs.length, lastUpdated: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', userId, 'walletSummary', 'online'), summaryData, { merge: true });
    return summaryData;
  } catch (error) {
    console.error("Failed to sync online summary:", error);
    return null;
  }
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
      <div className="absolute left-0 z-10 h-full px-4 sm:px-5 flex items-center gap-2 font-black text-[10px] sm:text-xs uppercase tracking-widest bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
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
                {item.change >= 0 ? <HiOutlineTrendingUp size={12} /> : <HiOutlineTrendingDown size={12} />}{Math.abs(item.change)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const WalletBadge = ({ wallet, currency, amount }) => (
  <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 shrink-0 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 group shadow-sm min-w-[200px]">
    <div className="relative">
      <div className="absolute inset-0 bg-indigo-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
      <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
        <FaWallet size={18} className="text-white" />
      </div>
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 mb-0.5">
        <img src={`https://flagcdn.com/w40/${fiatFlagMap[currency] || 'un'}.png`} alt="" className="w-3.5 h-3.5 rounded-full object-cover shadow-sm shrink-0" />
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">{wallet}</p>
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
const OnlineWalletContent = () => {
  const { user, baseCurrency = 'INR', selectedFiats = [], formatGlobalDate, getCalendarMonthKey } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  const availableCurrencies = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);

  const getCurrentMonthKey = () => {
    try { return getCalendarMonthKey(new Date().toISOString()); }
    catch { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  };

  const [openMonths, setOpenMonths] = useState(new Set([getCurrentMonthKey()]));
  const toggleMonth = useCallback((monthKey) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const toggleExpandMonth = useCallback((monthKey) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  // 🚀 1. THE FAST MATH ENGINE
  const [globalSummary, setGlobalSummary] = useState({
    totalBalance: 0, totalFees: 0, totalInflows: 0, totalOutflows: 0,
    existingWallets: [], uniqueCurrenciesCount: 0, subWalletBalances: [], totalLogs: 0
  });

  const summaryQuery = useMemo(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'walletSummary'), where(documentId(), '==', 'online'));
  }, [user?.uid]);

  const { data: summaryDataArray, loading: isSummaryLoading } = useSecureSnapshot(summaryQuery);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (isSummaryLoading) return;
    if (summaryDataArray && summaryDataArray.length > 0) {
      setGlobalSummary(summaryDataArray[0]);
    } else if (summaryDataArray?.length === 0 && user?.uid && !isSyncingRef.current) {
      isSyncingRef.current = true;
      syncOnlineSummary(user.uid, baseCurrency).then(data => {
        if (data) setGlobalSummary(data);
        isSyncingRef.current = false;
      });
    }
  }, [summaryDataArray, isSummaryLoading, user?.uid, baseCurrency]);

  // 🚀 2. TRUE FIRESTORE PAGINATION HOOK
  const {
    months: paginatedMonths,
    loading: isLoadingLogs,
    isPaginating,
    hasMore,
    loadMore,
    refresh: refreshTransactions
  } = usePaginatedMonthlyLogs(user?.uid, 'onlineWallet', 20, !!user, getCalendarMonthKey);

  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [tickerData, setTickerData] = useState([]);
  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const getInitialFormData = (defaultWallet = '') => ({
    title: '', walletName: defaultWallet, referenceNo: '', isP2P: false,
    foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '',
    date: getLocalDateTimeString(), isSynced: false,
  });

  const [formData, setFormData] = useState(getInitialFormData());

  // Ticker data fetch
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
      } catch (error) { console.error('Failed to fetch fiat ticker'); }
    };
    fetchTickerData();
    const interval = setInterval(fetchTickerData, 300000);
    return () => clearInterval(interval);
  }, [baseCurrency, selectedFiats]);

  // 🚀 3. LOCAL UI FILTERING & CALENDAR FIX
  const filteredLedger = useMemo(() => {
    if (!paginatedMonths) return [];
    
    return paginatedMonths.map(month => {
      const sampleDate = month.records?.[0]?.date || new Date();
      const localizedMonthName = formatGlobalDate 
        ? formatGlobalDate(sampleDate, 'monthYear') 
        : month.monthName;

      const filteredRecords = month.records.filter(r => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (r.title?.toLowerCase().includes(term) || r.walletName?.toLowerCase().includes(term) || r.referenceNo?.toLowerCase().includes(term));
        const matchesType = filterType === 'all' || r.type === filterType || (filterType === 'out' && (r.type === 'out' || r.type === 'expense')) || (filterType === 'p2p' && r.isP2P);
        return matchesSearch && matchesType;
      });

      let pageIn = 0, pageOut = 0;
      filteredRecords.forEach(r => {
        // ✅ BUG FIX: Changed 'actualDeduct' and 'finalAmount' to proper Firebase mappings
        const netAmt = Number(r.finalBaseAmount || r.amount || 0);
        if (r.type === 'out' || r.type === 'expense') pageOut += netAmt;
        else pageIn += netAmt;
      });

      return { 
        ...month, 
        monthName: localizedMonthName, 
        records: filteredRecords, 
        pageIn, 
        pageOut 
      };
    }).filter(m => m.records.length > 0);
  }, [paginatedMonths, searchTerm, filterType, formatGlobalDate]);

  // ✅ EXPORT HANDLERS
  const handleExportPDF = async () => {
    setIsExportModalOpen(false);
    setIsGeneratingPDF(true);

    const recordsToExport = filteredLedger.flatMap(month => month.records);
    if (recordsToExport.length === 0) {
      addToast('No records found to export.', 'warning');
      setIsGeneratingPDF(false);
      return;
    }

    const reportData = recordsToExport.map(rec => {
      const isOut = rec.type === 'out' || rec.type === 'expense';
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date?.split('T')[0],
        type: isOut ? 'Withdrawal (-)' : 'Deposit (+)',
        platform: rec.walletName || 'Main Wallet',
        fiatFlow: `${Number(rec.foreignAmount || 0).toLocaleString()} ${rec.currency || baseCurrency}`,
        fee: Number(rec.fee || 0), // ✅ BUG FIX
        netImpact: Number(rec.finalBaseAmount || rec.amount || 0), // ✅ BUG FIX
        notes: (rec.title || '').replace(/(\r\n|\n|\r)/gm, ' '),
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Platform / Wallet', key: 'platform' },
      { header: 'Fiat Amount', key: 'fiatFlow' },
      { header: `Fee (${currencySymbol})`, key: 'fee', isNumeric: true },
      { header: `Net Value (${currencySymbol})`, key: 'netImpact', isNumeric: true },
      { header: 'Details', key: 'notes' },
    ];

    try {
      await downloadPDFReport(reportData, columns, 'Online_Wallet_Ledger', 'Digital Fiat Wallet Audit', {
        onSuccess: () => addToast('PDF report downloaded!', 'success'),
        onError: (msg) => addToast(`PDF Error: ${msg}`, 'error'),
      });
    } catch (err) {
      addToast(`PDF export failed: ${err.message}`, 'error');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExportModalOpen(false);
    setIsGeneratingExcel(true);

    const recordsToExport = filteredLedger.flatMap(month => month.records);
    if (recordsToExport.length === 0) {
      addToast('No records found to export.', 'warning');
      setIsGeneratingExcel(false);
      return;
    }

    const reportData = recordsToExport.map(rec => {
      const isOut = rec.type === 'out' || rec.type === 'expense';
      return {
        Date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date?.split('T')[0],
        Type: isOut ? 'Withdrawal' : 'Deposit',
        Platform: rec.walletName || 'Main Wallet',
        FiatAmount: `${Number(rec.foreignAmount || 0).toLocaleString()} ${rec.currency || baseCurrency}`,
        Fee: (rec.fee || 0).toFixed(2), // ✅ BUG FIX
        NetValue: (rec.finalBaseAmount || rec.amount || 0).toFixed(2), // ✅ BUG FIX
        Notes: (rec.title || '').replace(/(\r\n|\n|\r)/gm, ' '),
      };
    });

    const headers = Object.keys(reportData[0]);
    const csvRows = [headers.join(',')];
    for (const row of reportData) {
      const values = headers.map(header => {
        const val = row[header];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Online_Wallet_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Excel (CSV) report downloaded!', 'success');
    setIsGeneratingExcel(false);
  };

  const fetchLiveRate = async () => {
    if (formData.currency === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
      const data = await res.json();
      if (data.rates[baseCurrency]) setFormData(prev => ({ ...prev, exchangeRate: data.rates[baseCurrency].toFixed(4) }));
      else addToast('Rate not available.', 'warning');
    } catch (error) { addToast('Failed to fetch rate.', 'error'); }
    finally { setIsFetchingRate(false); }
  };

  const isForeign = formData.currency !== baseCurrency;
  const grossAmountNative = parseFloat(formData.foreignAmount) || 0;
  const feeNative = parseFloat(formData.fee) || 0;
  const exchangeRate = isForeign ? (parseFloat(formData.exchangeRate) || 1) : 1;
  const calculatedFinalAmount = (grossAmountNative - feeNative) * exchangeRate;

  const handleSaveEntry = async e => {
    e.preventDefault();
    if (!user) { addToast('Please login first.', 'error'); return; }
    if (!formData.walletName.trim()) { addToast('Please provide a Wallet Name', 'warning'); return; }
    
    setIsSaving(true);
    try {
      const inputForeign = parseFloat(formData.foreignAmount) || 0;
      const inputFee = parseFloat(formData.fee) || 0;
      const inputExRate = isForeign ? (parseFloat(formData.exchangeRate) || 1) : 1;

      const freshGrossBase = inputForeign * inputExRate;
      const freshFeeBase = inputFee * inputExRate;
      const freshFinalBase = freshGrossBase - freshFeeBase;

      const recordData = {
        title: formData.title, walletName: formData.walletName.trim(), walletCategory: 'Fiat E-Wallet',
        referenceNo: formData.referenceNo || '', isP2P: formData.isP2P || false, date: formData.date,
        currency: formData.currency, foreignAmount: inputForeign, foreignFee: inputFee,
        fee: freshFeeBase, exchangeRate: inputExRate, finalBaseAmount: freshFinalBase,
        vaultId: 'online_' + formData.walletName.trim().toUpperCase(),
      };

      if (editingId) {
        if (formData.isSynced) {
          await setDoc(doc(db, 'users', user.uid, 'onlineWallet', editingId), {
            walletName: formData.walletName.trim(), vaultId: 'online_' + formData.walletName.trim().toUpperCase()
          }, { merge: true });
        } else {
          await setDoc(doc(db, 'users', user.uid, 'onlineWallet', editingId), recordData, { merge: true });
        }
      } else {
        await addDoc(collection(db, 'users', user.uid, 'onlineWallet'), { ...recordData, type: 'in', timestamp: new Date(formData.date).getTime() });
      }

      await syncOnlineSummary(user.uid, baseCurrency);
      refreshTransactions();
      
      addToast(editingId ? 'Deposit updated!' : 'E-Deposit logged!', 'success');
      closeModal();
    } catch (error) { addToast('Failed to save record.', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleEdit = rec => {
    const isSyncedEntry = !!(rec.linkedExpenseId || rec.linkedIncomeId || rec.shiftId || rec.linkedPartyId);
    setFormData({
      title: rec.title || '', walletName: rec.walletName || '', referenceNo: rec.referenceNo || '', isP2P: rec.isP2P || false,
      foreignAmount: rec.foreignAmount || rec.amount || '', currency: rec.currency || baseCurrency,
      exchangeRate: rec.exchangeRate || 1, fee: rec.foreignFee !== undefined ? rec.foreignFee : (rec.currency !== baseCurrency ? (rec.fee || 0) / (rec.exchangeRate || 1) : rec.fee || ''),
      date: rec.date || getLocalDateTimeString(), isSynced: isSyncedEntry,
    });
    setEditingId(rec.id); setIsModalOpen(true);
  };

  const initiateDelete = rec => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

  const executeSecureDelete = async e => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError('Enter Security PIN.');
    setIsVerifying(true); setPinError('');
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const storedHash = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin;
      const { valid, newHash } = await verifyPINEnhanced(pinInput.trim(), storedHash, user.uid);
      if (!valid) { setPinError('Incorrect PIN.'); setIsVerifying(false); return; }
      if (newHash) await setDoc(doc(db, 'users', user.uid), { security: { pinHash: newHash } }, { merge: true });

      await deleteDoc(doc(db, 'users', user.uid, 'onlineWallet', deleteContext.id));
      
      await syncOnlineSummary(user.uid, baseCurrency);
      refreshTransactions();
      
      setDeleteContext(null); addToast('Entry deleted.', 'info');
    } catch (error) { setPinError('System error.'); }
    finally { setIsVerifying(false); }
  };

  const openModal = () => {
    setFormData(getInitialFormData(globalSummary.existingWallets?.[0] || ''));
    setEditingId(null); setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

  const LedgerSkeleton = () => (
    <div className="space-y-6 sm:space-y-8">
      {[1, 2].map(i => (
        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm animate-pulse">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50"><div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" /></div>
          <div className="p-6 space-y-4">
            {[1, 2].map(j => (
              <div key={j} className="flex items-center gap-6">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2"><div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg" /></div>
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
        <style>{`@keyframes scrollTicker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } } .animate-ticker-scroll { display: inline-flex; white-space: nowrap; animation: scrollTicker 45s linear infinite; } .animate-ticker-scroll:hover { animation-play-state: paused; }`}</style>

        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-800 p-6 sm:p-8 lg:p-10 shadow-2xl border border-purple-400/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.15),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                <FaWallet size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">Digital Vault</h1>
                <p className="text-xs sm:text-sm font-medium text-purple-100 mt-1">Manage e‑wallet assets and routing logs</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              
              <button
                onClick={() => setIsExportModalOpen(true)}
                disabled={isGeneratingPDF || isGeneratingExcel}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 active:scale-95 shadow-sm disabled:opacity-50"
              >
                {isGeneratingPDF || isGeneratingExcel ? (
                  <><HiOutlineRefresh className="animate-spin" size={18} /> Generating...</>
                ) : (
                  <><HiOutlineDownload size={18} /> Export</>
                )}
              </button>

              <button onClick={openModal} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/30">
                <HiOutlinePlus size={18} /> Log Deposit
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-white/20">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 col-span-2 lg:col-span-1">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineShieldCheck size={14} /> Total Net Balance</p>
              <p className="text-xl sm:text-2xl font-black text-white truncate">{currencySymbol}{(globalSummary.totalBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineExclamationCircle size={14} /> Total Fees Paid</p>
              <p className="text-xl sm:text-2xl font-black text-rose-300 truncate">-{currencySymbol}{(globalSummary.totalFees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mb-1"><FaGlobe size={12} /> Currencies</p>
              <p className="text-xl sm:text-2xl font-black text-white">{globalSummary.uniqueCurrenciesCount || 1}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineLibrary size={14} /> Global Logs</p>
              <p className="text-xl sm:text-2xl font-black text-white">{globalSummary.totalLogs || 0}</p>
            </div>
          </div>
        </div>

        <TickerBar tickerData={tickerData} currencySymbol={currencySymbol} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <StatCard title="Total Deposits" value={`${currencySymbol}${(globalSummary.totalInflows || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`} icon={FaArrowDown} color="from-emerald-500 to-teal-600" subtitle="Gross money added" />
          <StatCard title="Total Withdrawn" value={`${currencySymbol}${(globalSummary.totalOutflows || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`} icon={HiOutlineArrowUp} color="from-rose-500 to-pink-600" subtitle="Includes Shifts & Expenses" />
          <StatCard title="Active Wallets" value={globalSummary.existingWallets?.length || 0} icon={FaWallet} color="from-blue-500 to-indigo-600" subtitle="Connected platforms" />
        </div>

        {globalSummary.subWalletBalances?.length > 0 && (
          <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FaWallet className="text-purple-500" /> E-Wallet Holdings by Currency</h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3">
              {globalSummary.subWalletBalances.map((item, idx) => (<WalletBadge key={idx} wallet={item.wallet} currency={item.currency} amount={item.value} />))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search platforms or details..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-14 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-purple-500 transition-all placeholder-slate-400 dark:placeholder-slate-500" />
          </div>
          <div className="flex gap-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full sm:w-auto px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 cursor-pointer transition-all uppercase tracking-widest">
              <option value="all">All Records</option>
              <option value="p2p">⚠️ P2P Only</option>
              <option value="in">Deposits (+)</option>
              <option value="out">Withdrawals/Shifts (-)</option>
            </select>
          </div>
        </div>

        {/* 🚀 TRUE INFINITE SCROLL LEDGER */}
        {isLoadingLogs ? <LedgerSkeleton /> : filteredLedger.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm px-4 text-center animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-5"><FaWallet className="text-5xl text-slate-300 dark:text-slate-600" /></div>
            <h3 className="text-xl font-black text-slate-700 dark:text-slate-300 mb-2">No Digital Fiat Records Found</h3>
            <p className="text-sm font-medium text-slate-500 mt-2 text-center max-w-sm">Log or check your PayPal, Airtm, or ZebPay records here.</p>
          </div>
        ) : (
          <>
            {filteredLedger.map(month => {
              const isOpen = openMonths.has(month.monthKey);
              const isExpanded = expandedMonths.has(month.monthKey);
              const THRESHOLD = 15;
              const hasMoreRecords = month.records.length > THRESHOLD;
              const hiddenCount = Math.max(0, month.records.length - THRESHOLD);
              const displayedRecords = isExpanded ? month.records : month.records.slice(0, THRESHOLD);
              const pageNet = month.pageIn - month.pageOut;

              return (
                <div key={month.monthKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm mb-4">
                  <button onClick={() => toggleMonth(month.monthKey)} className="w-full px-6 py-5 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left">
                    <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="p-2 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg"><HiOutlineCalendar size={18} /></div>
                      {month.monthName}
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Period Net Change</p>
                        <p className={`text-sm font-black ${pageNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pageNet > 0 ? '+' : ''}{currencySymbol}{pageNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <HiOutlineChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="animate-in fade-in duration-200">
                      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800">
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Logs Shown</p><p className="font-black text-slate-700 dark:text-slate-300">{month.records.length}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page Deposits (+)</p><p className="font-black text-emerald-600">+{currencySymbol}{month.pageIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page Withdrawals (-)</p><p className="font-black text-rose-600">-{currencySymbol}{month.pageOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Period Net Change</p><p className={`font-black ${pageNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pageNet > 0 ? '+' : ''}{currencySymbol}{pageNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                      </div>

                      <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                        {displayedRecords.map(rec => {
                          const dateObj = new Date(rec.date);
                          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const isOut = rec.type === 'out' || rec.type === 'expense';
                          
                          // ✅ FIXED VARIABLES
                          const netAmt = Number(rec.finalBaseAmount || rec.amount || 0);
                          const displayFee = Number(rec.fee || 0);
                          const netChangeText = isOut ? `-${currencySymbol}${netAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}` : `+${currencySymbol}${netAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
                          
                          return (
                            <div key={rec.id} className={`p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col gap-3 group ${rec.isP2P ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                              <div className="flex justify-between items-start gap-2 w-full">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isOut ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400'}`}>
                                    {isOut ? <HiOutlineArrowUp size={16} /> : <HiOutlineArrowDown size={16} />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="font-black text-sm sm:text-base text-slate-800 dark:text-white break-words" title={rec.title}>{rec.title}</h3>
                                      {rec.isP2P && (<span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 border border-amber-200 dark:border-amber-500/30 shrink-0"><FaShieldAlt size={8} /> P2P</span>)}
                                    </div>
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 break-words flex flex-wrap items-center gap-x-1.5">
                                      <FaWallet className="shrink-0" /><span className="text-slate-700 dark:text-slate-300 font-black">{rec.walletName || 'Main Wallet'}</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <p className={`text-base sm:text-lg font-black ${isOut ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{netChangeText}</p>
                                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest whitespace-nowrap">{isOut ? 'Withdrawal' : 'Net Deposit'}</p>
                                </div>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 flex flex-row justify-between items-center border border-slate-200 dark:border-slate-800/50 mt-1 gap-2">
                                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                                  <div className="min-w-0">
                                    <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Original Gross</p>
                                    <p className="font-black text-slate-800 dark:text-slate-200 text-xs sm:text-sm break-words">
                                      {rec.currency && rec.currency !== baseCurrency 
                                        ? `${(rec.foreignAmount || 0).toLocaleString()} ${rec.currency}`
                                        : `${currencySymbol}${(rec.foreignAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                                      }
                                    </p>
                                    {rec.currency && rec.currency !== baseCurrency && (
                                      <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 break-words">≈ {currencySymbol}{((rec.foreignAmount || 0) * (rec.exchangeRate || 1)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                    )}
                                  </div>
                                  {displayFee > 0 && (
                                    <div className="border-l border-slate-300 dark:border-slate-700 pl-2 sm:pl-4 shrink-0">
                                      <p className="text-[9px] sm:text-[10px] font-black text-rose-500 uppercase tracking-widest mb-0.5">Fee</p>
                                      <p className="font-black text-rose-600 dark:text-rose-400 text-xs sm:text-sm">-{displayFee.toLocaleString()} {currencySymbol}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-end justify-between mt-1">
                                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 w-fit shrink-0">
                                    <HiOutlineCalendar size={12} className="text-slate-500 shrink-0" /> 
                                    <span className="whitespace-nowrap">{formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}</span> 
                                    <span className="opacity-50 ml-1 whitespace-nowrap">{timeStr}</span>
                                  </p>
                                  {rec.referenceNo && (<span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded w-fit uppercase tracking-widest border border-slate-200 dark:border-slate-700 break-words max-w-full">Ref: {rec.referenceNo}</span>)}
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                                  {(rec.linkedExpenseId || rec.linkedIncomeId || rec.linkedPartyId) && (<span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[8px] font-black rounded border border-amber-200 dark:border-amber-500/30">SYNCED</span>)}
                                  <button onClick={() => handleEdit(rec)} className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg sm:rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors border border-blue-200 dark:border-blue-500/30 active:scale-95 shadow-sm"><HiOutlinePencil size={14} /></button>
                                  <button onClick={() => initiateDelete(rec)} className="p-2 sm:p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg sm:rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border border-rose-200 dark:border-rose-500/30 active:scale-95 shadow-sm"><HiOutlineTrash size={14} /></button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-4 text-center text-indigo-600 dark:text-indigo-400 font-black text-sm uppercase tracking-widest border-t border-slate-100 dark:border-slate-800/50">{isExpanded ? 'Show Less' : `View ${hiddenCount} more in ${month.monthName}`}</button>)}
                      </div>

                      <div className="hidden md:block overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[850px]">
                          <thead className="bg-slate-100/50 dark:bg-slate-800/30 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                            <tr><th className="p-4 pl-6 w-12 text-center">Type</th><th className="p-4">Platform & Details</th><th className="p-4 text-right">Gross Amount</th><th className="p-4 text-right">Net Impact</th><th className="p-4 text-right">Fee</th><th className="p-4 pr-6 text-right">Actions</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {displayedRecords.map(rec => {
                              const dateObj = new Date(rec.date);
                              const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              const isOut = rec.type === 'out' || rec.type === 'expense';
                              
                              // ✅ FIXED VARIABLES
                              const netAmt = Number(rec.finalBaseAmount || rec.amount || 0);
                              const displayFee = Number(rec.fee || 0);
                              const netChangeText = isOut ? `-${currencySymbol}${netAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}` : `+${currencySymbol}${netAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
                              
                              return (
                                <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group ${rec.isP2P ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                                  <td className="p-4 pl-6 text-center align-top">
                                    <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-lg shrink-0 ${isOut ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400'}`}>
                                      {isOut ? <HiOutlineArrowUp /> : <HiOutlineArrowDown />}
                                    </div>
                                  </td>
                                  <td className="p-4 align-top">
                                    <div className="flex items-start gap-4">
                                      <div className={`w-10 h-10 mt-0.5 rounded-2xl flex items-center justify-center text-xl shadow-sm shrink-0 ${rec.isP2P ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'}`}>
                                        {rec.isP2P ? <FaShieldAlt /> : <FaWallet />}
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-900 dark:text-white text-sm mb-0.5 flex items-center gap-2">
                                          {rec.walletName || 'Main Wallet'}
                                          {rec.isP2P && (<span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><FaShieldAlt size={8} /> P2P</span>)}
                                        </p>
                                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">{rec.title}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}
                                            <span className="opacity-60 border-l border-slate-300 dark:border-slate-600 pl-1 ml-1">{timeStr}</span>
                                          </p>
                                          {rec.referenceNo && (<span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[120px]">Ref: {rec.referenceNo}</span>)}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-right align-top">
                                    <p className="font-black text-slate-800 dark:text-slate-200">
                                      {rec.currency && rec.currency !== baseCurrency 
                                        ? `${(rec.foreignAmount || 0).toLocaleString()} ${rec.currency}`
                                        : `${currencySymbol}${(rec.foreignAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                                      }
                                    </p>
                                    {rec.currency && rec.currency !== baseCurrency && (
                                      <p className="text-[10px] font-bold text-slate-500 mt-1">≈ {currencySymbol}{((rec.foreignAmount || 0) * (rec.exchangeRate || 1)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                    )}
                                  </td>
                                  <td className="p-4 text-right align-top">
                                    <p className={`text-base font-black tracking-tight mt-0.5 ${isOut ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{netChangeText}</p>
                                  </td>
                                  <td className="p-4 text-right align-top">
                                    {displayFee > 0 ? <span className="text-xs font-bold text-rose-500">-{currencySymbol}{displayFee.toLocaleString()}</span> : <span className="text-xs text-slate-400">-</span>}
                                  </td>
                                  <td className="p-4 pr-6 align-top">
                                    <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                      {(rec.linkedExpenseId || rec.linkedIncomeId || rec.linkedPartyId) && (<span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[8px] font-black rounded border border-amber-200 dark:border-amber-500/30">SYNCED</span>)}
                                      <button onClick={() => handleEdit(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition-all shadow-sm border border-slate-300 dark:border-slate-700 active:scale-95"><HiOutlinePencil size={16} /></button>
                                      <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all shadow-sm border border-slate-300 dark:border-slate-700 active:scale-95"><HiOutlineTrash size={16} /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-3 text-center text-indigo-600 dark:text-indigo-400 font-black text-sm uppercase tracking-widest">{isExpanded ? 'Show Less' : `View ${hiddenCount} more in ${month.monthName}`}</button>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {hasMore && (
              <div className="flex justify-center py-6">
                <button onClick={loadMore} disabled={isPaginating} className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95">
                  {isPaginating ? <HiOutlineRefresh className="animate-spin" size={18} /> : <><HiOutlineChevronDown size={18} /> Load Older Entries</>}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
            <div className="px-6 sm:px-8 py-5 text-white flex justify-between items-center shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600">
              <h3 className="text-lg sm:text-xl font-black flex items-center gap-2"><HiOutlineArrowDown size={20} /> {editingId ? 'Edit Deposit' : 'Log E-Deposit'}</h3>
              <button type="button" onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors active:scale-90"><HiOutlineX size={20} /></button>
            </div>
            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar pb-2">
              {formData.isSynced && (
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-4 rounded-2xl text-xs font-bold leading-relaxed border border-amber-200 dark:border-amber-500/30 shadow-sm">
                  <p className="flex items-center gap-1.5 mb-1.5 font-black"><HiOutlineExclamationCircle size={16} /> Auto-Synced Entry</p>
                  This entry is linked to a system transaction. To maintain accuracy, you can only update the <span className="underline decoration-amber-400">Wallet Name</span> here. To change the amount, edit the source log.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Platform Name *</label>
                  <input type="text" list="online-wallets" required value={formData.walletName} onChange={e => setFormData({ ...formData, walletName: e.target.value })} placeholder="e.g., PayPal, Skrill" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors placeholder-slate-400 shadow-sm" />
                  <datalist id="online-wallets">{globalSummary.existingWallets?.map(w => (<option key={w} value={w} />))}</datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Sender / Source *</label>
                  <input disabled={formData.isSynced} type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Freelance Client" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors placeholder-slate-400 disabled:opacity-60 shadow-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Fiat Currency</label>
                  <select disabled={formData.isSynced} value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : '' })} className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors cursor-pointer disabled:opacity-60 shadow-sm">
                    {availableCurrencies.map(c => (<option key={c} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Deposit Amount *</label>
                  <input disabled={formData.isSynced} type="number" step="any" required value={formData.foreignAmount} onChange={e => setFormData({ ...formData, foreignAmount: e.target.value })} placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors placeholder-slate-400 disabled:opacity-60 shadow-sm" />
                </div>
              </div>

              {!formData.isSynced && (
                <label className="flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-colors duration-300 shadow-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-purple-400 text-slate-800 dark:text-slate-200">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input type="checkbox" checked={formData.isP2P} onChange={e => setFormData({ ...formData, isP2P: e.target.checked })} className="sr-only" />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${formData.isP2P ? 'bg-amber-500 border-amber-500' : 'bg-white dark:bg-slate-900 border-slate-400 dark:border-slate-500'}`}>
                      {formData.isP2P && <HiCheck size={14} className="text-white" />}
                    </div>
                  </div>
                  <div>
                    <p className={`font-black text-sm ${formData.isP2P ? 'text-amber-800 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>Tag as P2P / Crypto Origin</p>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">Isolate this transaction for risk management and tax auditing.</p>
                  </div>
                </label>
              )}

              {!formData.isSynced && formData.currency !== baseCurrency && (
                <div className="p-4 sm:p-5 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between w-full sm:w-auto">
                    <span className="text-[10px] font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-widest">Exchange Rate</span>
                    <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="text-[10px] sm:hidden font-black bg-indigo-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50 shadow-sm"><HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={12} /> Live</button>
                  </div>
                  <div className="flex items-center gap-2 flex-1 w-full">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">1 {formData.currency} = </span>
                    <input type="number" step="any" required value={formData.exchangeRate} onChange={e => setFormData({ ...formData, exchangeRate: e.target.value })} placeholder="Rate" className="flex-1 w-full min-w-0 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors disabled:opacity-60 text-center shadow-sm" />
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">{baseCurrency}</span>
                  </div>
                  <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="hidden sm:flex bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-95"><HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={14} /> Live</button>
                </div>
              )}

              {!formData.isSynced && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">Gateway Fee <span className="text-[8px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 px-1.5 py-0.5 rounded uppercase">IN {formData.currency}</span></label>
                    <input type="number" step="any" value={formData.fee} onChange={e => setFormData({ ...formData, fee: e.target.value })} placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors disabled:opacity-60 placeholder-slate-400 shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Ref / TxHash</label>
                    <input type="text" value={formData.referenceNo} onChange={e => setFormData({ ...formData, referenceNo: e.target.value })} placeholder="e.g. TXN123..." className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors disabled:opacity-60 placeholder-slate-400 shadow-sm" />
                  </div>
                </div>
              )}

              {/* SUMMARY */}
              <div className="p-4 sm:p-5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400"><span>Gross Deposit:</span><span className="font-black">{grossAmountNative.toLocaleString(undefined, { minimumFractionDigits: 2 })} {formData.currency}</span></div>
                {feeNative > 0 && <div className="flex justify-between text-xs sm:text-sm font-bold text-rose-500 mt-2"><span>Platform Fee:</span><span className="font-black">-{feeNative.toLocaleString(undefined, { minimumFractionDigits: 2 })} {formData.currency}</span></div>}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-300 dark:border-slate-600">
                  <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Net Credit (in {baseCurrency}):</span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{currencySymbol}{calculatedFinalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex justify-between ml-1"><span>Date & Time *</span></label>
                <input disabled={formData.isSynced} type="datetime-local" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors disabled:opacity-60 shadow-sm cursor-pointer" />
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 z-10">
                <button type="submit" disabled={isSaving} className="w-full p-4 sm:p-5 rounded-[2rem] font-black text-sm uppercase tracking-widest text-white transition-all shadow-xl flex items-center justify-center gap-2 shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/30 active:scale-95 disabled:opacity-70">
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : <HiOutlineArrowDown size={16} />}
                  {isSaving ? 'Processing...' : editingId ? 'Update Deposit' : 'Secure E-Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border border-rose-200 dark:border-rose-800 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner"><HiOutlineShieldCheck size={24} /></div>
                <div><h3 className="text-xl font-black">Security Verification</h3><p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest">Permanent Deletion</p></div>
              </div>
            </div>
            <form onSubmit={executeSecureDelete} className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-2xl shadow-sm">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed">You are deleting <span className="font-black">"{deleteContext.title}"</span> worth <span className="font-black"> {currencySymbol}{(deleteContext.finalBaseAmount || deleteContext.amount)?.toLocaleString()}</span></p>
                {(deleteContext.linkedIncomeId || deleteContext.linkedExpenseId || deleteContext.linkedPartyId) && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-2 font-bold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-200 dark:border-rose-800/50"><HiOutlineExclamationCircle size={14} className="shrink-0" /> Auto-synced entry. Deletion may cause ledger mismatch. Best practice is to delete from the source.</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 text-center block">Security PIN</label>
                <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full text-center tracking-[0.4em] text-2xl p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm" placeholder="••••" />
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

      {/* ✅ EXPORT MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineDownload size={24} /> Export Report</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <button onClick={handleExportPDF} disabled={isGeneratingPDF} className="w-full py-4 px-5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border border-rose-200 dark:border-rose-800">
                <HiOutlineDocumentText size={20} />{isGeneratingPDF ? 'Generating PDF...' : '📄 PDF Document'}
              </button>
              <button onClick={handleExportExcel} disabled={isGeneratingExcel} className="w-full py-4 px-5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border border-emerald-200 dark:border-emerald-800">
                <HiOutlineTable size={20} />{isGeneratingExcel ? 'Generating Excel...' : '📊 Excel (CSV)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineWalletContent;