import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, getDocs, where, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

// 🚀 FIXED: Removed missing 'HiOutlineBuildingOffice' & 'HiOutlineCreditCard'
import { 
  HiOutlineSearch, HiOutlineRefresh, 
  HiOutlineClock, HiOutlineTrendingUp, HiOutlineTrendingDown, 
  HiOutlineSwitchHorizontal, HiOutlineDocumentSearch, HiOutlineTrash,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineArrowDown, HiOutlineArrowUp,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineCalendar, HiOutlineShieldCheck, HiOutlineFilter,
  HiOutlineCash, HiOutlineChartBar
} from 'react-icons/hi';
import { 
  FaExchangeAlt, FaBuilding, FaWallet, FaRandom, FaBitcoin, 
  FaUniversity, FaUserFriends, FaMoneyBillWave, FaGem, FaHistory 
} from 'react-icons/fa';

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// 🚀 Premium Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${color} text-white shadow-xl group hover:scale-[1.02] transition-all duration-300`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_70%)]" />
    <Icon className="absolute right-[-10%] bottom-[-10%] text-7xl opacity-10 group-hover:scale-110 transition-transform duration-500" />
    <div className="relative z-10">
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{title}</p>
      <h3 className="text-2xl font-black tracking-tight">{value}</h3>
      {subtitle && <p className="text-[9px] font-medium opacity-70 mt-1">{subtitle}</p>}
    </div>
  </div>
);

// 🚀 Premium Activity Badge
const ActivityBadge = ({ type }) => {
  const config = {
    income: { bg: 'bg-emerald-500/10', text: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', label: 'INCOME' },
    expense: { bg: 'bg-rose-500/10', text: 'text-rose-500 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-500/30', label: 'EXPENSE' },
    shift: { bg: 'bg-indigo-500/10', text: 'text-indigo-500 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/30', label: 'SHIFT' }
  };
  const c = config[type] || { bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-300', label: 'OTHER' };
  return (
    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.bg} ${c.text} border ${c.border} shadow-sm`}>
      {c.label}
    </span>
  );
};

const HistoryLogs = () => {
  const { user, baseCurrency = 'INR', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); 
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!user) return;
    let incomesLoaded = false, expensesLoaded = false, shiftsLoaded = false;
    const checkLoading = () => { if (incomesLoaded && expensesLoaded && shiftsLoaded) setIsLoading(false); };

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
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) grouped[monthKey] = { monthName, records: [], monthInflow: 0, monthOutflow: 0 };
      if (t.logType === 'income') grouped[monthKey].monthInflow += Number(t.finalBaseAmount || 0);
      if (t.logType === 'expense') grouped[monthKey].monthOutflow += Number(t.finalBaseAmount || 0);
      grouped[monthKey].records.push(t);
    });

    return Object.keys(grouped).sort().reverse().map(key => grouped[key]);
  }, [incomes, expenses, shifts, searchTerm, filterType, formatGlobalDate]);

  const lifetimeInflow = incomes.reduce((acc, curr) => acc + Number(curr.finalBaseAmount || 0), 0);
  const lifetimeOutflow = expenses.reduce((acc, curr) => acc + Number(curr.finalBaseAmount || 0), 0);
  const totalTransactions = incomes.length + expenses.length + shifts.length;

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
    if (v.toLowerCase() === 'bank') return <FaUniversity className="text-blue-500" />;
    if (v.toLowerCase() === 'cash') return <FaMoneyBillWave className="text-emerald-500" />;
    if (v.toLowerCase() === 'crypto') return <FaBitcoin className="text-orange-500" />;
    if (v.toLowerCase() === 'online') return <FaWallet className="text-purple-500" />;
    return <FaWallet />;
  };

  const handleDownloadReport = (format) => {
    const allRecords = [...incomes, ...expenses, ...shifts];
    const filteredForReport = allRecords.filter(rec => {
      const searchTarget = rec.title || (rec.fromVault ? `Shift ${rec.fromVault} to ${rec.toVault}` : '');
      const matchSearch = searchTarget.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'all' || rec.logType === filterType;
      return matchSearch && matchType;
    }).sort((a, b) => b.timestamp - a.timestamp); 

    if (filteredForReport.length === 0) return alert("No records found to download.");

    const reportData = filteredForReport.map(rec => {
      if (rec.logType === 'income') {
        return {
          date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
          type: 'INCOME',
          details: `${rec.title} (${rec.category})`,
          vault: `${rec.vault}${rec.subWallet ? ` - ${rec.subWallet}` : ''}`,
          amount: `+${Number(rec.amount || 0).toLocaleString()} ${rec.asset}`,
          baseValue: `+${currencySymbol}${rec.finalBaseAmount?.toFixed(2)}`
        };
      } else if (rec.logType === 'expense') {
        return {
          date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
          type: 'EXPENSE',
          details: `${rec.title} (${rec.category})`,
          vault: rec.isSplit ? 'Split Payment' : `${rec.vault}${rec.subWallet ? ` - ${rec.subWallet}` : ''}`,
          amount: rec.isSplit ? 'Multi-Asset' : `-${Number(rec.totalPaidFromVault || rec.amount || 0).toLocaleString()} ${rec.asset}`,
          baseValue: `-${currencySymbol}${rec.finalBaseAmount?.toFixed(2)}`
        };
      } else {
        return {
          date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
          type: 'SHIFT',
          details: rec.routingPlatform || 'Internal Transfer',
          vault: `${rec.fromVault} ➔ ${rec.toVault}`,
          amount: `${Number(rec.grossAmount || 0).toLocaleString()} ${rec.fromAsset}`,
          baseValue: `↔${currencySymbol}${(Number(rec.grossAmount) * Number(rec.fromExchangeRate)).toFixed(2)}`
        };
      }
    });

    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Type', key: 'type' }, { header: 'Details', key: 'details' },
      { header: 'Vault', key: 'vault' }, { header: 'Amount', key: 'amount' }, { header: 'Base Value', key: 'baseValue' }
    ];

    const fileName = `Master_Audit_Trail`;
    const reportTitle = `Master Ledger - ${filterType !== 'all' ? filterType.toUpperCase() : 'Complete'} Audit Trail`;

    if (format === 'pdf') downloadPDFReport(reportData, columns, fileName, reportTitle);
    else downloadExcelReport(reportData, columns, fileName);
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
        setPinError("Incorrect PIN. Deletion blocked!");
        setIsVerifying(false); return;
      }

      const rec = deleteContext;
      const allVaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs', 'expenseLogs', 'incomeLogs']; 

      if (rec.logType === 'income') {
        await deleteDoc(doc(db, "users", user.uid, "incomeLogs", rec.id));
        if (rec.linkedIncomeId) {
          for (const v of allVaults) {
            const q = query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", rec.linkedIncomeId));
            const snap = await getDocs(q);
            snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
          }
          // 🚀 CRITICAL FIX: Reversing Smart Khata balances on Income deletion
          const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
          for (const pDoc of partiesSnap.docs) {
             const lQuery = query(collection(db, "users", user.uid, "parties", pDoc.id, "ledger"), where("linkId", "==", rec.linkedIncomeId));
             const lSnap = await getDocs(lQuery);
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
          for (const v of allVaults) {
            const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", rec.linkedExpenseId));
            const snap = await getDocs(q);
            snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
          }
          
          const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
          for (const pDoc of partiesSnap.docs) {
             const lQuery = query(collection(db, "users", user.uid, "parties", pDoc.id, "ledger"), where("linkId", "==", rec.linkedExpenseId));
             const lSnap = await getDocs(lQuery);
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
          for (const v of allVaults) {
            const qShift = query(collection(db, "users", user.uid, v), where("shiftId", "==", rec.shiftId));
            const snapShift = await getDocs(qShift);
            snapShift.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
          }
        }
      }

      setDeleteContext(null); 
    } catch (error) {
      setPinError("System error during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    // 🚀 FIXED: Global Scrolling Layout
    <div className="w-full h-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(100,116,139,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-slate-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl flex items-center justify-center shadow-lg">
                  <FaHistory size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Master Audit Trail</h1>
                  <p className="text-sm font-medium text-slate-400">Complete timeline of all financial activities</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10">
                  <HiOutlineDownload size={16} /> Export
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
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Inflow</p>
              <p className="text-lg font-black text-emerald-400">{currencySymbol}{lifetimeInflow.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Outflow</p>
              <p className="text-lg font-black text-rose-400">{currencySymbol}{lifetimeOutflow.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transactions</p>
              <p className="text-lg font-black text-white">{totalTransactions}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter - 🚀 High Contrast */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" placeholder="Search transactions, payees, or vaults..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-slate-500 transition-all shadow-sm placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-slate-500 cursor-pointer transition-all shadow-sm"
            >
              <option value="all">All Activities</option>
              <option value="income">Incomes Only</option>
              <option value="expense">Expenses Only</option>
              <option value="shift">Capital Shifts Only</option>
            </select>
          </div>
        </div>

        {/* Timeline Ledger - 🚀 High Contrast Fix */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-slate-500 rounded-full blur-xl opacity-30 animate-pulse" />
                <HiOutlineRefresh className="animate-spin text-4xl text-slate-500 relative" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-4 animate-pulse">Compiling Master Ledger...</p>
            </div>
          ) : processedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-sm">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <HiOutlineDocumentSearch className="text-4xl text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">No history found</p>
              <p className="text-xs text-slate-500 mt-1">Your financial timeline will appear here</p>
            </div>
          ) : (
            processedLogs.map((month, mIdx) => (
              <div key={mIdx} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                
                {/* Month Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <HiOutlineCalendar className="text-slate-500" size={18} />
                    {month.monthName}
                  </h2>
                  <div className="flex gap-4 text-right">
                    <div className="hidden md:block">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inflow</p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">+{currencySymbol}{month.monthInflow.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Outflow</p>
                      <p className="text-sm font-black text-rose-600 dark:text-rose-400">-{currencySymbol}{month.monthOutflow.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    </div>
                  </div>
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100/50 dark:bg-slate-800/30 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-4 pl-6">Type</th>
                        <th className="p-4">Details</th>
                        <th className="p-4">Vault Impact</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4 text-right">Base Value</th>
                        <th className="p-4 pr-6 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {month.records.map((rec) => {
                        const style = getTypeStyles(rec.logType);
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                            
                            {/* Type Badge */}
                            <td className="p-4 pl-6">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.bg} ${style.text} border ${style.border}`}>
                                {style.icon}
                              </div>
                            </td>

                            {/* Details */}
                            <td className="p-4">
                              {rec.logType === 'shift' ? (
                                <div>
                                  <p className="font-black text-slate-900 dark:text-white text-sm">Capital Shift</p>
                                  <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                                    <HiOutlineSwitchHorizontal size={12}/> {rec.routingPlatform || 'Internal'}
                                  </p>
                                  <p className="text-[9px] text-slate-500 mt-1">
                                    {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-black text-slate-900 dark:text-white text-sm">{rec.title}</p>
                                  <div className="flex gap-1 flex-wrap mt-1">
                                    <ActivityBadge type={rec.logType} />
                                    {rec.khataDetails?.length > 0 && (
                                      <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1 border border-blue-200 dark:border-blue-500/30 shadow-sm">
                                        <FaUserFriends size={10}/> SHARED
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] font-bold text-slate-500 mt-1">
                                    {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date} <span className="text-slate-300 dark:text-slate-600">•</span> {rec.category}
                                  </p>
                                </div>
                              )}
                            </td>

                            {/* Vault Impact */}
                            <td className="p-4">
                              {rec.logType === 'shift' ? (
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded text-[9px] font-black">{rec.fromVault}</span>
                                  <FaExchangeAlt className="text-slate-400" size={10} />
                                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded text-[9px] font-black">{rec.toVault}</span>
                                </div>
                              ) : rec.isSplit ? (
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded text-[9px] font-black flex items-center gap-1 w-fit shadow-sm">
                                  <FaRandom size={10}/> Split
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 capitalize">
                                    {getVaultIcon(rec.vault)} {rec.vault}
                                  </span>
                                  {rec.subWallet && (
                                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                      <FaBuilding size={10}/> {rec.subWallet}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Amount */}
                            <td className="p-4 text-right">
                              {rec.logType === 'shift' ? (
                                <p className="font-bold text-slate-800 dark:text-slate-300">
                                  {Number(rec.grossAmount).toLocaleString()} <span className="text-[10px] text-slate-500 font-bold">{rec.fromAsset}</span>
                                </p>
                              ) : rec.isSplit ? (
                                <span className="text-amber-600 dark:text-amber-500 text-[10px] font-black uppercase tracking-widest">MULTI</span>
                              ) : (
                                <p className={`font-bold ${rec.logType === 'expense' && rec.khataDetails?.length > 0 ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-300'}`}>
                                  {Number(rec.totalPaidFromVault || rec.amount || 0).toLocaleString()} <span className="text-[10px] text-slate-500 font-bold">{rec.currency || rec.asset}</span>
                                </p>
                              )}
                            </td>

                            {/* Base Value */}
                            <td className="p-4 text-right">
                              <p className={`text-base font-black tracking-tight ${style.text}`}>
                                {rec.logType === 'shift' ? '↔' : (rec.logType === 'income' ? '+' : '-')}
                                {currencySymbol}{Number(rec.finalBaseAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </p>
                            </td>

                            {/* Delete Button */}
                            <td className="p-4 pr-6">
                              <button 
                                onClick={() => initiateDelete(rec)}
                                className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-slate-300 dark:border-slate-700 rounded-lg transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                              >
                                <HiOutlineTrash size={16} />
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
      </div>

      {/* Delete Confirmation Modal */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-700">
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
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Deleting this {deleteContext.logType} will reverse all associated vault entries and update connected Khata balances automatically.
                </p>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Security PIN</label>
                <input 
                  type="password" maxLength={6} required autoFocus
                  value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.3em] text-xl p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm"
                />
                {pinError && <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-2 text-center">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors shadow-sm">
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

export default HistoryLogs;