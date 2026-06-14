// src/hooks/useDashboardData.js
import { useEffect, useRef, useCallback, useState } from 'react';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { calcVaultBalance } from '../utils/balanceEngine';
import { safeParseFloat, safeSum } from '../utils/safeMath';

export const useDashboardData = (user, onDataUpdate, options = {}) => {
  const unsubscribersRef = useRef([]);
  const callbackRef = useRef(onDataUpdate);
  
  const [initialLoading, setInitialLoading] = useState(true);
  const loadedCount = useRef(0);
  const totalListeners = 7; 

  const markLoaded = useCallback(() => {
    loadedCount.current++;
    if (loadedCount.current >= totalListeners) {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { callbackRef.current = onDataUpdate; }, [onDataUpdate]);

  const dispatch = useCallback((updater) => {
    try {
      callbackRef.current?.(updater);
    } catch (e) {
      console.error('[useDashboardData] dispatch error:', e);
    }
  }, []);

  const register = (unsub) => {
    if (typeof unsub === 'function') {
      unsubscribersRef.current.push(unsub);
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setInitialLoading(false);
      return;
    }

    const uid = user.uid;
    unsubscribersRef.current.forEach(fn => { try { fn?.(); } catch (e) {} });
    unsubscribersRef.current = [];
    loadedCount.current = 0;
    setInitialLoading(true);

    // Helper to manage dynamic fallbacks without memory leaks
    const setupVaultListener = (vaultName, summaryDocPath, logsColPath, stateKey) => {
      let unsubFallback = null;
      
      const unsubSummary = onSnapshot(doc(db, summaryDocPath, uid, 'walletSummary', vaultName), snap => {
        // If summary has a valid balance greater than 0, or if it explicitly exists
        if (snap.exists() && snap.data().totalBalance !== undefined) {
          if (unsubFallback) {
            unsubFallback(); 
            unsubFallback = null;
          }
          dispatch(prev => ({ ...prev, [stateKey]: safeParseFloat(snap.data().totalBalance, 0) }));
          markLoaded();
        } else {
          // Fallback to logs
          if (!unsubFallback) {
            unsubFallback = onSnapshot(collection(db, logsColPath, uid, `${vaultName}Wallet`), logSnap => {
              const txs = logSnap.docs.map(d => d.data());
              const calculated = calcVaultBalance(txs)?.balance || 0;
              dispatch(prev => ({ ...prev, [stateKey]: calculated }));
            }, error => console.error(`[${vaultName} Fallback Error]:`, error));
            
            register(() => { if (unsubFallback) unsubFallback(); });
          }
          markLoaded();
        }
      }, error => console.error(`[${vaultName} Summary Error]:`, error));
      
      register(unsubSummary);
    };

    // ── 1, 2, 3. VAULT WALLETS ──
    setupVaultListener('bank', 'users', 'users', 'bankTotal');
    setupVaultListener('cash', 'users', 'users', 'cashTotal');
    setupVaultListener('online', 'users', 'users', 'onlineTotal');

    // ── 4. CRYPTO WALLET ──
    const unsubCrypto = onSnapshot(
      query(collection(db, 'users', uid, 'cryptoWalletLogs'), orderBy('timestamp', 'desc')), 
      snap => {
        const cryptoTransactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        dispatch(prev => ({ ...prev, cryptoTransactions }));
        markLoaded();
      }, 
      error => console.error("[Crypto Fetch Error]: Check if 'timestamp' field exists!", error)
    );
    register(unsubCrypto);

    // ── 5. INCOME LOGS ──
    const unsubIncome = onSnapshot(
      query(collection(db, 'users', uid, 'incomeLogs'), orderBy('timestamp', 'desc')), 
      snap => {
        const rawIncomes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const incomeTotal = safeSum(rawIncomes, d => safeParseFloat(d.finalBaseAmount ?? d.amount, 0));
        dispatch(prev => ({ ...prev, rawIncomes, incomeTotal }));
        markLoaded();
      },
      error => console.error("[Income Fetch Error]: Check if 'timestamp' field exists!", error)
    );
    register(unsubIncome);

    // ── 6. EXPENSE LOGS ──
    const unsubExpense = onSnapshot(
      query(collection(db, 'users', uid, 'expenseLogs'), orderBy('timestamp', 'desc')), 
      snap => {
        const rawExpenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const expenseTotal = safeSum(rawExpenses, d => safeParseFloat(d.finalBaseAmount ?? d.amount, 0));
        dispatch(prev => ({ ...prev, rawExpenses, expenseTotal }));
        markLoaded();
      },
      error => console.error("[Expense Fetch Error]: Check if 'timestamp' field exists!", error)
    );
    register(unsubExpense);

    // ── 7. PARTIES (Khata) ──
    const unsubParties = onSnapshot(
      collection(db, 'users', uid, 'parties'), 
      snap => {
        let khataReceivables = 0, khataPayables = 0;
        snap.docs.forEach(d => {
          const net = safeParseFloat(d.data().netBalance, 0);
          if (net > 0) khataReceivables += net;
          else if (net < 0) khataPayables += Math.abs(net);
        });
        dispatch(prev => ({ ...prev, khataReceivables, khataPayables }));
        markLoaded();
      },
      error => console.error("[Parties Fetch Error]:", error)
    );
    register(unsubParties);

    // ── SAFETY TIMEOUT ──
    const timeout = setTimeout(() => {
      setInitialLoading(false);
    }, 3000);

    return () => {
      clearTimeout(timeout);
      unsubscribersRef.current.forEach(fn => { try { fn?.(); } catch (e) {} });
      unsubscribersRef.current = [];
    };
  }, [user?.uid, dispatch, markLoaded]);

  return { loading: initialLoading };
};