// src/hooks/usePaginatedLogs.js
import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

/**
 * @param {string} uid – current user UID
 * @param {string} subCollection – e.g. 'expenseLogs'
 * @param {number} pageSize – documents per page (default 20)
 * @param {boolean} enabled – only fetch when true
 * @returns {{ logs, loading, error, hasMore, loadMore, refresh, isPaginating }}
 */
export function usePaginatedLogs(uid, subCollection, pageSize = 20, enabled = true) {
  const [logs, setLogs] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [error, setError] = useState(null);

  const getCollectionRef = useCallback(() => {
    return collection(db, 'users', uid, subCollection);
  }, [uid, subCollection]);

  const fetchInitial = useCallback(async () => {
    // ✅ Validation safely placed here
    if (!uid || !enabled || !subCollection || typeof subCollection !== 'string') return;
    
    setLoading(true);
    setError(null);
    setLogs([]);
    setLastDoc(null);
    
    try {
      const collectionRef = getCollectionRef();
      const q = query(collectionRef, orderBy('timestamp', 'desc'), limit(pageSize));
      const snap = await getDocs(q);
      
      // ✅ Handle empty explicitly placed safely inside the function
      if (snap.empty) {
        setHasMore(false);
        setLoading(false);
        return;
      }
      
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(docs);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === pageSize);
    } catch (err) {
      console.error('Pagination fetch error:', err);
      setError(err.message);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [uid, enabled, pageSize, getCollectionRef, subCollection]);

  const loadMore = useCallback(async () => {
    if (!lastDoc || !hasMore || loading || isPaginating) return;

    setIsPaginating(true); 
    try {
      const collectionRef = getCollectionRef();
      const q = query(
        collectionRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setHasMore(false);
        return;
      }

      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setLogs(prev => [...prev, ...newDocs]);
      const newLast = snap.docs[snap.docs.length - 1] || null;
      setLastDoc(newLast);
      setHasMore(snap.docs.length === pageSize);
    } catch (err) {
      console.error('Load more error:', err);
      // ✅ Better error message safely placed inside catch block
      setError(`Load more failed: ${err.message}`);
    } finally {
      setIsPaginating(false); 
    }
  }, [lastDoc, hasMore, loading, isPaginating, pageSize, getCollectionRef]);

  const refresh = useCallback(() => {
    setLogs([]);
    setLastDoc(null);
    setHasMore(true);
    setError(null);
    fetchInitial();
  }, [fetchInitial]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]); 

  return {
    logs,
    loading,
    isPaginating, 
    error,
    hasMore,
    loadMore,
    refresh
  };
}
