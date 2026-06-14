/**
 * TRUE PAGINATED MONTHLY LOGS HOOK (ENTERPRISE GRADE)
 * ===================================================
 * * Safe, Cost-Effective, and Lightning Fast UI Pagination.
 * * ✅ WHAT CHANGED:
 * 1. True Pagination: Uses Firebase `limit()` & `startAfter()`. (Zero RAM crash risk).
 * 2. Math Decoupled: Total balances are no longer calculated here to prevent the "Accounting Paradox". 
 * (Use your `walletSummary` document for total math).
 * 3. Auto-Grouping: Fetched flat logs are instantly grouped into months for your UI.
 * * @param {string} userId - Firebase user ID
 * @param {string} subCollection - Collection name (e.g., 'bankWallet')
 * @param {number} pageSize - Number of documents to fetch per "Load More" click
 * @param {boolean} enabled - Enable/disable the listener
 * @param {Function} getCalendarMonthKey - Function to extract month key
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { safeParseFloat } from '../utils/safeMath';

export function usePaginatedMonthlyLogs(
  userId,
  subCollection,
  pageSize = 20,
  enabled = true,
  getCalendarMonthKey = null
) {
  // ═══════════════════════════════════════════════════════════════════════
  // CORE STATE
  // ═══════════════════════════════════════════════════════════════════════
  const [records, setRecords] = useState([]); // Flat list of fetched docs
  const [lastDoc, setLastDoc] = useState(null); // Reference for "startAfter"
  
  const [loading, setLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // ═══════════════════════════════════════════════════════════════════════
  // FETCH LOGIC (True Firestore Pagination)
  // ═══════════════════════════════════════════════════════════════════════
  const fetchInitial = useCallback(async () => {
    if (!userId || !enabled || !subCollection) {
      setLoading(false);
      return;
    }

    if (typeof getCalendarMonthKey !== 'function') {
      setError('Configuration error: getCalendarMonthKey is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'users', userId, subCollection),
        orderBy('timestamp', 'desc'),
        limit(pageSize)
      );

      const snap = await getDocs(q);
      
      if (snap.empty) {
        setRecords([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecords(docs);
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === pageSize);
      
    } catch (err) {
      console.error('[usePaginatedMonthlyLogs] Initial fetch error:', err);
      setError(err.message);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [userId, enabled, subCollection, pageSize, getCalendarMonthKey]);


  const loadMore = useCallback(async () => {
    if (!lastDoc || !hasMore || isPaginating) return;

    setIsPaginating(true);
    try {
      const q = query(
        collection(db, 'users', userId, subCollection),
        orderBy('timestamp', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setHasMore(false);
        setIsPaginating(false);
        return;
      }

      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setRecords(prev => [...prev, ...newDocs]); // Append new records perfectly
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === pageSize);

    } catch (err) {
      console.error('[usePaginatedMonthlyLogs] Load more error:', err);
      setError(`Load more failed: ${err.message}`);
    } finally {
      setIsPaginating(false);
    }
  }, [userId, subCollection, lastDoc, hasMore, isPaginating, pageSize]);


  const refresh = useCallback(() => {
    setRecords([]);
    setLastDoc(null);
    setHasMore(true);
    setError(null);
    fetchInitial();
  }, [fetchInitial]);

  // Run on mount
  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // ═══════════════════════════════════════════════════════════════════════
  // UI TRANSFORMATION: Group Flat Records into Months Dynamically
  // ═══════════════════════════════════════════════════════════════════════
  const months = useMemo(() => {
    if (!records.length) return [];
    
    const grouped = {};

    records.forEach(rec => {
      // Extract key safely
      let monthKey;
      try {
         monthKey = getCalendarMonthKey(rec.date || rec.timestamp);
      } catch {
         const d = new Date(rec.date || rec.timestamp || new Date());
         monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: formatMonthName(monthKey, rec.date || rec.timestamp),
          records: [],
          pageIn: 0,
          pageOut: 0
        };
      }

      // Safe math parsing
      const finalAmount = safeParseFloat(rec.finalBaseAmount ?? rec.amount);
      const feeAmount = safeParseFloat(rec.fee);
      const rawType = (rec.type || rec.logType || '').toLowerCase();

      let netChange = 0;
      let actualDeduct = 0;
      
      if (rawType === 'out' || rawType === 'expense' || rawType === 'debit') {
        const feeType = (rec.feeType || 'inclusive').toLowerCase();
        actualDeduct = feeType === 'exclusive' ? finalAmount + feeAmount : finalAmount;
        netChange = -actualDeduct;
        grouped[monthKey].pageOut += actualDeduct;
      } else {
        netChange = finalAmount;
        grouped[monthKey].pageIn += finalAmount;
      }

      grouped[monthKey].records.push({ ...rec, netChange, actualDeduct, finalAmount });
    });

    // Convert object to array and sort (Newest month first)
    return Object.keys(grouped)
      .sort()
      .reverse()
      .map(key => grouped[key]);

  }, [records, getCalendarMonthKey]);


  // ═══════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════
  return {
    months,         // Grouped months for your UI
    logs: records,  // Flat records if you need them directly
    loading,
    error,
    isPaginating,
    hasMore,
    loadMore,
    refresh,
    
    // DUMMY SUMMARY: To prevent legacy files from crashing during transition.
    // NOTE: Use 'useWalletSummary' hook or global state for actual math!
    summary: { totalBalance: 0, totalIncome: 0, totalExpense: 0 } 
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function formatMonthName(monthKey, dateStr) {
  try {
    if (!dateStr) return monthKey;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return monthKey;
    
    return date.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return monthKey;
  }
}

export default usePaginatedMonthlyLogs;