import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAIVoice } from '../../hooks/useAIVoice'; 
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, where, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineCheckCircle, HiOutlineClock, HiOutlineTrendingUp,
  HiOutlineShieldCheck, HiOutlineSparkles, HiOutlineLockClosed,
  HiOutlineExclamationCircle
} from 'react-icons/hi';
import { FaTrophy, FaPiggyBank, FaStar, FaUniversity, FaMoneyBillWave, FaLock, FaUnlockAlt, FaWallet } from 'react-icons/fa';

// 🚀 SECURE SHA-256 HASHING ALGORITHM
const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const Goals = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'INR', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  
  const { speak } = useAIVoice(); 

  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false); 
  const [editingId, setEditingId] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 🔐 Security Delete States
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    title: '',
    targetAmount: '',
    deadline: '',
  });

  const [fundData, setFundData] = useState({
    amount: '',
    sourceVault: 'bank', 
    subWallet: '', // 🚀 NEW: Added SubWallet Tracker
    date: todayDate
  });

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

  // 📥 Fetch Goals
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "savingsGoals"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 🧮 Stats Calculation
  const totalTarget = goals.reduce((acc, g) => acc + Number(g.targetAmount), 0);
  const totalSaved = goals.reduce((acc, g) => acc + Number(g.currentSaved || 0), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const getAiMessage = (progress, remaining) => {
    if (progress >= 100) return { text: "Goal Achieved! You did it! 🎉", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" };
    if (progress >= 80) return { text: `Almost there! Just ${currencySymbol}${remaining.toLocaleString()} left. 🚀`, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" };
    if (progress >= 50) return { text: "🔥 You're halfway there! Keep the momentum going.", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" };
    if (progress > 0) return { text: "Great start! Consistency is the key to wealth. 📈", color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10" };
    return { text: "Set your target and start saving today! 🎯", color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800" };
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsProcessing(true);

    const goalRecord = {
      title: formData.title,
      targetAmount: parseFloat(formData.targetAmount),
      deadline: formData.deadline,
      timestamp: editingId ? goals.find(g => g.id === editingId)?.timestamp : new Date().getTime(),
      currentSaved: editingId ? goals.find(g => g.id === editingId)?.currentSaved : 0,
      status: 'active'
    };

    try {
      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "savingsGoals", editingId), goalRecord, { merge: true });
      } else {
        await addDoc(collection(db, "users", user.uid, "savingsGoals"), goalRecord);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert("Failed to save goal.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔒 LOCK FUNDS INTO GOAL
  const handleAddFunds = async (e) => {
    e.preventDefault();
    if (!user || !activeGoal) return;

    const addAmount = parseFloat(fundData.amount);
    if (addAmount <= 0) return alert("Amount must be greater than 0");
    if ((fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') && !fundData.subWallet.trim()) {
        return alert("Please specify the exact Bank or Wallet Name.");
    }

    setIsProcessing(true);
    
    const oldSavedAmount = activeGoal.currentSaved || 0;
    const newSavedAmount = oldSavedAmount + addAmount;
    const target = activeGoal.targetAmount;
    
    const oldProgress = (oldSavedAmount / target) * 100;
    const newProgress = (newSavedAmount / target) * 100;
    const isCompleted = newSavedAmount >= target;
    
    const timestamp = new Date(fundData.date).getTime();
    const lockId = `LOCK_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    try {
      await setDoc(doc(db, "users", user.uid, "savingsGoals", activeGoal.id), {
        currentSaved: newSavedAmount,
        status: isCompleted ? 'achieved' : 'active'
      }, { merge: true });

      const vaultCollection = fundData.sourceVault === 'bank' ? 'bankWallet' : 
                              fundData.sourceVault === 'online' ? 'onlineWallet' : 'cashWallet';
      
      const vaultRecord = {
        title: `Locked for Goal: ${activeGoal.title}`,
        type: 'out',
        date: fundData.date,
        timestamp,
        currency: baseCurrency,
        foreignAmount: addAmount,
        exchangeRate: 1,
        finalBaseAmount: addAmount,
        fee: 0,
        isGoalLock: true,
        linkedExpenseId: lockId,
        walletName: fundData.subWallet.trim() || 'Savings Lock', // 🚀 Accurate Vault Info
        bankName: fundData.subWallet.trim() || 'Savings Lock',   // 🚀 Accurate Vault Info
        transferType: 'Investment/Savings',
        goalId: activeGoal.id 
      };
      await addDoc(collection(db, "users", user.uid, vaultCollection), vaultRecord);

      await addDoc(collection(db, "users", user.uid, "expenseLogs"), {
        title: `Goal Contribution: ${activeGoal.title}`,
        category: "Investments & Interest",
        vault: fundData.sourceVault,
        subWallet: fundData.sourceVault === 'bank' || fundData.sourceVault === 'online' ? fundData.subWallet.trim() : '', // 🚀 Accurate Expense Sync
        asset: baseCurrency,
        amount: addAmount,
        exchangeRate: 1,
        finalBaseAmount: addAmount,
        date: fundData.date,
        timestamp,
        linkedExpenseId: lockId,
        goalId: activeGoal.id, 
        isSplit: false
      });

      let milestoneMsg = "";
      let notifTitle = "";

      if (oldProgress < 100 && newProgress >= 100) {
          milestoneMsg = `Congratulations! You have fully achieved your goal for ${activeGoal.title}. You are a financial rockstar!`;
          notifTitle = "Goal Achieved! 🎉";
      } else if (oldProgress < 75 && newProgress >= 75) {
          milestoneMsg = `Amazing! You are 75 percent close to your ${activeGoal.title} goal. Just a little more to go.`;
          notifTitle = "75% Milestone Reached! 🚀";
      } else if (oldProgress < 50 && newProgress >= 50) {
          milestoneMsg = `Great job! You are halfway there. 50 percent of your ${activeGoal.title} goal is complete.`;
          notifTitle = "50% Halfway There! 🔥";
      } else if (oldProgress < 25 && newProgress >= 25) {
          milestoneMsg = `Good start! You have reached 25 percent of your ${activeGoal.title} goal.`;
          notifTitle = "25% Milestone Reached! 📈";
      }

      if (milestoneMsg !== "") {
          if (speak) speak(milestoneMsg); 
          await addDoc(collection(db, "users", user.uid, "notifications"), {
             title: notifTitle, message: milestoneMsg, type: "goal_milestone", isRead: false,
             timestamp: new Date().getTime(), link: "/dashboard/goals"
          });
      }

      setIsFundModalOpen(false);
      setFundData({ amount: '', sourceVault: 'bank', subWallet: existingVaultNames[0] || '', date: todayDate });
    } catch (error) {
      alert("Failed to lock funds.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔓 RELEASE FUNDS FROM GOAL
  const handleReleaseFunds = async (e) => {
    e.preventDefault();
    if (!user || !activeGoal) return;

    const releaseAmount = parseFloat(fundData.amount);
    if (releaseAmount <= 0) return alert("Amount must be greater than 0");
    if (releaseAmount > (activeGoal.currentSaved || 0)) {
       return alert(`You only have ${currencySymbol}${activeGoal.currentSaved} saved. Cannot release more than that.`);
    }
    if ((fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') && !fundData.subWallet.trim()) {
        return alert("Please specify the exact Bank or Wallet Name to receive funds.");
    }

    setIsProcessing(true);
    
    const newSavedAmount = (activeGoal.currentSaved || 0) - releaseAmount;
    const isCompleted = newSavedAmount >= activeGoal.targetAmount;
    
    const timestamp = new Date(fundData.date).getTime();
    const releaseId = `RELEASE_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    try {
      await setDoc(doc(db, "users", user.uid, "savingsGoals", activeGoal.id), {
        currentSaved: newSavedAmount,
        status: isCompleted ? 'achieved' : 'active'
      }, { merge: true });

      const vaultCollection = fundData.sourceVault === 'bank' ? 'bankWallet' : 
                              fundData.sourceVault === 'online' ? 'onlineWallet' : 'cashWallet';

      const vaultRecord = {
        title: `Funds Released from: ${activeGoal.title}`,
        type: 'in', 
        date: fundData.date,
        timestamp,
        currency: baseCurrency,
        foreignAmount: releaseAmount,
        exchangeRate: 1,
        finalBaseAmount: releaseAmount,
        fee: 0,
        isGoalLock: true,
        linkedIncomeId: releaseId,
        walletName: fundData.subWallet.trim() || 'Savings Unlock', // 🚀 Accurate Vault Refund
        bankName: fundData.subWallet.trim() || 'Savings Unlock',   // 🚀 Accurate Vault Refund
        transferType: 'Refund/Reversal',
        goalId: activeGoal.id
      };
      await addDoc(collection(db, "users", user.uid, vaultCollection), vaultRecord);

      await addDoc(collection(db, "users", user.uid, "incomeLogs"), {
        title: `Goal Funds Released: ${activeGoal.title}`,
        category: "Other Income",
        vault: fundData.sourceVault,
        subWallet: fundData.sourceVault === 'bank' || fundData.sourceVault === 'online' ? fundData.subWallet.trim() : '', // 🚀 Accurate Income Sync
        asset: baseCurrency,
        amount: releaseAmount,
        exchangeRate: 1,
        finalBaseAmount: releaseAmount,
        date: fundData.date,
        timestamp,
        linkedIncomeId: releaseId,
        goalId: activeGoal.id
      });

      setIsReleaseModalOpen(false);
      setFundData({ amount: '', sourceVault: 'bank', subWallet: existingVaultNames[0] || '', date: todayDate });
    } catch (error) {
      alert("Failed to release funds.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔐 INITIATE SECURE DELETE
  const initiateSecureDelete = (goal) => {
    setDeleteContext(goal);
    setPinInput('');
    setPinError('');
  };

  // 🔐 EXECUTE SECURE DELETE & REFUND ENGINE
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

      const currentSavedAmount = deleteContext.currentSaved || 0;

      // 1. Delete the Goal
      await deleteDoc(doc(db, "users", user.uid, "savingsGoals", deleteContext.id));

      // 2. If it had funds, REFUND it to Bank
      if (currentSavedAmount > 0) {
         const timestamp = new Date().getTime();
         const refundId = `REFUND_CANCEL_${timestamp}`;

         // Auto-Refund to Bank
         await addDoc(collection(db, "users", user.uid, "bankWallet"), {
            title: `Goal Canceled Refund: ${deleteContext.title}`,
            type: 'in', date: todayDate, timestamp, currency: baseCurrency, foreignAmount: currentSavedAmount, 
            exchangeRate: 1, finalBaseAmount: currentSavedAmount, fee: 0, isGoalLock: true,
            linkedIncomeId: refundId, walletName: 'Auto Refund', transferType: 'Refund/Reversal'
         });

         // Log as Income (Adjustment)
         await addDoc(collection(db, "users", user.uid, "incomeLogs"), {
            title: `Goal Canceled Refund: ${deleteContext.title}`,
            category: "Other Income", vault: "bank", asset: baseCurrency, amount: currentSavedAmount, 
            exchangeRate: 1, finalBaseAmount: currentSavedAmount, date: todayDate, timestamp, linkedIncomeId: refundId,
         });
      }

      // 3. Clean up history logs referencing this Goal (Optional but keeps it clean)
      const cleanQueries = [
         { col: "expenseLogs", field: "goalId" },
         { col: "incomeLogs", field: "goalId" },
         { col: "bankWallet", field: "goalId" },
         { col: "cashWallet", field: "goalId" },
         { col: "onlineWallet", field: "goalId" }
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

  const openEditModal = (goal) => {
    setFormData({ title: goal.title, targetAmount: goal.targetAmount, deadline: goal.deadline || '' });
    setEditingId(goal.id);
    setIsModalOpen(true);
  };

  const openFundModal = (goal) => {
    setActiveGoal(goal);
    const lastBank = existingVaultNames.length > 0 ? existingVaultNames[0] : '';
    setFundData({ amount: '', sourceVault: 'bank', subWallet: lastBank, date: todayDate });
    setIsFundModalOpen(true);
  };

  const openReleaseModal = (goal) => {
    setActiveGoal(goal);
    const lastBank = existingVaultNames.length > 0 ? existingVaultNames[0] : '';
    setFundData({ amount: '', sourceVault: 'bank', subWallet: lastBank, date: todayDate });
    setIsReleaseModalOpen(true);
  };

  const getVaultIcon = (v) => {
    if (v === 'bank') return <FaUniversity />;
    if (v === 'cash') return <FaMoneyBillWave />;
    if (v === 'online') return <FaWallet />;
    return <FaUniversity />;
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* 🚀 HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-yellow-500/10 text-yellow-600 rounded-3xl ring-1 ring-yellow-500/20 shadow-lg">
              <FaTrophy size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Goals & Savings</h1>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
                Set targets, track progress, and securely lock funds from your Bank or Cash Vaults.
              </p>
            </div>
          </div>
        </div>
        <button onClick={() => { setEditingId(null); setFormData({title:'', targetAmount:'', deadline:''}); setIsModalOpen(true); }} className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-7 py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-yellow-500/30 transition-all active:scale-95 whitespace-nowrap">
          <HiOutlinePlus size={20} /> Create Target
        </button>
      </div>

      {/* 📊 MASTER PROGRESS CARD */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-black dark:to-slate-900 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col md:flex-row items-center gap-8 md:gap-12">
        <div className="absolute right-[-5%] top-[-20%] opacity-5 text-white blur-[2px] pointer-events-none"><FaPiggyBank size={350}/></div>
        
        <div className="relative z-10 flex-1 w-full">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
            <FaLock className="text-yellow-500"/> Total Locked Savings
          </p>
          <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-6 drop-shadow-md">
            <span className="text-yellow-500 mr-2">{currencySymbol}</span>
            {totalSaved.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
          
          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="flex justify-between items-end mb-3">
              <span className="text-sm font-black text-white">Overall Progress</span>
              <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Target: {currencySymbol}{totalTarget.toLocaleString()}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner relative">
              <div className="absolute inset-0 bg-white/5"></div>
              <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 h-3 rounded-full transition-all duration-1000 relative" style={{ width: `${Math.min(overallProgress, 100)}%` }}>
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/30 blur-[2px]"></div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-2 text-right">{overallProgress.toFixed(1)}% Completed</p>
          </div>
        </div>
      </div>

      {/* 🎯 GOALS GRID */}
      {isLoading ? (
         <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading your targets...</div>
      ) : goals.length === 0 ? (
         <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
           <FaStar className="mx-auto text-6xl text-yellow-400 mb-4 drop-shadow-lg" />
           <h3 className="text-2xl font-black text-slate-700 dark:text-white">No Goals Set Yet!</h3>
           <p className="text-slate-500 font-semibold mt-2">Start by creating a target for an Emergency Fund, New Car, or Vacation.</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const progress = (goal.currentSaved / goal.targetAmount) * 100;
            const remaining = Math.max(0, goal.targetAmount - (goal.currentSaved || 0));
            const isDone = goal.status === 'achieved' || progress >= 100;
            const aiMsg = getAiMessage(progress, remaining);

            return (
              <div key={goal.id} className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 ${isDone ? 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/10' : 'border-slate-200 dark:border-slate-800'}`}>
                
                {isDone && <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>}

                <div className="flex justify-between items-start mb-5 z-10">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm border ${isDone ? 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:border-emerald-500/30' : 'bg-slate-50 border-slate-100 text-yellow-500 dark:bg-slate-800 dark:border-slate-700'}`}>
                    {isDone ? <HiOutlineCheckCircle size={32}/> : <FaTrophy />}
                  </div>
                  <div className="flex gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    <button onClick={() => openEditModal(goal)} className="text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"><HiOutlinePencil size={16}/></button>
                    <button onClick={() => initiateSecureDelete(goal)} className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"><HiOutlineTrash size={16}/></button>
                  </div>
                </div>

                <div className="mb-5 z-10">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight mb-1 line-clamp-1">{goal.title}</h3>
                  {goal.deadline && (
                    /* 🚀 GLOBAL DATE FOR GOAL TARGET DATE */
                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                      <HiOutlineClock/> Target Date: {formatGlobalDate ? formatGlobalDate(goal.deadline, 'short') : goal.deadline}
                    </p>
                  )}
                </div>

                <div className="mt-auto z-10 space-y-4">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-3xl font-black tracking-tighter dark:text-white">{currencySymbol}{(goal.currentSaved || 0).toLocaleString()}</span>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">/ {goal.targetAmount.toLocaleString()}</span>
                    </div>
                    
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner relative">
                      <div className={`h-3 rounded-full transition-all duration-1000 relative ${isDone ? 'bg-emerald-500' : 'bg-yellow-500'}`} style={{ width: `${Math.min(progress, 100)}%` }}>
                         <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/30 blur-[1px]"></div>
                      </div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl text-[10px] font-bold leading-relaxed border border-transparent ${aiMsg.bg} ${aiMsg.color}`}>
                    {aiMsg.text}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => openFundModal(goal)} className="flex-1 py-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-black text-sm transition-all active:scale-95 flex justify-center items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <HiOutlinePlus size={18}/> Lock
                    </button>
                    {goal.currentSaved > 0 && (
                      <button onClick={() => openReleaseModal(goal)} className="flex-1 py-3.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl font-black text-sm transition-all active:scale-95 flex justify-center items-center gap-2 border border-rose-200 dark:border-rose-900/50 shadow-sm">
                        <FaUnlockAlt size={14}/> Release
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🚀 CREATE/EDIT GOAL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            <div className="px-6 py-5 flex justify-between items-center bg-yellow-500 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><FaTrophy size={20}/> {editingId ? 'Edit Target' : 'Create New Goal'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={20}/></button>
            </div>
            <form onSubmit={handleSaveGoal} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">What are you saving for?</label>
                <input type="text" required autoFocus value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. New Laptop, Vacation..." className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Amount ({currencySymbol})</label>
                <input type="number" required value={formData.targetAmount} onChange={(e) => setFormData({...formData, targetAmount: e.target.value})} placeholder="e.g. 50000" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-2xl dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all" />
              </div>
              
              {/* 🚀 GLOBAL DATE FOR GOAL INPUT */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Target Date (Optional)</span>
                </label>
                <input type="date" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all" />
                {formData.deadline && (
                  <span className="block text-[10px] font-bold text-yellow-600 pl-1 mt-1">{formatGlobalDate ? formatGlobalDate(formData.deadline, 'full') : ''}</span>
                )}
              </div>
              <button type="submit" disabled={isProcessing} className="w-full p-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-yellow-500 hover:bg-yellow-600 shadow-xl shadow-yellow-500/20 disabled:opacity-70 flex justify-center items-center">
                {isProcessing ? 'Processing...' : (editingId ? 'Update Goal' : 'Launch Target')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 💰 ADD FUNDS MODAL (LOCK) */}
      {isFundModalOpen && activeGoal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-emerald-500 text-white shrink-0">
              <h3 className="text-lg font-black flex items-center gap-2"><HiOutlineShieldCheck size={24}/> Secure Funds</h3>
              <button onClick={() => setIsFundModalOpen(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><HiOutlineX size={20}/></button>
            </div>
            
            <form onSubmit={handleAddFunds} className="p-6 space-y-6">
              <div className="text-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Locking funds for</p>
                <p className="text-xl font-black dark:text-white">{activeGoal.title}</p>
                <p className="text-[11px] font-bold text-slate-500 mt-1">Needs {currencySymbol}{(activeGoal.targetAmount - activeGoal.currentSaved).toLocaleString()} more to complete.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Source Vault</label>
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <button type="button" onClick={() => setFundData({...fundData, sourceVault: 'bank'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-2 ${fundData.sourceVault === 'bank' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}>
                    <FaUniversity/> Bank
                  </button>
                  <button type="button" onClick={() => setFundData({...fundData, sourceVault: 'online'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-2 ${fundData.sourceVault === 'online' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-400 hover:text-slate-600'}`}>
                    <FaWallet/> Online
                  </button>
                  <button type="button" onClick={() => setFundData({...fundData, sourceVault: 'cash'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-2 ${fundData.sourceVault === 'cash' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'}`}>
                    <FaMoneyBillWave/> Cash
                  </button>
                </div>
              </div>

              {/* 🚀 SUB-WALLET NAME SELECTOR */}
              {(fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest ml-1">{fundData.sourceVault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
                  <input type="text" list="fund-vaults" required value={fundData.subWallet} onChange={(e) => setFundData({...fundData, subWallet: e.target.value})} placeholder={fundData.sourceVault === 'bank' ? "e.g. HDFC, SBI" : "e.g. Paytm, PayPal"} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                  <datalist id="fund-vaults">
                     {existingVaultNames.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount to Lock In</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">{currencySymbol}</span>
                  <input type="number" step="any" required autoFocus value={fundData.amount} onChange={(e) => setFundData({...fundData, amount: e.target.value})} placeholder="0" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-3xl dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all tracking-tight" />
                </div>
              </div>

              {/* 🚀 GLOBAL DATE FOR ADD FUNDS */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Date</span>
                  <span className="text-emerald-500">{formatGlobalDate ? formatGlobalDate(fundData.date, 'short') : ''}</span>
                </label>
                <input type="date" required value={fundData.date} onChange={(e) => setFundData({...fundData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
              </div>

              <button type="submit" disabled={isProcessing} className="w-full p-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 disabled:opacity-70 flex justify-center items-center">
                {isProcessing ? 'Locking...' : 'Confirm & Deduct from Vault'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔓 RELEASE FUNDS MODAL */}
      {isReleaseModalOpen && activeGoal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-rose-500 text-white shrink-0">
              <h3 className="text-lg font-black flex items-center gap-2"><FaUnlockAlt size={20}/> Release Funds</h3>
              <button onClick={() => setIsReleaseModalOpen(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><HiOutlineX size={20}/></button>
            </div>
            
            <form onSubmit={handleReleaseFunds} className="p-6 space-y-6">
              <div className="text-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Withdrawing from</p>
                <p className="text-xl font-black dark:text-white">{activeGoal.title}</p>
                <p className="text-[11px] font-bold text-emerald-500 mt-1">Available to withdraw: {currencySymbol}{(activeGoal.currentSaved || 0).toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Send Back To Vault</label>
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <button type="button" onClick={() => setFundData({...fundData, sourceVault: 'bank'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-2 ${fundData.sourceVault === 'bank' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}>
                    <FaUniversity/> Bank
                  </button>
                  <button type="button" onClick={() => setFundData({...fundData, sourceVault: 'online'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-2 ${fundData.sourceVault === 'online' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-400 hover:text-slate-600'}`}>
                    <FaWallet/> Online
                  </button>
                  <button type="button" onClick={() => setFundData({...fundData, sourceVault: 'cash'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-2 ${fundData.sourceVault === 'cash' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'}`}>
                    <FaMoneyBillWave/> Cash
                  </button>
                </div>
              </div>

              {/* 🚀 SUB-WALLET NAME SELECTOR */}
              {(fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest ml-1">{fundData.sourceVault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
                  <input type="text" list="release-vaults" required value={fundData.subWallet} onChange={(e) => setFundData({...fundData, subWallet: e.target.value})} placeholder={fundData.sourceVault === 'bank' ? "e.g. HDFC, SBI" : "e.g. Paytm, PayPal"} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                  <datalist id="release-vaults">
                     {existingVaultNames.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount to Release</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">{currencySymbol}</span>
                  <input type="number" step="any" required autoFocus value={fundData.amount} onChange={(e) => setFundData({...fundData, amount: e.target.value})} placeholder="0" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-3xl dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all tracking-tight" />
                </div>
              </div>

              {/* 🚀 GLOBAL DATE FOR RELEASE FUNDS */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Date</span>
                  <span className="text-rose-500">{formatGlobalDate ? formatGlobalDate(fundData.date, 'short') : ''}</span>
                </label>
                <input type="date" required value={fundData.date} onChange={(e) => setFundData({...fundData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all" />
              </div>

              <button type="submit" disabled={isProcessing} className="w-full p-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-500/20 disabled:opacity-70 flex justify-center items-center">
                {isProcessing ? 'Processing...' : 'Withdraw & Sync to Vault'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 SECURE DELETE GOAL MODAL */}
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
                You are about to cancel this Goal permanently.
              </p>
              
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                  <HiOutlineExclamationCircle size={16} className="shrink-0" />
                  WARNING: The remaining locked amount of {currencySymbol}{(deleteContext.currentSaved || 0).toLocaleString()} will be automatically refunded to your Default Bank Vault. All related tracking logs will be wiped.
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

    </div>
  );
};

export default Goals;