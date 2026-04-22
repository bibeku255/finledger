import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlineUserAdd, HiOutlineSearch, HiOutlineUsers, 
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineX, 
  HiOutlineTrash, HiOutlineChevronRight,
  HiOutlineExclamationCircle, HiOutlineRefresh, HiOutlinePencil,
  HiOutlineLockClosed, HiOutlineShieldCheck, HiOutlineChevronDown,
  HiOutlineCalendar, HiOutlineDownload,
  HiOutlineDocumentText, HiOutlineTable, HiOutlinePhone,
  HiOutlineUser
} from 'react-icons/hi';
import { 
  FaUserCircle, FaPhoneAlt, FaUniversity, 
  FaArrowUp, FaArrowDown, FaUserFriends,
  FaHandHoldingHeart, FaHandHoldingUsd, FaWallet, FaBitcoin
} from 'react-icons/fa'; 

const cryptoPlatformsList = [
  "CoinDCX", "WazirX", "ZebPay", "Mudrex", "SunCrypto",
  "Binance", "Coinbase", "Bybit", "KuCoin", "OKX", "Kraken", "Mexc", "Gate.io",
  "FaucetPay", "Trust Wallet", "MetaMask", "Phantom", "NC Wallet", "Payeer",
  "Hardware Wallet (Ledger/Trezor)", "Other Wallet/Site"
];

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// 🚀 Premium Party Card Component
const PartyCard = ({ party, onEdit, onDelete, onClick, currencySymbol, formatGlobalDate }) => {
  const getStatusColor = () => {
    if (party.status === 'bad_debt') return 'from-rose-500/20 to-rose-600/20 border-rose-500/30';
    if (party.netBalance > 0) return 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20';
    if (party.netBalance < 0) return 'from-rose-500/10 to-pink-500/10 border-rose-500/20';
    return 'from-slate-500/10 to-slate-600/10 border-slate-500/20';
  };

  return (
    <div 
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl p-5 bg-white dark:bg-slate-900 border shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer ${getStatusColor()}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/5 group-hover:to-cyan-500/5 transition-all duration-500" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-300 ${
              party.status === 'bad_debt' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 
              party.accountType === 'loan' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 
              'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-500/20 dark:to-cyan-500/20 text-blue-600 dark:text-blue-400'
            }`}>
              {party.accountType === 'loan' ? <FaUniversity size={22} /> : <FaUserCircle size={28} />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-800 dark:text-white text-base leading-tight truncate capitalize">
                {party.name}
              </h3>
              {party.accountType === 'loan' && (
                <span className="inline-block bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-1 shadow-sm">
                  Formal Loan/EMI
                </span>
              )}
              {party.phone && (
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                  <FaPhoneAlt size={8}/> {party.phone}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(party, e); }} 
              className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
              title="Edit Details"
            >
              <HiOutlinePencil size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(party, e); }} 
              className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
              title="Delete"
            >
              <HiOutlineTrash size={16} />
            </button>
          </div>
        </div>

        <div className={`p-4 rounded-xl mt-2 backdrop-blur-sm border ${
          party.status === 'bad_debt' ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800' : 
          'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {party.status === 'bad_debt' ? 'Bad Debt / Defaulter' : 
               party.netBalance > 0 ? 'You will get' : 
               party.netBalance < 0 ? 'You will give' : 'Account Settled'}
            </p>
            {party.accountType === 'loan' && party.emiDueDate && party.netBalance !== 0 && (
              <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 text-[9px] font-black">
                <HiOutlineCalendar size={12}/> 
                Due: {formatGlobalDate ? formatGlobalDate(party.emiDueDate, 'short') : new Date(party.emiDueDate).getDate()}
              </span>
            )}
          </div>
          <p className={`text-2xl font-black tracking-tight break-words ${
            party.status === 'bad_debt' ? 'text-rose-600 dark:text-rose-400' : 
            party.netBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 
            party.netBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
          }`}>
            {currencySymbol}{Math.abs(party.netBalance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </p>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
            <HiOutlineUser size={12} />
            {party.accountType === 'loan' ? 'Lender' : 'Contact'}
          </div>
          <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
            <HiOutlineChevronRight size={16} />
          </div>
        </div>
      </div>
    </div>
  );
};

const PartyDirectory = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const navigate = useNavigate();

  const availableFiats = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);
  const availableCryptos = useMemo(() => {
    const customSymbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    return Array.from(new Set(["USDT", ...customSymbols])).map(s => s.toUpperCase());
  }, [selectedCryptos]);

  const [parties, setParties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState(null); 
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]); 
  const [existingVaultNames, setExistingVaultNames] = useState([]);

  // 🚀 FIXED: Added vault linking details to formData state
  const [formData, setFormData] = useState({
    name: '', phone: '', address: '', accountType: 'casual', 
    emiDueDate: '', emiAmount: '', initialBalanceType: 'none', 
    initialAmount: '', currency: baseCurrency, exchangeRate: 1,
    vault: 'none', subWallet: '', cryptoPlatform: cryptoPlatformsList[0], isCustomPlatform: false
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "parties"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const partyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setParties(partyData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchUserDataAndVaults = async () => {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().customCoins) {
        setCustomUserCoins(userSnap.data().customCoins);
      }

      // Fetch existing vaults for autocomplete
      const qBank = query(collection(db, "users", user.uid, "bankWallet"));
      const snapBank = await getDocs(qBank);
      const qOnline = query(collection(db, "users", user.uid, "onlineWallet"));
      const snapOnline = await getDocs(qOnline);
      const names = new Set();
      snapBank.docs.forEach(d => { if(d.data().bankName) names.add(d.data().bankName) });
      snapOnline.docs.forEach(d => { if(d.data().walletName) names.add(d.data().walletName) });
      setExistingVaultNames(Array.from(names));
    };
    fetchUserDataAndVaults();
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

  const totalReceivables = parties.reduce((acc, curr) => curr.netBalance > 0 && curr.status !== 'bad_debt' ? acc + curr.netBalance : acc, 0);
  const totalPayables = parties.reduce((acc, curr) => curr.netBalance < 0 && curr.status !== 'bad_debt' ? acc + Math.abs(curr.netBalance) : acc, 0);
  const activeParties = parties.filter(p => p.status === 'active').length;

  const filteredParties = parties.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.phone && p.phone.includes(searchTerm)) ||
                          (p.address && p.address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesTab = true;
    if (activeTab === 'receivable') matchesTab = p.netBalance > 0 && p.status !== 'bad_debt';
    if (activeTab === 'payable') matchesTab = p.netBalance < 0 && p.status !== 'bad_debt';
    if (activeTab === 'settled') matchesTab = p.netBalance === 0 || p.status === 'bad_debt' || p.status === 'settled';
    if (activeTab === 'loans') matchesTab = p.accountType === 'loan';

    return matchesSearch && matchesTab;
  });

  const nameSuggestions = (!editingPartyId && formData.name.trim().length > 0) 
    ? parties.filter(p => p.name.toLowerCase().includes(formData.name.toLowerCase()))
    : [];

  const handleSelectExisting = (partyId) => {
    closeModal();
    navigate(`/dashboard/parties/${partyId}`);
  };

  const existingExactMatch = !editingPartyId && parties.find(p => 
    (formData.phone.length > 5 && p.phone === formData.phone)
  );

  const fetchLiveRate = async () => {
    if (formData.currency === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fiatData = await fiatRes.json();
      const usdToBase = fiatData.rates[baseCurrency] || 1;

      if (availableFiats.includes(formData.currency)) {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
        const data = await res.json();
        if (data.rates[baseCurrency]) setFormData(prev => ({ ...prev, exchangeRate: data.rates[baseCurrency].toFixed(4) }));
      } else {
        const upperSym = formData.currency.toUpperCase();
        const coinObj = fullDatabase.find(c => c.symbol === upperSym) || {};
        const searchId = coinObj.id || formData.currency.toLowerCase();
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
              if(cgData[searchId]?.usd) priceUsd = parseFloat(cgData[searchId].usd);
           } catch(e) {}
        }

        if (!priceUsd) {
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
        setFormData(prev => ({ ...prev, exchangeRate: finalRate.toFixed(4) }));
      }
    } catch (error) {
      alert("Rate fetch failed. Please enter manually.");
    } finally {
      setIsFetchingRate(false);
    }
  };

  const isForeign = formData.currency !== baseCurrency;
  const initialBaseValue = (parseFloat(formData.initialAmount) || 0) * (isForeign ? (parseFloat(formData.exchangeRate) || 1) : 1);

  const handleSaveParty = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!editingPartyId && existingExactMatch) {
      alert(`A party with this phone number (${formData.phone}) already exists. Redirecting to their ledger...`);
      handleSelectExisting(existingExactMatch.id);
      return;
    }

    if (formData.accountType === 'loan' && (!formData.emiDueDate || !formData.emiAmount)) {
      alert("Please provide the EMI Amount and Due Date for formal loans.");
      return;
    }
    
    if (formData.initialBalanceType !== 'none' && formData.vault !== 'none') {
       if (formData.vault === 'crypto' && !formData.cryptoPlatform.trim()) return alert("Please specify the crypto platform.");
       if ((formData.vault === 'bank' || formData.vault === 'online') && !formData.subWallet.trim()) return alert("Please specify the Bank or Wallet Name.");
    }

    setIsSaving(true);

    try {
      if (editingPartyId) {
        await setDoc(doc(db, "users", user.uid, "parties", editingPartyId), {
          name: formData.name.trim(),
          phone: formData.phone || '',
          address: formData.address || '',
          accountType: formData.accountType,
          emiDueDate: formData.accountType === 'loan' ? formData.emiDueDate : null,
          emiAmount: formData.accountType === 'loan' ? parseFloat(formData.emiAmount) : null,
        }, { merge: true });
      } else {
        let startingBalanceBase = 0;
        if (formData.initialBalanceType === 'receivable') startingBalanceBase = initialBaseValue; 
        if (formData.initialBalanceType === 'payable') startingBalanceBase = -initialBaseValue; 

        const newParty = {
          name: formData.name.trim(),
          phone: formData.phone || '',
          address: formData.address || '',
          accountType: formData.accountType,
          emiDueDate: formData.accountType === 'loan' ? formData.emiDueDate : null,
          emiAmount: formData.accountType === 'loan' ? parseFloat(formData.emiAmount) : null,
          netBalance: startingBalanceBase, 
          baseCurrency: baseCurrency,
          createdAt: new Date().getTime(),
          status: 'active', 
          trustScore: 100 
        };

        const docRef = await addDoc(collection(db, "users", user.uid, "parties"), newParty);
        
        if (startingBalanceBase !== 0) {
          const timestamp = new Date().getTime();
          const formattedDate = new Date().toISOString().split('T')[0];
          const linkId = `PARTY_INIT_${timestamp}_${Math.floor(Math.random() * 1000)}`;

          // Create Ledger Entry
          await addDoc(collection(db, "users", user.uid, "parties", docRef.id, "ledger"), {
            type: startingBalanceBase > 0 ? 'give' : 'get',
            amount: parseFloat(formData.initialAmount),
            currency: formData.currency,
            exchangeRate: formData.exchangeRate,
            baseAmount: Math.abs(startingBalanceBase),
            date: formattedDate,
            timestamp: timestamp,
            note: formData.accountType === 'loan' ? 'Initial Loan Principal' : 'Opening Account Balance',
            linkId: linkId
          });

          // 🚀 SUPER LOGIC: Create Linked Vault Entry if User Opted In
          if (formData.vault !== 'none') {
            const isOutflow = startingBalanceBase > 0; // Receivable (+): money went OUT to them. Payable (-): money came IN from them.
            const typeStr = isOutflow ? 'out' : 'in';
            const actionStr = isOutflow ? 'Lent to' : 'Received from';

            let vaultCol = '';
            let vaultEntry = null;

            if (formData.vault === 'crypto') {
              vaultCol = 'cryptoWalletLogs';
              vaultEntry = {
                  type: typeStr,
                  coin: formData.currency,
                  quantity: parseFloat(formData.initialAmount),
                  platform: formData.cryptoPlatform.trim(),
                  reason: `${actionStr} ${formData.name.trim()} (Initial Khata)`,
                  referenceNo: linkId,
                  date: formattedDate,
                  timestamp,
                  linkedPartyId: docRef.id,
                  linkId
              };
            } else {
              vaultCol = formData.vault + 'Wallet';
              vaultEntry = {
                  title: `${actionStr} ${formData.name.trim()} (Initial Khata)`,
                  type: typeStr,
                  date: formattedDate,
                  timestamp,
                  currency: formData.currency,
                  foreignAmount: parseFloat(formData.initialAmount),
                  exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
                  finalBaseAmount: Math.abs(startingBalanceBase),
                  fee: 0,
                  walletName: formData.subWallet.trim() || 'Default Wallet',
                  bankName: formData.subWallet.trim() || 'Default Bank',
                  transferType: 'Khata Settlement',
                  linkedPartyId: docRef.id,
                  linkId
              };
            }
            await addDoc(collection(db, "users", user.uid, vaultCol), vaultEntry);
          }
        }
      }
      closeModal();
    } catch (error) {
      alert(editingPartyId ? "Failed to update party." : "Failed to create party.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (party, e) => {
    e.stopPropagation(); 
    setEditingPartyId(party.id);
    setFormData({
      name: party.name, phone: party.phone || '', address: party.address || '',
      accountType: party.accountType || 'casual', emiDueDate: party.emiDueDate || '',
      emiAmount: party.emiAmount || '', initialBalanceType: 'none', initialAmount: '',
      currency: baseCurrency, exchangeRate: 1, vault: 'none', subWallet: '', cryptoPlatform: cryptoPlatformsList[0], isCustomPlatform: false
    });
    setShowSuggestions(false);
    setIsModalOpen(true);
  };

  const initiateDelete = (party, e) => {
    e.stopPropagation(); 
    setDeleteContext(party);
    setPinInput('');
    setPinError('');
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your Security PIN.");
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

      await deleteDoc(doc(db, "users", user.uid, "parties", deleteContext.id));
      
      const q = query(collection(db, "users", user.uid, "parties", deleteContext.id, "ledger"));
      const snap = await getDocs(q);
      snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, "parties", deleteContext.id, "ledger", d.id)));

      // 🚀 CRITICAL REVERSE ENGINEERING: Delete ANY linked Vault Entries!
      const collectionsToCheck = ['bankWallet', 'cashWallet', 'onlineWallet', 'cryptoWalletLogs', 'expenseLogs', 'incomeLogs'];
      for (const colName of collectionsToCheck) {
        const vQ = query(collection(db, "users", user.uid, colName), where("linkedPartyId", "==", deleteContext.id));
        const vSnap = await getDocs(vQ);
        vSnap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, colName, d.id)));
      }

      setDeleteContext(null); 
    } catch (error) {
      setPinError("System error during verification. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownloadReport = (format) => {
    if (filteredParties.length === 0) return alert("No records found to download.");
    
    const reportData = filteredParties.map(p => ({
      name: p.name,
      type: p.accountType === 'loan' ? 'Formal Loan' : 'Casual Khata',
      phone: p.phone || 'N/A',
      balance: `${p.netBalance > 0 ? '+' : ''}${currencySymbol}${p.netBalance.toFixed(2)}`,
      status: p.status === 'bad_debt' ? 'Bad Debt' : p.netBalance === 0 ? 'Settled' : 'Active'
    }));

    const columns = [
      { header: 'Name', key: 'name' }, { header: 'Type', key: 'type' },
      { header: 'Phone', key: 'phone' }, { header: 'Balance', key: 'balance' },
      { header: 'Status', key: 'status' }
    ];

    const fileName = `Smart_Khata_Directory`;
    const reportTitle = `Smart Khata & Loans - Directory Report`;

    if (format === 'pdf') downloadPDFReport(reportData, columns, fileName, reportTitle);
    else downloadExcelReport(reportData, columns, fileName);
  };

  const openModal = () => {
    setEditingPartyId(null);
    setFormData({ 
      name: '', phone: '', address: '', accountType: 'casual', emiDueDate: '', emiAmount: '', 
      initialBalanceType: 'none', initialAmount: '', currency: baseCurrency, exchangeRate: 1,
      vault: 'none', subWallet: existingVaultNames[0] || '', cryptoPlatform: cryptoPlatformsList[0], isCustomPlatform: false
    });
    setShowSuggestions(false);
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setShowSuggestions(false);
    setEditingPartyId(null);
  };

  return (
    <div className="w-full h-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <HiOutlineUsers size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Smart Khata & Loans</h1>
                  <p className="text-sm font-medium text-slate-400">Manage lenders, casual debts, and bank EMIs</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group hidden sm:block">
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
              
              <button 
                onClick={openModal} 
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/30"
              >
                <HiOutlineUserAdd size={18} /> Add Account
              </button>
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To Receive</p>
              <p className="text-sm md:text-lg font-black text-emerald-400 break-words">{currencySymbol}{totalReceivables.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To Pay</p>
              <p className="text-sm md:text-lg font-black text-rose-400 break-words">{currencySymbol}{totalPayables.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Accounts</p>
              <p className="text-sm md:text-lg font-black text-white">{activeParties}</p>
            </div>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="space-y-4">
          <div className="relative">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" placeholder="Search by name, phone or bank..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all shadow-sm placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
            <button onClick={() => setActiveTab('all')} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all border-2 ${
              activeTab === 'all' ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 shadow-sm'
            }`}>All ({parties.length})</button>
            <button onClick={() => setActiveTab('loans')} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all border-2 flex items-center gap-1.5 ${
              activeTab === 'loans' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 dark:bg-slate-900 dark:border-indigo-800/50 dark:text-indigo-400 shadow-sm'
            }`}><FaUniversity size={12}/> Loans</button>
            <button onClick={() => setActiveTab('receivable')} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all border-2 flex items-center gap-1.5 ${
              activeTab === 'receivable' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-slate-900 dark:border-emerald-800/50 dark:text-emerald-400 shadow-sm'
            }`}><FaHandHoldingUsd size={12}/> To Get</button>
            <button onClick={() => setActiveTab('payable')} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all border-2 flex items-center gap-1.5 ${
              activeTab === 'payable' ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50 dark:bg-slate-900 dark:border-rose-800/50 dark:text-rose-400 shadow-sm'
            }`}><FaHandHoldingHeart size={12}/> To Give</button>
            <button onClick={() => setActiveTab('settled')} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all border-2 flex items-center gap-1.5 ${
              activeTab === 'settled' ? 'bg-slate-600 text-white border-slate-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 shadow-sm'
            }`}><HiOutlineShieldCheck size={12}/> Settled</button>
          </div>
        </div>

        {/* Party Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
              <HiOutlineRefresh className="animate-spin text-4xl text-blue-500 relative" />
            </div>
            <p className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-4 animate-pulse">Loading Accounts...</p>
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-sm">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <HiOutlineUsers className="text-4xl text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">No accounts found</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {activeTab === 'loans' ? 'You have no active formal loans or EMIs.' : 'Add friends, relatives, or banks to start tracking.'}
            </p>
            {activeTab === 'all' && (
              <button onClick={openModal} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-sm">
                Add First Account
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredParties.map(party => (
              <PartyCard 
                key={party.id}
                party={party}
                onEdit={handleEditClick}
                onDelete={initiateDelete}
                onClick={() => navigate(`/dashboard/parties/${party.id}`)}
                currencySymbol={currencySymbol}
                formatGlobalDate={formatGlobalDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* 🚀 Add/Edit Modal (With Vault Linking) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
            
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white flex justify-between items-center shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2">
                {editingPartyId ? <HiOutlinePencil /> : <HiOutlineUserAdd />}
                {editingPartyId ? 'Edit Account' : 'Add New Account'}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveParty} className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <button type="button" onClick={() => setFormData({...formData, accountType: 'casual'})} className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                  formData.accountType === 'casual' ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>Casual Khata</button>
                <button type="button" onClick={() => setFormData({...formData, accountType: 'loan'})} className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                  formData.accountType === 'loan' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>Formal Loan/EMI</button>
              </div>

              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">
                  {formData.accountType === 'loan' ? 'Bank / Lender Name' : 'Person / Company Name'}
                </label>
                <input 
                  type="text" required value={formData.name} 
                  onChange={(e) => { setFormData({...formData, name: e.target.value}); if (!editingPartyId) setShowSuggestions(true); }} 
                  onFocus={() => { if(!editingPartyId) setShowSuggestions(true) }}
                  placeholder={formData.accountType === 'loan' ? "e.g., HDFC Home Loan" : "e.g., Rahul, Colleague"} 
                  className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors" 
                />
                
                {showSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Existing Accounts</span>
                    </div>
                    <ul className="max-h-48 overflow-y-auto">
                      {nameSuggestions.map(s => (
                        <li key={s.id} onClick={() => handleSelectExisting(s.id)} className="p-3 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer flex justify-between items-center transition-colors">
                          <div>
                            <span className="font-black text-sm text-slate-800 dark:text-white capitalize">{s.name}</span>
                            <span className="text-[10px] text-slate-500 block font-bold">{s.phone}</span>
                          </div>
                          <HiOutlineChevronRight className="text-blue-500" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {formData.accountType === 'loan' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl shadow-sm">
                  <div>
                    <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest ml-1">EMI Amount</label>
                    <input type="number" required value={formData.emiAmount} onChange={(e) => setFormData({...formData, emiAmount: e.target.value})} placeholder="e.g., 5000" 
                      className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest ml-1">Next Due Date</label>
                    <input type="date" required value={formData.emiDueDate} onChange={(e) => setFormData({...formData, emiDueDate: e.target.value})} 
                      className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm transition-colors" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Phone (Optional)</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="e.g., +91 987..." 
                    className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Notes (Optional)</label>
                  <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="e.g., Loan A/C 4589" 
                    className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-colors" />
                </div>
              </div>

              {!editingPartyId && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3 block ml-1">
                    {formData.accountType === 'loan' ? 'Total Loan Principal' : 'Previous Balance (If any)'}
                  </label>
                  
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {['none', 'receivable', 'payable'].map((type) => (
                      <label key={type} className={`p-2.5 sm:p-3 rounded-lg border-2 text-center cursor-pointer font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all flex items-center justify-center leading-tight shadow-sm ${
                        formData.initialBalanceType === type 
                          ? type === 'none' ? 'bg-slate-100 border-slate-400 text-slate-800 dark:bg-slate-700 dark:border-slate-500 dark:text-white' :
                            type === 'receivable' ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500' :
                            'bg-rose-50 border-rose-400 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-600'
                      }`}>
                        <input type="radio" name="balType" className="hidden" checked={formData.initialBalanceType === type} onChange={() => setFormData({...formData, initialBalanceType: type})} />
                        {type === 'none' ? 'Settled' : type === 'receivable' ? 'To Get (+)' : 'To Give (-)'}
                      </label>
                    ))}
                  </div>

                  {formData.initialBalanceType !== 'none' && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                      
                      <div className="flex flex-row gap-2 sm:gap-3 w-full">
                        <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                          className="w-[35%] sm:w-auto min-w-[80px] p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer transition-colors">
                          <option value={baseCurrency}>{baseCurrency}</option>
                          <optgroup label="Fiat">
                            {availableFiats.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                          <optgroup label="Crypto">
                            {availableCryptos.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        </select>
                        <input type="number" required value={formData.initialAmount} onChange={(e) => setFormData({...formData, initialAmount: e.target.value})} placeholder="Amount" 
                          className={`w-[65%] flex-1 min-w-0 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-black outline-none shadow-sm transition-colors ${
                            formData.initialBalanceType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`} />
                      </div>

                      {isForeign && (
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                          <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="shrink-0 text-[10px] font-black bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1 transition-colors">
                            <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={14} /> <span className="hidden sm:inline">Live</span>
                          </button>
                          <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">1 {formData.currency} =</span>
                            <input type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} 
                              className="flex-1 w-full min-w-0 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-900 dark:text-white outline-none transition-colors" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">{baseCurrency}</span>
                          </div>
                        </div>
                      )}

                      {/* 🚀 PREMIUM: Vault Linking Option Added Here */}
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                          <FaUniversity className="text-blue-500"/> Link to Vault?
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="relative">
                            <select value={formData.vault} onChange={(e) => setFormData({...formData, vault: e.target.value, subWallet: ''})} 
                              className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none cursor-pointer shadow-sm transition-colors">
                              <option value="none">No Vault (Khata Only)</option>
                              <option value="bank">Bank Account</option>
                              <option value="cash">Physical Cash</option>
                              <option value="online">Online Wallet</option>
                              <option value="crypto">Crypto Engine</option>
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                          </div>
                          
                          {(formData.vault === 'bank' || formData.vault === 'online') && (
                            <div className="animate-in fade-in">
                              <input type="text" list="sub-wallets-party" required value={formData.subWallet} onChange={(e) => setFormData({...formData, subWallet: e.target.value})} 
                                placeholder={formData.vault === 'bank' ? "e.g., SBI" : "e.g., PayPal"} 
                                className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm placeholder-slate-400" />
                              <datalist id="sub-wallets-party">
                                {existingVaultNames.map(b => <option key={b} value={b} />)}
                              </datalist>
                            </div>
                          )}

                          {formData.vault === 'crypto' && (
                            <div className="animate-in fade-in">
                              {formData.isCustomPlatform ? (
                                <div className="flex gap-2">
                                  <input type="text" required value={formData.cryptoPlatform} onChange={(e)=>setFormData({...formData, cryptoPlatform: e.target.value})} className="flex-1 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm transition-colors" />
                                  <button type="button" onClick={()=>setFormData({...formData, isCustomPlatform: false, cryptoPlatform: cryptoPlatformsList[0]})} className="px-4 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm border border-slate-300 dark:border-slate-600"><HiOutlineX size={20}/></button>
                                </div>
                              ) : (
                                <div className="relative">
                                  <select value={cryptoPlatformsList.includes(formData.cryptoPlatform) ? formData.cryptoPlatform : 'CUSTOM'} onChange={(e) => { if(e.target.value==='CUSTOM'){setFormData({...formData, isCustomPlatform: true, cryptoPlatform: ''})} else {setFormData({...formData, cryptoPlatform: e.target.value})} }} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none cursor-pointer appearance-none shadow-sm transition-colors">
                                    {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                                    <option value="CUSTOM">✨ Custom Platform</option>
                                  </select>
                                  <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2">
                <button type="submit" disabled={isSaving} className="w-full p-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0">
                  {isSaving && <HiOutlineRefresh className="animate-spin text-xl" />}
                  {isSaving ? 'Processing...' : (editingPartyId ? 'Update Account' : 'Create Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-700 flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
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
                  You are deleting <span className="font-black">"{deleteContext.name}"</span>. 
                  All related Vault transactions linked to this party will also be reversed automatically.
                  {deleteContext.netBalance !== 0 && (
                    <span className="block mt-2">Active balance: {currencySymbol}{Math.abs(deleteContext.netBalance).toLocaleString()}</span>
                  )}
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

export default PartyDirectory;