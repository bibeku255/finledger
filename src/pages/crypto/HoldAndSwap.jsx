// src/pages/crypto/HoldAndSwap.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  collection, addDoc, setDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, getDoc, getDocs, where
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPIN } from '../../utils/cryptoUtils';
import { useCryptoPrice } from '../../context/CryptoPriceContext';  // ✅ NEW

import {
  HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlinePlus, HiOutlineSparkles, HiOutlineX,
  HiOutlinePencil, HiOutlineTrash, HiOutlineClock, HiOutlineRefresh,
  HiOutlineLockClosed, HiOutlineChevronDown, HiOutlineShieldCheck,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineCursorClick, HiOutlineCalendar,
  HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineInformationCircle
} from 'react-icons/hi';
import {
  FaExchangeAlt, FaShoppingBag, FaBullseye, FaWallet, FaCoins,
  FaChartLine
} from 'react-icons/fa';

// ============================================
// 🚀 MINI TOAST SYSTEM (Self-contained)
// ============================================
const ToastContext = React.createContext(null);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };
  const removeToast = id => setToasts(prev => prev.filter(t => t.id !== id));
  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-24 right-4 z-[10000] space-y-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 fade-in duration-300 ${
            toast.type === 'success' ? 'bg-green-50/95 dark:bg-green-900/90 border-green-200 dark:border-green-700' :
            toast.type === 'error' ? 'bg-red-50/95 dark:bg-red-900/90 border-red-200 dark:border-red-700' :
            toast.type === 'warning' ? 'bg-amber-50/95 dark:bg-amber-900/90 border-amber-200 dark:border-amber-700' :
            'bg-blue-50/95 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700'
          }`}>
            {toast.type === 'success' && <HiOutlineCheckCircle className="text-green-600 dark:text-green-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <HiOutlineExclamationCircle className="text-red-600 dark:text-red-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'warning' && <HiOutlineExclamationCircle className="text-amber-600 dark:text-amber-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info' && <HiOutlineInformationCircle className="text-blue-600 dark:text-blue-400 w-5 h-5 flex-shrink-0" />}
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><HiOutlineX size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
const useToast = () => React.useContext(ToastContext);

// ============================================
// 🧩 SUB-COMPONENTS (unchanged)
// ============================================
const LogoRenderer = ({ symbol, logoUrl, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => { setHasError(false); }, [logoUrl]);
  if (!logoUrl || hasError) return <span className={`w-full h-full rounded-full flex items-center justify-center font-black text-[10px] sm:text-[11px] ${bg || 'bg-slate-200 dark:bg-slate-700'} ${color || 'text-slate-600 dark:text-white'}`}>{symbol?.toUpperCase()?.substring(0, 3)}</span>;
  return <img src={logoUrl} alt={symbol} className="w-full h-full object-contain rounded-full bg-white dark:bg-slate-800 p-0.5 shadow-sm border border-slate-200 dark:border-slate-700" onError={() => setHasError(true)} />;
};

const getLocalISOString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
};

const AISignalBadge = ({ profitPct }) => {
  const signals = {
    high: { label: 'SWAP TO USDT', tooltip: 'Heavy profit - swap to secure gains', bg: 'bg-gradient-to-r from-emerald-500 to-teal-500', text: 'text-white', shadow: 'shadow-emerald-500/30', icon: <FaExchangeAlt size={12} /> },
    medium: { label: 'HOLD ASSET', tooltip: 'In profit zone - hold for more upside', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-400', shadow: '', icon: <HiOutlineSparkles size={12} /> },
    sideways: { label: 'STAKE / EARN', tooltip: 'Market sideways - earn yield while waiting', bg: 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30', text: 'text-amber-700 dark:text-amber-400', shadow: '', icon: <FaCoins size={12} /> },
    dip: { label: 'BUY THE DIP', tooltip: 'Heavy discount - average down your entry', bg: 'bg-gradient-to-r from-blue-500 to-cyan-500', text: 'text-white', shadow: 'shadow-blue-500/30', icon: <FaShoppingBag size={12} /> },
    default: { label: 'HOLD POSITION', tooltip: 'Minor loss - do not sell', bg: 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400', shadow: '', icon: <HiOutlineClock size={12} /> }
  };

  let signal;
  if (profitPct >= 15) signal = signals.high;
  else if (profitPct >= 3) signal = signals.medium;
  else if (profitPct > -5) signal = signals.sideways;
  else if (profitPct <= -12) signal = signals.dip;
  else signal = signals.default;

  return (
    <div title={signal.tooltip} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase ${signal.bg} ${signal.text} ${signal.shadow ? 'shadow-lg ' + signal.shadow : 'shadow-sm'} cursor-help transition-transform hover:scale-105 shrink-0`}>
      {signal.icon} <span className="mt-0.5 truncate">{signal.label}</span>
    </div>
  );
};

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const HoldAndSwapContent = () => {
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate, getCalendarMonthKey } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  // ✅ Global Crypto Price Context
  const { livePrices, fiatRate, isLoading: isMarketSyncing } = useCryptoPrice();

  const [records, setRecords] = useState([]);
  const [walletHoldings, setWalletHoldings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [existingLocations, setExistingLocations] = useState([]);
  const [existingCryptoWallets, setExistingCryptoWallets] = useState([]);

  const localTimeStr = getLocalISOString();
  const cryptoSymbols = useMemo(() => selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean), [selectedCryptos]);

  const [formData, setFormData] = useState({
    coin: cryptoSymbols.length > 0 ? cryptoSymbols[0] : 'BTC', amount: '', entryPrice: '', wallet: '', date: localTimeStr
  });

  // Collapsible months state
  const getCurrentMonthKey = () => getCalendarMonthKey ? getCalendarMonthKey(new Date().toISOString()) : `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const [openMonths, setOpenMonths] = useState(new Set([getCurrentMonthKey()]));
  const toggleMonth = (monthKey) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  };

  // Real-time listeners for HoldAndSwap records and Crypto Wallet balances
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "users", user.uid, "holdAndSwap"), orderBy("timestamp", "desc"));
    const unsubscribeHold = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(data);

      const locations = new Set();
      data.forEach(d => { if(d.wallet) locations.add(d.wallet) });
      setExistingLocations(Array.from(locations));

      setIsLoading(false);
    }, (err) => {
      addToast('Failed to load buy entries.', 'error');
      setIsLoading(false);
    });

    const qVault = query(collection(db, "users", user.uid, "cryptoWalletLogs"), orderBy("timestamp", "desc"));
    const unsubscribeVault = onSnapshot(qVault, (snapshot) => {
      const vaultData = {};
      const vaultPlatforms = new Set();

      snapshot.docs.forEach(doc => {
        const t = doc.data();
        if (t.platform) vaultPlatforms.add(t.platform);
        if (t.fromPlatform) vaultPlatforms.add(t.fromPlatform);
        if (t.toPlatform) vaultPlatforms.add(t.toPlatform);

        if (!vaultData[t.coin]) vaultData[t.coin] = { platforms: {} };
        const qty = parseFloat(t.quantity) || 0;
        const fee = parseFloat(t.networkFee || t.fee) || 0;
        const totalQty = parseFloat(t.totalQuantity) || (qty + fee); // fallback

        if (t.type === 'in') {
          vaultData[t.coin].platforms[t.platform] = (vaultData[t.coin].platforms[t.platform] || 0) + qty;
        } else if (t.type === 'out') {
          // Out में quantity + fee दोनों घटाएँ
          vaultData[t.coin].platforms[t.platform] = (vaultData[t.coin].platforms[t.platform] || 0) - totalQty;
        } else if (t.type === 'transfer') {
          vaultData[t.coin].platforms[t.fromPlatform] = (vaultData[t.coin].platforms[t.fromPlatform] || 0) - qty;
          vaultData[t.coin].platforms[t.toPlatform] = (vaultData[t.coin].platforms[t.toPlatform] || 0) + (qty - fee);
        }
      });

      // Clean tiny balances
      Object.keys(vaultData).forEach(coin => {
        Object.keys(vaultData[coin].platforms).forEach(plat => {
          if (vaultData[coin].platforms[plat] <= 0.00000001) delete vaultData[coin].platforms[plat];
        });
        if (Object.keys(vaultData[coin].platforms).length === 0) delete vaultData[coin];
      });

      setWalletHoldings(vaultData);
      setExistingCryptoWallets(Array.from(vaultPlatforms));
    }, (err) => {
      addToast('Failed to load wallet balances.', 'error');
    });

    return () => { unsubscribeHold(); unsubscribeVault(); };
  }, [user, addToast]);

  const allWalletSuggestions = useMemo(() => Array.from(new Set([...existingLocations, ...existingCryptoWallets])), [existingLocations, existingCryptoWallets]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && userSnap.data().customCoins) setCustomUserCoins(userSnap.data().customCoins);
    };
    fetchUserData();
  }, [user]);

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    selectedCryptos.forEach(c => {
      if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c);
      else coinMap.set(c.toUpperCase(), { symbol: c.toUpperCase(), id: c.toLowerCase() });
    });
    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c, logo: c.logo || existing?.logo });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  // ❌ REMOVED: fetchTablePrices, fetchLivePriceForForm, livePrices state, isFetchingLive state, and related effects

  // ✅ Helper: base currency price for a coin from context
  const getBasePrice = useCallback((coinSymbol) => {
    const priceUSD = livePrices[coinSymbol]?.priceUSD || 0;
    return priceUSD * fiatRate;
  }, [livePrices, fiatRate]);

  // ✅ Form live price filler
  const fillLivePriceForForm = () => {
    if (!formData.coin) return;
    const price = getBasePrice(formData.coin);
    if (price) {
      setFormData(prev => ({ ...prev, entryPrice: price.toFixed(6).replace(/\.?0+$/, '') }));
    } else {
      addToast("Live price not available for this coin yet.", "warning");
    }
  };

  const handleDownloadReport = (format) => {
    setIsExportMenuOpen(false);
    if (records.length === 0) {
      addToast("No tracked assets found.", "warning");
      return;
    }

    const reportData = records.map(rec => {
      const livePrice = getBasePrice(rec.coin) || rec.entryPrice;
      const profitPct = (((livePrice - rec.entryPrice) / rec.entryPrice) * 100);
      const isProfit = profitPct >= 0;

      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date.split('T')[0],
        asset: `${rec.amount} ${rec.coin}`,
        location: rec.wallet || 'N/A',
        entry: Number(rec.entryPrice),
        live: Number(livePrice),
        pnl: `${isProfit ? '+' : ''}${profitPct.toFixed(2)}%`
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Asset Holdings', key: 'asset' },
      { header: 'Storage / Wallet', key: 'location' },
      { header: `Entry Price (${currencySymbol})`, key: 'entry', isNumeric: true },
      { header: `Live Price (${currencySymbol})`, key: 'live', isNumeric: true },
      { header: 'Net P/L (%)', key: 'pnl' }
    ];

    const fileName = `AI_Hold_Swap_Report`;
    const reportTitle = `Hold & Swap AI Tracking Report`;

    try {
      if (format === 'pdf') {
        downloadPDFReport(reportData, columns, fileName, reportTitle, {
          onSuccess: () => addToast('PDF report downloaded!', 'success'),
          onError: (msg) => addToast(`PDF Error: ${msg}`, 'error')
        });
      } else {
        downloadExcelReport(reportData, columns, fileName, reportTitle, {
          onSuccess: () => addToast('Excel report downloaded!', 'success'),
          onError: (msg) => addToast(`Excel Error: ${msg}`, 'error')
        });
      }
    } catch (e) {
      addToast('Failed to generate report.', 'error');
    }
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault(); if (!user) return;
    setIsSaving(true);
    const recordData = {
      coin: formData.coin, amount: parseFloat(formData.amount),
      entryPrice: parseFloat(formData.entryPrice), wallet: formData.wallet || 'Binance',
      date: formData.date, timestamp: new Date(formData.date).getTime()
    };
    try {
      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "holdAndSwap", editingId), recordData, { merge: true });
        addToast('Target updated!', 'success');
      } else {
        await addDoc(collection(db, "users", user.uid, "holdAndSwap"), recordData);
        addToast('Buy entry added!', 'success');
      }
      closeModal();
    } catch (error) {
      addToast("Failed to save.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (rec) => {
    let editDateStr = rec.date;
    if (rec.timestamp) {
      const d = new Date(rec.timestamp);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      editDateStr = d.toISOString().slice(0, 16);
    } else if (editDateStr.length === 10) {
      editDateStr = editDateStr + 'T12:00';
    }

    setFormData({
      coin: rec.coin, amount: rec.amount, entryPrice: rec.entryPrice,
      wallet: rec.wallet || '', date: editDateStr
    });
    setEditingId(rec.id); setIsModalOpen(true);
  };

  const initiateDelete = (rec) => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your PIN.");
    setIsVerifying(true);
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const storedHash = userSnap.data()?.security?.pinHash || userSnap.data()?.securityPin || userSnap.data()?.pin;

      const { valid, newHash } = await verifyPIN(pinInput.trim(), storedHash, user.uid);

      if (!valid) {
        setPinError("Incorrect PIN.");
        setIsVerifying(false);
        return;
      }

      if (newHash) {
        await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true });
      }

      await deleteDoc(doc(db, "users", user.uid, "holdAndSwap", deleteContext.id));
      setDeleteContext(null);
      addToast('Record deleted.', 'info');
    } catch (error) {
      setPinError("Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openModal = () => {
    if(cryptoSymbols.length === 0) {
      addToast("Please add at least one crypto to your watchlist from settings!", "warning");
      return;
    }
    setIsModalOpen(true);
    setEditingId(null);
    setFormData({ coin: cryptoSymbols[0] || 'BTC', amount: '', entryPrice: '', wallet: allWalletSuggestions[0] || '', date: getLocalISOString() });
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

  const totalInvested = records.reduce((acc, rec) => acc + (rec.amount * rec.entryPrice), 0);
  const totalCurrent = records.reduce((acc, rec) => acc + (rec.amount * (getBasePrice(rec.coin) || rec.entryPrice)), 0);
  const totalProfit = totalCurrent - totalInvested;
  const profitPercentage = totalInvested > 0 ? ((totalProfit / totalInvested) * 100).toFixed(2) : 0;

  const getAvailableBalance = () => {
    if (!formData.coin || !formData.wallet) return null;
    const coinData = walletHoldings[formData.coin];
    if (coinData && coinData.platforms[formData.wallet]) {
      const bal = coinData.platforms[formData.wallet];
      return bal > 0.00000001 ? bal : 0;
    }
    return 0;
  };
  const currentFormBalance = getAvailableBalance();

  // ==============================
  // 🚀 MONTH GROUPING (unchanged)
  // ==============================
  const processedMonths = useMemo(() => {
    const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    const grouped = {};

    sorted.forEach(rec => {
      const dateObj = new Date(rec.date);
      const monthKey = getCalendarMonthKey ? getCalendarMonthKey(rec.date) : `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' }),
          records: [],
          totalInvested: 0,
        };
      }
      const invested = (parseFloat(rec.amount) || 0) * (parseFloat(rec.entryPrice) || 0);
      grouped[monthKey].records.push(rec);
      grouped[monthKey].totalInvested += invested;
    });

    return Object.keys(grouped)
      .sort((a, b) => (grouped[b].records[0]?.timestamp || 0) - (grouped[a].records[0]?.timestamp || 0))
      .map(key => {
        const month = grouped[key];
        month.records = month.records.reverse();
        return month;
      });
  }, [records, formatGlobalDate, getCalendarMonthKey]);

  // Skeleton loaders
  const SkeletonTable = () => (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left min-w-[700px]">
        <thead className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <tr><th className="p-4 pl-6">Asset & Wallet</th><th className="p-4">Holdings Info</th><th className="p-4">Live Performance</th><th className="p-4">AI Signal</th><th className="p-4 pr-6 text-right">Actions</th></tr>
        </thead>
        <tbody>
          {[1,2,3].map(i => (
            <tr key={i} className="animate-pulse">
              <td className="p-4 pl-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              </td>
              <td className="p-4">
                <div className="space-y-1.5">
                  <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </td>
              <td className="p-4">
                <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
              </td>
              <td className="p-4">
                <div className="h-6 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
              </td>
              <td className="p-4 pr-6">
                <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const SkeletonCards = () => (
    <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
      {[1,2,3].map(i => (
        <div key={i} className="p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-1.5">
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full min-h-screen overflow-y-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">

        {/* Premium Header */}
        <div className="relative rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50 z-20">
          <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_70%)]" />
            <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg"><FaBullseye size={24} className="text-white" /></div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">AI Swap & Stake</h1>
                  <p className="text-sm font-medium text-slate-400">Track individual asset entries and get AI action signals</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 shadow-sm"
                >
                  <HiOutlineDownload size={16} /> Export
                </button>
                {isExportMenuOpen && (
                  <div className="absolute top-[110%] right-0 md:left-0 w-full md:w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl flex flex-col p-1.5 z-[100] animate-in fade-in zoom-in-95">
                    <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg transition-colors"><HiOutlineDocumentText className="text-rose-400" size={16}/> PDF Report</button>
                    <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg transition-colors"><HiOutlineTable className="text-emerald-400" size={16}/> Excel (CSV)</button>
                  </div>
                )}
              </div>

              <button onClick={openModal} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all active:scale-95">
                <HiOutlinePlus size={18} /> Add Target
              </button>
            </div>
          </div>

          <div className="relative z-30 grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Invested</p>
              <p className="text-sm md:text-xl font-black text-white truncate" title={`${currencySymbol}${totalInvested.toLocaleString()}`}>{currencySymbol}{totalInvested.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 flex items-center gap-1">Live Value {isMarketSyncing && <HiOutlineRefresh className="animate-spin text-emerald-400" size={10} />}</p>
              <p className="text-sm md:text-xl font-black text-emerald-400 truncate" title={`${currencySymbol}${totalCurrent.toLocaleString()}`}>{currencySymbol}{totalCurrent.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="col-span-2 md:col-span-1 bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Net P/L</p>
              <p className={`text-sm md:text-xl font-black truncate ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalProfit >= 0 ? '+' : ''}{profitPercentage}%
              </p>
            </div>
          </div>
        </div>

        {/* 🚀 COLLAPSIBLE MONTHS TABLE */}
        {isLoading ? (
          <>
            <SkeletonTable />
            <SkeletonCards />
          </>
        ) : processedMonths.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <FaBullseye className="text-5xl text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-lg font-black text-slate-700 dark:text-slate-300">No buy entries yet</p>
            <p className="text-sm text-slate-500">Add your first target to see AI signals.</p>
          </div>
        ) : (
          processedMonths.map(month => {
            const isOpen = openMonths.has(month.monthKey);
            const totalInvestedMonth = month.totalInvested;

            return (
              <div key={month.monthKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm">
                {/* Month Header */}
                <button
                  onClick={() => toggleMonth(month.monthKey)}
                  className="w-full px-6 py-5 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left"
                >
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
                      <HiOutlineCalendar size={18} />
                    </div>
                    {month.monthName}
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Invested</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">{currencySymbol}{totalInvestedMonth.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    </div>
                    <HiOutlineChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="animate-in fade-in duration-200">
                    {/* Mobile Cards */}
                    <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                      {month.records.map((rec) => {
                        const livePrice = getBasePrice(rec.coin) || rec.entryPrice;
                        const profitPct = (((livePrice - rec.entryPrice) / rec.entryPrice) * 100);
                        const isProfit = profitPct >= 0;
                        const coinObj = fullDatabase.find(c => c.symbol === rec.coin.toUpperCase()) || {};

                        return (
                          <div key={rec.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 p-1 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                                <LogoRenderer symbol={rec.coin} logoUrl={coinObj.logo} bg={coinObj.bg} color={coinObj.color} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-black text-slate-900 dark:text-white text-sm uppercase">{rec.coin}</p>
                                    <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5"><FaWallet className="text-blue-400 shrink-0" size={10}/> {rec.wallet}</p>
                                  </div>
                                  <AISignalBadge profitPct={profitPct} />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Amount</p>
                                <p className="font-black text-slate-800 dark:text-white">{rec.amount} {rec.coin}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Entry</p>
                                <p className="font-black text-slate-800 dark:text-white">{currencySymbol}{rec.entryPrice < 1 ? rec.entryPrice.toFixed(6) : rec.entryPrice}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Live</p>
                                <p className="font-black text-slate-800 dark:text-white">{currencySymbol}{livePrice < 1 ? livePrice.toFixed(6) : livePrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">P/L</p>
                                <p className={`font-black flex items-center gap-1 ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {isProfit ? <HiOutlineTrendingUp size={14} /> : <HiOutlineTrendingDown size={14} />}
                                  {isProfit ? '+' : ''}{profitPct.toFixed(2)}%
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <p className="text-[9px] font-medium text-slate-400 flex items-center gap-1"><HiOutlineCalendar size={10}/> {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}</p>
                              <div className="flex gap-1 ml-auto">
                                <button onClick={() => handleEdit(rec)} className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-500/30 shadow-sm active:scale-95"><HiOutlinePencil size={14}/></button>
                                <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-500/30 shadow-sm active:scale-95"><HiOutlineTrash size={14}/></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[700px]">
                        <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                          <tr><th className="p-4 pl-6">Asset & Wallet</th><th className="p-4">Holdings Info</th><th className="p-4">Live Performance</th><th className="p-4">AI Signal</th><th className="p-4 pr-6 text-right">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {month.records.map((rec) => {
                            const livePrice = getBasePrice(rec.coin) || rec.entryPrice;
                            const profitPct = (((livePrice - rec.entryPrice) / rec.entryPrice) * 100);
                            const isProfit = profitPct >= 0;
                            const coinObj = fullDatabase.find(c => c.symbol === rec.coin.toUpperCase()) || {};

                            return (
                              <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                                <td className="p-4 pl-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 p-1 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                                      <LogoRenderer symbol={rec.coin} logoUrl={coinObj.logo} bg={coinObj.bg} color={coinObj.color} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-black text-slate-900 dark:text-white text-sm uppercase truncate">{rec.coin}</p>
                                      <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5 truncate"><FaWallet className="text-blue-400 shrink-0" size={10}/> <span className="truncate">{rec.wallet}</span></p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <p className="font-black text-slate-800 dark:text-white truncate max-w-[120px]" title={rec.amount}>{rec.amount} <span className="text-[10px] text-slate-500 uppercase">{rec.coin}</span></p>
                                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest truncate max-w-[120px]" title={`Bought @ ${currencySymbol}${rec.entryPrice < 1 ? rec.entryPrice.toFixed(6) : rec.entryPrice}`}>Bought @ {currencySymbol}{rec.entryPrice < 1 ? rec.entryPrice.toFixed(6) : rec.entryPrice}</p>
                                </td>
                                <td className="p-4">
                                  <div className={`inline-flex flex-col px-3.5 py-2 rounded-xl border ${isProfit ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400'}`}>
                                    <p className="text-xs font-black flex items-center gap-1">{isProfit ? <HiOutlineTrendingUp size={14} className="shrink-0"/> : <HiOutlineTrendingDown size={14} className="shrink-0"/>}{isProfit ? '+' : ''}{profitPct.toFixed(2)}%</p>
                                    <p className="text-[9px] font-bold opacity-80 mt-0.5 uppercase tracking-widest text-center truncate max-w-[80px]" title={`Live: ${currencySymbol}${livePrice < 1 ? livePrice.toFixed(6) : livePrice.toLocaleString(undefined, {minimumFractionDigits: 2})}`}>Live: {currencySymbol}{livePrice < 1 ? livePrice.toFixed(6) : livePrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                  </div>
                                </td>
                                <td className="p-4"><AISignalBadge profitPct={profitPct} /></td>
                                <td className="p-4 pr-6">
                                  <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(rec)} className="p-2.5 bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-500 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 dark:hover:text-blue-400 rounded-xl transition-all shadow-sm active:scale-95"><HiOutlinePencil size={16} /></button>
                                    <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-100 dark:border-rose-500/30 rounded-xl transition-all shadow-sm active:scale-95"><HiOutlineTrash size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[60px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-4rem)] sm:max-h-[85vh] border border-slate-300 dark:border-slate-700 animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white flex justify-between items-center sticky top-0 z-10 shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><FaBullseye size={20} /> {editingId ? 'Edit Target' : 'Log New Asset'}</h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><HiOutlineX size={20} /></button>
            </div>
            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset (Watchlist)</label>
                  <div className="relative mt-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center overflow-hidden z-10 pointer-events-none">
                      <LogoRenderer symbol={formData.coin} logoUrl={fullDatabase.find(c=>c.symbol===formData.coin)?.logo} bg={fullDatabase.find(c=>c.symbol===formData.coin)?.bg} color={fullDatabase.find(c=>c.symbol===formData.coin)?.color} />
                    </div>
                    <select required value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className="w-full pl-14 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none shadow-sm transition-colors">
                      {cryptoSymbols.length > 0 ? cryptoSymbols.map(c => <option key={c} value={c}>{c}</option>) : <option value="BTC">BTC (Default)</option>}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Location</label>
                  <input type="text" required list="wallet-suggestions" value={formData.wallet} onChange={(e) => setFormData({...formData, wallet: e.target.value})} placeholder="e.g., Binance, Trust Wallet" className="w-full mt-1 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
                  <datalist id="wallet-suggestions">
                    {allWalletSuggestions.map(l => <option key={l} value={l} />)}
                  </datalist>
                </div>
              </div>
              <div
                onClick={() => { if (currentFormBalance > 0) setFormData(prev => ({ ...prev, amount: currentFormBalance })); }}
                className={`p-3.5 rounded-xl flex items-center justify-between shadow-sm transition-all duration-200 ${currentFormBalance > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-800/30 hover:shadow-md active:scale-[0.98]' : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-70'}`}
              >
                 <div className="flex items-center gap-2">
                   <FaWallet className={currentFormBalance > 0 ? 'text-emerald-500' : 'text-slate-400'} size={14}/>
                   <div>
                     <p className={`text-[9px] font-black uppercase tracking-widest ${currentFormBalance > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>Available in Vault</p>
                     {currentFormBalance > 0 && <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5">Tap to auto-fill amount</p>}
                   </div>
                 </div>
                 <p className={`text-base font-black ${currentFormBalance > 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                   {currentFormBalance % 1 !== 0 ? currentFormBalance.toFixed(6).replace(/\.?0+$/, '') : currentFormBalance} <span className="text-[10px] uppercase opacity-70">{formData.coin}</span>
                 </p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between"><span>Quantity Bought</span></label>
                <input type="number" step="any" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="e.g., 0.5" className="w-full mt-1 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl font-black text-3xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm placeholder-slate-300 dark:placeholder-slate-600 transition-colors" />
              </div>
              <div className="p-4 sm:p-5 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1"><FaCoins/> Entry Price ({currencySymbol})</label>
                  <button type="button" onClick={fillLivePriceForForm} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-700 transition-colors shadow-sm tracking-widest uppercase">
                    <HiOutlineRefresh size={14} /> Fetch Live
                  </button>
                </div>
                <input type="number" step="any" required value={formData.entryPrice} onChange={(e) => setFormData({...formData, entryPrice: e.target.value})} placeholder="Average buy price..." className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700/50 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Date & Time</span>
                  <span className="text-blue-600 dark:text-blue-400">{formatGlobalDate && formData.date ? formatGlobalDate(formData.date.split('T')[0], 'short') : ''}</span>
                </label>
                <input type="datetime-local" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full mt-1 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-colors cursor-pointer" />
              </div>
              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
                <button type="submit" disabled={isSaving} className="w-full p-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shrink-0">
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-xl" /> : <HiOutlineShieldCheck size={20} />}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Target' : 'Save Track Entry')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal (unchanged) */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 border border-rose-200 dark:border-rose-900/50 relative overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 flex flex-col">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-500 to-pink-500"></div>
            <div className="flex flex-col items-center text-center mb-6 shrink-0">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner border border-rose-200 dark:border-rose-500/30"><HiOutlineLockClosed /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-xs font-bold text-slate-500 mt-2">Deleting this record will alter your total invested tracking.</p>
            </div>
            <form onSubmit={executeSecureDelete} className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl shadow-sm">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">You are permanently deleting <span className="font-black text-amber-900 dark:text-amber-200">{deleteContext.amount} {deleteContext.coin}</span> tracking data.</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 text-center block">Enter Security PIN</label>
                <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="••••••" className="w-full mt-1 text-center tracking-[0.5em] text-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm transition-colors focus:border-rose-500" />
                {pinError && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 text-center animate-bounce mt-2">{pinError}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm border border-slate-300 dark:border-slate-700">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-lg shadow-rose-500/30 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : null} Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const HoldAndSwap = () => (
  <ToastProvider>
    <HoldAndSwapContent />
  </ToastProvider>
);

export default HoldAndSwap;