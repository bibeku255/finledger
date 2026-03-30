import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineGlobe, HiOutlineSearch, HiOutlineRefresh, 
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineLockClosed, HiOutlineExclamationCircle,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaGlobe, FaWallet, FaArrowDown, FaArrowUp, FaExchangeAlt, FaShieldAlt } from 'react-icons/fa';

// 🚀 STRICTLY FIAT CURRENCIES NOW
const fiatCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];

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

const OnlineWallet = () => {
  // 🚀 BROUGHT IN `formatGlobalDate` FROM CONTEXT
  const { user, baseCurrency = 'INR', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  
  const [tickerData, setTickerData] = useState([]);
  
  // 🔐 Security (Delete) States
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    title: '', walletName: '', referenceNo: '', 
    isP2P: false, foreignAmount: '', currency: 'USD', exchangeRate: 1, fee: '', date: todayDate,
    isSynced: false // 🚀 Added to track synced edits
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
    const walletRef = collection(db, "users", user.uid, "onlineWallet");
    const q = query(walletRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(dbRecords);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 🚀 UNIQUE WALLET NAMES FOR AUTO-COMPLETE
  const existingWallets = useMemo(() => {
    const wallets = new Set(transactions.map(t => t.walletName).filter(w => w && w.trim() !== ''));
    return Array.from(wallets);
  }, [transactions]);

  // 🚀 PERFECTED MULTI-CURRENCY & SUB-WALLET AGGREGATOR LOGIC
  const subWalletBalances = useMemo(() => {
    const balances = {};
    
    transactions.forEach(t => {
      const curr = t.currency || baseCurrency;
      const originalWalletName = t.walletName?.trim() ? t.walletName.trim() : 'Main Wallet';
      const key = `${originalWalletName.toUpperCase()}_${curr.toUpperCase()}`;
      
      if (!balances[key]) balances[key] = { wallet: originalWalletName, currency: curr, value: 0 };
      
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
      } else if (t.fee && t.exchangeRate) { 
          feeAmount = Number(t.fee) * Number(t.exchangeRate);
      } else if (t.fee) {
          feeAmount = Number(t.fee);
      }

      let netChange = t.type === 'in' ? finalAmount : -(finalAmount + feeAmount); 
      runningBalance += netChange;

      grouped[monthKey].records.push({ ...t, netChange, finalAmount, feeAmount });
      grouped[monthKey].closingBalance = runningBalance;
    });

    return Object.keys(grouped).sort().reverse().map(key => {
      const monthData = grouped[key];
      const filteredRecords = monthData.records.filter(r => {
        const titleMatch = r.title ? r.title.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const walletMatch = r.walletName ? r.walletName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        return (titleMatch || walletMatch);
      }).reverse(); 
      return { ...monthData, records: filteredRecords };
    }).filter(m => m.records.length > 0 || searchTerm === ''); 
  }, [transactions, searchTerm, formatGlobalDate]);

  const totalBalance = processedLedger.length > 0 ? processedLedger[0].closingBalance : 0;

  const handleDownloadReport = (format) => {
    if (transactions.length === 0) return alert("No records found to download.");

    const reportData = transactions.map(rec => {
      const isIncome = rec.type === 'in';
      const cleanNote = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const finalAmt = Number(rec.finalBaseAmount || rec.amount || 0);
      
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        type: isIncome ? 'Deposit (+)' : 'Withdrawal/Expense (-)',
        walletName: rec.walletName || 'N/A',
        currency: rec.currency || baseCurrency,
        amount: `${isIncome ? '+' : '-'}${currencySymbol}${Math.abs(finalAmt).toFixed(2)}`,
        notes: cleanNote
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Platform / Wallet', key: 'walletName' },
      { header: 'Currency', key: 'currency' },
      { header: 'Net Amount', key: 'amount' },
      { header: 'Details', key: 'notes' }
    ];

    const fileName = `Online_Wallet_Ledger`;
    const reportTitle = `Digital Fiat Wallet - Complete Ledger`;

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
      if (data.rates[baseCurrency]) setFormData(prev => ({ ...prev, exchangeRate: data.rates[baseCurrency].toFixed(4) }));
    } catch (error) {
      alert(`Could not fetch auto-rate for ${formData.currency}. Please enter it manually.`);
    } finally {
      setIsFetchingRate(false);
    }
  };

  const grossDeposit = parseFloat(formData.foreignAmount) || 0;
  const nativeFee = parseFloat(formData.fee) || 0;
  const netNativeAmount = grossDeposit - nativeFee; 
  const exchangeRate = formData.currency !== baseCurrency ? (parseFloat(formData.exchangeRate) || 1) : 1;
  const calculatedFinalAmount = netNativeAmount * exchangeRate; 

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");
    if (!formData.walletName.trim()) return alert("Please provide a Wallet Name (e.g. PayPal)");
    
    setIsSaving(true);

    try {
      if (editingId) {
        if (formData.isSynced) {
           await setDoc(doc(db, "users", user.uid, "onlineWallet", editingId), { 
             walletName: formData.walletName.trim() 
           }, { merge: true });
        } else {
           const recordData = {
             title: formData.title,
             walletName: formData.walletName.trim(),
             walletCategory: "Fiat E-Wallet",
             referenceNo: formData.referenceNo || '',
             isP2P: formData.isP2P || false,
             date: formData.date,
             currency: formData.currency,
             foreignAmount: grossDeposit, 
             fee: nativeFee, 
             netForeignAmount: netNativeAmount, 
             exchangeRate: exchangeRate,
             finalBaseAmount: calculatedFinalAmount 
           };
           await setDoc(doc(db, "users", user.uid, "onlineWallet", editingId), recordData, { merge: true });
        }
      } else {
        const recordData = {
          title: formData.title,
          walletName: formData.walletName.trim(),
          walletCategory: "Fiat E-Wallet",
          referenceNo: formData.referenceNo || '',
          isP2P: formData.isP2P || false,
          type: 'in', 
          date: formData.date,
          timestamp: new Date(formData.date).getTime(),
          currency: formData.currency,
          foreignAmount: grossDeposit, 
          fee: nativeFee, 
          netForeignAmount: netNativeAmount, 
          exchangeRate: exchangeRate,
          finalBaseAmount: calculatedFinalAmount 
        };
        await addDoc(collection(db, "users", user.uid, "onlineWallet"), recordData);
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
      title: rec.title || '',
      walletName: rec.walletName || '',
      referenceNo: rec.referenceNo || '',
      isP2P: rec.isP2P || false,
      foreignAmount: rec.foreignAmount || rec.finalBaseAmount || '', 
      currency: rec.currency || 'USD',
      exchangeRate: rec.exchangeRate || 1,
      fee: rec.fee || '', 
      date: rec.date || todayDate,
      isSynced: isSyncedEntry
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

      await deleteDoc(doc(db, "users", user.uid, "onlineWallet", deleteContext.id));
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
    const lastWallet = existingWallets.length > 0 ? existingWallets[0] : '';
    setFormData({ title: '', walletName: lastWallet, referenceNo: '', isP2P: false, foreignAmount: '', currency: 'USD', exchangeRate: 1, fee: '', date: todayDate, isSynced: false });
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

      {/* 🚀 GLOBAL FIAT TICKER (Purple Themed) */}
      <div className="relative overflow-hidden rounded-2xl border flex items-center shadow-sm transition-colors duration-500 bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/50">
        <div className="absolute left-0 z-10 h-full px-4 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border-r backdrop-blur-md bg-purple-600 text-white border-purple-700">
          <FaGlobe className="text-purple-300" /> 
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

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl ring-1 ring-purple-500/20">
              <HiOutlineGlobe size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Digital Fiat Wallets</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            Manage your PayPal, Payoneer, Skrill, Khalti and other Flat Currency E-Wallets globally.
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

          <button onClick={openModal} className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 md:px-7 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shadow-lg shadow-purple-500/25 whitespace-nowrap">
            <HiOutlinePlus size={20} className="hidden sm:inline transition-transform duration-300" /> 
            <span className="hidden sm:inline">Log E-Deposit</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="p-8 md:p-10 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] shadow-2xl shadow-slate-900/20 relative overflow-hidden border border-slate-700/50">
        <div className="absolute -right-10 -top-10 opacity-5 text-white blur-[2px]">
          <FaGlobe size={250} />
        </div>
        <div className="relative z-10 w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Total Cloud Balance (Base)</p>
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
              <span className="text-purple-500 mr-2">{currencySymbol}</span>
              {(totalBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h2>
          </div>
        </div>

        {/* 🚀 SUB-WALLET BALANCES RENDERED HERE */}
        {subWalletBalances.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700/50 flex gap-4 overflow-x-auto custom-scrollbar pb-2 relative z-10">
            {subWalletBalances.map((item, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 shrink-0 flex items-center gap-3">
                <img src={`https://flagcdn.com/w40/${fiatFlagMap[item.currency] || 'un'}.png`} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-600" />
                <div>
                  <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest leading-tight">{item.wallet} <span className="opacity-70">({item.currency})</span></p>
                  <p className="text-lg font-bold text-white leading-none mt-0.5">{item.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-2 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
          <input type="text" placeholder="Search by Platform (e.g. PayPal) or Sender..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-4 py-4 bg-transparent font-bold text-slate-700 dark:text-white outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          <div className="p-16 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <HiOutlineRefresh className="mx-auto text-4xl text-slate-300 dark:text-slate-600 animate-spin mb-4" />
            <p className="text-slate-500 font-bold animate-pulse">Syncing Cloud Wallets...</p>
          </div>
        ) : processedLedger.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <HiOutlineGlobe className="mx-auto text-5xl text-slate-200 dark:text-slate-800 mb-4" />
            <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2">No Digital Fiat Found</h3>
            <p className="text-slate-500 font-semibold">Log your PayPal, Payoneer, or Local E-Wallet deposits here.</p>
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
                      <th className="p-4">Platform & Details</th>
                      <th className="p-4 text-right">Fiat Flow</th>
                      <th className="p-4 text-right">Base Equivalent</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {month.records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        
                        <td className="p-4 pl-6 text-center">
                          <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg shrink-0 ${rec.type === 'in' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-500 dark:bg-rose-500/10'}`}>
                            {rec.type === 'in' ? <FaArrowDown /> : <FaArrowUp />}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                              <FaWallet />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 dark:text-white text-sm flex items-center gap-2">
                                {rec.walletName || 'Main Wallet'}
                                {rec.isP2P && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><FaShieldAlt size={8}/> P2P Risk</span>}
                              </p>
                              <p className="text-[11px] font-bold text-slate-500 mt-0.5">{rec.title}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-2">
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
                               {rec.fee > 0 && rec.type === 'in' ? (
                                 <>
                                   <p className="text-[10px] font-bold text-slate-400">Gross: {Number(rec.foreignAmount).toLocaleString()}</p>
                                   <p className="text-[10px] font-bold text-rose-500">Fee: -{Number(rec.fee).toLocaleString()}</p>
                                   <p className="text-sm font-black text-slate-800 dark:text-white border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
                                     Net: {(Number(rec.netForeignAmount) || Number(rec.foreignAmount)).toLocaleString()}
                                   </p>
                                 </>
                               ) : (
                                 <p className="font-bold text-slate-700 dark:text-slate-200">{(Number(rec.foreignAmount) || 0).toLocaleString()}</p>
                               )}
                             </div>
                           ) : (
                              <span className="px-2 py-1 rounded-md bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center justify-end gap-1">
                                 <img src={`https://flagcdn.com/w20/${fiatFlagMap[baseCurrency] || 'un'}.png`} alt="" className="w-3 h-3 rounded-full object-cover" /> Base Asset
                              </span>
                           )}
                        </td>
                        
                        <td className="p-4 text-right">
                          <p className={`text-lg font-black tracking-tight ${rec.netChange >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {rec.netChange >= 0 ? '+' : ''}{currencySymbol}{(Math.abs(Number(rec.netChange) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </p>
                          {rec.currency !== baseCurrency && (
                            <p className="text-[10px] font-bold text-slate-400 mt-1 tracking-wider">
                              @ {Number(rec.exchangeRate) || 1} Rate
                            </p>
                          )}
                        </td>
                        
                        <td className="p-4 pr-6">
                          <div className="flex items-center justify-end gap-2">
                             {/* 🚀 ALWAYS SHOW PENCIL FOR SYNCED ENTRIES TO FIX WALLET NAME */}
                             <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition-all shadow-sm">
                               <HiOutlinePencil size={18} />
                             </button>

                             <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all shadow-sm" title={rec.linkedExpenseId || rec.linkedIncomeId || rec.shiftId ? "Force Delete Auto-Synced Entry" : "Delete"}>
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
                  <p className="text-xl font-black text-purple-600 dark:text-purple-400 tracking-tight">{currencySymbol}{(month.closingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* 🚀 MODAL: Edit & Entry */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            
            <div className="px-8 py-6 flex justify-between items-center transition-colors duration-300 bg-purple-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                <HiOutlineGlobe size={24} />
                <h3 className="text-xl font-black">{editingId ? 'Edit Wallet Record' : 'Log E-Deposit'}</h3>
              </div>
              <button type="button" onClick={closeModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              
              {/* 🚀 WARNING FOR AUTO-SYNCED ENTRIES */}
              {formData.isSynced && (
                 <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 p-4 rounded-xl text-xs font-bold leading-relaxed border border-amber-200 dark:border-amber-500/30">
                   <span className="flex items-center gap-1 mb-1"><HiOutlineExclamationCircle size={16}/> Auto-Synced Entry</span>
                   This entry is linked to an Income or Expense log. You can only update the <span className="underline">Wallet Name</span> here. To change the amount, please edit the source transaction.
                 </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform Name</label>
                  {/* 🚀 AUTOCOMPLETE DATALIST ADDED */}
                  <input type="text" list="online-wallets" required value={formData.walletName} onChange={(e) => setFormData({...formData, walletName: e.target.value})} placeholder="e.g., PayPal, Skrill" 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-all" />
                  <datalist id="online-wallets">
                    {existingWallets.map(w => <option key={w} value={w} />)}
                  </datalist>
                </div>
                {!formData.isSynced && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Sender / Source</label>
                    <input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g., Freelance Client" 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-all" />
                  </div>
                )}
              </div>

              {!formData.isSynced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Fiat Currency</label>
                    <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-all cursor-pointer appearance-none">
                      {!fiatCurrencies.includes(baseCurrency) && <option value={baseCurrency}>{baseCurrency} (Base)</option>}
                      {fiatCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Deposit Amount ({formData.currency})</label>
                    <input type="number" step="any" required value={formData.foreignAmount} onChange={(e) => setFormData({...formData, foreignAmount: e.target.value})} placeholder="0.00" 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-lg" />
                  </div>
                </div>
              )}

              {!formData.isSynced && (
                <label className={`flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${formData.isP2P ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-400 dark:border-amber-500/50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-300'}`}>
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input type="checkbox" checked={formData.isP2P} onChange={(e) => setFormData({...formData, isP2P: e.target.checked})} className="sr-only" />
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${formData.isP2P ? 'bg-amber-500 border-amber-500' : 'border-slate-300 dark:border-slate-600'}`}>
                      {formData.isP2P && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <div>
                    <p className={`font-black ${formData.isP2P ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>Tag as P2P / Crypto Origin</p>
                    <p className="text-xs font-semibold text-slate-500 mt-1">Isolate this transaction for risk management and tax auditing.</p>
                  </div>
                </label>
              )}

              {!formData.isSynced && formData.currency !== baseCurrency && (
                <div className="p-5 border rounded-2xl space-y-4 transition-colors bg-purple-50/50 dark:bg-purple-500/5 border-purple-100 dark:border-purple-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest flex items-center gap-1 text-purple-700 dark:text-purple-400">
                      Convert to {baseCurrency}
                    </span>
                    <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="text-[10px] font-black text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 bg-purple-600 hover:bg-purple-700">
                      <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} /> {isFetchingRate ? 'Fetching...' : 'Get Live Rate'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-500">1 {formData.currency} = </span>
                    <input type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} placeholder={`Rate in ${baseCurrency}`} 
                      className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-all" />
                  </div>
                </div>
              )}

              {!formData.isSynced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                      Gateway Fee 
                      <span className="text-[8px] bg-rose-100 text-rose-600 dark:bg-rose-500/20 px-2 py-0.5 rounded-full">IN {formData.currency}</span>
                    </label>
                    <input type="number" step="any" value={formData.fee} onChange={(e) => setFormData({...formData, fee: e.target.value})} placeholder={`Fee in ${formData.currency}`} 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Ref ID / TxHash</label>
                    <input type="text" value={formData.referenceNo} onChange={(e) => setFormData({...formData, referenceNo: e.target.value})} placeholder="e.g. TXN123..." 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-all" />
                  </div>
                </div>
              )}

              {!formData.isSynced && (
                <div className="px-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <span className="block text-xs font-bold text-slate-500">Net Deposit: {netNativeAmount.toLocaleString(undefined, {maximumFractionDigits: 2})} {formData.currency}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Final Base Value</span>
                      <span className="text-xl font-black tracking-tight text-purple-600 dark:text-purple-400">
                        {currencySymbol}{calculatedFinalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 🚀 DATE PICKER WITH LOCAL DATE INFO */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                  <span>Date</span>
                  <span className="text-purple-500">{formatGlobalDate ? formatGlobalDate(formData.date, 'full') : ''}</span>
                </label>
                <input disabled={formData.isSynced} type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-all disabled:opacity-60" />
              </div>

              <button type="submit" disabled={isSaving} className={`w-full p-4 shrink-0 rounded-2xl font-black text-white text-lg transition-all shadow-xl flex items-center justify-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} bg-purple-600 hover:bg-purple-700 shadow-purple-500/20`}>
                {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : null}
                {isSaving ? 'Processing...' : (editingId ? 'Update Wallet Name' : 'Secure E-Deposit')}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-full flex items-center justify-center text-3xl mb-4">
                <HiOutlineLockClosed />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">
                You are about to delete <span className="text-slate-800 dark:text-white uppercase">"{deleteContext.title}"</span>.
              </p>
              
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                  <HiOutlineExclamationCircle size={16} className="shrink-0" />
                  WARNING: This will permanently remove {currencySymbol}{(deleteContext.finalBaseAmount || deleteContext.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} from your Online Vault.
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

export default OnlineWallet;