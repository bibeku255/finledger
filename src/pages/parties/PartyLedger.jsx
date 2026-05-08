import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { collection, doc, onSnapshot, setDoc, addDoc, query, orderBy, deleteDoc, getDocs, where, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineExclamationCircle, 
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineX, HiOutlineRefresh,
  HiOutlineCalendar, HiOutlineTrash, HiOutlineInformationCircle, HiOutlineTag,
  HiOutlineChevronDown, HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineLockClosed, HiOutlineShieldCheck, HiOutlinePhone,
  HiOutlineDotsVertical, HiOutlineCash, HiOutlineUser
} from 'react-icons/hi';

import { 
  FaUserCircle, FaUniversity, FaWallet, FaPercent, 
  FaArrowUp, FaArrowDown, FaCheckCircle,
  FaTimesCircle, FaExclamationTriangle, FaPhoneAlt, 
  FaBitcoin, FaExchangeAlt, FaHistory 
} from 'react-icons/fa';

import { fiatFlagMap } from '../../utils/marketConstants';

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

// 🚀 Mobile Responsive Chat Bubble
const ChatBubble = ({ entry, isRight, currencySymbol, baseCurrency, formatGlobalDate, onDelete }) => {
  const getBubbleStyle = () => {
    if (isRight) return 'bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 border-rose-200 dark:border-rose-700/30';
    return 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700/30';
  };

  const getTypeBadge = () => {
    const types = {
      give: { label: 'You Gave', color: 'bg-rose-200/50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' },
      receive: { label: 'You Received', color: 'bg-emerald-200/50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
      emi_payment: { label: 'EMI Paid', color: 'bg-indigo-200/50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' },
      interest: { label: 'Interest Added', color: 'bg-blue-200/50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
      opening_balance: { label: 'Opening Balance', color: 'bg-slate-200/50 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400' }
    };
    return types[entry.type] || { label: entry.type, color: 'bg-slate-200/50 text-slate-700' };
  };

  const badge = getTypeBadge();
  const dateObj = new Date(entry.timestamp);
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300 group px-1 sm:px-0`}>
      <div className={`relative w-[92%] sm:w-[85%] md:max-w-[75%] p-3 sm:p-4 md:p-5 rounded-[1.25rem] sm:rounded-[1.5rem] shadow-md border backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${getBubbleStyle()} ${isRight ? 'rounded-br-xl' : 'rounded-bl-xl'}`}>
        
        <button 
          onClick={() => onDelete(entry)} 
          className={`absolute -top-2 ${isRight ? '-left-2' : '-right-2'} p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 md:opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100 z-10`}
          title="Delete Entry"
          aria-label="Delete entry"
        >
          <HiOutlineTrash size={14} />
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 mb-2 sm:mb-3">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 w-full sm:w-auto">
            <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${badge.color} shadow-sm shrink-0`}>
              {badge.label}
            </span>
            
            {entry.vault && (
              <span className="text-[8px] sm:text-[9px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 bg-white/60 dark:bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50 shadow-sm shrink-0">
                {entry.vault === 'bank' ? <FaUniversity size={9} className="text-blue-500" /> : 
                 entry.vault === 'cash' ? <HiOutlineCash size={10} className="text-emerald-500" /> : 
                 entry.vault === 'crypto' ? <FaBitcoin size={9} className="text-orange-500" /> : 
                 <FaWallet size={9} className="text-purple-500" />} 
                <span className="capitalize hidden sm:inline">{entry.vault}</span>
                {(entry.subWallet || entry.cryptoPlatform) && (
                  <span className="text-slate-500 dark:text-slate-400 truncate max-w-[60px] sm:max-w-[120px] ml-1 border-l border-slate-300 dark:border-slate-600 pl-1">
                    {entry.subWallet || entry.cryptoPlatform}
                  </span>
                )}
              </span>
            )}
          </div>
          <span className="text-[8px] sm:text-[9px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end sm:justify-start">
            <HiOutlineCalendar size={10} />
            {formatGlobalDate ? formatGlobalDate(entry.timestamp, 'short') : new Date(entry.timestamp).toLocaleDateString()}
            <span className="opacity-60 border-l border-slate-300 dark:border-slate-600 pl-1 ml-0.5">{timeStr}</span>
          </span>
        </div>

        <div className="flex flex-col gap-0.5 mb-1.5 sm:mb-2">
          <p className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tight break-all ${isRight ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {isRight ? '-' : '+'}{currencySymbol}{Math.abs(entry.baseAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}
          </p>
          {entry.currency !== baseCurrency && (
            <div className="shrink-0 flex items-center gap-2 mt-1">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{entry.amount} {entry.currency}</p>
              <p className="text-[8px] sm:text-[9px] text-slate-500 dark:text-slate-400 border-l border-slate-300 dark:border-slate-600 pl-2">@ {entry.exchangeRate} rate</p>
            </div>
          )}
        </div>

        {entry.purpose && entry.type === 'give' && (
          <div className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 mb-1.5 sm:mb-2 border border-rose-200 dark:border-rose-800/50 shadow-sm break-words w-fit max-w-full">
            <HiOutlineTag size={10} className="shrink-0" /> <span className="truncate">{entry.purpose}</span>
          </div>
        )}

        {entry.note && (
          <div className={`p-2.5 sm:p-3 rounded-xl text-xs font-bold leading-relaxed shadow-sm break-words mt-1 ${isRight ? 'bg-rose-100/50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-emerald-100/50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'} border ${isRight ? 'border-rose-200/50 dark:border-rose-500/20' : 'border-emerald-200/50 dark:border-emerald-500/20'}`}>
            {entry.note}
          </div>
        )}
      </div>
    </div>
  );
};

const SystemMessage = ({ entry, onDelete }) => (
  <div className="flex justify-center my-3 group px-4">
    <div className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all text-center break-words max-w-[95%] sm:max-w-[90%] ${
      entry.type === 'writeoff' 
        ? 'bg-gradient-to-r from-rose-100 to-rose-200 text-rose-700 dark:from-rose-900/40 dark:to-rose-800/40 dark:text-rose-300 border border-rose-300 dark:border-rose-700' 
        : 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 dark:from-slate-800 dark:to-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
    }`}>
      {entry.type === 'writeoff' ? <FaExclamationTriangle size={14} className="shrink-0"/> : <FaCheckCircle size={14} className="shrink-0"/>}
      <span className="truncate">{entry.note}</span>
      {entry.type !== 'opening_balance' && (
        <button onClick={() => onDelete(entry)} className="ml-2 text-slate-400 hover:text-rose-500 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-label="Delete system message">
          <HiOutlineTrash size={14} />
        </button>
      )}
    </div>
  </div>
);

const PartyLedger = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [party, setParty] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const chatEndRef = useRef(null);

  const [activeModal, setActiveModal] = useState(null); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false); 
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [existingVaultNames, setExistingVaultNames] = useState([]);
  const [customUserCoins, setCustomUserCoins] = useState([]); 
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const localTimeStr = getLocalDateTimeString();
  const todayDate = new Date().toISOString().split('T')[0];

  const availableFiats = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);
  const availableCryptos = useMemo(() => {
    const customSymbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    return Array.from(new Set(["USDT", ...customSymbols])).map(s => s.toUpperCase());
  }, [selectedCryptos]);

  const cryptoPlatformsList = useMemo(() => {
    const platforms = new Set(['Binance', 'Coinbase', 'Kraken', 'Bybit', 'OKX', 'KuCoin', 'Gate.io', 'Bitfinex', 'Huobi', 'Gemini']);
    customUserCoins.forEach(c => { if (c.platform) platforms.add(c.platform); });
    return Array.from(platforms);
  }, [customUserCoins]);

  const [formData, setFormData] = useState({
    amount: '', currency: baseCurrency, exchangeRate: 1, vault: 'bank', subWallet: '',
    cryptoPlatform: availableCryptos[0] || 'BTC', isCustomPlatform: false,
    note: '', purpose: 'Friendly Support (0% Interest)', datetime: localTimeStr,
    receiveType: 'principal', interestPrincipal: '', interestRate: '',
    interestType: 'monthly', interestMethod: 'simple', startDate: todayDate, endDate: todayDate
  });

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    if (!user || !id) return;
    
    const partyRef = doc(db, "users", user.uid, "parties", id);
    const unsubParty = onSnapshot(partyRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setParty({ id: docSnap.id, ...data });
      }
    });

    const ledgerRef = collection(db, "users", user.uid, "parties", id, "ledger");
    const q = query(ledgerRef, orderBy("timestamp", "asc"));
    const unsubLedger = onSnapshot(q, (snapshot) => {
      setLedger(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => { unsubParty(); unsubLedger(); };
  }, [user, id]);

  useEffect(() => {
    if (!user) return;
    const fetchVaults = async () => {
      const qBank = query(collection(db, "users", user.uid, "bankWallet"));
      const snapBank = await getDocs(qBank);
      const qOnline = query(collection(db, "users", user.uid, "onlineWallet"));
      const snapOnline = await getDocs(qOnline);
      const names = new Set();
      snapBank.docs.forEach(d => { if(d.data().bankName) names.add(d.data().bankName) });
      snapOnline.docs.forEach(d => { if(d.data().walletName) names.add(d.data().walletName) });
      setExistingVaultNames(Array.from(names));
    };
    fetchVaults();
  }, [user]);

  useEffect(() => {
    if (activeModal === 'interest') {
      const P = parseFloat(formData.interestPrincipal) || 0;
      const R = parseFloat(formData.interestRate) || 0;
      const sDate = new Date(formData.startDate);
      const eDate = new Date(formData.endDate);
      
      if (eDate >= sDate && P > 0 && R > 0) {
        const timeDiff = eDate.getTime() - sDate.getTime();
        const exactDays = Math.round(timeDiff / (1000 * 3600 * 24)); 
        let calculatedInterest = 0;
        const yearlyRate = formData.interestType === 'monthly' ? (R * 12) : R;

        if (formData.interestMethod === 'compound') {
          calculatedInterest = P * Math.pow(1 + yearlyRate / 100, exactDays / 365) - P;
        } else {
          calculatedInterest = (P * yearlyRate * (exactDays / 365)) / 100;
        }
        
        setFormData(prev => ({ ...prev, amount: calculatedInterest.toFixed(2) }));
      } else {
        setFormData(prev => ({ ...prev, amount: '' }));
      }
    }
  }, [formData.interestPrincipal, formData.interestRate, formData.interestType, formData.interestMethod, formData.startDate, formData.endDate, activeModal]);

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
  const baseValue = (parseFloat(formData.amount) || 0) * (isForeign ? (parseFloat(formData.exchangeRate) || 1) : 1);

  const initiateDelete = (entry) => {
    setDeleteContext(entry);
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
        setPinError("Incorrect PIN. Deletion blocked!");
        setIsVerifying(false);
        return;
      }

      const entry = deleteContext;
      let balanceAdjustment = 0;
      
      if (entry.type === 'give' || entry.type === 'interest' || (entry.type === 'opening_balance' && entry.baseAmount > 0) || entry.type === 'emi_payment') {
        balanceAdjustment = -Math.abs(entry.baseAmount); 
      } else if (entry.type === 'receive' || (entry.type === 'opening_balance' && entry.baseAmount < 0)) {
        balanceAdjustment = Math.abs(entry.baseAmount); 
      }

      let newNetBalance = party.netBalance + balanceAdjustment;
      let newStatus = newNetBalance === 0 ? 'settled' : 'active';
      
      if (entry.type === 'settled' || entry.type === 'writeoff') {
          newStatus = 'active';
      }

      await setDoc(doc(db, "users", user.uid, "parties", party.id), { 
        netBalance: newNetBalance,
        status: newStatus 
      }, { merge: true });

      await deleteDoc(doc(db, "users", user.uid, "parties", party.id, "ledger", entry.id));
      
      if (entry.linkId) {
        const collectionsToCheck = ['bankWallet', 'cashWallet', 'onlineWallet', 'cryptoWalletLogs', 'expenseLogs', 'incomeLogs'];
        for (const colName of collectionsToCheck) {
          let q = query(collection(db, "users", user.uid, colName), where("linkId", "==", entry.linkId));
          let snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, colName, d.id)));

          q = query(collection(db, "users", user.uid, colName), where("linkedExpenseId", "==", entry.linkId));
          snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, colName, d.id)));
        }
      }

      setDeleteContext(null);
    } catch (error) {
      console.error(error);
      setPinError("System error during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownloadReport = (format) => {
    setIsExportMenuOpen(false);
    if (ledger.length === 0) return alert("No transactions to download.");

    const reportData = ledger.map(entry => {
      let action = 'Opening Balance';
      if (entry.type === 'give') action = 'Given (-)';
      if (entry.type === 'receive') action = 'Received (+)';
      if (entry.type === 'interest') action = 'Interest Added';
      if (entry.type === 'settled') action = 'Settled';
      if (entry.type === 'emi_payment') action = 'EMI Paid'; 
      if (entry.type === 'writeoff') action = 'Bad Debt (Write-off)';

      let cleanNote = (entry.note || entry.purpose || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const rawDate = entry.date ? entry.date.split('T')[0] : 'N/A';
      
      let creditValue = 0; 
      let debitValue = 0;  
      
      if (entry.type === 'receive' || (entry.type === 'opening_balance' && entry.baseAmount < 0)) {
          creditValue = Math.abs(entry.baseAmount);
      } else if (entry.type === 'give' || entry.type === 'emi_payment' || entry.type === 'interest' || (entry.type === 'opening_balance' && entry.baseAmount > 0)) {
          debitValue = Math.abs(entry.baseAmount);
      }

      return {
        date: formatGlobalDate ? formatGlobalDate(entry.date, 'full') : rawDate,
        action: action,
        nativeAmount: `${(Number(entry.amount) || 0).toLocaleString()} ${entry.currency || baseCurrency}`,
        credit: creditValue,
        debit: debitValue,
        note: cleanNote
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Action', key: 'action' },
      { header: 'Native Amount', key: 'nativeAmount' },
      { header: `Given/Paid (${currencySymbol})`, key: 'debit', isNumeric: true },
      { header: `Received (${currencySymbol})`, key: 'credit', isNumeric: true },
      { header: 'Details / Notes', key: 'note' }
    ];

    const fileName = `Khata_${party.name.replace(/\s+/g, '_')}`;
    const reportTitle = `${party.name.toUpperCase()} - Smart Khata Ledger`;

    if (format === 'pdf') downloadPDFReport(reportData, columns, fileName, reportTitle);
    else downloadExcelReport(reportData, columns, fileName, reportTitle);
  };
  
  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!user || !party) return;

    if (activeModal !== 'interest' && formData.vault === 'crypto' && !formData.cryptoPlatform.trim()) {
        return alert("Please specify the exact Crypto Platform.");
    }

    if (activeModal !== 'interest' && (formData.vault === 'bank' || formData.vault === 'online') && !formData.subWallet.trim()) {
        return alert("Please specify the exact Bank or Wallet Name (e.g. SBI, PayPal).");
    }

    setIsProcessing(true);

    const timestamp = new Date(formData.datetime).getTime();
    const formattedDate = new Date(formData.datetime).toISOString().split('T')[0];
    const linkId = `PARTY_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    let newNetBalance = party.netBalance;
    let ledgerEntry = {
      type: activeModal, 
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
      baseAmount: baseValue,
      note: formData.note,
      vault: activeModal === 'interest' ? null : formData.vault,
      subWallet: activeModal === 'interest' ? null : formData.subWallet.trim(),
      cryptoPlatform: activeModal === 'interest' ? null : (formData.vault === 'crypto' ? formData.cryptoPlatform.trim() : null),
      date: formattedDate,
      timestamp,
      linkId
    };

    let vaultCol = '';
    let vaultEntry = null;

    if (activeModal !== 'interest') {
      const isOutflow = activeModal === 'give' || activeModal === 'emi_payment';
      const typeStr = isOutflow ? 'out' : 'in';
      const actionStr = activeModal === 'emi_payment' ? 'EMI Paid to' : (activeModal === 'give' ? 'Lent to' : 'Received from');

      if (formData.vault === 'crypto') {
          vaultCol = 'cryptoWalletLogs';
          vaultEntry = {
              type: typeStr,
              coin: formData.currency,
              quantity: parseFloat(formData.amount),
              platform: formData.cryptoPlatform.trim(),
              reason: `${actionStr} ${party.name} (Khata)`,
              referenceNo: linkId,
              date: formattedDate,
              timestamp,
              linkedPartyId: party.id,
              linkId
          };
      } else {
          vaultCol = formData.vault + 'Wallet';
          vaultEntry = {
              title: `${actionStr} ${party.name}`,
              type: typeStr,
              date: formattedDate,
              timestamp,
              currency: formData.currency,
              foreignAmount: parseFloat(formData.amount),
              exchangeRate: ledgerEntry.exchangeRate,
              finalBaseAmount: baseValue,
              fee: 0,
              walletName: formData.subWallet.trim() || 'Default Wallet',
              bankName: formData.subWallet.trim() || 'Default Bank',
              transferType: 'Khata Settlement',
              linkedPartyId: party.id,
              linkId
          };
      }
    }

    if (activeModal === 'emi_payment') {
      newNetBalance += baseValue; 
      ledgerEntry.purpose = 'EMI Installment Paid';
      ledgerEntry.note = "(EMI Paid) " + formData.note;
    } 
    else if (activeModal === 'give') {
      newNetBalance += baseValue;
      ledgerEntry.purpose = formData.purpose; 
    } else if (activeModal === 'receive') {
      newNetBalance -= baseValue;
      const isInterestIncome = formData.receiveType === 'interest';
      
      if (vaultEntry && formData.vault !== 'crypto') {
         vaultEntry.title = isInterestIncome ? `Interest/Profit from ${party.name}` : `Capital Return from ${party.name}`;
         vaultEntry.transferType = isInterestIncome ? 'Income' : 'Repayment/Receive';
      }
      
      if (isInterestIncome) {
        ledgerEntry.note = "(Interest/Penalty Received) " + formData.note;
      } else {
        ledgerEntry.note = "(Capital Returned) " + formData.note;
      }
    } else if (activeModal === 'interest') {
      newNetBalance += baseValue;
      const exactDays = Math.round((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 3600 * 24));
      const methodText = formData.interestMethod === 'compound' ? 'Compound' : 'Simple';
      ledgerEntry.note = formData.note || `Penalty / Interest @ ${formData.interestRate}% (${formData.interestType}, ${methodText}) for ${exactDays} Days (${formData.startDate} to ${formData.endDate})`;
    }

    try {
      const updates = { 
        netBalance: newNetBalance, 
        status: newNetBalance === 0 ? 'settled' : 'active' 
      };

      if (activeModal === 'emi_payment' && party.emiDueDate) {
        const nextDueDate = new Date(party.emiDueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1); 
        updates.emiDueDate = nextDueDate.toISOString().split('T')[0];
      }

      await setDoc(doc(db, "users", user.uid, "parties", party.id), updates, { merge: true });
      await addDoc(collection(db, "users", user.uid, "parties", party.id, "ledger"), ledgerEntry);
      
      if (vaultEntry && activeModal !== 'interest') {
        await addDoc(collection(db, "users", user.uid, vaultCol), vaultEntry);
        
        if (activeModal === 'emi_payment') {
            await addDoc(collection(db, "users", user.uid, "expenseLogs"), {
              title: `EMI Paid: ${party.name}`,
              category: "Bills & Utilities", 
              vault: formData.vault,
              subWallet: formData.subWallet.trim(),
              cryptoPlatform: formData.vault === 'crypto' ? formData.cryptoPlatform.trim() : '',
              asset: formData.currency,
              amount: parseFloat(formData.amount),
              exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
              finalBaseAmount: baseValue,
              date: formattedDate,
              timestamp,
              linkedExpenseId: linkId,
              linkId: linkId,
              isSplit: false
            });
        }
      }

      if (activeModal === 'receive' && formData.receiveType === 'interest') {
        await addDoc(collection(db, "users", user.uid, "incomeLogs"), {
          title: `Interest/Profit from ${party.name}`,
          category: "Investments & Interest",
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          exchangeRate: isForeign ? parseFloat(formData.exchangeRate) : 1,
          finalBaseAmount: baseValue,
          vault: formData.vault,
          subWallet: formData.subWallet.trim(),
          cryptoPlatform: formData.vault === 'crypto' ? formData.cryptoPlatform.trim() : '',
          date: formattedDate,
          timestamp,
          linkId: linkId,
          isSplit: false
        });
      }

      closeModal();
    } catch (error) {
      alert("Transaction Failed!");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSettlement = async (type) => {
    if (!user || !party) return;
    if (party.netBalance === 0) return alert("Account is already at zero balance.");

    setIsProcessing(true);
    const timestamp = new Date().getTime();
    const formattedDate = new Date().toISOString().split('T')[0];

    try {
      if (type === 'settle') {
        await addDoc(collection(db, "users", user.uid, "parties", party.id, "ledger"), {
          type: 'settled', amount: 0, baseAmount: 0, note: 'Account Settled / Adjusted', date: formattedDate, timestamp, linkId: `SETTLE_${timestamp}`
        });
        await setDoc(doc(db, "users", user.uid, "parties", party.id), { netBalance: 0, status: 'settled' }, { merge: true });

      } else if (type === 'writeoff') {
        const linkId = `WRITEOFF_${timestamp}`;
        if (party.netBalance > 0) {
          await addDoc(collection(db, "users", user.uid, "expenseLogs"), {
            title: `Bad Debt Write-off: ${party.name}`,
            category: "Other Expenses",
            asset: baseCurrency,
            amount: party.netBalance,
            exchangeRate: 1,
            finalBaseAmount: party.netBalance,
            date: formattedDate,
            timestamp,
            vault: 'cash',
            subWallet: '',
            isSplit: false,
            linkId: linkId
          });
        }
        await addDoc(collection(db, "users", user.uid, "parties", party.id, "ledger"), {
          type: 'writeoff', amount: 0, baseAmount: 0, note: 'Marked as Bad Debt / Forgiven', date: formattedDate, timestamp, linkId: linkId
        });
        await setDoc(doc(db, "users", user.uid, "parties", party.id), { netBalance: 0, status: 'bad_debt' }, { merge: true });
      }
      closeModal();
    } catch (error) {
      alert("Settlement Failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const openModal = (type) => {
    setActiveModal(type);
    setIsMenuOpen(false); 
    const lastVaultName = existingVaultNames.length > 0 ? existingVaultNames[0] : '';
    const nowTime = getLocalDateTimeString();
    
    if (type === 'emi_payment' && party) {
      setFormData({
         amount: party.emiAmount || '', currency: baseCurrency, exchangeRate: 1, vault: 'bank', subWallet: lastVaultName, 
         cryptoPlatform: availableCryptos[0] || 'BTC', isCustomPlatform: false, note: 'Monthly Installment Paid', 
         purpose: 'EMI', datetime: nowTime, receiveType: 'principal',
         interestPrincipal: '', interestRate: '', interestType: 'monthly', interestMethod: 'simple', startDate: todayDate, endDate: todayDate
      });
    } else {
      setFormData({ 
        amount: '', currency: baseCurrency, exchangeRate: 1, vault: 'bank', subWallet: lastVaultName, 
        cryptoPlatform: availableCryptos[0] || 'BTC', isCustomPlatform: false, note: '', 
        purpose: 'Friendly Support (0% Interest)', 
        datetime: nowTime, receiveType: 'principal',
        interestPrincipal: party ? Math.abs(party.netBalance).toString() : '', 
        interestRate: '', interestType: 'monthly', interestMethod: 'simple', startDate: todayDate, endDate: todayDate
      });
    }
  };
  
  const closeModal = () => setActiveModal(null);

  if (isLoading || !party) {
    return (
      <div className="w-full h-auto flex flex-col items-center justify-center py-32 px-4">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
          <HiOutlineRefresh className="animate-spin text-4xl text-blue-500 relative" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-4 animate-pulse text-center">Loading Account Details...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] md:h-[calc(100dvh-80px)] max-w-4xl mx-auto bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 md:rounded-[2.5rem] border-x md:border border-slate-200 dark:border-slate-800 shadow-2xl relative md:my-8 overflow-hidden">
      
      {/* 🚀 MOBILE OPTIMIZED HEADER - Stack layout on mobile */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-3 sm:p-4 md:p-6 z-[100] shadow-sm shrink-0 relative">
        <div className="flex flex-col gap-3">
          
          {/* Top Row: Back button, Avatar, Name */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => navigate('/dashboard/parties')} 
              className="p-2 sm:p-2.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm shrink-0"
              aria-label="Go back"
            >
              <HiOutlineArrowLeft size={18} className="sm:w-5 sm:h-5" />
            </button>
            
            <div className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl shadow-lg shrink-0 ${
              party.status === 'bad_debt' ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white' : 
              party.accountType === 'loan' ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white' : 
              'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'
            }`}>
              {party.accountType === 'loan' ? <FaUniversity className="text-base sm:text-lg" /> : <FaUserCircle className="text-base sm:text-lg" />}
              {party.status === 'active' && party.netBalance !== 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
              )}
            </div>
            
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg md:text-2xl font-black text-slate-900 dark:text-white capitalize tracking-tight truncate">
                {party.name}
              </h2>
              <div className="flex items-center gap-2 text-[9px] sm:text-xs font-bold text-slate-500 mt-0.5 truncate">
                {party.phone && <span className="flex items-center gap-1 shrink-0"><FaPhoneAlt size={9} className="sm:w-2.5 sm:h-2.5" /> {party.phone}</span>}
                {party.accountType === 'loan' && (
                  <span className="inline-flex bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-1.5 sm:px-2 py-0.5 rounded uppercase tracking-widest shrink-0 border border-indigo-200 dark:border-indigo-500/30 text-[8px] sm:text-[10px]">
                    Loan / EMI
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Bottom Row: Export & Balance - Side by side on mobile */}
          <div className="flex items-stretch gap-2 sm:gap-3">
            
            {/* Export Button with dropdown */}
            <div className="relative flex-1 sm:flex-none z-[9999]">
              <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
                className="w-full h-full flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black text-[10px] sm:text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm"
              >
                <HiOutlineDownload size={16} className="sm:w-[18px] sm:h-[18px]"/> 
                <span className="hidden sm:inline">Export</span>
              </button>
              {isExportMenuOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 sm:right-0 sm:left-auto w-44 sm:w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col p-1.5 z-[9999] animate-in fade-in zoom-in-95">
                  <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-700 text-slate-200 text-[10px] font-black rounded-lg transition-colors text-left">
                    <HiOutlineDocumentText className="text-rose-400" size={16}/> PDF Document
                  </button>
                  <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-700 text-slate-200 text-[10px] font-black rounded-lg transition-colors text-left">
                    <HiOutlineTable className="text-emerald-400" size={16}/> Excel (CSV)
                  </button>
                </div>
              )}
            </div>

            {/* Balance Box */}
            <div className={`flex-1 sm:flex-none text-right p-2.5 sm:p-3 rounded-xl border shadow-sm flex flex-col justify-center items-end min-w-0 ${
              party.status === 'bad_debt' ? 'bg-rose-50 border-rose-300 dark:bg-rose-900/20 dark:border-rose-700/30' : 
              'bg-slate-50 border-slate-300 dark:bg-slate-800 dark:border-slate-700'
            }`}>
              <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5 sm:mb-1 truncate w-full text-right">
                 {party.accountType === 'loan' ? 'Remaining' : (party.netBalance > 0 ? 'To Receive' : party.netBalance < 0 ? 'To Pay' : 'Settled')}
              </p>
              <p className={`text-base sm:text-lg md:text-xl font-black tracking-tight truncate w-full text-right ${
                party.status === 'bad_debt' ? 'text-rose-700 dark:text-rose-400' : 
                party.netBalance > 0 ? 'text-emerald-700 dark:text-emerald-400' : 
                party.netBalance < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'
              }`} title={`${currencySymbol}${Math.abs(party.netBalance)}`}>
                 {currencySymbol}{Math.abs(party.netBalance).toLocaleString(undefined, {minimumFractionDigits: isMobile ? 0 : 2})}
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* 🚀 EMI Info Bar - Mobile optimized */}
      {party.accountType === 'loan' && party.netBalance !== 0 && (
         <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800/50 p-3 sm:p-4 md:p-6 z-[90] shrink-0 relative">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              
              {/* EMI Details - Horizontal on all screens */}
              <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                 <div className="min-w-0 flex-1 sm:flex-initial">
                    <p className="text-[9px] sm:text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">EMI Amount</p>
                    <p className="text-base sm:text-lg md:text-xl font-black text-indigo-800 dark:text-indigo-300 mt-0.5 truncate">{currencySymbol}{Number(party.emiAmount).toLocaleString()}</p>
                 </div>
                 
                 <div className="w-px h-8 sm:h-10 bg-indigo-200 dark:bg-indigo-800/50 shrink-0" />
                 
                 <div className="min-w-0 flex-1 sm:flex-initial text-right sm:text-left">
                    <p className="text-[9px] sm:text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Next Due</p>
                    <p className="text-xs sm:text-sm md:text-base font-black text-indigo-800 dark:text-indigo-300 flex items-center justify-end sm:justify-start gap-1 mt-0.5 truncate">
                      <HiOutlineCalendar size={12} className="sm:w-3.5 sm:h-3.5 shrink-0"/> 
                      {formatGlobalDate ? formatGlobalDate(party.emiDueDate, 'short') : party.emiDueDate}
                    </p>
                 </div>
              </div>

              <button 
                onClick={() => openModal('emi_payment')} 
                className="w-full sm:w-auto px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex justify-center items-center gap-2 shrink-0"
              >
                <FaUniversity size={14} /> Pay EMI
              </button>

           </div>
         </div>
      )}

      {/* 🚀 Chat Ledger Area - Adjusted padding for mobile */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-8 pt-6 sm:pt-8 md:pt-10 space-y-4 sm:space-y-6 custom-scrollbar min-h-[50vh] bg-slate-50/50 dark:bg-slate-900/50 z-[10] relative">
        <div className="text-center mt-4 mb-6 sm:mt-6 sm:mb-8">
           <span className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 sm:px-4 md:px-5 py-2 md:py-2.5 rounded-full shadow-sm inline-flex items-center gap-2">
             <FaHistory size={12} className="shrink-0" />
             Ledger created {formatGlobalDate ? formatGlobalDate(party.createdAt, 'short') : new Date(party.createdAt).toLocaleDateString()}
           </span>
        </div>

        {ledger.map((entry) => {
          const isCenter = entry.type === 'settled' || entry.type === 'writeoff' || (entry.type === 'opening_balance' && entry.baseAmount === 0);

          if (isCenter) {
            return <SystemMessage key={entry.id} entry={entry} onDelete={initiateDelete} />;
          }

          const isRight = entry.type === 'give' || entry.type === 'interest' || (entry.type === 'opening_balance' && entry.baseAmount > 0) || entry.type === 'emi_payment';
          
          return (
            <ChatBubble 
              key={entry.id}
              entry={entry}
              isRight={isRight}
              currencySymbol={currencySymbol}
              baseCurrency={baseCurrency}
              formatGlobalDate={formatGlobalDate}
              onDelete={initiateDelete}
            />
          );
        })}
        <div ref={chatEndRef} className="h-4 sm:h-6" />
      </div>

      {/* Action Footer - Mobile optimized */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 md:p-5 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_-5px_20px_rgba(0,0,0,0.15)] z-[100] relative">
        
        {party.status === 'bad_debt' || party.status === 'settled' ? (
          <div className="text-center p-3 sm:p-4 md:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-inner">
             <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto mb-2 sm:mb-3 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700">
               {party.status === 'settled' ? <FaCheckCircle className="text-emerald-500" size={isMobile ? 16 : 20} /> : <FaTimesCircle className="text-rose-500" size={isMobile ? 16 : 20} />}
             </div>
             <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Account Closed</p>
             <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 mb-3 sm:mb-4">Add a new transaction to reopen this account</p>
             <button onClick={() => openModal('give')} className="text-[9px] sm:text-[10px] md:text-xs font-black text-white bg-blue-600 hover:bg-blue-700 px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl transition-colors shadow-md">
               Reopen Account
             </button>
          </div>
        ) : (
          <div className="flex gap-2 sm:gap-3 max-w-2xl mx-auto">
            {party.accountType === 'loan' ? (
              <button 
                onClick={() => openModal('emi_payment')} 
                className="flex-1 py-2.5 sm:py-3 md:py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-black text-[9px] sm:text-[10px] md:text-sm uppercase tracking-widest flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 shadow-xl shadow-indigo-500/30 active:scale-[0.98] transition-all"
              >
                <FaUniversity size={14} className="sm:w-4 sm:h-4 shrink-0" /> Pay EMI
              </button>
            ) : (
              <>
                <button 
                  onClick={() => openModal('give')} 
                  className="flex-1 py-2.5 sm:py-3 md:py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-2xl font-black text-[9px] sm:text-[10px] md:text-xs lg:text-sm uppercase tracking-widest flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 shadow-xl shadow-rose-500/30 active:scale-[0.98] transition-all"
                >
                  <FaArrowUp size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" /> Give
                </button>
                <button 
                  onClick={() => openModal('receive')} 
                  className="flex-1 py-2.5 sm:py-3 md:py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black text-[9px] sm:text-[10px] md:text-xs lg:text-sm uppercase tracking-widest flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 shadow-xl shadow-emerald-500/30 active:scale-[0.98] transition-all"
                >
                  <FaArrowDown size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" /> Receive
                </button>
              </>
            )}
            
            <div className="relative shrink-0">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className={`h-full px-2.5 sm:px-3 md:px-5 rounded-2xl font-black flex items-center justify-center shadow-lg transition-all border-2 ${
                  isMenuOpen 
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600' 
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                aria-label="More options"
              >
                <HiOutlineDotsVertical size={18} className="sm:w-5 sm:h-5" />
              </button>
              
              {isMenuOpen && (
                <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)}></div>
              )}

              <div className={`absolute bottom-full right-0 mb-2 sm:mb-3 w-44 sm:w-48 md:w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl transition-all duration-200 p-1.5 sm:p-2 flex flex-col gap-0.5 sm:gap-1 z-40 origin-bottom-right ${
                isMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              }`}>
                
                {party.accountType !== 'loan' && (
                  <button 
                    onClick={() => openModal('interest')} 
                    className="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-[11px] md:text-xs flex items-center gap-2 sm:gap-3 transition-colors"
                  >
                    <FaPercent size={12} className="sm:w-3.5 sm:h-3.5"/> Charge Interest
                  </button>
                )}
                
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5 sm:my-1" />
                
                <button 
                  onClick={() => setActiveModal('settle')} 
                  className="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] sm:text-[11px] md:text-xs flex items-center gap-2 sm:gap-3 transition-colors"
                >
                  <HiOutlineCheckCircle size={16} className="sm:w-[18px] sm:h-[18px] text-emerald-500"/> Settle (0)
                </button>
                
                <button 
                  onClick={() => setActiveModal('writeoff')} 
                  className="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px] sm:text-[11px] md:text-xs flex items-center gap-2 sm:gap-3 transition-colors"
                >
                  <HiOutlineExclamationCircle size={16} className="sm:w-[18px] sm:h-[18px]"/> Write-off
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modal - Full screen on mobile, centered on desktop */}
      {activeModal && activeModal !== 'settle' && activeModal !== 'writeoff' && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2rem] sm:rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 border border-slate-300 dark:border-slate-800 flex flex-col max-h-[95dvh] md:max-h-[90dvh]">
            
            <div className={`px-4 sm:px-5 md:px-6 py-3 sm:py-4 md:py-5 flex justify-between items-center text-white shrink-0 ${
              activeModal === 'give' ? 'bg-gradient-to-r from-rose-600 to-pink-600' : 
              activeModal === 'receive' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 
              activeModal === 'emi_payment' ? 'bg-gradient-to-r from-indigo-600 to-blue-600' : 
              'bg-gradient-to-r from-blue-600 to-cyan-600'
            }`}>
              <h3 className="text-lg sm:text-xl font-black flex items-center gap-2">
                {activeModal === 'give' && <><FaArrowUp size={16} className="sm:w-[18px] sm:h-[18px]"/> Give Money</>}
                {activeModal === 'receive' && <><FaArrowDown size={16} className="sm:w-[18px] sm:h-[18px]"/> Receive Money</>}
                {activeModal === 'emi_payment' && <><FaUniversity size={16} className="sm:w-[18px] sm:h-[18px]"/> Pay EMI</>}
                {activeModal === 'interest' && <><FaPercent size={16} className="sm:w-[18px] sm:h-[18px]"/> Interest</>}
              </h3>
              <button onClick={closeModal} className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors" aria-label="Close modal">
                <HiOutlineX size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
            
            <form onSubmit={handleTransaction} className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {activeModal === 'interest' ? (
                <div className="space-y-3 sm:space-y-4 bg-blue-50 dark:bg-blue-900/10 p-4 sm:p-5 rounded-2xl border border-blue-300 dark:border-blue-800/50 shadow-sm">
                  <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-blue-300 dark:border-blue-800 shadow-sm">
                    <label className={`flex-1 p-2.5 sm:p-3 rounded-lg text-center cursor-pointer font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all ${
                      formData.interestMethod === 'simple' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}>
                      <input type="radio" name="intMethod" className="hidden" checked={formData.interestMethod === 'simple'} onChange={() => setFormData({...formData, interestMethod: 'simple'})} />
                      Simple
                    </label>
                    <label className={`flex-1 p-2.5 sm:p-3 rounded-lg text-center cursor-pointer font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all ${
                      formData.interestMethod === 'compound' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}>
                      <input type="radio" name="intMethod" className="hidden" checked={formData.interestMethod === 'compound'} onChange={() => setFormData({...formData, interestMethod: 'compound'})} />
                      Compound
                    </label>
                  </div>
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest ml-1">Principal</label>
                    <input type="number" required value={formData.interestPrincipal} onChange={(e) => setFormData({...formData, interestPrincipal: e.target.value})} 
                      className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm text-sm sm:text-base" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="text-[9px] sm:text-[10px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest ml-1">Rate (%)</label>
                      <input type="number" step="any" required value={formData.interestRate} onChange={(e) => setFormData({...formData, interestRate: e.target.value})} 
                        className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm text-sm sm:text-base" />
                    </div>
                    <div>
                      <label className="text-[9px] sm:text-[10px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest ml-1">Type</label>
                      <select value={formData.interestType} onChange={(e) => setFormData({...formData, interestType: e.target.value})} 
                        className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm text-sm sm:text-base">
                        <option value="monthly">Per Month</option>
                        <option value="yearly">Per Year</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="text-[9px] sm:text-[10px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1 ml-1"><HiOutlineCalendar size={12}/> From</label>
                      <input type="date" required value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
                        className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm text-sm sm:text-base" />
                    </div>
                    <div>
                      <label className="text-[9px] sm:text-[10px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1 ml-1"><HiOutlineCalendar size={12}/> To</label>
                      <input type="date" required value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                        className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm text-sm sm:text-base" />
                    </div>
                  </div>
                  
                  <div className="pt-3 sm:pt-4 border-t border-blue-300 dark:border-blue-800 flex justify-between items-end">
                    <span className="text-xs font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest">Final Interest:</span>
                    <span className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-300">
                      {currencySymbol}{formData.amount || '0.00'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="sm:w-1/3">
                    <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                      className="w-full p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm transition-colors text-sm sm:text-base">
                      <option value={baseCurrency}>{baseCurrency}</option>
                      <optgroup label="Fiat">
                        {availableFiats.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                      <optgroup label="Crypto">
                        {availableCryptos.map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <input type="number" required step="any" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="Amount" 
                    className={`flex-1 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-xl sm:text-2xl outline-none focus:ring-2 shadow-sm transition-colors ${
                      activeModal === 'give' ? 'text-rose-600 dark:text-rose-400 focus:ring-rose-500/50 placeholder-rose-300 dark:placeholder-slate-500' :
                      activeModal === 'receive' ? 'text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500/50 placeholder-emerald-300 dark:placeholder-slate-500' :
                      'text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500/50 placeholder-indigo-300 dark:placeholder-slate-500'
                    }`} />
                </div>
              )}

              {activeModal === 'give' && (
                <div>
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Purpose</label>
                  <select value={formData.purpose} onChange={(e) => setFormData({...formData, purpose: e.target.value})} 
                    className="w-full p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer shadow-sm transition-colors text-sm sm:text-base">
                    <option value="Friendly Support (0% Interest)">Friendly Support (0% Interest)</option>
                    <option value="Business Loan (Fixed Interest)">Business Loan (Fixed Interest)</option>
                    <option value="Conditional (Free for limited time)">Conditional (Free for limited time)</option>
                    <option value="Investment / Trade Advance">Investment / Trade Advance</option>
                    <option value="Emergency Funds">Emergency Funds</option>
                  </select>
                </div>
              )}

              {activeModal === 'receive' && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <label className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center text-center gap-1 transition-all shadow-sm ${
                    formData.receiveType === 'principal' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}>
                    <input type="radio" name="recType" className="hidden" checked={formData.receiveType === 'principal'} onChange={() => setFormData({...formData, receiveType: 'principal'})} />
                    <span className={`font-black text-xs sm:text-sm ${formData.receiveType === 'principal' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>Capital</span>
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-500">Reduces balance</span>
                  </label>
                  <label className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center text-center gap-1 transition-all shadow-sm ${
                    formData.receiveType === 'interest' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}>
                    <input type="radio" name="recType" className="hidden" checked={formData.receiveType === 'interest'} onChange={() => setFormData({...formData, receiveType: 'interest'})} />
                    <span className={`font-black text-xs sm:text-sm ${formData.receiveType === 'interest' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>Interest</span>
                    <span className="text-[8px] sm:text-[9px] font-bold text-blue-500 dark:text-blue-400">Adds to income</span>
                  </label>
                </div>
              )}

              {isForeign && activeModal !== 'interest' && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] sm:text-xs font-black text-slate-700 dark:text-slate-400 shrink-0 flex items-center gap-2"><FaExchangeAlt size={12}/> Rate:</span>
                  <div className="flex items-center gap-2 flex-1 w-full">
                    <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">1 {formData.currency} =</span>
                    <input type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} 
                      className="flex-1 w-full min-w-0 p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-900 dark:text-white outline-none text-xs sm:text-sm shadow-sm transition-colors focus:ring-2 focus:ring-blue-500/50" />
                    <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">{baseCurrency}</span>
                  </div>
                  <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="w-full sm:w-auto text-[9px] sm:text-[10px] font-black bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center shrink-0 uppercase tracking-widest">
                    <HiOutlineRefresh className={`${isFetchingRate ? 'animate-spin' : ''} sm:w-3.5 sm:h-3.5`} size={12} /> Live
                  </button>
                </div>
              )}

              {activeModal !== 'interest' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Vault Impact</label>
                    <div className="relative mt-1">
                      <select value={formData.vault} onChange={(e) => setFormData({...formData, vault: e.target.value, subWallet: ''})} 
                        className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none shadow-sm transition-colors text-sm sm:text-base">
                        <option value="bank">Bank Account</option>
                        <option value="cash">Physical Cash</option>
                        <option value="online">Online Wallet</option>
                        <option value="crypto">Crypto Engine</option>
                      </select>
                      <HiOutlineChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none sm:w-5 sm:h-5" size={18} />
                    </div>
                  </div>
                  {(formData.vault === 'bank' || formData.vault === 'online') && (
                    <div className="animate-in fade-in mt-1 sm:mt-0">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">
                        {formData.vault === 'bank' ? 'Bank Name' : 'Wallet Name'}
                      </label>
                      <input type="text" list="sub-wallets-party" required value={formData.subWallet} onChange={(e) => setFormData({...formData, subWallet: e.target.value})} 
                        placeholder={formData.vault === 'bank' ? "e.g., SBI" : "e.g., PayPal"} 
                        className="w-full mt-1 p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm placeholder-slate-400 transition-colors text-sm sm:text-base" />
                      <datalist id="sub-wallets-party">
                        {existingVaultNames.map(b => <option key={b} value={b} />)}
                      </datalist>
                    </div>
                  )}

                  {formData.vault === 'crypto' && (
                    <div className="animate-in fade-in mt-1 sm:mt-0">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                      {formData.isCustomPlatform ? (
                        <div className="flex gap-2 mt-1">
                          <input type="text" required value={formData.cryptoPlatform} onChange={(e)=>setFormData({...formData, cryptoPlatform: e.target.value})} className="flex-1 p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm transition-colors focus:ring-2 focus:ring-blue-500/50 text-sm sm:text-base" />
                          <button type="button" onClick={()=>setFormData({...formData, isCustomPlatform: false, cryptoPlatform: cryptoPlatformsList[0] || 'BTC'})} className="px-3 sm:px-4 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm border border-slate-300 dark:border-slate-600"><HiOutlineX size={18}/></button>
                        </div>
                      ) : (
                        <div className="relative mt-1">
                          <select value={cryptoPlatformsList.includes(formData.cryptoPlatform) ? formData.cryptoPlatform : 'CUSTOM'} onChange={(e) => { if(e.target.value==='CUSTOM'){setFormData({...formData, isCustomPlatform: true, cryptoPlatform: ''})} else {setFormData({...formData, cryptoPlatform: e.target.value})} }} className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none cursor-pointer appearance-none shadow-sm transition-colors focus:ring-2 focus:ring-blue-500/50 text-sm sm:text-base">
                            {cryptoPlatformsList.map(p => <option key={p} value={p}>{p}</option>)}
                            <option value="CUSTOM">✨ Custom Platform</option>
                          </select>
                          <HiOutlineChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none sm:w-5 sm:h-5" size={18} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[9px] sm:text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Date & Time</label>
                <input type="datetime-local" required value={formData.datetime} onChange={(e) => setFormData({...formData, datetime: e.target.value})} 
                  className="w-full mt-1 p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-colors cursor-pointer text-sm sm:text-base" />
              </div>

              <div>
                <label className="text-[9px] sm:text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Note (Optional)</label>
                <textarea rows="2" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="Any additional remarks..." 
                  className="w-full mt-1 p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 resize-none shadow-sm placeholder-slate-400 transition-colors text-sm sm:text-base" />
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
                <button type="submit" disabled={isProcessing || (activeModal === 'interest' && !formData.amount)} className={`w-full p-3 sm:p-4 bg-gradient-to-r hover:to-cyan-700 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 active:scale-95 ${
                  activeModal === 'give' ? 'from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-500/30' : 
                  activeModal === 'receive' ? 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/30' : 
                  activeModal === 'emi_payment' ? 'from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/30' : 
                  'from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-500/30'
                }`}>
                  {isProcessing && <HiOutlineRefresh className="animate-spin text-lg sm:text-xl" />}
                  {isProcessing ? 'Processing...' : activeModal === 'interest' ? 'Apply Interest' : activeModal === 'emi_payment' ? 'Confirm EMI' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Mobile optimized */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-700 flex flex-col">
            <div className="px-4 sm:px-5 md:px-6 py-4 sm:py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <HiOutlineShieldCheck size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black">Security Verification</h3>
                  <p className="text-[10px] sm:text-xs text-white/70">Enter PIN to confirm deletion</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={executeSecureDelete} className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
              <div className="p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl">
                <p className="text-[10px] sm:text-xs font-bold text-amber-800 dark:text-amber-300">
                  Deleting this transaction will reverse all associated vault entries automatically.
                </p>
              </div>
              
              <div>
                <label className="text-[9px] sm:text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Security PIN</label>
                <input 
                  type="password" maxLength={6} required autoFocus
                  value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.3em] text-lg sm:text-xl p-3 sm:p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm focus:border-rose-500"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                {pinError && <p className="text-[10px] sm:text-xs font-bold text-rose-700 dark:text-rose-400 mt-2 text-center">{pinError}</p>}
              </div>

              <div className="flex gap-2 sm:gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-3 sm:p-4 rounded-xl font-black text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm">
                  Cancel
                </button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-3 sm:p-4 rounded-xl font-black text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-lg shadow-rose-500/30 active:scale-95 flex justify-center items-center gap-2 text-xs sm:text-sm">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={16} /> : null}
                  Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settlement/Write-off Modal - Mobile optimized */}
      {(activeModal === 'settle' || activeModal === 'writeoff') && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl p-5 sm:p-6 md:p-8 text-center border border-slate-300 dark:border-slate-700">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl flex items-center justify-center text-3xl sm:text-4xl mb-4 sm:mb-6 shadow-inner border border-slate-200 dark:border-slate-700 ${
              activeModal === 'settle' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
            }`}>
              {activeModal === 'settle' ? <HiOutlineCheckCircle /> : <HiOutlineExclamationCircle />}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 sm:mb-3">
              {activeModal === 'settle' ? 'Settle Account?' : 'Declare Bad Debt?'}
            </h3>
            <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 mb-6 sm:mb-8 leading-relaxed">
              {activeModal === 'settle' 
                ? 'This will mark the net balance as ZERO. Use this if you settled the debt outside.' 
                : `This will mark ${currencySymbol}${Math.abs(party.netBalance).toLocaleString()} as a LOSS. The account will be closed.`}
            </p>
            <div className="flex gap-2 sm:gap-3">
              <button onClick={closeModal} className="flex-1 py-3 sm:py-4 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-xl font-black text-xs sm:text-sm transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 shadow-sm">
                Cancel
              </button>
              <button onClick={() => handleSettlement(activeModal)} disabled={isProcessing} className={`flex-1 py-3 sm:py-4 text-white rounded-xl font-black text-xs sm:text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                activeModal === 'settle' ? 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 shadow-slate-500/30' : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-500/30'
              }`}>
                {isProcessing ? <HiOutlineRefresh className="animate-spin" size={16}/> : null}
                {isProcessing ? 'Processing' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PartyLedger;