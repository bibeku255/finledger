// src/hooks/useAsyncEffect.js
import { useEffect, useRef, useCallback } from 'react';

export const useAsyncEffect = (asyncFn, dependencies = []) => {
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    abortControllerRef.current = new AbortController();

    const executeAsync = async () => {
      try {
        await asyncFn(isMountedRef, abortControllerRef.current.signal);
      } catch (error) {
        // Don't log abort errors
        if (error.name === 'AbortError') return;
        
        if (isMountedRef.current) {
          console.error('Async effect error:', error);
        }
      }
    };

    executeAsync();

    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort(); // ✅ ABORT pending requests
    };
  }, dependencies);

  const safeSetState = useCallback((setState) => {
    if (isMountedRef.current) {
      setState();
    }
  }, []);

  return { safeSetState, isMountedRef };
};

// Usage:
const { safeSetState } = useAsyncEffect(async (isMounted, signal) => {
  const userSnap = await getDoc(doc(db, "users", user.uid), {
    signal // Pass abort signal to Firestore listener
  });
  
  if (signal.aborted) return; // Check if aborted
  
  safeSetState(() => {
    setUserData(userSnap.data());
  });
});