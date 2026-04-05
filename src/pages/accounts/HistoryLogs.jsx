import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, getDocs, where, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlineSearch, HiOutlineFilter, HiOutlineRefresh, 
  HiOutlineClock, HiOutlineTrendingUp, HiOutlineTrendingDown, 
  HiOutlineSwitchHorizontal, HiOutlineDocumentSearch, HiOutlineTrash,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineArrowDown, HiOutlineArrowUp,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaExchangeAlt, FaBuilding, FaWallet, FaRandom, FaBitcoin, FaUniversity, FaUserFriends, FaMoneyBillWave } from 'react-icons/fa';

// 🚀 SECURE SHA-256 HASHING ALGORITHM
const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const HistoryLogs = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'INR', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); 

  // 🔐 Security (Delete) States
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // 🚀 1. Fetch All 3 Master Collections
  useEffect(() => {
    if (!user) return;

    let incomesLoaded = false;
    let expensesLoaded = false;
    let shiftsLoaded = false;

    const checkLoading = () => {
      if (incomesLoaded && expensesLoaded && shiftsLoaded) setIsLoading(false);
    };

    const unsubIncome = onSnapshot(query(collection(db, "users", user.uid, "incomeLogs"), orderBy("timestamp", "desc")), snap => {
      setIncomes(snap.docs.map(doc => ({ id: doc.id, logType: 'income', ...doc.data() })));
      incomesLoaded = true; checkLoading();
    });

    const unsubExpense = onSnapshot(query(collection(db, "users", user.uid, "expenseLogs"), orderBy("timestamp", "desc")), snap => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, logType: 'expense', ...doc.data() })));
      expensesLoaded = true; checkLoading();
    });

    const unsubShift = onSnapshot(query(collection(db, "users", user.uid, "capitalShifts"), orderBy("timestamp", "desc")), snap => {
      setShifts(snap.docs.map(doc => ({ id: doc.id, logType: 'shift', ...doc.data() })));
      shiftsLoaded = true; checkLoading();
    });

    return () => { unsubIncome(); unsubExpense(); unsubShift(); };
  }, [user]);

  // 🧮 2. Combine, Filter, Sort & Group By Month
  const processedLogs = useMemo(() => {
    const allRecords = [...incomes, ...expenses, ...shifts];

    const filtered = allRecords.filter(rec => {
      const searchTarget = rec.title || (rec.fromVault ? `Shift ${rec.fromVault} to ${rec.toVault}` : '');
      const matchSearch = searchTarget.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'all' || rec.logType === filterType;
      return matchSearch && matchType;
    });

    const sorted = filtered.sort((a, b) => b.timestamp - a.timestamp);

    const grouped = {};
    sorted.forEach(t => {
      const dateObj = new Date(t.date || new Date());
      // 🚀 NAYA LOGIC: Grouping based on the Global Date Format (Month & Year)
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      // Raw English 'YYYY-MM' key for correct chronological sorting behind the scenes
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) {
        grouped[monthKey] = { monthName, records: [], monthInflow: 0, monthOutflow: 0 };
      }

      if (t.logType === 'income') grouped[monthKey].monthInflow += Number(t.finalBaseAmount || 0);
      if (t.logType === 'expense') grouped[monthKey].monthOutflow += Number(t.finalBaseAmount || 0);

      grouped[monthKey].records.push(t);
    });

    return Object.keys(grouped).sort().reverse().map(key => grouped[key]);
  }, [incomes, expenses, shifts, searchTerm, filterType, formatGlobalDate]);

  const lifetimeInflow = incomes.reduce((acc, curr) => acc + Number(curr.finalBaseAmount || 0), 0);
  const lifetimeOutflow = expenses.reduce((acc, curr) => acc + Number(curr.finalBaseAmount || 0), 0);

  const getTypeStyles = (type) => {
    switch(type) {
      case 'income': return { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', icon: <HiOutlineArrowDown size={18} /> };
      case 'expense': return { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', icon: <HiOutlineArrowUp size={18} /> };
      case 'shift': return { bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', icon: <FaExchangeAlt size={16} /> };
      default: return { bg: 'bg-slate-100', text: 'text-slate-500', icon: <HiOutlineClock /> };
    }
  };

  const getVaultIcon = (v) => {
    if (!v) return <FaWallet />;
    if (v.toLowerCase() === 'bank') return <FaUniversity className="text-blue-500" />;
    if (v.toLowerCase() === 'cash') return <FaMoneyBillWave className="text-emerald-500" />;
    if (v.toLowerCase() === 'crypto') return <FaBitcoin className="text-orange-500" />;
    if (v.toLowerCase() === 'online') return <FaWallet className="text-purple-500" />;
    return <FaWallet />;
  };

  // 🚀 REPORT DOWNLOAD LOGIC
  const handleDownloadReport = (format) => {
    const allRecords = [...incomes, ...expenses, ...shifts];
    const filteredForReport = allRecords.filter(rec => {
      const searchTarget = rec.title || (rec.fromVault ? `Shift ${rec.fromVault} to ${rec.toVault}` : '');
      const matchSearch = searchTarget.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'all' || rec.logType === filterType;
      return matchSearch && matchType;
    }).sort((a, b) => b.timestamp - a.timestamp); 

    if (filteredForReport.length === 0) return alert("No records found to download based on current filters.");

    const reportData = filteredForReport.map(rec => {
      let typeLabel = '';
      let detailsLabel = '';
      let vaultImpactLabel = '';
      let amountLabel = '';
      let baseValueLabel = '';

      if (rec.logType === 'income') {
        typeLabel = '[INCOME]';
        detailsLabel = `${(rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ")} (${rec.category})`;
        vaultImpactLabel = `To ${rec.vault} Vault ${rec.subWallet ? `(${rec.subWallet})` : ''}`;
        amountLabel = `+${Number(rec.amount || 0).toLocaleString()} ${rec.asset || rec.currency}`;
        baseValueLabel = `+${currencySymbol}${Math.abs(rec.finalBaseAmount || 0).toFixed(2)}`;
      } 
      else if (rec.logType === 'expense') {
        typeLabel = '[EXPENSE]';
        const isShared = rec.khataDetails && rec.khataDetails.length > 0;
        detailsLabel = `${(rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ")} (${rec.category}) ${isShared ? '[Shared]' : ''}`;
        vaultImpactLabel = rec.isSplit ? 'Split Payment' : `From ${rec.vault} Vault ${rec.subWallet ? `(${rec.subWallet})` : ''}`;
        amountLabel = rec.isSplit ? 'Multi-Asset' : `-${Number(rec.totalPaidFromVault || rec.amount || 0).toLocaleString()} ${rec.asset || rec.currency}`;
        baseValueLabel = `-${currencySymbol}${Math.abs(rec.finalBaseAmount || 0).toFixed(2)}`; // Net Base Amount (Your Expense)
      } 
      else if (rec.logType === 'shift') {
        typeLabel = '[SHIFT]';
        detailsLabel = `Capital Shift via ${rec.routingPlatform || 'Internal'}`;
        vaultImpactLabel = `${rec.fromVault} ➔ ${rec.toVault}`;
        amountLabel = `${Number(rec.grossAmount || 0).toLocaleString()} ${rec.fromAsset || baseCurrency}`;
        baseValueLabel = `↔${currencySymbol}${(Number(rec.grossAmount) * Number(rec.fromExchangeRate)).toFixed(2)}`;
      }

      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        type: typeLabel,
        details: detailsLabel,
        vault: vaultImpactLabel,
        nativeAmount: amountLabel,
        baseEquiv: baseValueLabel
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Payee / Item / Category', key: 'details' },
      { header: 'Vault Routing', key: 'vault' },
      { header: 'Native Asset Qty', key: 'nativeAmount' },
      { header: 'Base Impact', key: 'baseEquiv' }
    ];

    const fileName = `Master_Audit_Trail`;
    const reportTitle = filterType !== 'all' ? `Master Ledger - ${filterType.toUpperCase()}S ONLY` : `Master Ledger - Complete Audit Trail`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  // 🚀 3. THE CLEAN DELETE ENGINE WITH KHATA SYNC REVERSAL
  const initiateDelete = (rec) => {
    setDeleteContext(rec);
    setPinInput('');
    setPinError('');
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your Security PIN.");
    setIsVerifying(true);
    setPinError('');

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userData?.security?.pinHash || userData?.securityPin || userData?.pin; 

      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect PIN. Deletion blocked! 🛑");
        setIsVerifying(false);
        return;
      }

      const rec = deleteContext;
      const allVaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs', 'expenseLogs', 'incomeLogs', 'smartKhata']; 

      if (rec.logType === 'income') {
        await deleteDoc(doc(db, "users", user.uid, "incomeLogs", rec.id));
        if (rec.linkedIncomeId) {
          for (const v of allVaults) {
            const q = query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", rec.linkedIncomeId));
            const snap = await getDocs(q);
            snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
          }
        }
      } 
      else if (rec.logType === 'expense') {
        await deleteDoc(doc(db, "users", user.uid, "expenseLogs", rec.id));
        if (rec.linkedExpenseId) {
          for (const v of allVaults) {
            const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", rec.linkedExpenseId));
            const snap = await getDocs(q);
            snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
          }
          
          // 🚀 SAFE REVERSAL FOR PARTY LEDGER
          const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
          for (const pDoc of partiesSnap.docs) {
             const lQuery = query(collection(db, "users", user.uid, "parties", pDoc.id, "ledger"), where("linkId", "==", rec.linkedExpenseId));
             const lSnap = await getDocs(lQuery);
             
             lSnap.forEach(async (ld) => {
                 const lData = ld.data();
                 const currentPartySnap = await getDoc(doc(db, "users", user.uid, "parties", pDoc.id));
                 if (currentPartySnap.exists()) {
                     const newBal = currentPartySnap.data().netBalance - lData.baseAmount;
                     await updateDoc(doc(db, "users", user.uid, "parties", pDoc.id), {
                         netBalance: newBal,
                         status: newBal === 0 ? 'settled' : 'active'
                     });
                 }
                 await deleteDoc(doc(db, "users", user.uid, "parties", pDoc.id, "ledger", ld.id));
             });
          }
        }
      } 
      else if (rec.logType === 'shift') {
        await deleteDoc(doc(db, "users", user.uid, "capitalShifts", rec.id));
        if (rec.shiftId) {
          for (const v of allVaults) {
            const qShift = query(collection(db, "users", user.uid, v), where("shiftId", "==", rec.shiftId));
            const snapShift = await getDocs(qShift);
            snapShift.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));

            if(v === 'expenseLogs' || v === 'incomeLogs'){
               const field = v === 'expenseLogs' ? 'linkedExpenseId' : 'linkedIncomeId';
               const qExp = query(collection(db, "users", user.uid, v), where(field, "==", rec.shiftId));
               const snapExp = await getDocs(qExp);
               snapExp.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
            }
          }
        }
      }

      setDeleteContext(null); 
    } catch (error) {
      console.error(error);
      setPinError("System error during verification. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 lg:px-0 pt-24 md:pt-8">
      
      {/* 🚀 HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-slate-800 text-white dark:bg-white dark:text-slate-900 rounded-2xl shadow-lg">
              <HiOutlineDocumentSearch size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Master Audit Trail</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            A complete timeline of your entire cash flow, including incomes, expenses, and capital shifts across all vaults.
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* 🚀 DOWNLOAD REPORT DROPDOWN */}
          <div className="relative group">
            <button className="flex items-center gap-1 md:gap-2 p-3 md:p-3.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-2xl font-bold text-xs md:text-sm hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
              <HiOutlineDownload size={18}/> 
              <span className="hidden sm:inline">Export Audit Trail</span>
              <span className="sm:hidden">Export</span>
            </button>
            <div className="absolute top-full right-0 mt-2 w-36 md:w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
              <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineDocumentText className="text-rose-500" size={16}/> As PDF
              </button>
              <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineTable className="text-emerald-500" size={16}/> As Excel (CSV)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Lifetime Inflow</p>
            <p className="text-3xl font-black text-emerald-500">{currencySymbol}{lifetimeInflow.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xl">
            <HiOutlineTrendingUp />
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Lifetime Outflow</p>
            <p className="text-3xl font-black text-rose-500">{currencySymbol}{lifetimeOutflow.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 text-xl">
            <HiOutlineTrendingDown />
          </div>
        </div>
      </div>

      {/* 🔍 FILTERS */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-2 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
          <input type="text" placeholder="Search any transaction, payee, or vault..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-4 py-4 bg-transparent font-bold text-slate-700 dark:text-white outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="w-px bg-slate-200 dark:bg-slate-800 hidden md:block my-2"></div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="pl-5 pr-12 py-4 bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer border-t md:border-t-0 border-slate-200 dark:border-slate-800"
        >
          <option value="all">All Activities</option>
          <option value="income">Incomes Only</option>
          <option value="expense">Expenses Only</option>
          <option value="shift">Capital Shifts Only</option>
        </select>
      </div>

      {/* 📜 THE TIMELINE LEDGER */}
      <div className="space-y-8">
        {isLoading ? (
          <div className="p-16 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <HiOutlineRefresh className="mx-auto text-4xl text-slate-300 dark:text-slate-600 animate-spin mb-4" />
            <p className="text-slate-500 font-bold animate-pulse">Compiling Master Ledger...</p>
          </div>
        ) : processedLogs.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <HiOutlineClock className="mx-auto text-5xl text-slate-200 dark:text-slate-800 mb-4" />
            <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2">No History Found</h3>
            <p className="text-slate-500 font-semibold">Your financial timeline will appear here once you start logging.</p>
          </div>
        ) : (
          processedLogs.map((month, mIdx) => (
            <div key={mIdx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
              
              {/* Month Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{month.monthName}</h2>
                <div className="flex gap-4 text-right">
                  <div className="hidden md:block">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Month Inflow</p>
                    <p className="text-sm font-black text-emerald-500">+{currencySymbol}{month.monthInflow.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Month Outflow</p>
                    <p className="text-sm font-black text-rose-500">-{currencySymbol}{month.monthOutflow.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="p-4 pl-6 w-12 text-center">Type</th>
                      <th className="p-4">Details & Category</th>
                      <th className="p-4">Vault Impact</th>
                      <th className="p-4 text-right">Native Amount / Bill Total</th>
                      <th className="p-4 pr-6 text-right">Net Base Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {month.records.map((rec) => {
                      const style = getTypeStyles(rec.logType);

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group relative">
                          
                          {/* Type Icon */}
                          <td className="p-4 pl-6 text-center">
                            <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
                              {style.icon}
                            </div>
                          </td>

                          {/* Details */}
                          <td className="p-4">
                            {rec.logType === 'shift' ? (
                               <div>
                                 <p className="font-black text-slate-800 dark:text-white text-sm mb-0.5">Capital Shift</p>
                                 <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                   <HiOutlineSwitchHorizontal/> via {rec.routingPlatform || 'Internal'}
                                 </p>
                                 <p className="text-[9px] font-bold text-slate-400 mt-1">
                                   {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                                 </p>
                               </div>
                            ) : (
                               <div>
                                 <p className="font-black text-slate-800 dark:text-white text-sm mb-0.5 truncate max-w-[200px]">{rec.title}</p>
                                 <div className="flex gap-1 flex-wrap">
                                     <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded ${style.bg} ${style.text}`}>
                                       {rec.category}
                                     </span>
                                     {rec.logType === 'expense' && rec.khataDetails && rec.khataDetails.length > 0 && (
                                         <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-500/10 text-[9px] font-black uppercase tracking-wider rounded border border-blue-200 dark:border-blue-900/50 flex items-center gap-1">
                                            <FaUserFriends/> Shared
                                         </span>
                                     )}
                                 </div>
                                 <p className="text-[9px] font-bold text-slate-400 mt-1">
                                   {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                                 </p>
                               </div>
                            )}
                          </td>

                          {/* 🚀 Vault Impact (SUB-WALLET INCLUDED HERE) */}
                          <td className="p-4">
                            {rec.logType === 'shift' ? (
                               <div className="flex flex-col gap-1 items-start">
                                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <span className="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 px-2 py-1 rounded flex items-center gap-1">{rec.fromVault}</span>
                                    <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-1 rounded flex items-center gap-1">{rec.toVault}</span>
                                  </div>
                               </div>
                            ) : rec.isSplit ? (
                               <div className="flex flex-col gap-1.5">
                                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded w-max flex items-center gap-1">
                                    <FaRandom/> Split Payment
                                  </span>
                                  <div className="flex flex-col gap-1 mt-1">
                                    {rec.splitDetails && rec.splitDetails.map((s, idx) => (
                                       <div key={idx} className="flex items-center gap-1.5 text-[10px] font-bold">
                                         <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest flex items-center gap-1 ${s.vault === 'crypto' ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                           {s.vault === 'crypto' ? <><FaBitcoin/> {s.cryptoPlatform || 'Crypto'}</> : <><FaWallet/> {s.vault}</>}
                                         </span>
                                         <span className="text-slate-700 dark:text-slate-300">{s.amount} <span className="text-slate-400 uppercase text-[9px]">{s.asset}</span></span>
                                       </div>
                                    ))}
                                  </div>
                               </div>
                            ) : (
                               <div className="flex flex-col gap-1 items-start">
                                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded w-max flex items-center gap-1">
                                    {getVaultIcon(rec.vault)} {rec.vault} Vault
                                  </span>
                                  {(rec.vault === 'bank' || rec.vault === 'online') && rec.subWallet && (
                                     <span className="text-[9px] font-bold text-blue-500 flex items-center gap-1 ml-1"><FaBuilding/> {rec.subWallet}</span>
                                  )}
                                  {rec.vault === 'crypto' && rec.cryptoPlatform && (
                                     <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 ml-1"><FaBuilding/> {rec.cryptoPlatform}</span>
                                  )}
                               </div>
                            )}
                          </td>

                          {/* Native Amount */}
                          <td className="p-4 text-right">
                             {rec.logType === 'shift' ? (
                               <div className="flex flex-col items-end">
                                 <span className="font-bold text-slate-700 dark:text-slate-300">
                                   {Number(rec.grossAmount).toLocaleString()} <span className="text-[10px] text-slate-400 uppercase">{rec.fromAsset}</span>
                                 </span>
                               </div>
                             ) : (
                               <div className="flex flex-col items-end">
                                 {rec.isSplit ? (
                                   <div className="text-right">
                                     <span className="font-bold text-amber-600 dark:text-amber-500 text-[11px] uppercase tracking-widest">Mixed Assets</span>
                                     <p className="text-[9px] text-slate-400 font-bold mt-0.5">See breakdown ⬅️</p>
                                   </div>
                                 ) : (
                                   <>
                                     <span className={`font-bold ${rec.logType === 'expense' && rec.khataDetails && rec.khataDetails.length > 0 ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                       {Number(rec.totalPaidFromVault || rec.amount || 0).toLocaleString()} <span className="text-[10px] text-slate-400 uppercase">{rec.currency || rec.asset}</span>
                                     </span>
                                     {(rec.currency || rec.asset) !== baseCurrency && (
                                       <p className="text-[9px] text-slate-400 font-bold mt-0.5">@ {rec.exchangeRate} rate</p>
                                     )}
                                   </>
                                 )}
                                 {rec.logType === 'expense' && rec.khataDetails && rec.khataDetails.length > 0 && (
                                     <p className="text-[9px] font-black text-blue-500 uppercase mt-0.5">- Friends Share</p>
                                 )}
                               </div>
                             )}
                          </td>

                          {/* Final Base Value & Delete Button */}
                          <td className="p-4 pr-6 text-right relative">
                            {rec.logType === 'shift' ? (
                              <p className="text-base font-black text-slate-500 dark:text-slate-400">
                                ↔ {currencySymbol}{(Number(rec.grossAmount) * Number(rec.fromExchangeRate)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </p>
                            ) : (
                              <div className="flex flex-col items-end">
                                 <p className={`text-lg font-black tracking-tight ${style.text}`}>
                                   {rec.logType === 'income' ? '+' : '-'}{currencySymbol}{Number(rec.finalBaseAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                 </p>
                                 {rec.logType === 'expense' && rec.khataDetails && rec.khataDetails.length > 0 && (
                                     <p className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-widest text-right">Net Personal Expense</p>
                                 )}
                              </div>
                            )}

                            {/* THE SECURE DELETE BUTTON */}
                            <button 
                              onClick={() => initiateDelete(rec)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-rose-100 text-rose-600 rounded-lg opacity-0 lg:group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                              title="Delete & Reverse this transaction"
                            >
                              <HiOutlineTrash size={18} />
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          ))
        )}
      </div>

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-full flex items-center justify-center text-3xl mb-4">
                <HiOutlineLockClosed />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">
                You are about to permanently delete this {deleteContext.logType}.
              </p>
              
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                  <HiOutlineExclamationCircle size={16} className="shrink-0" />
                  WARNING: This will silently wipe all associated records from Cash, Bank, Online, Crypto vaults, and Smart Khata to keep your total net worth 100% accurate.
                </p>
              </div>
            </div>

            <form onSubmit={executeSecureDelete} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-center block">Enter 4-Digit Security PIN</label>
                <input 
                  type="password" 
                  maxLength={6}
                  required
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                />
                {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50">
                  Verify & Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default HistoryLogs;