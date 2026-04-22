import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { collection, doc, onSnapshot, setDoc, addDoc, query, orderBy, deleteDoc, getDocs, where, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineExclamationCircle, 
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineX, HiOutlineRefresh,
  HiOutlineCalendar, HiOutlineTrash, HiOutlineInformationCircle, HiOutlineTag,
  HiOutlineChevronDown, HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineLockClosed, HiOutlineShieldCheck, HiOutlinePhone, HiOutlineMail,
  HiOutlineDotsVertical, HiOutlinePaperAirplane, HiOutlineCash, HiOutlineUser
} from 'react-icons/hi';
import { 
  FaUserCircle, FaMoneyBillWave, FaUniversity, FaWallet, FaPercent, 
  FaArrowUp, FaArrowDown, FaBuilding, FaGem, FaHistory, FaCheckCircle,
  FaTimesCircle, FaExclamationTriangle, FaPhoneAlt, FaChevronRight, FaBitcoin
} from 'react-icons/fa';

const fiatCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// 🚀 Premium Chat Bubble Component
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

  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300 group`}>
      <div className={`relative min-w-[60%] max-w-[85%] md:max-w-[65%] p-4 rounded-[1.5rem] shadow-md border backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${getBubbleStyle()} ${isRight ? 'rounded-br-md' : 'rounded-bl-md'}`}>
        
        {/* Delete Button */}
        <button 
          onClick={() => onDelete(entry)} 
          className={`absolute -top-2 ${isRight ? '-left-2' : '-right-2'} p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100 z-10`}
          title="Delete Entry"
        >
          <HiOutlineTrash size={14} />
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${badge.color}`}>
              {badge.label}
            </span>
            {entry.vault && (
              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-lg">
                {entry.vault === 'bank' ? <FaUniversity size={10}/> : entry.vault === 'cash' ? <FaMoneyBillWave size={10}/> : <FaWallet size={10}/>} 
                {entry.vault}
                {entry.subWallet && <span className="text-blue-500 ml-0.5">• {entry.subWallet}</span>}
              </span>
            )}
          </div>
          <span className="text-[8px] font-medium text-slate-400 whitespace-nowrap flex items-center gap-1">
            <HiOutlineCalendar size={10} />
            {formatGlobalDate ? formatGlobalDate(entry.timestamp, 'short') : new Date(entry.timestamp).toLocaleDateString()}
          </span>
        </div>

        {/* Amount */}
        <div className="flex items-end gap-3 mb-2">
          <p className={`text-2xl md:text-3xl font-black tracking-tight ${isRight ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {isRight ? '-' : '+'}{currencySymbol}{Math.abs(entry.baseAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}
          </p>
          {entry.currency !== baseCurrency && (
            <div className="mb-1">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{entry.amount} {entry.currency}</p>
              <p className="text-[9px] text-slate-400">@ {entry.exchangeRate} rate</p>
            </div>
          )}
        </div>

        {/* Purpose Badge */}
        {entry.purpose && entry.type === 'give' && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300 mb-2">
            <HiOutlineTag size={10} /> {entry.purpose}
          </div>
        )}

        {/* Note */}
        {entry.note && (
          <div className={`p-3 rounded-xl text-xs font-medium leading-relaxed ${isRight ? 'bg-rose-100/50 text-rose-800 dark:text-rose-300' : 'bg-emerald-100/50 text-emerald-800 dark:text-emerald-300'}`}>
            {entry.note}
          </div>
        )}
      </div>
    </div>
  );
};

// 🚀 Premium System Message Component
const SystemMessage = ({ entry, onDelete }) => (
  <div className="flex justify-center my-3 group">
    <div className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all ${
      entry.type === 'writeoff' 
        ? 'bg-gradient-to-r from-rose-100 to-rose-200 text-rose-700 dark:from-rose-900/40 dark:to-rose-800/40 dark:text-rose-300 border border-rose-300 dark:border-rose-700' 
        : 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 dark:from-slate-800 dark:to-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
    }`}>
      {entry.type === 'writeoff' ? <FaExclamationTriangle size={14}/> : <FaCheckCircle size={14}/>}
      {entry.note}
      {entry.type !== 'opening_balance' && (
        <button onClick={() => onDelete(entry)} className="ml-2 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
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
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [existingVaultNames, setExistingVaultNames] = useState([]);

  const localTime = new Date().toISOString().substring(0, 16); 
  const todayDate = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    amount: '', currency: baseCurrency, exchangeRate: 1, vault: 'bank', subWallet: '',
    note: '', purpose: 'Friendly Support (0% Interest)', datetime: localTime,
    receiveType: 'principal', interestPrincipal: '', interestRate: '',
    interestType: 'monthly', interestMethod: 'simple', startDate: todayDate, endDate: todayDate
  });

  // 🚀 DYNAMIC ASSET LISTS FOR THIS PAGE
  const availableFiats = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);
  const availableCryptos = useMemo(() => {
    const customSymbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    return Array.from(new Set(["USDT", ...customSymbols])).map(s => s.toUpperCase());
  }, [selectedCryptos]);

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

      if (availableFiats.includes(formData.currency) || fiatCurrencies.includes(formData.currency)) {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
        const data = await res.json();
        if (data.rates[baseCurrency]) setFormData(prev => ({ ...prev, exchangeRate: data.rates[baseCurrency].toFixed(4) }));
      } else {
        if (formData.currency === 'USDT' || formData.currency === 'USDC') {
          setFormData(prev => ({ ...prev, exchangeRate: usdToBase.toFixed(4) }));
        } else {
          const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${formData.currency}USDT`);
          if (bRes.ok) {
            const bData = await bRes.json();
            const finalRate = parseFloat(bData.price) * usdToBase;
            setFormData(prev => ({ ...prev, exchangeRate: finalRate.toFixed(4) }));
          } else {
            alert(`Live rate for ${formData.currency} is not available. Please enter manually.`);
          }
        }
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
    if (ledger.length === 0) return alert("No transactions to download.");

    const reportData = ledger.map(entry => {
      let action = 'Opening Balance';
      if (entry.type === 'give') action = 'Given (-)';
      if (entry.type === 'receive') action = 'Received (+)';
      if (entry.type === 'interest') action = 'Interest Added';
      if (entry.type === 'settled') action = 'Settled';
      if (entry.type === 'emi_payment') action = 'EMI Paid'; 

      let cleanNote = (entry.note || entry.purpose || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");

      return {
        date: formatGlobalDate ? formatGlobalDate(entry.date, 'full') : entry.date,
        action: action,
        amount: `${currencySymbol}${Math.abs(entry.baseAmount).toFixed(2)}`,
        note: cleanNote
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Transaction Type', key: 'action' },
      { header: 'Amount', key: 'amount' },
      { header: 'Details / Notes', key: 'note' }
    ];

    const fileName = `Khata_${party.name.replace(/\s+/g, '_')}`;
    const reportTitle = `${party.name.toUpperCase()} - Account Ledger`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };
  
  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!user || !party) return;

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
      date: formattedDate,
      timestamp,
      linkId
    };

    let vaultEntry = null;

    if (activeModal === 'emi_payment') {
      newNetBalance += baseValue; 
      ledgerEntry.purpose = 'EMI Installment Paid';
      ledgerEntry.note = "(EMI Paid) " + formData.note;

      vaultEntry = {
        title: `EMI Paid to ${party.name}`,
        type: 'out',
        date: formattedDate,
        timestamp,
        currency: formData.currency,
        foreignAmount: parseFloat(formData.amount),
        exchangeRate: ledgerEntry.exchangeRate,
        finalBaseAmount: baseValue,
        fee: 0,
        walletName: formData.subWallet.trim() || 'Default Wallet',
        bankName: formData.subWallet.trim() || 'Default Bank',
        transferType: 'EMI Payment',
        linkedPartyId: party.id,
        linkId
      };
    } 
    else if (activeModal === 'give') {
      newNetBalance += baseValue;
      ledgerEntry.purpose = formData.purpose; 
      
      vaultEntry = {
        title: `Lent to ${party.name}`,
        type: 'out',
        date: formattedDate,
        timestamp,
        currency: formData.currency,
        foreignAmount: parseFloat(formData.amount),
        exchangeRate: ledgerEntry.exchangeRate,
        finalBaseAmount: baseValue,
        fee: 0,
        walletName: formData.subWallet.trim() || 'Default Wallet',
        bankName: formData.subWallet.trim() || 'Default Bank',
        transferType: 'Lent/Give',
        linkedPartyId: party.id,
        linkId
      };
    } else if (activeModal === 'receive') {
      newNetBalance -= baseValue;
      const isInterestIncome = formData.receiveType === 'interest';
      
      vaultEntry = {
        title: isInterestIncome ? `Interest/Profit from ${party.name}` : `Capital Return from ${party.name}`,
        type: 'in',
        date: formattedDate,
        timestamp,
        currency: formData.currency,
        foreignAmount: parseFloat(formData.amount),
        exchangeRate: ledgerEntry.exchangeRate,
        finalBaseAmount: baseValue,
        fee: 0,
        walletName: formData.subWallet.trim() || 'Default Wallet',
        bankName: formData.subWallet.trim() || 'Default Bank',
        transferType: isInterestIncome ? 'Income' : 'Repayment/Receive',
        linkedPartyId: party.id,
        linkId
      };
      
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
        const vaultCol = formData.vault + 'Wallet'; 
        await addDoc(collection(db, "users", user.uid, vaultCol), vaultEntry);
        
        if (activeModal === 'emi_payment') {
            await addDoc(collection(db, "users", user.uid, "expenseLogs"), {
              title: `EMI Paid: ${party.name}`,
              category: "Bills & Utilities", 
              vault: formData.vault,
              subWallet: formData.subWallet.trim(),
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
    
    if (type === 'emi_payment' && party) {
      setFormData({
         amount: party.emiAmount || '', currency: baseCurrency, exchangeRate: 1, vault: 'bank', subWallet: lastVaultName, note: 'Monthly Installment Paid', 
         purpose: 'EMI', datetime: localTime, receiveType: 'principal',
         interestPrincipal: '', interestRate: '', interestType: 'monthly', interestMethod: 'simple', startDate: todayDate, endDate: todayDate
      });
    } else {
      setFormData({ 
        amount: '', currency: baseCurrency, exchangeRate: 1, vault: 'bank', subWallet: lastVaultName, note: '', 
        purpose: 'Friendly Support (0% Interest)', 
        datetime: localTime, receiveType: 'principal',
        interestPrincipal: party ? Math.abs(party.netBalance).toString() : '', 
        interestRate: '', interestType: 'monthly', interestMethod: 'simple', startDate: todayDate, endDate: todayDate
      });
    }
  };
  
  const closeModal = () => setActiveModal(null);

  if (isLoading || !party) {
    return (
      <div className="w-full h-auto flex flex-col items-center justify-center py-32">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
          <HiOutlineRefresh className="animate-spin text-4xl text-blue-500 relative" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-4 animate-pulse">Loading Account Details...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-0px)] md:h-[calc(100dvh-80px)] max-w-4xl mx-auto bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 md:rounded-[2.5rem] border-x md:border border-slate-200 dark:border-slate-800 shadow-2xl relative md:my-8 overflow-hidden min-h-[90vh]">
      
      {/* Premium Header */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-5 flex items-center justify-between z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard/parties')} 
            className="p-3 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <HiOutlineArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-4">
            <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
              party.status === 'bad_debt' ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white' : 
              party.accountType === 'loan' ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white' : 
              'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'
            }`}>
              {party.accountType === 'loan' ? <FaUniversity /> : <FaUserCircle />}
              {party.status === 'active' && party.netBalance !== 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
              )}
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white capitalize tracking-tight">{party.name}</h2>
                {party.accountType === 'loan' && (
                  <span className="hidden md:inline-flex bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-indigo-200 dark:border-indigo-500/30">
                    Loan
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mt-0.5">
                {party.phone && <span className="flex items-center gap-1"><FaPhoneAlt size={8} /> {party.phone}</span>}
                {party.phone && party.accountType === 'loan' && <span className="text-slate-300 dark:text-slate-600">•</span>}
                {party.accountType === 'loan' && <span>EMI Account</span>}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative group hidden sm:block">
            <button className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm">
              <HiOutlineDownload size={18}/> 
              <span>Export</span>
            </button>
            <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
              <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black rounded-lg">
                <HiOutlineDocumentText className="text-rose-500" size={16}/> PDF
              </button>
              <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black rounded-lg">
                <HiOutlineTable className="text-emerald-500" size={16}/> Excel (CSV)
              </button>
            </div>
          </div>

          <div className={`text-right p-3 rounded-xl border shadow-sm ${
            party.status === 'bad_debt' ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-700/30' : 
            'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
          }`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">
               {party.accountType === 'loan' ? 'Remaining' : (party.netBalance > 0 ? 'To Receive' : party.netBalance < 0 ? 'To Pay' : 'Settled')}
            </p>
            <p className={`text-xl font-black tracking-tight ${
              party.status === 'bad_debt' ? 'text-rose-600 dark:text-rose-400' : 
              party.netBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 
              party.netBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'
            }`}>
               {currencySymbol}{Math.abs(party.netBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </p>
          </div>
        </div>
      </div>

      {/* EMI Info Bar */}
      {party.accountType === 'loan' && party.netBalance !== 0 && (
         <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800/50 px-6 py-4 flex justify-between items-center z-10 shrink-0">
           <div className="flex items-center gap-6">
              <div>
                 <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">EMI Amount</p>
                 <p className="text-base font-black text-indigo-700 dark:text-indigo-300 mt-0.5">{currencySymbol}{Number(party.emiAmount).toLocaleString()}</p>
              </div>
              <div className="w-px h-8 bg-indigo-200 dark:bg-indigo-800" />
              <div>
                 <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Next Due</p>
                 <p className="text-sm font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1 mt-0.5">
                   <HiOutlineCalendar size={14}/> 
                   {formatGlobalDate ? formatGlobalDate(party.emiDueDate, 'short') : party.emiDueDate}
                 </p>
              </div>
           </div>
           <button 
             onClick={() => openModal('emi_payment')} 
             className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center gap-2"
           >
             <FaUniversity size={14} /> Pay EMI
           </button>
         </div>
      )}

      {/* 🚀 FIXED: Double quotes inside inline SVG replaced with properly URL-encoded double quotes (%22) to resolve Vite esbuild JSX parser errors */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 custom-scrollbar min-h-[50vh] bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%239C92AC%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] dark:bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.02%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]">
        
        <div className="text-center mt-2 mb-6">
           <span className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-full shadow-sm inline-flex items-center gap-2">
             <FaHistory size={12} />
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
        <div ref={chatEndRef} className="h-4" />
      </div>

      {/* Action Footer */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-5 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_-5px_20px_rgba(0,0,0,0.15)]">
        {party.status === 'bad_debt' || party.status === 'settled' ? (
          <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
             <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center border border-slate-200 dark:border-slate-700">
               {party.status === 'settled' ? <FaCheckCircle className="text-emerald-500" size={24} /> : <FaTimesCircle className="text-rose-500" size={24} />}
             </div>
             <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Account Closed</p>
             <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 mb-4">Add a new transaction to reopen this account</p>
             <button onClick={() => openModal('give')} className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 px-6 py-2.5 rounded-xl transition-colors shadow-md">
               Reopen Account
             </button>
          </div>
        ) : (
          <div className="flex gap-3 max-w-2xl mx-auto">
            {party.accountType === 'loan' ? (
              <button 
                onClick={() => openModal('emi_payment')} 
                className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/30 active:scale-[0.98] transition-all"
              >
                <FaUniversity size={18}/> Pay EMI
              </button>
            ) : (
              <>
                <button 
                  onClick={() => openModal('give')} 
                  className="flex-1 py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-rose-500/30 active:scale-[0.98] transition-all"
                >
                  <FaArrowUp size={16}/> You Gave
                </button>
                <button 
                  onClick={() => openModal('receive')} 
                  className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 active:scale-[0.98] transition-all"
                >
                  <FaArrowDown size={16}/> You Got
                </button>
              </>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className={`h-full px-5 rounded-2xl font-black flex items-center justify-center shadow-lg transition-all border-2 ${
                  isMenuOpen 
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600' 
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <HiOutlineDotsVertical size={20} />
              </button>
              
              {isMenuOpen && (
                <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)}></div>
              )}

              <div className={`absolute bottom-full right-0 mb-3 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl transition-all duration-200 p-2 flex flex-col gap-1 z-40 origin-bottom-right ${
                isMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              }`}>
                
                {party.accountType !== 'loan' && (
                  <button 
                    onClick={() => openModal('interest')} 
                    className="w-full text-left px-4 py-3.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-3 transition-colors"
                  >
                    <FaPercent size={14}/> Charge Interest
                  </button>
                )}
                
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                
                <button 
                  onClick={() => setActiveModal('settle')} 
                  className="w-full text-left px-4 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-3 transition-colors"
                >
                  <HiOutlineCheckCircle size={18} className="text-emerald-500"/> Mark Settled (0)
                </button>
                
                <button 
                  onClick={() => setActiveModal('writeoff')} 
                  className="w-full text-left px-4 py-3.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-3 transition-colors"
                >
                  <HiOutlineExclamationCircle size={18}/> Bad Debt (Write-off)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      {activeModal && activeModal !== 'settle' && activeModal !== 'writeoff' && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2rem] md:rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90dvh]">
            
            <div className={`px-6 py-5 flex justify-between items-center text-white shrink-0 ${
              activeModal === 'give' ? 'bg-gradient-to-r from-rose-600 to-pink-600' : 
              activeModal === 'receive' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 
              activeModal === 'emi_payment' ? 'bg-gradient-to-r from-indigo-600 to-blue-600' : 
              'bg-gradient-to-r from-blue-600 to-cyan-600'
            }`}>
              <h3 className="text-xl font-black flex items-center gap-2">
                {activeModal === 'give' && <><FaArrowUp size={18}/> Give Money</>}
                {activeModal === 'receive' && <><FaArrowDown size={18}/> Receive Money</>}
                {activeModal === 'emi_payment' && <><FaUniversity size={18}/> Pay EMI</>}
                {activeModal === 'interest' && <><FaPercent size={18}/> Interest Calculator</>}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleTransaction} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {activeModal === 'interest' ? (
                <div className="space-y-4 bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-200 dark:border-blue-800/50 shadow-sm">
                  <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                    <label className={`flex-1 p-3 rounded-lg text-center cursor-pointer font-black text-[10px] uppercase tracking-widest transition-all ${
                      formData.interestMethod === 'simple' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}>
                      <input type="radio" name="intMethod" className="hidden" checked={formData.interestMethod === 'simple'} onChange={() => setFormData({...formData, interestMethod: 'simple'})} />
                      Simple
                    </label>
                    <label className={`flex-1 p-3 rounded-lg text-center cursor-pointer font-black text-[10px] uppercase tracking-widest transition-all ${
                      formData.interestMethod === 'compound' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}>
                      <input type="radio" name="intMethod" className="hidden" checked={formData.interestMethod === 'compound'} onChange={() => setFormData({...formData, interestMethod: 'compound'})} />
                      Compound
                    </label>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest ml-1">Principal</label>
                    <input type="number" required value={formData.interestPrincipal} onChange={(e) => setFormData({...formData, interestPrincipal: e.target.value})} 
                      className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest ml-1">Rate (%)</label>
                      <input type="number" step="any" required value={formData.interestRate} onChange={(e) => setFormData({...formData, interestRate: e.target.value})} 
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest ml-1">Type</label>
                      <select value={formData.interestType} onChange={(e) => setFormData({...formData, interestType: e.target.value})} 
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm">
                        <option value="monthly">Per Month</option>
                        <option value="yearly">Per Year</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1 ml-1"><HiOutlineCalendar size={12}/> From</label>
                      <input type="date" required value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1 ml-1"><HiOutlineCalendar size={12}/> To</label>
                      <input type="date" required value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-blue-200 dark:border-blue-800 flex justify-between items-end">
                    <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Final Interest:</span>
                    <span className="text-2xl font-black text-blue-700 dark:text-blue-300">
                      {currencySymbol}{formData.amount || '0.00'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <div className="w-1/3">
                    <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                      className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm">
                      <option value={baseCurrency}>{baseCurrency}</option>
                      {/* 🚀 STRICT DYNAMIC WATCHLIST CURRENCIES */}
                      <optgroup label="Fiat">
                        {availableFiats.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                      <optgroup label="Crypto">
                        {availableCryptos.map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <input type="number" required step="any" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="Amount" 
                    className="flex-1 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm placeholder-slate-400" />
                </div>
              )}

              {activeModal === 'give' && (
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Purpose</label>
                  <select value={formData.purpose} onChange={(e) => setFormData({...formData, purpose: e.target.value})} 
                    className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer shadow-sm">
                    <option value="Friendly Support (0% Interest)">Friendly Support (0% Interest)</option>
                    <option value="Business Loan (Fixed Interest)">Business Loan (Fixed Interest)</option>
                    <option value="Conditional (Free for limited time)">Conditional (Free for limited time)</option>
                    <option value="Investment / Trade Advance">Investment / Trade Advance</option>
                    <option value="Emergency Funds">Emergency Funds</option>
                  </select>
                </div>
              )}

              {activeModal === 'receive' && (
                <div className="grid grid-cols-2 gap-4">
                  <label className={`p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center text-center gap-1 transition-all shadow-sm ${
                    formData.receiveType === 'principal' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}>
                    <input type="radio" name="recType" className="hidden" checked={formData.receiveType === 'principal'} onChange={() => setFormData({...formData, receiveType: 'principal'})} />
                    <span className={`font-black text-sm ${formData.receiveType === 'principal' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>Capital</span>
                    <span className="text-[9px] font-bold text-slate-500">Reduces balance</span>
                  </label>
                  <label className={`p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center text-center gap-1 transition-all shadow-sm ${
                    formData.receiveType === 'interest' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}>
                    <input type="radio" name="recType" className="hidden" checked={formData.receiveType === 'interest'} onChange={() => setFormData({...formData, receiveType: 'interest'})} />
                    <span className={`font-black text-sm ${formData.receiveType === 'interest' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>Interest</span>
                    <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400">Adds to income</span>
                  </label>
                </div>
              )}

              {isForeign && activeModal !== 'interest' && (
                <div className="flex items-center gap-3 p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-400">Rate: 1 {formData.currency} =</span>
                  <input type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} 
                    className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-900 dark:text-white outline-none text-sm shadow-sm" />
                  <span className="text-xs font-black text-slate-600 dark:text-slate-400">{baseCurrency}</span>
                  <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="text-[10px] font-black bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center">
                    <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={14} />
                  </button>
                </div>
              )}

              {activeModal !== 'interest' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Vault</label>
                    <div className="relative">
                      <select value={formData.vault} onChange={(e) => setFormData({...formData, vault: e.target.value, subWallet: ''})} 
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none shadow-sm">
                        <option value="bank">Bank Account</option>
                        <option value="cash">Physical Cash</option>
                        <option value="online">Online Wallet</option>
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                    </div>
                  </div>
                  {(formData.vault === 'bank' || formData.vault === 'online') && (
                    <div className="animate-in fade-in">
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">
                        {formData.vault === 'bank' ? 'Bank Name' : 'Wallet Name'}
                      </label>
                      <input type="text" list="sub-wallets-party" required value={formData.subWallet} onChange={(e) => setFormData({...formData, subWallet: e.target.value})} 
                        placeholder={formData.vault === 'bank' ? "e.g., SBI" : "e.g., PayPal"} 
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm placeholder-slate-400" />
                      <datalist id="sub-wallets-party">
                        {existingVaultNames.map(b => <option key={b} value={b} />)}
                      </datalist>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Date & Time</label>
                <input type="datetime-local" required value={formData.datetime} onChange={(e) => setFormData({...formData, datetime: e.target.value})} 
                  className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-colors" />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Note (Optional)</label>
                <textarea rows="2" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="Any additional remarks..." 
                  className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 resize-none shadow-sm placeholder-slate-400 transition-colors" />
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2">
                <button type="submit" disabled={isProcessing || (activeModal === 'interest' && !formData.amount)} className={`w-full p-4 rounded-2xl font-black text-white text-lg uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 ${
                  activeModal === 'give' ? 'bg-gradient-to-r from-rose-600 to-pink-600 shadow-rose-500/30' : 
                  activeModal === 'receive' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/30' : 
                  activeModal === 'emi_payment' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 shadow-indigo-500/30' : 
                  'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-blue-500/30'
                }`}>
                  {isProcessing ? <HiOutlineRefresh className="animate-spin" size={20} /> : null}
                  {isProcessing ? 'Processing...' : activeModal === 'interest' ? 'Apply Interest' : activeModal === 'emi_payment' ? 'Confirm EMI' : 'Save Transaction'}
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
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Deleting this entry will reverse the balance from your Khata and refund/deduct the amount from your Vault.
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

      {/* Settlement/Write-off Modal */}
      {(activeModal === 'settle' || activeModal === 'writeoff') && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl p-6 text-center border border-slate-300 dark:border-slate-700">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner ${
              activeModal === 'settle' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20'
            }`}>
              {activeModal === 'settle' ? <HiOutlineCheckCircle size={32}/> : <HiOutlineExclamationCircle size={32}/>}
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              {activeModal === 'settle' ? 'Settle Account?' : 'Declare Bad Debt?'}
            </h3>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-6">
              {activeModal === 'settle' 
                ? 'This will mark the net balance as ZERO. Use this if you settled the debt outside.' 
                : `This will mark ${currencySymbol}${Math.abs(party.netBalance)} as a LOSS. The account will be closed.`}
            </p>
            <div className="flex gap-3">
              <button onClick={closeModal} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black text-sm transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 shadow-sm">
                Cancel
              </button>
              <button onClick={() => handleSettlement(activeModal)} disabled={isProcessing} className={`flex-1 py-4 text-white rounded-xl font-black text-sm transition-colors shadow-lg ${
                activeModal === 'settle' ? 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 shadow-slate-500/30' : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-500/30'
              }`}>
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