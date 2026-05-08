import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineBriefcase,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineChevronDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineCalendar, HiOutlineShieldCheck, HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineCash, HiOutlineGlobe
} from 'react-icons/hi';
import { 
  FaMoneyBillWave, FaBitcoin, FaUniversity, FaWallet, 
  FaExchangeAlt, FaBuilding, FaGem, FaChartLine, FaPiggyBank,
  FaArrowUp, FaArrowDown, FaRandom
} from 'react-icons/fa';

import { fiatFlagMap } from '../../utils/marketConstants';

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

const getLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16); 
};

// Premium Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br ${color} text-white shadow-xl group hover:scale-[1.02] transition-all duration-300`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_70%)]" />
    <Icon className="absolute right-[-10%] bottom-[-10%] text-7xl sm:text-8xl opacity-10 group-hover:scale-110 transition-transform duration-500" />
    <div className="relative z-10 flex flex-col h-full">
      <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-80 mb-2">{title}</p>
      <h3 className="text-2xl sm:text-3xl font-black tracking-tight truncate" title={value}>{value}</h3>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-[10px] sm:text-xs font-bold w-fit px-2 py-1 rounded-lg backdrop-blur-sm bg-white/10 ${trend >= 0 ? 'text-emerald-100' : 'text-rose-100'}`}>
          {trend >= 0 ? <HiOutlineTrendingUp size={14} /> : <HiOutlineTrendingDown size={14} />}
          {Math.abs(trend)}% from last month
        </div>
      )}
      {subtitle && <p className="text-[10px] font-medium opacity-70 mt-2">{subtitle}</p>}
    </div>
  </div>
);

const IncomeStreams = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const availableFiats = useMemo(() => {
    return Array.from(new Set([baseCurrency, ...selectedFiats]));
  }, [baseCurrency, selectedFiats]);

  const [incomes, setIncomes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false); // 🚀 Menu State Added
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]); 
  const [bankWalletLogs, setBankWalletLogs] = useState([]);

  const cryptoSymbols = useMemo(() => {
    return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
  }, [selectedCryptos]);

  const defaultSplitSource = { 
    vault: 'bank', subWallet: '', asset: baseCurrency, 
    cryptoPlatform: cryptoPlatformsList[12], amount: '', exchangeRate: 1, isCustomPlatform: false 
  };

  const [formData, setFormData] = useState({
    title: '', category: incomeCategories[0], date: getLocalDateTimeString(), linkedIncomeId: '',
    isSplit: false, vault: 'bank', subWallet: '', cryptoPlatform: 'Binance', asset: baseCurrency, 
    amount: '', exchangeRate: 1, isCustomSingle: false, isSynced: false,
    splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ]
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

      if (availableFiats.includes(assetToCheck) || fiatCurrencies.includes(assetToCheck)) {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${assetToCheck}`);
        const data = await res.json();
        finalRate = data.rates[baseCurrency] || 1;
      } else {
        const upperSym = assetToCheck.toUpperCase();
        const coinObj = fullDatabase.find(c => c.symbol === upperSym) || {};
        const searchId = coinObj.id || assetToCheck.toLowerCase();
        let priceUsd = null;

        if (coinObj.fetchMode === 'contract' && coinObj.network && coinObj.contractAddress) {
           try {
              const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${coinObj.network}/tokens/${coinObj.contractAddress}`);
              if (gtRes.ok) { const gtJson = await gtRes.json(); priceUsd = parseFloat(gtJson.data.attributes.price_usd); }
           } catch(e) {}
        } 

        if (!priceUsd) {
           try {
               const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${searchId}&vs_currencies=usd`);
               const cgData = await cgRes.json();
               if (cgData[searchId]?.usd) priceUsd = parseFloat(cgData[searchId].usd);
           } catch(e) {}
        }

        if (!priceUsd) {
            try {
                if (['USDT', 'USDC', 'DAI'].includes(upperSym)) {
                    priceUsd = 1.00; 
                } else {
                    const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${upperSym}USDT`);
                    if (bRes.ok) {
                        const bData = await bRes.json();
                        priceUsd = parseFloat(bData.price);
                    }
                }
            } catch(e) {}
        }

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
  const getSplitTotalBase = () => formData.splitSources.reduce((acc, curr) => acc + getBaseAmount(curr.amount, curr.asset !== baseCurrency, curr.exchangeRate), 0);

  const isForeign = formData.asset !== baseCurrency;
  const finalBaseAmount = formData.isSplit ? getSplitTotalBase() : getBaseAmount(formData.amount, isForeign, formData.exchangeRate);

  const processedIncomes = useMemo(() => {
    const filtered = incomes.filter(inc => {
      const matchSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || (inc.asset && inc.asset.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = filterCategory === 'all' || inc.category === filterCategory;
      return matchSearch && matchCategory;
    });
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const grouped = {};
    
    sorted.forEach(t => {
      const dateObj = new Date(t.date || new Date());
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
  const thisMonthIncome = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return incomes.filter(i => i.date?.startsWith(thisMonth)).reduce((acc, i) => acc + (Number(i.finalBaseAmount) || 0), 0);
  }, [incomes]);

  // 🚀 FIXED: SMART EXPORT LOGIC
  const handleDownloadReport = (format) => {
    setIsExportMenuOpen(false);

    const filteredForReport = incomes.filter(inc => {
      const matchSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || (inc.asset && inc.asset.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = filterCategory === 'all' || inc.category === filterCategory;
      return matchSearch && matchCategory;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredForReport.length === 0) return alert("No records found to download based on current filters.");

    const reportData = filteredForReport.map(rec => {
      const cleanTitle = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const sourceText = rec.isSplit ? 'Split Income' : `${rec.vault.charAt(0).toUpperCase() + rec.vault.slice(1)} Vault${rec.subWallet ? ` (${rec.subWallet})` : ''}`;
      const nativeAmtText = rec.isSplit ? 'Multiple Assets' : `${(Number(rec.amount) || 0).toLocaleString()} ${rec.asset}`;
      const rawDate = rec.date ? rec.date.split('T')[0] : 'N/A';

      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rawDate,
        source: cleanTitle,
        category: rec.category,
        vault: sourceText,
        nativeAmount: nativeAmtText,
        // Using numeric structure for Auto-totalling
        baseValue: Number(rec.finalBaseAmount || 0)
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Source / Item', key: 'source' },
      { header: 'Category', key: 'category' },
      { header: 'Vault Deposited', key: 'vault' },
      { header: 'Native Amount', key: 'nativeAmount' },
      { header: `Base Value (${currencySymbol})`, key: 'baseValue', isNumeric: true }
    ];

    const fileName = `Income_Streams_Report`;
    const filterTitle = filterCategory !== 'all' ? ` - ${filterCategory}` : ``;
    const searchTitle = searchTerm ? ` (Filtered)` : ``;
    const reportTitle = `Income Streams Ledger${filterTitle}${searchTitle}`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName, reportTitle);
    }
  };

  const createVaultRecord = (sourceData, linkId, amountToAdd) => {
    const isForeignAsset = sourceData.asset !== baseCurrency;
    const baseAmt = getBaseAmount(amountToAdd, isForeignAsset, sourceData.exchangeRate);
    
    if (sourceData.vault === 'crypto') {
      return {
        collection: 'cryptoWalletLogs',
        data: {
          type: 'in', coin: sourceData.asset, quantity: amountToAdd, platform: sourceData.cryptoPlatform,
          reason: `Income: ${formData.category} (${formData.title})`,
          referenceNo: linkId, date: formData.date, timestamp: new Date(formData.date).getTime(), linkedIncomeId: linkId
        }
      };
    }
    
    return {
      collection: sourceData.vault + 'Wallet',
      data: {
        title: `Income: ${formData.category} (${formData.title})`,
        type: 'in', date: formData.date, timestamp: new Date(formData.date).getTime(),
        currency: sourceData.asset, foreignAmount: amountToAdd, exchangeRate: isForeignAsset ? parseFloat(sourceData.exchangeRate) : 1,
        fee: 0, finalBaseAmount: baseAmt, isIncome: true, linkedIncomeId: linkId,
        walletName: sourceData.subWallet || 'Default Wallet', bankName: sourceData.subWallet || 'Default Bank', 
        transferType: 'Income Deposit', walletCategory: sourceData.vault === 'online' ? 'Fiat Wallet' : 'Fiat Wallet'
      }
    };
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login!");

    if (!formData.isSplit) {
      if (formData.vault === 'crypto' && !formData.cryptoPlatform.trim()) return alert("Please specify the crypto platform.");
      if ((formData.vault === 'bank' || formData.vault === 'online') && !formData.subWallet.trim()) return alert("Please specify the Bank or Wallet Name.");
      if (!formData.amount || parseFloat(formData.amount) <= 0) return alert("Amount must be greater than zero.");
    } else {
      for (let i = 0; i < formData.splitSources.length; i++) {
        const s = formData.splitSources[i];
        if (!s.amount || parseFloat(s.amount) <= 0) return alert(`Amount in Source ${i + 1} must be greater than zero.`);
        if (s.vault === 'crypto' && !s.cryptoPlatform.trim()) return alert(`Please specify platform for Source ${i + 1}.`);
        if ((s.vault === 'bank' || s.vault === 'online') && !s.subWallet.trim()) return alert(`Please specify Bank/Wallet for Source ${i + 1}.`);
      }
    }

    setIsSaving(true);
    const timestamp = editingId ? incomes.find(i => i.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const linkId = formData.linkedIncomeId || `INC_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    const incomeRecord = {
      title: formData.title, category: formData.category,
      asset: formData.isSplit ? 'Multiple' : formData.asset,
      amount: formData.isSplit ? finalBaseAmount : parseFloat(formData.amount),
      exchangeRate: formData.isSplit ? 1 : (formData.asset !== baseCurrency ? parseFloat(formData.exchangeRate) : 1),
      finalBaseAmount, date: formData.date, timestamp, linkedIncomeId: linkId,
      isSplit: formData.isSplit,
      vault: formData.isSplit ? 'split' : formData.vault,
      subWallet: !formData.isSplit && (formData.vault === 'bank' || formData.vault === 'online') ? formData.subWallet : '', 
      cryptoPlatform: !formData.isSplit && formData.vault === 'crypto' ? formData.cryptoPlatform : '', 
      splitDetails: formData.isSplit ? formData.splitSources.map(s => ({
        vault: s.vault, subWallet: s.subWallet, asset: s.asset, amount: parseFloat(s.amount),
        cryptoPlatform: s.vault === 'crypto' ? s.cryptoPlatform : '', exchangeRate: parseFloat(s.exchangeRate)
      })) : null
    };

    try {
      if (editingId) {
        if (formData.isSynced) {
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
           const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
           for (const v of vaults) {
             const q = query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", linkId));
             const snap = await getDocs(q);
             snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
           }
           
           await updateDoc(doc(db, "users", user.uid, "incomeLogs", editingId), incomeRecord);
           
           if (formData.isSplit) {
             for (let s of formData.splitSources) {
               const rec = createVaultRecord(s, linkId, parseFloat(s.amount));
               await addDoc(collection(db, "users", user.uid, rec.collection), rec.data);
             }
           } else {
             const singleRec = createVaultRecord({ vault: formData.vault, subWallet: formData.subWallet, asset: formData.asset, exchangeRate: formData.exchangeRate, cryptoPlatform: formData.cryptoPlatform }, linkId, parseFloat(formData.amount));
             await addDoc(collection(db, "users", user.uid, singleRec.collection), singleRec.data);
           }
        }
      } else {
        await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeRecord);
        
        if (formData.isSplit) {
          for (let s of formData.splitSources) {
            const rec = createVaultRecord(s, linkId, parseFloat(s.amount));
            await addDoc(collection(db, "users", user.uid, rec.collection), rec.data);
          }
        } else {
          const singleRec = createVaultRecord({ vault: formData.vault, subWallet: formData.subWallet, asset: formData.asset, exchangeRate: formData.exchangeRate, cryptoPlatform: formData.cryptoPlatform }, linkId, parseFloat(formData.amount));
          await addDoc(collection(db, "users", user.uid, singleRec.collection), singleRec.data);
        }
      }
      closeModal();
    } catch (error) { alert("Error saving."); } finally { setIsSaving(false); }
  };

  const initiateDelete = (rec) => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

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
      title: '', category: incomeCategories[0], date: getLocalDateTimeString(), linkedIncomeId: '', isSplit: false,
      vault: 'bank', subWallet: lastBank, cryptoPlatform: cryptoPlatformsList[12], asset: baseCurrency, 
      amount: '', exchangeRate: 1, isCustomSingle: false, isSynced: false,
      splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ]
    }); 
  };
  
  const closeModal = () => setIsModalOpen(false);
  
  const handleEdit = (rec) => { 
    const isSplit = rec.isSplit || false;
    let mappedSplits = [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ];
    if (isSplit && rec.splitDetails) {
      mappedSplits = rec.splitDetails.map(s => ({
        vault: s.vault, subWallet: s.subWallet || s.bankName || s.walletName || '',
        asset: s.asset || baseCurrency, amount: s.amount || '', cryptoPlatform: s.cryptoPlatform || cryptoPlatformsList[12], 
        exchangeRate: s.exchangeRate || 1, isCustomPlatform: s.vault === 'crypto' && !cryptoPlatformsList.includes(s.cryptoPlatform)
      }));
    }

    const isSyncedEntry = !!(rec.linkedIncomeId && !rec.linkedIncomeId.startsWith('INC_'));

    setFormData({ 
      title: rec.title, category: rec.category, date: rec.date || getLocalDateTimeString(), linkedIncomeId: rec.linkedIncomeId || '', 
      isSplit: isSplit, vault: isSplit ? 'bank' : (rec.vault || 'bank'), subWallet: isSplit ? '' : (rec.subWallet || rec.bankName || rec.walletName || ''),
      asset: isSplit ? baseCurrency : (rec.asset || baseCurrency), amount: isSplit ? '' : (rec.amount || ''), 
      exchangeRate: isSplit ? 1 : (rec.exchangeRate || 1), cryptoPlatform: isSplit ? cryptoPlatformsList[12] : (rec.cryptoPlatform || cryptoPlatformsList[12]),
      isCustomSingle: !isSplit && rec.vault === 'crypto' && !cryptoPlatformsList.includes(rec.cryptoPlatform),
      isSynced: isSyncedEntry, splitSources: mappedSplits
    }); 
    setEditingId(rec.id); 
    setIsModalOpen(true); 
  };

  const getVaultIcon = (v) => {
    if (v === 'bank') return <FaUniversity className="text-blue-500" />;
    if (v === 'cash') return <HiOutlineCash className="text-emerald-500" />;
    if (v === 'crypto') return <FaBitcoin className="text-orange-500" />;
    if (v === 'online') return <FaWallet className="text-purple-500" />;
    return <FaRandom className="text-amber-500" />;
  };

  const updateSplit = (index, field, value) => {
    const updated = [...formData.splitSources]; updated[index][field] = value;
    if (field === 'vault') {
        const cList = cryptoSymbols.length > 0 ? cryptoSymbols : ['BTC'];
        updated[index].asset = value === 'crypto' ? (cList[0] || 'BTC') : baseCurrency; updated[index].exchangeRate = 1;
        if(value === 'cash' || value === 'crypto') updated[index].subWallet = ''; 
    }
    if (field === 'isCustomPlatform' && !value) { updated[index].cryptoPlatform = cryptoPlatformsList[12]; }
    setFormData({ ...formData, splitSources: updated });
  };

  const addSplitSource = () => setFormData({ ...formData, splitSources: [...formData.splitSources, { ...defaultSplitSource, vault: 'online' }] });
  const removeSplitSource = (index) => { if (formData.splitSources.length > 2) setFormData({ ...formData, splitSources: formData.splitSources.filter((_, i) => i !== index) }); };

  return (
    <div className="w-full h-auto pb-24">
      <div className="pt-20 sm:pt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 lg:p-10 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <HiOutlineBriefcase size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">Income Streams</h1>
                <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">Track salaries, crypto rewards, and freelance income</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* 🚀 EXPORT MENU */}
              <div className="relative">
                <button 
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
                  className="flex items-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 active:scale-95 shadow-sm"
                >
                  <HiOutlineDownload size={18} /> Export
                </button>
                {isExportMenuOpen && (
                  <div className="absolute top-[110%] right-0 w-48 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl flex flex-col p-1.5 z-50 animate-in fade-in zoom-in-95">
                    <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700 text-slate-200 text-[11px] font-black rounded-xl transition-colors">
                      <HiOutlineDocumentText className="text-rose-400" size={18}/> PDF Document
                    </button>
                    <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700 text-slate-200 text-[11px] font-black rounded-xl transition-colors">
                      <HiOutlineTable className="text-emerald-400" size={18}/> Excel (CSV)
                    </button>
                  </div>
                )}
              </div>
              
              <button 
                onClick={openModal} 
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
              >
                <HiOutlinePlus size={18} /> Log Income
              </button>
            </div>
          </div>
          
          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-8 pt-6 border-t border-white/10">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5 col-span-2 lg:col-span-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineBriefcase size={14}/> Total Income Base</p>
              <p className="text-xl sm:text-2xl font-black text-white truncate" title={`${currencySymbol}${totalIncomeBase.toLocaleString()}`}>
                {currencySymbol}{totalIncomeBase.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineCalendar size={12}/> This Month</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 truncate">{currencySymbol}{thisMonthIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><FaChartLine size={12}/> Total Entries</p>
              <p className="text-xl sm:text-2xl font-black text-white truncate">{incomes.length}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" placeholder="Search by source or asset..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full sm:w-auto px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 cursor-pointer transition-all shadow-sm"
            >
              <option value="all">All Categories</option>
              {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Ledger */}
        <div className="space-y-6 sm:space-y-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl opacity-20 animate-pulse scale-150" />
                <HiOutlineRefresh className="animate-spin text-5xl text-emerald-500 relative" />
              </div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-6 animate-pulse">Loading Income Streams...</p>
            </div>
          ) : processedIncomes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm px-4">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-5 shadow-inner">
                <HiOutlineBriefcase className="text-5xl text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-lg font-black text-slate-700 dark:text-slate-300">No income records found</p>
              <p className="text-sm font-medium text-slate-500 mt-2 text-center max-w-sm">
                {searchTerm || filterCategory !== 'all' ? 'Try adjusting your search or filters.' : 'Log your first income to get started tracking your earnings.'}
              </p>
              {!searchTerm && filterCategory === 'all' && (
                <button onClick={openModal} className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95">
                  Log Income Now
                </button>
              )}
            </div>
          ) : (
            processedIncomes.map((month) => (
              <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <HiOutlineCalendar size={18} />
                    </div>
                    {month.monthName}
                  </h2>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Opening</p>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">{currencySymbol}{month.openingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[900px]">
                    <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-4 pl-6">Date</th>
                        <th className="p-4">Source & Category</th>
                        <th className="p-4">Vault</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4 text-right">Base Value</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {month.records.map((rec) => {
                        const dateObj = new Date(rec.date);
                        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group ${rec.isSplit ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                            <td className="p-4 pl-6 align-top">
                              <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 mt-1">
                                {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}
                                <span className="opacity-50 mx-1 border-l border-slate-300 dark:border-slate-600 pl-2 text-[10px]">{timeStr}</span>
                              </p>
                            </td>
                            <td className="p-4 align-top">
                              <p className="font-black text-slate-900 dark:text-white text-sm mt-0.5 max-w-[200px] truncate" title={rec.title}>{rec.title}</p>
                              <span className="inline-block px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider rounded mt-1.5 border border-emerald-200 dark:border-emerald-500/20 shadow-sm truncate max-w-[180px]">
                                {rec.category}
                              </span>
                            </td>
                            <td className="p-4 align-top">
                              <div className={`flex items-center gap-2 mt-1 ${rec.isSplit ? 'bg-amber-100/50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/20 w-max' : ''}`}>
                                {rec.isSplit ? (
                                  <><FaRandom className="text-amber-600 dark:text-amber-500" /> <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Split Income</span></>
                                ) : (
                                  <>{getVaultIcon(rec.vault)} <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{rec.vault}</span></>
                                )}
                                {!rec.isSplit && rec.subWallet && (
                                  <span className="text-[9px] text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold border border-slate-300 dark:border-slate-700 shadow-sm">
                                    {rec.subWallet}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-right align-top">
                              {rec.isSplit ? (
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-1">Multiple</p>
                              ) : (
                                <p className="font-black text-slate-800 dark:text-slate-200 text-sm mt-1">
                                  {rec.amount.toLocaleString()} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold ml-0.5">{rec.asset}</span>
                                </p>
                              )}
                            </td>
                            <td className="p-4 text-right align-top">
                              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                                +{currencySymbol}{rec.finalBaseAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </p>
                            </td>
                            <td className="p-4 pr-6 align-top">
                              <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                {rec.linkedIncomeId && !rec.linkedIncomeId.startsWith('INC_') && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[8px] font-black rounded border border-amber-200 dark:border-amber-500/30">SYNCED</span>
                                )}
                                <button onClick={() => handleEdit(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-all border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95">
                                  <HiOutlinePencil size={14} />
                                </button>
                                <button onClick={() => initiateDelete(rec)} className="p-2 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-all border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95">
                                  <HiOutlineTrash size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-5 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="text-right bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Closing Balance</p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                      {currencySymbol}{(month.closingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 🚀 ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
            
            <div className="px-6 sm:px-8 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2">
                {formData.isSplit ? <FaRandom size={18} /> : <HiOutlineBriefcase size={20} />} 
                {editingId ? 'Edit Income' : 'Log Income'}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors active:scale-90">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar pb-2">
              {formData.isSynced && (
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-4 rounded-xl text-xs font-bold leading-relaxed border border-amber-300 dark:border-amber-500/30 shadow-sm">
                  <p className="flex items-center gap-1.5 mb-1.5 font-black"><HiOutlineExclamationCircle size={16}/> Auto-Synced Entry</p>
                  This entry is linked to a system transaction. To maintain accuracy, you can only update the <span className="underline decoration-amber-400">Vault/Bank Name</span>. To change the amount, edit the source transaction.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Source / Title *</label>
                  <input 
                    disabled={formData.isSynced} type="text" required value={formData.title} 
                    onChange={(e) => setFormData({...formData, title: e.target.value})} 
                    placeholder="e.g., Monthly Salary"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 transition-colors shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <div className="relative">
                    <select 
                      disabled={formData.isSynced} value={formData.category} 
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 appearance-none cursor-pointer transition-colors shadow-sm"
                    >
                      {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>

              {!formData.isSynced && (
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2"><FaRandom className="text-amber-500" /> Split Income</h4>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">Receive payment into multiple vaults simultaneously</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                    <input type="checkbox" className="sr-only peer" checked={formData.isSplit} onChange={(e) => setFormData({...formData, isSplit: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                  </label>
                </div>
              )}

              {/* SINGLE INCOME VIEW */}
              {!formData.isSplit ? (
                <div className="p-5 sm:p-6 bg-emerald-50/40 dark:bg-slate-800/80 rounded-[2rem] border border-emerald-200 dark:border-slate-700 shadow-sm space-y-5 animate-in fade-in zoom-in-95">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Destination Vault</label>
                      <div className="relative">
                        <select 
                          value={formData.vault} 
                          onChange={(e) => {
                            const v = e.target.value;
                            const cList = cryptoSymbols.length > 0 ? cryptoSymbols : ['BTC'];
                            setFormData({
                              ...formData, vault: v, 
                              asset: v === 'crypto' ? cList[0] : baseCurrency, 
                              subWallet: '', exchangeRate: 1
                            });
                          }}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer transition-colors shadow-sm"
                        >
                          <option value="bank">Bank Account</option>
                          <option value="online">Online E-Wallet</option>
                          <option value="cash">Physical Cash</option>
                          <option value="crypto">Crypto Engine</option>
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                      </div>
                    </div>

                    {(formData.vault === 'bank' || formData.vault === 'online') && (
                      <div className="space-y-1.5 animate-in fade-in">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                          {formData.vault === 'bank' ? 'Bank Name *' : 'Wallet Name *'}
                        </label>
                        <input 
                          type="text" list="sub-wallets-inc" required value={formData.subWallet} 
                          onChange={(e) => setFormData({...formData, subWallet: e.target.value})} 
                          placeholder={formData.vault === 'bank' ? "e.g., SBI, Chase" : "e.g., PayPal, Skrill"}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm"
                        />
                        <datalist id="sub-wallets-inc">{existingBanks.map(b => <option key={b} value={b} />)}</datalist>
                      </div>
                    )}

                    {formData.vault === 'crypto' && (
                      <div className="space-y-1.5 animate-in fade-in">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Crypto Platform *</label>
                        {formData.isCustomSingle ? (
                          <div className="flex gap-2">
                            <input 
                              type="text" required value={formData.cryptoPlatform} 
                              onChange={(e) => setFormData({...formData, cryptoPlatform: e.target.value})} 
                              placeholder="Platform Name"
                              className="flex-1 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm"
                            />
                            <button type="button" onClick={() => setFormData({...formData, isCustomSingle: false, cryptoPlatform: cryptoPlatformsList[0]})} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95">
                              <HiOutlineX size={20} />
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <select 
                              value={cryptoPlatformsList.includes(formData.cryptoPlatform) ? formData.cryptoPlatform : 'CUSTOM'} 
                              onChange={(e) => {
                                if(e.target.value === 'CUSTOM') { setFormData({...formData, isCustomSingle: true, cryptoPlatform: ''}); } 
                                else { setFormData({...formData, cryptoPlatform: e.target.value}); }
                              }}
                              className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer transition-colors shadow-sm"
                            >
                              {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                              <option value="CUSTOM">✨ Enter Custom Platform</option>
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                      <div className="relative">
                        <select 
                          disabled={formData.isSynced} value={formData.asset} 
                          onChange={(e) => setFormData({...formData, asset: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 appearance-none cursor-pointer transition-colors shadow-sm"
                        >
                          {formData.vault === 'crypto' ? (
                            cryptoSymbols.map(a => <option key={a} value={a}>{a}</option>)
                          ) : (
                            <>
                              <option value={baseCurrency}>{baseCurrency} (Base)</option>
                              {availableFiats.filter(c => c !== baseCurrency).map(a => <option key={a} value={a}>{a}</option>)}
                            </>
                          )}
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Amount ({formData.asset}) *</label>
                      <input 
                        disabled={formData.isSynced} type="number" step="any" required value={formData.amount} 
                        onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                        placeholder="0.00"
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 transition-colors shadow-sm"
                      />
                    </div>
                  </div>

                  {formData.asset !== baseCurrency && (
                    <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 shrink-0">
                        <FaExchangeAlt className="text-emerald-500" /> Exchange Rate:
                      </span>
                      <div className="flex items-center gap-2 flex-1 w-full">
                        <span className="text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">1 {formData.asset} =</span>
                        <input 
                          disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} 
                          onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} 
                          className="flex-1 w-full min-w-0 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none disabled:opacity-60 shadow-sm focus:ring-2 focus:ring-emerald-500/50 transition-colors text-center"
                        />
                        <span className="text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">{baseCurrency}</span>
                      </div>
                      <button 
                        type="button" onClick={()=>fetchLiveRate(null)} disabled={isFetchingRate === 'single' || formData.isSynced} 
                        className="w-full sm:w-auto bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-4 py-3 sm:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors shadow-sm shrink-0 active:scale-95"
                      >
                        <HiOutlineRefresh className={isFetchingRate === 'single' ? "animate-spin" : ""} size={14} /> Live Rate
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* SPLIT INCOME VIEW */
                <div className="space-y-4 animate-in fade-in zoom-in-95">
                  {formData.splitSources.map((split, index) => (
                    <div key={index} className="p-5 sm:p-6 border border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10 rounded-[2rem] space-y-5 shadow-sm relative overflow-hidden group">
                      <div className="flex justify-between items-center relative z-10">
                        <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-center shadow-sm">{index + 1}</span> Split Source
                        </span>
                        {formData.splitSources.length > 2 && (
                          <button type="button" onClick={() => removeSplitSource(index)} className="text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 p-2 rounded-xl border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-colors active:scale-90 shadow-sm">
                            <HiOutlineTrash size={16}/>
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Vault</label>
                          <div className="relative">
                            <select value={split.vault} onChange={(e) => updateSplit(index, 'vault', e.target.value)} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer focus:ring-2 focus:ring-amber-500/50 appearance-none">
                              <option value="bank">Bank Account</option><option value="cash">Physical Cash</option><option value="online">Online Wallet</option><option value="crypto">Crypto Engine</option>
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                          </div>
                        </div>

                        {(split.vault === 'bank' || split.vault === 'online') && (
                          <div className="space-y-1.5 animate-in fade-in">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{split.vault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
                            <input type="text" list={`split-banks-${index}`} required value={split.subWallet} onChange={(e) => updateSplit(index, 'subWallet', e.target.value)} placeholder="e.g. SBI, PayPal" className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400 focus:ring-2 focus:ring-amber-500/50" />
                          </div>
                        )}

                        {split.vault === 'crypto' && (
                          <div className="space-y-1.5 animate-in fade-in">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                            <div className="relative">
                              <select value={split.cryptoPlatform} onChange={(e) => updateSplit(index, 'cryptoPlatform', e.target.value)} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer focus:ring-2 focus:ring-amber-500/50 appearance-none">
                                {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                              <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                          <div className="relative">
                            <select value={split.asset} onChange={(e) => { updateSplit(index, 'asset', e.target.value); updateSplit(index, 'exchangeRate', 1); }} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer focus:ring-2 focus:ring-amber-500/50 appearance-none">
                              {split.vault === 'crypto' ? cryptoSymbols.map(c => <option key={c} value={c}>{c}</option>) : [baseCurrency, ...availableFiats.filter(c => c !== baseCurrency)].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                          <input type="number" step="any" required value={split.amount} onChange={(e) => updateSplit(index, 'amount', e.target.value)} placeholder="0.00" className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-amber-700 dark:text-amber-500 outline-none shadow-sm placeholder-slate-400 focus:ring-2 focus:ring-amber-500/50" />
                        </div>
                      </div>
                      
                      {split.asset !== baseCurrency && (
                        <div className="p-4 sm:p-5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm relative z-10 animate-in fade-in">
                          <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 shrink-0">
                            <FaExchangeAlt className="text-amber-500" /> Exchange Rate:
                          </span>
                          <div className="flex items-center gap-2 flex-1 w-full">
                            <span className="text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">1 {split.asset} =</span>
                            <input type="number" step="any" required value={split.exchangeRate} onChange={(e) => updateSplit(index, 'exchangeRate', e.target.value)} className="flex-1 w-full min-w-0 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white outline-none shadow-sm focus:ring-2 focus:ring-amber-500/50 transition-colors text-center" />
                            <span className="text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">{baseCurrency}</span>
                          </div>
                          <button type="button" onClick={()=>fetchLiveRate(index)} disabled={isFetchingRate === index} className="w-full sm:w-auto bg-slate-100 dark:bg-slate-700 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 px-4 py-3 sm:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors shadow-sm shrink-0 active:scale-95">
                            <HiOutlineRefresh className={isFetchingRate === index ? "animate-spin" : ""} size={14}/> Live
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addSplitSource} className="w-full py-4 border-2 border-dashed border-amber-300 dark:border-amber-700/50 text-amber-600 dark:text-amber-500 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm">
                    <HiOutlinePlus size={18}/> Add Another Split
                  </button>
                </div>
              )}

              <div className="p-4 sm:p-5 bg-slate-100 dark:bg-slate-800/80 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-inner">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Date & Time *</label>
                    <input 
                      disabled={formData.isSynced} type="datetime-local" required value={formData.date} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="block w-full mt-1.5 p-3.5 bg-white dark:bg-slate-900 font-bold text-sm text-slate-900 dark:text-white outline-none cursor-pointer disabled:opacity-60 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 rounded-xl"
                    />
                  </div>
                  <div className="text-right sm:pl-4 pt-2 sm:pt-0 sm:border-l border-slate-200 dark:border-slate-700 flex-1 min-w-[150px]">
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Income</p>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-1 truncate">
                      +{currencySymbol}{(formData.isSplit ? getSplitTotalBase() : finalBaseAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
                <button 
                  type="submit" disabled={isSaving} 
                  className={`w-full p-4 sm:p-5 rounded-[2rem] font-black text-sm sm:text-base uppercase tracking-widest text-white transition-all shadow-xl flex items-center justify-center gap-2 shrink-0 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} ${formData.isSplit ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/30' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/30'}`}
                >
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : <HiOutlineBriefcase size={20} />}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Ledger' : 'Save Income')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border border-rose-200 dark:border-rose-800 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
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
                  You are deleting <span className="font-black">"{deleteContext.title}"</span> worth 
                  <span className="font-black"> {currencySymbol}{deleteContext.finalBaseAmount?.toLocaleString()}</span>
                </p>
                {deleteContext.linkedIncomeId && !deleteContext.linkedIncomeId.startsWith('INC_') && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-2 font-bold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-200 dark:border-rose-800/50">
                    <HiOutlineExclamationCircle size={14} className="shrink-0"/> Auto-synced entry - deletion will automatically reverse vault balances.
                  </p>
                )}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 text-center block">Security PIN</label>
                <input 
                  type="password" maxLength={6} required autoFocus
                  value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.4em] text-2xl p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm"
                  placeholder="••••"
                />
                {pinError && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-2 text-center animate-bounce">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors shadow-sm active:scale-95 uppercase tracking-widest">
                  Cancel
                </button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-sm bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 active:scale-95 uppercase tracking-widest">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : <HiOutlineTrash size={18} />}
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

export default IncomeStreams;