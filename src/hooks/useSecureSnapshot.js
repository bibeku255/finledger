// src/hooks/useSecureSnapshot.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';

export const useSecureSnapshot = (query, onData, onError, enabled = true) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const unsubscribeRef = useRef(null);
  const isMountedRef = useRef(true);

  // Unmount cleanup safety
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  useEffect(() => {
    // Agar query nahi hai ya hook disabled hai, toh loading rok do
    if (!enabled || !query) {
      if (isMountedRef.current) setLoading(false);
      return;
    }

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      // Seedha Firebase ko query pass kar rahe hain (No artificial checks)
      unsubscribeRef.current = onSnapshot(
        query,
        (snapshot) => {
          if (!isMountedRef.current) return;
          
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          
          setData(docs);
          setLoading(false);
          
          if (typeof onData === 'function') onData(docs);
        },
        (err) => {
          console.error("[useSecureSnapshot] Firebase Fetch Error:", err);
          if (!isMountedRef.current) return;
          
          setError(err.message);
          setLoading(false);
          
          if (typeof onError === 'function') onError(err);
        }
      );
    } catch (err) {
      console.error("[useSecureSnapshot] Setup Failed:", err);
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }

    // Dependency update hone par purana listener clean karo
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query, enabled]); // Only re-run if query or enabled changes

  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      setData([]);
    }
  }, []);

  return { data, loading, error, cleanup };
};

// Exporting advanced exactly the same for your other files
export const useSecureSnapshotAdvanced = useSecureSnapshot; 