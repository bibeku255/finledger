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
  "Hardware Wallet (Ledger/Trezor)", 
  "CoinPayU", "Cointiply", "FreeBitcoin", "FireFaucet", "PipeFlare", 
  "GlobalHive", "AdBTC", "Viefaucet", "DutchyCorp", "LarvelFaucet", 
  "Coinpot", "RollerCoin", "Other Wallet/Site"
];

// 🚀 BINANCE SAFE COINS TO PREVENT CORS/404 ERRORS
const BINANCE_SAFE_COINS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX', 'LTC', 'BCH', 'ADA', 'XMR', 'XLM', 'DAI', 'ZEC', 'SHIB', 'SUI', 'TON', 'DOT', 'PEPE', 'NEAR', 'POL', 'ATOM', 'ARB', 'BONK', 'CAKE', 'XTZ', 'FLOKI', 'OP', 'TWT', 'BAT', 'DGB', 'KAVA', 'AVAX', 'MEME', 'DASH'];

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
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = [], formatGlobalDate } = useAuth();
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

  const [customUserCoins, setCustomUserCoins] = useState([]); 

  const todayDate = new Date().toISOString().split('T')[0];

  const cryptoSymbols = useMemo(() => {
    return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
  }, [selectedCryptos]);

  const [formData, setFormData] = useState({
    title: '', category: incomeCategories[0], vault: 'bank', 
    subWallet: '', 
    cryptoPlatform: 'Binance', asset: baseCurrency, 
    amount: '', exchangeRate: 1, date: todayDate, linkedIncomeId: '',
    isCustomSingle: false,
    isSynced: false 
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

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().customCoins) {
        setCustomUserCoins(userSnap.data().customCoins);
      }
    };
    fetchUserData();
  }, [user]);

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    selectedCryptos.forEach(c => {
       if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c);
    });
    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  // 🚀 FETCH EXISTING BANKS FOR AUTO-SUGGEST
  const [bankWalletLogs, setBankWalletLogs] = useState([]);
  useEffect(() => {
     if(!user) return;
     const fetchBanks = async () => {
        const q = query(collection(db, "users", user.uid, "bankWallet"));
        const snap = await getDocs(q);
        setBankWalletLogs(snap.docs.map(d => d.data().bankName).filter(Boolean));
     };
     fetchBanks();
  }, [user]);
  
  const existingBanks = useMemo(() => Array.from(new Set(bankWalletLogs)), [bankWalletLogs]);

  // 🚀 UPDATED HYBRID LIVE RATE FETCHER (WITH CORS FIX)
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
        const upperSym = formData.asset.toUpperCase();
        const coinObj = fullDatabase.find(c => c.symbol === upperSym) || {};
        const searchId = coinObj.id || formData.asset.toLowerCase();
        let priceUsd = null;

        if (coinObj.fetchMode === 'contract' && coinObj.network && coinObj.contractAddress) {
           try {
              const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${coinObj.network}/tokens/${coinObj.contractAddress}`);
              if (gtRes.ok) {
                 const gtJson = await gtRes.json();
                 priceUsd = parseFloat(gtJson.data.attributes.price_usd);
              }
           } catch(e) {}
        } 

        if (!priceUsd) {
           try {
               const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${searchId}&vs_currencies=usd`);
               const cgData = await cgRes.json();
               if (cgData[searchId]?.usd) priceUsd = parseFloat(cgData[searchId].usd);
           } catch(e) {}
        }

        if (!priceUsd && BINANCE_SAFE_COINS.includes(upperSym)) {
            try {
                const binanceSymbol = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
                const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
                if (bRes.ok) {
                    const bData = await bRes.json();
                    priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
                }
            } catch(e) {}
        }

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
      // 🚀 GLOBAL DATE MONTH GROUPING
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
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

  // 🚀 REPORT DOWNLOAD LOGIC
  const handleDownloadReport = (format) => {
    const filteredForReport = incomes.filter(inc => {
      const matchSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || inc.asset.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = filterCategory === 'all' || inc.category === filterCategory;
      return matchSearch && matchCategory;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredForReport.length === 0) return alert("No records found to download based on current filters.");

    const reportData = filteredForReport.map(rec => {
      const cleanTitle = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const sourceText = `${rec.vault.charAt(0).toUpperCase() + rec.vault.slice(1)} Vault${rec.subWallet ? ` (${rec.subWallet})` : ''}`;
      const nativeAmtText = `${(Number(rec.amount) || 0).toLocaleString()} ${rec.asset}`;

      return {
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

    if (formData.vault === 'crypto' && !formData.cryptoPlatform.trim()) return alert("Please specify the crypto platform.");
    if ((formData.vault === 'bank' || formData.vault === 'online') && !formData.subWallet.trim()) return alert("Please specify the Bank or Wallet Name.");

    setIsSaving(true);
    const timestamp = editingId ? incomes.find(i => i.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const linkId = formData.linkedIncomeId || `INC_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    const incomeRecord = {
      title: formData.title, category: formData.category, vault: formData.vault,
      subWallet: (formData.vault === 'bank' || formData.vault === 'online') ? formData.subWallet.trim() : '', 
      cryptoPlatform: formData.vault === 'crypto' ? formData.cryptoPlatform : '',
      asset: formData.asset, amount: parseFloat(formData.amount),
      exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
      finalBaseAmount, date: formData.date, timestamp, linkedIncomeId: linkId
    };

    let targetVault = ''; let vaultRecord = {};
    if (formData.vault === 'crypto') {
      targetVault = 'cryptoWalletLogs';
      vaultRecord = { 
        type: 'in', coin: formData.asset, quantity: parseFloat(formData.amount), platform: formData.cryptoPlatform, 
        reason: `Income: ${formData.category} (${formData.title})`, referenceNo: linkId, date: formData.date, timestamp, linkedIncomeId: linkId 
      };
    } else {
      targetVault = formData.vault === 'bank' ? 'bankWallet' : formData.vault === 'cash' ? 'cashWallet' : 'onlineWallet';
      vaultRecord = { 
        title: `Income: ${formData.category} (${formData.title})`, type: 'in', date: formData.date, timestamp, 
        currency: formData.asset, foreignAmount: parseFloat(formData.amount), exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1, 
        finalBaseAmount, linkedIncomeId: linkId, transferType: 'Income Deposit', fee: 0,
        walletName: formData.subWallet || 'Default Wallet', 
        bankName: formData.subWallet || 'Default Bank',
      };
    }

    try {
      if (editingId) {
        if (formData.isSynced) {
           // SAFE EDIT: Only update subWallet mapping for synced entries
           await updateDoc(doc(db, "users", user.uid, "incomeLogs", editingId), {
               subWallet: formData.subWallet,
               vault: formData.vault
           });
           const vaults = ['bankWallet', 'onlineWallet'];
           for (const v of vaults) {
              if(linkId) {
                const q = query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", linkId));
                const snap = await getDocs(q);
                snap.forEach(async (d) => {
                   await updateDoc(doc(db, "users", user.uid, v, d.id), {
                       walletName: formData.subWallet,
                       bankName: formData.subWallet
                   });
                });
              }
           }
        } else {
           // Normal Edit
           const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
           for (const v of vaults) {
             const q = query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", linkId));
             const snap = await getDocs(q);
             snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
           }
           await updateDoc(doc(db, "users", user.uid, "incomeLogs", editingId), incomeRecord);
           await addDoc(collection(db, "users", user.uid, targetVault), vaultRecord);
        }
      } else {
        await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeRecord);
        await addDoc(collection(db, "users", user.uid, targetVault), vaultRecord);
      }
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
    const lastBank = existingBanks.length > 0 ? existingBanks[0] : '';
    setFormData({ 
      title: '', category: incomeCategories[0], vault: 'bank', 
      subWallet: lastBank,
      cryptoPlatform: cryptoPlatformsList[12], asset: baseCurrency, 
      amount: '', exchangeRate: 1, date: todayDate, linkedIncomeId: '', isCustomSingle: false, isSynced: false
    }); 
  };
  
  const closeModal = () => setIsModalOpen(false);
  
  const handleEdit = (rec) => { 
    const isSyncedEntry = !!(rec.linkedIncomeId && !rec.linkedIncomeId.startsWith('INC_'));
    setFormData({ 
      title: rec.title, category: rec.category, vault: rec.vault || 'bank', 
      subWallet: rec.subWallet || rec.bankName || rec.walletName || '', // Legacy mappings
      cryptoPlatform: rec.cryptoPlatform || cryptoPlatformsList[12], asset: rec.asset || baseCurrency, 
      amount: rec.amount, exchangeRate: rec.exchangeRate || 1, date: rec.date, linkedIncomeId: rec.linkedIncomeId,
      isCustomSingle: rec.vault === 'crypto' && !cryptoPlatformsList.includes(rec.cryptoPlatform),
      isSynced: isSyncedEntry
    }); 
    setEditingId(rec.id); 
    setIsModalOpen(true); 
  };

  const getVaultIcon = (v) => {
    if (v === 'bank') return <FaUniversity className="text-blue-500" />;
    if (v === 'cash') return <FaMoneyBillWave className="text-emerald-500" />;
    if (v === 'crypto') return <FaBitcoin className="text-orange-500" />;
    return <FaWallet className="text-purple-500" />;
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
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
        <div className="p-8 bg-slate-900 rounded-[2.5rem] shadow-xl md:col-span-2 relative overflow-hidden border border-slate-700/50">
           <div className="absolute right-0 top-0 opacity-5 text-white blur-[2px] -mt-10 -mr-10"><HiOutlineBriefcase size={250} /></div>
           <div className="relative z-10">
             <p className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-2">Total Life-Time Value</p>
             <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter"><span className="text-emerald-500 mr-2">{currencySymbol}</span>{totalIncomeBase.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
           </div>
        </div>
        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Entries</p>
           <p className="text-4xl font-black dark:text-white">{incomes.length}</p>
        </div>
      </div>

      {/* SEARCH/FILTER */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-2 rounded-3xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search client or asset..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-4 py-4 bg-transparent font-bold outline-none dark:text-white"/>
        </div>
        <div className="w-px bg-slate-200 dark:bg-slate-800 hidden md:block my-2"></div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="pl-5 pr-12 py-4 bg-transparent font-bold outline-none cursor-pointer dark:text-white border-t md:border-t-0 border-slate-200 dark:border-slate-800">
          <option value="all">All Categories</option>
          {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* LEDGER */}
      <div className="space-y-8">
        {isLoading ? <div className="p-10 text-center animate-pulse font-black text-slate-400">SYNCING DATA...</div> : processedIncomes.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl text-slate-500 font-bold border border-slate-200 dark:border-slate-800">No Incomes Found.</div>
        ) : processedIncomes.map((month) => (
          <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/20">
              <h2 className="text-xl font-black dark:text-white">{month.monthName}</h2>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Opening Balance</p>
                <p className="font-bold dark:text-slate-300">{currencySymbol}{month.openingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-4 pl-6">Date</th>
                    <th className="p-4">Source & Category</th>
                    <th className="p-4">Vault Details</th>
                    <th className="p-4 text-right">Native Asset</th>
                    <th className="p-4 text-right">Base Value</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {month.records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                      {/* 🚀 GLOBAL DATE APPLIED HERE */}
                      <td className="p-4 pl-6 text-xs font-bold text-slate-500">
                        {formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date}
                      </td>
                      <td className="p-4">
                        <p className="font-black dark:text-white text-sm mb-0.5">{rec.title}</p>
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 text-[9px] font-black uppercase tracking-wider rounded">{rec.category}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 w-max bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                           <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                             {getVaultIcon(rec.vault)} {rec.vault} Vault
                           </div>
                           {(rec.vault === 'bank' || rec.vault === 'online') && rec.subWallet && (
                             <div className="text-[10px] font-bold text-blue-500 flex items-center gap-1 mt-0.5 ml-1"><FaBuilding/> {rec.subWallet}</div>
                           )}
                           {rec.vault === 'crypto' && rec.cryptoPlatform && (
                             <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1"><FaBuilding/> {rec.cryptoPlatform}</div>
                           )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-bold dark:text-slate-300">
                         {rec.amount.toLocaleString()} <span className="text-[10px] text-slate-400 uppercase">{rec.asset}</span>
                         {rec.asset !== baseCurrency && <p className="text-[9px] text-slate-400 font-bold mt-0.5">@ {rec.exchangeRate} rate</p>}
                      </td>
                      <td className="p-4 text-right font-black text-emerald-600">+{currencySymbol}{rec.finalBaseAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="p-4 pr-6 text-right">
                         <div className="flex items-center justify-end gap-2">
                           {rec.linkedIncomeId && !rec.linkedIncomeId.startsWith('INC_') && (
                              <span className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-widest rounded border border-slate-200 dark:border-slate-700">Auto-Synced</span>
                           )}
                           {/* 🚀 ALWAYS SHOW PENCIL SO WE CAN FIX OLD BANK NAMES */}
                           <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition-all shadow-sm">
                             <HiOutlinePencil size={18} />
                           </button>
                           <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all shadow-sm" title={rec.linkedIncomeId && !rec.linkedIncomeId.startsWith('INC_') ? "Force Delete Auto-Synced Entry" : "Delete"}>
                             <HiOutlineTrash size={18} />
                           </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 flex justify-between items-center bg-emerald-50/30 dark:bg-emerald-900/10 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End of Period</span>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Mined / Earned</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{currencySymbol}{(month.closingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 🚀 MODAL ENGINE (RE-ALIGNED FOR PROPER SIZING & SELECTION) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-800 animate-in zoom-in-95 flex flex-col max-h-[90dvh]">
            
            {/* Header */}
            <div className="px-8 py-5 flex justify-between items-center bg-emerald-500 text-white font-black shrink-0">
              <h3 className="text-xl">{editingId ? 'EDIT INCOME ENTRY' : 'LOG INCOME'}</h3>
              <button type="button" onClick={closeModal} className="p-2 hover:bg-white/20 rounded-full transition-colors"><HiOutlineX size={24}/></button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveEntry} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              
              {/* 🚀 WARNING FOR AUTO-SYNCED ENTRIES */}
              {formData.isSynced && (
                 <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 p-4 rounded-xl text-xs font-bold leading-relaxed border border-amber-200 dark:border-amber-500/30">
                   <span className="flex items-center gap-1 mb-1"><HiOutlineExclamationCircle size={16}/> Auto-Synced Entry</span>
                   This income came from outside (e.g. Yield Farming or Party Refund). You can only update the <span className="underline">Bank Name / Vault</span> here to organize your money. To change amounts or dates, edit the original source.
                 </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title / Source Name</label>
                  <input disabled={formData.isSynced} type="text" required value={formData.title} onChange={(e)=>setFormData({...formData, title:e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"/>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <div className="relative">
                    <select disabled={formData.isSynced} value={formData.category} onChange={(e)=>setFormData({...formData, category:e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none disabled:opacity-60">
                      {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>

              {/* 🚀 VAULT LOGIC ENGINE - FIXED FOR CRYPTO SELECTION */}
              <div className="p-5 bg-emerald-50/30 dark:bg-emerald-500/5 rounded-3xl border border-emerald-100 dark:border-emerald-500/10 space-y-6">
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vault / Storage</label>
                      <div className="relative">
                        <select value={formData.vault} onChange={(e) => {
                            const v = e.target.value;
                            const cList = cryptoSymbols.length > 0 ? cryptoSymbols : ['BTC'];
                            setFormData({
                                ...formData, 
                                vault: v, 
                                asset: v === 'crypto' ? cList[0] : baseCurrency, 
                                subWallet: '',
                                exchangeRate: 1
                            });
                        }} className="w-full p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none">
                          <option value="bank">Bank Account</option>
                          <option value="online">Online E-Wallet</option>
                          <option value="cash">Physical Cash</option>
                          <option value="crypto" className="font-black text-emerald-500">Crypto Engine</option>
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                      </div>
                    </div>

                    {/* FIAT SUB-WALLET */}
                    {(formData.vault === 'bank' || formData.vault === 'online') && (
                      <div className="space-y-2 animate-in fade-in">
                        <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest ml-1">{formData.vault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
                        <input type="text" list="sub-wallets-inc" required value={formData.subWallet} onChange={(e) => setFormData({...formData, subWallet: e.target.value})} placeholder={formData.vault === 'bank' ? "e.g. SBI, RRR" : "e.g. Paytm, eSewa"} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                        <datalist id="sub-wallets-inc">
                           {existingBanks.map(b => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                    )}

                    {/* CRYPTO PLATFORM */}
                    {formData.vault === 'crypto' && (
                      <div className="space-y-2 animate-in fade-in">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform</label>
                        {formData.isCustomSingle ? (
                          <div className="flex gap-2">
                            <input type="text" required placeholder="Custom platform..." value={formData.cryptoPlatform} onChange={(e)=>setFormData({...formData, cryptoPlatform: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                            <button type="button" onClick={()=>{setFormData({...formData, isCustomSingle: false, cryptoPlatform: cryptoPlatformsList[12]});}} className="px-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500"><HiOutlineX size={20}/></button>
                          </div>
                        ) : (
                          <div className="relative">
                            <select value={cryptoPlatformsList.includes(formData.cryptoPlatform) ? formData.cryptoPlatform : 'CUSTOM'} onChange={(e) => { if(e.target.value === 'CUSTOM'){ setFormData({...formData, isCustomSingle: true, cryptoPlatform: ''}); } else { setFormData({...formData, cryptoPlatform: e.target.value}); } }} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none">
                              {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                              <option value="CUSTOM" className="font-black text-orange-500">✨ Custom Platform</option>
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* FIAT CURRENCY */}
                    {formData.vault !== 'crypto' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Currency</label>
                        <div className="relative">
                          <select disabled={formData.isSynced} value={formData.asset} onChange={(e)=>setFormData({...formData, asset:e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} className="w-full p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none disabled:opacity-60">
                            <option value={baseCurrency}>{baseCurrency} (Base)</option>
                            {selectedFiats.filter(c => c !== baseCurrency).map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                          <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                        </div>
                      </div>
                    )}
                 </div>

                 {/* 🚀 CRYPTO COIN SELECTION FIX */}
                 {formData.vault === 'crypto' && (
                    <div className="space-y-2 animate-in fade-in">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Crypto Asset</label>
                      <div className="relative">
                        <select disabled={formData.isSynced} value={formData.asset} onChange={(e)=>setFormData({...formData, asset:e.target.value, exchangeRate: 1})} className="w-full p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none disabled:opacity-60">
                          {cryptoSymbols.map(a=><option key={a} value={a}>{a}</option>)}
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                      </div>
                    </div>
                 )}
              </div>

              {/* AMOUNT ENTRY */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity Received</label>
                <div className="relative">
                  <input disabled={formData.isSynced} type="number" step="any" required value={formData.amount} onChange={(e)=>setFormData({...formData, amount:e.target.value})} placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-black text-2xl text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 text-center tracking-widest"/>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">{formData.asset}</span>
                </div>
              </div>

              {/* RATE SYNCING */}
              {isForeign && (
                <div className={`p-4 bg-blue-50 dark:bg-blue-500/5 rounded-2xl border dark:border-blue-500/10 flex items-center justify-between ${formData.isSynced ? 'opacity-60' : ''}`}>
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rate:</span>
                     <input disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} placeholder={`in ${baseCurrency}`} className="w-24 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold dark:text-white outline-none focus:border-blue-400 text-xs" />
                   </div>
                   <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate || formData.isSynced} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-1 transition-colors">
                     <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} /> {isFetchingRate ? 'FETCHING' : 'LIVE RATE'}
                   </button>
                </div>
              )}

              {/* 🚀 GLOBAL DATE IN MODAL */}
              <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                 <div className="flex flex-col">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Date</label>
                   <input disabled={formData.isSynced} type="date" required value={formData.date} onChange={(e)=>setFormData({...formData, date:e.target.value})} className="bg-transparent font-black dark:text-white outline-none cursor-pointer disabled:opacity-60 pl-1"/>
                   <span className="text-[10px] font-bold text-emerald-500 mt-1 ml-1">{formatGlobalDate ? formatGlobalDate(formData.date, 'short') : ''}</span>
                 </div>
                 <div className="w-px h-10 bg-slate-200 dark:bg-slate-700"></div>
                 <div className="text-right pl-2">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Final Fiat Impact</p>
                   <p className="text-2xl font-black text-emerald-500 tracking-tight">{currencySymbol}{finalBaseAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                 </div>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-2">
                <button type="submit" disabled={isSaving} className="w-full p-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex justify-center items-center gap-2">
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : null}
                  {isSaving ? 'SYNCING...' : (editingId ? 'UPDATE RECORD' : 'CONFIRM INCOME')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* PIN MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 text-center border dark:border-slate-800 animate-in fade-in zoom-in-95 shadow-2xl">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"><HiOutlineLockClosed/></div>
            <h3 className="text-2xl font-black dark:text-white">Security Check</h3>
            <p className="text-sm text-slate-500 mt-2 mb-6 font-bold uppercase tracking-widest">Enter PIN to delete "{deleteContext.title}"</p>

            {deleteContext.linkedIncomeId && !deleteContext.linkedIncomeId.startsWith('INC_') ? (
               <div className="mt-4 mb-6 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl">
                 <p className="text-xs font-black text-rose-700 dark:text-rose-400 flex items-start gap-1 text-left">
                   <HiOutlineExclamationCircle size={16} className="shrink-0" /> 
                   CRITICAL WARNING: This is an Auto-Synced entry. Force-deleting it will deduct funds from your vault but may cause mismatches in the parent module.
                 </p>
               </div>
            ) : (
               <div className="mt-4 mb-6 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                 <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                   <HiOutlineExclamationCircle size={16} className="shrink-0" /> 
                   WARNING: Deleting this income will remove funds from your Vaults to keep balances accurate.
                 </p>
               </div>
            )}
            
            <form onSubmit={executeSecureDelete} className="space-y-4">
              <div>
                <input type="password" required maxLength={6} autoFocus value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center text-3xl tracking-[0.5em] font-black outline-none border dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-rose-500/50 transition-all"/>
                {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce mt-2">{pinError}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setDeleteContext(null)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">CANCEL</button>
                <button type="submit" disabled={isVerifying} className="flex-1 p-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-lg transition-colors">
                  {isVerifying ? 'VERIFYING...' : 'DELETE'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default IncomeStreams;