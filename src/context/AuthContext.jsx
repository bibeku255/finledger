import React, { createContext, useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/firebaseConfig"; 
import { doc, onSnapshot, setDoc, updateDoc, collection, query, limit, getDocs } from "firebase/firestore"; 
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);        
  const [dbData, setDbData] = useState(null);    
  const [loading, setLoading] = useState(true);  

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

  const cleanForFirestore = (data) => JSON.parse(JSON.stringify(data));

  useEffect(() => {
    let unsubscribeSnapshot = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      try {
        if (currentUser) {
          setUser(currentUser);
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

  // 🔐 Base Currency Change (Locked against existing transactions)
  const updateBaseCurrency = async (newCurrency) => {
    if (!auth.currentUser) return;

    // 1. Strict transaction check
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

    // 2. Update state & cache
    setBaseCurrency(newCurrency);
    localStorage.setItem(CURRENCY_CACHE_KEY, newCurrency);

    // 3. Write to Firestore without overwriting other preferences
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      "preferences.baseCurrency": newCurrency
    });
  };

  // 🪙 Update Cryptos (preserving other preferences)
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

  // 💱 Update Fiats (preserving other preferences)
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

  // 🗓️ Global Date Formatter
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

  // 🗓️ Calendar-Aware Month Key Generator
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
      // Default Gregorian
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      return `greg-${y}-${m}`;
    } catch (error) {
      return `greg-${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`;
    }
  };

  const value = {
    user, dbData, loading, avatar, displayName,
    baseCurrency, updateBaseCurrency,          
    selectedCryptos, updateSelectedCryptos, 
    selectedFiats, updateSelectedFiats,
    updateUserSettings, updateUserProfile,
    signup: registerUser, login: loginUser, logout: logoutUser,
    loginWithGoogle: () => socialLogin("google"),
    loginWithGithub: () => socialLogin("github"),
    resetPassword: resetPasswordEmail, refreshUser,
    formatGlobalDate,
    getCalendarMonthKey   // ✨ Naya function
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="relative flex items-center justify-center">
            <div className="absolute animate-ping h-20 w-20 rounded-full bg-blue-500/20"></div>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};