import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineFilter, HiOutlineRefresh, HiOutlineShoppingCart,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineChevronDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaMoneyBillWave, FaArrowUp, FaUniversity, FaWallet, FaExchangeAlt, FaRandom, FaBitcoin, FaBuilding } from 'react-icons/fa';

const fiatCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];

// 🚀 MUST MATCH CRYPTOWALLET PLATFORMS
const cryptoPlatformsList = [
  "CoinDCX", "WazirX", "ZebPay", "Mudrex", "SunCrypto",
  "Binance", "Coinbase", "Bybit", "KuCoin", "OKX", "Kraken", "Mexc", "Gate.io",
  "FaucetPay", "Trust Wallet", "MetaMask", "Phantom", "NC Wallet", "Payeer",
  "Hardware Wallet (Ledger/Trezor)", 
  "CoinPayU", "Cointiply", "FreeBitcoin", "FireFaucet", "PipeFlare", 
  "GlobalHive", "AdBTC", "Viefaucet", "DutchyCorp", "LarvelFaucet", 
  "Coinpot", "RollerCoin", "Other Wallet/Site"
];

const expenseCategories = [
  "Food & Dining", "Groceries & Supermarket", "Rent & Housing",
  "Bills & Utilities", "Shopping & E-commerce", "Travel & Transport",
  "Entertainment & Subscriptions", "Crypto Trading Fees / Gas",
  "Forex & Bank Charges", "Health & Wellness", "Other Expenses"
];

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const ExpenseTracker = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'INR', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Security
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [customUserCoins, setCustomUserCoins] = useState([]); // Needed for Contract fetching
  
  const todayDate = new Date().toISOString().split('T')[0];

  const defaultSplitSource = { 
    vault: 'bank', 
    asset: baseCurrency, 
    cryptoPlatform: cryptoPlatformsList[12], 
    amount: '', 
    exchangeRate: 1,
    isCustomPlatform: false 
  };

  const [formData, setFormData] = useState({
    title: '', 
    category: expenseCategories[0],
    date: todayDate,
    linkedExpenseId: '',
    isSplit: false,
    vault: 'bank', 
    asset: baseCurrency, 
    cryptoPlatform: cryptoPlatformsList[12], 
    amount: '', 
    exchangeRate: 1, 
    isCustomSingle: false,
    splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ]
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "expenseLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Custom User Coins for Contract MetaData
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

  // Master Merge Engine for Coins
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

  const activeAssetList = useMemo(() => {
    if (formData.vault === 'crypto') {
        return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    }
    return fiatCurrencies;
  }, [formData.vault, selectedCryptos]);

  const getCryptoListForSplit = () => {
      return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
  };

  const processedExpenses = useMemo(() => {
    const filtered = expenses.filter(exp => {
      const matchSearch = exp.title.toLowerCase().includes(searchTerm.toLowerCase()) || (exp.asset && exp.asset.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = filterCategory === 'all' || exp.category === filterCategory;
      return matchSearch && matchCategory;
    });

    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const grouped = {};

    sorted.forEach(t => {
      const dateObj = new Date(t.date || new Date());
      // 🚀 NAYA LOGIC: Grouping based on the Global Date Format (Month & Year)
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      // Raw English 'YYYY-MM' key for correct chronological sorting behind the scenes
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) {
        grouped[monthKey] = { monthName, openingBalance: runningBalance, records: [], closingBalance: 0 };
      }
      runningBalance += Number(t.finalBaseAmount || 0); 
      grouped[monthKey].records.push({ ...t, finalAmount: Number(t.finalBaseAmount || 0) });
      grouped[monthKey].closingBalance = runningBalance;
    });

    return Object.keys(grouped).sort().reverse().map(key => ({ ...grouped[key], records: grouped[key].records.reverse() }));
  }, [expenses, searchTerm, filterCategory, formatGlobalDate]);

  const totalExpenseBase = expenses.reduce((acc, curr) => acc + (Number(curr.finalBaseAmount) || 0), 0);

  // 🚀 REPORT DOWNLOAD LOGIC (Now includes Global Date)
  const handleDownloadReport = (format) => {
    const filteredForReport = expenses.filter(exp => {
      const matchSearch = exp.title.toLowerCase().includes(searchTerm.toLowerCase()) || (exp.asset && exp.asset.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = filterCategory === 'all' || exp.category === filterCategory;
      return matchSearch && matchCategory;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredForReport.length === 0) return alert("No records found to download based on current filters.");

    const reportData = filteredForReport.map(rec => {
      const cleanTitle = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const sourceText = rec.isSplit ? 'Split Payment (Multi)' : `${rec.vault.charAt(0).toUpperCase() + rec.vault.slice(1)} Vault`;
      const nativeAmtText = rec.isSplit ? 'Multiple Assets' : `${(Number(rec.amount) || 0).toLocaleString()} ${rec.asset}`;

      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        payee: cleanTitle,
        category: rec.category,
        source: sourceText,
        nativeAmount: nativeAmtText,
        baseValue: `${currencySymbol}${Math.abs(rec.finalBaseAmount || 0).toFixed(2)}`
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Payee / Item', key: 'payee' },
      { header: 'Category', key: 'category' },
      { header: 'Payment Source', key: 'source' },
      { header: 'Native Amount', key: 'nativeAmount' },
      { header: 'Base Value Equiv.', key: 'baseValue' }
    ];

    const fileName = `Expense_Tracker_Report`;
    const reportTitle = filterCategory !== 'all' ? `Expense Tracker - ${filterCategory}` : `Expense Tracker - Complete Ledger`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  // 🚀 UPDATED HYBRID LIVE RATE FETCHER (GeckoTerminal + CoinGecko + Binance)
  const fetchLiveRate = async (index = null) => {
    const isSingle = index === null;
    const assetToCheck = isSingle ? formData.asset : formData.splitSources[index].asset;
    
    if (assetToCheck === baseCurrency) return;
    
    setIsFetchingRate(isSingle ? 'single' : index);
    try {
      const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fiatData = await fiatRes.json();
      const usdToBase = fiatData.rates[baseCurrency] || 1;

      let finalRate = 1;

      if (fiatCurrencies.includes(assetToCheck)) {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${assetToCheck}`);
        const data = await res.json();
        finalRate = data.rates[baseCurrency] || 1;
      } else {
        // 1. Get full coin object from fullDatabase
        const coinObj = fullDatabase.find(c => c.symbol === assetToCheck.toUpperCase()) || {};
        
        // 2. Identify the search ID
        const searchId = coinObj.id || assetToCheck.toLowerCase();
        let priceUsd = null;

        // 3. Try GeckoTerminal First if it's a Contract Token
        if (coinObj.fetchMode === 'contract' && coinObj.network && coinObj.contractAddress) {
           try {
              const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${coinObj.network}/tokens/${coinObj.contractAddress}`);
              if (gtRes.ok) {
                 const gtJson = await gtRes.json();
                 priceUsd = parseFloat(gtJson.data.attributes.price_usd);
              }
           } catch(e) {}
        } 

        // 4. Try CoinGecko First
        if (!priceUsd) {
           try {
               const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${searchId}&vs_currencies=usd`);
               const cgData = await cgRes.json();
               if (cgData[searchId]?.usd) priceUsd = parseFloat(cgData[searchId].usd);
           } catch(e) { console.warn("CoinGecko API Error"); }
        }

        // 5. Try Binance Fallback
        if (!priceUsd) {
            try {
                const binanceSymbol = searchId === 'tether' ? 'BTCUSDT' : `${assetToCheck.toUpperCase()}USDT`;
                const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
                if (bRes.ok) {
                    const bData = await bRes.json();
                    priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
                }
            } catch(e) { console.warn("Binance API Error"); }
        }

        // 6. Final Calculation
        const finalPrice = priceUsd || (coinObj?.fallbackPrice || 0);
        finalRate = finalPrice * usdToBase;
      }

      if (isSingle) {
        setFormData(prev => ({ ...prev, exchangeRate: finalRate.toFixed(6) }));
      } else {
        const updatedSplits = [...formData.splitSources];
        updatedSplits[index].exchangeRate = finalRate.toFixed(6);
        setFormData(prev => ({ ...prev, splitSources: updatedSplits }));
      }
    } catch (error) {
      alert("Rate fetch failed. Please enter manually.");
    } finally {
      setIsFetchingRate(false);
    }
  };

  const getBaseAmount = (amount, isForeign, rate) => (parseFloat(amount) || 0) * (isForeign ? (parseFloat(rate) || 1) : 1);

  const getSplitTotalBase = () => {
    return formData.splitSources.reduce((acc, curr) => {
      const isForeign = curr.asset !== baseCurrency;
      return acc + getBaseAmount(curr.amount, isForeign, curr.exchangeRate);
    }, 0);
  };

  const createVaultRecord = (sourceData, linkId) => {
    const isForeignAsset = sourceData.asset !== baseCurrency;
    const baseAmt = getBaseAmount(sourceData.amount, isForeignAsset, sourceData.exchangeRate);
    
    if (sourceData.vault === 'crypto') {
      return {
        collection: 'cryptoWalletLogs',
        data: {
          type: 'out', coin: sourceData.asset, quantity: sourceData.amount, platform: sourceData.cryptoPlatform,
          reason: `Expense: ${formData.category} (${formData.title}) ${formData.isSplit ? '[Split]' : ''}`,
          referenceNo: linkId, date: formData.date, timestamp: new Date(formData.date).getTime(), linkedExpenseId: linkId
        }
      };
    }
    
    return {
      collection: sourceData.vault + 'Wallet',
      data: {
        title: `Expense: ${formData.category} (${formData.title}) ${formData.isSplit ? '[Split]' : ''}`,
        type: 'out', date: formData.date, timestamp: new Date(formData.date).getTime(),
        currency: sourceData.asset, foreignAmount: sourceData.amount, exchangeRate: isForeignAsset ? parseFloat(sourceData.exchangeRate) : 1,
        fee: 0, finalBaseAmount: baseAmt, isExpense: true, linkedExpenseId: linkId,
        walletName: formData.category, bankName: formData.category, transferType: 'Payment/Expense',
        walletCategory: sourceData.vault === 'online' ? (fiatCurrencies.includes(sourceData.asset) ? 'Fiat Wallet' : 'Crypto Wallet') : 'Fiat Wallet'
      }
    };
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");

    if (!formData.isSplit) {
      if (formData.vault === 'crypto' && !formData.cryptoPlatform.trim()) return alert("Please specify the crypto platform.");
      if (!formData.amount || parseFloat(formData.amount) <= 0) return alert("Amount must be greater than zero.");
    } else {
      for (let i = 0; i < formData.splitSources.length; i++) {
        const s = formData.splitSources[i];
        if (!s.amount || parseFloat(s.amount) <= 0) return alert(`Amount in Source ${i + 1} must be greater than zero.`);
        if (s.vault === 'crypto' && !s.cryptoPlatform.trim()) return alert(`Please specify the crypto platform for Source ${i + 1}.`);
      }
    }

    setIsSaving(true);
    const timestamp = editingId ? expenses.find(i => i.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const linkId = formData.linkedExpenseId || `EXP_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    const totalBaseAmount = formData.isSplit ? getSplitTotalBase() : getBaseAmount(formData.amount, formData.asset !== baseCurrency, formData.exchangeRate);

    const expenseRecord = {
      title: formData.title,
      category: formData.category,
      asset: formData.isSplit ? 'Multiple' : formData.asset,
      amount: formData.isSplit ? totalBaseAmount : parseFloat(formData.amount),
      exchangeRate: formData.isSplit ? 1 : (formData.asset !== baseCurrency ? parseFloat(formData.exchangeRate) : 1),
      finalBaseAmount: totalBaseAmount,
      date: formData.date,
      timestamp,
      linkedExpenseId: linkId,
      isSplit: formData.isSplit,
      vault: formData.isSplit ? 'split' : formData.vault,
      cryptoPlatform: !formData.isSplit && formData.vault === 'crypto' ? formData.cryptoPlatform : '', 
      splitDetails: formData.isSplit ? formData.splitSources.map(s => ({
        vault: s.vault, asset: s.asset, amount: parseFloat(s.amount),
        cryptoPlatform: s.vault === 'crypto' ? s.cryptoPlatform : '', exchangeRate: parseFloat(s.exchangeRate)
      })) : null
    };

    try {
      if (editingId) {
        const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
        for (const v of vaults) {
           if(linkId) {
             const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", linkId));
             const snap = await getDocs(q);
             snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
           }
        }
        await updateDoc(doc(db, "users", user.uid, "expenseLogs", editingId), expenseRecord);
      } else {
        await addDoc(collection(db, "users", user.uid, "expenseLogs"), expenseRecord);
      }

      if (formData.isSplit) {
        for (let s of formData.splitSources) {
          const rec = createVaultRecord(s, linkId);
          await addDoc(collection(db, "users", user.uid, rec.collection), rec.data);
        }
      } else {
        const singleRec = createVaultRecord({ vault: formData.vault, asset: formData.asset, amount: parseFloat(formData.amount), exchangeRate: formData.exchangeRate, cryptoPlatform: formData.cryptoPlatform }, linkId);
        await addDoc(collection(db, "users", user.uid, singleRec.collection), singleRec.data);
      }

      closeModal();
    } catch (error) {
      alert("Failed to save expense log.");
    } finally {
      setIsSaving(false);
    }
  };

  const initiateDelete = (rec) => {
    setDeleteContext(rec);
    setPinInput('');
    setPinError('');
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your Security PIN.");
    setIsVerifying(true);
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
      
      // 1. Delete Master Expense Record
      await deleteDoc(doc(db, "users", user.uid, "expenseLogs", deleteContext.id));
      
      // 2. Delete the synced Vault entries to auto-refund the money!
      if (deleteContext.linkedExpenseId) {
        const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
        for (const v of vaults) {
          const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", deleteContext.linkedExpenseId));
          const snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
        }
      }
      setDeleteContext(null); 
    } catch (error) {
      setPinError("System error during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEdit = (rec) => {
    const isSplit = rec.isSplit || false;
    let mappedSplits = [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ];
    if (isSplit && rec.splitDetails) {
      mappedSplits = rec.splitDetails.map(s => ({
        vault: s.vault, asset: s.asset || baseCurrency, amount: s.amount || '',
        cryptoPlatform: s.cryptoPlatform || cryptoPlatformsList[12], exchangeRate: s.exchangeRate || 1,
        isCustomPlatform: s.vault === 'crypto' && !cryptoPlatformsList.includes(s.cryptoPlatform)
      }));
    }

    setFormData({
      title: rec.title, category: rec.category, date: rec.date, linkedExpenseId: rec.linkedExpenseId || '', isSplit: isSplit,
      vault: isSplit ? 'bank' : (rec.vault || 'bank'), asset: isSplit ? baseCurrency : (rec.asset || baseCurrency), amount: isSplit ? '' : (rec.amount || ''),
      exchangeRate: isSplit ? 1 : (rec.exchangeRate || 1), cryptoPlatform: isSplit ? cryptoPlatformsList[12] : (rec.cryptoPlatform || cryptoPlatformsList[12]),
      isCustomSingle: !isSplit && rec.vault === 'crypto' && !cryptoPlatformsList.includes(rec.cryptoPlatform), splitSources: mappedSplits
    });
    setEditingId(rec.id);
    setIsModalOpen(true);
  };

  const openModal = () => {
    setEditingId(null);
    setFormData({ 
      title: '', category: expenseCategories[0], date: todayDate, linkedExpenseId: '', isSplit: false,
      vault: 'bank', asset: baseCurrency, amount: '', exchangeRate: 1, cryptoPlatform: cryptoPlatformsList[12], isCustomSingle: false,
      splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ]
    });
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

  const getVaultIcon = (v) => {
    if (v === 'bank') return <FaUniversity className="text-blue-500" />;
    if (v === 'cash') return <FaMoneyBillWave className="text-emerald-500" />;
    if (v === 'crypto') return <FaBitcoin className="text-orange-500" />;
    if (v === 'online') return <FaWallet className="text-purple-500" />;
    return <FaRandom className="text-amber-500" />; 
  };

  const updateSplit = (index, field, value) => {
    const updated = [...formData.splitSources];
    updated[index][field] = value;
    if (field === 'vault') {
        const cList = getCryptoListForSplit();
        updated[index].asset = value === 'crypto' ? (cList[0] || 'BTC') : baseCurrency;
        updated[index].exchangeRate = 1;
    }
    if (field === 'isCustomPlatform' && !value) {
        updated[index].cryptoPlatform = cryptoPlatformsList[12];
    }
    setFormData({ ...formData, splitSources: updated });
  };

  const addSplitSource = () => {
    setFormData({ ...formData, splitSources: [...formData.splitSources, { ...defaultSplitSource, vault: 'online' }] });
  };
  const removeSplitSource = (index) => {
    if (formData.splitSources.length <= 2) return; 
    const updated = formData.splitSources.filter((_, i) => i !== index);
    setFormData({ ...formData, splitSources: updated });
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-rose-500/10 text-rose-500 rounded-2xl ring-1 ring-rose-500/20">
              <HiOutlineShoppingCart size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Expense Tracker</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            Log expenses across Fiat and Crypto. Endless multi-tender splitting supported.
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

          <button onClick={openModal} className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-5 md:px-7 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shadow-lg shadow-rose-500/25 whitespace-nowrap">
            <HiOutlinePlus size={20} className="hidden sm:inline group-hover:rotate-90 transition-transform duration-300" /> 
            <span className="hidden sm:inline">Log New Expense</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] shadow-xl border border-slate-700/50 md:col-span-2 relative overflow-hidden">
           <div className="absolute right-0 top-0 opacity-5 text-white blur-[2px] -mt-10 -mr-10"><HiOutlineShoppingCart size={250} /></div>
           <div className="relative z-10">
             <p className="text-sm font-black text-rose-400 uppercase tracking-widest mb-2">Total Lifetime Expenses</p>
             <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter"><span className="text-rose-500 mr-2">{currencySymbol}</span>{totalExpenseBase.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
           </div>
        </div>
        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Expense Entries</p>
           <p className="text-4xl font-black text-slate-800 dark:text-white">{expenses.length}</p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-2 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-4 py-4 bg-transparent font-bold text-slate-700 dark:text-white outline-none placeholder:text-slate-400" />
        </div>
        <div className="w-px bg-slate-200 dark:bg-slate-800 hidden md:block my-2"></div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="pl-5 pr-12 py-4 bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer border-t md:border-t-0 border-slate-200 dark:border-slate-800">
          <option value="all">All Categories</option>
          {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* LEDGER */}
      <div className="space-y-8">
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 font-bold animate-pulse">Syncing...</div>
        ) : processedExpenses.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl text-slate-500 font-bold">No Expenses Found.</div>
        ) : (
          processedExpenses.map((month) => (
            <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-rose-50/30 dark:bg-rose-900/10">
                <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{month.monthName}</h2>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Spent Till Open</p>
                  <p className="font-bold text-slate-600 dark:text-slate-300">{currencySymbol}{(month.openingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="p-4 pl-6 w-16">Date</th>
                      <th className="p-4">Payee & Category</th>
                      <th className="p-4">Paid From Vault</th>
                      <th className="p-4 text-right">Native Asset</th>
                      <th className="p-4 text-right">Base Value</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {month.records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        
                        {/* 🚀 GLOBAL DATE RENDERED HERE */}
                        <td className="p-4 pl-6 text-xs font-bold text-slate-500">
                          {formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date}
                        </td>
                        
                        <td className="p-4">
                          <p className="font-black text-slate-800 dark:text-white text-sm mb-0.5">{rec.title}</p>
                          <span className="inline-block px-2 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-500/10 text-[9px] font-black uppercase tracking-wider rounded">{rec.category}</span>
                        </td>
                        <td className="p-4">
                          <div className={`flex flex-col gap-1 w-max ${rec.isSplit ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20' : 'bg-slate-100 dark:bg-slate-800'} px-3 py-1.5 rounded-lg`}>
                             <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                               {rec.isSplit ? <><FaRandom className="text-amber-500"/> Split Payment</> : <>{getVaultIcon(rec.vault)} {rec.vault} Vault</>}
                             </div>
                             {!rec.isSplit && rec.vault === 'crypto' && rec.cryptoPlatform && (
                               <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1"><FaBuilding/> {rec.cryptoPlatform}</div>
                             )}
                             {rec.isSplit && (
                               <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-1 space-y-0.5">
                                 {rec.splitDetails.map((s, idx) => (
                                    <div key={idx}>{s.vault}{s.cryptoPlatform ? `(${s.cryptoPlatform})` : ''}: {s.amount} {s.asset}</div>
                                 ))}
                               </div>
                             )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                           <p className="font-bold text-slate-700 dark:text-slate-300">
                             {rec.isSplit ? 'MULTI-ASSET' : rec.amount.toLocaleString()} <span className="text-[10px] text-slate-400 uppercase">{rec.isSplit ? '' : rec.asset}</span>
                           </p>
                           {!rec.isSplit && rec.asset !== baseCurrency && <p className="text-[9px] text-slate-400 font-bold mt-0.5">@ {rec.exchangeRate} rate</p>}
                        </td>
                        <td className="p-4 text-right"><p className="text-base font-black text-rose-600 dark:text-rose-400">-{currencySymbol}{(rec.finalBaseAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p></td>
                        
                        <td className="p-4 pr-6 text-right">
                          {rec.linkedExpenseId && !rec.linkedExpenseId.startsWith('EXP_') ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-widest rounded border border-slate-200 dark:border-slate-700">Auto-Synced</span>
                              <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 hover:bg-rose-100 rounded-xl transition-all shadow-sm" title="Force Delete Auto-Synced Entry"><HiOutlineTrash size={18} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 rounded-xl transition-all shadow-sm"><HiOutlinePencil size={18} /></button>
                              <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 hover:bg-rose-100 rounded-xl transition-all shadow-sm"><HiOutlineTrash size={18} /></button>
                            </div>
                          )}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 flex justify-between items-center bg-rose-50/30 dark:bg-rose-900/10 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End of Period</span>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Spent</p>
                  <p className="text-xl font-black text-rose-600 dark:text-rose-400 tracking-tight">{currencySymbol}{(month.closingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL FORM --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/60 backdrop-blur-sm overflow-y-auto custom-scrollbar">
          <div className="min-h-screen flex items-start justify-center p-4 pt-[100px] md:pt-[120px] pb-20">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800 flex flex-col">
              
              <div className={`px-6 sm:px-8 py-5 flex justify-between items-center text-white shrink-0 transition-colors duration-300 ${formData.isSplit ? 'bg-amber-500' : 'bg-rose-500'}`}>
                <div className="flex items-center gap-3">
                  {formData.isSplit ? <FaRandom size={20} /> : <FaArrowUp size={20} />}
                  <h3 className="text-xl font-black">{editingId ? 'Edit Expense Entry' : (formData.isSplit ? 'Dynamic Split Expense' : 'Log New Expense')}</h3>
                </div>
                <button type="button" onClick={closeModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><HiOutlineX size={20} /></button>
              </div>
              
              <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 space-y-6 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Payee / Item Name</label>
                    <input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Amazon, Gas Fee" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Expense Category</label>
                    <div className="relative">
                      <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none">
                        {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div>
                    <h4 className="font-black text-slate-800 dark:text-white text-sm">Split Payment Engine</h4>
                    <p className="text-xs font-bold text-slate-500">Pay using multiple sources limitlessly (e.g. Bank + Crypto + Cash)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={formData.isSplit} onChange={(e) => setFormData({...formData, isSplit: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* DYNAMIC FORM ENGINE */}
                {!formData.isSplit ? (
                  // SINGLE MODE
                  <div className="p-5 border border-rose-100 dark:border-rose-500/20 bg-rose-50/30 dark:bg-rose-500/5 rounded-2xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Deduct From</label>
                        <select value={formData.vault} onChange={(e) => setFormData({...formData, vault: e.target.value, asset: e.target.value==='crypto' ? (activeAssetList[0]||'BTC') : baseCurrency, exchangeRate:1})} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer">
                          <option value="bank">Bank Account</option>
                          <option value="cash">Physical Cash</option>
                          <option value="online">Online E-Wallet</option>
                          <option value="crypto" className="font-black text-orange-500">Crypto Engine</option>
                        </select>
                      </div>

                      {formData.vault === 'crypto' ? (
                        <div className="space-y-2 animate-in fade-in">
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform</label>
                          {formData.isCustomSingle ? (
                            <div className="flex gap-2">
                              <input type="text" required placeholder="Custom wallet..." value={formData.cryptoPlatform} onChange={(e)=>setFormData({...formData, cryptoPlatform: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                              <button type="button" onClick={()=>{setFormData({...formData, isCustomSingle: false, cryptoPlatform: cryptoPlatformsList[12]});}} className="px-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500"><HiOutlineX size={20}/></button>
                            </div>
                          ) : (
                            <select value={cryptoPlatformsList.includes(formData.cryptoPlatform) ? formData.cryptoPlatform : 'CUSTOM'} onChange={(e) => { if(e.target.value === 'CUSTOM'){ setFormData({...formData, isCustomSingle: true, cryptoPlatform: ''}); } else { setFormData({...formData, cryptoPlatform: e.target.value}); } }} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer">
                              {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                              <option value="CUSTOM" className="font-black text-orange-500">✨ + Custom</option>
                            </select>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset</label>
                          <select value={formData.asset} onChange={(e) => setFormData({...formData, asset: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer">
                            <option value={baseCurrency}>{baseCurrency} (Base)</option>
                            {fiatCurrencies.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      )}
                      
                      {formData.vault === 'crypto' && (
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Coin</label>
                          <select value={formData.asset} onChange={(e) => setFormData({...formData, asset: e.target.value, exchangeRate: 1})} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer">
                            {activeAssetList.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">{formData.vault === 'crypto' ? 'Quantity' : 'Total Amount'}</label>
                        <input type="number" step="any" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0.00" className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-rose-600 dark:text-rose-400 text-lg outline-none focus:ring-2 focus:ring-rose-500/50" />
                      </div>
                    </div>

                    {formData.asset !== baseCurrency && (
                      <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button type="button" onClick={()=>fetchLiveRate(null)} disabled={isFetchingRate === 'single'} className="text-[10px] font-black bg-rose-600 text-white px-2 py-2 rounded-lg flex items-center gap-1 whitespace-nowrap"><HiOutlineRefresh className={isFetchingRate === 'single' ? 'animate-spin' : ''} /> Get Rate</button>
                        <span className="text-sm font-black text-slate-500">1 {formData.asset} = </span>
                        <input type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} placeholder="Rate" className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold dark:text-white outline-none" />
                      </div>
                    )}
                  </div>
                ) : (
                  // MULTI-SPLIT MODE DYNAMIC ARRAY RENDER
                  <div className="space-y-4">
                    {formData.splitSources.map((split, index) => (
                      <div key={index} className="p-5 border border-amber-200 dark:border-amber-500/30 bg-amber-50/20 dark:bg-amber-900/10 rounded-2xl space-y-4 relative">
                        <div className="flex justify-between items-center mb-2 border-b border-amber-200 dark:border-amber-800/50 pb-2">
                           <span className="text-xs font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest">Payment Source {index + 1}</span>
                           {formData.splitSources.length > 2 && (
                             <button type="button" onClick={() => removeSplitSource(index)} className="text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 p-1.5 rounded-lg transition-colors"><HiOutlineTrash size={16}/></button>
                           )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <select value={split.vault} onChange={(e) => updateSplit(index, 'vault', e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer">
                            <option value="bank">Bank Account</option>
                            <option value="cash">Physical Cash</option>
                            <option value="online">Online Wallet</option>
                            <option value="crypto" className="font-black text-orange-500">Crypto Engine</option>
                          </select>

                          {split.vault === 'crypto' ? (
                             split.isCustomPlatform ? (
                                <div className="flex gap-2">
                                  <input type="text" required placeholder="Platform name..." value={split.cryptoPlatform} onChange={(e)=>updateSplit(index, 'cryptoPlatform', e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none" />
                                  <button type="button" onClick={()=>updateSplit(index, 'isCustomPlatform', false)} className="px-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500"><HiOutlineX/></button>
                                </div>
                             ) : (
                                <select value={cryptoPlatformsList.includes(split.cryptoPlatform) ? split.cryptoPlatform : 'CUSTOM'} onChange={(e) => { if(e.target.value === 'CUSTOM'){ updateSplit(index, 'isCustomPlatform', true); updateSplit(index, 'cryptoPlatform', ''); } else { updateSplit(index, 'cryptoPlatform', e.target.value); } }} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer">
                                  {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                                  <option value="CUSTOM" className="font-black text-orange-500">✨ Custom</option>
                                </select>
                             )
                          ) : (
                             <select value={split.asset} onChange={(e) => { updateSplit(index, 'asset', e.target.value); updateSplit(index, 'exchangeRate', e.target.value === baseCurrency ? 1 : ''); }} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer">
                               <option value={baseCurrency}>{baseCurrency} (Base)</option>
                               {fiatCurrencies.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                          )}
                          
                          {split.vault === 'crypto' && (
                             <select value={split.asset} onChange={(e) => { updateSplit(index, 'asset', e.target.value); updateSplit(index, 'exchangeRate', 1); }} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer">
                               {getCryptoListForSplit().map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                          )}

                          <input type="number" step="any" required placeholder={split.vault === 'crypto' ? 'Quantity' : 'Amount'} value={split.amount} onChange={(e) => updateSplit(index, 'amount', e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50" />
                        </div>

                        {split.asset !== baseCurrency && (
                          <div className="flex items-center gap-3 pt-2">
                            <button type="button" onClick={()=>fetchLiveRate(index)} disabled={isFetchingRate === index} className="text-[9px] font-black bg-amber-500 text-white px-2 py-1.5 rounded-lg flex items-center gap-1"><HiOutlineRefresh className={isFetchingRate === index ? 'animate-spin' : ''} /> Rate</button>
                            <span className="text-xs font-black text-slate-500">1 {split.asset} = </span>
                            <input type="number" step="any" required value={split.exchangeRate} onChange={(e) => updateSplit(index, 'exchangeRate', e.target.value)} placeholder="Rate" className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold dark:text-white outline-none" />
                          </div>
                        )}
                      </div>
                    ))}

                    <button type="button" onClick={addSplitSource} className="w-full py-3 border-2 border-dashed border-amber-300 dark:border-amber-700/50 text-amber-600 dark:text-amber-500 rounded-2xl font-black text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center justify-center gap-2">
                      <HiOutlinePlus size={18}/> Add Another Payment Method
                    </button>
                  </div>
                )}

                <div className="px-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-end">
                   <div className="space-y-2 w-1/3">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                         <span>Date</span>
                      </label>
                      <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none" />
                      {/* 🚀 GLOBAL DATE FOR MODAL INPUT */}
                      <span className="block text-[10px] font-bold text-rose-500 mt-1">{formatGlobalDate ? formatGlobalDate(formData.date, 'full') : ''}</span>
                   </div>
                   <div className="text-right">
                      <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Expense (Base)</span>
                      <span className="text-2xl font-black text-rose-500 tracking-tight">
                        -{currencySymbol}{(formData.isSplit ? getSplitTotalBase() : getBaseAmount(formData.amount, formData.asset !== baseCurrency, formData.exchangeRate)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                   </div>
                </div>

                <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black text-white text-lg transition-all shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${formData.isSplit ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'}`}>
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : null}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Master Record' : (formData.isSplit ? 'Split Deduct & Save' : 'Deduct from Vault & Save'))}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 PIN MODAL WITH FORCE DELETE WARNING */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-md flex items-start justify-center p-4 pt-[100px] md:pt-[120px] pb-20 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-full flex items-center justify-center text-3xl mb-4"><HiOutlineLockClosed /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">You are about to delete <span className="text-slate-800 dark:text-white uppercase">"{deleteContext.title}"</span>.</p>
              
              {/* ⚠️ DYNAMIC WARNING FOR AUTO-SYNCED VS NORMAL */}
              {deleteContext.linkedExpenseId && !deleteContext.linkedExpenseId.startsWith('EXP_') ? (
                <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl">
                  <p className="text-xs font-black text-rose-700 dark:text-rose-400 flex items-start gap-1 text-left">
                    <HiOutlineExclamationCircle size={16} className="shrink-0" /> 
                    CRITICAL WARNING: This is an Auto-Synced entry (from Goals or Capital Shift). Force-deleting it will refund your vault but may cause mismatches in the parent module.
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                    <HiOutlineExclamationCircle size={16} className="shrink-0" /> 
                    WARNING: Deleting this expense will restore funds back to your Vaults to keep balances accurate.
                  </p>
                </div>
              )}
            </div>
            
            <form onSubmit={executeSecureDelete} className="space-y-4">
              <div>
                <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Enter 4-Digit PIN" className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all" />
                {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce mt-2">{pinError}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50">Verify & Delete</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker;