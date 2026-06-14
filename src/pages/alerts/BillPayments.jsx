import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  collection, addDoc, doc, deleteDoc, updateDoc, setDoc,
  onSnapshot, query, orderBy, where, getDocs, getDoc
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { verifyPINEnhanced } from '../../utils/securityUtils';
import { useToast } from '../../hooks/useToastNotification';
import {
  HiOutlinePlus, HiOutlineX, HiOutlineTrash,
  HiOutlineCalendar, HiOutlineCreditCard, HiOutlineCheckCircle,
  HiOutlineExclamationCircle, HiOutlineClock, HiOutlineRefresh,
  HiOutlineLockClosed, HiOutlineInformationCircle, HiOutlineChevronDown,
  HiOutlineSearch, HiOutlineBell, HiOutlineLightningBolt, HiOutlineShieldCheck
} from 'react-icons/hi';
import {
  FaUniversity, FaMoneyBillWave, FaWallet, FaBitcoin, FaExchangeAlt,
  FaCalendarCheck, FaCalendarTimes, FaCheckDouble
} from 'react-icons/fa';


const getLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const BillPaymentsContent = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  const [bills, setBills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [activeBill, setActiveBill] = useState(null);
  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [existingVaultNames, setExistingVaultNames] = useState([]);
  const [existingCryptoPlatforms, setExistingCryptoPlatforms] = useState([]);

  const todayDate = new Date().toISOString().split('T')[0];

  const availableFiats = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);
  const availableCryptos = useMemo(() => {
    const customSymbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    return Array.from(new Set(["USDT", ...customSymbols])).map(s => s.toUpperCase());
  }, [selectedCryptos]);

  const [formData, setFormData] = useState({
    title: '', amount: '', category: 'Bills & Utilities', dueDate: todayDate, frequency: 'monthly'
  });

  const [payData, setPayData] = useState({
    sourceVault: 'bank', subWallet: '', cryptoPlatform: '', asset: baseCurrency, exchangeRate: 1, datetime: getLocalDateTimeString()
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "billReminders"), orderBy("dueDate", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (err) => {
      addToast('Failed to load bills.', 'error');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, addToast]);

  useEffect(() => {
    if (!user) return;
    const fetchUserDataAndVaults = async () => {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && userSnap.data().customCoins) {
        setCustomUserCoins(userSnap.data().customCoins);
      }

      const qBank = query(collection(db, "users", user.uid, "bankWallet"));
      const snapBank = await getDocs(qBank);
      const qOnline = query(collection(db, "users", user.uid, "onlineWallet"));
      const snapOnline = await getDocs(qOnline);
      const names = new Set();
      snapBank.docs.forEach(d => { if(d.data().bankName) names.add(d.data().bankName) });
      snapOnline.docs.forEach(d => { if(d.data().walletName) names.add(d.data().walletName) });
      setExistingVaultNames(Array.from(names));

      const qCrypto = query(collection(db, "users", user.uid, "cryptoWalletLogs"));
      const snapCrypto = await getDocs(qCrypto);
      const cryptoNames = new Set();
      snapCrypto.docs.forEach(d => { if(d.data().platform) cryptoNames.add(d.data().platform) });
      setExistingCryptoPlatforms(Array.from(cryptoNames));
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

  const getBillStatus = (dueDateStr, isPaid) => {
    if (isPaid) return { label: 'Paid', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' };
    const due = new Date(dueDateStr);
    const today = new Date(todayDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d Overdue`, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20', isOverdue: true };
    if (diffDays === 0) return { label: 'Due Today', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' };
    if (diffDays <= 3) return { label: `In ${diffDays}d`, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' };
    return { label: `In ${diffDays}d`, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
  };

  const filteredBills = useMemo(() => {
    let result = [...bills];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b => b.title.toLowerCase().includes(q) || b.category?.toLowerCase().includes(q));
    }
    switch (filterStatus) {
      case 'pending': result = result.filter(b => !b.isPaid); break;
      case 'paid': result = result.filter(b => b.isPaid); break;
      case 'overdue': result = result.filter(b => !b.isPaid && getBillStatus(b.dueDate, false).isOverdue); break;
      default: break;
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'amount': return Number(b.amount) - Number(a.amount);
        case 'title': return a.title.localeCompare(b.title);
        default: return new Date(a.dueDate) - new Date(b.dueDate);
      }
    });
    return result;
  }, [bills, searchQuery, filterStatus, sortBy]);

  const activeBills = bills.filter(b => !b.isPaid);
  const totalUpcoming = activeBills.reduce((acc, b) => acc + Number(b.amount), 0);
  const totalOverdue = activeBills.filter(b => getBillStatus(b.dueDate, false).isOverdue).reduce((acc, b) => acc + Number(b.amount), 0);

  const fetchLiveRate = async () => {
    if (payData.asset === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fiatData = await fiatRes.json();
      const usdToBase = fiatData.rates[baseCurrency] || 1;

      if (availableFiats.includes(payData.asset) || payData.asset.length === 3) {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${payData.asset}`);
        const data = await res.json();
        if (data.rates[baseCurrency]) setPayData(prev => ({ ...prev, exchangeRate: data.rates[baseCurrency].toFixed(4) }));
      } else {
        const upperSym = payData.asset.toUpperCase();
        const coinObj = fullDatabase.find(c => c.symbol === upperSym) || {};
        const searchId = coinObj.id || payData.asset.toLowerCase();
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
            if(cgData[searchId]?.usd) priceUsd = parseFloat(cgData[searchId].usd);
          } catch(e) {}
        }
        if (!priceUsd) {
          try {
            if (['USDT', 'USDC', 'DAI'].includes(upperSym)) { priceUsd = 1.00; } 
            else {
              const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${upperSym}USDT`);
              if (bRes.ok) { const bData = await bRes.json(); priceUsd = parseFloat(bData.price); }
            }
          } catch(e) {}
        }

        const finalPrice = priceUsd || (coinObj?.fallbackPrice || 0);
        const finalRate = finalPrice * usdToBase;
        setPayData(prev => ({ ...prev, exchangeRate: finalRate.toFixed(4) }));
      }
    } catch (error) {
      addToast("Rate fetch failed. Please enter manually.", "error");
    } finally {
      setIsFetchingRate(false);
    }
  };

  const handleSaveBill = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsProcessing(true);

    const billRecord = {
      title: formData.title,
      amount: parseFloat(formData.amount),
      category: formData.category,
      dueDate: formData.dueDate,
      frequency: formData.frequency,
      isPaid: false,
      timestamp: new Date().getTime(),
    };

    try {
      await addDoc(collection(db, "users", user.uid, "billReminders"), billRecord);
      addToast('Bill reminder added!', 'success');
      setIsModalOpen(false);
      setFormData({ title: '', amount: '', category: 'Bills & Utilities', dueDate: todayDate, frequency: 'monthly' });
    } catch (error) {
      addToast("Failed to save bill.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const isForeign = payData.asset !== baseCurrency;
  const deductedAmount = activeBill ? (activeBill.amount / (isForeign ? (parseFloat(payData.exchangeRate) || 1) : 1)).toFixed(6) : 0;

  const handlePayBill = async (e) => {
    e.preventDefault();
    if (!user || !activeBill) return;

    if (payData.sourceVault === 'crypto' && !payData.cryptoPlatform.trim()) {
      addToast("Please specify the exact Crypto Platform (e.g. Binance, Phantom).", "warning");
      return;
    }
    if ((payData.sourceVault === 'bank' || payData.sourceVault === 'online') && !payData.subWallet.trim()) {
      addToast("Please specify the Bank or Wallet name to deduct from.", "warning");
      return;
    }

    setIsProcessing(true);
    const timestamp = new Date(payData.datetime).getTime();
    const formattedDate = new Date(payData.datetime).toISOString().split('T')[0];
    const payId = `BILLPAY_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    try {
      const vaultCollection = payData.sourceVault === 'bank' ? 'bankWallet' : 
                              payData.sourceVault === 'cash' ? 'cashWallet' : 
                              payData.sourceVault === 'online' ? 'onlineWallet' : 'cryptoWalletLogs';
      
      const vaultRecord = payData.sourceVault === 'crypto' 
        ? { 
            type: 'out', coin: payData.asset, quantity: parseFloat(deductedAmount), platform: payData.cryptoPlatform.trim(), 
            reason: `Bill Paid: ${activeBill.title}`, referenceNo: payId, date: formattedDate, 
            timestamp, linkedExpenseId: payId, billId: activeBill.id 
          }
        : { 
            title: `Bill Paid: ${activeBill.title}`, type: 'out', date: formattedDate, timestamp, 
            currency: payData.asset, foreignAmount: parseFloat(deductedAmount), exchangeRate: isForeign ? parseFloat(payData.exchangeRate) : 1, 
            finalBaseAmount: activeBill.amount, fee: 0, linkedExpenseId: payId, 
            walletName: payData.subWallet.trim() || 'Default Wallet',
            bankName: payData.subWallet.trim() || 'Default Bank',
            transferType: 'Bill Payment', billId: activeBill.id 
          };
      
      await addDoc(collection(db, "users", user.uid, vaultCollection), vaultRecord);

      await addDoc(collection(db, "users", user.uid, "expenseLogs"), {
        title: activeBill.title,
        category: activeBill.category || "Bills & Utilities",
        vault: payData.sourceVault,
        subWallet: payData.sourceVault === 'bank' || payData.sourceVault === 'online' ? payData.subWallet.trim() : '', 
        cryptoPlatform: payData.sourceVault === 'crypto' ? payData.cryptoPlatform.trim() : '',
        asset: payData.asset,
        amount: parseFloat(deductedAmount),
        exchangeRate: isForeign ? parseFloat(payData.exchangeRate) : 1,
        finalBaseAmount: activeBill.amount,
        date: formattedDate,
        timestamp,
        linkedExpenseId: payId,
        billId: activeBill.id, 
        isSplit: false
      });

      if (activeBill.frequency === 'one-time') {
        await updateDoc(doc(db, "users", user.uid, "billReminders", activeBill.id), { isPaid: true, lastPaidDate: formattedDate });
      } else {
        const currentDue = new Date(activeBill.dueDate);
        if (activeBill.frequency === 'monthly') currentDue.setMonth(currentDue.getMonth() + 1);
        if (activeBill.frequency === 'yearly') currentDue.setFullYear(currentDue.getFullYear() + 1);
        
        await updateDoc(doc(db, "users", user.uid, "billReminders", activeBill.id), { 
          dueDate: currentDue.toISOString().split('T')[0], 
          lastPaidDate: formattedDate 
        });
      }

      addToast(`Payment for "${activeBill.title}" processed!`, 'success');
      setIsPayModalOpen(false);
    } catch (error) {
      addToast("Payment sync failed.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const initiateSecureDelete = (bill) => {
    setDeleteContext(bill);
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
      const storedHash = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin;
      
      const { valid, newHash } = await verifyPINEnhanced(pinInput.trim(), storedHash, user.uid);
      
      if (!valid) {
        setPinError("Incorrect PIN. Deletion blocked!");
        setIsVerifying(false);
        return;
      }
      
      if (newHash) {
        await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true });
      }

      await deleteDoc(doc(db, "users", user.uid, "billReminders", deleteContext.id));

      const cleanQueries = [
         { col: "expenseLogs", field: "billId" },
         { col: "bankWallet", field: "billId" },
         { col: "cashWallet", field: "billId" },
         { col: "onlineWallet", field: "billId" },
         { col: "cryptoWalletLogs", field: "billId" },
      ];

      for (let q of cleanQueries) {
         const snaps = await getDocs(query(collection(db, "users", user.uid, q.col), where(q.field, "==", deleteContext.id)));
         snaps.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, q.col, d.id)));
      }

      addToast(`Bill "${deleteContext.title}" deleted.`, 'info');
      setDeleteContext(null); 
    } catch (error) {
      setPinError("System error during deletion.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openPayModal = (bill) => {
    setActiveBill(bill);
    setPayData({
      sourceVault: 'bank', 
      subWallet: existingVaultNames[0] || '', 
      cryptoPlatform: existingCryptoPlatforms[0] || '', 
      asset: baseCurrency, 
      exchangeRate: 1, 
      datetime: getLocalDateTimeString()
    });
    setIsPayModalOpen(true);
  };

  // Skeleton grid for loading state
  const SkeletonGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse">
          <div className="flex justify-between items-start mb-4">
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="space-y-3">
            <div className="h-7 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-blue-500/10 text-blue-600 rounded-3xl ring-1 ring-blue-500/20 shadow-lg">
              <HiOutlineCalendar size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Bills & Subscriptions</h1>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Never miss a due date. Pay here and it auto-syncs to your Expense Tracker.
              </p>
            </div>
          </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-7 py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-blue-500/30 transition-all active:scale-95 whitespace-nowrap">
          <HiOutlinePlus size={20} /> Add Reminder
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] shadow-xl relative overflow-hidden border border-slate-800">
          <div className="absolute right-0 top-0 opacity-10 text-white -mt-4 -mr-4"><HiOutlineCreditCard size={150}/></div>
          <div className="relative z-10">
            <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Total Upcoming (Unpaid)</p>
            <h2 className="text-4xl font-black text-white tracking-tighter truncate" title={`${currencySymbol}${totalUpcoming}`}>
              <span className="text-blue-500 mr-2">{currencySymbol}</span>{totalUpcoming.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h2>
          </div>
        </div>
        <div className="p-8 bg-rose-50 dark:bg-rose-500/10 rounded-[2rem] shadow-sm relative overflow-hidden border border-rose-200 dark:border-rose-500/20">
          <div className="absolute right-0 top-0 opacity-10 text-rose-500 -mt-4 -mr-4"><HiOutlineExclamationCircle size={150}/></div>
          <div className="relative z-10">
            <p className="text-xs font-black text-rose-600 dark:text-rose-500 uppercase tracking-widest mb-1">Total Overdue Alerts</p>
            <h2 className="text-4xl font-black text-rose-700 dark:text-rose-400 tracking-tighter truncate" title={`${currencySymbol}${totalOverdue}`}>
              <span className="text-rose-400 mr-2">{currencySymbol}</span>{totalOverdue.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h2>
          </div>
        </div>
      </div>

      {/* Bills Grid or Skeleton or Empty */}
      {isLoading ? (
        <SkeletonGrid />
      ) : bills.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <HiOutlineCalendar className="mx-auto text-6xl text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-2xl font-black text-slate-700 dark:text-white">No Bills Added</h3>
          <p className="text-slate-500 font-semibold mt-2">Add your Netflix, Rent, or Credit Card bills to track them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBills.map((bill) => {
            const status = getBillStatus(bill.dueDate, bill.isPaid);

            return (
              <div key={bill.id} className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-xl ${status.isOverdue ? 'border-rose-300 dark:border-rose-500/50 shadow-rose-500/10' : 'border-slate-200 dark:border-slate-800'}`}>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <button onClick={() => initiateSecureDelete(bill)} className="text-slate-400 hover:text-rose-500 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><HiOutlineTrash size={18}/></button>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight mb-1 truncate" title={bill.title}>{bill.title}</h3>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <HiOutlineRefresh size={12}/> {bill.frequency}
                  </p>
                </div>

                <div className="mt-auto space-y-4">
                  <div className="flex justify-between items-end gap-2">
                    <span className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white truncate" title={`${currencySymbol}${Number(bill.amount).toLocaleString()}`}>
                      {currencySymbol}{Number(bill.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 pb-1">
                      <HiOutlineClock/> Due: {formatGlobalDate ? formatGlobalDate(bill.dueDate, 'short') : bill.dueDate}
                    </span>
                  </div>

                  {!bill.isPaid && (
                    <button onClick={() => openPayModal(bill)} className="w-full py-3.5 bg-blue-50 hover:bg-blue-600 dark:bg-blue-500/10 text-blue-600 hover:text-white dark:text-blue-400 rounded-xl font-black text-sm transition-all active:scale-95 flex justify-center items-center gap-2 border border-blue-100 dark:border-blue-500/20 shadow-sm">
                      <HiOutlineCheckCircle size={20}/> Pay Now
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Bill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700 max-h-[90vh]">
            <div className="px-6 py-5 flex justify-between items-center bg-blue-600 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineCalendar size={24}/> Add Reminder</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={20}/></button>
            </div>
            <form onSubmit={handleSaveBill} className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Subscription / Bill Name</label>
                <input 
                  type="text" required autoFocus 
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})} 
                  placeholder="e.g. Netflix, Rent, EMI..." 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Amount Due ({currencySymbol})</label>
                <input 
                  type="number" step="any" required 
                  value={formData.amount} 
                  onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                  placeholder="e.g. 1500" 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                    <span>Due Date</span>
                  </label>
                  <input 
                    type="date" required 
                    value={formData.dueDate} 
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})} 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm cursor-pointer transition-colors" 
                  />
                  <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-1 pl-1">
                    {formatGlobalDate ? formatGlobalDate(formData.dueDate, 'short') : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Frequency</label>
                  <div className="relative">
                    <select 
                      value={formData.frequency} 
                      onChange={(e) => setFormData({...formData, frequency: e.target.value})} 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm cursor-pointer transition-colors appearance-none"
                    >
                      <option value="one-time">One Time</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
                <button 
                  type="submit" disabled={isProcessing} 
                  className="w-full p-4 rounded-xl font-black text-white text-lg transition-all active:scale-95 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-xl shadow-blue-500/30 flex justify-center items-center gap-2 shrink-0"
                >
                  {isProcessing ? <HiOutlineRefresh className="animate-spin" size={20}/> : null}
                  {isProcessing ? 'Saving...' : 'Save Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Bill Modal */}
      {isPayModalOpen && activeBill && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-300 dark:border-slate-700 max-h-[90vh]">
            <div className="px-6 py-5 flex justify-between items-center border-b border-emerald-400 dark:border-emerald-700 bg-emerald-500 text-white shrink-0">
              <h3 className="text-lg font-black flex items-center gap-2"><HiOutlineLightningBolt size={24}/> Pay Bill</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><HiOutlineX size={20}/></button>
            </div>
            
            <form onSubmit={handlePayBill} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Bill Info */}
              <div className="text-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Paying for</p>
                <p className="text-lg font-black text-slate-900 dark:text-white truncate px-2" title={activeBill.title}>{activeBill.title}</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {currencySymbol}{Number(activeBill.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
              </div>

              {/* Vault Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Pay From Vault</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm">
                  {[
                    { id: 'bank', icon: FaUniversity, label: 'Bank' },
                    { id: 'cash', icon: FaMoneyBillWave, label: 'Cash' },
                    { id: 'online', icon: FaWallet, label: 'Online' },
                    { id: 'crypto', icon: FaBitcoin, label: 'Crypto' },
                  ].map(v => (
                    <button 
                      key={v.id} type="button" 
                      onClick={() => setPayData({...payData, sourceVault: v.id, subWallet: '', cryptoPlatform: '', asset: v.id === 'crypto' ? (availableCryptos[0] || 'BTC') : baseCurrency, exchangeRate: 1})} 
                      className={`py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex flex-col items-center gap-1
                        ${payData.sourceVault === v.id 
                          ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-600 scale-105' 
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 border border-transparent'
                        }`}
                    >
                      <v.icon size={16} />
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(payData.sourceVault === 'bank' || payData.sourceVault === 'online') && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest ml-1">
                      {payData.sourceVault === 'bank' ? 'Bank Name' : 'Wallet Name'}
                    </label>
                    <input 
                      type="text" list="pay-vaults" required 
                      value={payData.subWallet} 
                      onChange={(e) => setPayData({...payData, subWallet: e.target.value})} 
                      placeholder={payData.sourceVault === 'bank' ? "e.g. HDFC, SBI" : "e.g. Paytm, PayPal"} 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors" 
                    />
                    <datalist id="pay-vaults">
                      {existingVaultNames.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                )}

                {payData.sourceVault === 'crypto' && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest ml-1">Platform</label>
                    <input 
                      type="text" list="crypto-platforms" required 
                      value={payData.cryptoPlatform} 
                      onChange={(e) => setPayData({...payData, cryptoPlatform: e.target.value})} 
                      placeholder="e.g. Binance, Phantom" 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors" 
                    />
                    <datalist id="crypto-platforms">
                      {existingCryptoPlatforms.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                  <div className="relative">
                    <select 
                      value={payData.asset} 
                      onChange={(e) => setPayData({...payData, asset: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer shadow-sm transition-colors"
                    >
                      {payData.sourceVault === 'crypto' ? (
                        availableCryptos.map(c => <option key={c} value={c}>{c}</option>)
                      ) : (
                        <>
                          <option value={baseCurrency}>{baseCurrency} (Base)</option>
                          <optgroup label="Fiat">
                            {availableFiats.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        </>
                      )}
                    </select>
                    <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>

              {/* Exchange Rate */}
              {isForeign && (
                <div className="p-4 bg-emerald-50 dark:bg-slate-800/80 border border-emerald-200 dark:border-slate-700 rounded-2xl space-y-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-400">Rate:</span>
                    <span className="text-sm font-black text-slate-700 dark:text-slate-400">1 {payData.asset} =</span>
                    <input 
                      type="number" step="any" required 
                      value={payData.exchangeRate} 
                      onChange={(e) => setPayData({...payData, exchangeRate: e.target.value})} 
                      className="flex-1 p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm"
                    />
                    <span className="text-sm font-black text-slate-700 dark:text-slate-400">{baseCurrency}</span>
                  </div>
                  <button 
                    type="button" onClick={fetchLiveRate} disabled={isFetchingRate} 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <HiOutlineRefresh className={isFetchingRate ? "animate-spin" : ""} size={14} />
                    {isFetchingRate ? 'Fetching...' : 'Get Live Rate'}
                  </button>
                </div>
              )}

              {isForeign && (
                <div className="text-center p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Equivalent Deduction</p>
                  <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
                    -{deductedAmount} <span className="text-[10px] text-slate-500">{payData.asset}</span>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Payment Date & Time</span>
                </label>
                <input 
                  type="datetime-local" required 
                  value={payData.datetime} 
                  onChange={(e) => setPayData({...payData, datetime: e.target.value})} 
                  className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm cursor-pointer transition-colors" 
                />
                <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 pl-1">
                  {formatGlobalDate ? formatGlobalDate(payData.datetime, 'full') : ''}
                </span>
              </div>

              <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 text-center px-4 bg-blue-50 dark:bg-blue-500/10 p-3 rounded-xl border border-blue-200 dark:border-blue-500/20 flex items-start sm:items-center gap-2 shadow-sm">
                 <HiOutlineInformationCircle size={18} className="shrink-0 mt-0.5 sm:mt-0" />
                 Payment will be auto-deducted from your {payData.sourceVault} vault and logged into your Expense Tracker.
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
                <button 
                  type="submit" disabled={isProcessing} 
                  className="w-full p-4 rounded-xl font-black text-white text-lg transition-all active:scale-95 bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/30 disabled:opacity-70 flex justify-center items-center gap-2 shrink-0"
                >
                  {isProcessing ? <HiOutlineRefresh className="animate-spin" size={20}/> : null}
                  {isProcessing ? 'Processing...' : <><HiOutlineCheckCircle size={20}/> Confirm Payment</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 border border-slate-300 dark:border-slate-800 relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-pink-500"></div>
            
            <div className="flex flex-col items-center text-center mb-6 shrink-0">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-full flex items-center justify-center text-3xl mb-4 shadow-inner border border-rose-200 dark:border-rose-500/30">
                <HiOutlineLockClosed size={28} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              
              {deleteContext.lastPaidDate || deleteContext.isPaid ? (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl shadow-sm">
                  <p className="text-xs font-black text-amber-800 dark:text-amber-400 flex items-start gap-1 text-left">
                    <HiOutlineExclamationCircle size={16} className="shrink-0 mt-0.5" />
                    WARNING: This bill was previously marked as Paid. Deleting it will restore the funds back to your Vault and remove the logs from Expense Tracker to keep balances accurate.
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700/50 rounded-xl shadow-sm">
                  <p className="text-xs font-black text-blue-800 dark:text-blue-400 flex items-start gap-1 text-left">
                    <HiOutlineInformationCircle size={16} className="shrink-0 mt-0.5" />
                    NOTICE: This is an unpaid reminder. Deleting it will permanently remove it from your upcoming bills list.
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={executeSecureDelete} className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest text-center block">Enter Security PIN</label>
                <input 
                  type="password" 
                  maxLength={6}
                  required
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all shadow-sm focus:border-rose-500"
                />
                {pinError && <p className="text-xs font-bold text-rose-600 dark:text-rose-400 text-center animate-bounce mt-2">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm">
                  Cancel
                </button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-lg shadow-rose-500/30 flex justify-center items-center gap-2 active:scale-95">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18}/> : null}
                  Delete Permanently
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillPaymentsContent;