import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, 
  HiOutlineCalendar, HiOutlineCreditCard, HiOutlineCheckCircle,
  HiOutlineExclamationCircle, HiOutlineClock, HiOutlineRefresh,
  HiOutlineLockClosed, HiOutlineInformationCircle
} from 'react-icons/hi';
import { FaUniversity, FaMoneyBillWave, FaWallet, FaBitcoin } from 'react-icons/fa';

// 🚀 SECURE SHA-256 HASHING ALGORITHM
const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const BillPayments = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'INR', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [bills, setBills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [activeBill, setActiveBill] = useState(null);

  // 🔐 Security Delete States
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Bills & Utilities',
    dueDate: todayDate,
    frequency: 'monthly' // one-time, monthly, yearly
  });

  const [payData, setPayData] = useState({
    sourceVault: 'bank',
    date: todayDate
  });

  // 📥 Fetch Bills
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "billReminders"), orderBy("dueDate", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 🧮 Calculate Days Left & Status (Calculation happens in AD, display can be anything)
  const getBillStatus = (dueDateStr, isPaid) => {
    if (isPaid) return { label: 'Paid', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200' };
    
    const due = new Date(dueDateStr);
    const today = new Date(todayDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `${Math.abs(diffDays)} Days Overdue`, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200', isOverdue: true };
    if (diffDays === 0) return { label: 'Due Today', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200' };
    if (diffDays <= 3) return { label: `Due in ${diffDays} Days`, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200' };
    return { label: `Due in ${diffDays} Days`, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
  };

  const activeBills = bills.filter(b => !b.isPaid);
  const totalUpcoming = activeBills.reduce((acc, b) => acc + Number(b.amount), 0);
  const totalOverdue = activeBills.filter(b => getBillStatus(b.dueDate, false).isOverdue).reduce((acc, b) => acc + Number(b.amount), 0);

  // 📝 Save New Bill
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
      setIsModalOpen(false);
      setFormData({ title: '', amount: '', category: 'Bills & Utilities', dueDate: todayDate, frequency: 'monthly' });
    } catch (error) {
      alert("Failed to save bill.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 💸 PAY BILL & AUTO-SYNC TO EXPENSE TRACKER
  const handlePayBill = async (e) => {
    e.preventDefault();
    if (!user || !activeBill) return;
    setIsProcessing(true);

    const timestamp = new Date(payData.date).getTime();
    const payId = `BILLPAY_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    try {
      // 1. Deduct from Vault (Bank, Cash, etc.)
      const vaultCollection = payData.sourceVault === 'bank' ? 'bankWallet' : 
                              payData.sourceVault === 'cash' ? 'cashWallet' : 
                              payData.sourceVault === 'online' ? 'onlineWallet' : 'cryptoWalletLogs';
      
      const vaultRecord = payData.sourceVault === 'crypto' 
        ? { type: 'out', coin: baseCurrency, quantity: activeBill.amount, platform: 'Binance', reason: `Bill Paid: ${activeBill.title}`, referenceNo: payId, date: payData.date, timestamp, linkedExpenseId: payId, billId: activeBill.id }
        : { title: `Bill Paid: ${activeBill.title}`, type: 'out', date: payData.date, timestamp, currency: baseCurrency, foreignAmount: activeBill.amount, exchangeRate: 1, finalBaseAmount: activeBill.amount, fee: 0, linkedExpenseId: payId, walletName: activeBill.category, transferType: 'Bill Payment', billId: activeBill.id };
      
      await addDoc(collection(db, "users", user.uid, vaultCollection), vaultRecord);

      // 2. Log in Expense Tracker
      await addDoc(collection(db, "users", user.uid, "expenseLogs"), {
        title: activeBill.title,
        category: activeBill.category || "Bills & Utilities",
        vault: payData.sourceVault,
        asset: baseCurrency,
        amount: activeBill.amount,
        exchangeRate: 1,
        finalBaseAmount: activeBill.amount,
        date: payData.date,
        timestamp,
        linkedExpenseId: payId,
        billId: activeBill.id, 
        isSplit: false
      });

      // 3. Update Bill Reminder Status (Auto-Renew if recurring)
      if (activeBill.frequency === 'one-time') {
        await updateDoc(doc(db, "users", user.uid, "billReminders", activeBill.id), { isPaid: true, lastPaidDate: payData.date });
      } else {
        // Calculate Next Due Date
        const currentDue = new Date(activeBill.dueDate);
        if (activeBill.frequency === 'monthly') currentDue.setMonth(currentDue.getMonth() + 1);
        if (activeBill.frequency === 'yearly') currentDue.setFullYear(currentDue.getFullYear() + 1);
        
        await updateDoc(doc(db, "users", user.uid, "billReminders", activeBill.id), { 
          dueDate: currentDue.toISOString().split('T')[0], 
          lastPaidDate: payData.date 
        });
      }

      setIsPayModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Payment sync failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 🚀 FIXED: INITIATE SECURE DELETE (ALWAYS ASKS FOR PIN)
  const initiateSecureDelete = (bill) => {
    setDeleteContext(bill);
    setPinInput('');
    setPinError('');
  };

  // 🚀 EXECUTE SECURE DELETE & REFUND ENGINE
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
        setPinError("Incorrect PIN. Deletion blocked! 🛑");
        setIsVerifying(false);
        return;
      }

      // 1. Always Delete the Bill Reminder itself
      await deleteDoc(doc(db, "users", user.uid, "billReminders", deleteContext.id));

      // 2. Clean up history logs referencing this Bill to restore funds to Vault (If paid)
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

      setDeleteContext(null); 
    } catch (error) {
      console.error(error);
      setPinError("System error during deletion.");
    } finally {
      setIsVerifying(false);
    }
  };

  const getVaultIcon = (v) => {
    if (v === 'bank') return <FaUniversity />;
    if (v === 'cash') return <FaMoneyBillWave />;
    if (v === 'crypto') return <FaBitcoin />;
    return <FaWallet />;
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* 🚀 HEADER */}
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

      {/* 📊 SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] shadow-xl relative overflow-hidden border border-slate-800">
          <div className="absolute right-0 top-0 opacity-10 text-white -mt-4 -mr-4"><HiOutlineCreditCard size={150}/></div>
          <div className="relative z-10">
            <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Total Upcoming (Unpaid)</p>
            <h2 className="text-4xl font-black text-white tracking-tighter">
              <span className="text-blue-500 mr-2">{currencySymbol}</span>{totalUpcoming.toLocaleString()}
            </h2>
          </div>
        </div>
        <div className="p-8 bg-rose-50 dark:bg-rose-500/10 rounded-[2rem] shadow-sm relative overflow-hidden border border-rose-200 dark:border-rose-500/20">
          <div className="absolute right-0 top-0 opacity-10 text-rose-500 -mt-4 -mr-4"><HiOutlineExclamationCircle size={150}/></div>
          <div className="relative z-10">
            <p className="text-xs font-black text-rose-500 uppercase tracking-widest mb-1">Total Overdue Alerts</p>
            <h2 className="text-4xl font-black text-rose-600 dark:text-rose-400 tracking-tighter">
              <span className="text-rose-400 mr-2">{currencySymbol}</span>{totalOverdue.toLocaleString()}
            </h2>
          </div>
        </div>
      </div>

      {/* 🧾 BILLS GRID */}
      {isLoading ? (
         <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading reminders...</div>
      ) : bills.length === 0 ? (
         <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
           <HiOutlineCalendar className="mx-auto text-6xl text-slate-300 dark:text-slate-700 mb-4" />
           <h3 className="text-2xl font-black text-slate-700 dark:text-white">No Bills Added</h3>
           <p className="text-slate-500 font-semibold mt-2">Add your Netflix, Rent, or Credit Card bills to track them here.</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bills.map((bill) => {
            const status = getBillStatus(bill.dueDate, bill.isPaid);

            return (
              <div key={bill.id} className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-xl ${status.isOverdue ? 'border-rose-300 dark:border-rose-500/50 shadow-rose-500/10' : 'border-slate-200 dark:border-slate-800'}`}>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  {/* 🚀 ALWAYS TRIGGERS SECURE DELETE MODAL */}
                  <button onClick={() => initiateSecureDelete(bill)} className="text-slate-400 hover:text-rose-500 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><HiOutlineTrash size={18}/></button>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight mb-1">{bill.title}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <HiOutlineRefresh size={12}/> {bill.frequency}
                  </p>
                </div>

                <div className="mt-auto space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-3xl font-black tracking-tighter dark:text-white">{currencySymbol}{Number(bill.amount).toLocaleString()}</span>
                    {/* 🚀 GLOBAL DATE FOR DUE DATE IN BILL CARD */}
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <HiOutlineClock/> Due: {formatGlobalDate ? formatGlobalDate(bill.dueDate, 'short') : bill.dueDate}
                    </span>
                  </div>

                  {!bill.isPaid && (
                    <button onClick={() => { setActiveBill(bill); setIsPayModalOpen(true); }} className="w-full py-3.5 bg-blue-50 hover:bg-blue-600 dark:bg-blue-500/10 text-blue-600 hover:text-white dark:text-blue-400 rounded-xl font-black text-sm transition-all active:scale-95 flex justify-center items-center gap-2 border border-blue-100 dark:border-blue-500/20">
                      <HiOutlineCheckCircle size={20}/> Mark as Paid
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🚀 ADD BILL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            <div className="px-6 py-5 flex justify-between items-center bg-blue-600 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineCalendar size={24}/> Add Reminder</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={20}/></button>
            </div>
            <form onSubmit={handleSaveBill} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Subscription / Bill Name</label>
                <input type="text" required autoFocus value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Netflix, Rent, EMI..." className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount Due ({currencySymbol})</label>
                <input type="number" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="e.g. 1500" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-2xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* 🚀 GLOBAL DATE APPLIED FOR DUE DATE */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                    <span>Due Date</span>
                  </label>
                  <input type="date" required value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                  <span className="block text-[10px] font-bold text-blue-500 mt-1 pl-1">{formatGlobalDate ? formatGlobalDate(formData.dueDate, 'short') : ''}</span>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Frequency</label>
                  <select value={formData.frequency} onChange={(e) => setFormData({...formData, frequency: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50">
                    <option value="one-time">One Time</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isProcessing} className="w-full p-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 flex justify-center items-center">
                {isProcessing ? 'Saving...' : 'Save Reminder'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 💸 PAY BILL MODAL (AUTO-SYNC ENGINE) */}
      {isPayModalOpen && activeBill && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-emerald-500 text-white shrink-0">
              <h3 className="text-lg font-black flex items-center gap-2"><HiOutlineCheckCircle size={24}/> Settle Bill</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><HiOutlineX size={20}/></button>
            </div>
            
            <form onSubmit={handlePayBill} className="p-6 space-y-6">
              
              <div className="text-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Paying for</p>
                <p className="text-xl font-black dark:text-white">{activeBill.title}</p>
                <p className="text-2xl font-black text-emerald-500 mt-1">{currencySymbol}{Number(activeBill.amount).toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Pay From Vault</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {['bank', 'cash', 'online', 'crypto'].map(v => (
                    <button key={v} type="button" onClick={() => setPayData({...payData, sourceVault: v})} className={`py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-2 ${payData.sourceVault === v ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}>
                      {getVaultIcon(v)} {v}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] font-bold text-slate-400 text-center mt-2 px-4">
                  Payment will be auto-deducted from this vault and logged as an Expense.
                </p>
              </div>

              {/* 🚀 GLOBAL DATE APPLIED FOR PAYMENT DATE */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Payment Date</span>
                  <span className="text-emerald-500">{formatGlobalDate ? formatGlobalDate(payData.date, 'short') : ''}</span>
                </label>
                <input type="date" required value={payData.date} onChange={(e) => setPayData({...payData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>

              <button type="submit" disabled={isProcessing} className="w-full p-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 disabled:opacity-70 flex justify-center items-center">
                {isProcessing ? 'Processing...' : 'Confirm & Log Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 SECURE DELETE BILL MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 dark:border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-full flex items-center justify-center text-3xl mb-4">
                <HiOutlineLockClosed />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              
              {/* ⚠️ DYNAMIC WARNING FOR PAID VS UNPAID */}
              {deleteContext.lastPaidDate || deleteContext.isPaid ? (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                    <HiOutlineExclamationCircle size={16} className="shrink-0" />
                    WARNING: This bill was previously marked as Paid. Deleting it will restore the funds back to your Vault and remove the logs from Expense Tracker to keep balances accurate.
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl">
                  <p className="text-xs font-black text-blue-700 dark:text-blue-400 flex items-start gap-1 text-left">
                    <HiOutlineInformationCircle size={16} className="shrink-0" />
                    NOTICE: This is an unpaid reminder. Deleting it will permanently remove it from your upcoming bills list.
                  </p>
                </div>
              )}
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
                {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce mt-2">{pinError}</p>}
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

    </div>
  );
};

export default BillPayments;