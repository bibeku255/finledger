import React, { createContext, useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/firebaseConfig"; 
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
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
      return cached ? JSON.parse(cached) : ['USD', 'INR', 'AED'];
    } catch (e) { return ['USD', 'INR', 'AED']; }
  });

  // ⚡ FIRESTORE SAVIOR: Removes all 'undefined' fields that cause Firebase to silently reject saves.
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
              
              // 🚀 ROBUST FIREBASE SYNC
              if (profile?.preferences?.selectedCryptos) {
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
              
              if (profile?.preferences?.selectedFiats) {
                setSelectedFiats(profile.preferences.selectedFiats);
                localStorage.setItem(FIAT_CACHE_KEY, JSON.stringify(profile.preferences.selectedFiats));
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
          localStorage.clear(); 
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

  const updateBaseCurrency = async (newCurrency) => {
    setBaseCurrency(newCurrency);
    localStorage.setItem(CURRENCY_CACHE_KEY, newCurrency);
    if (auth.currentUser) {
      try { 
        await setDoc(doc(db, "users", auth.currentUser.uid), { preferences: { baseCurrency: newCurrency } }, { merge: true });
      } catch (e) { console.error("Error updating currency:", e); }
    }
  };

  // ⚡ MAXIMUM RELIABILITY FIX: Prevent Firestore rejection on save
  const updateSelectedCryptos = async (newCryptosArray) => {
    setSelectedCryptos(newCryptosArray);
    localStorage.setItem(CRYPTO_CACHE_KEY, JSON.stringify(newCryptosArray));
    
    if (auth.currentUser) {
      try { 
        // Force stripping of any undefined values that could crash Firestore
        const safeData = cleanForFirestore(newCryptosArray);
        await setDoc(doc(db, "users", auth.currentUser.uid), { 
          preferences: { selectedCryptos: safeData } 
        }, { merge: true });
        console.log("✅ Successfully saved to Firebase:", safeData.length, "assets");
      } catch (e) { 
        console.error("❌ Firebase Save Failed! Issue with data payload:", e); 
      }
    }
  };

  const updateSelectedFiats = async (newFiatsArray) => {
    setSelectedFiats(newFiatsArray);
    localStorage.setItem(FIAT_CACHE_KEY, JSON.stringify(newFiatsArray));
    if (auth.currentUser) {
      try { 
        const safeData = cleanForFirestore(newFiatsArray);
        await setDoc(doc(db, "users", auth.currentUser.uid), { preferences: { selectedFiats: safeData } }, { merge: true });
      } catch (e) { console.error("Error updating fiats:", e); }
    }
  };

  // 🛠️ RE-ADDED MISSING FUNCTIONS TO PREVENT CODE DECREASE
  const updateUserSettings = async (newSettings) => {
    if (auth.currentUser) {
      try {
         const safeSettings = cleanForFirestore(newSettings);
         await setDoc(doc(db, "users", auth.currentUser.uid), { settings: safeSettings }, { merge: true });
      } catch (e) { console.error("Error updating settings:", e); }
    }
  };

  const updateUserProfile = async (updates) => {
    if (auth.currentUser) {
      try {
         const safeUpdates = cleanForFirestore(updates);
         await setDoc(doc(db, "users", auth.currentUser.uid), safeUpdates, { merge: true });
      } catch (e) { console.error("Error updating profile:", e); }
    }
  }

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

  const value = {
    user, dbData, loading, avatar, displayName,
    baseCurrency, updateBaseCurrency,          
    selectedCryptos, updateSelectedCryptos, 
    selectedFiats, updateSelectedFiats,
    updateUserSettings, updateUserProfile, // Restored core functionality functions
    signup: registerUser, login: loginUser, logout: logoutUser,
    loginWithGoogle: () => socialLogin("google"),
    loginWithGithub: () => socialLogin("github"),
    resetPassword: resetPasswordEmail, refreshUser,
    formatGlobalDate
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