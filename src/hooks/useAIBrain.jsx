// src/hooks/useAIBrain.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore'; // ✅ FIXED IMPORTS: getDoc aur setDoc added
import { db } from '../firebase/firebaseConfig';
import { useAuth } from './useAuth';
import { useAIVoice } from './useAIVoice'; 
import { useCryptoPrice } from '../context/CryptoPriceContext';

export const useAIBrain = () => {
  // 🚀 Included getCalendarMonthKey for Global Calendar Sync
  const { user, baseCurrency = 'USD', getCalendarMonthKey } = useAuth();
  const { speak } = useAIVoice(); 
  const { livePrices, fiatRate } = useCryptoPrice();
  
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [vaultAlerts, setVaultAlerts] = useState([]); 
  const [stakingAlerts, setStakingAlerts] = useState([]);
  const [expenseAlerts, setExpenseAlerts] = useState([]);
  const [billAlerts, setBillAlerts] = useState([]); 
  const [loanAlerts, setLoanAlerts] = useState([]); 
  const [marketAlerts, setMarketAlerts] = useState([]); 
  const [trendAlerts, setTrendAlerts] = useState([]); 
  
  const [isBrainLoading, setIsBrainLoading] = useState(true);
  const notifiedTrends = useRef(new Set()); // Anti-spam for trend alerts

  useEffect(() => {
    if (!user) return;

    let loadedModules = { summary: false, exp: false };
    const checkLoading = () => { if (Object.values(loadedModules).every(Boolean)) setIsBrainLoading(false); };

    const today = new Date();
    const todayDateStr = today.toISOString().split('T')[0];

    // 🚀 1. SMART TREND & VAULT MONITOR (ENTERPRISE SUMMARY ENGINE)
    const unsubSummary = onSnapshot(query(collection(db, "users", user.uid, "walletSummary")), async (snap) => {
      let newVaultAlerts = [];
      let newTrendAlerts = [];
      
      let totalFiat = 0;

      for (const docSnap of snap.docs) {
        const data = docSnap.data();

        // A. FIAT VAULTS (Bank, Cash, Online)
        if (['bank', 'cash', 'online'].includes(docSnap.id)) {
          totalFiat += (data.totalBalance || 0);
          
          if (data.totalBalance > 0 && data.totalBalance <= 1000) {
            newVaultAlerts.push({
              id: `low_bal_${docSnap.id}`, type: 'WARNING', iconType: 'trendDown',
              title: `Low Balance in ${docSnap.id.toUpperCase()}`,
              message: `Your balance is dropping fast (${currencySymbol}${data.totalBalance}). Consider adding funds.`,
              actionText: 'View Vault', actionLink: `/dashboard/accounts/${docSnap.id}`
            });
          }
        }

        // B. CRYPTO PROFIT/LOSS TREND MONITOR
        if (docSnap.id === 'holdAndSwap' && data.holdingsByCoin) {
          const totalInvested = data.totalInvested || 0;
          let liveCryptoValue = 0;

          Object.entries(data.holdingsByCoin).forEach(([coin, coinData]) => {
            const livePrice = (livePrices[coin.toUpperCase()]?.priceUSD || 0) * fiatRate;
            liveCryptoValue += (coinData.totalAmount || 0) * livePrice;
          });

          if (totalInvested > 0) {
            const profit = liveCryptoValue - totalInvested;
            const profitPct = (profit / totalInvested) * 100;

            const trendId = `CRYPTO_TREND_${profitPct > 10 ? 'UP' : 'DOWN'}_${todayDateStr}`;

            if (profitPct >= 10.0 && !notifiedTrends.current.has(trendId)) {
              notifiedTrends.current.add(trendId);
              newTrendAlerts.push({
                id: trendId, type: 'SUGGESTION', iconType: 'trendUp',
                title: 'Crypto Earnings Surging! 🚀',
                message: `Excellent! Your crypto portfolio is up by ${profitPct.toFixed(1)}%. Consider booking some profits.`,
                actionText: 'View Portfolio', actionLink: '/dashboard/crypto/hold-profit'
              });
              
              // ✅ FIXED: Single Source of Truth Deduplication (getDoc -> setDoc)
              const notifRef = doc(db, "users", user.uid, "notifications", trendId);
              getDoc(notifRef).then((snap) => {
                if (!snap.exists()) {
                  setDoc(notifRef, {
                    uniqueId: trendId, title: 'Crypto Profits Up! 🚀', message: `Portfolio grew by ${profitPct.toFixed(1)}%.`, type: 'ai_insight', isRead: false, timestamp: new Date().getTime(), link: '/dashboard/crypto/hold-profit'
                  });
                  if (speak) speak(`Sir, your crypto earnings have increased by ${profitPct.toFixed(1)} percent.`);
                }
              });
            }
          }
        }
      }

      setVaultAlerts(newVaultAlerts);
      setTrendAlerts(newTrendAlerts);
      loadedModules.summary = true; checkLoading();
    });

    // 🚀 2. GLOBAL CALENDAR SYNCED SAVINGS MONITOR (Month over Month)
    const unsubExpense = onSnapshot(query(collection(db, "users", user.uid, "expenseLogs"), orderBy("timestamp", "desc"), limit(100)), (snapshot) => {
      
      const monthlyData = {};
      let newExpenseAlerts = [];

      // A. Group all expenses dynamically by the user's Global Calendar Month Key
      snapshot.docs.forEach(docSnap => {
        const exp = docSnap.data();
        if (!exp.isGoalLock) {
          const dateToUse = exp.timestamp || exp.date || new Date().toISOString();
          const monthKey = getCalendarMonthKey(dateToUse); // BS, Hijri, Jalali, or Gregorian support
          
          if (!monthlyData[monthKey]) monthlyData[monthKey] = 0;
          monthlyData[monthKey] += parseFloat(exp.finalBaseAmount || exp.amount || 0);
        }
      });

      // B. Identify Current vs Previous Month Keys
      const currentMonthKey = getCalendarMonthKey(today);
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - 30); // Approx 30 days back to fetch previous month reliably
      const prevMonthKey = getCalendarMonthKey(pastDate);

      // C. Compare Data
      const currentMonthExpense = monthlyData[currentMonthKey] || 0;
      const prevMonthExpense = monthlyData[prevMonthKey] || 0;

      if (prevMonthExpense > 0) {
        const diff = currentMonthExpense - prevMonthExpense;
        const percentChange = (diff / prevMonthExpense) * 100;

        const trendId = `EXPENSE_TREND_${currentMonthKey}`;

        // ⚠️ Bad Trend: Spent 20% MORE than last month
        if (percentChange >= 20.0 && !notifiedTrends.current.has(trendId + "_bad")) {
          const exactId = trendId + "_bad";
          notifiedTrends.current.add(exactId);
          
          newExpenseAlerts.push({
            id: exactId, type: "WARNING", title: "Savings Alert! 📉",
            message: `Your spending this month (${currencySymbol}${currentMonthExpense.toLocaleString()}) is ${percentChange.toFixed(0)}% higher than last month.`,
            iconType: "trendDown", actionText: "Review Spends", actionLink: '/dashboard/expense' 
          });

          // ✅ FIXED: Deduplication logic
          const notifRef = doc(db, "users", user.uid, "notifications", exactId);
          getDoc(notifRef).then(snap => {
            if (!snap.exists()) {
              setDoc(notifRef, {
                uniqueId: exactId, title: 'High Spending Trend 📉', 
                message: `Spending is up by ${percentChange.toFixed(0)}% compared to last month.`, 
                type: 'ai_insight', isRead: false, timestamp: new Date().getTime(), link: '/dashboard/expense'
              });
              if (speak) speak(`Sir, your expenses have increased by ${percentChange.toFixed(0)} percent compared to last month. Your savings might be affected.`);
            }
          });
        } 
        // 🌟 Good Trend: Spent 20% LESS than last month
        else if (percentChange <= -20.0 && !notifiedTrends.current.has(trendId + "_good")) {
          const exactId = trendId + "_good";
          notifiedTrends.current.add(exactId);
          
          newExpenseAlerts.push({
            id: exactId, type: "SUGGESTION", title: "Great Savings! 📈",
            message: `You've spent ${Math.abs(percentChange).toFixed(0)}% less this month compared to the last. Excellent financial control!`,
            iconType: "trendUp", actionText: "View Vaults", actionLink: '/dashboard/accounts/bank' 
          });

          // ✅ FIXED: Deduplication logic
          const notifRef = doc(db, "users", user.uid, "notifications", exactId);
          getDoc(notifRef).then(snap => {
            if (!snap.exists()) {
              setDoc(notifRef, {
                uniqueId: exactId, title: 'Savings Growing! 📈', 
                message: `You saved ${Math.abs(percentChange).toFixed(0)}% more this month.`, 
                type: 'ai_insight', isRead: false, timestamp: new Date().getTime(), link: '/dashboard/accounts/bank'
              });
              if (speak) speak(`Excellent job. You have spent ${Math.abs(percentChange).toFixed(0)} percent less this month. Your savings are growing.`);
            }
          });
        }
      }

      setExpenseAlerts(newExpenseAlerts);
      loadedModules.exp = true; checkLoading();
    });

    const loadingTimeout = setTimeout(() => setIsBrainLoading(false), 3000);

    return () => {
      unsubSummary(); 
      unsubExpense(); 
      clearTimeout(loadingTimeout);
    };
  }, [user, baseCurrency, currencySymbol, speak, livePrices, fiatRate, getCalendarMonthKey]); 

  // Safely memoize alerts arrays to pass to UI (if needed)
  const alerts = useMemo(() => {
    return [...vaultAlerts, ...trendAlerts, ...marketAlerts, ...stakingAlerts, ...expenseAlerts, ...billAlerts, ...loanAlerts];
  }, [vaultAlerts, trendAlerts, marketAlerts, stakingAlerts, expenseAlerts, billAlerts, loanAlerts]);

  return { alerts, isBrainLoading };
};