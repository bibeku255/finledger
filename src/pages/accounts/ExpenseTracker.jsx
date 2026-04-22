import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

// 🚀 FIXED: Removed unused/crashing icons from 'react-icons/hi'
import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineShoppingCart,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineChevronDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineCalendar, HiOutlineShieldCheck, HiOutlineTrendingUp,
  HiOutlineTrendingDown, HiOutlineCash
} from 'react-icons/hi';

import { 
  FaMoneyBillWave, FaArrowUp, FaUniversity, FaWallet, 
  FaExchangeAlt, FaRandom, FaBitcoin, FaUserFriends,
  FaGem, FaChartLine, FaPiggyBank, FaArrowDown
} from 'react-icons/fa';

const fiatCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];

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

const ExpenseTracker = () => {
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
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]); 
  const [bankWalletLogs, setBankWalletLogs] = useState([]);
  const [existingParties, setExistingParties] = useState([]); 

  const todayDate = new Date().toISOString().split('T')[0];

  const defaultSplitSource = { 
    vault: 'bank', subWallet: '', asset: baseCurrency, 
    cryptoPlatform: cryptoPlatformsList[12], amount: '', exchangeRate: 1, isCustomPlatform: false 
  };

  const defaultKhataSplit = { partyName: '', amount: '' };

  const [formData, setFormData] = useState({
    title: '', category: expenseCategories[0], date: todayDate, linkedExpenseId: '', 
    isSplit: false, vault: 'bank', subWallet: '', asset: baseCurrency, cryptoPlatform: cryptoPlatformsList[12], 
    amount: '', exchangeRate: 1, isCustomSingle: false,
    splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ],
    isKhataSplit: false, 
    khataSplits: [ { ...defaultKhataSplit } ], 
    isSynced: false 
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
    selectedCryptos.forEach(c => { if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c); });
    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  useEffect(() => {
     if(!user) return;
     const fetchBanksAndParties = async () => {
        const qBank = query(collection(db, "users", user.uid, "bankWallet"));
        const snapBank = await getDocs(qBank);
        setBankWalletLogs(snapBank.docs.map(d => d.data().bankName).filter(Boolean));
        
        const qParty = query(collection(db, "users", user.uid, "parties"));
        const snapParty = await getDocs(qParty);
        const partyNames = new Set();
        snapParty.docs.forEach(d => { if(d.data().name) partyNames.add(d.data().name) });
        setExistingParties(Array.from(partyNames));
     };
     fetchBanksAndParties();
  }, [user]);
  
  const existingBanks = useMemo(() => Array.from(new Set(bankWalletLogs)), [bankWalletLogs]);

  const activeAssetList = useMemo(() => {
    if (formData.vault === 'crypto') return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    return fiatCurrencies;
  }, [formData.vault, selectedCryptos]);

  const getCryptoListForSplit = () => selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);

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
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) { grouped[monthKey] = { monthName, openingBalance: runningBalance, records: [], closingBalance: 0 }; }
      runningBalance += Number(t.finalBaseAmount || 0); 
      grouped[monthKey].records.push({ ...t, finalAmount: Number(t.finalBaseAmount || 0) });
      grouped[monthKey].closingBalance = runningBalance;
    });

    return Object.keys(grouped).sort().reverse().map(key => ({ ...grouped[key], records: grouped[key].records.reverse() }));
  }, [expenses, searchTerm, filterCategory, formatGlobalDate]);

  const totalExpenseBase = expenses.reduce((acc, curr) => acc + (Number(curr.finalBaseAmount) || 0), 0);
  const thisMonthExpense = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return expenses.filter(i => i.date?.startsWith(thisMonth)).reduce((acc, i) => acc + (Number(i.finalBaseAmount) || 0), 0);
  }, [expenses]);

  const handleDownloadReport = (format) => {
    const filteredForReport = expenses.filter(exp => {
      const matchSearch = exp.title.toLowerCase().includes(searchTerm.toLowerCase()) || (exp.asset && exp.asset.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = filterCategory === 'all' || exp.category === filterCategory;
      return matchSearch && matchCategory;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredForReport.length === 0) return alert("No records found to download.");

    const reportData = filteredForReport.map(rec => {
      const cleanTitle = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const sourceText = rec.isSplit ? 'Split Payment' : `${rec.vault} Vault${rec.subWallet ? ` (${rec.subWallet})` : ''}`;
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        payee: cleanTitle,
        category: rec.category,
        source: sourceText,
        baseValue: `${currencySymbol}${Math.abs(rec.finalBaseAmount || 0).toFixed(2)}`
      };
    });

    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Payee', key: 'payee' }, 
      { header: 'Category', key: 'category' }, { header: 'Source', key: 'source' }, 
      { header: 'Amount', key: 'baseValue' }
    ];

    const fileName = `Expense_Tracker_Report`;
    const reportTitle = `Expense Tracker - ${filterCategory !== 'all' ? filterCategory : 'Complete Ledger'}`;

    if (format === 'pdf') downloadPDFReport(reportData, columns, fileName, reportTitle);
    else downloadExcelReport(reportData, columns, fileName);
  };

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
        const coinObj = fullDatabase.find(c => c.symbol === assetToCheck.toUpperCase()) || {};
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
                const binanceSymbol = searchId === 'tether' ? 'BTCUSDT' : `${assetToCheck.toUpperCase()}USDT`;
                const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
                if (bRes.ok) { const bData = await bRes.json(); priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price); }
            } catch(e) {}
        }
        const finalPrice = priceUsd || (coinObj?.fallbackPrice || 0);
        finalRate = finalPrice * usdToBase;
      }

      if (isSingle) setFormData(prev => ({ ...prev, exchangeRate: finalRate.toFixed(6) }));
      else {
        const updatedSplits = [...formData.splitSources];
        updatedSplits[index].exchangeRate = finalRate.toFixed(6);
        setFormData(prev => ({ ...prev, splitSources: updatedSplits }));
      }
    } catch (error) { alert("Rate fetch failed."); } finally { setIsFetchingRate(false); }
  };

  const getBaseAmount = (amount, isForeign, rate) => (parseFloat(amount) || 0) * (isForeign ? (parseFloat(rate) || 1) : 1);

  const getSplitTotalBase = () => formData.splitSources.reduce((acc, curr) => acc + getBaseAmount(curr.amount, curr.asset !== baseCurrency, curr.exchangeRate), 0);
  
  const getKhataTotal = () => formData.khataSplits.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const createVaultRecord = (sourceData, linkId, amountToDeduct) => {
    const isForeignAsset = sourceData.asset !== baseCurrency;
    const baseAmt = getBaseAmount(amountToDeduct, isForeignAsset, sourceData.exchangeRate);
    
    if (sourceData.vault === 'crypto') {
      return {
        collection: 'cryptoWalletLogs',
        data: {
          type: 'out', coin: sourceData.asset, quantity: amountToDeduct, platform: sourceData.cryptoPlatform,
          reason: `Expense: ${formData.category} (${formData.title}) ${formData.isKhataSplit ? '[Shared]' : ''}`,
          referenceNo: linkId, date: formData.date, timestamp: new Date(formData.date).getTime(), linkedExpenseId: linkId
        }
      };
    }
    
    return {
      collection: sourceData.vault + 'Wallet',
      data: {
        title: `Expense: ${formData.category} (${formData.title}) ${formData.isKhataSplit ? '[Shared]' : ''}`,
        type: 'out', date: formData.date, timestamp: new Date(formData.date).getTime(),
        currency: sourceData.asset, foreignAmount: amountToDeduct, exchangeRate: isForeignAsset ? parseFloat(sourceData.exchangeRate) : 1,
        fee: 0, finalBaseAmount: baseAmt, isExpense: true, linkedExpenseId: linkId,
        walletName: sourceData.subWallet || 'Default Wallet', bankName: sourceData.subWallet || 'Default Bank', 
        transferType: 'Payment/Expense', walletCategory: sourceData.vault === 'online' ? 'Fiat Wallet' : 'Fiat Wallet'
      }
    };
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");

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

    let totalKhataOwed = 0;
    if (formData.isKhataSplit) {
      totalKhataOwed = getKhataTotal();
      const totalPaidAmount = formData.isSplit ? formData.splitSources.reduce((acc, curr)=>acc+(parseFloat(curr.amount)||0),0) : parseFloat(formData.amount);
      
      if (totalKhataOwed >= totalPaidAmount) {
         return alert("Total amount owed by friends cannot be greater than or equal to the total bill paid!");
      }
      for (let i = 0; i < formData.khataSplits.length; i++) {
         if(!formData.khataSplits[i].partyName.trim() || !formData.khataSplits[i].amount) {
            return alert("Please enter valid names and amounts for all split friends.");
         }
      }
    }

    setIsSaving(true);
    const timestamp = editingId ? expenses.find(i => i.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const linkId = formData.linkedExpenseId || `EXP_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    const totalVaultDeductionBase = formData.isSplit ? getSplitTotalBase() : getBaseAmount(formData.amount, formData.asset !== baseCurrency, formData.exchangeRate);
    const totalKhataOwedBase = formData.isKhataSplit ? getBaseAmount(totalKhataOwed, formData.asset !== baseCurrency, formData.exchangeRate) : 0;
    const personalNetExpenseBase = totalVaultDeductionBase - totalKhataOwedBase;

    const expenseRecord = {
      title: formData.title, category: formData.category,
      asset: formData.isSplit ? 'Multiple' : formData.asset,
      amount: formData.isSplit ? totalVaultDeductionBase : parseFloat(formData.amount), 
      exchangeRate: formData.isSplit ? 1 : (formData.asset !== baseCurrency ? parseFloat(formData.exchangeRate) : 1),
      finalBaseAmount: personalNetExpenseBase, totalPaidFromVault: totalVaultDeductionBase, friendsShare: totalKhataOwedBase, 
      date: formData.date, timestamp, linkedExpenseId: linkId, isSplit: formData.isSplit,
      vault: formData.isSplit ? 'split' : formData.vault,
      subWallet: !formData.isSplit && (formData.vault === 'bank' || formData.vault === 'online') ? formData.subWallet : '', 
      cryptoPlatform: !formData.isSplit && formData.vault === 'crypto' ? formData.cryptoPlatform : '', 
      splitDetails: formData.isSplit ? formData.splitSources.map(s => ({
        vault: s.vault, subWallet: s.subWallet, asset: s.asset, amount: parseFloat(s.amount),
        cryptoPlatform: s.vault === 'crypto' ? s.cryptoPlatform : '', exchangeRate: parseFloat(s.exchangeRate)
      })) : null,
      khataDetails: formData.isKhataSplit ? formData.khataSplits : null
    };

    try {
      if (editingId) {
        if (formData.isSynced) {
            await updateDoc(doc(db, "users", user.uid, "expenseLogs", editingId), { subWallet: formData.subWallet, vault: formData.vault });
            const vaults = ['bankWallet', 'onlineWallet'];
            for (const v of vaults) {
               if(linkId) {
                 const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", linkId));
                 const snap = await getDocs(q);
                 snap.forEach(async (d) => await updateDoc(doc(db, "users", user.uid, v, d.id), { walletName: formData.subWallet, bankName: formData.subWallet }));
               }
            }
        } else {
            const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
            for (const v of vaults) {
               if(linkId) {
                 const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", linkId));
                 const snap = await getDocs(q);
                 snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
               }
            }
            
            const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
            for (const pDoc of partiesSnap.docs) {
               const lQuery = query(collection(db, "users", user.uid, "parties", pDoc.id, "ledger"), where("linkId", "==", linkId));
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

            await updateDoc(doc(db, "users", user.uid, "expenseLogs", editingId), expenseRecord);
            
            if (formData.isSplit) {
              for (let s of formData.splitSources) {
                const rec = createVaultRecord(s, linkId, parseFloat(s.amount));
                await addDoc(collection(db, "users", user.uid, rec.collection), rec.data);
              }
            } else {
              const singleRec = createVaultRecord({ vault: formData.vault, subWallet: formData.subWallet, asset: formData.asset, exchangeRate: formData.exchangeRate, cryptoPlatform: formData.cryptoPlatform }, linkId, parseFloat(formData.amount));
              await addDoc(collection(db, "users", user.uid, singleRec.collection), singleRec.data);
            }

            if (formData.isKhataSplit) {
               const freshPartiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
               const existingPartiesDocs = freshPartiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

               for (let ks of formData.khataSplits) {
                  const partyName = ks.partyName.trim();
                  const amountOwedBase = getBaseAmount(ks.amount, formData.asset !== baseCurrency, formData.exchangeRate);
                  
                  const existingParty = existingPartiesDocs.find(p => p.name.toLowerCase() === partyName.toLowerCase());
                  let partyId = '';

                  if (existingParty) {
                     partyId = existingParty.id;
                     await updateDoc(doc(db, "users", user.uid, "parties", partyId), {
                        netBalance: existingParty.netBalance + amountOwedBase,
                        status: (existingParty.netBalance + amountOwedBase) === 0 ? 'settled' : 'active'
                     });
                  } else {
                     const newPartyRef = await addDoc(collection(db, "users", user.uid, "parties"), {
                        name: partyName, accountType: 'casual', netBalance: amountOwedBase,
                        baseCurrency: baseCurrency, createdAt: timestamp, status: 'active'
                     });
                     partyId = newPartyRef.id;
                  }

                  await addDoc(collection(db, "users", user.uid, "parties", partyId, "ledger"), {
                     type: 'give', amount: parseFloat(ks.amount),
                     currency: formData.isSplit ? baseCurrency : formData.asset,
                     exchangeRate: formData.isSplit ? 1 : formData.exchangeRate,
                     baseAmount: amountOwedBase,
                     note: `Shared Bill: ${formData.title} (${formData.category})`,
                     date: formData.date, timestamp, linkId: linkId
                  });
               }
            }
        }
      } else {
        await addDoc(collection(db, "users", user.uid, "expenseLogs"), expenseRecord);
        
        if (formData.isSplit) {
          for (let s of formData.splitSources) {
            const rec = createVaultRecord(s, linkId, parseFloat(s.amount));
            await addDoc(collection(db, "users", user.uid, rec.collection), rec.data);
          }
        } else {
          const singleRec = createVaultRecord({ vault: formData.vault, subWallet: formData.subWallet, asset: formData.asset, exchangeRate: formData.exchangeRate, cryptoPlatform: formData.cryptoPlatform }, linkId, parseFloat(formData.amount));
          await addDoc(collection(db, "users", user.uid, singleRec.collection), singleRec.data);
        }

        if (formData.isKhataSplit) {
           const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
           const existingPartiesDocs = partiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

           for (let ks of formData.khataSplits) {
              const partyName = ks.partyName.trim();
              const amountOwedBase = getBaseAmount(ks.amount, formData.asset !== baseCurrency, formData.exchangeRate);
              
              const existingParty = existingPartiesDocs.find(p => p.name.toLowerCase() === partyName.toLowerCase());
              let partyId = '';

              if (existingParty) {
                 partyId = existingParty.id;
                 await updateDoc(doc(db, "users", user.uid, "parties", partyId), {
                    netBalance: existingParty.netBalance + amountOwedBase,
                    status: (existingParty.netBalance + amountOwedBase) === 0 ? 'settled' : 'active'
                 });
              } else {
                 const newPartyRef = await addDoc(collection(db, "users", user.uid, "parties"), {
                    name: partyName, accountType: 'casual', netBalance: amountOwedBase,
                    baseCurrency: baseCurrency, createdAt: timestamp, status: 'active'
                 });
                 partyId = newPartyRef.id;
              }

              await addDoc(collection(db, "users", user.uid, "parties", partyId, "ledger"), {
                 type: 'give', amount: parseFloat(ks.amount),
                 currency: formData.isSplit ? baseCurrency : formData.asset,
                 exchangeRate: formData.isSplit ? 1 : formData.exchangeRate,
                 baseAmount: amountOwedBase,
                 note: `Shared Bill: ${formData.title} (${formData.category})`,
                 date: formData.date, timestamp, linkId: linkId
              });
           }
        }
      }
      closeModal();
    } catch (error) { alert("Failed to save expense log."); } finally { setIsSaving(false); }
  };

  const initiateDelete = (rec) => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

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
        setPinError("Incorrect PIN.");
        setIsVerifying(false);
        return;
      }
      
      await deleteDoc(doc(db, "users", user.uid, "expenseLogs", deleteContext.id));
      
      if (deleteContext.linkedExpenseId) {
        const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
        for (const v of vaults) {
          const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", deleteContext.linkedExpenseId));
          const snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
        }

        const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
        for (const pDoc of partiesSnap.docs) {
           const lQuery = query(collection(db, "users", user.uid, "parties", pDoc.id, "ledger"), where("linkId", "==", deleteContext.linkedExpenseId));
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
        vault: s.vault, subWallet: s.subWallet || s.bankName || s.walletName || '',
        asset: s.asset || baseCurrency, amount: s.amount || '', cryptoPlatform: s.cryptoPlatform || cryptoPlatformsList[12], 
        exchangeRate: s.exchangeRate || 1, isCustomPlatform: s.vault === 'crypto' && !cryptoPlatformsList.includes(s.cryptoPlatform)
      }));
    }

    const isKhataSplit = !!rec.khataDetails && rec.khataDetails.length > 0;
    const mappedKhataSplits = isKhataSplit ? rec.khataDetails : [ { ...defaultKhataSplit } ];

    const isSyncedEntry = !!(rec.linkedExpenseId && !rec.linkedExpenseId.startsWith('EXP_'));

    setFormData({
      title: rec.title, category: rec.category, date: rec.date, linkedExpenseId: rec.linkedExpenseId || '', 
      isSplit: isSplit, vault: isSplit ? 'bank' : (rec.vault || 'bank'), subWallet: isSplit ? '' : (rec.subWallet || rec.bankName || rec.walletName || ''),
      asset: isSplit ? baseCurrency : (rec.asset || baseCurrency), amount: isSplit ? '' : (rec.amount || ''),
      exchangeRate: isSplit ? 1 : (rec.exchangeRate || 1), cryptoPlatform: isSplit ? cryptoPlatformsList[12] : (rec.cryptoPlatform || cryptoPlatformsList[12]),
      isCustomSingle: !isSplit && rec.vault === 'crypto' && !cryptoPlatformsList.includes(rec.cryptoPlatform), 
      splitSources: mappedSplits,
      isKhataSplit: isKhataSplit, khataSplits: mappedKhataSplits, 
      isSynced: isSyncedEntry 
    });
    setEditingId(rec.id);
    setIsModalOpen(true);
  };

  const openModal = () => {
    setEditingId(null);
    setFormData({ 
      title: '', category: expenseCategories[0], date: todayDate, linkedExpenseId: '', isSplit: false,
      vault: 'bank', subWallet: existingBanks[0] || '', asset: baseCurrency, amount: '', exchangeRate: 1, cryptoPlatform: cryptoPlatformsList[12], isCustomSingle: false,
      splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ],
      isKhataSplit: false, khataSplits: [ { ...defaultKhataSplit } ],
      isSynced: false
    });
    setIsModalOpen(true);
  };
  
  const closeModal = () => setIsModalOpen(false);

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
        updated[index].asset = value === 'crypto' ? (availableCryptos[0] || 'BTC') : baseCurrency; updated[index].exchangeRate = 1;
        if(value === 'cash' || value === 'crypto') updated[index].subWallet = ''; 
    }
    if (field === 'isCustomPlatform' && !value) { updated[index].cryptoPlatform = cryptoPlatformsList[12]; }
    setFormData({ ...formData, splitSources: updated });
  };

  const addSplitSource = () => setFormData({ ...formData, splitSources: [...formData.splitSources, { ...defaultSplitSource, vault: 'online' }] });
  const removeSplitSource = (index) => { if (formData.splitSources.length > 2) setFormData({ ...formData, splitSources: formData.splitSources.filter((_, i) => i !== index) }); };

  const updateKhataSplit = (index, field, value) => {
    const updated = [...formData.khataSplits]; updated[index][field] = value;
    setFormData({ ...formData, khataSplits: updated });
  };
  const addKhataSplit = () => setFormData({ ...formData, khataSplits: [...formData.khataSplits, { ...defaultKhataSplit }] });
  const removeKhataSplit = (index) => { if (formData.khataSplits.length > 1) setFormData({ ...formData, khataSplits: formData.khataSplits.filter((_, i) => i !== index) }); };

  return (
    <div className="w-full h-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(244,63,94,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <HiOutlineShoppingCart size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Expense Tracker</h1>
                  <p className="text-sm font-medium text-slate-400">Track expenses and split bills with friends</p>
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
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-500/30"
              >
                <HiOutlinePlus size={18} /> Log Expense
              </button>
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Expenses</p>
              <p className="text-lg font-black text-white">{currencySymbol}{totalExpenseBase.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">This Month</p>
              <p className="text-lg font-black text-rose-400">{currencySymbol}{thisMonthExpense.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Entries</p>
              <p className="text-lg font-black text-white">{expenses.length}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" placeholder="Search by payee or category..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:border-rose-500 transition-all placeholder-slate-400 shadow-sm text-slate-900 font-bold"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:border-rose-500 cursor-pointer transition-all shadow-sm text-slate-900 font-bold"
            >
              <option value="all">All Categories</option>
              {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Ledger */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500 rounded-full blur-xl opacity-30 animate-pulse" />
                <HiOutlineRefresh className="animate-spin text-4xl text-rose-500 relative" />
              </div>
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest mt-4 animate-pulse">Loading Expenses...</p>
            </div>
          ) : processedExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-sm">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <HiOutlineShoppingCart className="text-4xl text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">No expenses found</p>
              <p className="text-xs text-slate-500 mt-1">Log your first expense to get started</p>
            </div>
          ) : (
            processedExpenses.map((month) => (
              <div key={month.monthName} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <HiOutlineCalendar className="text-rose-500" size={18} />
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
                        <th className="p-4">Payee & Category</th>
                        <th className="p-4">Paid From</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {month.records.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                          <td className="p-4 pl-6">
                            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                              {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                            </p>
                          </td>
                          <td className="p-4">
                            <p className="font-black text-slate-900 dark:text-white text-sm">{rec.title}</p>
                            <div className="flex gap-1 flex-wrap mt-1">
                              <span className="inline-block px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[9px] font-black uppercase tracking-wider rounded border border-rose-200 dark:border-rose-500/20 shadow-sm">
                                {rec.category}
                              </span>
                              {rec.khataDetails && rec.khataDetails.length > 0 && (
                                <span className="inline-block px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider rounded border border-blue-200 dark:border-blue-500/20 shadow-sm">
                                  <FaUserFriends className="inline mr-1" size={10} /> Shared
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className={`flex items-center gap-2 ${rec.isSplit ? 'bg-amber-100/50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/20 w-max' : ''}`}>
                              {rec.isSplit ? (
                                <><FaRandom className="text-amber-600 dark:text-amber-500" /> <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Split Expense</span></>
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
                            <p className="text-base font-black text-rose-600 dark:text-rose-400 tracking-tight">
                              -{currencySymbol}{rec.finalBaseAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </p>
                            {rec.friendsShare > 0 && (
                              <p className="text-[9px] text-blue-600 dark:text-blue-400 font-bold mt-1">Friends: {currencySymbol}{rec.friendsShare.toLocaleString()}</p>
                            )}
                          </td>
                          <td className="p-4 pr-6">
                            <div className="flex items-center justify-end gap-2">
                              {rec.linkedExpenseId && !rec.linkedExpenseId.startsWith('EXP_') && (
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
                    <p className="text-xl font-black text-rose-700 dark:text-rose-400">
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
            
            <div className={`px-6 py-5 bg-gradient-to-r text-white flex justify-between items-center sticky top-0 z-10 shrink-0 ${formData.isSplit ? 'from-amber-600 to-orange-600' : 'from-rose-600 to-pink-600'}`}>
              <h3 className="text-xl font-black flex items-center gap-2">
                {formData.isSplit ? <FaRandom /> : <HiOutlineShoppingCart />} 
                {editingId ? 'Edit Expense' : 'Log Expense'}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Payee / Item</label>
                  <input 
                    disabled={formData.isSynced} type="text" required value={formData.title} 
                    onChange={(e) => setFormData({...formData, title: e.target.value})} 
                    placeholder="e.g., Dinner, Rent"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 transition-colors placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <div className="relative">
                    <select 
                      disabled={formData.isSynced} value={formData.category} 
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 appearance-none cursor-pointer transition-colors shadow-sm"
                    >
                      {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>

              {!formData.isSynced && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">Split Payment</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Pay using multiple sources</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={formData.isSplit} onChange={(e) => setFormData({...formData, isSplit: e.target.checked})} />
                      <div className="w-11 h-6 bg-slate-300 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>
              )}

              {!formData.isSplit ? (
                <div className="space-y-5 p-5 bg-rose-50/50 dark:bg-slate-800/80 rounded-2xl border border-rose-200 dark:border-slate-700 shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Vault</label>
                      <div className="relative">
                        <select 
                          value={formData.vault} 
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormData({
                              ...formData, vault: v, 
                              asset: v === 'crypto' ? (availableCryptos[0] || 'BTC') : baseCurrency, 
                              exchangeRate: 1, subWallet: ''
                            });
                          }} 
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none shadow-sm"
                        >
                          <option value="bank">Bank Account</option>
                          <option value="cash">Physical Cash</option>
                          <option value="online">Online Wallet</option>
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
                          type="text" list="sub-wallets-exp" required value={formData.subWallet} 
                          onChange={(e) => setFormData({...formData, subWallet: e.target.value})} 
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 placeholder-slate-400 shadow-sm"
                          placeholder={formData.vault === 'bank' ? "e.g. SBI" : "e.g. PayPal"}
                        />
                        <datalist id="sub-wallets-exp">{existingBanks.map(b => <option key={b} value={b} />)}</datalist>
                      </div>
                    )}
                    
                    {formData.vault === 'crypto' && (
                      <div className="animate-in fade-in">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                        {formData.isCustomSingle ? (
                          <div className="flex gap-2">
                            <input type="text" required value={formData.cryptoPlatform} onChange={(e)=>setFormData({...formData, cryptoPlatform: e.target.value})} className="flex-1 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm" />
                            <button type="button" onClick={()=>setFormData({...formData, isCustomSingle: false, cryptoPlatform: cryptoPlatformsList[0]})} className="px-4 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors border border-slate-300 dark:border-slate-600 shadow-sm"><HiOutlineX size={20}/></button>
                          </div>
                        ) : (
                          <div className="relative">
                            <select value={cryptoPlatformsList.includes(formData.cryptoPlatform) ? formData.cryptoPlatform : 'CUSTOM'} onChange={(e) => { if(e.target.value==='CUSTOM'){setFormData({...formData, isCustomSingle: true, cryptoPlatform: ''})} else {setFormData({...formData, cryptoPlatform: e.target.value})} }} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none cursor-pointer appearance-none shadow-sm">
                              {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                              <option value="CUSTOM">✨ Custom Platform</option>
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                      <div className="relative">
                        <select 
                          disabled={formData.isSynced} value={formData.asset} 
                          onChange={(e) => setFormData({...formData, asset: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 appearance-none cursor-pointer shadow-sm transition-colors"
                        >
                          {formData.vault === 'crypto' ? (
                            availableCryptos.map(c => <option key={c} value={c}>{c}</option>)
                          ) : (
                            <>
                              <option value={baseCurrency}>{baseCurrency} (Base)</option>
                              {availableFiats.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}
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
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 text-lg shadow-sm placeholder-slate-400 transition-colors"
                      />
                    </div>
                  </div>

                  {formData.asset !== baseCurrency && (
                    <div className="p-4 bg-rose-100/50 dark:bg-slate-900/50 border border-rose-200 dark:border-slate-700 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-400">Rate: 1 {formData.asset} =</span>
                        <input 
                          disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} 
                          onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} 
                          className="flex-1 w-28 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none text-sm disabled:opacity-60 shadow-sm transition-colors"
                        />
                        <span className="text-xs font-black text-slate-600 dark:text-slate-400">{baseCurrency}</span>
                      </div>
                      <button type="button" onClick={()=>fetchLiveRate(null)} disabled={isFetchingRate === 'single' || formData.isSynced} className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm transition-colors">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          {split.vault === 'crypto' 
                            ? availableCryptos.map(c => <option key={c} value={c}>{c}</option>) 
                            : [baseCurrency, ...availableFiats.filter(c => c !== baseCurrency)].map(c => <option key={c} value={c}>{c}</option>)
                          }
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
                  <button type="button" onClick={addSplitSource} className="w-full py-4 border-2 border-dashed border-amber-400 dark:border-amber-700/50 text-amber-700 dark:text-amber-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center justify-center gap-2">
                    <HiOutlinePlus size={18}/> Add Another Source
                  </button>
                </div>
              )}

              {!formData.isSynced && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800/50 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaUserFriends/> Split with Friends</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Auto-log their share into Smart Khata</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={formData.isKhataSplit} onChange={(e) => setFormData({...formData, isKhataSplit: e.target.checked})} />
                      <div className="w-11 h-6 bg-slate-300 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>

                  {formData.isKhataSplit && (
                    <div className="mt-4 space-y-3">
                      {/* 🚀 FIXED: Mobile Responsive Flex Fix for Khata Splits */}
                      {formData.khataSplits.map((ks, index) => (
                        <div key={index} className="flex items-center gap-2 w-full">
                          <div className="flex-1 min-w-0">
                            <input 
                              type="text" list={`khata-${index}`} required placeholder="Name" 
                              value={ks.partyName} 
                              onChange={(e) => updateKhataSplit(index, 'partyName', e.target.value)} 
                              className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400" 
                            />
                            <datalist id={`khata-${index}`}>{existingParties.map(p => <option key={p} value={p} />)}</datalist>
                          </div>
                          <div className="w-24 sm:w-32 shrink-0">
                            <input 
                              type="number" step="any" required placeholder="Amount" 
                              value={ks.amount} 
                              onChange={(e) => updateKhataSplit(index, 'amount', e.target.value)} 
                              className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400" 
                            />
                          </div>
                          {formData.khataSplits.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => removeKhataSplit(index)} 
                              className="shrink-0 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 p-2.5 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
                            >
                              <HiOutlineX size={16}/>
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addKhataSplit} className="text-[10px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"><HiOutlinePlus size={14}/> Add Friend</button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between pt-4 border-t border-slate-200 dark:border-slate-700 gap-4">
                <div className="w-full sm:w-1/3">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Date</label>
                  <input 
                    disabled={formData.isSynced} type="date" required value={formData.date} 
                    onChange={(e) => setFormData({...formData, date: e.target.value})} 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none disabled:opacity-60 shadow-sm transition-colors" 
                  />
                  <p className="text-[9px] text-rose-600 dark:text-rose-400 mt-1 ml-1 font-bold">{formatGlobalDate ? formatGlobalDate(formData.date, 'short') : ''}</p>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                  <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Total Expense</p>
                  <p className="text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight mt-1">
                    -{currencySymbol}{(formData.isSplit ? getSplitTotalBase() : getBaseAmount(formData.amount, formData.asset !== baseCurrency, formData.exchangeRate)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </p>
                  {formData.isKhataSplit && (
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-1">Net Personal: {currencySymbol}{Math.max(0, (formData.isSplit ? getSplitTotalBase() : getBaseAmount(formData.amount, formData.asset !== baseCurrency, formData.exchangeRate)) - getBaseAmount(getKhataTotal(), formData.asset !== baseCurrency, formData.exchangeRate)).toLocaleString()}</p>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2">
                <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white transition-all shadow-xl flex items-center justify-center gap-2 shrink-0 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} ${formData.isSplit ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-500/30' : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-500/30'}`}>
                  {isSaving && <HiOutlineRefresh className="animate-spin text-2xl" />}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Expense' : (formData.isKhataSplit ? 'Save & Sync Khata' : 'Save Expense'))}
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
                {deleteContext.linkedExpenseId && !deleteContext.linkedExpenseId.startsWith('EXP_') && (
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

export default ExpenseTracker;