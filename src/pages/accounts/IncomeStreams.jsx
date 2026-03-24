import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineBriefcase,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineChevronDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaMoneyBillWave, FaArrowDown, FaBitcoin, FaUniversity, FaWallet, FaExchangeAlt, FaBuilding } from 'react-icons/fa';

const fiatCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];

const cryptoPlatformsList = [
  "Binance", "CoinDCX", "WazirX", "ZebPay", "Mudrex", "SunCrypto",
  "Coinbase", "Bybit", "KuCoin", "OKX", "Kraken", "Mexc", "Gate.io",
  "FaucetPay", "Trust Wallet", "MetaMask", "Phantom", "NC Wallet", "Payeer",
  "Ledger (Hardware)", "Trezor (Hardware)", 
  "CoinPayU", "Cointiply", "FreeBitcoin", "FireFaucet", "PipeFlare", 
  "GlobalHive", "AdBTC", "Viefaucet", "DutchyCorp", "LarvelFaucet", 
  "Coinpot", "RollerCoin", "Other Wallet/Site"
];

const incomeCategories = [
  "Salary & Wages", "Freelancing & Contracts", "Business Sales", 
  "Crypto Staking Rewards", "Crypto APR / Yield", "P2P Trading Profit",
  "Dividends & Investments", "Rental Income", "Gifts & Grants", "Other Income"
];

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const IncomeStreams = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'INR', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [incomes, setIncomes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // 🔐 Security Delete States
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    title: '', category: incomeCategories[0], vault: 'bank', 
    cryptoPlatform: 'Binance', asset: baseCurrency, 
    amount: '', exchangeRate: 1, date: todayDate, linkedIncomeId: '' 
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "incomeLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIncomes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 🧠 SMART ASSET LIST: Direct object extraction
  const activeAssetList = useMemo(() => {
    if (formData.vault === 'crypto') {
        // Extract symbols cleanly from the objects
        return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    }
    return fiatCurrencies;
  }, [formData.vault, selectedCryptos]);

  // 🚀 UPDATED LIVE RATE FETCHER (100% Crash-Proof & Pegged Safe)
  const fetchLiveRate = async () => {
    if (formData.asset === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fiatData = await fiatRes.json();
      const usdToBase = fiatData.rates[baseCurrency] || 1;

      if (fiatCurrencies.includes(formData.asset)) {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.asset}`);
        const data = await res.json();
        if (data.rates[baseCurrency]) setFormData(prev => ({ ...prev, exchangeRate: data.rates[baseCurrency].toFixed(4) }));
      } else {
        // 1. Get full coin object from selectedCryptos
        const coinObj = selectedCryptos.find(c => 
          (typeof c === 'string' ? c : c.symbol).toUpperCase() === formData.asset.toUpperCase()
        );
        
        // 2. Identify the search ID (Crucial for pegged tokens like ROX/CTC -> tether)
        const searchId = coinObj?.id || formData.asset.toLowerCase();
        let priceUsd = null;

        // 3. Try CoinGecko First
        try {
            const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${searchId}&vs_currencies=usd`);
            const cgData = await cgRes.json();
            if (cgData[searchId]?.usd) priceUsd = parseFloat(cgData[searchId].usd);
        } catch(e) { console.warn("CoinGecko API Error", e); }

        // 4. Try Binance Fallback
        if (!priceUsd) {
            try {
                // If it's a tether pegged coin, just get BTC price to verify Binance is alive, but hardcode $1
                const binanceSymbol = searchId === 'tether' ? 'BTCUSDT' : `${formData.asset.toUpperCase()}USDT`;
                const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
                if (bRes.ok) {
                    const bData = await bRes.json();
                    priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
                }
            } catch(e) { console.warn("Binance API Error", e); }
        }

        // 5. Final Calculation
        const finalPrice = priceUsd || (coinObj?.fallbackPrice || 0);
        const finalRate = finalPrice * usdToBase;
        
        setFormData(prev => ({ ...prev, exchangeRate: finalRate.toFixed(6) }));
      }
    } catch (error) {
      alert("Rate fetch failed. Please enter manually.");
    } finally {
      setIsFetchingRate(false);
    }
  };

  const isForeign = formData.asset !== baseCurrency;
  const finalBaseAmount = (parseFloat(formData.amount) || 0) * (isForeign ? (parseFloat(formData.exchangeRate) || 1) : 1);

  // --- Processed Incomes & Running Balance Logic ---
  const processedIncomes = useMemo(() => {
    const filtered = incomes.filter(inc => {
      const matchSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || inc.asset.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = filterCategory === 'all' || inc.category === filterCategory;
      return matchSearch && matchCategory;
    });
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const grouped = {};
    
    sorted.forEach(t => {
      const dateObj = new Date(t.date || new Date());
      // 🚀 NAYA LOGIC: Grouping based on the Global Date Format (Month & Year)
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      // Use raw English 'YYYY-MM' key just for logical grouping/sorting
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[monthKey]) grouped[monthKey] = { monthName, openingBalance: runningBalance, records: [], closingBalance: 0 };
      
      const finalAmount = Number(t.finalBaseAmount || 0);
      runningBalance += finalAmount; 
      grouped[monthKey].records.push({ ...t, finalAmount });
      grouped[monthKey].closingBalance = runningBalance;
    });
    return Object.keys(grouped).sort().reverse().map(key => ({ ...grouped[key], records: grouped[key].records.reverse() }));
  }, [incomes, searchTerm, filterCategory, formatGlobalDate]);

  const totalIncomeBase = incomes.reduce((acc, curr) => acc + (Number(curr.finalBaseAmount) || 0), 0);

  // 🚀 REPORT DOWNLOAD LOGIC FOR INCOME STREAMS
  const handleDownloadReport = (format) => {
    const filteredForReport = incomes.filter(inc => {
      const matchSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || inc.asset.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = filterCategory === 'all' || inc.category === filterCategory;
      return matchSearch && matchCategory;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredForReport.length === 0) return alert("No records found to download based on current filters.");

    const reportData = filteredForReport.map(rec => {
      const cleanTitle = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const sourceText = `${rec.vault.charAt(0).toUpperCase() + rec.vault.slice(1)} Vault`;
      const nativeAmtText = `${(Number(rec.amount) || 0).toLocaleString()} ${rec.asset}`;

      return {
        // 🚀 GLOBAL DATE IN REPORTS
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        source: cleanTitle,
        category: rec.category,
        vault: sourceText,
        nativeAmount: nativeAmtText,
        baseValue: `${currencySymbol}${Math.abs(rec.finalBaseAmount || 0).toFixed(2)}`
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Source / Item', key: 'source' },
      { header: 'Category', key: 'category' },
      { header: 'Vault Deposited', key: 'vault' },
      { header: 'Native Amount', key: 'nativeAmount' },
      { header: 'Base Value Equiv.', key: 'baseValue' }
    ];

    const fileName = `Income_Streams_Report`;
    const reportTitle = filterCategory !== 'all' ? `Income Streams - ${filterCategory}` : `Income Streams - Complete Ledger`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login!");
    setIsSaving(true);
    const timestamp = editingId ? incomes.find(i => i.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const linkId = formData.linkedIncomeId || `INC_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    const incomeRecord = {
      title: formData.title, category: formData.category, vault: formData.vault,
      cryptoPlatform: formData.vault === 'crypto' ? formData.cryptoPlatform : '',
      asset: formData.asset, amount: parseFloat(formData.amount),
      exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
      finalBaseAmount, date: formData.date, timestamp, linkedIncomeId: linkId
    };

    let targetVault = ''; let vaultRecord = {};
    if (formData.vault === 'crypto') {
      targetVault = 'cryptoWalletLogs';
      vaultRecord = { type: 'in', coin: formData.asset, quantity: parseFloat(formData.amount), platform: formData.cryptoPlatform, reason: `Income: ${formData.title}`, referenceNo: linkId, date: formData.date, timestamp, linkedIncomeId: linkId };
    } else {
      targetVault = formData.vault === 'bank' ? 'bankWallet' : formData.vault === 'cash' ? 'cashWallet' : 'onlineWallet';
      vaultRecord = { title: `Income: ${formData.title}`, type: 'in', date: formData.date, timestamp, currency: formData.asset, foreignAmount: parseFloat(formData.amount), exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1, finalBaseAmount, linkedIncomeId: linkId, walletName: formData.category, transferType: 'Income Deposit' };
    }

    try {
      if (editingId) {
        const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
        for (const v of vaults) {
          const q = query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", linkId));
          const snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
        }
        await updateDoc(doc(db, "users", user.uid, "incomeLogs", editingId), incomeRecord);
      } else {
        await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeRecord);
      }
      await addDoc(collection(db, "users", user.uid, targetVault), vaultRecord);
      closeModal();
    } catch (error) { alert("Error saving."); } finally { setIsSaving(false); }
  };

  const initiateDelete = (rec) => {
    setDeleteContext(rec);
    setPinInput('');
    setPinError('');
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your PIN.");
    setIsVerifying(true);
    setPinError('');

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userData?.security?.pinHash || userData?.securityPin || userData?.pin; 
      
      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect PIN."); 
        setIsVerifying(false); 
        return;
      }
      
      await deleteDoc(doc(db, "users", user.uid, "incomeLogs", deleteContext.id));
      
      if (deleteContext.linkedIncomeId) {
        const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs']; 
        for (const v of vaults) {
          const q = query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", deleteContext.linkedIncomeId));
          const snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
        }
      }
      setDeleteContext(null); 
    } catch (e) { 
      console.error(e);
      setPinError("System error during deletion."); 
    } finally { 
      setIsVerifying(false); 
    }
  };

  const openModal = () => { 
    setEditingId(null); 
    setIsModalOpen(true); 
    setFormData({ 
      title: '', category: incomeCategories[0], vault: 'bank', 
      cryptoPlatform: 'Binance', asset: baseCurrency, 
      amount: '', exchangeRate: 1, date: todayDate, linkedIncomeId: '' 
    }); 
  };
  
  const closeModal = () => setIsModalOpen(false);
  const handleEdit = (rec) => { setFormData({ ...rec }); setEditingId(rec.id); setIsModalOpen(true); };

  const getVaultIcon = (v) => {
    if (v === 'bank') return <FaUniversity className="text-blue-500" />;
    if (v === 'cash') return <FaMoneyBillWave className="text-emerald-500" />;
    if (v === 'crypto') return <FaBitcoin className="text-orange-500" />;
    return <FaWallet className="text-purple-500" />;
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto px-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-emerald-500/10 text-emerald-500 rounded-2xl ring-1 ring-emerald-500/20"><HiOutlineBriefcase size={26} /></div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Income Streams</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 max-w-xl">Track salaries, crypto rewards, and freelance income. Auto-synced with your vaults.</p>
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

          <button onClick={openModal} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 md:px-7 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm shadow-lg active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap">
            <HiOutlinePlus size={20}/> <span className="hidden sm:inline">Log New Income</span><span className="sm:hidden">Log</span>
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-slate-900 rounded-3xl shadow-xl md:col-span-2 relative overflow-hidden">
           <div className="relative z-10">
             <p className="text-sm font-black text-emerald-400 uppercase mb-2">Total Life-Time Value</p>
             <h2 className="text-5xl font-black text-white tracking-tighter">{currencySymbol}{totalIncomeBase.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
           </div>
        </div>
        <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
           <p className="text-xs font-black text-slate-400 uppercase mb-1">Total Entries</p>
           <p className="text-4xl font-black dark:text-white">{incomes.length}</p>
        </div>
      </div>

      {/* SEARCH/FILTER */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-2 rounded-3xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search client or asset..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 py-4 bg-transparent font-bold outline-none dark:text-white"/>
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-5 py-4 bg-transparent font-bold outline-none cursor-pointer dark:text-white border-l border-slate-200 dark:border-slate-800">
          <option value="all">All Categories</option>
          {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* LEDGER */}
      <div className="space-y-8">
        {isLoading ? <div className="p-10 text-center animate-pulse font-black text-slate-400">SYNCING DATA...</div> : processedIncomes.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl text-slate-500 font-bold">No Incomes Found.</div>
        ) : processedIncomes.map((month) => (
          <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/20">
              <h2 className="text-xl font-black dark:text-white">{month.monthName}</h2>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Opening</p>
                <p className="font-bold dark:text-slate-300">{currencySymbol}{month.openingBalance.toLocaleString()}</p>
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                  <tr><th className="p-4 pl-6">Date</th><th className="p-4">Source</th><th className="p-4">Vault</th><th className="p-4 text-right">Native</th><th className="p-4 text-right">Base Value</th><th className="p-4 pr-6 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {month.records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                      {/* 🚀 GLOBAL DATE APPLIED HERE */}
                      <td className="p-4 pl-6 text-xs font-bold text-slate-500">
                        {formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date}
                      </td>
                      <td className="p-4"><p className="font-black dark:text-white text-sm">{rec.title}</p><span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">{rec.category}</span></td>
                      <td className="p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">{getVaultIcon(rec.vault)} {rec.vault}</div></td>
                      <td className="p-4 text-right font-bold dark:text-slate-300">{rec.amount.toLocaleString()} <span className="text-[10px] text-slate-400">{rec.asset}</span></td>
                      <td className="p-4 text-right font-black text-emerald-600">+{currencySymbol}{rec.finalBaseAmount.toLocaleString()}</td>
                      <td className="p-4 pr-6 text-right">
                        <button onClick={() => handleEdit(rec)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg"><HiOutlinePencil/></button>
                        <button onClick={() => initiateDelete(rec)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg ml-1"><HiOutlineTrash/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-800 animate-in zoom-in-95">
            <div className="px-8 py-5 flex justify-between items-center bg-emerald-500 text-white font-black">
              <h3 className="text-xl">LOG INCOME</h3>
              <button onClick={closeModal}><HiOutlineX size={24}/></button>
            </div>
            <form onSubmit={handleSaveEntry} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Title</label><input type="text" required value={formData.title} onChange={(e)=>setFormData({...formData, title:e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none"/></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Category</label><select value={formData.category} onChange={(e)=>setFormData({...formData, category:e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none">{incomeCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              </div>

              <div className="p-5 bg-emerald-50/30 dark:bg-emerald-500/5 rounded-3xl border dark:border-emerald-500/10 space-y-6">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Vault</label><select value={formData.vault} onChange={(e)=>setFormData({...formData, vault:e.target.value, asset: e.target.value === 'crypto' ? activeAssetList[0] : baseCurrency})} className="w-full p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl font-bold dark:text-white">{['bank','online','cash','crypto'].map(v=><option key={v} value={v}>{v.toUpperCase()}</option>)}</select></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Asset</label><select value={formData.asset} onChange={(e)=>setFormData({...formData, asset:e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl font-bold dark:text-white">{activeAssetList.map(a=><option key={a} value={a}>{a}</option>)}</select></div>
                 </div>
                 {formData.vault === 'crypto' && (
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Platform</label><select value={formData.cryptoPlatform} onChange={(e)=>setFormData({...formData, cryptoPlatform:e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl font-bold dark:text-white">{cryptoPlatformsList.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                 )}
              </div>

              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Amount</label><input type="number" step="any" required value={formData.amount} onChange={(e)=>setFormData({...formData, amount:e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-black text-2xl text-emerald-600 outline-none"/></div>

              {isForeign && (
                <div className="p-4 bg-blue-50 dark:bg-blue-500/5 rounded-2xl border dark:border-blue-500/10 flex items-center justify-between">
                   <div className="text-[10px] font-black text-slate-400 uppercase">1 {formData.asset} = <span className="text-blue-500 text-sm ml-2">{formData.exchangeRate} {baseCurrency}</span></div>
                   <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">{isFetchingRate ? 'FETCHING...' : 'GET LIVE RATE'}</button>
                </div>
              )}

              {/* 🚀 GLOBAL DATE IN MODAL */}
              <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-700">
                 <div className="flex flex-col">
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-1">Date</label>
                   <input type="date" required value={formData.date} onChange={(e)=>setFormData({...formData, date:e.target.value})} className="bg-transparent font-black dark:text-white outline-none cursor-pointer"/>
                   <span className="text-[10px] font-bold text-emerald-500 mt-1">{formatGlobalDate ? formatGlobalDate(formData.date, 'full') : ''}</span>
                 </div>
                 <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase">Final addition</p><p className="text-2xl font-black text-emerald-500">{currencySymbol}{finalBaseAmount.toLocaleString()}</p></div>
              </div>

              <button type="submit" disabled={isSaving} className="w-full p-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">{isSaving ? 'SYNCING...' : 'CONFIRM LOG'}</button>
            </form>
          </div>
        </div>
      )}

      {/* PIN MODAL (Fixed Error UI) */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 text-center border dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"><HiOutlineLockClosed/></div>
            <h3 className="text-2xl font-black dark:text-white">Security Check</h3>
            <p className="text-sm text-slate-500 mt-2 mb-6 font-bold uppercase tracking-widest">Enter PIN to delete "{deleteContext.title}"</p>
            
            <form onSubmit={executeSecureDelete} className="space-y-4">
              <div>
                <input type="password" required maxLength={6} autoFocus value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center text-3xl tracking-[0.5em] font-black outline-none border dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-rose-500/50 transition-all"/>
                {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce mt-2">{pinError}</p>}
              </div>
              <button type="submit" disabled={isVerifying} className="w-full p-5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-lg transition-colors">
                {isVerifying ? 'VERIFYING...' : 'VERIFY & DELETE'}
              </button>
              <button type="button" onClick={()=>setDeleteContext(null)} className="w-full text-slate-400 font-bold hover:text-slate-600 dark:hover:text-slate-200">
                CANCEL
              </button>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default IncomeStreams;