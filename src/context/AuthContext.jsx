import React, { createContext, useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/firebaseConfig"; 
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { registerUser, loginUser, logoutUser, socialLogin, resetPasswordEmail } from "../firebase/auth";

// 🚀 NAYA: Date Conversion Libraries Imported here
import { format } from 'date-fns';
import NepaliDate from 'nepali-date-converter';

export const AuthContext = createContext(null);

const AVATAR_CACHE_KEY = "finledger_avatar";
const NAME_CACHE_KEY = "finledger_name";
const CURRENCY_CACHE_KEY = "finledger_base_currency"; 
const CRYPTO_CACHE_KEY = "finledger_selected_cryptos"; 
const FIAT_CACHE_KEY = "finledger_selected_fiats";

// 🚀 DEFAULT FALLBACK DATABASE (Completely Empty for Clean Slate)
const defaultCryptoObjects = [];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);        
  const [dbData, setDbData] = useState(null);    
  const [loading, setLoading] = useState(true);  

  const [baseCurrency, setBaseCurrency] = useState(localStorage.getItem(CURRENCY_CACHE_KEY) || 'USD');

  // 🧠 SMART STATE: Parses objects and starts with an empty slate for new users
  const [selectedCryptos, setSelectedCryptos] = useState(() => {
    try {
      const cached = localStorage.getItem(CRYPTO_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Migration: If array contains strings (Old format), clear it to prevent bugs
        if (typeof parsed[0] === 'string') {
           return []; 
        }
        return parsed;
      }
      return []; // Start clean for new users
    } catch (e) { return []; }
  });

  const [selectedFiats, setSelectedFiats] = useState(() => {
    try {
      const cached = localStorage.getItem(FIAT_CACHE_KEY);
      return cached ? JSON.parse(cached) : ['USD', 'INR', 'AED'];
    } catch (e) { return ['USD', 'INR', 'AED']; }
  });

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
              
              // 🚀 REAL-TIME SYNC: Gets Full Objects from Firebase
              if (profile?.preferences?.selectedCryptos) {
                // Ensure CTC/ROX are always linked to Tether ID for safety
                const safeCryptos = profile.preferences.selectedCryptos.map(c => {
                  if (typeof c === 'string') {
                     // Auto-migrate old strings (now returns basic object since default is empty)
                     return { symbol: c, id: c.toLowerCase(), name: c, fallbackPrice: 0 };
                  }
                  if (['CTC', 'ROX'].includes(c.symbol)) c.id = 'tether';
                  return c;
                });
                setSelectedCryptos(safeCryptos);
                localStorage.setItem(CRYPTO_CACHE_KEY, JSON.stringify(safeCryptos));
              } else {
                 setSelectedCryptos([]); // Ensure empty if not in DB
                 localStorage.setItem(CRYPTO_CACHE_KEY, JSON.stringify([]));
              }
              
              if (profile?.preferences?.selectedFiats) {
                setSelectedFiats(profile.preferences.selectedFiats);
                localStorage.setItem(FIAT_CACHE_KEY, JSON.stringify(profile.preferences.selectedFiats));
              }
              
              const cachedAvatar = profile?.photoURL || currentUser.photoURL || null;
              const cachedName = profile?.name || currentUser.displayName || currentUser.email?.split("@")[0];
              if (cachedAvatar) localStorage.setItem(AVATAR_CACHE_KEY, cachedAvatar);
              if (cachedName) localStorage.setItem(NAME_CACHE_KEY, cachedName);
            } else { setDbData(null); }
          });
        } else {
          setUser(null); setDbData(null);
          if (unsubscribeSnapshot) unsubscribeSnapshot(); 
          localStorage.clear(); 
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    });
    return () => { unsubscribeAuth(); if (unsubscribeSnapshot) unsubscribeSnapshot(); };
  }, []);

  const updateBaseCurrency = async (newCurrency) => {
    setBaseCurrency(newCurrency);
    localStorage.setItem(CURRENCY_CACHE_KEY, newCurrency);
    if (auth.currentUser) {
      try { await setDoc(doc(db, "users", auth.currentUser.uid), { preferences: { baseCurrency: newCurrency } }, { merge: true });
      } catch (e) { console.error(e); }
    }
  };

  // 🚀 Receives FULL OBJECTS from CryptoManager and saves them directly!
  const updateSelectedCryptos = async (newCryptosArray) => {
    setSelectedCryptos(newCryptosArray);
    localStorage.setItem(CRYPTO_CACHE_KEY, JSON.stringify(newCryptosArray));
    if (auth.currentUser) {
      try { await setDoc(doc(db, "users", auth.currentUser.uid), { preferences: { selectedCryptos: newCryptosArray } }, { merge: true });
      } catch (e) { console.error(e); }
    }
  };

  const updateSelectedFiats = async (newFiatsArray) => {
    setSelectedFiats(newFiatsArray);
    localStorage.setItem(FIAT_CACHE_KEY, JSON.stringify(newFiatsArray));
    if (auth.currentUser) {
      try { await setDoc(doc(db, "users", auth.currentUser.uid), { preferences: { selectedFiats: newFiatsArray } }, { merge: true });
      } catch (e) { console.error(e); }
    }
  };

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
  }, []);

  const avatar = dbData?.photoURL || user?.photoURL || localStorage.getItem(AVATAR_CACHE_KEY) || null;
  const displayName = dbData?.displayName || dbData?.name || user?.displayName || localStorage.getItem(NAME_CACHE_KEY) || user?.email?.split("@")[0] || "User";

  // ==========================================
  // 🌍 GLOBAL DATE FORMATTER ENGINE
  // ==========================================
  const formatGlobalDate = (rawDate, formatType = 'full') => {
    if (!rawDate) return '';
    const dateObj = new Date(rawDate);
    const pref = dbData?.settings?.baseCalendar || 'gregorian'; // Fetch from dbData

    try {
      // 🇳🇵 NEPALI (BS)
      if (pref === 'bikram_sambat') {
        const nd = new NepaliDate(dateObj);
        if (formatType === 'short') return nd.format('DD MMM'); // e.g. 23 Fal
        if (formatType === 'monthYear') return nd.format('MMMM YYYY'); // e.g. Falgun 2082
        return nd.format('DD MMMM YYYY'); // e.g. 23 Falgun 2082
      }

      // ☪️ ISLAMIC (HIJRI)
      if (pref === 'hijri') {
        const options = {
          day: 'numeric',
          month: formatType === 'short' ? 'short' : 'long',
          year: formatType === 'monthYear' || formatType === 'full' ? 'numeric' : undefined
        };
        // using en-US for readable text like 'Ramadan'
        return new Intl.DateTimeFormat('en-US-u-ca-islamic', options).format(dateObj);
      }

      // 🇮🇷 PERSIAN (JALALI)
      if (pref === 'jalali') {
        const options = {
          day: 'numeric',
          month: formatType === 'short' ? 'short' : 'long',
          year: formatType === 'monthYear' || formatType === 'full' ? 'numeric' : undefined
        };
        return new Intl.DateTimeFormat('en-US-u-ca-persian', options).format(dateObj);
      }

      // 🌍 DEFAULT ENGLISH (AD)
      if (formatType === 'short') return format(dateObj, 'd MMM'); // e.g. 7 Mar
      if (formatType === 'monthYear') return format(dateObj, 'MMMM yyyy'); // e.g. March 2026
      return format(dateObj, 'd MMMM yyyy'); // e.g. 7 March 2026

    } catch (error) {
      // Fallback safely to standard AD if any conversion fails
      console.error("Date formatting error:", error);
      return format(dateObj, 'd MMM yyyy');
    }
  };

  const value = {
    user, dbData, loading, avatar, displayName,
    baseCurrency, updateBaseCurrency,          
    selectedCryptos, updateSelectedCryptos, 
    selectedFiats, updateSelectedFiats,
    signup: registerUser, login: loginUser, logout: logoutUser,
    loginWithGoogle: () => socialLogin("google"),
    loginWithGithub: () => socialLogin("github"),
    resetPassword: resetPasswordEmail, refreshUser,
    formatGlobalDate // 🚀 EXPORTED TO ENTIRE APP!
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