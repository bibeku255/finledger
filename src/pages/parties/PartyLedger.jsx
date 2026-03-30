import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
// 🚀 FIXED: Added getDocs, where, getDoc for Secure Delete Sync
import { collection, doc, onSnapshot, setDoc, addDoc, query, orderBy, deleteDoc, getDocs, where, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineExclamationCircle, 
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineX, HiOutlineRefresh,
  HiOutlineCalendar, HiOutlineTrash, HiOutlineInformationCircle, HiOutlineTag,
  HiOutlineChevronDown, HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineLockClosed
} from 'react-icons/hi';
import { FaUserCircle, FaMoneyBillWave, FaUniversity, FaWallet, FaPercent, FaArrowUp, FaArrowDown, FaBuilding } from 'react-icons/fa';

const fiatCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];

// 🚀 SECURE SHA-256 HASHING ALGORITHM
const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const PartyLedger = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // 🚀 ENGINE CONNECTED: Global Date Formatter
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

  // 🔐 Security Delete States
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const localTime = new Date().toISOString().substring(0, 16); 
  const todayDate = new Date().toISOString().split('T')[0];

  // 🚀 FETCH EXISTING BANKS/WALLETS FOR AUTO-SUGGEST
  const [existingVaultNames, setExistingVaultNames] = useState([]);
  useEffect(() => {
     if(!user) return;
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

  const [formData, setFormData] = useState({
    amount: '',
    currency: baseCurrency,
    exchangeRate: 1,
    vault: 'bank', 
    subWallet: '', // 🚀 NEW: SubWallet Field Added
    note: '',
    purpose: 'Friendly Support (0% Interest)', 
    datetime: localTime,
    receiveType: 'principal', 
    interestPrincipal: '',
    interestRate: '',
    interestType: 'monthly', 
    interestMethod: 'simple', 
    startDate: todayDate,
    endDate: todayDate
  });

  const cryptoSymbols = useMemo(() => {
    return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
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

      if (fiatCurrencies.includes(formData.currency)) {
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
            setFormData(prev => ({ ...prev, exchangeRate: (parseFloat(bData.price) * usdToBase).toFixed(4) }));
          } else {
            alert(`Live rate for ${formData.currency} is not available on Binance. Please enter manually.`);
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
        setPinError("Incorrect PIN. Deletion blocked! 🛑");
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
      
      await setDoc(doc(db, "users", user.uid, "parties", party.id), { 
        netBalance: newNetBalance,
        status: newStatus 
      }, { merge: true });

      await deleteDoc(doc(db, "users", user.uid, "parties", party.id, "ledger", entry.id));
      
      if (entry.linkId) {
        const collectionsToCheck = ['bankWallet', 'cashWallet', 'onlineWallet', 'cryptoWalletLogs', 'expenseLogs', 'incomeLogs'];
        for (const colName of collectionsToCheck) {
          const q = query(collection(db, "users", user.uid, colName), where("linkId", "==", entry.linkId));
          const snap = await getDocs(q);
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

    // 🚀 NEW: Validate SubWallet Input
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
      subWallet: activeModal === 'interest' ? null : formData.subWallet.trim(), // 🚀 Saved to ledger
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
        walletName: formData.subWallet.trim() || 'Default Wallet', // 🚀 Accurate Vault Info
        bankName: formData.subWallet.trim() || 'Default Bank',     // 🚀 Accurate Vault Info
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
        walletName: formData.subWallet.trim() || 'Default Wallet', // 🚀 Accurate Vault Info
        bankName: formData.subWallet.trim() || 'Default Bank',     // 🚀 Accurate Vault Info
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
        walletName: formData.subWallet.trim() || 'Default Wallet', // 🚀 Accurate Vault Info
        bankName: formData.subWallet.trim() || 'Default Bank',     // 🚀 Accurate Vault Info
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
              subWallet: formData.subWallet.trim(), // 🚀 To pass to expense logs
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
          subWallet: formData.subWallet.trim(), // 🚀 To pass to income logs
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
          type: 'settled', amount: 0, baseAmount: 0, note: 'Account Settled / Adjusted', date: formattedDate, timestamp
        });
        await setDoc(doc(db, "users", user.uid, "parties", party.id), { netBalance: 0, status: 'settled' }, { merge: true });

      } else if (type === 'writeoff') {
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
            isSplit: false
          });
        }
        await addDoc(collection(db, "users", user.uid, "parties", party.id, "ledger"), {
          type: 'writeoff', amount: 0, baseAmount: 0, note: 'Marked as Bad Debt / Forgiven', date: formattedDate, timestamp
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
    return <div className="p-20 text-center font-bold text-slate-400 animate-pulse">Loading Account Details...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-80px)] max-w-4xl mx-auto bg-slate-50 dark:bg-slate-950/50 md:rounded-3xl overflow-hidden border-x border-slate-200 dark:border-slate-800 shadow-sm relative pt-16 md:pt-0">
      
      {/* 🟢 HEADER */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={() => navigate('/dashboard/parties')} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 dark:bg-slate-800 rounded-full transition-colors">
            <HiOutlineArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xl md:text-2xl ${party.status === 'bad_debt' ? 'bg-rose-100 text-rose-500' : party.accountType === 'loan' ? 'bg-indigo-100 text-indigo-500' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
              {party.accountType === 'loan' ? <FaUniversity /> : <FaUserCircle />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white capitalize leading-tight">{party.name}</h2>
                {party.accountType === 'loan' && (
                  <span className="hidden md:inline-flex bg-indigo-50 text-indigo-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">Formal Loan</span>
                )}
              </div>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                {party.accountType === 'loan' ? 'EMI / Bank Account' : party.phone}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative group">
            <button className="flex items-center gap-1 md:gap-2 p-2 md:p-2.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-xl font-bold text-[10px] md:text-xs hover:bg-slate-200 transition-colors border border-slate-200 dark:border-slate-700">
              <HiOutlineDownload size={16}/> 
              <span className="hidden sm:inline">Report</span>
            </button>
            <div className="absolute top-full right-0 mt-2 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
              <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg text-left w-full">
                <HiOutlineDocumentText className="text-rose-500" size={16}/> As PDF
              </button>
              <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg text-left w-full">
                <HiOutlineTable className="text-emerald-500" size={16}/> As Excel
              </button>
            </div>
          </div>

          <div className={`text-right p-2 md:p-3 rounded-2xl border ${party.status === 'bad_debt' ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/10' : 'bg-slate-50 border-slate-200 dark:bg-slate-800'}`}>
            <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
               {party.accountType === 'loan' ? 'Remaining Principal' : (party.netBalance > 0 ? 'Current Balance' : party.netBalance < 0 ? 'You Will Give' : 'Settled')}
            </p>
            <p className={`text-lg md:text-xl font-black tracking-tight ${party.status === 'bad_debt' ? 'text-rose-500' : party.netBalance > 0 ? 'text-emerald-500' : party.netBalance < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
               {currencySymbol}{Math.abs(party.netBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </p>
          </div>
        </div>
      </div>

      {party.accountType === 'loan' && party.netBalance !== 0 && (
         <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/50 px-6 py-3 flex justify-between items-center z-10 shrink-0">
           <div className="flex items-center gap-4">
              <div>
                 <p className="text-[9px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest">Fixed EMI Amount</p>
                 <p className="text-sm font-black text-indigo-600 dark:text-indigo-300">{currencySymbol}{Number(party.emiAmount).toLocaleString()}</p>
              </div>
              <div className="w-px h-6 bg-indigo-200 dark:bg-indigo-800"></div>
              <div>
                 <p className="text-[9px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest">Next Due Date</p>
                 <p className="text-sm font-black text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
                   <HiOutlineCalendar size={14}/> 
                   {formatGlobalDate ? formatGlobalDate(party.emiDueDate, 'short') : party.emiDueDate}
                 </p>
              </div>
           </div>
           <button onClick={() => openModal('emi_payment')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 flex items-center gap-1">
             Pay EMI Now
           </button>
         </div>
      )}

      {/* 📜 CHAT / LEDGER AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-fixed opacity-90">
        <div className="text-center mt-4">
           <span className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm">
             Ledger Created on {formatGlobalDate ? formatGlobalDate(party.createdAt, 'short') : new Date(party.createdAt).toLocaleDateString()}
           </span>
        </div>

        {ledger.map((rec) => {
          const isRight = rec.type === 'give' || rec.type === 'interest' || (rec.type === 'opening_balance' && rec.baseAmount > 0) || rec.type === 'emi_payment';
          const isCenter = rec.type === 'settled' || rec.type === 'writeoff' || (rec.type === 'opening_balance' && rec.baseAmount === 0);

          if (isCenter) {
            return (
              <div key={rec.id} className="flex justify-center my-4 group">
                <div className={`px-4 py-2 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center gap-2 ${rec.type === 'writeoff' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                   {rec.type === 'writeoff' ? <HiOutlineExclamationCircle size={16}/> : <HiOutlineCheckCircle size={16}/>}
                   {rec.note}
                   {rec.type !== 'opening_balance' && (
                     <button onClick={() => initiateDelete(rec)} className="ml-2 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                       <HiOutlineTrash size={14} />
                     </button>
                   )}
                </div>
              </div>
            );
          }

          return (
            <div key={rec.id} className={`flex ${isRight ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 group`}>
              <div className={`min-w-[60%] max-w-[85%] md:max-w-[60%] p-4 rounded-[2rem] shadow-sm border relative ${isRight ? 'bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30 rounded-br-none' : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30 rounded-bl-none'}`}>
                
                <button 
                  onClick={() => initiateDelete(rec)} 
                  className={`absolute -top-3 ${isRight ? '-left-3' : '-right-3'} p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 opacity-0 lg:group-hover:opacity-100 transition-all scale-90 hover:scale-100 z-10`}
                  title="Delete Entry & Revert Balance"
                >
                  <HiOutlineTrash size={14} />
                </button>

                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isRight ? 'bg-rose-200/50 text-rose-700 dark:text-rose-400' : 'bg-emerald-200/50 text-emerald-700 dark:text-emerald-400'}`}>
                      {rec.type === 'opening_balance' ? 'Initial Principal' : rec.type === 'give' ? 'You Gave' : rec.type === 'emi_payment' ? 'EMI PAID' : rec.type === 'interest' ? 'Interest Added' : 'You Received'}
                    </span>
                    {rec.vault && (
                      <span className="text-[9px] font-bold text-slate-500 ml-2 uppercase tracking-wider flex items-center gap-1 inline-flex">
                        {rec.vault === 'bank' ? <FaUniversity/> : rec.vault === 'cash' ? <FaMoneyBillWave/> : <FaWallet/>} 
                        {rec.vault} 
                        {/* 🚀 RENDER SUB WALLET IN CHAT */}
                        {rec.subWallet && <span className="text-blue-500 ml-1">({rec.subWallet})</span>}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                    {formatGlobalDate ? formatGlobalDate(rec.timestamp, 'short') : new Date(rec.timestamp).toLocaleDateString()} 
                    {" - "}{new Date(rec.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>

                <div className="flex items-end gap-3">
                  <p className={`text-3xl font-black tracking-tighter ${isRight ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {currencySymbol}{Math.abs(rec.baseAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </p>
                  {rec.currency !== baseCurrency && (
                    <div className="mb-1 text-right">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{rec.amount} {rec.currency}</p>
                      <p className="text-[9px] text-slate-400">@ {rec.exchangeRate} rate</p>
                    </div>
                  )}
                </div>

                {rec.purpose && rec.type === 'give' && (
                  <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${isRight ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                    <HiOutlineTag size={10} /> {rec.purpose}
                  </div>
                )}

                {rec.note && (
                  <div className={`mt-2 p-3 rounded-xl text-xs font-semibold leading-relaxed ${isRight ? 'bg-rose-100/50 text-rose-800 dark:text-rose-300' : 'bg-emerald-100/50 text-emerald-800 dark:text-emerald-300'}`}>
                    {rec.note}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* 🚀 ACTION FOOTER */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] dark:shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
        {party.status === 'bad_debt' || party.status === 'settled' ? (
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
             <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Account Closed</p>
             <p className="text-xs font-bold text-slate-400 mt-1">Reopen account by adding a new transaction to continue ledger.</p>
             <button onClick={() => openModal('give')} className="mt-3 text-xs font-black text-blue-600 dark:text-blue-400 underline">Add New Transaction</button>
          </div>
        ) : (
          <div className="flex gap-2 md:gap-3 max-w-2xl mx-auto">
            {party.accountType === 'loan' ? (
              <>
                <button onClick={() => openModal('emi_payment')} className="flex-1 py-3 md:py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                  <FaUniversity size={18}/> Pay EMI Installment
                </button>
              </>
            ) : (
              <>
                <button onClick={() => openModal('give')} className="flex-1 py-3 md:py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2 shadow-lg shadow-rose-500/20 active:scale-95 transition-all">
                  <HiOutlineTrendingUp size={18}/> You Gave
                </button>
                <button onClick={() => openModal('receive')} className="flex-1 py-3 md:py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                  <HiOutlineTrendingDown size={18}/> You Got
                </button>
              </>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className={`h-full px-3 md:px-4 rounded-2xl font-black flex items-center justify-center shadow-sm transition-colors border border-slate-200 dark:border-slate-700
                  ${isMenuOpen ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-white hover:bg-slate-200'}
                `}
              >
                •••
              </button>
              
              {isMenuOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
              )}

              <div className={`absolute bottom-full right-0 mb-3 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl transition-all duration-200 p-2 flex flex-col gap-1 z-50 origin-bottom-right
                ${isMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                
                {party.accountType !== 'loan' && (
                  <button onClick={() => openModal('interest')} className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-2">
                    <FaPercent/> Charge Interest
                  </button>
                )}
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                <button onClick={() => openModal('settle')} className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold text-xs flex items-center gap-2">
                  <HiOutlineCheckCircle size={16}/> Mark Settled (0)
                </button>
                <button onClick={() => openModal('writeoff')} className="w-full text-left px-4 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-2">
                  <HiOutlineExclamationCircle size={16}/> Bad Debt (Write-off)
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* --- ACTION MODALS --- */}
      {activeModal && activeModal !== 'settle' && activeModal !== 'writeoff' && (
        <div className="fixed inset-0 z-[400] bg-slate-950/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90dvh]">
            
            <div className={`px-6 md:px-8 py-5 flex justify-between items-center text-white shrink-0 ${activeModal === 'give' ? 'bg-rose-500' : activeModal === 'receive' ? 'bg-emerald-500' : activeModal === 'emi_payment' ? 'bg-indigo-600' : 'bg-blue-600'}`}>
              <h3 className="text-xl font-black capitalize flex items-center gap-2">
                 {activeModal === 'give' ? <FaArrowUp/> : activeModal === 'receive' ? <FaArrowDown/> : activeModal === 'emi_payment' ? <FaUniversity/> : <FaPercent/>}
                 {activeModal === 'give' ? 'Give Money' : activeModal === 'receive' ? 'Receive Money' : activeModal === 'emi_payment' ? 'Pay EMI Installment' : 'Interest Calculator'}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleTransaction} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 pb-[max(2rem,env(safe-area-inset-bottom))]">
              {activeModal === 'interest' ? (
                <div className="space-y-4 bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <div className="flex gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-blue-200 dark:border-blue-800">
                    <label className={`flex-1 p-2 rounded-lg text-center cursor-pointer font-bold text-xs transition-colors ${formData.interestMethod === 'simple' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
                      <input type="radio" name="intMethod" className="hidden" checked={formData.interestMethod === 'simple'} onChange={() => setFormData({...formData, interestMethod: 'simple'})} />
                      Simple Interest
                    </label>
                    <label className={`flex-1 p-2 rounded-lg text-center cursor-pointer font-bold text-xs transition-colors ${formData.interestMethod === 'compound' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
                      <input type="radio" name="intMethod" className="hidden" checked={formData.interestMethod === 'compound'} onChange={() => setFormData({...formData, interestMethod: 'compound'})} />
                      Compound Interest
                    </label>
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center justify-between">
                      Base Principal Amount 
                      <span className="bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded text-[8px]">Auto-Detected</span>
                    </label>
                    <input type="number" required value={formData.interestPrincipal} onChange={(e) => setFormData({...formData, interestPrincipal: e.target.value})} 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                  <div className="flex gap-4">
                    <div className="w-1/2 space-y-2">
                      <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Rate (%)</label>
                      <input type="number" step="any" required value={formData.interestRate} onChange={(e) => setFormData({...formData, interestRate: e.target.value})} 
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                    </div>
                    <div className="w-1/2 space-y-2">
                      <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Type</label>
                      <select value={formData.interestType} onChange={(e) => setFormData({...formData, interestType: e.target.value})} 
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer">
                        <option value="monthly">Per Month</option>
                        <option value="yearly">Per Year</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-1/2 space-y-2">
                      <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1"><HiOutlineCalendar/> From</label>
                      <input type="date" required value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <span className="block text-[8px] font-bold text-blue-500 mt-1">{formatGlobalDate ? formatGlobalDate(formData.startDate, 'short') : ''}</span>
                    </div>
                    <div className="w-1/2 space-y-2">
                      <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1"><HiOutlineCalendar/> To</label>
                      <input type="date" required value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <span className="block text-[8px] font-bold text-blue-500 mt-1">{formatGlobalDate ? formatGlobalDate(formData.endDate, 'short') : ''}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-blue-200 dark:border-blue-800 flex justify-between items-end">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Final Interest:</span>
                    <span className="text-2xl font-black text-blue-700 dark:text-blue-300">
                      {currencySymbol}{formData.amount ? formData.amount : '0.00'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 relative">
                  <div className="w-1/3 relative">
                    <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none">
                      <option value={baseCurrency}>{baseCurrency} (Base)</option>
                      {selectedFiats.length > 0 && <optgroup label="Your Fiat">{selectedFiats.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}</optgroup>}
                      {cryptoSymbols.length > 0 && <optgroup label="Your Crypto">{cryptoSymbols.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <input type="number" required step="any" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="Amount" 
                    className="w-2/3 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-2xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
              )}

              {activeModal === 'give' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Purpose / Condition of Loan</label>
                  <div className="relative">
                    <select value={formData.purpose} onChange={(e) => setFormData({...formData, purpose: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer text-sm appearance-none">
                      <option value="Friendly Support (0% Interest)">Friendly Support (0% Interest)</option>
                      <option value="Business Loan (Fixed Interest)">Business Loan (Fixed Interest)</option>
                      <option value="Conditional (Free for limited time, then Interest)">Conditional (Free for limited time, then Interest)</option>
                      <option value="Investment / Trade Advance">Investment / Trade Advance</option>
                      <option value="Emergency Funds">Emergency Funds</option>
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {activeModal === 'receive' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-4 rounded-2xl border-2 cursor-pointer flex flex-col items-center justify-center gap-1 transition-all ${formData.receiveType === 'principal' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <input type="radio" name="recType" className="hidden" checked={formData.receiveType === 'principal'} onChange={() => setFormData({...formData, receiveType: 'principal'})} />
                    <span className="font-black text-sm text-slate-800 dark:text-white">Capital Returned</span>
                    <span className="text-[9px] font-bold text-slate-500 text-center">Reduces principal balance</span>
                  </label>
                  <label className={`p-4 rounded-2xl border-2 cursor-pointer flex flex-col items-center justify-center gap-1 transition-all ${formData.receiveType === 'interest' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <input type="radio" name="recType" className="hidden" checked={formData.receiveType === 'interest'} onChange={() => setFormData({...formData, receiveType: 'interest'})} />
                    <span className="font-black text-sm text-slate-800 dark:text-white">Interest Paid</span>
                    <span className="text-[9px] font-bold text-blue-500 text-center">Adds to Income Tracker</span>
                  </label>
                </div>
              )}

              {isForeign && activeModal !== 'interest' && (
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 w-1/2">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Rate:</span>
                    <input type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} placeholder={`in ${baseCurrency}`} 
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold dark:text-white outline-none focus:border-blue-400 text-sm" />
                  </div>
                  <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="text-[9px] font-black bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1">
                    <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} /> {isFetchingRate ? 'Syncing' : 'Live Rate'}
                  </button>
                </div>
              )}

              {activeModal !== 'interest' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      {activeModal === 'give' || activeModal === 'emi_payment' ? 'Deduct from Vault' : 'Add to Vault'}
                    </label>
                    <div className="relative">
                      <select value={formData.vault} onChange={(e) => setFormData({...formData, vault: e.target.value, subWallet: ''})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none">
                        <option value="bank">Bank Account</option>
                        <option value="cash">Physical Cash</option>
                        <option value="online">Online / Crypto Wallet</option>
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* 🚀 NEW: SubWallet Input inside PartyLedger */}
                  {(formData.vault === 'bank' || formData.vault === 'online') && (
                    <div className="space-y-2 animate-in fade-in">
                      <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest ml-1">{formData.vault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
                      <input type="text" list="existing-vaults-party" required value={formData.subWallet} onChange={(e) => setFormData({...formData, subWallet: e.target.value})} placeholder={formData.vault === 'bank' ? "e.g. SBI, RRR" : "e.g. Paytm, PayPal"} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <datalist id="existing-vaults-party">
                         {existingVaultNames.map(b => <option key={b} value={b} />)}
                      </datalist>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Date & Time</span>
                  <span className="text-blue-500">{formatGlobalDate ? formatGlobalDate(formData.datetime.split('T')[0], 'full') : ''}</span>
                </label>
                <input type="datetime-local" required value={formData.datetime} onChange={(e) => setFormData({...formData, datetime: e.target.value})} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Details / Note (Optional)</label>
                <textarea rows="2" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="Any additional remarks..." 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 resize-none custom-scrollbar" />
              </div>

              <button type="submit" disabled={isProcessing || (activeModal === 'interest' && !formData.amount)} className={`w-full p-4 rounded-2xl font-black text-white text-lg transition-all shadow-xl active:scale-95 disabled:opacity-70 ${activeModal === 'give' ? 'bg-rose-500 hover:bg-rose-600' : activeModal === 'receive' ? 'bg-emerald-500 hover:bg-emerald-600' : activeModal === 'emi_payment' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isProcessing ? 'Saving...' : activeModal === 'interest' ? 'Apply Interest' : activeModal === 'emi_payment' ? 'Confirm EMI Payment' : 'Save Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 SECURE DELETE / SETTLEMENT MODALS */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-full flex items-center justify-center text-3xl mb-4">
                <HiOutlineLockClosed />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">
                You are about to delete this ledger entry.
              </p>
              
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                  <HiOutlineExclamationCircle size={16} className="shrink-0" />
                  WARNING: Deleting this entry will reverse the balance from your Khata and automatically refund/deduct the synced amount from your Bank Vault.
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

      {(activeModal === 'settle' || activeModal === 'writeoff') && (
        <div className="fixed inset-0 z-[400] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl mb-4 ${activeModal === 'settle' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' : 'bg-rose-100 text-rose-500 dark:bg-rose-500/20'}`}>
              {activeModal === 'settle' ? <HiOutlineCheckCircle/> : <HiOutlineExclamationCircle/>}
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
              {activeModal === 'settle' ? 'Settle Account?' : 'Declare Bad Debt?'}
            </h3>
            <p className="text-sm font-semibold text-slate-500 mb-8">
              {activeModal === 'settle' ? 
                'This will mark the net balance as ZERO. Use this if you settled the debt outside (e.g. via work/kind).' : 
                `This will mark ${currencySymbol}${Math.abs(party.netBalance)} as a LOSS in your Expense Tracker. The account will be closed.`}
            </p>
            <div className="flex gap-4">
              <button onClick={closeModal} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
              <button onClick={() => handleSettlement(activeModal)} disabled={isProcessing} className={`flex-1 py-4 text-white rounded-2xl font-black transition-colors ${activeModal === 'settle' ? 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700' : 'bg-rose-500 hover:bg-rose-600'}`}>
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