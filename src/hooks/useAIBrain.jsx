import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from './useAuth';
import { useAIVoice } from './useAIVoice'; 

export const useAIBrain = () => {
  const { user, baseCurrency = 'INR' } = useAuth();
  const { speak } = useAIVoice(); 
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [stakingAlerts, setStakingAlerts] = useState([]);
  const [expenseAlerts, setExpenseAlerts] = useState([]);
  const [billAlerts, setBillAlerts] = useState([]); 
  const [loanAlerts, setLoanAlerts] = useState([]); 
  const [vaultAlerts, setVaultAlerts] = useState([]); // 🚀 LOW BALANCE STATE ADDED
  const [isBrainLoading, setIsBrainLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // 🚀 1. LOW BALANCE VAULT MONITOR
    const lowBalanceThreshold = ['USD', 'EUR', 'GBP', 'AUD', 'CAD'].includes(baseCurrency) ? 50 : 1000;

    const monitorVault = (vaultCollection, vaultDisplayName, linkPath) => {
      return onSnapshot(collection(db, "users", user.uid, vaultCollection), async (snap) => {
        let totalBalance = 0;
        
        // Calculate real-time balance
        snap.docs.forEach(doc => {
          const data = doc.data();
          const amt = Number(data.finalBaseAmount) || 0;
          totalBalance += data.type === 'in' ? amt : -amt;
        });

        // Trigger Alert if balance drops between 0.01 and the Threshold
        if (totalBalance > 0 && totalBalance <= lowBalanceThreshold) {
          const todayDate = new Date().toISOString().split('T')[0];
          const uniqueNotifId = `LOW_BAL_${vaultCollection}_${todayDate}`;

          // Add to J.A.R.V.I.S UI List
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
            await addDoc(collection(db, "users", user.uid, "notifications"), {
              uniqueId: uniqueNotifId,
              title: `Low ${vaultDisplayName} Balance! 📉`,
              message: `Available balance dropped to ${currencySymbol}${totalBalance.toFixed(2)}.`,
              type: 'system_alert',
              isRead: false,
              timestamp: new Date().getTime(),
              link: linkPath
            });

            if (speak) {
              speak(`Warning. Your ${vaultDisplayName} balance is running low.`);
            }
          }
        } else {
          // Remove from J.A.R.V.I.S UI if user adds money above the threshold
          setVaultAlerts(prev => prev.filter(a => a.id !== `low_bal_${vaultCollection}`));
        }
      });
    };

    // Attach real-time listeners for all 3 Fiat Vaults
    const unsubBank = monitorVault("bankWallet", "Bank Vault", "/dashboard/accounts/bank");
    const unsubCash = monitorVault("cashWallet", "Physical Cash", "/dashboard/accounts/cash");
    const unsubOnline = monitorVault("onlineWallet", "Online Wallet", "/dashboard/accounts/online");


    // 2. STAKING & YIELD MONITOR
    const qStaking = query(collection(db, "users", user.uid, "stakingLogs"));
    const unsubStaking = onSnapshot(qStaking, (snapshot) => {
      const stakes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const newStakingAlerts = [];
      const today = new Date();

      stakes.forEach(stake => {
        if (stake.lockPeriod && stake.lockPeriod !== 'Flexible') {
          const startDate = new Date(stake.startDate);
          const lockDays = parseInt(stake.lockPeriod);
          const expiryDate = new Date(startDate);
          expiryDate.setDate(expiryDate.getDate() + lockDays);

          if (today >= expiryDate) {
            newStakingAlerts.push({
              id: `stake_unlock_${stake.id}`, type: "Yield Alert", title: "Harvest Ready",
              message: `Sir, your ${lockDays} days lock period for ${stake.coin || stake.platform} has ended. Please claim your rewards to avoid losing compound interest.`,
              iconType: "shield", actionText: "Harvest Now", actionLink: '/dashboard/crypto/staking' 
            });
          }
        }

        if (stake.earningType === 'affiliate') {
          const lastClaim = stake.claimedHistory && stake.claimedHistory.length > 0 
            ? new Date(stake.claimedHistory[stake.claimedHistory.length - 1].timestamp) 
            : new Date(stake.startDate);
            
          const daysSinceLastClaim = Math.floor((today - lastClaim) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLastClaim > 15) {
             newStakingAlerts.push({
               id: `affiliate_idle_${stake.id}`, type: "Opportunity", title: "Unclaimed Affiliate Yield",
               message: `You haven't claimed your ${stake.platform} affiliate yield for over 15 days. Check your dashboard and harvest the tokens.`,
               iconType: "bulb", actionText: "Check Platform", actionLink: '/dashboard/crypto/staking' 
             });
          }
        }
      });
      setStakingAlerts(newStakingAlerts);
    });

    // 3. EXPENSE MONITOR
    const highExpenseThreshold = ['USD', 'EUR', 'GBP', 'AUD', 'CAD'].includes(baseCurrency) ? 100 : 5000;
    const qExpense = query(collection(db, "users", user.uid, "expenseLogs"), orderBy("timestamp", "desc"), limit(50));
    
    const unsubExpense = onSnapshot(qExpense, (snapshot) => {
      const expenses = snapshot.docs.map(doc => doc.data());
      let newExpenseAlerts = [];
      
      if (expenses.length > 0) {
        const recentHighExpense = expenses.find(exp => {
          const amt = parseFloat(exp.finalBaseAmount || exp.amount) || 0;
          const expDate = new Date(exp.timestamp || exp.date);
          const daysAgo = (new Date() - expDate) / (1000 * 60 * 60 * 24);
          
          return amt >= highExpenseThreshold && daysAgo <= 3;
        });

        if (recentHighExpense) {
           const finalAmountVal = parseFloat(recentHighExpense.finalBaseAmount || recentHighExpense.amount);
           const formattedAmount = finalAmountVal.toLocaleString(undefined, {minimumFractionDigits: 2});
           
           newExpenseAlerts.push({
             id: `high_expense_alert_${recentHighExpense.timestamp || Date.now()}`, type: "Expense Warning", title: "High Recent Expenditure",
             message: `Warning. I detected a high expense of ${currencySymbol}${formattedAmount} in ${recentHighExpense.category}. Please monitor your budget carefully this week.`,
             iconType: "trendDown", actionText: "Review Expenses", actionLink: '/dashboard/expense' 
           });
        }
      }
      setExpenseAlerts(newExpenseAlerts);
    });

    // 4. THE BILLS MONITOR 
    const qBills = query(collection(db, "users", user.uid, "billReminders"), where("isPaid", "==", false));
    const unsubBills = onSnapshot(qBills, async (snapshot) => {
      const todayDate = new Date().toISOString().split('T')[0];
      const newBillAlerts = [];

      for (const docSnap of snapshot.docs) {
        const bill = docSnap.data();

        if (bill.dueDate <= todayDate) {
          const isOverdue = bill.dueDate < todayDate;
          
          newBillAlerts.push({
            id: `bill_${docSnap.id}`, type: isOverdue ? 'CRITICAL ALERT' : 'REMINDER', iconType: isOverdue ? 'trendDown' : 'bulb',
            title: isOverdue ? `Overdue: ${bill.title}` : `Due Today: ${bill.title}`,
            message: `Your bill for ${bill.title} of amount ${currencySymbol}${bill.amount} is ${isOverdue ? `overdue since ${bill.dueDate}` : 'due today'}. Please settle it to avoid penalties.`,
            actionText: 'Settle Bill Now', actionLink: '/dashboard/alerts/bills' 
          });

          const uniqueNotifId = `BILL_NOTIF_${docSnap.id}_${todayDate}`;
          const notifQ = query(collection(db, "users", user.uid, "notifications"), where("uniqueId", "==", uniqueNotifId));
          const notifSnap = await getDocs(notifQ);

          if (notifSnap.empty) {
            await addDoc(collection(db, "users", user.uid, "notifications"), {
              uniqueId: uniqueNotifId, title: isOverdue ? 'Overdue Bill Alert! 🚨' : 'Bill Due Today! ⚠️',
              message: `Your ${bill.title} bill of ${currencySymbol}${bill.amount} is pending.`, type: 'bill_alert', isRead: false,
              timestamp: new Date().getTime(), link: '/dashboard/alerts/bills'
            });

            if (speak) {
              const speechText = isOverdue ? `Urgent attention. Your ${bill.title} bill is overdue.` : `Attention. Your ${bill.title} bill is due today.`;
              speak(speechText);
            }
          }
        }
      }
      setBillAlerts(newBillAlerts);
    });

    // 5. THE FORMAL LOAN (EMI) MONITOR
    const qLoans = query(collection(db, "users", user.uid, "parties"), where("accountType", "==", "loan"), where("status", "==", "active"));
    const unsubLoans = onSnapshot(qLoans, async (snapshot) => {
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
            await addDoc(collection(db, "users", user.uid, "notifications"), {
              uniqueId: uniqueNotifId, title: isOverdue ? 'Overdue EMI Alert! 🚨' : 'EMI Due Today! 🏦',
              message: `Your ${loan.name} EMI of ${currencySymbol}${loan.emiAmount} is pending.`, type: 'loan_alert', isRead: false,
              timestamp: new Date().getTime(), link: `/dashboard/parties/${docSnap.id}`
            });

            if (speak) {
              speak(`Reminder. Your EMI payment for ${loan.name} is ${isOverdue ? 'overdue' : 'due today'}.`);
            }
          }
        }
      }
      setLoanAlerts(newLoanAlerts);
      setIsBrainLoading(false); 
    });

    return () => {
      unsubBank(); 
      unsubCash(); 
      unsubOnline(); // Vault Monitors Cleanup
      unsubStaking();
      unsubExpense();
      unsubBills();
      unsubLoans();
    };
  }, [user, baseCurrency, currencySymbol, speak]); 

  // 🚀 Combine ALL alerts into one master array
  const alerts = [...vaultAlerts, ...stakingAlerts, ...expenseAlerts, ...billAlerts, ...loanAlerts];
  return { alerts, isBrainLoading };
};