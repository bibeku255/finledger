import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineCash, HiOutlineSearch, HiOutlineFilter, HiOutlineRefresh,
  HiOutlineLockClosed, HiOutlineExclamationCircle,
  HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaMoneyBillWave, FaArrowDown, FaArrowUp, FaGlobe, FaExchangeAlt } from 'react-icons/fa';

const commonCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];

// 🚀 Mapping for Forex Flags (Consistent across all Fiat Wallets)
const fiatFlagMap = {
  USD: 'us', INR: 'in', NPR: 'np', EUR: 'eu', GBP: 'gb', CAD: 'ca', AUD: 'au', 
  JPY: 'jp', AED: 'ae', SAR: 'sa', QAR: 'qa', KWD: 'kw', OMR: 'om', BHD: 'bh',
  PKR: 'pk', BDT: 'bd', SGD: 'sg', CNY: 'cn'
};

// 🚀 SECURE SHA-256 HASHING ALGORITHM
const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const CashWallet = () => {
  // 🚀 BROUGHT IN `formatGlobalDate` FROM CONTEXT
  const { user, baseCurrency = 'INR', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 🚀 LIVE FOREX TICKER STATE
  const [tickerData, setTickerData] = useState([]);

  // 🔐 Security (Delete) States
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    title: '', foreignAmount: '', currency: baseCurrency, exchangeRate: 1, date: todayDate
  });

  // 🌍 FETCH ONLY FIAT RATES FOR TICKER
  useEffect(() => {
    const fetchTickerData = async () => {
      try {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        const data = await res.json();
        const targetFiats = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'];
        
        const formattedFiat = targetFiats.map(fiat => {
          const rate = data.rates[fiat];
          return rate ? { symbol: fiat, price: (1 / rate).toFixed(2), change: (Math.random() * 0.5 - 0.25).toFixed(2) } : null;
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

  const processedLedger = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const grouped = {};

    sorted.forEach(t => {
      const dateObj = new Date(t.date || new Date());
      // 🚀 NAYA LOGIC: Grouping based on the Global Date Format (Month & Year)
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      // Use raw English 'YYYY-MM' key just for logical grouping/sorting, but display local Month
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) {
        grouped[monthKey] = { monthName, openingBalance: runningBalance, records: [], closingBalance: 0 };
      }

      let finalAmount = Number(t.finalBaseAmount || t.amount || 0);
      let feeAmount = 0;
      
      if (t.fee && t.feeExchangeRate) {
          feeAmount = Number(t.fee) * Number(t.feeExchangeRate);
      } else if (t.fee) {
          feeAmount = Number(t.fee);
      }

      let netChange = 0;
      if (t.type === 'in') {
        netChange = finalAmount;
      } else {
        netChange = -(finalAmount + feeAmount); 
      }
      
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
    }).filter(m => m.records.length > 0 || searchTerm === ''); 
  }, [transactions, searchTerm, filterType, formatGlobalDate]);

  const totalBalance = processedLedger.length > 0 ? processedLedger[0].closingBalance : 0;

  // 🚀 REPORT DOWNLOAD LOGIC (Now includes Global Date)
  const handleDownloadReport = (format) => {
    if (transactions.length === 0) return alert("No records found to download.");

    const reportData = transactions.map(rec => {
      const isIncome = rec.type === 'in';
      const cleanNote = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const finalAmt = Number(rec.finalBaseAmount || rec.amount || 0);
      
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        type: isIncome ? 'Added (+)' : 'Spent/Removed (-)',
        currency: rec.currency || baseCurrency,
        amount: `${isIncome ? '+' : '-'}${currencySymbol}${Math.abs(finalAmt).toFixed(2)}`,
        notes: cleanNote
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Source Currency', key: 'currency' },
      { header: 'Net Amount', key: 'amount' },
      { header: 'Details', key: 'notes' }
    ];

    const fileName = `Cash_Vault_Ledger`;
    const reportTitle = `Cash Vault - Complete Ledger`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  const fetchLiveRate = async () => {
    if (formData.currency === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
      const data = await res.json();
      const rate = data.rates[baseCurrency];
      if (rate) {
        setFormData(prev => ({ ...prev, exchangeRate: rate.toFixed(4) }));
      }
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
      title: formData.title,
      type: 'in', 
      date: formData.date,
      timestamp: editingId ? transactions.find(t => t.id === editingId)?.timestamp : new Date(formData.date).getTime(),
      currency: formData.currency,
      foreignAmount: parseFloat(formData.foreignAmount) || 0,
      exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
      finalBaseAmount: calculatedFinalAmount,
      fee: 0 
    };

    try {
      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "cashWallet", editingId), recordData, { merge: true });
      } else {
        await addDoc(collection(db, "users", user.uid, "cashWallet"), recordData);
      }
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Failed to save entry!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (rec) => {
    setFormData({
      title: rec.title || '',
      foreignAmount: rec.foreignAmount || rec.amount || '', 
      currency: rec.currency || baseCurrency,
      exchangeRate: rec.exchangeRate || 1,
      date: rec.date || todayDate
    });
    setEditingId(rec.id);
    setIsModalOpen(true);
  };

  const initiateDelete = (rec) => {
    setDeleteContext(rec);
    setPinInput('');
    setPinError('');
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError("Please enter your Security PIN.");
      return;
    }

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

      await deleteDoc(doc(db, "users", user.uid, "cashWallet", deleteContext.id));
      setDeleteContext(null); 
    } catch (error) {
      console.error(error);
      setPinError("System error during verification. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openModal = () => {
    setEditingId(null);
    setFormData({ title: '', foreignAmount: '', currency: baseCurrency, exchangeRate: 1, date: todayDate });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
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

      {/* 🚀 GLOBAL FIAT TICKER */}
      <div className="relative overflow-hidden rounded-2xl border flex items-center shadow-sm transition-colors duration-500 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50">
        <div className="absolute left-0 z-10 h-full px-4 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border-r backdrop-blur-md bg-emerald-600 text-white border-emerald-700">
          <FaGlobe className="text-emerald-200" /> 
          Global Fiat Rates
        </div>
        <div className="flex-1 overflow-hidden ml-[140px] md:ml-[160px] py-3">
          <div className="animate-ticker-scroll flex gap-8 px-4">
            {tickerData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 font-bold text-sm cursor-default">
                <span className="text-slate-600 dark:text-slate-300">{item.symbol}</span>
                <span className="text-slate-900 dark:text-white font-black">
                  {currencySymbol}{Number(item.price).toLocaleString()}
                </span>
                <span className={`text-[11px] flex items-center ${item.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {item.change >= 0 ? <HiOutlineTrendingUp/> : <HiOutlineTrendingDown/>}
                  {Math.abs(item.change)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
              <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineDocumentText className="text-rose-500" size={16}/> As PDF
              </button>
              <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineTable className="text-emerald-500" size={16}/> As Excel (CSV)
              </button>
            </div>
          </div>

          <button onClick={openModal} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 md:px-7 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shadow-lg shadow-emerald-500/30 whitespace-nowrap">
            <HiOutlinePlus size={20} /> <span className="hidden sm:inline">Add to Vault</span> <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between">
        <div className="absolute -right-10 -top-10 opacity-10 text-white"><HiOutlineCash size={200} /></div>
        <div className="relative z-10">
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Net Cash Vault Balance</p>
          <h2 className="text-5xl md:text-6xl font-black text-emerald-400 tracking-tight">
            {currencySymbol}{(totalBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
          <input 
            type="text" placeholder="Search cash logs..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl font-bold dark:text-white outline-none focus:border-emerald-500 shadow-sm"
          />
        </div>
        <div className="relative w-full md:w-64">
          <HiOutlineFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl z-10" />
          <select 
            value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl font-bold dark:text-white outline-none focus:border-emerald-500 shadow-sm appearance-none cursor-pointer"
          >
            <option value="all">All Transactions</option>
            <option value="in">Incomes / Added</option>
            <option value="out">Expenses (Auto-Synced)</option>
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="p-10 text-center text-slate-500 font-bold animate-pulse">Calculating Ledger...</div>
        ) : processedLedger.length === 0 ? (
          <div className="p-10 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5">
            No records found.
          </div>
        ) : (
          processedLedger.map((month) => {
            if (month.records.length === 0) return null; 
            
            return (
              <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-sm">
                
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                  <h2 className="text-lg font-black dark:text-white">{month.monthName}</h2>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Balance</p>
                    <p className="font-bold text-slate-600 dark:text-slate-300">{currencySymbol}{(month.openingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="p-4 pl-6">Type</th>
                        <th className="p-4">Source & Date</th>
                        <th className="p-4 text-right">FX Details</th>
                        <th className="p-4 text-right">Net Add/Drop</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {month.records.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                          
                          <td className="p-4 pl-6 w-12">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${rec.type === 'in' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-500 dark:bg-rose-500/10'}`}>
                              {rec.type === 'in' ? <FaArrowDown /> : <FaArrowUp />}
                            </div>
                          </td>
                          
                          <td className="p-4">
                            <p className="font-black dark:text-white text-sm capitalize">{rec.title}</p>
                            {/* 🚀 UPDATED DATE RENDERING HERE */}
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                               {formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date}
                            </p>
                            {rec.feeAmount > 0 && (
                               <p className="text-[9px] mt-1 text-rose-500 font-bold bg-rose-50 dark:bg-rose-500/10 inline-block px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-500/20">
                                 Incl. Fee: -{currencySymbol}{rec.feeAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                               </p>
                            )}
                          </td>
                          
                          <td className="p-4 text-right">
                            {rec.currency && rec.currency !== baseCurrency ? (
                              <>
                                {/* 🚀 ADDED COUNTRY FLAG TO FOREIGN CURRENCY */}
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-end gap-1">
                                  <img src={`https://flagcdn.com/w20/${fiatFlagMap[rec.currency] || 'un'}.png`} alt="" className="w-3 h-3 rounded-full object-cover" />
                                  {rec.currency}
                                </p>
                                <p className="font-bold text-slate-600 dark:text-slate-300">{(rec.foreignAmount || 0).toLocaleString()} {rec.currency}</p>
                                <p className="text-[9px] font-bold text-slate-400">@ {rec.exchangeRate || 1} rate</p>
                              </>
                            ) : (
                              <>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right flex items-center justify-end gap-1">
                                  <img src={`https://flagcdn.com/w20/${fiatFlagMap[baseCurrency] || 'un'}.png`} alt="" className="w-3 h-3 rounded-full object-cover" /> Base Asset
                                </p>
                                <p className="font-bold text-slate-600 dark:text-slate-300 text-right">{currencySymbol}{(rec.finalAmount || 0).toLocaleString()}</p>
                              </>
                            )}
                          </td>
                          
                          <td className="p-4 text-right">
                            <p className={`text-base font-black ${rec.netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {rec.netChange >= 0 ? '+' : ''}{currencySymbol}{Math.abs(rec.netChange || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </p>
                          </td>
                          
                          <td className="p-4 pr-6">
                            <div className="flex items-center justify-end gap-2">
                              {(!rec.linkedExpenseId && !rec.linkedIncomeId && !rec.shiftId && !rec.linkedPartyId) && (
                                <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition-all shadow-sm">
                                  <HiOutlinePencil size={18} />
                                </button>
                              )}
                              
                              <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all shadow-sm">
                                <HiOutlineTrash size={18} />
                              </button>
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex justify-end bg-slate-50/30 dark:bg-slate-800/30">
                  <div className="text-right">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Closing Balance</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{currencySymbol}{(month.closingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-emerald-500 text-white">
              <h3 className="text-xl font-black">
                {editingId ? 'Edit Vault Entry' : 'Deposit Cash'}
              </h3>
              <button onClick={closeModal} className="text-white/70 hover:text-white transition-colors">
                <HiOutlineX size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  Reason / Source
                </label>
                <input 
                  type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Freelance, ATM Withdrawal"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl font-bold dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Currency</label>
                  <select 
                    value={formData.currency} 
                    onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl font-bold dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer appearance-none"
                  >
                    {!commonCurrencies.includes(baseCurrency) && <option value={baseCurrency}>{baseCurrency} (Base)</option>}
                    {commonCurrencies.map(c => <option key={c} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Amount</label>
                  <input 
                    type="number" step="any" required value={formData.foreignAmount} onChange={(e) => setFormData({...formData, foreignAmount: e.target.value})}
                    placeholder="e.g. 100"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl font-bold dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-lg"
                  />
                </div>
              </div>

              {formData.currency !== baseCurrency && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl space-y-3 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                      <FaExchangeAlt /> Offline/Bank Rate
                    </label>
                    <button 
                      type="button" onClick={fetchLiveRate} disabled={isFetchingRate}
                      className="text-[10px] font-black bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-colors"
                    >
                      <HiOutlineRefresh className={isFetchingRate ? "animate-spin" : ""} /> Get Live Rate
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-500">1 {formData.currency} = </span>
                    <input 
                      type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})}
                      placeholder={`Rate in ${baseCurrency}`}
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl font-bold dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>

                  <div className="flex justify-between items-end pt-2 border-t border-emerald-200 dark:border-emerald-500/20">
                    <span className="text-xs font-bold text-slate-500">Final Added to Vault:</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {currencySymbol}{(calculatedFinalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              )}

              {/* 🚀 DATE PICKER WITH LOCAL DATE INFO */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                  <span>Entry Date</span>
                  <span className="text-blue-500">{formatGlobalDate ? formatGlobalDate(formData.date, 'full') : ''}</span>
                </label>
                <input 
                  type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl font-bold dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black transition-transform shadow-xl text-white flex justify-center items-center gap-2 ${isSaving ? 'opacity-70 bg-emerald-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 active:scale-95 shadow-emerald-500/20'}`}>
                {isSaving && <HiOutlineRefresh className="animate-spin text-xl"/>}
                {editingId ? 'Update Vault Entry' : 'Secure Cash in Vault'}
              </button>
            </form>
          </div>
        </div>
      )}

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
                You are about to delete <span className="text-slate-800 dark:text-white uppercase">"{deleteContext.title}"</span>.
              </p>
              
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                  <HiOutlineExclamationCircle size={16} className="shrink-0" />
                  WARNING: This will permanently remove {currencySymbol}{(deleteContext.finalBaseAmount || deleteContext.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} from your Cash Vault.
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
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin text-xl"/> : null}
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

export default CashWallet;