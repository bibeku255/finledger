import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, where, getDocs, getDoc } from 'firebase/firestore';
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

// 🚀 Premium Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${color} text-white shadow-xl group hover:scale-[1.02] transition-all duration-300`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_70%)]" />
    <Icon className="absolute right-[-10%] bottom-[-10%] text-7xl opacity-10 group-hover:scale-110 transition-transform duration-500" />
    <div className="relative z-10">
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{title}</p>
      <h3 className="text-2xl font-black tracking-tight">{value}</h3>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
          {trend >= 0 ? <HiOutlineTrendingUp size={14} /> : <HiOutlineTrendingDown size={14} />}
          {Math.abs(trend)}% from last month
        </div>
      )}
      {subtitle && <p className="text-[9px] font-medium opacity-70 mt-1">{subtitle}</p>}
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]); 
  const [bankWalletLogs, setBankWalletLogs] = useState([]);

  const todayDate = new Date().toISOString().split('T')[0];

  const cryptoSymbols = useMemo(() => {
    return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
  }, [selectedCryptos]);

  // 🚀 Added Split Structure to FormData
  const defaultSplitSource = { 
    vault: 'bank', subWallet: '', asset: baseCurrency, 
    cryptoPlatform: cryptoPlatformsList[12], amount: '', exchangeRate: 1, isCustomPlatform: false 
  };

  const [formData, setFormData] = useState({
    title: '', category: incomeCategories[0], date: todayDate, linkedIncomeId: '',
    isSplit: false, vault: 'bank', subWallet: '', cryptoPlatform: 'Binance', asset: baseCurrency, 
    amount: '', exchangeRate: 1, isCustomSingle: false, isSynced: false,
    splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ] // 🚀 Splitting Mechanism
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

  // 🚀 Upgraded Rate Fetcher to handle splits
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

  const handleDownloadReport = (format) => {
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

  // 🚀 Creates a single vault entry payload
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
      title: '', category: incomeCategories[0], date: todayDate, linkedIncomeId: '', isSplit: false,
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
      title: rec.title, category: rec.category, date: rec.date, linkedIncomeId: rec.linkedIncomeId || '', 
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
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <HiOutlineBriefcase size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Income Streams</h1>
                  <p className="text-sm font-medium text-slate-400">Track salaries, crypto rewards, and freelance income</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10">
                  <HiOutlineDownload size={16} /> Report
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
              
              <button 
                onClick={openModal} 
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
              >
                <HiOutlinePlus size={18} /> Log Income
              </button>
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Income</p>
              <p className="text-lg font-black text-white">{currencySymbol}{totalIncomeBase.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">This Month</p>
              <p className="text-lg font-black text-emerald-400">{currencySymbol}{thisMonthIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Entries</p>
              <p className="text-lg font-black text-white">{incomes.length}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" placeholder="Search by source or asset..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 cursor-pointer transition-all shadow-sm"
            >
              <option value="all">All Categories</option>
              {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Ledger */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-30 animate-pulse" />
                <HiOutlineRefresh className="animate-spin text-4xl text-emerald-500 relative" />
              </div>
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest mt-4 animate-pulse">Loading Income Streams...</p>
            </div>
          ) : processedIncomes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-sm">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <HiOutlineBriefcase className="text-4xl text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">No income records found</p>
              <p className="text-xs text-slate-500 mt-1">Log your first income to get started</p>
            </div>
          ) : (
            processedIncomes.map((month) => (
              <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <HiOutlineCalendar className="text-emerald-500" size={18} />
                    {month.monthName}
                  </h2>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Opening</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{currencySymbol}{month.openingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100/50 dark:bg-slate-800/30 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-4 pl-6">Date</th>
                        <th className="p-4">Source & Category</th>
                        <th className="p-4">Vault</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4 text-right">Base Value</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {month.records.map((rec) => (
                        <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group ${rec.isSplit ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                          <td className="p-4 pl-6">
                            <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                              {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                            </p>
                          </td>
                          <td className="p-4">
                            <p className="font-black text-slate-900 dark:text-white text-sm">{rec.title}</p>
                            <span className="inline-block px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded mt-1 border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
                              {rec.category}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className={`flex items-center gap-2 ${rec.isSplit ? 'bg-amber-100/50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/20 w-max' : ''}`}>
                              {rec.isSplit ? (
                                <><FaRandom className="text-amber-600 dark:text-amber-500" /> <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Split Income</span></>
                              ) : (
                                <>{getVaultIcon(rec.vault)} <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{rec.vault}</span></>
                              )}
                              {!rec.isSplit && rec.subWallet && (
                                <span className="text-[9px] text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold border border-slate-300 dark:border-slate-700">
                                  {rec.subWallet}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            {rec.isSplit ? (
                              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Multiple</p>
                            ) : (
                              <p className="font-black text-slate-800 dark:text-slate-200 text-sm">
                                {rec.amount.toLocaleString()} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold ml-0.5">{rec.asset}</span>
                              </p>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                              +{currencySymbol}{rec.finalBaseAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </p>
                          </td>
                          <td className="p-4 pr-6">
                            <div className="flex items-center justify-end gap-2">
                              {rec.linkedIncomeId && !rec.linkedIncomeId.startsWith('INC_') && (
                                <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[8px] font-black rounded border border-amber-200 dark:border-amber-500/30">SYNCED</span>
                              )}
                              <button onClick={() => handleEdit(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-sm">
                                <HiOutlinePencil size={16} />
                              </button>
                              <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-sm">
                                <HiOutlineTrash size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/80 dark:bg-slate-800/50">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Closing Balance</p>
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                      {currencySymbol}{(month.closingBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
            
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2">
                {formData.isSplit ? <FaRandom /> : <HiOutlineBriefcase />} 
                {editingId ? 'Edit Income' : 'Log Income'}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              {formData.isSynced && (
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-4 rounded-xl text-xs font-bold leading-relaxed border border-amber-200 dark:border-amber-500/30">
                  <p className="flex items-center gap-1 mb-1"><HiOutlineExclamationCircle size={16}/> Auto-Synced Entry</p>
                  This entry is linked to an expense or shift log. You can only update the <span className="underline">Vault/Bank Name</span> here. To change the amount, please edit the source transaction.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Source / Title</label>
                  <input 
                    disabled={formData.isSynced} type="text" required value={formData.title} 
                    onChange={(e) => setFormData({...formData, title: e.target.value})} 
                    placeholder="e.g., Monthly Salary"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <div className="relative">
                    <select 
                      disabled={formData.isSynced} value={formData.category} 
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 appearance-none cursor-pointer transition-colors"
                    >
                      {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>

              {!formData.isSynced && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">Split Income</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Receive into multiple vaults</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={formData.isSplit} onChange={(e) => setFormData({...formData, isSplit: e.target.checked})} />
                      <div className="w-11 h-6 bg-slate-300 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>
              )}

              {!formData.isSplit ? (
                <div className="p-5 bg-emerald-50/50 dark:bg-slate-800/80 rounded-2xl border border-emerald-200 dark:border-slate-700 shadow-sm space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Vault</label>
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
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer transition-colors shadow-sm"
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
                      <div className="animate-in fade-in">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">
                          {formData.vault === 'bank' ? 'Bank Name' : 'Wallet Name'}
                        </label>
                        <input 
                          type="text" list="sub-wallets-inc" required value={formData.subWallet} 
                          onChange={(e) => setFormData({...formData, subWallet: e.target.value})} 
                          placeholder={formData.vault === 'bank' ? "e.g., SBI, Chase" : "e.g., PayPal, Skrill"}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                        />
                        <datalist id="sub-wallets-inc">
                          {existingBanks.map(b => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                    )}

                    {formData.vault === 'crypto' && (
                      <div className="animate-in fade-in">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                        {formData.isCustomSingle ? (
                          <div className="flex gap-2">
                            <input 
                              type="text" required value={formData.cryptoPlatform} 
                              onChange={(e) => setFormData({...formData, cryptoPlatform: e.target.value})} 
                              className="flex-1 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm"
                            />
                            <button type="button" onClick={() => setFormData({...formData, isCustomSingle: false, cryptoPlatform: cryptoPlatformsList[0]})} className="px-4 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors border border-slate-300 dark:border-slate-600 shadow-sm">
                              <HiOutlineX size={20} />
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <select 
                              value={cryptoPlatformsList.includes(formData.cryptoPlatform) ? formData.cryptoPlatform : 'CUSTOM'} 
                              onChange={(e) => {
                                if(e.target.value === 'CUSTOM') {
                                  setFormData({...formData, isCustomSingle: true, cryptoPlatform: ''});
                                } else {
                                  setFormData({...formData, cryptoPlatform: e.target.value});
                                }
                              }}
                              className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer transition-colors shadow-sm"
                            >
                              {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                              <option value="CUSTOM">✨ Custom Platform</option>
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                      <div className="relative">
                        <select 
                          disabled={formData.isSynced} value={formData.asset} 
                          onChange={(e) => setFormData({...formData, asset: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 appearance-none cursor-pointer transition-colors shadow-sm"
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
                    <div>
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Amount ({formData.asset})</label>
                      <input 
                        disabled={formData.isSynced} type="number" step="any" required value={formData.amount} 
                        onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                        placeholder="0.00"
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 text-lg placeholder-slate-400 dark:placeholder-slate-500 transition-colors shadow-sm"
                      />
                    </div>
                  </div>

                  {formData.asset !== baseCurrency && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-400">Rate: 1 {formData.asset} =</span>
                        <input 
                          disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} 
                          onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} 
                          className="flex-1 w-28 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none text-sm transition-colors disabled:opacity-60 shadow-sm"
                        />
                        <span className="text-xs font-black text-slate-600 dark:text-slate-400">{baseCurrency}</span>
                      </div>
                      <button 
                        type="button" onClick={()=>fetchLiveRate(null)} disabled={isFetchingRate === 'single' || formData.isSynced} 
                        className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1 transition-colors shadow-sm"
                      >
                        <HiOutlineRefresh className={isFetchingRate === 'single' ? "animate-spin" : ""} size={14} /> Live
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.splitSources.map((split, index) => (
                    <div key={index} className="p-5 border border-amber-300 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-900/10 rounded-2xl space-y-4 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">Source {index + 1}</span>
                        {formData.splitSources.length > 2 && (
                          <button type="button" onClick={() => removeSplitSource(index)} className="text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 p-1.5 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-colors">
                            <HiOutlineTrash size={16}/>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select value={split.vault} onChange={(e) => updateSplit(index, 'vault', e.target.value)} className="p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer">
                          <option value="bank">Bank Account</option><option value="cash">Physical Cash</option><option value="online">Online Wallet</option><option value="crypto">Crypto Engine</option>
                        </select>
                        {(split.vault === 'bank' || split.vault === 'online') && (
                          <input type="text" list={`split-banks-${index}`} required value={split.subWallet} onChange={(e) => updateSplit(index, 'subWallet', e.target.value)} placeholder={split.vault === 'bank' ? "Bank Name" : "Wallet Name"} className="p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400" />
                        )}
                        {split.vault === 'crypto' && (
                          <select value={split.cryptoPlatform} onChange={(e) => updateSplit(index, 'cryptoPlatform', e.target.value)} className="p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer">
                            {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        )}
                        <select value={split.asset} onChange={(e) => { updateSplit(index, 'asset', e.target.value); updateSplit(index, 'exchangeRate', 1); }} className="p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer">
                          {split.vault === 'crypto' ? cryptoSymbols.map(c => <option key={c} value={c}>{c}</option>) : [baseCurrency, ...availableFiats.filter(c => c !== baseCurrency)].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="number" step="any" required value={split.amount} onChange={(e) => updateSplit(index, 'amount', e.target.value)} placeholder="Amount" className="p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400" />
                      </div>
                      
                      {split.asset !== baseCurrency && (
                        <div className="flex flex-col md:flex-row items-center gap-3 pt-2">
                          <button type="button" onClick={()=>fetchLiveRate(index)} disabled={isFetchingRate === index} className="w-full md:w-auto text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 md:py-2 rounded-lg flex items-center justify-center gap-1 uppercase tracking-widest transition-colors shadow-sm">
                            <HiOutlineRefresh className={isFetchingRate === index ? "animate-spin" : ""} size={14}/> Rate
                          </button>
                          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                            <span className="text-xs font-black text-slate-600 dark:text-slate-400">1 {split.asset} =</span>
                            <input type="number" step="any" required value={split.exchangeRate} onChange={(e) => updateSplit(index, 'exchangeRate', e.target.value)} className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white outline-none shadow-sm" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addSplitSource} className="w-full py-4 border-2 border-dashed border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center justify-center gap-2">
                    <HiOutlinePlus size={18}/> Add Another Source
                  </button>
                </div>
              )}

              <div className="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Date</label>
                    <input 
                      disabled={formData.isSynced} type="date" required value={formData.date} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="block mt-1 p-2 rounded-lg bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white outline-none cursor-pointer disabled:opacity-60 border border-slate-300 dark:border-slate-700 transition-colors shadow-sm"
                    />
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-1.5 ml-1 font-bold">{formatGlobalDate ? formatGlobalDate(formData.date, 'short') : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Total Income</p>
                    <p className="text-2xl md:text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight mt-1">
                      +{currencySymbol}{(formData.isSplit ? getSplitTotalBase() : finalBaseAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2">
                <button 
                  type="submit" disabled={isSaving} 
                  className={`w-full p-4 rounded-2xl font-black text-white text-lg transition-all shadow-xl flex items-center justify-center gap-2 shrink-0 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} ${formData.isSplit ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-500/30' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/30'}`}
                >
                  {isSaving && <HiOutlineRefresh className="animate-spin text-2xl" />}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Income' : 'Confirm Income')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  You are deleting <span className="font-black">"{deleteContext.title}"</span> worth 
                  <span className="font-black"> {currencySymbol}{deleteContext.finalBaseAmount?.toLocaleString()}</span>
                </p>
                {deleteContext.linkedIncomeId && !deleteContext.linkedIncomeId.startsWith('INC_') && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-2 font-bold flex items-center gap-1">
                    <HiOutlineExclamationCircle size={14}/> Auto-synced entry - deletion will affect vault balances
                  </p>
                )}
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Security PIN</label>
                <input 
                  type="password" maxLength={6} required autoFocus
                  value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.3em] text-xl p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors"
                />
                {pinError && <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-2 text-center">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors">
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

export default IncomeStreams;