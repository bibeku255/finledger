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
import { useSecureSnapshot } from '../../hooks/useSecureSnapshot';
import { usePaginatedMonthlyLogs } from '../../hooks/usePaginatedMonthlyLogs';

import {
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineLibrary, HiOutlineSearch, HiOutlineRefresh,
  HiOutlineExclamationCircle, HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineCalendar, HiOutlineShieldCheck,
  HiOutlineChevronDown,
} from 'react-icons/hi';
import { FaGlobe, FaUniversity, FaArrowDown, FaArrowUp } from 'react-icons/fa';
import { fiatFlagMap } from '../../utils/marketConstants';

// ============================================
// 🧩 CONSTANTS & HELPERS
// ============================================
const bankTransferTypes = ['UPI', 'IMPS', 'NEFT / RTGS', 'Wire Transfer / SWIFT', 'Cheque', 'Direct Deposit'];

const getLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// Enterprise summary engine (unchanged)
const syncBankSummary = async (userId, baseCurr) => {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'bankWallet'));
    const logs = snap.docs.map(d => d.data());

    let netBalance = 0, totalFees = 0, totalInflows = 0, totalOutflows = 0;
    const balances = {};

    logs.forEach(t => {
      const curr = t.currency || baseCurr;
      const bank = t.bankName?.trim() ? t.bankName.trim() : 'Main Vault';
      const key = `${bank.toUpperCase()}_${curr.toUpperCase()}`;
      if (!balances[key]) balances[key] = { bank, currency: curr, value: 0 };

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
        netBalance -= deduct;
        balances[key].value -= nativeDeduct;
      } else {
        totalInflows += amt;
        netBalance += amt;
        balances[key].value += nativeAmt;
      }
      totalFees += feeAmount;
    });

    const subWalletBalances = Object.values(balances)
      .filter(b => Math.abs(b.value) > 0.01)
      .sort((a, b) => b.value - a.value);

    const existingBanks = Array.from(new Set(logs.map(t => t.bankName).filter(b => b && b.trim() !== '')));
    const uniqueCurrenciesCount = new Set(logs.map(t => t.currency || baseCurr)).size;

    const summaryData = {
      netBalance, totalFees, totalInflows, totalOutflows,
      existingBanks, uniqueCurrenciesCount, subWalletBalances,
      totalLogs: logs.length, lastUpdated: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', userId, 'walletSummary', 'bank'), summaryData, { merge: true });
    return summaryData;
  } catch (error) {
    console.error("Failed to sync bank summary:", error);
    return null;
  }
};

// ============================================
// 🧩 SUB COMPONENTS (Premium + dark mode)
// ============================================
const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br ${color} text-white shadow-xl group hover:scale-[1.02] transition-all duration-300`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_70%)]" />
    <Icon className="absolute right-[-10%] bottom-[-10%] text-7xl sm:text-8xl opacity-10 group-hover:scale-110 transition-transform duration-500" />
    <div className="relative z-10 flex flex-col h-full">
      <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-80 mb-2">{title}</p>
      <h3 className="text-2xl sm:text-3xl font-black tracking-tight truncate">{value}</h3>
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
      <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
        {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-500">{currency}</span>
      </p>
    </div>
  </div>
);

// ============================================
// 🚀 MAIN COMPONENT
// ============================================
const BankWalletContent = () => {
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

  // Summary engine
  const [globalSummary, setGlobalSummary] = useState({
    netBalance: 0, totalFees: 0, totalInflows: 0, totalOutflows: 0,
    existingBanks: [], uniqueCurrenciesCount: 0, subWalletBalances: [], totalLogs: 0
  });

  const summaryQuery = useMemo(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'walletSummary'), where(documentId(), '==', 'bank'));
  }, [user?.uid]);

  const { data: summaryDataArray, loading: isSummaryLoading } = useSecureSnapshot(summaryQuery);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (isSummaryLoading) return;
    if (summaryDataArray && summaryDataArray.length > 0) {
      setGlobalSummary(summaryDataArray[0]);
    } else if (summaryDataArray?.length === 0 && user?.uid && !isSyncingRef.current) {
      isSyncingRef.current = true;
      syncBankSummary(user.uid, baseCurrency).then(data => {
        if (data) setGlobalSummary(data);
        isSyncingRef.current = false;
      });
    }
  }, [summaryDataArray, isSummaryLoading, user?.uid, baseCurrency]);

  // Paginated logs
  const {
    months: paginatedMonths,
    loading: isLoadingLogs,
    isPaginating,
    hasMore,
    loadMore,
    refresh: refreshTransactions
  } = usePaginatedMonthlyLogs(user?.uid, 'bankWallet', 20, !!user, getCalendarMonthKey);

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

  const getInitialFormData = (defaultBank = '') => ({
    title: '', bankName: defaultBank, transferType: 'UPI', referenceNo: '', isP2P: false,
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

  const filteredLedger = useMemo(() => {
    if (!paginatedMonths) return [];
    return paginatedMonths.map(month => {
      const sampleDate = month.records?.[0]?.date || new Date();
      const localizedMonthName = formatGlobalDate ? formatGlobalDate(sampleDate, 'monthYear') : month.monthName;
      const filteredRecords = month.records.filter(r => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (r.title?.toLowerCase().includes(term) || r.bankName?.toLowerCase().includes(term) || r.referenceNo?.toLowerCase().includes(term));
        const matchesType = filterType === 'all' || r.type === filterType || (filterType === 'p2p' && r.isP2P);
        return matchesSearch && matchesType;
      });
      let pageIn = 0, pageOut = 0;
      filteredRecords.forEach(r => {
        if (r.type === 'out' || r.type === 'expense') pageOut += r.actualDeduct;
        else pageIn += r.finalAmount;
      });
      return { ...month, monthName: localizedMonthName, records: filteredRecords, pageIn, pageOut };
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
      const grossBase = (Number(rec.foreignAmount) || 0) * (Number(rec.exchangeRate) || 1);
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date?.split('T')[0],
        type: isOut ? 'Withdrawal (-)' : 'Deposit (+)',
        bankName: rec.bankName || 'Main Bank',
        method: rec.transferType || 'N/A',
        reference: rec.referenceNo || 'N/A',
        grossAmount: Number(grossBase.toFixed(2)),
        fee: Number(rec.feeAmount || 0),
        netAmount: Number(rec.netChange || 0),
        notes: (rec.title || '').replace(/(\r\n|\n|\r)/gm, ' '),
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Bank', key: 'bankName' },
      { header: 'Method', key: 'method' },
      { header: 'Ref/UTR', key: 'reference' },
      { header: `Gross (${currencySymbol})`, key: 'grossAmount', isNumeric: true },
      { header: `Fee (${currencySymbol})`, key: 'fee', isNumeric: true },
      { header: `Net Impact (${currencySymbol})`, key: 'netAmount', isNumeric: true },
      { header: 'Notes', key: 'notes' },
    ];

    try {
      await downloadPDFReport(reportData, columns, 'Bank_Ledger', 'Bank Vault Audit', {
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

    // Prepare data for CSV
    const reportData = recordsToExport.map(rec => {
      const isOut = rec.type === 'out' || rec.type === 'expense';
      const grossBase = (Number(rec.foreignAmount) || 0) * (Number(rec.exchangeRate) || 1);
      return {
        Date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date?.split('T')[0],
        Type: isOut ? 'Withdrawal' : 'Deposit',
        Bank: rec.bankName || 'Main Bank',
        Method: rec.transferType || 'N/A',
        Reference: rec.referenceNo || 'N/A',
        Gross: grossBase.toFixed(2),
        Fee: (rec.feeAmount || 0).toFixed(2),
        Net: (rec.netChange || 0).toFixed(2),
        Notes: (rec.title || '').replace(/(\r\n|\n|\r)/gm, ' '),
      };
    });

    // CSV generation
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
    a.download = `Bank_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
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
  const grossAmount = (parseFloat(formData.foreignAmount) || 0) * (isForeign ? parseFloat(formData.exchangeRate) || 1 : 1);
  const feeDeduction = parseFloat(formData.fee) || 0;
  const calculatedFinalAmount = grossAmount - feeDeduction;

  const handleSaveEntry = async e => {
    e.preventDefault();
    if (!user) { addToast('Please login first.', 'error'); return; }
    if (!formData.bankName.trim()) { addToast('Please provide a Bank Name', 'warning'); return; }

    setIsSaving(true);
    try {
      const inputForeign = parseFloat(formData.foreignAmount) || 0;
      const inputExRate = isForeign ? (parseFloat(formData.exchangeRate) || 1) : 1;
      const freshGrossBase = inputForeign * inputExRate;
      const freshFee = parseFloat(formData.fee) || 0;

      const baseRecordData = {
        title: formData.title, bankName: formData.bankName.trim(), transferType: formData.transferType,
        referenceNo: formData.referenceNo || '', isP2P: formData.isP2P || false, date: formData.date,
        currency: formData.currency, foreignAmount: inputForeign, exchangeRate: inputExRate,
        fee: freshFee, finalBaseAmount: freshGrossBase - freshFee, vaultId: 'bank_' + formData.bankName.trim().toUpperCase(),
      };

      if (editingId) {
        if (formData.isSynced) await setDoc(doc(db, 'users', user.uid, 'bankWallet', editingId), { bankName: formData.bankName.trim(), vaultId: 'bank_' + formData.bankName.trim().toUpperCase() }, { merge: true });
        else await setDoc(doc(db, 'users', user.uid, 'bankWallet', editingId), baseRecordData, { merge: true });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'bankWallet'), { ...baseRecordData, type: 'in', timestamp: new Date(formData.date).getTime() });
      }

      await syncBankSummary(user.uid, baseCurrency);
      refreshTransactions();

      addToast(editingId ? 'Bank entry updated!' : 'Deposit logged!', 'success');
      closeModal();
    } catch (error) { addToast('Failed to save record.', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleEdit = rec => {
    setFormData({
      title: rec.title || '', bankName: rec.bankName || '', transferType: rec.transferType || 'UPI', referenceNo: rec.referenceNo || '', isP2P: rec.isP2P || false,
      foreignAmount: rec.foreignAmount || rec.amount || '', currency: rec.currency || baseCurrency, exchangeRate: rec.exchangeRate || 1, fee: rec.fee || '',
      date: rec.date || getLocalDateTimeString(), isSynced: !!(rec.linkedExpenseId || rec.linkedIncomeId || rec.shiftId || rec.linkedPartyId || rec.isGoalLock),
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

      await deleteDoc(doc(db, 'users', user.uid, 'bankWallet', deleteContext.id));
      await syncBankSummary(user.uid, baseCurrency);
      refreshTransactions();
      setDeleteContext(null); addToast('Entry deleted.', 'info');
    } catch (error) { setPinError('System error.'); }
    finally { setIsVerifying(false); }
  };

  const openModal = () => {
    setFormData(getInitialFormData(globalSummary.existingBanks?.[0] || ''));
    setEditingId(null); setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

  const LedgerSkeleton = () => (
    <div className="space-y-6 sm:space-y-8">
      {[1, 2].map(i => (
        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm animate-pulse">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50"><div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" /></div>
          <div className="p-6 space-y-4">{/* skeleton placeholders */}</div>
        </div>
      ))}
    </div>
  );

  // ======================= RENDER =======================
  return (
    <div className="w-full h-auto pb-24">
      <div className="pt-20 sm:pt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <style>{`@keyframes scrollTicker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } } .animate-ticker-scroll { display: inline-flex; white-space: nowrap; animation: scrollTicker 45s linear infinite; } .animate-ticker-scroll:hover { animation-play-state: paused; }`}</style>

        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-800 p-6 sm:p-8 lg:p-10 shadow-2xl border border-blue-400/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0"><FaUniversity size={28} className="text-white" /></div>
              <div><h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">Bank Vault</h1><p className="text-xs sm:text-sm font-medium text-blue-100 mt-1">Manage institutional assets and deposits</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* ✅ EXPORT BUTTON (opens modal) */}
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

              <button onClick={openModal} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/30"><HiOutlinePlus size={18} /> Log Deposit</button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-white/20">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 col-span-2 lg:col-span-1">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineShieldCheck size={14} /> Total Net Balance</p>
              <p className="text-xl sm:text-2xl font-black text-white truncate">{currencySymbol}{(globalSummary.netBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineExclamationCircle size={14} /> Global Fees Paid</p>
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
          <StatCard title="Total Withdrawn" value={`${currencySymbol}${(globalSummary.totalOutflows || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`} icon={FaArrowUp} color="from-rose-500 to-pink-600" subtitle="Includes Shifts & Expenses" />
          <StatCard title="Active Banks" value={globalSummary.existingBanks?.length || 0} icon={FaUniversity} color="from-purple-500 to-violet-600" subtitle="Connected institutions" />
        </div>

        {globalSummary.subWalletBalances?.length > 0 && (
          <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FaUniversity className="text-blue-500" /> Bank Holdings by Currency</h3>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3">
              {globalSummary.subWalletBalances.map((item, idx) => (<BankBadge key={idx} bank={item.bank} currency={item.currency} amount={item.value} />))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search displayed logs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-14 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all placeholder-slate-400 dark:placeholder-slate-500" />
          </div>
          <div className="flex gap-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full sm:w-auto px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 cursor-pointer transition-all uppercase tracking-widest">
              <option value="all">All Records</option>
              <option value="p2p">⚠️ P2P Only</option>
              <option value="in">Deposits (+)</option>
              <option value="out">Withdrawals (-)</option>
            </select>
          </div>
        </div>

        {/* Ledger (same as original) */}
        {isLoadingLogs ? <LedgerSkeleton /> : filteredLedger.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm px-4 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-5 shadow-inner"><FaUniversity className="text-5xl text-slate-300 dark:text-slate-600" /></div>
            <p className="text-lg font-black text-slate-700 dark:text-slate-300">No recent logs found</p>
            <p className="text-sm font-medium text-slate-500 mt-2 text-center max-w-sm">Adjust search or load more from history.</p>
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
                      <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg"><HiOutlineCalendar size={18} /></div>
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
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page Deposits</p><p className="font-black text-emerald-600">+{currencySymbol}{month.pageIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page Withdrawals</p><p className="font-black text-rose-600">-{currencySymbol}{month.pageOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Period Net Change</p><p className={`font-black ${pageNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pageNet > 0 ? '+' : ''}{currencySymbol}{pageNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                      </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                        {displayedRecords.map(rec => {
                          const dateObj = new Date(rec.date);
                          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const isOut = rec.type === 'out' || rec.type === 'expense';
                          const netChangeText = isOut ? `-${currencySymbol}${Math.abs(rec.netChange).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `+${currencySymbol}${rec.netChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

                          return (
                            <div key={rec.id} className={`p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col gap-3 group ${rec.isP2P ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                              <div className="flex justify-between items-start gap-2 w-full">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isOut ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}><FaUniversity size={16} /></div>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <h3 className="font-black text-sm sm:text-base text-slate-800 dark:text-white break-words" title={rec.title}>{rec.title}</h3>
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 break-words"><span className="text-slate-700 dark:text-slate-300 font-black">{rec.bankName || 'Main Bank'}</span> • {rec.transferType || 'Transfer'}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <p className={`text-base sm:text-lg font-black ${isOut ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{netChangeText}</p>
                                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest whitespace-nowrap">{isOut ? 'Withdrawal' : 'Deposit'}</p>
                                </div>
                              </div>
                              <div className="flex items-end justify-between mt-1">
                                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 w-fit shrink-0">
                                    <HiOutlineCalendar size={12} className="text-slate-500" /> <span className="whitespace-nowrap">{formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}</span>
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  <button onClick={() => handleEdit(rec)} className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-lg transition-colors"><HiOutlinePencil size={14} /></button>
                                  <button onClick={() => initiateDelete(rec)} className="p-2 sm:p-2.5 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-lg transition-colors"><HiOutlineTrash size={14} /></button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-4 text-center text-blue-600 font-black text-sm uppercase tracking-widest">{isExpanded ? 'Show Less' : `View ${hiddenCount} more in ${month.monthName}`}</button>)}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left min-w-[800px]">
                          <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                            <tr><th className="p-4 pl-6 w-20">Type</th><th className="p-4">Details</th><th className="p-4 text-right">Net Impact</th><th className="p-4 pr-6 text-right">Actions</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {displayedRecords.map(rec => {
                              const isOut = rec.type === 'out' || rec.type === 'expense';
                              const netChangeText = isOut ? `-${currencySymbol}${Math.abs(rec.netChange).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `+${currencySymbol}${rec.netChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

                              return (
                                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                                  <td className="p-4 pl-6"><div className={`w-10 h-10 rounded-[0.8rem] flex items-center justify-center shadow-sm ${isOut ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}><FaUniversity size={14} /></div></td>
                                  <td className="p-4">
                                    <p className="font-black text-slate-800 dark:text-slate-100 text-sm truncate">{rec.title}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1"><span className="text-slate-700 dark:text-slate-300 font-black">{rec.bankName || 'Main Bank'}</span> • {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}</p>
                                  </td>
                                  <td className="p-4 text-right align-top"><p className={`text-base font-black ${isOut ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{netChangeText}</p></td>
                                  <td className="p-4 pr-6 align-top">
                                    <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => handleEdit(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-all"><HiOutlinePencil size={14} /></button>
                                      <button onClick={() => initiateDelete(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 transition-all"><HiOutlineTrash size={14} /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-3 text-center text-blue-600 font-black text-sm uppercase tracking-widest">{isExpanded ? 'Show Less' : `View ${hiddenCount} more in ${month.monthName}`}</button>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <div className="flex justify-center py-6">
                <button onClick={loadMore} disabled={isPaginating} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95">
                  {isPaginating ? <HiOutlineRefresh className="animate-spin" size={18} /> : <><HiOutlineChevronDown size={18} /> Load Older Entries</>}
                </button>
              </div>
            )}
          </>
        )}

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
              <div className="px-6 sm:px-8 py-4 sm:py-5 flex justify-between items-center shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <h3 className="text-lg sm:text-xl font-black flex items-center gap-2"><FaArrowDown size={20} />{editingId ? 'Edit Deposit' : 'Log Bank Deposit'}</h3>
                <button onClick={closeModal} className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors active:scale-90"><HiOutlineX size={18} /></button>
              </div>
              <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 pb-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Bank Name *</label>
                    <input type="text" list="bank-names" required value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} placeholder="e.g., SBI" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" />
                    <datalist id="bank-names">{globalSummary.existingBanks?.map(b => <option key={b} value={b} />)}</datalist>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Method</label>
                    <select disabled={formData.isSynced} value={formData.transferType} onChange={e => setFormData({ ...formData, transferType: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm">{bankTransferTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Description *</label>
                  <input disabled={formData.isSynced} type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Salary" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Currency</label>
                    <select disabled={formData.isSynced} value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : '' })} className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm">{availableCurrencies.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Amount *</label>
                    <input disabled={formData.isSynced} type="number" step="any" required value={formData.foreignAmount} onChange={e => setFormData({ ...formData, foreignAmount: e.target.value })} placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" />
                  </div>
                </div>

                {formData.currency !== baseCurrency && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl space-y-3 shadow-sm">
                    <div className="flex items-center justify-between"><label className="text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest">Exchange Rate</label><button type="button" onClick={fetchLiveRate} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg">Live Rate</button></div>
                    <div className="flex items-center gap-3"><span className="text-sm font-black text-slate-700 dark:text-slate-300">1 {formData.currency} =</span><input disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} onChange={e => setFormData({ ...formData, exchangeRate: e.target.value })} className="flex-1 p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-sm outline-none text-slate-900 dark:text-white" /><span className="text-sm font-black text-slate-700 dark:text-slate-300">{baseCurrency}</span></div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Fee (in {baseCurrency})</label><input disabled={formData.isSynced} type="number" step="any" value={formData.fee} onChange={e => setFormData({ ...formData, fee: e.target.value })} placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Ref / UTR</label><input disabled={formData.isSynced} type="text" value={formData.referenceNo} onChange={e => setFormData({ ...formData, referenceNo: e.target.value })} placeholder="e.g., UTR123" className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" /></div>
                </div>

                <div className="p-4 sm:p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl shadow-inner mt-2">
                  <div className="flex justify-between items-center"><span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Net Credit:</span><span className="text-xl font-black text-blue-600 dark:text-blue-400">{currencySymbol}{calculatedFinalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>

                <div className="space-y-1.5 mt-4">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Date & Time *</label>
                  <input disabled={formData.isSynced} type="datetime-local" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none" />
                </div>

                <div className="sticky bottom-0 pt-3 pb-1 bg-white dark:bg-slate-900 z-10">
                  <button type="submit" disabled={isSaving} className="w-full p-4 sm:p-5 rounded-2xl font-black text-sm uppercase tracking-widest text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 bg-gradient-to-r from-blue-600 to-indigo-600"><FaArrowDown size={16} />{isSaving ? 'Processing...' : editingId ? 'Update Deposit' : 'Log Deposit'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {deleteContext && (
          <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white"><h3 className="text-xl font-black">Security Verification</h3></div>
              <form onSubmit={executeSecureDelete} className="p-6 space-y-6">
                <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full text-center tracking-[0.4em] text-2xl p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none" placeholder="••••" />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 uppercase tracking-widest transition-colors">Cancel</button>
                  <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-white bg-gradient-to-r from-rose-600 to-pink-600 uppercase tracking-widest disabled:opacity-50">Confirm</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ✅ EXPORT MODAL (Bottom Sheet on Mobile) */}
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95">
              <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
                <h3 className="text-xl font-black flex items-center gap-2">
                  <HiOutlineDownload size={24} /> Export Report
                </h3>
                <button onClick={() => setIsExportModalOpen(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                  <HiOutlineX size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <button
                  onClick={handleExportPDF}
                  disabled={isGeneratingPDF}
                  className="w-full py-4 px-5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border border-rose-200 dark:border-rose-800"
                >
                  <HiOutlineDocumentText size={20} />
                  {isGeneratingPDF ? 'Generating PDF...' : '📄 PDF Document'}
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={isGeneratingExcel}
                  className="w-full py-4 px-5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border border-emerald-200 dark:border-emerald-800"
                >
                  <HiOutlineTable size={20} />
                  {isGeneratingExcel ? 'Generating Excel...' : '📊 Excel (CSV)'}
                </button>
              </div>
              <div className="px-6 pb-6 text-center text-[10px] text-slate-400">
                The report includes all entries matching your current filters.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankWalletContent;