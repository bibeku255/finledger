// src/pages/accounts/CashWallet.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  collection, addDoc, doc, setDoc, deleteDoc,
  getDoc, getDocs, query, where, documentId
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPINEnhanced } from '../../utils/securityUtils';
import { useToast } from '../../hooks/useToastNotification';

// ✅ BOTH ENTERPRISE HOOKS IMPORTED
import { useSecureSnapshot } from '../../hooks/useSecureSnapshot';
import { usePaginatedMonthlyLogs } from '../../hooks/usePaginatedMonthlyLogs';

import {
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineCash, HiOutlineSearch, HiOutlineRefresh,
  HiOutlineShieldCheck, HiOutlineChevronDown, HiOutlineDownload,
  HiOutlineDocumentText, HiOutlineTable, HiOutlineCalendar,
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineArrowDown, HiOutlineArrowUp,
  HiOutlineExclamationCircle, HiOutlineLibrary
} from 'react-icons/hi';

import { FaMoneyBillWave, FaGlobe, FaWallet, FaArrowDown, FaArrowUp, FaUniversity } from 'react-icons/fa';
import { fiatFlagMap } from '../../utils/marketConstants';

// ============================================
// 🧩 HELPERS & SYNC ENGINE
// ============================================
const getLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// 🚀 ENTERPRISE ENGINE: Automatically syncs perfect math to a summary document
const syncCashSummary = async (userId, baseCurr) => {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'cashWallet'));
    const logs = snap.docs.map(d => d.data());

    let totalBalance = 0, totalFees = 0, totalInflows = 0, totalOutflows = 0;
    const balances = {}; 

    logs.forEach(t => {
      const curr = t.currency || baseCurr;
      if (!balances[curr]) balances[curr] = 0;

      const amt = Number(t.finalBaseAmount || 0);
      const nativeAmt = Number(t.foreignAmount !== undefined ? t.foreignAmount : (t.amount !== undefined ? t.amount : amt));
      const feeAmount = Number(t.fee || 0);
      const rawType = (t.type || '').toLowerCase();

      if (rawType === 'out' || rawType === 'expense') {
        const feeType = (t.feeType || 'inclusive').toLowerCase();
        const deduct = feeType === 'exclusive' ? amt + feeAmount : amt;
        
        const exRate = Number(t.exchangeRate || 1);
        const nativeFee = feeAmount / exRate;
        const nativeDeduct = feeType === 'exclusive' ? nativeAmt + nativeFee : nativeAmt;

        totalOutflows += deduct;
        totalBalance -= deduct;
        balances[curr] -= nativeDeduct;
      } else {
        totalInflows += amt;
        totalBalance += amt;
        balances[curr] += nativeAmt;
      }
      totalFees += feeAmount;
    });

    const currencyBalances = Object.entries(balances)
      .filter(([_, v]) => Math.abs(v) > 0.01)
      .map(([curr, value]) => ({ currency: curr, value }));

    const summaryData = {
      totalBalance, totalFees, totalInflows, totalOutflows,
      currencyBalances, totalLogs: logs.length, lastUpdated: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', userId, 'walletSummary', 'cash'), summaryData, { merge: true });
    return summaryData;
  } catch (error) {
    console.error("Failed to sync cash summary:", error);
    return null;
  }
};

// ============================================
// 🧩 SUB COMPONENTS
// ============================================
const CurrencyBadge = ({ currency, amount }) => (
  <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 shrink-0 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 group shadow-sm min-w-[200px]">
    <div className="relative">
      <div className="absolute inset-0 bg-emerald-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
      <img
        src={`https://flagcdn.com/w40/${fiatFlagMap[currency] || 'un'}.png`}
        alt=""
        className="relative w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-lg group-hover:scale-105 transition-transform"
      />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate mb-0.5">
        Physical {currency}
      </p>
      <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
        {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  </div>
);

const TickerBar = ({ tickerData, currencySymbol }) => {
  if (!tickerData || tickerData.length === 0) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm mt-6 flex items-center">
      <div className="absolute left-0 z-10 h-full px-4 sm:px-5 flex items-center gap-2 font-black text-[10px] sm:text-xs uppercase tracking-widest bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg">
        <FaGlobe className="text-white/80" /> <span className="hidden sm:inline">Live Fiat</span>
      </div>
      <div className="flex-1 overflow-hidden ml-[80px] sm:ml-[140px] py-3">
        <div className="animate-ticker-scroll flex gap-8 px-4">
          {[...tickerData, ...tickerData, ...tickerData].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 font-bold text-sm cursor-default group shrink-0">
              <img
                src={`https://flagcdn.com/w40/${fiatFlagMap[item.symbol] || 'un'}.png`}
                alt={item.symbol}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover shadow-sm group-hover:scale-110 transition-transform"
              />
              <span className="text-slate-800 dark:text-slate-300 font-black text-xs sm:text-sm">{item.symbol}</span>
              <span className="text-slate-900 dark:text-white font-black text-xs sm:text-sm">
                {currencySymbol}{Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
              <span className={`text-[10px] sm:text-[11px] font-black flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
                item.change >= 0
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
              }`}>
                {item.change >= 0 ? <HiOutlineTrendingUp size={12} /> : <HiOutlineTrendingDown size={12} />}
                {Math.abs(item.change)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// 💼 MAIN CASH WALLET COMPONENT
// ============================================
const CashWalletContent = () => {
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

  // 🚀 1. FAST MATH ENGINE
  const [globalSummary, setGlobalSummary] = useState({
    totalBalance: 0, totalFees: 0, totalInflows: 0, totalOutflows: 0,
    currencyBalances: [], totalLogs: 0
  });

  const summaryQuery = useMemo(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'walletSummary'), where(documentId(), '==', 'cash'));
  }, [user?.uid]);

  const { data: summaryDataArray, loading: isSummaryLoading } = useSecureSnapshot(summaryQuery);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (isSummaryLoading) return;
    if (summaryDataArray && summaryDataArray.length > 0) {
      setGlobalSummary(summaryDataArray[0]);
    } else if (summaryDataArray?.length === 0 && user?.uid && !isSyncingRef.current) {
      isSyncingRef.current = true;
      syncCashSummary(user.uid, baseCurrency).then(data => {
        if (data) setGlobalSummary(data);
        isSyncingRef.current = false;
      });
    }
  }, [summaryDataArray, isSummaryLoading, user?.uid, baseCurrency]);


  // 🚀 2. TRUE FIRESTORE PAGINATION
  const {
    months: paginatedMonths,
    loading: isLoadingLogs,
    isPaginating,
    hasMore,
    loadMore,
    refresh: refreshTransactions
  } = usePaginatedMonthlyLogs(user?.uid, 'cashWallet', 20, !!user, getCalendarMonthKey);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tickerData, setTickerData] = useState([]);
  
  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [formData, setFormData] = useState({
    title: '', foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '',
    date: getLocalDateTimeString(),
  });

  // Ticker fetch
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
          return rate ? { symbol: fiat, price: (1 / rate).toFixed(4), change: (Math.random() * 0.8 - 0.4).toFixed(2) } : null;
        }).filter(Boolean);
        setTickerData(formattedFiat);
      } catch (error) {}
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
        const matchesSearch = (r.title?.toLowerCase().includes(term));
        const matchesType = filterType === 'all' || r.type === filterType || (filterType === 'out' && (r.type === 'out' || r.type === 'expense'));
        return matchesSearch && matchesType;
      });

      let pageIn = 0, pageOut = 0;
      filteredRecords.forEach(r => {
        if (r.type === 'out' || r.type === 'expense') pageOut += r.actualDeduct;
        else pageIn += r.finalAmount;
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

  // ✅ FIXED EXPORT LOGIC
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
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date?.split('T')[0] || 'N/A',
        type: isOut ? 'Withdrawal (-)' : 'Deposit (+)',
        currency: rec.currency || baseCurrency,
        nativeAmount: Number(rec.foreignAmount || rec.amount || 0),
        netBaseValue: Number(rec.netChange || 0),
        fee: Number(rec.fee || 0),
        notes: (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, ' '),
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Currency', key: 'currency' },
      { header: 'Gross Native', key: 'nativeAmount', isNumeric: true },
      { header: `Fee (${currencySymbol})`, key: 'fee', isNumeric: true },
      { header: `Net Base Value (${currencySymbol})`, key: 'netBaseValue', isNumeric: true },
      { header: 'Description', key: 'notes' },
    ];

    try {
      await downloadPDFReport(reportData, columns, 'Cash_Vault_Ledger', 'Physical Cash Vault Ledger', {
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
        Currency: rec.currency || baseCurrency,
        GrossNative: (rec.foreignAmount || rec.amount || 0).toFixed(2),
        Fee: (rec.fee || 0).toFixed(2),
        NetBase: (rec.netChange || 0).toFixed(2),
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
    a.download = `Cash_Vault_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
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
      if (data.rates[baseCurrency]) {
        setFormData(prev => ({ ...prev, exchangeRate: data.rates[baseCurrency].toFixed(4) }));
      } else {
        addToast('Exchange rate not available for selected pair.', 'warning');
      }
    } catch (error) { addToast('Failed to fetch live rate. Check connection.', 'error'); } 
    finally { setIsFetchingRate(false); }
  };

  const isForeign = formData.currency !== baseCurrency;
  const grossAmount = (parseFloat(formData.foreignAmount) || 0) * (isForeign ? parseFloat(formData.exchangeRate) || 1 : 1);
  const feeDeduction = parseFloat(formData.fee) || 0;
  const calculatedFinalAmount = grossAmount - feeDeduction;

  const handleSaveEntry = async e => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    try {
      const inputForeign = parseFloat(formData.foreignAmount) || 0;
      const inputExRate = isForeign ? (parseFloat(formData.exchangeRate) || 1) : 1;
      const freshGrossBase = inputForeign * inputExRate;
      const freshFee = parseFloat(formData.fee) || 0;
      const freshFinalBase = freshGrossBase - freshFee;

      const recordData = {
        title: formData.title, type: 'in', date: formData.date,
        currency: formData.currency, foreignAmount: inputForeign,
        exchangeRate: inputExRate, finalBaseAmount: freshFinalBase,
        fee: freshFee, vaultId: 'cash_main',
      };

      if (editingId) {
        await setDoc(doc(db, 'users', user.uid, 'cashWallet', editingId), recordData, { merge: true });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'cashWallet'), {
          ...recordData, timestamp: new Date(formData.date).getTime()
        });
      }
      
      // Update Summary & Refresh Log
      await syncCashSummary(user.uid, baseCurrency);
      refreshTransactions();
      
      addToast(editingId ? 'Entry updated successfully!' : 'Cash Added to Vault!', 'success');
      closeModal();
    } catch (error) { addToast('Failed to save entry. Please try again.', 'error'); } 
    finally { setIsSaving(false); }
  };

  const handleEdit = rec => {
    setFormData({
      title: rec.title || '', foreignAmount: rec.foreignAmount || rec.amount || '',
      currency: rec.currency || baseCurrency, exchangeRate: rec.exchangeRate || 1,
      fee: rec.fee || '', date: rec.date || getLocalDateTimeString(),
    });
    setEditingId(rec.id); setIsModalOpen(true);
  };

  const initiateDelete = rec => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

  const executeSecureDelete = async e => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError('Enter PIN.');
    setIsVerifying(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const storedHash = userSnap.data()?.security?.pinHash || userSnap.data()?.securityPin || userSnap.data()?.pin;
      const { valid, newHash } = await verifyPINEnhanced(pinInput.trim(), storedHash, user.uid);
      if (!valid) { setPinError('Incorrect PIN.'); setIsVerifying(false); return; }
      if (newHash) await setDoc(doc(db, 'users', user.uid), { security: { pinHash: newHash } }, { merge: true });
      
      await deleteDoc(doc(db, 'users', user.uid, 'cashWallet', deleteContext.id));
      
      await syncCashSummary(user.uid, baseCurrency);
      refreshTransactions();
      
      setDeleteContext(null); addToast('Entry deleted successfully.', 'info');
    } catch (error) { setPinError('System error. Try again later.'); } 
    finally { setIsVerifying(false); }
  };

  const openModal = () => {
    setEditingId(null);
    setFormData({ title: '', foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '', date: getLocalDateTimeString() });
    setIsModalOpen(true);
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
    <div className="h-full min-h-screen overflow-y-auto pb-24">
      <div className="pt-20 sm:pt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <style>{`@keyframes scrollTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } .animate-ticker-scroll { display: flex; white-space: nowrap; animation: scrollTicker 45s linear infinite; } .animate-ticker-scroll:hover { animation-play-state: paused; }`}</style>

        {/* PREMIUM GLASS HEADER */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 lg:p-10 shadow-2xl border border-white/10 backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-18 sm:h-18 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                <FaMoneyBillWave size={32} className="text-white" />
              </div>
              <div>
               <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">Physical Cash</h1>
               <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">Track your physical currency holdings</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* ✅ FIXED EXPORT BUTTON */}
              <div className="relative">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  disabled={isGeneratingPDF || isGeneratingExcel}
                  className="flex items-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 active:scale-95 shadow-sm disabled:opacity-50"
                >
                  {isGeneratingPDF || isGeneratingExcel ? (
                    <><HiOutlineRefresh className="animate-spin" size={18} /> Generating...</>
                  ) : (
                    <><HiOutlineDownload size={18} /> Export</>
                  )}
                </button>
              </div>

              <button
                onClick={openModal}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
              >
                <HiOutlinePlus size={18} /> Add Cash
              </button>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-white/10">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/5 col-span-2 lg:col-span-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineShieldCheck size={14} /> Vault Balance</p>
              <p className="text-xl sm:text-2xl font-black text-white truncate">{currencySymbol}{(globalSummary.totalBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineExclamationCircle size={14} /> Total Fees</p>
              <p className="text-xl sm:text-2xl font-black text-rose-300 truncate">-{currencySymbol}{(globalSummary.totalFees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><FaGlobe size={12} /> Currencies</p>
              <p className="text-xl sm:text-2xl font-black text-white">{globalSummary.currencyBalances?.length || 1}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineLibrary size={14} /> Global Logs</p>
              <p className="text-xl sm:text-2xl font-black text-white">{globalSummary.totalLogs || 0}</p>
            </div>
          </div>
        </div>

        <TickerBar tickerData={tickerData} currencySymbol={currencySymbol} />

        {globalSummary.currencyBalances?.length > 0 && (
          <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FaWallet className="text-emerald-500" /> Physical Currency Holdings</h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3">
              {globalSummary.currencyBalances.map((item, idx) => (<CurrencyBadge key={idx} currency={item.currency} amount={item.value} />))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search transactions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-14 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all placeholder-slate-400 dark:placeholder-slate-500" />
          </div>
          <div className="flex gap-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full sm:w-auto px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 cursor-pointer transition-all uppercase tracking-widest">
              <option value="all">All Records</option>
              <option value="in">Deposits (+)</option>
              <option value="out">Withdrawals (-)</option>
            </select>
          </div>
        </div>

        {/* 🚀 TRUE INFINITE SCROLL LEDGER */}
        {isLoadingLogs ? <LedgerSkeleton /> : filteredLedger.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm px-4 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-5 shadow-inner"><HiOutlineCash className="text-5xl text-slate-300 dark:text-slate-600" /></div>
            <p className="text-lg font-black text-slate-700 dark:text-slate-300">No records found</p>
            <p className="text-sm font-medium text-slate-500 mt-2 text-center max-w-sm">{searchTerm || filterType !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first physical deposit.'}</p>
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
                <div key={month.monthKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm">
                  <button onClick={() => toggleMonth(month.monthKey)} className="w-full px-6 py-5 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left">
                    <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><HiOutlineCalendar size={18} /></div>
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
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page Deposits (+)</p><p className="font-black text-emerald-600">+{currencySymbol}{month.pageIn.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page Withdrawals (-)</p><p className="font-black text-rose-600">-{currencySymbol}{month.pageOut.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Period Net Change</p><p className={`font-black ${pageNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pageNet > 0 ? '+' : ''}{currencySymbol}{pageNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                      </div>

                      <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                        {displayedRecords.map(rec => {
                          const dateObj = new Date(rec.date);
                          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const isOut = rec.type === 'out' || rec.type === 'expense';
                          const netChangeText = isOut ? `-${currencySymbol}${Math.abs(rec.netChange).toLocaleString(undefined, {minimumFractionDigits: 2})}` : `+${currencySymbol}${rec.netChange.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

                          return (
                            <div key={rec.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className={`w-10 h-10 rounded-[0.8rem] flex items-center justify-center shadow-sm shrink-0 ${isOut ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}><FaArrowDown size={14} className={isOut ? 'rotate-180' : ''}/></div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-black text-slate-900 dark:text-white text-sm break-words" title={rec.title}>{rec.title}</p>
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 break-words">
                                      {rec.currency !== baseCurrency && (
                                        <span className="inline-flex items-center gap-1 mr-2"><img src={`https://flagcdn.com/w20/${fiatFlagMap[rec.currency] || 'un'}.png`} alt="" className="w-3.5 h-3.5 rounded-full object-cover shadow-sm shrink-0" />{rec.currency}</span>
                                      )}
                                      {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}<span className="opacity-50 mx-1">·</span>{timeStr}
                                    </p>
                                    {rec.feeAmount > 0 && <p className="text-[9px] text-rose-500 font-bold mt-0.5">Fee: {currencySymbol}{rec.feeAmount.toLocaleString()}</p>}
                                  </div>
                                </div>
                                <div className="text-right ml-3 shrink-0">
                                  <p className={`text-base font-black ${isOut ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{netChangeText}</p>
                                  {rec.currency !== baseCurrency && <p className="text-[10px] font-bold text-slate-500 mt-0.5 break-words">{rec.foreignAmount?.toLocaleString()} {rec.currency}</p>}
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-3">
                                {!rec.linkedExpenseId && !rec.linkedIncomeId && !rec.linkedPartyId && !rec.shiftId && (
                                  <button onClick={() => handleEdit(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg transition-all active:scale-95"><HiOutlinePencil size={14} /></button>
                                )}
                                <button onClick={() => initiateDelete(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-all active:scale-95"><HiOutlineTrash size={14} /></button>
                              </div>
                            </div>
                          );
                        })}
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-4 text-center text-emerald-600 font-black text-sm uppercase tracking-widest">{isExpanded ? 'Show Less' : `View ${hiddenCount} more in ${month.monthName}`}</button>)}
                      </div>

                      <div className="hidden md:block overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left min-w-[800px]">
                          <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                            <tr><th className="p-4 pl-6 w-20">Type</th><th className="p-4">Details</th><th className="p-4 text-right">Native Amount</th><th className="p-4 text-right">Net Impact</th><th className="p-4 text-right">Fee</th><th className="p-4 pr-6 text-right">Actions</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {displayedRecords.map(rec => {
                              const dateObj = new Date(rec.date);
                              const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              const isOut = rec.type === 'out' || rec.type === 'expense';
                              const netChangeText = isOut ? `-${currencySymbol}${Math.abs(rec.netChange).toLocaleString(undefined, {minimumFractionDigits: 2})}` : `+${currencySymbol}${rec.netChange.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

                              return (
                                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                                  <td className="p-4 pl-6"><div className={`w-10 h-10 rounded-[0.8rem] flex items-center justify-center shadow-sm ${isOut ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}><FaArrowDown size={14} className={isOut ? 'rotate-180' : ''}/></div></td>
                                  <td className="p-4">
                                    <p className="font-black text-slate-900 dark:text-white text-sm truncate max-w-[200px] md:max-w-[300px]">{rec.title}</p>
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">{formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}<span className="opacity-50 mx-1 border-l border-slate-300 dark:border-slate-600 pl-1">{timeStr}</span></p>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                                      {rec.currency !== baseCurrency && (<img src={`https://flagcdn.com/w20/${fiatFlagMap[rec.currency] || 'un'}.png`} alt="" className="w-3.5 h-3.5 rounded-full object-cover shadow-sm shrink-0" />)}
                                      {rec.currency !== baseCurrency ? `${(rec.foreignAmount || 0).toLocaleString()} ${rec.currency}` : `${currencySymbol}${(rec.finalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                    </div>
                                  </td>
                                  <td className="p-4 text-right"><p className={`text-base font-black ${isOut ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{netChangeText}</p></td>
                                  <td className="p-4 text-right">{rec.feeAmount > 0 ? (<span className="text-xs font-bold text-rose-500">-{currencySymbol}{rec.feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>) : (<span className="text-xs text-slate-400">-</span>)}</td>
                                  <td className="p-4 pr-6 align-top">
                                    <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                      {!rec.linkedExpenseId && !rec.linkedIncomeId && !rec.linkedPartyId && !rec.shiftId && (
                                        <button onClick={() => handleEdit(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded-lg transition-all"><HiOutlinePencil size={14} /></button>
                                      )}
                                      <button onClick={() => initiateDelete(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-lg transition-all"><HiOutlineTrash size={14} /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-3 text-center text-emerald-600 font-black text-sm uppercase tracking-widest">{isExpanded ? 'Show Less' : `View ${hiddenCount} more in ${month.monthName}`}</button>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <div className="flex justify-center py-6">
                <button onClick={loadMore} disabled={isPaginating} className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95">
                  {isPaginating ? <HiOutlineRefresh className="animate-spin" size={18} /> : <><HiOutlineChevronDown size={18} /> Load Older Entries</>}
                </button>
              </div>
            )}
          </>
        )}

        {/* ADD CASH MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
              <div className="px-6 sm:px-8 py-4 sm:py-5 flex justify-between items-center shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <h3 className="text-lg sm:text-xl font-black flex items-center gap-2"><HiOutlineArrowDown size={20} />{editingId ? 'Edit Deposit' : 'Add Physical Cash'}</h3>
                <button onClick={closeModal} className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors active:scale-90"><HiOutlineX size={18} /></button>
              </div>

              <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 pb-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Description *</label>
                  <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Cash from ATM" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Currency</label>
                    <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : '' })} className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer">{availableCurrencies.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Amount *</label>
                    <input type="number" step="any" required value={formData.foreignAmount} onChange={e => setFormData({ ...formData, foreignAmount: e.target.value })} placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
                  </div>
                </div>

                {formData.currency !== baseCurrency && (
                  <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center justify-between w-full sm:w-auto"><span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">Exchange Rate</span><button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="text-[10px] sm:hidden font-black bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"><HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={12} /> Live Rate</button></div>
                    <div className="flex items-center gap-2 flex-1 w-full"><span className="text-sm font-black text-slate-700 dark:text-slate-300">1 {formData.currency} =</span><input type="number" step="any" required value={formData.exchangeRate} onChange={e => setFormData({ ...formData, exchangeRate: e.target.value })} className="flex-1 w-full min-w-0 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" /><span className="text-sm font-black text-slate-700 dark:text-slate-300">{baseCurrency}</span></div>
                    <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="hidden sm:flex bg-emerald-600 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 items-center justify-center gap-1.5"><HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={14} /> Live</button>
                  </div>
                )}

                <div className="space-y-1.5 mt-4">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Fee (in {baseCurrency})</label>
                  <input type="number" step="any" value={formData.fee} onChange={e => setFormData({ ...formData, fee: e.target.value })} placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>

                <div className="p-4 sm:p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner mt-2">
                  <div className="flex justify-between items-center"><span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Net Cash Added:</span><span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{currencySymbol}{calculatedFinalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>

                <div className="space-y-1.5 mt-4">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between"><span>Date & Time *</span><span className="text-emerald-500">{formatGlobalDate && formData.date ? formatGlobalDate(formData.date.split('T')[0], 'short') : ''}</span></label>
                  <input type="datetime-local" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="block w-full mt-1.5 p-3.5 bg-slate-50 dark:bg-slate-800/80 font-bold text-sm text-slate-900 dark:text-white outline-none cursor-pointer border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/50 rounded-xl" />
                </div>

                <div className="sticky bottom-0 pt-3 pb-1 bg-white dark:bg-slate-900 mt-2 z-10 border-t border-slate-100 dark:border-slate-800 sm:border-none">
                  <button type="submit" disabled={isSaving} className={`w-full p-4 sm:p-5 rounded-2xl font-black text-sm sm:text-base uppercase tracking-widest text-white flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}>
                    {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : <HiOutlineArrowDown size={18} />} {isSaving ? 'Processing...' : editingId ? 'Update Deposit' : 'Add to Vault'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {deleteContext && (
          <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border border-rose-200 dark:border-rose-800 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
              <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white shrink-0">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner"><HiOutlineShieldCheck size={24} /></div><div><h3 className="text-xl font-black">Security Verification</h3></div></div>
              </div>
              <form onSubmit={executeSecureDelete} className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full text-center tracking-[0.4em] text-2xl p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50" placeholder="••••" />
                {pinError && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-2 text-center animate-bounce">{pinError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-widest">Cancel</button>
                  <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-sm bg-gradient-to-r from-rose-600 to-pink-600 text-white flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50">
                    {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : <HiOutlineTrash size={18} />} Confirm
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ✅ EXPORT MODAL (Mobile Bottom Sheet Friendly) */}
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95">
              <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center">
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
    </div>
  );
};

export default CashWalletContent;