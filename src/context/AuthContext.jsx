// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged, onIdTokenChanged } from "firebase/auth";
import { auth, db } from "../firebase/firebaseConfig";
import { doc, onSnapshot, setDoc, updateDoc, collection, query, limit, getDocs, getDoc } from "firebase/firestore";  
import { registerUser, loginUser, logoutUser, socialLogin, resetPasswordEmail } from "../firebase/auth";

import { format } from 'date-fns';
import NepaliDate from 'nepali-date-converter';

export const AuthContext = createContext(null);

const AVATAR_CACHE_KEY = "finledger_avatar";
const NAME_CACHE_KEY = "finledger_name";
const CURRENCY_CACHE_KEY = "finledger_base_currency"; 
const CRYPTO_CACHE_KEY = "finledger_selected_cryptos"; 
const FIAT_CACHE_KEY = "finledger_selected_fiats";
const SETTINGS_CACHE_KEY = "finledger_settings";

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);        
  const [dbData, setDbData] = useState(null);    
  const [loading, setLoading] = useState(true);  
  const [isAdmin, setIsAdmin] = useState(false);

  const [baseCurrency, setBaseCurrency] = useState(localStorage.getItem(CURRENCY_CACHE_KEY) || 'USD');

  const [selectedCryptos, setSelectedCryptos] = useState(() => {
    try {
      const cached = localStorage.getItem(CRYPTO_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && typeof parsed[0] === 'string') return []; 
        return parsed || [];
      }
      return []; 
    } catch (e) { return []; }
  });

  const [selectedFiats, setSelectedFiats] = useState(() => {
    try {
      const cached = localStorage.getItem(FIAT_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (e) { return []; }
  });

  // Refs for session timeout
  const timeoutRef = useRef(null);
  const logoutRef = useRef(logoutUser);
  const lastInteractionRef = useRef(Date.now());

  // 🚀 Session Timeout Effect (Optimized with Throttling)
  useEffect(() => {
    if (!user) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const startTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        logoutRef.current(); // Auto logout after inactivity
      }, SESSION_TIMEOUT);
    };

    const resetTimer = () => {
      const now = Date.now();
      if (now - lastInteractionRef.current > 2000) {
        lastInteractionRef.current = now;
        startTimer();
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer, { passive: true }));

    startTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

// ✅ NAYA LAGAO: Firestore admins collection check
useEffect(() => {
  const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
    if (currentUser) {
      try {
        // 🔑 Firestore `admins` collection me UID check karo
        const adminDoc = await getDoc(doc(db, "admins", currentUser.uid));
        setIsAdmin(adminDoc.exists());
      } catch (error) {
        console.error("[AuthContext] Admin check failed:", error);
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
  });
  return () => unsubscribe();
}, []);

  useEffect(() => {
    let unsubscribeSnapshot = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      try {
        if (currentUser) {
          setUser(currentUser);
           try {
          const adminDoc = await getDoc(doc(db, "admins", currentUser.uid));
          setIsAdmin(adminDoc.exists());
          } catch (e) {
           console.error("[AuthContext] Admin check on auth state:", e);
           }

          const userDocRef = doc(db, "users", currentUser.uid);
          unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const profile = docSnap.data();
              setDbData(profile);
              
              if (profile?.preferences?.baseCurrency) {
                setBaseCurrency(profile.preferences.baseCurrency);
                localStorage.setItem(CURRENCY_CACHE_KEY, profile.preferences.baseCurrency);
              }
              
              if (profile?.preferences?.selectedCryptos && profile.preferences.selectedCryptos.length > 0) {
                const safeCryptos = profile.preferences.selectedCryptos.map(c => {
                  if (typeof c === 'string') {
                     return { symbol: c, id: c.toLowerCase(), name: c, fallbackPrice: 0 };
                  }
                  return c; 
                });
                setSelectedCryptos(safeCryptos);
                localStorage.setItem(CRYPTO_CACHE_KEY, JSON.stringify(safeCryptos));
              } else {
                 setSelectedCryptos([]); 
                 localStorage.setItem(CRYPTO_CACHE_KEY, JSON.stringify([]));
              }
              
              if (profile?.preferences?.selectedFiats && profile.preferences.selectedFiats.length > 0) {
                setSelectedFiats(profile.preferences.selectedFiats);
                localStorage.setItem(FIAT_CACHE_KEY, JSON.stringify(profile.preferences.selectedFiats));
              } else {
                setSelectedFiats([]);
                localStorage.setItem(FIAT_CACHE_KEY, JSON.stringify([]));
              }
              
              const cachedAvatar = profile?.photoURL || currentUser.photoURL || null;
              const cachedName = profile?.name || profile?.displayName || currentUser.displayName || currentUser.email?.split("@")[0];
              if (cachedAvatar) localStorage.setItem(AVATAR_CACHE_KEY, cachedAvatar);
              if (cachedName) localStorage.setItem(NAME_CACHE_KEY, cachedName);
            } else { 
              setDbData(null); 
            }
          });
        } else {
          setUser(null); 
          setDbData(null);
          setIsAdmin(false);
          if (unsubscribeSnapshot) unsubscribeSnapshot(); 
          localStorage.removeItem(CRYPTO_CACHE_KEY);
          localStorage.removeItem(FIAT_CACHE_KEY);
          localStorage.removeItem(CURRENCY_CACHE_KEY);
          localStorage.removeItem(AVATAR_CACHE_KEY);
          localStorage.removeItem(NAME_CACHE_KEY);
          localStorage.removeItem(SETTINGS_CACHE_KEY);
        }
      } catch (error) { 
        console.error("Auth State Error:", error); 
      } finally { 
        setLoading(false); 
      }
    });
    return () => { 
      unsubscribeAuth(); 
      if (unsubscribeSnapshot) unsubscribeSnapshot(); 
    };
  }, []);

  const cleanForFirestore = (data) => JSON.parse(JSON.stringify(data));

  const updateBaseCurrency = async (newCurrency) => {
    if (!auth.currentUser) return;
    const vaults = [
      'cashWallet', 'bankWallet', 'onlineWallet', 
      'capitalShifts', 'expenseLogs', 'incomeLogs', 'cryptoWalletLogs'
    ];
    let hasTransactions = false;
    for (const vault of vaults) {
      const q = query(collection(db, "users", auth.currentUser.uid, vault), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        hasTransactions = true;
        break;
      }
    }
    if (hasTransactions) {
      throw new Error("Base currency locked due to existing transactions. Delete all transactions first.");
    }
    setBaseCurrency(newCurrency);
    localStorage.setItem(CURRENCY_CACHE_KEY, newCurrency);
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      "preferences.baseCurrency": newCurrency
    });
  };

  const updateSelectedCryptos = async (newCryptosArray) => {
    setSelectedCryptos(newCryptosArray);
    localStorage.setItem(CRYPTO_CACHE_KEY, JSON.stringify(newCryptosArray));
    if (auth.currentUser) {
      const safeData = cleanForFirestore(newCryptosArray);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        "preferences.selectedCryptos": safeData
      });
    }
  };

  const updateSelectedFiats = async (newFiatsArray) => {
    setSelectedFiats(newFiatsArray);
    localStorage.setItem(FIAT_CACHE_KEY, JSON.stringify(newFiatsArray));
    if (auth.currentUser) {
      const safeData = cleanForFirestore(newFiatsArray);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        "preferences.selectedFiats": safeData
      });
    }
  };

  const updateUserSettings = async (newSettings) => {
    if (auth.currentUser) {
      const safeSettings = cleanForFirestore(newSettings);
      await setDoc(doc(db, "users", auth.currentUser.uid), { settings: safeSettings }, { merge: true });
    }
  };

  const updateUserProfile = async (updates) => {
    if (auth.currentUser) {
      const safeUpdates = cleanForFirestore(updates);
      await setDoc(doc(db, "users", auth.currentUser.uid), safeUpdates, { merge: true });
    }
  }

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
  }, []);

  const avatar = dbData?.photoURL || user?.photoURL || localStorage.getItem(AVATAR_CACHE_KEY) || null;
  const displayName = dbData?.displayName || dbData?.name || user?.displayName || localStorage.getItem(NAME_CACHE_KEY) || user?.email?.split("@")[0] || "User";

  const formatGlobalDate = (rawDate, formatType = 'full') => {
    if (!rawDate) return '';
    const dateObj = new Date(rawDate);
    const pref = dbData?.settings?.baseCalendar || 'gregorian';
    try {
      if (pref === 'bikram_sambat') {
        const nd = new NepaliDate(dateObj);
        if (formatType === 'short') return nd.format('DD MMM'); 
        if (formatType === 'monthYear') return nd.format('MMMM YYYY'); 
        return nd.format('DD MMMM YYYY'); 
      }
      if (pref === 'hijri') {
        const options = { day: 'numeric', month: formatType === 'short' ? 'short' : 'long', year: formatType === 'monthYear' || formatType === 'full' ? 'numeric' : undefined };
        return new Intl.DateTimeFormat('en-US-u-ca-islamic', options).format(dateObj);
      }
      if (pref === 'jalali') {
        const options = { day: 'numeric', month: formatType === 'short' ? 'short' : 'long', year: formatType === 'monthYear' || formatType === 'full' ? 'numeric' : undefined };
        return new Intl.DateTimeFormat('en-US-u-ca-persian', options).format(dateObj);
      }
      if (formatType === 'short') return format(dateObj, 'd MMM'); 
      if (formatType === 'monthYear') return format(dateObj, 'MMMM yyyy'); 
      return format(dateObj, 'd MMMM yyyy'); 
    } catch (error) {
      return format(dateObj, 'd MMM yyyy');
    }
  };

  const getCalendarMonthKey = (rawDate) => {
    if (!rawDate) return 'unknown';
    const dateObj = new Date(rawDate);
    const pref = dbData?.settings?.baseCalendar || 'gregorian';
    try {
      if (pref === 'bikram_sambat') {
        const nd = new NepaliDate(dateObj);
        return `bs-${nd.getYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`;
      }
      if (pref === 'hijri') {
        const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
          year: 'numeric', month: '2-digit'
        }).formatToParts(dateObj);
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        return `hijri-${y}-${m}`;
      }
      if (pref === 'jalali') {
        const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
          year: 'numeric', month: '2-digit'
        }).formatToParts(dateObj);
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        return `jalali-${y}-${m}`;
      }
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      return `greg-${y}-${m}`;
    } catch (error) {
      return `greg-${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`;
    }
  };

  const value = {
    user, dbData, loading, avatar, displayName,
    isAdmin,
    baseCurrency, updateBaseCurrency,          
    selectedCryptos, updateSelectedCryptos, 
    selectedFiats, updateSelectedFiats,
    updateUserSettings, updateUserProfile,
    signup: registerUser, login: loginUser, logout: logoutUser,
    loginWithGoogle: () => socialLogin("google"),
    loginWithGithub: () => socialLogin("github"),
    resetPassword: resetPasswordEmail, refreshUser,
    formatGlobalDate,
    getCalendarMonthKey
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : (
        // 🚀 THE FIX: Premium Theme-Aware Loader
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute animate-ping h-24 w-24 rounded-full bg-blue-500/20 dark:bg-blue-400/20"></div>
            <div className="relative animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 border-b-blue-600 dark:border-b-blue-400"></div>
            <div className="absolute h-6 w-6 bg-blue-600 dark:bg-blue-400 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
          </div>
          {/* ✅ Dark Mode aur Light Mode ke liye perfect contrast classes */}
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] animate-pulse">
            Authenticating...
          </p>
        </div>
      )}
    </AuthContext.Provider>
  );
};