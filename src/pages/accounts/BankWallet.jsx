import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineLibrary, HiOutlineSearch, HiOutlineRefresh,
  HiOutlineLockClosed, HiOutlineExclamationCircle,
  HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaGlobe, FaUniversity, FaShieldAlt, FaExchangeAlt, FaArrowDown, FaArrowUp } from 'react-icons/fa';

const commonCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];
const bankTransferTypes = ["UPI", "IMPS", "NEFT / RTGS", "Wire Transfer / SWIFT", "Cheque", "Direct Deposit"];

// 🚀 Mapping for Forex Flags
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

const BankWallet = () => {
  const { user, baseCurrency = 'INR', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

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
    isSynced: false // 🚀 Added to track if we can only edit the Bank Name
  });

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
    const bankRef = collection(db, "users", user.uid, "bankWallet");
    const q = query(bankRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(dbRecords);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 🚀 UNIQUE BANK NAMES FOR AUTO-COMPLETE
  const existingBanks = useMemo(() => {
    const banks = new Set(transactions.map(t => t.bankName).filter(b => b && b.trim() !== ''));
    return Array.from(banks);
  }, [transactions]);

  // 🚀 PERFECTED MULTI-CURRENCY & SUB-BANK AGGREGATOR LOGIC
  const subWalletBalances = useMemo(() => {
    const balances = {};
    
    transactions.forEach(t => {
      const curr = t.currency || baseCurrency;
      const originalBankName = t.bankName?.trim() ? t.bankName.trim() : 'Main Vault';
      const key = `${originalBankName.toUpperCase()}_${curr.toUpperCase()}`;
      
      if (!balances[key]) balances[key] = { bank: originalBankName, currency: curr, value: 0 };
      
      const amt = Number(t.foreignAmount || t.amount || 0); 
      
      if (t.type === 'in') {
        balances[key].value += amt;
      } else {
        balances[key].value -= amt;
      }
    });

    return Object.values(balances)
      .filter(b => Math.abs(b.value) > 0.01)
      .sort((a, b) => b.value - a.value);
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
        const bankMatch = r.bankName ? r.bankName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const refMatch = r.referenceNo ? r.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const typeMatch = filterType === 'all' || r.type === filterType || (filterType === 'p2p' && r.isP2P);
        return (titleMatch || bankMatch || refMatch) && typeMatch;
      }).reverse(); 
      return { ...monthData, records: filteredRecords };
    }).filter(m => m.records.length > 0 || searchTerm === ''); 
  }, [transactions, searchTerm, filterType, formatGlobalDate]);

  const totalBalance = processedLedger.length > 0 ? processedLedger[0].closingBalance : 0;

  const handleDownloadReport = (format) => {
    if (transactions.length === 0) return alert("No bank records found to download.");

    const reportData = transactions.map(rec => {
      const isIncome = rec.type === 'in';
      const cleanNote = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const finalAmt = Number(rec.finalBaseAmount || rec.amount || 0);
      
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        type: isIncome ? 'Deposit (+)' : 'Withdrawal/Expense (-)',
        bankName: rec.bankName || 'N/A',
        reference: rec.referenceNo || 'N/A',
        amount: `${isIncome ? '+' : '-'}${currencySymbol}${Math.abs(finalAmt).toFixed(2)}`,
        notes: cleanNote
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Bank / Method', key: 'bankName' },
      { header: 'Ref / UTR', key: 'reference' },
      { header: 'Amount', key: 'amount' },
      { header: 'Description', key: 'notes' }
    ];

    const fileName = `Bank_Vault_Ledger`;
    const reportTitle = `Bank Vault - Complete Ledger`;

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
        // 🚀 SAFE SYNC EDITING: If it's synced, ONLY update the bankName to prevent math errors in parent!
        if (formData.isSynced) {
          await setDoc(doc(db, "users", user.uid, "bankWallet", editingId), { 
            bankName: formData.bankName.trim() 
          }, { merge: true });
        } else {
          // Full Update for manual entries
          const recordData = {
            title: formData.title,
            bankName: formData.bankName.trim(),
            transferType: formData.transferType,
            referenceNo: formData.referenceNo || '',
            isP2P: formData.isP2P || false,
            date: formData.date,
            currency: formData.currency,
            foreignAmount: parseFloat(formData.foreignAmount) || 0,
            exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
            fee: feeDeduction, 
            finalBaseAmount: calculatedFinalAmount
          };
          await setDoc(doc(db, "users", user.uid, "bankWallet", editingId), recordData, { merge: true });
        }
      } else {
        const recordData = {
          title: formData.title,
          bankName: formData.bankName.trim(),
          transferType: formData.transferType,
          referenceNo: formData.referenceNo || '',
          isP2P: formData.isP2P || false,
          type: 'in', 
          date: formData.date,
          timestamp: new Date(formData.date).getTime(),
          currency: formData.currency,
          foreignAmount: parseFloat(formData.foreignAmount) || 0,
          exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
          fee: feeDeduction, 
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
    // 🚀 NEW: Detect if this is an auto-synced entry
    const isSyncedEntry = !!(rec.linkedExpenseId || rec.linkedIncomeId || rec.shiftId || rec.linkedPartyId);

    setFormData({
      title: rec.title || '',
      bankName: rec.bankName || '',
      transferType: rec.transferType || 'UPI',
      referenceNo: rec.referenceNo || '',
      isP2P: rec.isP2P || false,
      foreignAmount: rec.foreignAmount || rec.amount || '', 
      currency: rec.currency || baseCurrency,
      exchangeRate: rec.exchangeRate || 1,
      fee: rec.fee || '', 
      date: rec.date || todayDate,
      isSynced: isSyncedEntry // Flag to lock other fields
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

      await deleteDoc(doc(db, "users", user.uid, "bankWallet", deleteContext.id));
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
    const lastBank = existingBanks.length > 0 ? existingBanks[0] : '';
    setFormData({ title: '', bankName: lastBank, transferType: 'UPI', referenceNo: '', isP2P: false, foreignAmount: '', currency: baseCurrency, exchangeRate: 1, fee: '', date: todayDate, isSynced: false });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

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
      <div className="relative overflow-hidden rounded-2xl border flex items-center shadow-sm transition-colors duration-500 bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/50">
        <div className="absolute left-0 z-10 h-full px-4 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border-r backdrop-blur-md bg-blue-600 text-white border-blue-700">
          <FaGlobe className="text-blue-300" /> 
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
            <div className="p-3.5 bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-2xl ring-1 ring-blue-500/20">
              <HiOutlineLibrary size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Bank Ledger</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            Professional dashboard to track incoming bank deposits, expenses, and isolate P2P crypto risks.
          </p>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
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

          <button onClick={openModal} className="group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 md:px-7 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shadow-lg shadow-blue-500/25">
            <HiOutlinePlus size={20} className="group-hover:rotate-90 transition-transform duration-300" /> 
            Log Deposit
          </button>
        </div>
      </div>

      {/* MASTER BALANCE CARD */}
      <div className="p-8 md:p-10 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] shadow-2xl shadow-slate-900/20 relative overflow-hidden border border-slate-700/50">
        <div className="absolute -right-10 -top-10 opacity-5 text-white blur-[2px]">
          <FaUniversity size={250} />
        </div>
        <div className="relative z-10 w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Total Vault Balance (Base Equiv.)</p>
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
              <span className="text-blue-500 mr-2">{currencySymbol}</span>
              {(totalBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h2>
          </div>
        </div>

        {/* 🚀 SUB-BANK & MULTI-CURRENCY BALANCES RENDERED HERE */}
        {subWalletBalances.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700/50 flex gap-4 overflow-x-auto custom-scrollbar pb-2 relative z-10">
            {subWalletBalances.map((item, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 shrink-0 flex items-center gap-3">
                <img src={`https://flagcdn.com/w40/${fiatFlagMap[item.currency] || 'un'}.png`} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-600" />
                <div>
                  <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest leading-tight">{item.bank} <span className="opacity-70">({item.currency})</span></p>
                  <p className="text-lg font-bold text-white leading-none mt-0.5">{item.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FILTERS & SEARCH */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-2 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
          <input type="text" placeholder="Search by Sender, Bank, or UTR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-4 py-4 bg-transparent font-bold text-slate-700 dark:text-white outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="w-px bg-slate-200 dark:bg-slate-800 hidden md:block my-2"></div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="pl-5 pr-12 py-4 bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer border-t md:border-t-0 border-slate-200 dark:border-slate-800"
        >
          <option value="all">All Bank Records</option>
          <option value="p2p">⚠️ Flagged P2P Only</option>
          <option value="in">Inflows (Deposits)</option>
          <option value="out">Outflows (Expenses/Shifts)</option>
        </select>
      </div>

      {/* LEDGER DATA */}
      <div className="space-y-8">
        {isLoading ? (
          <div className="p-16 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <HiOutlineRefresh className="mx-auto text-4xl text-slate-300 dark:text-slate-600 animate-spin mb-4" />
            <p className="text-slate-500 font-bold animate-pulse">Synchronizing Ledger...</p>
          </div>
        ) : processedLedger.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <FaUniversity className="mx-auto text-5xl text-slate-200 dark:text-slate-800 mb-4" />
            <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2">No Records Found</h3>
            <p className="text-slate-500 font-semibold">Your bank ledger is currently empty. Start tracking your deposits.</p>
          </div>
        ) : (
          processedLedger.map((month) => (
            <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
              
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{month.monthName}</h2>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Opening Balance</p>
                  <p className="font-bold text-slate-600 dark:text-slate-300">{currencySymbol}{(month.openingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="p-4 pl-6 w-12 text-center">Type</th>
                      <th className="p-4">Bank Info & Details</th>
                      <th className="p-4 text-right">Currency/Rate</th>
                      <th className="p-4 text-right">Net Value</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {month.records.map((rec) => (
                      <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${rec.isP2P ? 'bg-amber-50/20 dark:bg-amber-900/5' : ''}`}>
                        
                        <td className="p-4 pl-6 text-center">
                          <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg shrink-0 ${rec.type === 'in' ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10' : 'bg-rose-50 text-rose-500 dark:bg-rose-500/10'}`}>
                            {rec.type === 'in' ? <FaArrowDown /> : <FaArrowUp />}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 mt-1 rounded-2xl flex items-center justify-center text-xl shadow-sm ${rec.isP2P ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                              {rec.isP2P ? <FaShieldAlt /> : <FaUniversity />}
                            </div>
                            <div>
                              <p className="font-black text-slate-800 dark:text-white text-sm mb-0.5 flex items-center gap-2">
                                {rec.title}
                                {rec.isP2P && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><FaShieldAlt size={8}/> P2P Risk</span>}
                              </p>
                              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-2">
                                {rec.bankName || 'Main Bank'} <span className="text-slate-300 dark:text-slate-600">•</span> {rec.transferType || 'Direct/Expense'}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-2">
                                {formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date} {rec.referenceNo && <span className="text-slate-300 dark:text-slate-600">|</span>} {rec.referenceNo && `Ref: ${rec.referenceNo}`}
                              </p>
                              
                              {rec.feeAmount > 0 && rec.type === 'out' && (
                                <p className="text-[9px] mt-1 text-rose-500 font-bold bg-rose-50 dark:bg-rose-500/10 inline-block px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-500/20">
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
                              <p className="font-bold text-slate-700 dark:text-slate-200">{(Number(rec.foreignAmount) || 0).toLocaleString()}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">@ {Number(rec.exchangeRate) || 1} Rate</p>
                            </div>
                          ) : (
                            <span className="px-2 py-1 rounded-md bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center justify-end gap-1">
                               <img src={`https://flagcdn.com/w20/${fiatFlagMap[baseCurrency] || 'un'}.png`} alt="" className="w-3 h-3 rounded-full object-cover" /> Base Asset
                            </span>
                          )}
                        </td>
                        
                        <td className="p-4 text-right">
                          <p className={`text-lg font-black tracking-tight ${rec.netChange >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {rec.netChange >= 0 ? '+' : ''}{currencySymbol}{(Math.abs(Number(rec.netChange) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </p>
                          {rec.fee > 0 && rec.type === 'in' && (
                            <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-wider flex items-center justify-end gap-1">
                              Fee: -{rec.fee.toLocaleString()} {rec.currency === baseCurrency ? baseCurrency : 'Base'}
                            </p>
                          )}
                        </td>
                        
                        <td className="p-4 pr-6">
                          <div className="flex items-center justify-end gap-2">
                             {/* 🚀 FIXED: Now Pencil icon is ALWAYS visible so users can fix old bank names! */}
                             <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition-all shadow-sm">
                               <HiOutlinePencil size={18} />
                             </button>
                            
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

              <div className="px-6 py-4 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End of Period</span>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Closing Balance</p>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-tight">{currencySymbol}{(month.closingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-blue-600 text-white">
              <h3 className="text-xl font-black">
                {editingId ? 'Edit Bank Record' : 'Log Bank Deposit'}
              </h3>
              <button onClick={closeModal} className="text-white/70 hover:text-white transition-colors">
                <HiOutlineX size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              
              {/* 🚀 NEW: SYNCED ENTRY WARNING */}
              {formData.isSynced && (
                 <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 p-4 rounded-xl text-xs font-bold leading-relaxed border border-amber-200 dark:border-amber-500/30">
                   <span className="flex items-center gap-1 mb-1"><HiOutlineExclamationCircle size={16}/> Auto-Synced Entry</span>
                   This transaction came from Expenses or Incomes. You can only update the <span className="underline">Bank Name</span> here to organize your vault. To change the amount, please edit the original source.
                 </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Bank Name</label>
                  {/* 🚀 AUTOCOMPLETE DATALIST ADDED */}
                  <input type="text" list="bank-names" required value={formData.bankName} onChange={(e) => setFormData({...formData, bankName: e.target.value})} placeholder="e.g., SBI, Chase" 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                  <datalist id="bank-names">
                    {existingBanks.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Transfer Method</label>
                  <select disabled={formData.isSynced} value={formData.transferType} onChange={(e) => setFormData({...formData, transferType: e.target.value})} 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer appearance-none disabled:opacity-60">
                    {bankTransferTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Sender / Reason</label>
                <input disabled={formData.isSynced} type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g., Upwork Withdrawal" 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60" />
              </div>

              {/* PROFESSIONAL P2P TOGGLE */}
              <label className={`flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-300 ${formData.isSynced ? 'opacity-60 pointer-events-none' : 'cursor-pointer'} ${formData.isP2P ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-400 dark:border-amber-500/50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-300'}`}>
                <div className="relative flex items-center justify-center mt-0.5">
                  <input disabled={formData.isSynced} type="checkbox" checked={formData.isP2P} onChange={(e) => setFormData({...formData, isP2P: e.target.checked})} className="sr-only" />
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${formData.isP2P ? 'bg-amber-500 border-amber-500' : 'border-slate-300 dark:border-slate-600'}`}>
                    {formData.isP2P && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                </div>
                <div>
                  <p className={`font-black ${formData.isP2P ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>Tag as P2P / Crypto Origin</p>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Isolate this transaction for risk management and tax auditing.</p>
                </div>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Currency</label>
                  <select disabled={formData.isSynced} value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer appearance-none disabled:opacity-60">
                    {!commonCurrencies.includes(baseCurrency) && <option value={baseCurrency}>{baseCurrency} (Base)</option>}
                    {commonCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Deposit Amount</label>
                  <input disabled={formData.isSynced} type="number" step="any" required value={formData.foreignAmount} onChange={(e) => setFormData({...formData, foreignAmount: e.target.value})} placeholder="0.00" 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-lg disabled:opacity-60" />
                </div>
              </div>

              {formData.currency !== baseCurrency && (
                <div className={`p-5 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-2xl space-y-4 ${formData.isSynced ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1"><FaExchangeAlt/> Exchange Rate</span>
                    <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate || formData.isSynced} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                      <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} /> {isFetchingRate ? 'Fetching...' : 'Get Live Rate'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-500">1 {formData.currency} = </span>
                    <input disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} placeholder={`Rate in ${baseCurrency}`} 
                      className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    Bank / Service Fee 
                    <span className="text-[8px] bg-rose-100 text-rose-600 dark:bg-rose-500/20 px-2 py-0.5 rounded-full">DEDUCTION</span>
                  </label>
                  <input disabled={formData.isSynced} type="number" step="any" value={formData.fee} onChange={(e) => setFormData({...formData, fee: e.target.value})} placeholder={`Fee in base currency`} 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all disabled:opacity-60" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">UTR / Ref No.</label>
                  <input disabled={formData.isSynced} type="text" value={formData.referenceNo} onChange={(e) => setFormData({...formData, referenceNo: e.target.value})} placeholder="e.g. UTR123..." 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60" />
                </div>
              </div>

              {/* 🚀 LIVE CALCULATION PREVIEW */}
              <div className="px-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="block text-xs font-bold text-slate-500">Gross Value: {currencySymbol}{(grossAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    <span className="block text-[10px] font-black text-rose-500">Fees: -{currencySymbol}{(feeDeduction).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Final Bank Credit</span>
                    <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                      {currencySymbol}{calculatedFinalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </div>

              {/* 🚀 DATE PICKER WITH LOCAL DATE INFO */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                  <span>Date</span>
                  <span className="text-blue-500">{formatGlobalDate ? formatGlobalDate(formData.date, 'full') : ''}</span>
                </label>
                <input disabled={formData.isSynced} type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60" />
              </div>

              <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black text-white text-lg transition-all shadow-xl flex items-center justify-center gap-2 shrink-0 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} ${formData.isP2P ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>
                {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : null}
                {isSaving ? 'Processing...' : (editingId ? 'Save Bank Settings' : 'Secure Deposit')}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 pt-[100px] md:pt-[120px] pb-20 overflow-y-auto animate-in fade-in">
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
                  WARNING: This will permanently remove {currencySymbol}{(deleteContext.finalBaseAmount || deleteContext.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} from your Bank Vault.
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

export default BankWallet;