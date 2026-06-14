// src/pages/accounts/HistoryLogs.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  collection, query, orderBy, where, limit, startAfter,
  deleteDoc, doc, getDoc, updateDoc, setDoc, getDocs, onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPINEnhanced } from '../../utils/securityUtils';
import { useToast } from '../../hooks/useToastNotification';
import {
  HiOutlineSearch, HiOutlineRefresh,
  HiOutlineClock, HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineSwitchHorizontal, HiOutlineDocumentSearch, HiOutlineTrash,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineArrowDown, HiOutlineArrowUp,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineCalendar, HiOutlineShieldCheck, HiOutlineFilter,
  HiOutlineCash, HiOutlineCheckCircle, HiOutlineInformationCircle,
  HiOutlineX, HiOutlineChevronDown, HiOutlinePencil
} from 'react-icons/hi';
import {
  FaExchangeAlt, FaBuilding, FaWallet, FaRandom, FaBitcoin,
  FaUniversity, FaUserFriends, FaMoneyBillWave, FaHistory, FaChartLine, FaCreditCard
} from 'react-icons/fa';

// ============================================
// 🧩 HELPER COMPONENTS
// ============================================
const ActivityBadge = ({ type }) => {
  const config = {
    income: { bg: 'bg-emerald-500/10', text: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', label: 'INCOME' },
    expense: { bg: 'bg-rose-500/10', text: 'text-rose-500 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-500/30', label: 'EXPENSE' },
    shift: { bg: 'bg-indigo-500/10', text: 'text-indigo-500 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/30', label: 'SHIFT' }
  };
  const c = config[type] || { bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-300', label: 'OTHER' };
  return (
    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${c.bg} ${c.text} border ${c.border} shadow-sm`}>
      {c.label}
    </span>
  );
};

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const HistoryLogsContent = () => {
  const { user, baseCurrency = 'INR', formatGlobalDate, getCalendarMonthKey } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // 🗓️ Collapsible months state
  const getCurrentMonthKey = () => {
      try { return getCalendarMonthKey(new Date().toISOString()); }
      catch { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  };
  const [openMonths, setOpenMonths] = useState(new Set([getCurrentMonthKey()]));
  const toggleMonth = useCallback((monthKey) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  }, []);

  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const toggleExpandMonth = useCallback((monthKey) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  }, []);

  // 🚀 1. FAST MATH ENGINE (Reads directly from the summary docs)
  const [globalStats, setGlobalStats] = useState({ inflow: 0, outflow: 0, totalLogs: 0 });

  useEffect(() => {
    if (!user?.uid) return;
    const unsubInc = onSnapshot(doc(db, 'users', user.uid, 'walletSummary', 'income'), d => {
        if(d.exists()) setGlobalStats(s => ({...s, inflow: d.data().totalIncomeBase || 0, totalLogs: s.totalLogs + (d.data().totalEntries || 0)}));
    });
    const unsubExp = onSnapshot(doc(db, 'users', user.uid, 'walletSummary', 'expense'), d => {
        if(d.exists()) setGlobalStats(s => ({...s, outflow: d.data().totalExpenseBase || 0, totalLogs: s.totalLogs + (d.data().totalEntries || 0)}));
    });
    const unsubShf = onSnapshot(doc(db, 'users', user.uid, 'walletSummary', 'capitalShifts'), d => {
        if(d.exists()) setGlobalStats(s => ({...s, totalLogs: s.totalLogs + (d.data().totalShifts || 0)}));
    });
    return () => { unsubInc(); unsubExp(); unsubShf(); };
  }, [user?.uid]);

  // 🚀 2. MASTER MULTI-COLLECTION PAGINATION ENGINE
  const [logs, setLogs] = useState([]);
  const [cursors, setCursors] = useState({ inc: null, exp: null, shf: null });
  const [isLoading, setLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  const fetchBatch = useCallback(async (isLoadMore = false) => {
      if (!user?.uid) return;
      if (isLoadMore) setIsPaginating(true);
      else { setLoading(true); setLogs([]); setCursors({inc:null, exp:null, shf:null}); }

      try {
          let qInc = query(collection(db, "users", user.uid, "incomeLogs"), orderBy("timestamp", "desc"), limit(pageSize));
          let qExp = query(collection(db, "users", user.uid, "expenseLogs"), orderBy("timestamp", "desc"), limit(pageSize));
          let qShf = query(collection(db, "users", user.uid, "capitalShifts"), orderBy("timestamp", "desc"), limit(pageSize));

          if (isLoadMore) {
              if (cursors.inc && cursors.inc !== 'DONE') qInc = query(collection(db, "users", user.uid, "incomeLogs"), orderBy("timestamp", "desc"), startAfter(cursors.inc), limit(pageSize));
              if (cursors.exp && cursors.exp !== 'DONE') qExp = query(collection(db, "users", user.uid, "expenseLogs"), orderBy("timestamp", "desc"), startAfter(cursors.exp), limit(pageSize));
              if (cursors.shf && cursors.shf !== 'DONE') qShf = query(collection(db, "users", user.uid, "capitalShifts"), orderBy("timestamp", "desc"), startAfter(cursors.shf), limit(pageSize));
          }

          const [snapInc, snapExp, snapShf] = await Promise.all([
              (!isLoadMore || (isLoadMore && cursors.inc !== 'DONE')) ? getDocs(qInc) : Promise.resolve({ docs: [], empty: true }),
              (!isLoadMore || (isLoadMore && cursors.exp !== 'DONE')) ? getDocs(qExp) : Promise.resolve({ docs: [], empty: true }),
              (!isLoadMore || (isLoadMore && cursors.shf !== 'DONE')) ? getDocs(qShf) : Promise.resolve({ docs: [], empty: true })
          ]);

          const incDocs = snapInc.docs.map(d => ({ id: d.id, logType: 'income', ...d.data() }));
          const expDocs = snapExp.docs.map(d => ({ id: d.id, logType: 'expense', ...d.data() }));
          const shfDocs = snapShf.docs.map(d => ({ id: d.id, logType: 'shift', ...d.data() }));

          const merged = [...incDocs, ...expDocs, ...shfDocs].sort((a, b) => b.timestamp - a.timestamp);

          setLogs(prev => isLoadMore ? [...prev, ...merged] : merged);
          setCursors({
              inc: snapInc.empty ? 'DONE' : snapInc.docs[snapInc.docs.length - 1],
              exp: snapExp.empty ? 'DONE' : snapExp.docs[snapExp.docs.length - 1],
              shf: snapShf.empty ? 'DONE' : snapShf.docs[snapShf.docs.length - 1]
          });

          setHasMore(!snapInc.empty || !snapExp.empty || !snapShf.empty);
      } catch (error) {
          console.error("Master Logs Fetch Error:", error);
      } finally {
          setLoading(false);
          setIsPaginating(false);
      }
  }, [user?.uid, cursors, pageSize]);

  useEffect(() => { fetchBatch(); }, [user?.uid]);
  const handleLoadMore = () => fetchBatch(true);
  const handleRefresh = () => fetchBatch(false);


  // 🚀 3. LOCAL UI FILTERING & GROUPING
  const processedLogs = useMemo(() => {
    const filtered = logs.filter(rec => {
      const searchTarget = rec.title || (rec.fromVault ? `Shift ${rec.fromVault} to ${rec.toVault}` : '');
      const matchSearch = searchTarget.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'all' || rec.logType === filterType;
      return matchSearch && matchType;
    });

    const grouped = {};
    filtered.forEach(t => {
      const dateObj = new Date(t.date || new Date());
      let monthKey;
      try { monthKey = getCalendarMonthKey(t.date || t.timestamp); } 
      catch { monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`; }

      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

      if (!grouped[monthKey]) grouped[monthKey] = {
        monthKey, monthName, records: [], pageInflow: 0, pageOutflow: 0
      };

      const baseAmt = Number(t.finalBaseAmount) || 0;
      if (t.logType === 'income') grouped[monthKey].pageInflow += baseAmt;
      else if (t.logType === 'expense') grouped[monthKey].pageOutflow += baseAmt;
      
      grouped[monthKey].records.push(t);
    });

    return Object.keys(grouped)
      .sort((a, b) => (grouped[b].records[0]?.timestamp || 0) - (grouped[a].records[0]?.timestamp || 0))
      .map(key => grouped[key]);
  }, [logs, searchTerm, filterType, formatGlobalDate, getCalendarMonthKey]);


  // Type styles for icons
  const getTypeStyles = (type) => {
    switch(type) {
      case 'income': return { bg: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', icon: <HiOutlineArrowDown size={18} /> };
      case 'expense': return { bg: 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-500/30', icon: <HiOutlineArrowUp size={18} /> };
      case 'shift': return { bg: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/30', icon: <FaExchangeAlt size={16} /> };
      default: return { bg: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', border: 'border-slate-300 dark:border-slate-700', icon: <HiOutlineClock /> };
    }
  };

  const getVaultIcon = (v) => {
    if (!v) return <FaWallet />;
    const vl = v.toLowerCase();
    if (vl === 'bank') return <FaUniversity className="text-blue-500" />;
    if (vl === 'cash') return <FaMoneyBillWave className="text-emerald-500" />;
    if (vl === 'crypto') return <FaBitcoin className="text-orange-500" />;
    if (vl === 'online') return <FaWallet className="text-purple-500" />;
    return <FaCreditCard className="text-slate-500" />;
  };

  // ✅ EXPORT REPORT (Modal Handlers)
  const handleExportPDF = async () => {
    setIsExportModalOpen(false);
    setIsGeneratingPDF(true);
    const filteredForReport = processedLogs.flatMap(m => m.records);
    
    if (filteredForReport.length === 0) { addToast("No records found.", "warning"); setIsGeneratingPDF(false); return; }

    const reportData = filteredForReport.map(rec => {
      const rawDate = rec.date ? rec.date.split('T')[0] : 'N/A';
      if (rec.logType === 'income') {
        return {
          date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rawDate,
          type: 'INCOME', details: `${rec.title} (${rec.category})`.replace(/(\r\n|\n|\r)/gm, " "),
          vault: `${rec.vault}${rec.subWallet ? ` - ${rec.subWallet}` : ''}`,
          nativeAmount: `+${Number(rec.amount || 0).toLocaleString()} ${rec.asset}`,
          inflowBase: Number(rec.finalBaseAmount || 0), outflowBase: 0,
        };
      } else if (rec.logType === 'expense') {
        return {
          date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rawDate,
          type: 'EXPENSE', details: `${rec.title} (${rec.category})`.replace(/(\r\n|\n|\r)/gm, " "),
          vault: rec.isSplit ? 'Split Payment' : `${rec.vault}${rec.subWallet ? ` - ${rec.subWallet}` : ''}`,
          nativeAmount: rec.isSplit ? 'Multi-Asset' : `-${Number(rec.totalPaidFromVault || rec.amount || 0).toLocaleString()} ${rec.asset}`,
          inflowBase: 0, outflowBase: Number(rec.finalBaseAmount || 0),
        };
      } else {
        return {
          date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rawDate,
          type: 'SHIFT (Internal)', details: (rec.routingPlatform || 'Direct Transfer').replace(/(\r\n|\n|\r)/gm, " "),
          vault: `${rec.fromVault} ➔ ${rec.toVault}`, nativeAmount: `${Number(rec.grossAmount || 0).toLocaleString()} ${rec.fromAsset}`,
          inflowBase: 0, outflowBase: 0
        };
      }
    });

    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Activity Type', key: 'type' },
      { header: 'Details / Description', key: 'details' }, { header: 'Vault Involved', key: 'vault' },
      { header: 'Native Amount', key: 'nativeAmount' },
      { header: `Total Inflow (${currencySymbol})`, key: 'inflowBase', isNumeric: true },
      { header: `Total Outflow (${currencySymbol})`, key: 'outflowBase', isNumeric: true }
    ];

    try { await downloadPDFReport(reportData, columns, 'Master_Audit_Trail', 'Master Ledger Timeline', { onSuccess: () => addToast('PDF downloaded!', 'success'), onError: msg => addToast(`Error: ${msg}`, 'error') }); } 
    finally { setIsGeneratingPDF(false); }
  };

  const handleExportExcel = async () => {
    setIsExportModalOpen(false);
    setIsGeneratingExcel(true);
    const filteredForReport = processedLogs.flatMap(m => m.records);
    if (filteredForReport.length === 0) { addToast("No records found.", "warning"); setIsGeneratingExcel(false); return; }

    const reportData = filteredForReport.map(rec => {
      const rawDate = rec.date ? rec.date.split('T')[0] : 'N/A';
      if (rec.logType === 'income') {
        return { Date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rawDate, Type: 'INCOME', Details: `${rec.title} (${rec.category})`.replace(/(\r\n|\n|\r)/gm, " "), Vault: `${rec.vault}${rec.subWallet ? ` - ${rec.subWallet}` : ''}`, NativeAmount: `+${Number(rec.amount || 0).toLocaleString()} ${rec.asset}`, Inflow: Number(rec.finalBaseAmount || 0).toFixed(2), Outflow: "0.00" };
      } else if (rec.logType === 'expense') {
        return { Date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rawDate, Type: 'EXPENSE', Details: `${rec.title} (${rec.category})`.replace(/(\r\n|\n|\r)/gm, " "), Vault: rec.isSplit ? 'Split Payment' : `${rec.vault}${rec.subWallet ? ` - ${rec.subWallet}` : ''}`, NativeAmount: rec.isSplit ? 'Multi-Asset' : `-${Number(rec.totalPaidFromVault || rec.amount || 0).toLocaleString()} ${rec.asset}`, Inflow: "0.00", Outflow: Number(rec.finalBaseAmount || 0).toFixed(2) };
      } else {
        return { Date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rawDate, Type: 'SHIFT', Details: (rec.routingPlatform || 'Direct Transfer').replace(/(\r\n|\n|\r)/gm, " "), Vault: `${rec.fromVault} -> ${rec.toVault}`, NativeAmount: `${Number(rec.grossAmount || 0).toLocaleString()} ${rec.fromAsset}`, Inflow: "0.00", Outflow: "0.00" };
      }
    });

    const headers = Object.keys(reportData[0]);
    const csvRows = [headers.join(',')];
    for (const row of reportData) { csvRows.push(headers.map(header => `"${row[header]}"`).join(',')); }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Master_Audit_Trail.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    addToast('Excel downloaded!', 'success'); setIsGeneratingExcel(false);
  };


  const initiateDelete = (rec) => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

  // 🚀 MASTER DELETE REVERSAL ENGINE
  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your Security PIN.");
    setIsVerifying(true); setPinError('');

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const storedHash = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin;
      const { valid, newHash } = await verifyPINEnhanced(pinInput.trim(), storedHash, user.uid);

      if (!valid) { setPinError("Incorrect PIN. Deletion blocked!"); setIsVerifying(false); return; }
      if (newHash) { await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true }); }

      const rec = deleteContext;
      const vaultCollections = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs', 'expenseLogs', 'incomeLogs'];

      if (rec.logType === 'income') {
        await deleteDoc(doc(db, "users", user.uid, "incomeLogs", rec.id));
        if (rec.linkedIncomeId) {
          for (const v of vaultCollections) {
            const snaps = await getDocs(query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", rec.linkedIncomeId)));
            snaps.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
          }
          const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
          for (const pDoc of partiesSnap.docs) {
            const lSnap = await getDocs(query(collection(db, "users", user.uid, "parties", pDoc.id, "ledger"), where("linkId", "==", rec.linkedIncomeId)));
            lSnap.forEach(async (ld) => {
              const lData = ld.data();
              const currentPartySnap = await getDoc(doc(db, "users", user.uid, "parties", pDoc.id));
              if (currentPartySnap.exists()) {
                const newBal = currentPartySnap.data().netBalance - lData.baseAmount;
                await updateDoc(doc(db, "users", user.uid, "parties", pDoc.id), { netBalance: newBal, status: newBal === 0 ? 'settled' : 'active' });
              }
              await deleteDoc(doc(db, "users", user.uid, "parties", pDoc.id, "ledger", ld.id));
            });
          }
        }
      } else if (rec.logType === 'expense') {
        await deleteDoc(doc(db, "users", user.uid, "expenseLogs", rec.id));
        if (rec.linkedExpenseId) {
          for (const v of vaultCollections) {
            const snaps = await getDocs(query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", rec.linkedExpenseId)));
            snaps.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
          }
          const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
          for (const pDoc of partiesSnap.docs) {
            const lSnap = await getDocs(query(collection(db, "users", user.uid, "parties", pDoc.id, "ledger"), where("linkId", "==", rec.linkedExpenseId)));
            lSnap.forEach(async (ld) => {
              const lData = ld.data();
              const currentPartySnap = await getDoc(doc(db, "users", user.uid, "parties", pDoc.id));
              if (currentPartySnap.exists()) {
                const newBal = currentPartySnap.data().netBalance - lData.baseAmount;
                await updateDoc(doc(db, "users", user.uid, "parties", pDoc.id), { netBalance: newBal, status: newBal === 0 ? 'settled' : 'active' });
              }
              await deleteDoc(doc(db, "users", user.uid, "parties", pDoc.id, "ledger", ld.id));
            });
          }
        }
      } else if (rec.logType === 'shift') {
        await deleteDoc(doc(db, "users", user.uid, "capitalShifts", rec.id));
        if (rec.shiftId) {
          for (const v of vaultCollections) {
            const snaps = await getDocs(query(collection(db, "users", user.uid, v), where("shiftId", "==", rec.shiftId)));
            snaps.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
          }
        }
      }

      // ✅ SMART CROSS-VAULT SYNC (Invalidate ALL summaries because Master History can touch anything)
      const vaultsToClear = ['bank', 'cash', 'online', 'crypto', 'income', 'expense', 'capitalShifts'];
      for (const v of vaultsToClear) {
        await deleteDoc(doc(db, 'users', user.uid, 'walletSummary', v));
      }

      setDeleteContext(null);
      addToast(`${rec.logType.charAt(0).toUpperCase() + rec.logType.slice(1)} reversed and deleted.`, 'info');
      handleRefresh(); // Refresh logs
    } catch (error) {
      setPinError("System error during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Skeleton component for loading
  const Skeleton = () => (
    <div className="space-y-6">
      {[1,2].map(i => (
        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm animate-pulse">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
            <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="p-6 space-y-4">
            {[1,2,3].map(j => (
              <div key={j} className="flex items-center gap-6">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
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
        
        {/* Header with Export */}
        <div className="relative rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 lg:p-10 shadow-2xl border border-slate-700/50 z-20">
          <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(100,116,139,0.1),transparent_70%)]" />
             <div className="absolute right-0 top-0 w-64 h-64 bg-slate-500/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                  <FaHistory size={24} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight truncate">Master Audit Trail</h1>
                  <p className="text-sm font-medium text-slate-400 truncate">Complete timeline of all financial activities</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
              {/* ✅ EXPORT BUTTON (Modal Trigger) */}
              <div className="relative w-full md:w-auto z-[100]">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  disabled={isGeneratingPDF || isGeneratingExcel}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 active:scale-95 shadow-sm disabled:opacity-50"
                >
                  {isGeneratingPDF || isGeneratingExcel ? <><HiOutlineRefresh className="animate-spin" size={16} /> Generating...</> : <><HiOutlineDownload size={16} /> Export Master Ledger</>}
                </button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="relative z-30 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineTrendingUp size={14}/> Total Inflow</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 truncate" title={`${currencySymbol}${globalStats.inflow}`}>{currencySymbol}{(globalStats.inflow || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineTrendingDown size={14}/> Total Outflow</p>
              <p className="text-xl sm:text-2xl font-black text-rose-400 truncate" title={`${currencySymbol}${globalStats.outflow}`}>{currencySymbol}{(globalStats.outflow || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 col-span-2 md:col-span-1 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><FaChartLine size={12}/> Total Activities</p>
              <p className="text-xl sm:text-2xl font-black text-white truncate">{globalStats.totalLogs || 0}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text" placeholder="Search transactions, payees, or vaults..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-slate-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative w-full sm:w-auto">
              <select
                value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="w-full sm:w-auto pl-4 pr-10 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs sm:text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-slate-500 cursor-pointer transition-all shadow-sm appearance-none"
              >
                <option value="all">All Activities</option>
                <option value="income">Incomes Only</option>
                <option value="expense">Expenses Only</option>
                <option value="shift">Capital Shifts Only</option>
              </select>
              <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
            </div>
          </div>
        </div>

        {/* 🚀 COLLAPSIBLE MONTHS LEDGER */}
        {isLoading ? (
          <Skeleton />
        ) : processedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm px-4">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-5 shadow-inner">
              <HiOutlineDocumentSearch className="text-5xl text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-lg font-black text-slate-700 dark:text-slate-300">No history records found</p>
            <p className="text-sm font-medium text-slate-500 mt-2 text-center max-w-sm">{searchTerm || filterType !== 'all' ? 'Adjust your search filters.' : 'Your financial timeline will appear here.'}</p>
          </div>
        ) : (
          <>
            {processedLogs.map((month) => {
              const isOpen = openMonths.has(month.monthKey);
              const isExpanded = expandedMonths.has(month.monthKey);
              const THRESHOLD = 20;
              const hasMoreRecords = month.records.length > THRESHOLD;
              const hiddenCount = Math.max(0, month.records.length - THRESHOLD);
              const displayedRecords = isExpanded ? month.records : month.records.slice(0, THRESHOLD);
              
              const inflow = month.pageInflow || 0;
              const outflow = month.pageOutflow || 0;

              return (
                <div key={month.monthKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm">
                  {/* Month Header Toggle */}
                  <button
                    onClick={() => toggleMonth(month.monthKey)}
                    className="w-full px-6 py-5 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left"
                  >
                    <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="p-2 bg-slate-200 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 rounded-lg">
                        <HiOutlineCalendar size={18} />
                      </div>
                      {month.monthName}
                    </h2>
                    <div className="flex items-center gap-4">
                      <HiOutlineChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="animate-in fade-in duration-200">
                      {/* Month Summary */}
                      <div className="px-6 py-4 grid grid-cols-3 gap-4 bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800">
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Logs Shown</p><p className="font-black text-slate-700 dark:text-slate-300">{month.records.length}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page Inflow</p><p className="font-black text-emerald-600">+{currencySymbol}{inflow.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page Outflow</p><p className="font-black text-rose-600">-{currencySymbol}{outflow.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                      </div>

                      {/* 📱 Mobile Cards */}
                      <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                        {displayedRecords.map((rec) => {
                          const style = getTypeStyles(rec.logType);
                          const dateObj = new Date(rec.date);
                          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={rec.id} className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0 pr-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bg} ${style.text} border ${style.border}`}>
                                      {style.icon}
                                    </div>
                                    <ActivityBadge type={rec.logType} />
                                  </div>
                                  {rec.logType === 'shift' ? (
                                    <p className="font-black text-slate-900 dark:text-white text-sm mt-1">Capital Shift</p>
                                  ) : (
                                    <p className="font-black text-slate-900 dark:text-white text-sm break-words">{rec.title}</p>
                                  )}
                                  {rec.category && rec.logType !== 'shift' && (
                                    <span className="inline-block px-1.5 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[8px] font-black uppercase tracking-wider rounded mt-1 border border-rose-200 dark:border-rose-500/20 shadow-sm">{rec.category}</span>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  {rec.logType === 'shift' ? (
                                    <p className="text-base font-black text-indigo-600 dark:text-indigo-400 tracking-tight">↔</p>
                                  ) : (
                                    <>
                                      <p className={`text-base font-black tracking-tight ${rec.logType === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {rec.logType === 'income' ? '+' : '-'}{currencySymbol}{(Number(rec.finalBaseAmount) || 0).toLocaleString(undefined, {minimumFractionDigits: 0})}
                                      </p>
                                      {rec.asset !== baseCurrency && !rec.isSplit && rec.logType !== 'shift' && (
                                        <p className="text-[9px] font-bold text-slate-500 mt-1">{Number(rec.amount || 0).toLocaleString()} {rec.asset}</p>
                                      )}
                                      {rec.isSplit && <p className="text-[9px] font-bold text-slate-500 mt-1">Multi-Asset</p>}
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap justify-between items-end gap-2 mt-3">
                                <div className="flex flex-col gap-1.5">
                                  {rec.logType === 'shift' ? (
                                    <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-md text-[9px] font-black text-indigo-700 dark:text-indigo-400">
                                      <span>{rec.fromVault}</span> <FaExchangeAlt size={10} /> <span>{rec.toVault}</span>
                                    </div>
                                  ) : rec.isSplit ? (
                                    <span className="px-2 py-1 bg-amber-100/50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-md text-[9px] font-black text-amber-800 dark:text-amber-400 flex items-center gap-1"><FaRandom /> Split Engine</span>
                                  ) : (
                                    <div className="flex items-center gap-1.5 w-max px-2 py-1 rounded-md border text-[9px] font-bold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                      {getVaultIcon(rec.vault)} <span className="capitalize">{rec.vault}</span>
                                      {rec.subWallet && <span className="opacity-70 ml-0.5 break-words">· {rec.subWallet}</span>}
                                    </div>
                                  )}
                                  <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                    <HiOutlineCalendar size={10}/> {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}
                                    <span className="opacity-50">· {timeStr}</span>
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => initiateDelete(rec)} className="p-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-md border border-rose-200 dark:border-rose-500/30 shadow-sm"><HiOutlineTrash size={14} /></button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-4 text-center text-slate-600 dark:text-slate-400 font-black text-sm uppercase tracking-widest border-t border-slate-100 dark:border-slate-800/50">{isExpanded ? 'Show Less' : `View ${hiddenCount} more records`}</button>)}
                      </div>

                      {/* 🖥️ Desktop Table */}
                      <div className="hidden md:block overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left min-w-[900px]">
                          <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="p-4 pl-6 text-center w-16">Type</th>
                              <th className="p-4">Details</th>
                              <th className="p-4">Vault Impact</th>
                              <th className="p-4 text-right">Native Amount</th>
                              <th className="p-4 text-right">Base Value</th>
                              <th className="p-4 pr-6 text-right w-16">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {displayedRecords.map((rec) => {
                              const style = getTypeStyles(rec.logType);
                              const dateObj = new Date(rec.date);
                              const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              return (
                                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                                  <td className="p-4 pl-6 text-center align-top">
                                    <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center ${style.bg} ${style.text} border ${style.border}`}>
                                      {style.icon}
                                    </div>
                                  </td>
                                  <td className="p-4 align-top">
                                    {rec.logType === 'shift' ? (
                                      <div>
                                        <p className="font-black text-slate-900 dark:text-white text-sm">Capital Shift</p>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                                          <HiOutlineSwitchHorizontal size={14}/> {rec.routingPlatform || 'Internal Network'}
                                        </p>
                                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
                                          {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}
                                          <span className="opacity-60 border-l border-slate-300 dark:border-slate-600 pl-1 ml-1">{timeStr}</span>
                                        </p>
                                      </div>
                                    ) : (
                                      <div>
                                        <p className="font-black text-slate-900 dark:text-white text-sm truncate max-w-[200px]" title={rec.title}>{rec.title}</p>
                                        <div className="flex gap-1.5 flex-wrap mt-1.5">
                                          <ActivityBadge type={rec.logType} />
                                          {rec.khataDetails?.length > 0 && (
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 border border-blue-200 dark:border-blue-500/30 shadow-sm">
                                              <FaUserFriends size={10}/> SHARED
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1.5">
                                          {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}
                                          <span className="opacity-60 border-l border-slate-300 dark:border-slate-600 pl-1 ml-0.5">{timeStr}</span>
                                          <span className="text-slate-300 dark:text-slate-600 px-1">•</span>
                                          <span className="truncate max-w-[100px]">{rec.category}</span>
                                        </p>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-4 align-top">
                                    {rec.logType === 'shift' ? (
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="px-2 py-1 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-md text-[9px] font-black uppercase tracking-widest">{rec.fromVault}</span>
                                        <FaExchangeAlt className="text-slate-400" size={10} />
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-md text-[9px] font-black uppercase tracking-widest">{rec.toVault}</span>
                                      </div>
                                    ) : rec.isSplit ? (
                                      <span className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded-md text-[9px] font-black flex items-center gap-1 w-fit shadow-sm mt-0.5 uppercase tracking-widest">
                                        <FaRandom size={10}/> Split Engine
                                      </span>
                                    ) : (
                                      <div className="flex flex-col gap-1 mt-0.5">
                                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 capitalize">
                                          {getVaultIcon(rec.vault)} {rec.vault} Vault
                                        </span>
                                        {rec.subWallet && (
                                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 w-fit px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 mt-1">
                                            <FaBuilding size={10}/> {rec.subWallet}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-4 text-right align-top">
                                    {rec.logType === 'shift' ? (
                                      <p className="font-bold text-slate-800 dark:text-slate-300 mt-0.5">
                                        {Number(rec.grossAmount).toLocaleString()} <span className="text-[10px] text-slate-500 font-bold">{rec.fromAsset}</span>
                                      </p>
                                    ) : rec.isSplit ? (
                                      <span className="text-amber-600 dark:text-amber-500 text-[9px] font-black uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2 py-1 rounded-md inline-block mt-0.5">MULTI-ASSET</span>
                                    ) : (
                                      <p className={`font-bold mt-0.5 ${rec.logType === 'expense' && rec.khataDetails?.length > 0 ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-300'}`}>
                                        {Number(rec.totalPaidFromVault || rec.amount || 0).toLocaleString()} <span className="text-[10px] text-slate-500 font-bold">{rec.currency || rec.asset}</span>
                                      </p>
                                    )}
                                  </td>
                                  <td className="p-4 text-right align-top">
                                    <p className={`text-base font-black tracking-tight mt-0.5 ${rec.logType === 'income' ? 'text-emerald-600 dark:text-emerald-400' : rec.logType === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                      {rec.logType === 'shift' ? '↔' : (rec.logType === 'income' ? '+' : '-')}
                                      {currencySymbol}{Number(rec.finalBaseAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </p>
                                  </td>
                                  <td className="p-4 pr-6 align-top text-right">
                                    <button
                                      onClick={() => initiateDelete(rec)}
                                      className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/20 border border-slate-300 dark:border-slate-700 rounded-lg transition-all md:opacity-0 group-hover:opacity-100 shadow-sm active:scale-95"
                                      title={`Delete this ${rec.logType} record`}
                                    >
                                      <HiOutlineTrash size={16} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-3 text-center text-slate-600 dark:text-slate-400 font-black text-sm uppercase tracking-widest">{isExpanded ? 'Show Less' : `View ${hiddenCount} more records`}</button>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* ✅ PAGINATION BUTTON */}
            {hasMore && (
              <div className="flex justify-center py-6">
                <button 
                  onClick={handleLoadMore} 
                  disabled={isPaginating} 
                  className="px-8 py-4 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
                >
                  {isPaginating ? <HiOutlineRefresh className="animate-spin" size={18} /> : <><HiOutlineChevronDown size={18} /> Load Older Activities</>}
                </button>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Modal */}
        {deleteContext && (
          <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-700 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
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
                    Deleting this <span className="font-black capitalize">{deleteContext.logType}</span> will reverse all associated vault entries and update connected Khata balances automatically across the system.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 text-center block">Security PIN</label>
                  <input
                    type="password" maxLength={6} required autoFocus
                    value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                    className="w-full text-center tracking-[0.4em] text-2xl p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm focus:border-rose-500"
                    placeholder="••••"
                  />
                  {pinError && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-2 text-center animate-bounce">{pinError}</p>}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors shadow-sm active:scale-95 uppercase tracking-widest">
                    Cancel
                  </button>
                  <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 active:scale-95 uppercase tracking-widest">
                    {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : <HiOutlineTrash size={18} />}
                    Confirm
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
              <div className="px-6 py-5 bg-gradient-to-r from-slate-700 to-slate-800 text-white flex justify-between items-center">
                <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineDownload size={24} /> Export Master Audit</h3>
                <button onClick={() => setIsExportModalOpen(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <button onClick={() => handleDownloadReport('pdf')} disabled={isGeneratingPDF} className="w-full py-4 px-5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border border-rose-200 dark:border-rose-800">
                  <HiOutlineDocumentText size={20} />{isGeneratingPDF ? 'Generating PDF...' : '📄 PDF Document'}
                </button>
                <button onClick={() => handleDownloadReport('excel')} disabled={isGeneratingExcel} className="w-full py-4 px-5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border border-emerald-200 dark:border-emerald-800">
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

export default HistoryLogsContent;