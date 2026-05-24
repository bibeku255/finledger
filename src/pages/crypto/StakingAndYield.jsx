// src/pages/crypto/StakingAndYield.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPIN } from '../../utils/cryptoUtils';
import { useCryptoPrice } from '../../context/CryptoPriceContext';  // ✅ NEW
import {
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineLockClosed,
  HiOutlineChevronDown, HiOutlineDownload, HiOutlineDocumentText,
  HiOutlineTable, HiOutlineLightningBolt, HiOutlineGift,
  HiOutlineShieldCheck, HiOutlineUserGroup, HiOutlineCalendar,
  HiOutlineClock, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineInformationCircle
} from 'react-icons/hi';
import {
  FaWallet, FaTrophy, FaPiggyBank, FaLeaf, FaCoins, FaHistory, FaBuilding
} from 'react-icons/fa';

// ============================================
// 🚀 MINI TOAST SYSTEM
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

// Helpers
const LogoRenderer = ({ symbol, logoUrl, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => { setHasError(false); }, [logoUrl]);
  if (!logoUrl || hasError) return <span className={`w-full h-full flex items-center justify-center font-black text-[10px] sm:text-[11px] ${bg || 'bg-slate-200 dark:bg-slate-700'} ${color || 'text-slate-500'} rounded-full`}>{symbol?.toUpperCase()?.substring(0, 2)}</span>;
  return <img src={logoUrl} alt={symbol} className="w-full h-full object-contain p-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm" onError={() => setHasError(true)} />;
};

const getLocalISOString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
};

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const StakingAndYieldContent = () => {
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate, getCalendarMonthKey } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  const [stakes, setStakes] = useState([]);
  const [walletHoldings, setWalletHoldings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]);

  // ✅ Global Crypto Price Context – सीधे कम्पोनेंट में
  const { livePrices, fiatRate, isLoading: isMarketSyncing } = useCryptoPrice();

  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeClaimStake, setActiveClaimStake] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [claimHistoryStake, setClaimHistoryStake] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyPinInput, setHistoryPinInput] = useState('');
  const [historyPinError, setHistoryPinError] = useState('');
  const [isHistoryVerifying, setIsHistoryVerifying] = useState(false);
  const [historyDeleteContext, setHistoryDeleteContext] = useState(null);

  const [existingPlatforms, setExistingPlatforms] = useState([]);
  const localTimeStr = getLocalISOString();

  const [filterMode, setFilterMode] = useState('all');
  const getCurrentMonthKey = () => getCalendarMonthKey ? getCalendarMonthKey(new Date().toISOString()) : `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const [openMonths, setOpenMonths] = useState(new Set([getCurrentMonthKey()]));
  const toggleMonth = (monthKey) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  };

  const cryptoSymbols = useMemo(() => selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean), [selectedCryptos]);
  const activeCryptos = cryptoSymbols.length > 0 ? cryptoSymbols : ['USDT', 'BNB', 'BTC'];
  const rewardOptions = Array.from(new Set([...activeCryptos, 'USDT']));

  const [formData, setFormData] = useState({
    earningType: 'stake', coin: activeCryptos[0], rewardCoin: rewardOptions[0],
    poolCoin2: activeCryptos[1] || 'USDT', platform: '', principalAmount: '', poolPrincipal2: '',
    apr: '', lockPeriod: 'Flexible', customLockDays: '', startDate: localTimeStr, entryPrice: ''
  });
  const [claimData, setClaimData] = useState({ claimCoin: '', amountClaimed: '', platformFeePercent: '10', date: localTimeStr });

  // Real-time listeners
  useEffect(() => {
    if (!user) return;

    const qStake = query(collection(db, "users", user.uid, "stakingLogs"), orderBy("timestamp", "desc"));
    const unsubStake = onSnapshot(qStake, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStakes(data);
      const platforms = new Set();
      data.forEach(d => { if(d.platform) platforms.add(d.platform) });
      setExistingPlatforms(Array.from(platforms));
      setIsLoading(false);
      if (claimHistoryStake) {
        const updatedCurrentStake = data.find(s => s.id === claimHistoryStake.id);
        if (updatedCurrentStake) setClaimHistoryStake(updatedCurrentStake);
      }
    }, (err) => {
      addToast('Failed to load staking logs.', 'error');
      setIsLoading(false);
    });

    const qVault = query(collection(db, "users", user.uid, "cryptoWalletLogs"), orderBy("timestamp", "desc"));
    const unsubscribeVault = onSnapshot(qVault, (snapshot) => {
      const vaultData = {};
      snapshot.docs.forEach(doc => {
        const t = doc.data();
        if (!vaultData[t.coin]) vaultData[t.coin] = { platforms: {} };
        const qty = parseFloat(t.quantity) || 0;
        const fee = parseFloat(t.networkFee || t.fee) || 0;
        const totalQty = parseFloat(t.totalQuantity) || (qty + fee); // ✅ fallback

        if (t.type === 'in') {
          vaultData[t.coin].platforms[t.platform] = (vaultData[t.coin].platforms[t.platform] || 0) + qty;
        } else if (t.type === 'out') {
          // ✅ Out में quantity + fee दोनों घटाएँ
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
    });

    return () => { unsubStake(); unsubscribeVault(); };
  }, [user, claimHistoryStake, addToast]);

  useEffect(() => {
    const f = async () => { if (!user) return; const sn = await getDoc(doc(db, "users", user.uid)); if (sn.exists() && sn.data().customCoins) setCustomUserCoins(sn.data().customCoins); };
    f();
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

  // ❌ REMOVED: fetchMarketData, livePrices, fiatRate states, and related effects

  // ✅ Helper: get live price from context
  const getLivePrice = useCallback((symbol) => {
    if (!symbol || symbol === 'N/A') return 0;
    const priceUSD = livePrices[symbol.toUpperCase()]?.priceUSD || 0;
    return priceUSD * fiatRate;
  }, [livePrices, fiatRate]);

  // Analytics
  const analytics = useMemo(() => {
    let tvl = 0, rewards = 0, daily = 0;
    stakes.forEach(s => {
      let v = (parseFloat(s.principalAmount)||0) * getLivePrice(s.coin);
      if (s.earningType === 'pool') v += (parseFloat(s.poolPrincipal2)||0) * getLivePrice(s.poolCoin2);
      tvl += v;
      daily += ((v * (parseFloat(s.apr)||0)) / 100) / 365;
      if (s.claimedHistory) s.claimedHistory.forEach(h => { rewards += (parseFloat(h.amount)||0) * getLivePrice(h.coin); });
    });
    return { totalValueLocked: tvl, totalRewardsClaimedFiat: rewards, totalDailyPassiveIncome: daily };
  }, [stakes, getLivePrice]);

  const handleDownloadReport = (format) => {
    setIsExportMenuOpen(false);
    if (stakes.length === 0) { addToast("No streams found.", "warning"); return; }
    const data = stakes.map(r => ({
      startDate: formatGlobalDate ? formatGlobalDate(r.startDate, 'full') : r.startDate.split('T')[0],
      platform: r.platform,
      type: r.earningType === 'pool' ? 'Liquidity Pool' : 'Single Stake',
      principal: r.earningType === 'pool' ? `${r.principalAmount} ${r.coin} + ${r.poolPrincipal2} ${r.poolCoin2}` : `${r.principalAmount} ${r.coin}`,
      apr: `${r.apr}%`,
      harvested: Number(r.claimedHistory ? r.claimedHistory.reduce((a,h) => a + parseFloat(h.amount||0), 0) : 0)
    }));
    const cols = [
      { header: 'Date', key: 'startDate' }, { header: 'Platform', key: 'platform' }, { header: 'Type', key: 'type' },
      { header: 'Principal', key: 'principal' }, { header: 'APR', key: 'apr' }, { header: 'Harvested', key: 'harvested', isNumeric: true }
    ];
    try {
      if (format === 'pdf') downloadPDFReport(data, cols, 'Staking_Yield_Farming', 'Staking & Yield Farming Report', { onSuccess: () => addToast('PDF downloaded!', 'success'), onError: (msg) => addToast(`PDF Error: ${msg}`, 'error') });
      else downloadExcelReport(data, cols, 'Staking_Yield_Farming', 'Staking & Yield Farming Report', { onSuccess: () => addToast('Excel downloaded!', 'success'), onError: (msg) => addToast(`Excel Error: ${msg}`, 'error') });
    } catch (e) { addToast('Export failed.', 'error'); }
  };

  const handleSaveStake = async (e) => {
    e.preventDefault(); if (!user) return;
    if (!formData.platform.trim()) { addToast("Please specify the Platform / Exchange.", "warning"); return; }
    setIsSaving(true);
    const d = {
      earningType: formData.earningType, platform: formData.platform.trim(),
      apr: parseFloat(formData.apr),
      lockPeriod: formData.lockPeriod === 'Custom' ? formData.customLockDays : formData.lockPeriod,
      startDate: formData.startDate,
      timestamp: editingId ? stakes.find(s=>s.id===editingId)?.timestamp : new Date(formData.startDate).getTime(),
      coin: formData.coin,
      principalAmount: parseFloat(formData.principalAmount),
      rewardCoin: formData.earningType === 'pool' ? 'Dual' : formData.rewardCoin
    };
    if (formData.earningType === 'pool') { d.poolCoin2 = formData.poolCoin2; d.poolPrincipal2 = parseFloat(formData.poolPrincipal2); }
    try {
      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "stakingLogs", editingId), d, { merge: true });
        addToast('Stream updated!', 'success');
      } else {
        await addDoc(collection(db, "users", user.uid, "stakingLogs"), { ...d, claimedHistory: [] });
        addToast('New stream added!', 'success');
      }
      closeStakeModal();
    } catch(e) { addToast("Failed to save.", "error"); } finally { setIsSaving(false); }
  };

  const handleClaimReward = async (e) => {
    e.preventDefault(); if (!user || !activeClaimStake) return;
    const amtClaimed = parseFloat(claimData.amountClaimed);
    if (!amtClaimed || amtClaimed <= 0) { addToast("Please enter a valid yield amount.", "warning"); return; }
    setIsSaving(true);
    const fee = parseFloat(claimData.platformFeePercent)||0;
    const ts = new Date(claimData.date).getTime();
    const sourceString = activeClaimStake.earningType === 'pool' ? 'Liquidity Pool' : `Staking (${activeClaimStake.apr}%)`;

    try {
      const net = amtClaimed - (amtClaimed*(fee/100));
      const pr = getLivePrice(claimData.claimCoin) / fiatRate;
      const uid = `YIELD_${ts}_${Math.random().toString(36).slice(2,8)}`;

      const claimEntry = {
        claimId: uid,
        gross: amtClaimed,
        fee: fee,
        amount: net,
        coin: claimData.claimCoin,
        date: claimData.date,
        timestamp: ts
      };

      await setDoc(doc(db, "users", user.uid, "stakingLogs", activeClaimStake.id),
        { claimedHistory: arrayUnion(claimEntry) },
        { merge: true });

      await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), {
        type: 'in', coin: claimData.claimCoin, quantity: net, platform: activeClaimStake.platform,
        reason: `${sourceString} Reward`, referenceNo: uid, date: claimData.date.split('T')[0],
        timestamp: ts, stakeId: activeClaimStake.id, isMicroEarn: true, linkId: uid
      });

      await addDoc(collection(db, "users", user.uid, "incomeLogs"), {
        title: `Yield: ${claimData.claimCoin}`, category: "Crypto Staking Rewards", vault: 'crypto',
        subWallet: activeClaimStake.platform, cryptoPlatform: activeClaimStake.platform,
        asset: claimData.claimCoin, amount: net, exchangeRate: pr, finalBaseAmount: net*pr*fiatRate,
        date: claimData.date.split('T')[0], timestamp: ts, linkedIncomeId: uid,
        stakeId: activeClaimStake.id, isMicroEarn: true
      });

      addToast(`Harvested ${net} ${claimData.claimCoin}!`, 'success');
      closeClaimModal();
    } catch(e) { addToast("Failed to claim reward.", "error"); } finally { setIsSaving(false); }
  };

  const handleDeleteClaim = async (e) => {
    e.preventDefault();
    if (!historyPinInput.trim()) return setHistoryPinError("Enter Security PIN.");
    if (!historyDeleteContext) return;

    setIsHistoryVerifying(true);
    setHistoryPinError('');

    try {
      const sn = await getDoc(doc(db, "users", user.uid));
      const storedHash = sn.data()?.security?.pinHash || sn.data()?.securityPin || sn.data()?.pin;
      const { valid, newHash } = await verifyPIN(historyPinInput.trim(), storedHash, user.uid);

      if (!valid) {
        setHistoryPinError("Incorrect PIN.");
        setIsHistoryVerifying(false);
        return;
      }

      if (newHash) {
        await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true });
      }

      const claimIdToDelete = historyDeleteContext.claimId;
      const stakeRef = doc(db, "users", user.uid, "stakingLogs", claimHistoryStake.id);

      const updatedHistory = claimHistoryStake.claimedHistory.filter(h => h.claimId !== claimIdToDelete);
      await setDoc(stakeRef, { claimedHistory: updatedHistory }, { merge: true });

      for (const colName of ["cryptoWalletLogs", "incomeLogs"]) {
        const fieldName = colName === 'cryptoWalletLogs' ? 'linkId' : 'linkedIncomeId';
        const q = query(collection(db, "users", user.uid, colName), where(fieldName, "==", claimIdToDelete));
        const snap = await getDocs(q);
        snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, colName, d.id)));
      }

      setHistoryPinInput('');
      setHistoryDeleteContext(null);
      setIsHistoryVerifying(false);
      addToast('Claim reversed successfully.', 'info');
    } catch (error) {
      setHistoryPinError("Failed to delete claim.");
      setIsHistoryVerifying(false);
    }
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Enter PIN.");
    setIsVerifying(true);
    try {
      const sn = await getDoc(doc(db, "users", user.uid));
      const storedHash = sn.data()?.security?.pinHash || sn.data()?.securityPin || sn.data()?.pin;
      const { valid, newHash } = await verifyPIN(pinInput.trim(), storedHash, user.uid);

      if (!valid) {
        setPinError("Incorrect PIN.");
        setIsVerifying(false);
        return;
      }

      if (newHash) {
        await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true });
      }

      await deleteDoc(doc(db, "users", user.uid, "stakingLogs", deleteContext.id));
      for (const cn of ["cryptoWalletLogs", "incomeLogs"]) {
        const qs = await getDocs(query(collection(db, "users", user.uid, cn), where("stakeId", "==", deleteContext.id)));
        qs.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, cn, d.id)));
      }
      setDeleteContext(null);
      addToast('Stake deleted.', 'info');
    } catch(e) {
      setPinError("Error.");
    } finally {
      setIsVerifying(false);
    }
  };

  const closeStakeModal = () => { setIsStakeModalOpen(false); setEditingId(null); setFormData({ earningType: 'stake', coin: activeCryptos[0], rewardCoin: rewardOptions[0], poolCoin2: activeCryptos[1]||'USDT', platform: existingPlatforms[0] || '', principalAmount: '', poolPrincipal2: '', apr: '', lockPeriod: 'Flexible', customLockDays: '', startDate: getLocalISOString() }); };
  const closeClaimModal = () => { setIsClaimModalOpen(false); setActiveClaimStake(null); setClaimData({ claimCoin: '', amountClaimed: '', platformFeePercent: '10', date: getLocalISOString() }); };

  const openClaimModalFor = (rec) => {
    setActiveClaimStake(rec);
    setClaimData({
      claimCoin: rec.earningType==='pool' ? rec.coin : (rec.rewardCoin||rec.coin),
      amountClaimed: '', platformFeePercent: '10', date: getLocalISOString()
    });
    setIsClaimModalOpen(true);
  };

  const openHistoryModal = (stake) => {
    setClaimHistoryStake(stake);
    setHistoryPinInput('');
    setHistoryPinError('');
    setHistoryDeleteContext(null);
    setIsHistoryModalOpen(true);
  };

  const getAvailableBalance = () => {
    if (!formData.coin || !formData.platform) return 0;
    const bal = walletHoldings[formData.coin]?.platforms[formData.platform];
    return bal > 0.00000001 ? bal : 0;
  };
  const currentFormBalance = getAvailableBalance();

  // ========== Filtering & Month Grouping ==========
  const isMatured = (stake) => {
    if (!stake.lockPeriod || stake.lockPeriod === 'Flexible') return false;
    const totalDays = parseInt(stake.lockPeriod);
    const start = new Date(stake.startDate);
    const end = new Date(start); end.setDate(end.getDate() + totalDays);
    return new Date() >= end;
  };

  const filteredStakes = useMemo(() => {
    if (filterMode === 'all') return stakes;
    if (filterMode === 'active') return stakes.filter(s => !isMatured(s));
    if (filterMode === 'matured') return stakes.filter(s => isMatured(s));
    return stakes;
  }, [stakes, filterMode]);

  const processedMonths = useMemo(() => {
    const sorted = [...filteredStakes].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const grouped = {};
    sorted.forEach(s => {
      const dateObj = new Date(s.startDate || new Date());
      const monthKey = getCalendarMonthKey ? getCalendarMonthKey(s.startDate) : `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`;
      if (!grouped[monthKey]) grouped[monthKey] = {
        monthKey,
        monthName: formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' }),
        records: [],
        monthTotalTVL: 0
      };
      let v = (parseFloat(s.principalAmount)||0) * getLivePrice(s.coin);
      if (s.earningType === 'pool') v += (parseFloat(s.poolPrincipal2)||0) * getLivePrice(s.poolCoin2);
      grouped[monthKey].records.push(s);
      grouped[monthKey].monthTotalTVL += v;
    });
    return Object.keys(grouped)
      .sort((a, b) => (grouped[b].records[0]?.timestamp || 0) - (grouped[a].records[0]?.timestamp || 0))
      .map(key => {
        const month = grouped[key];
        month.records = month.records.reverse();
        return month;
      });
  }, [filteredStakes, formatGlobalDate, getCalendarMonthKey, getLivePrice]);

  const SkeletonCards = () => (
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
      {[1,2,3].map(i => (
        <div key={i} className="p-4 animate-pulse space-y-3">
          <div className="flex justify-between">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="flex justify-between items-center">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full min-h-screen overflow-y-auto pb-24">
      <div className="pt-24 md:pt-12 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">

        {/* Premium Header */}
        <div className="relative rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 sm:p-6 md:p-8 shadow-2xl border border-slate-700/50 z-20">
          <div className="absolute inset-0 overflow-hidden rounded-[2rem] md:rounded-[2.5rem] pointer-events-none">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(147,51,234,0.15),transparent_70%)]" />
             <div className="absolute right-0 top-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2 md:mb-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg"><HiOutlineLightningBolt className="text-white text-xl md:text-2xl" /></div>
                <div><h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">Earn & Farming Vault</h1><p className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-400">Track staking and LP pool yields</p></div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-nowrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
              <div className="relative w-full sm:w-auto z-50">
                <button
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
                  className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-3 sm:py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 shadow-sm"
                >
                  <HiOutlineDownload size={16} /> <span className="hidden sm:inline">Export</span>
                </button>
                {isExportMenuOpen && (
                  <div className="absolute top-[110%] left-0 w-[150px] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col p-1.5 z-[100] animate-in fade-in zoom-in-95">
                    <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg transition-colors"><HiOutlineDocumentText className="text-rose-400" size={16}/> PDF Report</button>
                    <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg transition-colors"><HiOutlineTable className="text-emerald-400" size={16}/> Excel (CSV)</button>
                  </div>
                )}
              </div>

              <button onClick={() => { setEditingId(null); setFormData({ earningType: 'stake', coin: activeCryptos[0], rewardCoin: rewardOptions[0], poolCoin2: activeCryptos[1]||'USDT', platform: existingPlatforms[0] || '', principalAmount: '', poolPrincipal2: '', apr: '', lockPeriod: 'Flexible', customLockDays: '', startDate: getLocalISOString() }); setIsStakeModalOpen(true); }} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl md:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg shadow-purple-500/30 transition-all active:scale-95 whitespace-nowrap"><HiOutlinePlus size={18} className="hidden sm:inline" /> Add Stream</button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 relative z-10">
          <div className="p-5 sm:p-6 md:p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[1.5rem] md:rounded-[2rem] shadow-xl border border-slate-700/50 relative overflow-hidden md:col-span-2">
            <div className="absolute right-[-5%] top-[-10%] opacity-5 text-white blur-[2px]"><FaPiggyBank size={180} className="md:w-[250px] md:h-[250px]"/></div>
            <p className="text-[10px] sm:text-[11px] font-black text-purple-400 uppercase tracking-widest mb-1 sm:mb-2 relative z-10 flex items-center gap-1">Total Value Locked (TVL) {isMarketSyncing && <HiOutlineRefresh className="animate-spin text-purple-400" size={10} />}</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter relative z-10 truncate" title={`${currencySymbol}${analytics.totalValueLocked.toLocaleString()}`}>{currencySymbol}{analytics.totalValueLocked.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h2>
            <div className="mt-3 sm:mt-4 inline-flex flex-wrap items-center gap-1.5 sm:gap-2 bg-white/10 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/10 relative z-10">
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-full w-full bg-emerald-500"></span></span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-200">Est. Earning ≈ {currencySymbol}{analytics.totalDailyPassiveIncome.toFixed(2)} / Day</span>
            </div>
          </div>
          <div className="p-5 sm:p-6 md:p-8 bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col justify-center">
            <p className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1">
              <HiOutlineGift size={14} className="sm:w-4 sm:h-4 shrink-0"/> Total Harvested
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight truncate">
              +{currencySymbol}{analytics.totalRewardsClaimedFiat.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </h2>
          </div>
        </div>

        {/* Active/Matured Toggle */}
        <div className="flex gap-2 pb-2">
          {['all', 'active', 'matured'].map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-2 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all border-2 ${
                filterMode === mode
                  ? mode === 'all' ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200 shadow-md'
                  : mode === 'active' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                  : 'bg-rose-600 text-white border-rose-600 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 shadow-sm'
              }`}
            >
              {mode === 'all' ? 'All Streams' : mode === 'active' ? 'Active' : 'Matured'}
            </button>
          ))}
        </div>

        {/* 🚀 COLLAPSIBLE MONTHS VIEW */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight truncate"><FaLeaf className="text-emerald-500 shrink-0" size={16} /> Income Streams</h2>
          </div>

          {isLoading ? (
            <SkeletonCards />
          ) : processedMonths.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <HiOutlineUserGroup className="text-3xl sm:text-4xl text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-widest">No streams found</p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-bold">
                {filterMode !== 'all' ? `No ${filterMode} streams.` : 'Add a farming stream to track yields.'}
              </p>
            </div>
          ) : (
            processedMonths.map(month => {
              const isOpen = openMonths.has(month.monthKey);
              return (
                <div key={month.monthKey} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                  {/* Month Header */}
                  <button
                    onClick={() => toggleMonth(month.monthKey)}
                    className="w-full px-4 sm:px-6 py-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-left"
                  >
                    <h3 className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <HiOutlineCalendar className="text-purple-500" size={18} />
                      {month.monthName}
                      <span className="text-[10px] font-bold text-slate-500 ml-2">({month.records.length} stream{month.records.length !== 1 ? 's' : ''})</span>
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Month TVL</p>
                        <p className="text-sm font-black text-slate-600 dark:text-slate-300">{currencySymbol}{month.monthTotalTVL.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>
                      <HiOutlineChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="animate-in fade-in duration-200">
                      {month.records.map((rec) => {
                        const isPoolRow = rec.earningType === 'pool';
                        const c1Obj = fullDatabase.find(c => c.symbol === rec.coin.toUpperCase());
                        const logo1 = c1Obj?.logo;
                        let logo2 = null;
                        if (isPoolRow) {
                          const c2Obj = fullDatabase.find(c => c.symbol === rec.poolCoin2.toUpperCase());
                          logo2 = c2Obj?.logo;
                        }

                        let tvlFiat = (parseFloat(rec.principalAmount) || 0) * getLivePrice(rec.coin);
                        if (isPoolRow) tvlFiat += (parseFloat(rec.poolPrincipal2) || 0) * getLivePrice(rec.poolCoin2);
                        let dailyEarnFiat = ((tvlFiat * (parseFloat(rec.apr)||0)) / 100) / 365;

                        let progress = 0; let daysLeftText = "Flexible";
                        if (rec.lockPeriod && rec.lockPeriod !== 'Flexible') {
                          const start = new Date(rec.startDate);
                          const totalDays = parseInt(rec.lockPeriod);
                          const end = new Date(start); end.setDate(end.getDate() + totalDays);
                          const today = new Date();
                          const daysPassed = Math.floor((today - start) / (1000 * 60 * 60 * 24));
                          progress = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
                          daysLeftText = progress >= 100 ? "Unlocked" : `${totalDays - daysPassed} Days Left`;
                        }

                        const totalClaimed = rec.claimedHistory ? rec.claimedHistory.reduce((sum, h) => sum + parseFloat(h.amount || 0), 0) : 0;

                        return (
                          <div key={rec.id} className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col gap-3">
                            {/* Asset & Value */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="flex items-center shrink-0">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 z-10 flex items-center justify-center shrink-0">
                                    <LogoRenderer symbol={rec.coin} logoUrl={logo1} />
                                  </div>
                                  {isPoolRow && (
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 -ml-3 sm:-ml-4 z-0 shrink-0">
                                      <LogoRenderer symbol={rec.poolCoin2} logoUrl={logo2} />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  {isPoolRow ? (
                                    <p className="font-black text-slate-800 dark:text-white text-xs sm:text-sm truncate">{rec.principalAmount} <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase">{rec.coin}</span> + {rec.poolPrincipal2} <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase">{rec.poolCoin2}</span></p>
                                  ) : (
                                    <p className="font-black text-slate-800 dark:text-white text-xs sm:text-sm truncate">{rec.principalAmount} <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase">{rec.coin}</span></p>
                                  )}
                                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 truncate uppercase tracking-widest flex items-center gap-1"><FaBuilding size={9}/> {rec.platform}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-slate-800 dark:text-white text-sm sm:text-base truncate">{currencySymbol}{tvlFiat.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 uppercase tracking-widest truncate">+ {currencySymbol}{dailyEarnFiat.toFixed(2)}/Day</p>
                              </div>
                            </div>

                            {/* Terms */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 flex flex-wrap gap-3 justify-between items-center border border-slate-100 dark:border-slate-800/50 mt-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm whitespace-nowrap">Est. {rec.apr}% APR</span>
                                {isPoolRow ? (
                                  <span className="text-[8px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-200 dark:border-cyan-500/20 shadow-sm whitespace-nowrap">LP Rewards</span>
                                ) : (
                                  <span className="text-[8px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-200 dark:border-cyan-500/20 shadow-sm whitespace-nowrap">Earns {rec.rewardCoin || rec.coin}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap shrink-0">{daysLeftText}</span>
                                {rec.lockPeriod !== 'Flexible' && (
                                  <div className="flex-1 sm:w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner shrink-0">
                                    <div className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${progress}%` }}></div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Dates & Actions */}
                            <div className="flex flex-wrap items-end justify-between mt-1 gap-3">
                              <div className="flex flex-col gap-1">
                                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 w-fit">
                                  <HiOutlineCalendar size={12} className="text-slate-500" /> {formatGlobalDate ? formatGlobalDate(rec.startDate, 'short') : rec.startDate.split('T')[0]}
                                </p>
                                {totalClaimed > 0 && (
                                  <p className="text-[9px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 ml-1">
                                    Harvested: {totalClaimed.toLocaleString(undefined, {maximumFractionDigits:4})} {rec.rewardCoin || rec.coin}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <button onClick={() => openClaimModalFor(rec)} className="px-3 sm:px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-black text-[9px] sm:text-[10px] uppercase tracking-widest rounded-lg sm:rounded-xl transition-all shadow-sm flex items-center gap-1 border border-emerald-200 dark:border-emerald-500/30 active:scale-95 shrink-0">
                                  <HiOutlineGift size={14} className="shrink-0 hidden sm:block"/> Harvest
                                </button>
                                <button onClick={() => openHistoryModal(rec)} className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 font-black text-[9px] sm:text-[10px] uppercase tracking-widest rounded-lg sm:rounded-xl transition-all shadow-sm flex items-center gap-1 border border-blue-200 dark:border-blue-500/30 active:scale-95 shrink-0">
                                  <FaHistory size={12} className="shrink-0"/>
                                </button>
                                <button onClick={() => {
                                  let editDateStr = rec.startDate;
                                  if (rec.timestamp) {
                                    const d = new Date(rec.timestamp);
                                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                                    editDateStr = d.toISOString().slice(0, 16);
                                  } else if (editDateStr.length === 10) { editDateStr = editDateStr + 'T12:00'; }
                                  setFormData({ earningType: rec.earningType || 'stake', coin: rec.coin, rewardCoin: rec.rewardCoin || rec.coin, poolCoin2: rec.poolCoin2 || '', platform: rec.platform, principalAmount: rec.principalAmount, poolPrincipal2: rec.poolPrincipal2 || '', apr: rec.apr, lockPeriod: ['Flexible','15','30','60'].includes(rec.lockPeriod) ? rec.lockPeriod : 'Custom', customLockDays: ['Flexible','15','30','60'].includes(rec.lockPeriod) ? '' : rec.lockPeriod, startDate: editDateStr });
                                  setEditingId(rec.id); setIsStakeModalOpen(true);
                                }} className="p-2 sm:p-2.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/20 rounded-lg sm:rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700 active:scale-95 shrink-0"><HiOutlinePencil size={14}/></button>
                                <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2 sm:p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg sm:rounded-xl transition-all shadow-sm border border-rose-200 dark:border-rose-500/30 active:scale-95 shrink-0"><HiOutlineTrash size={14}/></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========== MODALS (same as before, with toasts) ========== */}
      {isStakeModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[60px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-4rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
            <div className="px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center transition-colors duration-300 bg-gradient-to-r from-purple-600 to-violet-600 text-white shrink-0">
              <h3 className="text-lg sm:text-xl font-black flex items-center gap-2"><HiOutlineLightningBolt size={20} className="sm:w-[24px] sm:h-[24px]"/> {editingId ? 'Edit Stream' : 'Add Farming/Earn Stream'}</h3>
              <button type="button" onClick={closeStakeModal} className="p-1.5 sm:p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={18} className="sm:w-5 sm:h-5" /></button>
            </div>
            <form onSubmit={handleSaveStake} className="p-5 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-5 sm:space-y-6">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm shrink-0">
                <button type="button" onClick={() => setFormData({...formData, earningType: 'stake'})} className={`flex-1 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all flex justify-center items-center gap-1.5 sm:gap-2 ${formData.earningType === 'stake' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><span>🏦</span> Single Stake</button>
                <button type="button" onClick={() => setFormData({...formData, earningType: 'pool'})} className={`flex-1 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all flex justify-center items-center gap-1.5 sm:gap-2 ${formData.earningType === 'pool' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><span>⚖️</span> Liquidity Pool</button>
              </div>
              {formData.earningType === 'pool' && (
                <div className="p-3.5 sm:p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 shadow-sm">
                  <span className="text-blue-700 dark:text-blue-500 font-black">LIQUIDITY POOL (e.g. USDT/ETH):</span> Stake two assets simultaneously to earn LP rewards.
                </div>
              )}
              <div className="space-y-1.5 sm:space-y-2 animate-in fade-in">
                <label className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform / Exchange</label>
                <div className="relative">
                  <input type="text" list="staking-platforms" required value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})} placeholder="e.g., Binance Earn, Raydium" className="w-full pl-4 pr-10 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors shadow-sm placeholder-slate-400" />
                  <datalist id="staking-platforms">
                    {existingPlatforms.map(p => <option key={p} value={p} />)}
                  </datalist>
                  <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border ${formData.earningType === 'pool' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50' : 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/50'} space-y-4 sm:space-y-5 shadow-sm transition-colors animate-in fade-in`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest ml-1 ${formData.earningType === 'pool' ? 'text-blue-700 dark:text-blue-500' : 'text-purple-700 dark:text-purple-500'}`}>Base Coin</label>
                    <div className="relative">
                      <select value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className={`w-full pl-4 pr-10 py-3 sm:py-4 bg-white dark:bg-slate-900 border rounded-xl text-sm sm:text-base font-black dark:text-white outline-none appearance-none focus:ring-2 shadow-sm cursor-pointer transition-colors ${formData.earningType === 'pool' ? 'border-blue-300 dark:border-blue-700 focus:ring-blue-500/50' : 'border-purple-300 dark:border-purple-700 focus:ring-purple-500/50'}`}>
                        {activeCryptos.map(c => <option key={`sc-${c}`} value={c}>{c}</option>)}
                      </select>
                      <HiOutlineChevronDown className={`absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none ${formData.earningType === 'pool' ? 'text-blue-500' : 'text-purple-500'}`} />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest ml-1 ${formData.earningType === 'pool' ? 'text-blue-700 dark:text-blue-500' : 'text-purple-700 dark:text-purple-500'}`}>Amount Locked</label>
                    <input type="number" step="any" required value={formData.principalAmount} onChange={(e) => setFormData({...formData, principalAmount: e.target.value})} placeholder="e.g. 100" className={`w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border rounded-xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 shadow-sm transition-colors placeholder-slate-400 ${formData.earningType === 'pool' ? 'border-blue-300 dark:border-blue-700 focus:ring-blue-500/50' : 'border-purple-300 dark:border-purple-700 focus:ring-purple-500/50'}`} />
                  </div>
                </div>
                {currentFormBalance > 0 && formData.earningType === 'stake' && (
                  <div onClick={() => setFormData(prev => ({...prev, principalAmount: currentFormBalance}))} className="p-3 sm:p-3.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-all shadow-sm active:scale-[0.98] -mt-1 sm:-mt-2">
                     <div className="flex items-center gap-2">
                       <FaWallet className="text-emerald-500" size={12} className="sm:w-3.5 sm:h-3.5"/>
                       <div>
                         <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Available in {formData.platform || 'Vault'}</p>
                         <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5 hidden sm:block">Tap to auto-fill amount</p>
                       </div>
                     </div>
                     <p className="text-xs sm:text-sm font-black text-emerald-800 dark:text-emerald-300">
                       {currentFormBalance % 1 !== 0 ? currentFormBalance.toFixed(6).replace(/\.?0+$/, '') : currentFormBalance} <span className="text-[8px] sm:text-[10px] uppercase opacity-70">{formData.coin}</span>
                     </p>
                  </div>
                )}
                {formData.earningType === 'pool' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-blue-200/50 dark:border-blue-800/50 animate-in fade-in">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[10px] sm:text-[11px] font-black text-cyan-700 dark:text-cyan-500 uppercase tracking-widest ml-1">Pair Coin</label>
                      <div className="relative">
                        <select value={formData.poolCoin2} onChange={(e) => setFormData({...formData, poolCoin2: e.target.value})} className="w-full pl-4 pr-10 py-3 sm:py-4 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-xl text-sm sm:text-base font-black dark:text-white outline-none appearance-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer shadow-sm transition-colors">
                          {activeCryptos.map(c => <option key={`pc2-${c}`} value={c}>{c}</option>)}
                        </select>
                        <HiOutlineChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-cyan-500 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[10px] sm:text-[11px] font-black text-cyan-700 dark:text-cyan-500 uppercase tracking-widest ml-1">Amount Locked</label>
                      <input type="number" step="any" required value={formData.poolPrincipal2} onChange={(e) => setFormData({...formData, poolPrincipal2: e.target.value})} placeholder="e.g. 100" className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 focus:ring-cyan-500/50 shadow-sm transition-colors placeholder-slate-400" />
                    </div>
                  </div>
                )}
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t ${formData.earningType === 'pool' ? 'border-blue-300/50 dark:border-blue-800/50' : 'border-purple-300/50 dark:border-purple-800/50'}`}>
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest ml-1 ${formData.earningType === 'pool' ? 'text-blue-700 dark:text-blue-500' : 'text-purple-700 dark:text-purple-500'}`}>Est. APR (%)</label>
                    <input type="number" step="any" required value={formData.apr} onChange={(e) => setFormData({...formData, apr: e.target.value})} placeholder="e.g. 12.5" className={`w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border rounded-xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 shadow-sm transition-colors placeholder-slate-400 ${formData.earningType === 'pool' ? 'border-blue-300 dark:border-blue-700 focus:ring-blue-500/50' : 'border-purple-300 dark:border-purple-700 focus:ring-purple-500/50'}`} />
                  </div>
                  {formData.earningType === 'stake' && (
                    <div className="space-y-1.5 sm:space-y-2 animate-in fade-in">
                      <label className="text-[10px] sm:text-[11px] font-black text-purple-700 dark:text-purple-500 uppercase tracking-widest ml-1">Reward Coin</label>
                      <div className="relative">
                        <select value={formData.rewardCoin} onChange={(e) => setFormData({...formData, rewardCoin: e.target.value})} className="w-full pl-4 pr-10 py-3 sm:py-4 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl text-sm sm:text-base font-black dark:text-white outline-none appearance-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer shadow-sm transition-colors">
                          {rewardOptions.map(c => <option key={`rc-${c}`} value={c}>{c}</option>)}
                        </select>
                        <HiOutlineChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Lock Duration</label>
                <div className="flex flex-wrap gap-2">
                  {['Flexible', '15', '30', '60', 'Custom'].map(l => (
                    <button type="button" key={`ld-${l}`} onClick={() => setFormData({...formData, lockPeriod: l})} className={`px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition-all border ${formData.lockPeriod === l ? 'bg-purple-100 border-purple-400 text-purple-700 dark:bg-purple-500/20 dark:border-purple-500/50 dark:text-purple-400 shadow-sm scale-105' : 'bg-slate-50 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{l !== 'Flexible' && l !== 'Custom' ? `${l} Days` : l}</button>
                  ))}
                </div>
                {formData.lockPeriod === 'Custom' && <input type="number" required value={formData.customLockDays} onChange={(e) => setFormData({...formData, customLockDays: e.target.value})} placeholder="Enter custom days..." className="w-full p-3 sm:p-4 mt-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 shadow-sm transition-colors animate-in fade-in" />}
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                 <label className="text-[10px] sm:text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex justify-between ml-1">
                   <span>Start Date</span>
                   <span className="text-purple-600 dark:text-purple-400">{formatGlobalDate && formData.startDate ? formatGlobalDate(formData.startDate.split('T')[0], 'short') : ''}</span>
                 </label>
                 <input type="datetime-local" required value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold dark:text-white outline-none shadow-sm focus:ring-2 focus:ring-purple-500/50 transition-colors cursor-pointer" />
              </div>
              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-4 sm:mt-6 z-10 border-t border-slate-100 dark:border-slate-800 sm:border-0 sm:pt-0 sm:pb-0">
                <button type="submit" disabled={isSaving} className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl font-black text-white text-sm sm:text-lg uppercase tracking-widest transition-all active:scale-95 disabled:opacity-70 ${formData.earningType === 'stake' ? 'bg-gradient-to-r from-purple-600 to-violet-600 shadow-purple-500/30 hover:from-purple-700 hover:to-violet-700' : 'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-blue-500/30 hover:from-blue-700 hover:to-cyan-700'} shadow-xl flex items-center justify-center gap-2 shrink-0`}>
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-xl sm:text-2xl" /> : <HiOutlineShieldCheck size={20} className="sm:w-[24px] sm:h-[24px]" />}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Terms' : `Save Stream`)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLAIM REWARD MODAL (unchanged, toasts only) */}
      {isClaimModalOpen && activeClaimStake && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] border border-slate-300 dark:border-slate-800 animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0">
              <h3 className="text-lg sm:text-xl font-black flex items-center gap-2"><HiOutlineGift size={20} className="sm:w-[24px] sm:h-[24px]" /> Harvest Rewards</h3>
              <button type="button" onClick={closeClaimModal} className="p-1.5 sm:p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={18} className="sm:w-5 sm:h-5" /></button>
            </div>
            <form onSubmit={handleClaimReward} className="p-5 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="text-center p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-800/50">
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Claiming yield from</p>
                <p className="text-base sm:text-lg font-black text-slate-800 dark:text-white truncate">
                  {activeClaimStake.earningType === 'pool' ? 'Liquidity Pool' : `${activeClaimStake.principalAmount} ${activeClaimStake.coin}`} on {activeClaimStake.platform}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[10px] sm:text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                  <div className="relative">
                    <select required value={claimData.claimCoin} onChange={(e) => setClaimData({...claimData, claimCoin: e.target.value})} className="w-full pl-4 pr-10 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-2xl font-black text-sm sm:text-base dark:text-white outline-none cursor-pointer shadow-sm appearance-none focus:ring-2 focus:ring-emerald-500/50 transition-colors">
                      <option value={activeClaimStake.coin}>{activeClaimStake.coin}</option>
                      {activeClaimStake.earningType === 'pool' && <option value={activeClaimStake.poolCoin2}>{activeClaimStake.poolCoin2}</option>}
                      {activeClaimStake.earningType === 'stake' && activeClaimStake.rewardCoin !== activeClaimStake.coin && <option value={activeClaimStake.rewardCoin}>{activeClaimStake.rewardCoin}</option>}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[10px] sm:text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Yield Amount</label>
                  <input type="number" step="any" required value={claimData.amountClaimed} onChange={(e) => setClaimData({...claimData, amountClaimed: e.target.value})} placeholder="0.0" className="w-full p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-300 dark:border-emerald-800/50 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 tracking-widest shadow-sm transition-colors placeholder-emerald-300 dark:placeholder-emerald-800" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[10px] sm:text-[11px] font-black text-rose-500 uppercase tracking-widest ml-1">Platform Fee (%)</label>
                  <div className="relative">
                    <input type="number" step="any" required value={claimData.platformFeePercent} onChange={(e) => setClaimData({...claimData, platformFeePercent: e.target.value})} placeholder="e.g. 10" className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-rose-600 outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm pr-10 transition-colors" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-rose-500 dark:text-rose-400">%</span>
                  </div>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[10px] sm:text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Harvest Date</label>
                  <input type="datetime-local" required value={claimData.date} onChange={(e) => setClaimData({...claimData, date: e.target.value})} className="w-full p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm cursor-pointer transition-colors" />
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl flex justify-between items-center border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest">Net to Wallet:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg sm:text-xl">
                  {claimData.amountClaimed ? (parseFloat(claimData.amountClaimed) - (parseFloat(claimData.amountClaimed) * ((parseFloat(claimData.platformFeePercent)||0) / 100))).toFixed(6).replace(/\.?0+$/, '') : '0.00'} <span className="text-[10px] sm:text-xs uppercase">{claimData.claimCoin}</span>
                </span>
              </div>
              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-4 sm:mt-6 z-10 border-t border-slate-100 dark:border-slate-800 sm:border-0 sm:pt-0 sm:pb-0">
                <button type="submit" disabled={isSaving} className="w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl font-black text-white text-sm sm:text-lg uppercase tracking-widest transition-all active:scale-95 disabled:opacity-70 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 shrink-0">
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-xl sm:text-2xl" /> : <HiOutlineShieldCheck size={20} className="sm:w-[24px] sm:h-[24px]" />}
                  Harvest & Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

{/* 🚀 CLAIM HISTORY MODAL (View & Delete Individual Claims) */}
{isHistoryModalOpen && claimHistoryStake && (
  <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] border border-slate-300 dark:border-slate-800 animate-in slide-in-from-bottom-10 sm:zoom-in-95">
      <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center bg-gradient-to-r from-blue-600 to-cyan-600 text-white shrink-0">
        <h3 className="text-lg sm:text-xl font-black flex items-center gap-2">
          <FaHistory size={20} className="sm:w-[24px] sm:h-[24px]" /> Claim History
        </h3>
        <button type="button" onClick={() => { setIsHistoryModalOpen(false); setHistoryDeleteContext(null); }} className="p-1.5 sm:p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
          <HiOutlineX size={18} className="sm:w-5 sm:h-5" />
        </button>
      </div>
      <div className="p-5 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto custom-scrollbar flex-1">
        {/* Stake summary */}
        <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-200 dark:border-blue-800/50">
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
            Staked: <span className="font-black text-slate-800 dark:text-white">{claimHistoryStake.principalAmount} {claimHistoryStake.coin}</span> on <span className="font-black text-slate-800 dark:text-white">{claimHistoryStake.platform}</span>
          </p>
        </div>

        {claimHistoryStake.claimedHistory && claimHistoryStake.claimedHistory.length > 0 ? (
          <div className="space-y-3">
            {claimHistoryStake.claimedHistory.map((claim) => (
              <div key={claim.claimId} className="flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base truncate">
                      +{Number(claim.amount).toLocaleString(undefined, {maximumFractionDigits: 6})} {claim.coin}
                    </span>
                    {claim.gross > claim.amount && (
                      <span className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-500/20 shrink-0">
                        Fee: {Number(claim.fee).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                    {formatGlobalDate ? formatGlobalDate(claim.date, 'short') : claim.date.split('T')[0]}
                  </p>
                </div>
                <button
                  onClick={() => setHistoryDeleteContext(claim)}
                  className="p-2 sm:p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg sm:rounded-xl transition-colors border border-rose-200 dark:border-rose-500/30 active:scale-95 shrink-0"
                >
                  <HiOutlineTrash size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4">
            <HiOutlineClock className="text-3xl sm:text-4xl text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-widest">No claims yet</p>
          </div>
        )}

        {/* Delete confirmation for a specific claim */}
        {historyDeleteContext && (
          <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/50 rounded-2xl space-y-4">
            <p className="text-[10px] sm:text-xs font-bold text-rose-700 dark:text-rose-400">
              Delete claim of {historyDeleteContext.amount} {historyDeleteContext.coin}? This will reverse all related Vault & Income entries.
            </p>
            <div>
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Security PIN</label>
              <input
                type="password" maxLength={6} required autoFocus
                value={historyPinInput}
                onChange={(e) => setHistoryPinInput(e.target.value)}
                placeholder="••••••"
                className="w-full mt-1 text-center tracking-[0.4em] text-xl sm:text-2xl p-3 sm:p-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm transition-colors"
              />
              {historyPinError && (
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-2 text-center animate-bounce">{historyPinError}</p>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setHistoryDeleteContext(null); setHistoryPinInput(''); setHistoryPinError(''); }}
                className="flex-1 p-3 sm:p-4 rounded-xl font-black text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClaim}
                disabled={isHistoryVerifying || !historyPinInput}
                className="flex-1 p-3 sm:p-4 rounded-xl font-black text-white text-xs sm:text-sm bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 active:scale-95"
              >
                {isHistoryVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : <HiOutlineTrash size={18} />}
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}

{/* 🚀 DELETE STAKE MODAL (Full stake deletion) */}
{deleteContext && (
  <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-8 border border-rose-200 dark:border-rose-900/50 relative overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-pink-500"></div>
      <div className="flex flex-col items-center text-center mb-5 sm:mb-6 shrink-0">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mb-3 sm:mb-4 shadow-inner border border-rose-200 dark:border-rose-500/30">
          <HiOutlineLockClosed />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
        <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-1.5 sm:mt-2">
          Deleting this stream will permanently remove it. Associated Vault/Income records will be reversed.
        </p>
      </div>
      <form onSubmit={executeSecureDelete} className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-4">
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
            You are deleting <span className="font-black">{deleteContext.principalAmount} {deleteContext.coin}</span> stake on {deleteContext.platform}.
          </p>
        </div>
        <input
          type="password" maxLength={6} required autoFocus
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          placeholder="ENTER PIN"
          className="w-full text-center tracking-[0.5em] text-xl sm:text-2xl p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm transition-colors focus:border-rose-500"
        />
        {pinError && <p className="text-[10px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 text-center animate-bounce mt-2">{pinError}</p>}
        <div className="flex gap-2 sm:gap-3 pt-2">
          <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm border border-slate-300 dark:border-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl font-black text-white text-xs sm:text-sm bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex justify-center items-center gap-1 sm:gap-2 active:scale-95 shadow-lg shadow-rose-500/30">
            {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : null} Verify & Delete
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </div>
  );
};

const StakingAndYield = () => (
  <ToastProvider>
    <StakingAndYieldContent />
  </ToastProvider>
);

export default StakingAndYield;