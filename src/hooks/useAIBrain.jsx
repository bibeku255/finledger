import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from './useAuth';
import { useAIVoice } from './useAIVoice'; 

export const useAIBrain = () => {
  const { user, baseCurrency = 'USD' } = useAuth();
  const { speak } = useAIVoice(); 
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [stakingAlerts, setStakingAlerts] = useState([]);
  const [expenseAlerts, setExpenseAlerts] = useState([]);
  const [billAlerts, setBillAlerts] = useState([]); 
  const [loanAlerts, setLoanAlerts] = useState([]); 
  const [vaultAlerts, setVaultAlerts] = useState([]); 
  const [isBrainLoading, setIsBrainLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let loadedModules = { bank: false, cash: false, online: false, stake: false, exp: false, bill: false, loan: false };
    const checkLoading = () => {
      if (Object.values(loadedModules).every(Boolean)) setIsBrainLoading(false);
    };

    // 🚀 1. LOW BALANCE VAULT MONITOR
    const lowBalanceThreshold = ['USD', 'EUR', 'GBP', 'AUD', 'CAD'].includes(baseCurrency) ? 50 : 1000;

    const monitorVault = (vaultCollection, vaultDisplayName, linkPath, moduleKey) => {
      return onSnapshot(collection(db, "users", user.uid, vaultCollection), async (snap) => {
        let totalBalance = 0;
        
        // Calculate real-time balance safely (same as Analytics logic)
        snap.docs.forEach(doc => {
          const data = doc.data();
          const finalAmount = Number(data.finalBaseAmount || data.amount || 0);
          let feeAmount = 0;
          
          if (data.fee && data.feeExchangeRate) {
            feeAmount = Number(data.fee) * Number(data.feeExchangeRate);
          } else if (data.fee && data.exchangeRate) { 
            feeAmount = Number(data.fee) * Number(data.exchangeRate);
          } else if (data.fee) {
            feeAmount = Number(data.fee);
          }

          const netChange = data.type === 'in' ? finalAmount : -(finalAmount + feeAmount);
          totalBalance += netChange;
        });

        // Trigger Alert if balance drops between 0.01 and the Threshold
        if (totalBalance > 0 && totalBalance <= lowBalanceThreshold) {
          const todayDate = new Date().toISOString().split('T')[0];
          const uniqueNotifId = `LOW_BAL_${vaultCollection}_${todayDate}`;

          // Push to UI Context
          setVaultAlerts(prev => {
            const filtered = prev.filter(a => a.id !== `low_bal_${vaultCollection}`);
            return [...filtered, {
              id: `low_bal_${vaultCollection}`,
              type: 'CRITICAL ALERT',
              iconType: 'trendDown',
              title: `Low Balance: ${vaultDisplayName}`,
              message: `Your ${vaultDisplayName} balance is critically low (${currencySymbol}${totalBalance.toFixed(2)}). Replenish funds to avoid failures.`,
              actionText: 'View Vault',
              actionLink: linkPath
            }];
          });

          // Push to Firebase Notifications (Silent trigger)
          const notifQ = query(collection(db, "users", user.uid, "notifications"), where("uniqueId", "==", uniqueNotifId));
          const notifSnap = await getDocs(notifQ);

          if (notifSnap.empty) {
            try {
              await addDoc(collection(db, "users", user.uid, "notifications"), {
                uniqueId: uniqueNotifId,
                title: `Low ${vaultDisplayName} Balance! 📉`,
                message: `Available balance dropped to ${currencySymbol}${totalBalance.toFixed(2)}.`,
                type: 'system_alert',
                isRead: false,
                timestamp: new Date().getTime(),
                link: linkPath
              });

              if (speak) speak(`Warning. Your ${vaultDisplayName} balance is running low.`);
            } catch(e) { console.error("JARVIS: Failed to log vault alert"); }
          }
        } else {
          // Remove from J.A.R.V.I.S UI if user adds money above the threshold
          setVaultAlerts(prev => prev.filter(a => a.id !== `low_bal_${vaultCollection}`));
        }
        
        loadedModules[moduleKey] = true;
        checkLoading();
      });
    };

    // Attach real-time listeners for all 3 Fiat Vaults
    const unsubBank = monitorVault("bankWallet", "Bank Vault", "/dashboard/accounts/bank", "bank");
    const unsubCash = monitorVault("cashWallet", "Physical Cash", "/dashboard/accounts/cash", "cash");
    const unsubOnline = monitorVault("onlineWallet", "Online Wallet", "/dashboard/accounts/online", "online");


    // 🚀 2. STAKING & YIELD MONITOR
    const unsubStaking = onSnapshot(query(collection(db, "users", user.uid, "stakingLogs")), (snapshot) => {
      const stakes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const newStakingAlerts = [];
      const today = new Date();
      today.setHours(0,0,0,0); // Normalize today for strict comparison

      stakes.forEach(stake => {
        // Handle Lock/Fixed Staking
        if (stake.lockPeriod && stake.lockPeriod !== 'Flexible') {
          const startDate = new Date(stake.startDate);
          const lockDays = parseInt(stake.lockPeriod);
          const expiryDate = new Date(startDate);
          expiryDate.setDate(expiryDate.getDate() + lockDays);
          expiryDate.setHours(0,0,0,0);

          if (today >= expiryDate) {
            newStakingAlerts.push({
              id: `stake_unlock_${stake.id}`, type: "Yield Alert", title: "Harvest Ready",
              message: `Sir, your ${lockDays} days lock period for ${stake.coin || stake.platform} has ended. Please claim your rewards to avoid losing compound interest.`,
              iconType: "shield", actionText: "Harvest Now", actionLink: '/dashboard/crypto/staking' 
            });
          }
        }

        // Handle LP / Pool / Custom Yield Tracking
        if (stake.earningType === 'pool') {
          const lastClaim = stake.claimedHistory && stake.claimedHistory.length > 0 
            ? new Date(stake.claimedHistory[stake.claimedHistory.length - 1].timestamp) 
            : new Date(stake.startDate);
            
          const daysSinceLastClaim = Math.floor((today - lastClaim) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLastClaim > 15) {
             newStakingAlerts.push({
               id: `pool_idle_${stake.id}`, type: "Opportunity", title: "Unclaimed LP Yield",
               message: `You haven't claimed your ${stake.platform} Liquidity Pool yields for over 15 days. Check your dashboard and harvest the tokens.`,
               iconType: "bulb", actionText: "Check Platform", actionLink: '/dashboard/crypto/staking' 
             });
          }
        }
      });
      setStakingAlerts(newStakingAlerts);
      loadedModules.stake = true; checkLoading();
    });


    // 🚀 3. EXPENSE MONITOR
    const highExpenseThreshold = ['USD', 'EUR', 'GBP', 'AUD', 'CAD'].includes(baseCurrency) ? 150 : 7500;
    const unsubExpense = onSnapshot(query(collection(db, "users", user.uid, "expenseLogs"), orderBy("timestamp", "desc"), limit(20)), (snapshot) => {
      const expenses = snapshot.docs.map(doc => doc.data());
      let newExpenseAlerts = [];
      const today = new Date();
      
      if (expenses.length > 0) {
        // Find if there is any expense within last 3 days matching threshold
        const recentHighExpense = expenses.find(exp => {
          const amt = parseFloat(exp.finalBaseAmount || exp.amount) || 0;
          const expDate = new Date(exp.timestamp || exp.date);
          const daysAgo = (today - expDate) / (1000 * 60 * 60 * 24);
          return amt >= highExpenseThreshold && daysAgo <= 3 && !exp.isVirtualCrypto && !exp.isGoalLock; // Don't flag app-internal syncs
        });

        if (recentHighExpense) {
           const finalAmountVal = parseFloat(recentHighExpense.finalBaseAmount || recentHighExpense.amount);
           const formattedAmount = finalAmountVal.toLocaleString(undefined, {minimumFractionDigits: 0});
           
           newExpenseAlerts.push({
             id: `high_expense_alert_${recentHighExpense.timestamp || Date.now()}`, type: "Expense Warning", title: "High Recent Expenditure",
             message: `Warning. I detected a high expense of ${currencySymbol}${formattedAmount} in ${recentHighExpense.category || 'Other'}. Please monitor your budget carefully this week.`,
             iconType: "trendDown", actionText: "Review Expenses", actionLink: '/dashboard/expense' 
           });
        }
      }
      setExpenseAlerts(newExpenseAlerts);
      loadedModules.exp = true; checkLoading();
    });


    // 🚀 4. THE BILLS MONITOR 
    const unsubBills = onSnapshot(query(collection(db, "users", user.uid, "billReminders"), where("isPaid", "==", false)), async (snapshot) => {
      const todayDate = new Date().toISOString().split('T')[0];
      const newBillAlerts = [];

      for (const docSnap of snapshot.docs) {
        const bill = docSnap.data();

        if (bill.dueDate && bill.dueDate <= todayDate) {
          const isOverdue = bill.dueDate < todayDate;
          
          newBillAlerts.push({
            id: `bill_${docSnap.id}`, type: isOverdue ? 'CRITICAL ALERT' : 'REMINDER', iconType: isOverdue ? 'trendDown' : 'bulb',
            title: isOverdue ? `Overdue: ${bill.title}` : `Due Today: ${bill.title}`,
            message: `Your bill for ${bill.title} of amount ${currencySymbol}${bill.amount} is ${isOverdue ? `overdue since ${bill.dueDate}` : 'due today'}. Please settle it to avoid penalties.`,
            actionText: 'Settle Bill Now', actionLink: '/dashboard/alerts/bills' 
          });

          // Database Push Notification
          const uniqueNotifId = `BILL_NOTIF_${docSnap.id}_${todayDate}`;
          const notifQ = query(collection(db, "users", user.uid, "notifications"), where("uniqueId", "==", uniqueNotifId));
          const notifSnap = await getDocs(notifQ);

          if (notifSnap.empty) {
            try {
              await addDoc(collection(db, "users", user.uid, "notifications"), {
                uniqueId: uniqueNotifId, title: isOverdue ? 'Overdue Bill Alert! 🚨' : 'Bill Due Today! ⚠️',
                message: `Your ${bill.title} bill of ${currencySymbol}${bill.amount} is pending.`, type: 'bill_alert', isRead: false,
                timestamp: new Date().getTime(), link: '/dashboard/alerts/bills'
              });

              if (speak) {
                speak(isOverdue ? `Urgent attention. Your ${bill.title} bill is overdue.` : `Attention. Your ${bill.title} bill is due today.`);
              }
            } catch(e) { console.error("JARVIS: Failed to log bill alert"); }
          }
        }
      }
      setBillAlerts(newBillAlerts);
      loadedModules.bill = true; checkLoading();
    });


    // 🚀 5. THE FORMAL LOAN (EMI) MONITOR
    const unsubLoans = onSnapshot(query(collection(db, "users", user.uid, "parties"), where("accountType", "==", "loan"), where("status", "==", "active")), async (snapshot) => {
      const todayDate = new Date().toISOString().split('T')[0];
      const newLoanAlerts = [];

      for (const docSnap of snapshot.docs) {
        const loan = docSnap.data();

        if (loan.emiDueDate && loan.netBalance !== 0 && loan.emiDueDate <= todayDate) {
          const isOverdue = loan.emiDueDate < todayDate;
          
          newLoanAlerts.push({
            id: `loan_${docSnap.id}`, type: isOverdue ? 'DEBT ALERT' : 'LOAN REMINDER', iconType: isOverdue ? 'trendDown' : 'shield',
            title: isOverdue ? `Overdue EMI: ${loan.name}` : `EMI Due Today: ${loan.name}`,
            message: `Your EMI installment of ${currencySymbol}${loan.emiAmount} for ${loan.name} is ${isOverdue ? `overdue since ${loan.emiDueDate}` : 'due today'}.`,
            actionText: 'Pay EMI Now', actionLink: `/dashboard/parties/${docSnap.id}` 
          });

          const uniqueNotifId = `LOAN_NOTIF_${docSnap.id}_${todayDate}`;
          const notifQ = query(collection(db, "users", user.uid, "notifications"), where("uniqueId", "==", uniqueNotifId));
          const notifSnap = await getDocs(notifQ);

          if (notifSnap.empty) {
            try {
              await addDoc(collection(db, "users", user.uid, "notifications"), {
                uniqueId: uniqueNotifId, title: isOverdue ? 'Overdue EMI Alert! 🚨' : 'EMI Due Today! 🏦',
                message: `Your ${loan.name} EMI of ${currencySymbol}${loan.emiAmount} is pending.`, type: 'loan_alert', isRead: false,
                timestamp: new Date().getTime(), link: `/dashboard/parties/${docSnap.id}`
              });

              if (speak) speak(`Reminder. Your EMI payment for ${loan.name} is ${isOverdue ? 'overdue' : 'due today'}.`);
            } catch(e) { console.error("JARVIS: Failed to log loan alert"); }
          }
        }
      }
      setLoanAlerts(newLoanAlerts);
      loadedModules.loan = true; checkLoading();
    });

    // Timeout failsafe to clear loader
    const loadingTimeout = setTimeout(() => setIsBrainLoading(false), 3000);

    return () => {
      unsubBank(); unsubCash(); unsubOnline(); 
      unsubStaking(); unsubExpense(); unsubBills(); unsubLoans();
      clearTimeout(loadingTimeout);
    };
  }, [user, baseCurrency, currencySymbol, speak]); 

  // 🚀 Combine ALL alerts into one master array (Memoized to prevent unnecessary re-renders)
  const alerts = useMemo(() => {
    return [...vaultAlerts, ...stakingAlerts, ...expenseAlerts, ...billAlerts, ...loanAlerts];
  }, [vaultAlerts, stakingAlerts, expenseAlerts, billAlerts, loanAlerts]);

  return { alerts, isBrainLoading };
};