// src/pages/crypto/SwapAndBridge.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  collection, addDoc, setDoc, deleteDoc, doc,
  query, getDocs, where, getDoc, documentId
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadPDFReport } from '../../utils/reportUtils'; // ✅ Excel is handled manually now for stability
import { verifyPINEnhanced } from '../../utils/securityUtils';
import { useCryptoPrice } from '../../context/CryptoPriceContext';
import { useToast } from '../../hooks/useToastNotification';

// ✅ IMPORTING ENTERPRISE HOOKS
import { useSecureSnapshot } from '../../hooks/useSecureSnapshot';
import { usePaginatedMonthlyLogs } from '../../hooks/usePaginatedMonthlyLogs';

import {
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineLockClosed,
  HiOutlineChevronDown, HiOutlineSwitchHorizontal,
  HiOutlineExclamationCircle, HiOutlineDownload,
  HiOutlineDocumentText, HiOutlineTable, HiOutlineShieldCheck,
  HiOutlineArrowRight, HiOutlineCalendar,
  HiOutlineCheckCircle, HiOutlineInformationCircle
} from 'react-icons/hi';
import { FaExchangeAlt, FaRoute, FaGhost, FaBuilding, FaWallet } from 'react-icons/fa';

// ─── Helpers ────────────────────────────────────────────────────────────────

const LogoRenderer = ({ symbol, logoUrl, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => { setHasError(false); }, [logoUrl]);
  if (!logoUrl || hasError) return <span className={`w-full h-full flex items-center justify-center font-black text-[10px] sm:text-[11px] ${bg || 'bg-slate-200 dark:bg-slate-700'} ${color || 'text-slate-500'} rounded-full`}>{symbol?.toUpperCase()?.substring(0, 3)}</span>;
  return <img src={logoUrl} alt={symbol} className="w-full h-full object-contain p-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm" onError={() => setHasError(true)} />;
};

const getLocalISOString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// ─── 🚀 ENTERPRISE ENGINE: Syncs math to summary ─────────────────────────────
const syncSwapBridgeSummary = async (userId) => {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'swapBridgeLogs'));
    const logs = snap.docs.map(d => d.data());

    let totalVolume = 0;
    let totalFeesLost = 0;
    const existingPlatforms = new Set();

    logs.forEach(t => {
      totalVolume += (t.baseVolume || 0);
      totalFeesLost += (t.hiddenFeeBase || 0);

      if (t.platform) existingPlatforms.add(t.platform.trim());
      if (t.fromPlatform) existingPlatforms.add(t.fromPlatform.trim());
      if (t.toPlatform) existingPlatforms.add(t.toPlatform.trim());
    });

    const summaryData = {
      totalVolume,
      totalFeesLost,
      existingPlatforms: Array.from(existingPlatforms),
      totalLogs: logs.length,
      lastUpdated: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', userId, 'walletSummary', 'swapBridge'), summaryData, { merge: true });
    return summaryData;
  } catch (error) {
    console.error("Failed to sync swapBridge summary:", error);
    return null;
  }
};

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const SwapAndBridgeContent = () => {
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate, getCalendarMonthKey } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ NEW: Enterprise Export States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  const [customUserCoins, setCustomUserCoins] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const abortControllerRef = useRef(null);

  const cryptoSymbols = useMemo(() => selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean), [selectedCryptos]);
  const activeCryptos = cryptoSymbols.length > 0 ? cryptoSymbols : ['BTC', 'USDT', 'TRX', 'LTC'];

  const [formData, setFormData] = useState({
    actionType: 'swap', platform: '', fromCoin: activeCryptos[0], fromAmount: '', toCoin: 'USDT', toAmount: '',
    fromPlatform: '', toPlatform: '', bridgeCoin: activeCryptos[0], bridgeSentAmount: '', bridgeReceivedAmount: '',
    datetime: getLocalISOString(), linkedId: ''
  });

  const getCurrentMonthKey = () => {
    try { return getCalendarMonthKey(new Date().toISOString()); }
    catch { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  };
  const [openMonths, setOpenMonths] = useState(new Set([getCurrentMonthKey()]));
  const toggleMonth = (monthKey) => {
    setOpenMonths(prev => { const next = new Set(prev); next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey); return next; });
  };

  // ✅ Global Crypto Price Context
  const { livePrices, fiatRate } = useCryptoPrice();

  // ─── 1. FAST MATH ENGINE (Global Summary) ───────────────────────────────
  const [globalSummary, setGlobalSummary] = useState({
    totalVolume: 0, totalFeesLost: 0, existingPlatforms: [], totalLogs: 0
  });

  const summaryQuery = useMemo(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'walletSummary'), where(documentId(), '==', 'swapBridge'));
  }, [user?.uid]);

  const { data: summaryDataArray, loading: isSummaryLoading } = useSecureSnapshot(summaryQuery);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (isSummaryLoading) return;
    if (summaryDataArray && summaryDataArray.length > 0) {
      setGlobalSummary(summaryDataArray[0]);
    } else if (summaryDataArray?.length === 0 && user?.uid && !isSyncingRef.current) {
      isSyncingRef.current = true;
      syncSwapBridgeSummary(user.uid).then(data => {
        if (data) setGlobalSummary(data);
        isSyncingRef.current = false;
      });
    }
  }, [summaryDataArray, isSummaryLoading, user?.uid]);

  // ─── 2. TRUE FIRESTORE PAGINATION HOOK ──────────────────────────────────
  const {
    months: paginatedMonths,
    loading: isLoadingLogs,
    isPaginating,
    hasMore,
    loadMore,
    refresh: refreshTransactions
  } = usePaginatedMonthlyLogs(user?.uid, 'swapBridgeLogs', 20, !!user, getCalendarMonthKey);

  // ─── 3. CROSS-VAULT OPTIMIZATION (Crypto Summary for Balances) ──────────
  const [cryptoSummary, setCryptoSummary] = useState(null);
  const cryptoSummaryQuery = useMemo(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'walletSummary'), where(documentId(), '==', 'crypto'));
  }, [user?.uid]);
  
  const { data: cryptoSummaryDataArray } = useSecureSnapshot(cryptoSummaryQuery);

  useEffect(() => {
    if (cryptoSummaryDataArray && cryptoSummaryDataArray.length > 0) {
      setCryptoSummary(cryptoSummaryDataArray[0]);
    }
  }, [cryptoSummaryDataArray]);

  const allWalletSuggestions = useMemo(() => {
    const existingCryptoPlatforms = cryptoSummary?.existingPlatforms || [];
    return Array.from(new Set([...(globalSummary.existingPlatforms || []), ...existingCryptoPlatforms]));
  }, [globalSummary.existingPlatforms, cryptoSummary]);

  // Fetch custom coins
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
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

  // ✅ Helper: base currency price for a coin from context
  const getLivePrice = useCallback((symbol) => {
    if (!symbol) return 0;
    const priceUSD = livePrices[symbol.toUpperCase()]?.priceUSD || 0;
    return priceUSD * fiatRate;
  }, [livePrices, fiatRate]);

  const liveFormFee = useMemo(() => {
    if (formData.actionType === 'swap') {
      const fromPrice = getLivePrice(formData.fromCoin);
      const toPrice = getLivePrice(formData.toCoin);
      const fromVal = (parseFloat(formData.fromAmount) || 0) * fromPrice;
      const toVal = (parseFloat(formData.toAmount) || 0) * toPrice;
      const fee = fromVal - toVal;
      const isLoss = fee > 0;
      const feePct = fromVal > 0 ? (Math.abs(fee) / fromVal) * 100 : 0;
      return { fromVal, toVal, fee, isLoss, feePct };
    } else {
      const sent = parseFloat(formData.bridgeSentAmount) || 0;
      const recv = parseFloat(formData.bridgeReceivedAmount) || 0;
      const feeCoins = sent - recv;
      const feeBase = feeCoins * getLivePrice(formData.bridgeCoin);
      return { feeCoins, feeBase, isLoss: feeCoins > 0 };
    }
  }, [formData, getLivePrice]);

  const getAvailableBalance = () => {
    let coin, platform;
    if (formData.actionType === 'swap') {
      coin = formData.fromCoin;
      platform = formData.platform;
    } else {
      coin = formData.bridgeCoin;
      platform = formData.fromPlatform;
    }
    if (!coin || !platform || !cryptoSummary?.holdings) return 0;
    const coinData = cryptoSummary.holdings[coin.toUpperCase()];
    if (coinData && coinData.platforms && coinData.platforms[platform]) {
      const bal = coinData.platforms[platform];
      return bal > 0.00000001 ? bal : 0;
    }
    return 0;
  };
  const currentFormBalance = getAvailableBalance();

  // ─── LOCAL UI FILTERING FOR LEDGER ───────────────────────────────────────
  const filteredLedger = useMemo(() => {
    if (!paginatedMonths) return [];

    return paginatedMonths.map(month => {
      const sampleDate = month.records?.[0]?.date || new Date();
      const localizedMonthName = formatGlobalDate
        ? formatGlobalDate(sampleDate, 'monthYear')
        : month.monthName;

      const filteredRecords = month.records.filter(r => {
        const term = searchTerm.toLowerCase();
        return r.fromCoin?.toLowerCase().includes(term) || r.toCoin?.toLowerCase().includes(term) ||
               r.bridgeCoin?.toLowerCase().includes(term) || r.platform?.toLowerCase().includes(term) ||
               r.fromPlatform?.toLowerCase().includes(term) || r.toPlatform?.toLowerCase().includes(term);
      });

      let monthVolume = 0;
      let monthFees = 0;
      filteredRecords.forEach(r => {
        monthVolume += (r.baseVolume || 0);
        monthFees += (r.hiddenFeeBase || 0);
      });

      return {
        ...month,
        monthName: localizedMonthName,
        records: filteredRecords,
        monthVolume,
        monthFees
      };
    }).filter(m => m.records.length > 0);
  }, [paginatedMonths, searchTerm, formatGlobalDate]);

  // ─── ✅ EXPORT HANDLERS (FULLY REWRITTEN FOR STABILITY) ────────────────
  const handleExportPDF = async () => {
    setIsExportModalOpen(false);
    setIsGeneratingPDF(true);

    const recordsToExport = filteredLedger.flatMap(m => m.records);
    if (recordsToExport.length === 0) {
      addToast('No records found to export.', 'warning');
      setIsGeneratingPDF(false);
      return;
    }

    const reportData = recordsToExport.map(rec => {
      const isSwap = rec.actionType === 'swap';
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : (rec.date?.split('T')[0] || ''),
        type: isSwap ? 'Swap' : 'Bridge',
        source: isSwap ? `${rec.fromAmount} ${rec.fromCoin} (${rec.platform})` : `${rec.bridgeSentAmount} ${rec.bridgeCoin} (${rec.fromPlatform})`,
        destination: isSwap ? `${rec.toAmount} ${rec.toCoin}` : `${rec.bridgeReceivedAmount} ${rec.bridgeCoin} (${rec.toPlatform})`,
        status: rec.hiddenFeeBase <= 0 ? 'Profit' : 'Fee Loss',
        impact: Number((rec.hiddenFeeBase || 0).toFixed(2))
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Source', key: 'source' },
      { header: 'Destination', key: 'destination' },
      { header: 'Status', key: 'status' },
      { header: `Impact (${currencySymbol})`, key: 'impact', isNumeric: true }
    ];

    try {
      await downloadPDFReport(reportData, columns, 'Swap_Bridge_Ledger', 'Crypto Swap & Bridge - Full Activity Log', {
        onSuccess: () => addToast('PDF report downloaded!', 'success'),
        onError: (msg) => addToast(`PDF Error: ${msg}`, 'error')
      });
    } catch (err) {
      addToast(`PDF export failed: ${err.message}`, 'error');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExportModalOpen(false);
    setIsGeneratingExcel(true);

    const recordsToExport = filteredLedger.flatMap(m => m.records);
    if (recordsToExport.length === 0) {
      addToast('No records found to export.', 'warning');
      setIsGeneratingExcel(false);
      return;
    }

    const reportData = recordsToExport.map(rec => {
      const isSwap = rec.actionType === 'swap';
      return {
        Date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : (rec.date?.split('T')[0] || ''),
        Type: isSwap ? 'Swap' : 'Bridge',
        Source: isSwap ? `${rec.fromAmount} ${rec.fromCoin} (${rec.platform})` : `${rec.bridgeSentAmount} ${rec.bridgeCoin} (${rec.fromPlatform})`,
        Destination: isSwap ? `${rec.toAmount} ${rec.toCoin}` : `${rec.bridgeReceivedAmount} ${rec.bridgeCoin} (${rec.toPlatform})`,
        Status: rec.hiddenFeeBase <= 0 ? 'Profit' : 'Fee Loss',
        Impact_Fiat: (rec.hiddenFeeBase || 0).toFixed(2)
      };
    });

    const headers = Object.keys(reportData[0]);
    const csvRows = [headers.join(',')];
    for (const row of reportData) {
      const values = headers.map(header => {
        const val = row[header];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Swap_Bridge_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addToast('Excel (CSV) report downloaded!', 'success');
    setIsGeneratingExcel(false);
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleSaveEntry = async (e) => {
    e.preventDefault(); if (!user) return; setIsSaving(true);

    const oldRec = editingId ? paginatedMonths.flatMap(m => m.records).find(t => t.id === editingId) : null;
    const timestamp = oldRec?.timestamp || new Date(formData.datetime).getTime();
    const formattedDate = formData.datetime.split('T')[0];
    const uniqueId = formData.linkedId || `SB_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    let masterRecord = { actionType: formData.actionType, date: formattedDate, datetime: formData.datetime, timestamp, linkedId: uniqueId };
    let cryptoWalletSyncData = [];
    let incomeSyncData = null;
    let expenseSyncData = null;

    if (formData.actionType === 'swap') {
      if(!formData.platform.trim()) { addToast("Please enter platform.", "warning"); setIsSaving(false); return; }
      const fQty = parseFloat(formData.fromAmount); const tQty = parseFloat(formData.toAmount);
      if (fQty <= 0 || tQty <= 0) { addToast("Amounts must be greater than zero.", "warning"); setIsSaving(false); return; }

      const fromVal = fQty * getLivePrice(formData.fromCoin);
      const toVal = tQty * getLivePrice(formData.toCoin);
      const diff = fromVal - toVal;

      masterRecord = { ...masterRecord, platform: formData.platform.trim(), fromCoin: formData.fromCoin, fromAmount: fQty, toCoin: formData.toCoin, toAmount: tQty, baseVolume: fromVal, hiddenFeeBase: Math.max(0, diff) };
      cryptoWalletSyncData.push({ type: 'out', coin: formData.fromCoin, quantity: fQty, platform: formData.platform.trim(), reason: `Swapped to ${formData.toCoin}`, referenceNo: uniqueId, date: formattedDate, timestamp, linkedRecordId: uniqueId });
      cryptoWalletSyncData.push({ type: 'in', coin: formData.toCoin, quantity: tQty, platform: formData.platform.trim(), reason: `Swapped from ${formData.fromCoin}`, referenceNo: uniqueId, date: formattedDate, timestamp, linkedRecordId: uniqueId });

      if (diff > 0) expenseSyncData = { title: `Swap Spread Fee (${formData.fromCoin} to ${formData.toCoin})`, category: 'Bank & Transaction Fees', amount: diff, currency: baseCurrency, finalBaseAmount: diff, date: formattedDate, timestamp, linkedExpenseId: uniqueId, isVirtualCrypto: true, vault: 'crypto' };
      else if (diff < 0) incomeSyncData = { title: `Arbitrage Profit (${formData.fromCoin} to ${formData.toCoin})`, category: 'Crypto APR / Yield', asset: baseCurrency, amount: Math.abs(diff), exchangeRate: 1, finalBaseAmount: Math.abs(diff), date: formattedDate, timestamp, linkedIncomeId: uniqueId, isVirtualCrypto: true, vault: 'crypto' };
    } else {
      if(!formData.fromPlatform.trim() || !formData.toPlatform.trim()) { addToast("Please enter both platforms.", "warning"); setIsSaving(false); return; }
      const sQty = parseFloat(formData.bridgeSentAmount); const rQty = parseFloat(formData.bridgeReceivedAmount);
      if (sQty <= 0 || rQty <= 0) { addToast("Amounts must be greater than zero.", "warning"); setIsSaving(false); return; }

      const feeCoins = sQty - rQty;
      const feeBase = feeCoins * getLivePrice(formData.bridgeCoin);

      masterRecord = { ...masterRecord, fromPlatform: formData.fromPlatform.trim(), toPlatform: formData.toPlatform.trim(), bridgeCoin: formData.bridgeCoin, bridgeSentAmount: sQty, bridgeReceivedAmount: rQty, feeCoins: feeCoins, baseVolume: sQty * getLivePrice(formData.bridgeCoin), hiddenFeeBase: Math.max(0, feeBase) };
      cryptoWalletSyncData.push({ type: 'transfer', coin: formData.bridgeCoin, quantity: sQty, fromPlatform: formData.fromPlatform.trim(), toPlatform: formData.toPlatform.trim(), networkFee: Math.max(0, feeCoins), reason: `Bridge Transfer`, referenceNo: uniqueId, date: formattedDate, timestamp, linkedRecordId: uniqueId });

      if (feeBase > 0) expenseSyncData = { title: `Network Gas Fee (${formData.fromPlatform.trim()} to ${formData.toPlatform.trim()})`, category: 'Bank & Transaction Fees', amount: feeBase, currency: baseCurrency, finalBaseAmount: feeBase, date: formattedDate, timestamp, linkedExpenseId: uniqueId, isVirtualCrypto: true, vault: 'crypto' };
    }

    try {
      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "swapBridgeLogs", editingId), masterRecord, { merge: true });
        for (const col of ["cryptoWalletLogs", "incomeLogs", "expenseLogs"]) {
          const field = col === "incomeLogs" ? "linkedIncomeId" : col === "expenseLogs" ? "linkedExpenseId" : "linkedRecordId";
          const q = query(collection(db, "users", user.uid, col), where(field, "==", uniqueId));
          const snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, col, d.id)));
        }
        addToast('Entry updated!', 'success');
      } else {
        await addDoc(collection(db, "users", user.uid, "swapBridgeLogs"), masterRecord);
        addToast('Swap/Bridge recorded & synced!', 'success');
      }

      for (const data of cryptoWalletSyncData) await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), data);
      if (incomeSyncData) await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeSyncData);
      if (expenseSyncData) await addDoc(collection(db, "users", user.uid, "expenseLogs"), expenseSyncData);

      syncSwapBridgeSummary(user.uid).then(data => { if (data) setGlobalSummary(data); });
      refreshTransactions();
      closeModal();
    } catch (error) { addToast("Failed to save.", "error"); } finally { setIsSaving(false); }
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Enter PIN.");
    setIsVerifying(true);
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const storedHash = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin;

      const { valid, newHash } = await verifyPINEnhanced(pinInput.trim(), storedHash, user.uid);

      if (!valid) {
        setPinError("Incorrect PIN.");
        setIsVerifying(false);
        return;
      }

      if (newHash) {
        await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true });
      }

      await deleteDoc(doc(db, "users", user.uid, "swapBridgeLogs", deleteContext.id));
      for (const col of ["cryptoWalletLogs", "incomeLogs", "expenseLogs"]) {
        const field = col === "incomeLogs" ? "linkedIncomeId" : col === "expenseLogs" ? "linkedExpenseId" : "linkedRecordId";
        const q = query(collection(db, "users", user.uid, col), where(field, "==", deleteContext.linkedId));
        const snap = await getDocs(q);
        snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, col, d.id)));
      }
      
      syncSwapBridgeSummary(user.uid).then(data => { if (data) setGlobalSummary(data); });
      refreshTransactions();
      
      setDeleteContext(null);
      addToast('Record deleted and balances reversed.', 'info');
    } catch (error) {
      setPinError("Error.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEdit = (rec) => {
    let editDateTime = rec.datetime || rec.date;
    if(editDateTime.length === 10) editDateTime += 'T12:00';

    setFormData({
      actionType: rec.actionType, platform: rec.platform || '',
      fromCoin: rec.fromCoin || activeCryptos[0], fromAmount: rec.fromAmount || '',
      toCoin: rec.toCoin || 'USDT', toAmount: rec.toAmount || '',
      fromPlatform: rec.fromPlatform || '', toPlatform: rec.toPlatform || '',
      bridgeCoin: rec.bridgeCoin || activeCryptos[0], bridgeSentAmount: rec.bridgeSentAmount || '',
      bridgeReceivedAmount: rec.bridgeReceivedAmount || '', datetime: editDateTime, linkedId: rec.linkedId
    });
    setEditingId(rec.id); setIsModalOpen(true);
  };

  const closeModal = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsModalOpen(false); setEditingId(null);
    setFormData(prev => ({ ...prev, fromAmount: '', toAmount: '', bridgeSentAmount: '', bridgeReceivedAmount: '', linkedId: '', datetime: getLocalISOString() }));
  };

  // ─── SKELETONS ────────────────────────────────────────────────────────────
  const SkeletonCards = () => (
    <div className="space-y-4">
      {[1,2,3].map(i => (
        <div key={i} className="p-4 border-b border-slate-100 dark:border-slate-800/50 animate-pulse">
          <div className="flex justify-between mb-3">
            <div className="space-y-2"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" /><div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" /></div>
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2 items-center"><div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" /><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></div>
            <div className="h-4 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="flex gap-2 items-center"><div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" /><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></div>
          </div>
          <div className="mt-3 h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  );

  const SkeletonTable = () => (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left min-w-[700px]">
        <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
          <tr><th className="p-4 pl-6">Type</th><th className="p-4">Source</th><th className="p-4">Destination</th><th className="p-4 text-right">P&L</th><th className="p-4 pr-6 text-right">Actions</th></tr>
        </thead>
        <tbody>
          {[1,2,3].map(i => (
            <tr key={i} className="animate-pulse">
              <td className="p-4 pl-6"><div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" /></td>
              <td className="p-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" /></td>
              <td className="p-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" /></td>
              <td className="p-4 text-right"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded ml-auto" /></td>
              <td className="p-4 pr-6"><div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="pt-24 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-6">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2rem] md:rounded-[2.5rem] p-5 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden border border-slate-700/50 backdrop-blur-sm z-20">
        <div className="absolute right-[-5%] top-[-20%] opacity-[0.03] text-white blur-[2px] pointer-events-none"><FaExchangeAlt size={250}/></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none" />

        <div className="relative z-50">
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400 rounded-xl md:rounded-2xl flex items-center justify-center shadow-[inset_0_0_20px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/30">
              <HiOutlineSwitchHorizontal className="text-xl md:text-2xl" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">Swap & Bridge Tracker</h1>
              <p className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-400 max-w-xl">Convert dust coins or bridge networks. Auto-syncs P&L directly.</p>
            </div>
          </div>
        </div>

        <div className="relative z-50 flex items-center gap-2 md:gap-3 w-full md:w-auto">
          {/* ✅ EXPORT BUTTON */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={isGeneratingPDF || isGeneratingExcel}
            className="w-1/2 md:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-3 sm:py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 shadow-sm disabled:opacity-50"
          >
            {isGeneratingPDF || isGeneratingExcel ? (
              <><HiOutlineRefresh className="animate-spin" size={16}/> Generating...</>
            ) : (
              <><HiOutlineDownload size={16}/> <span className="hidden sm:inline">Export</span></>
            )}
          </button>

          <button onClick={() => setIsModalOpen(true)} className="w-1/2 md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl md:rounded-2xl font-black text-[10px] sm:text-xs md:text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 whitespace-nowrap">
            <HiOutlinePlus size={18} className="hidden sm:inline" /> Action
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 relative z-10">
        <div className="p-5 sm:p-6 md:p-8 bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute right-[-10%] top-[-10%] opacity-[0.03] dark:opacity-5 text-slate-900 dark:text-white"><FaExchangeAlt size={120}/></div>
          <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2 relative z-10">Total Volume Moved</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-800 dark:text-white tracking-tight relative z-10 truncate" title={`${currencySymbol}${(globalSummary.totalVolume || 0).toLocaleString()}`}>{currencySymbol}{(globalSummary.totalVolume || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</h2>
        </div>

        <div className="p-5 sm:p-6 md:p-8 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-900/10 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-rose-200 dark:border-rose-800/50 md:col-span-2 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute right-0 top-0 opacity-10 text-rose-500 -mt-4 -mr-4"><FaGhost size={140}/></div>
          <p className="text-[10px] sm:text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1 sm:mb-2 relative z-10 flex items-center gap-1 sm:gap-2">
            <HiOutlineExclamationCircle size={14} className="sm:w-4 sm:h-4"/> Total Loss to Hidden Fees & Spreads
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-rose-600 dark:text-rose-400 tracking-tighter relative z-10 truncate" title={`${currencySymbol}${(globalSummary.totalFeesLost || 0).toLocaleString()}`}>
            -{currencySymbol}{(globalSummary.totalFeesLost || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </h2>
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-6 md:mt-8">
        <HiOutlineSearch className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400 text-lg sm:text-xl" />
        <input type="text" placeholder="Search by coin or platform..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 sm:pl-14 pr-4 py-3 sm:py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-sm sm:text-base text-slate-700 dark:text-white outline-none focus:border-blue-500 transition-colors shadow-sm placeholder-slate-400" />
      </div>

      {/* 🚀 COLLAPSIBLE MONTHS ACTIVITY LOG (Paginated) */}
      {isLoadingLogs ? (
        <>
          <SkeletonCards />
          <SkeletonTable />
        </>
      ) : filteredLedger.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <FaExchangeAlt className="text-5xl text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-lg font-black text-slate-700 dark:text-slate-300">No swaps or transfers yet</p>
          <p className="text-sm text-slate-500">{searchTerm ? 'Adjust your search.' : 'Start by logging your first swap/bridge.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLedger.map(month => {
            const isOpen = openMonths.has(month.monthKey);
            const totalVolume = month.monthVolume;
            const totalFees = month.monthFees;

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
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Page Volume / Fees</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                        {currencySymbol}{totalVolume.toLocaleString(undefined, {minimumFractionDigits: 0})} &nbsp;
                        <span className="text-rose-500">-{currencySymbol}{totalFees.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </p>
                    </div>
                    <HiOutlineChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="animate-in fade-in duration-200">
                    {/* Mobile Cards */}
                    <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                      {month.records.map(rec => {
                        const fromCoinObj = fullDatabase.find(c => c.symbol === (rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin).toUpperCase());
                        const toCoinObj = fullDatabase.find(c => c.symbol === (rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin).toUpperCase());
                        return (
                          <div key={rec.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${rec.actionType === 'swap' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'}`}>
                                    {rec.actionType === 'swap' ? <FaExchangeAlt size={10} /> : <FaRoute size={10} />}
                                  </div>
                                  {rec.actionType === 'swap' ? 'Swap' : 'Bridge'}
                                </h3>
                                <div className={`mt-1 inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${rec.actionType === 'swap' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'}`}>
                                  {rec.actionType === 'swap' ? 'Swap Executed' : 'Network Bridge'}
                                </div>
                              </div>
                              <div className="text-right">
                                {rec.hiddenFeeBase === 0 ? (
                                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">+Profit</p>
                                ) : (
                                  <p className="text-sm font-black text-rose-600 dark:text-rose-400">-{currencySymbol}{(rec.hiddenFeeBase || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                )}
                              </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border border-slate-100 dark:border-slate-800/50 mt-1">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full shadow-sm bg-white dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                                  <LogoRenderer symbol={rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin} logoUrl={fromCoinObj?.logo} bg={fromCoinObj?.bg} color={fromCoinObj?.color} />
                                </div>
                                <div>
                                  <p className="font-black text-slate-800 dark:text-white text-xs">
                                    {rec.actionType === 'swap' ? rec.fromAmount : rec.bridgeSentAmount} <span className="text-[9px] text-slate-500 uppercase">{rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin}</span>
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase mt-0.5">
                                    <FaBuilding size={9}/> {rec.actionType === 'swap' ? rec.platform : rec.fromPlatform}
                                  </p>
                                </div>
                              </div>
                              <HiOutlineArrowRight className="text-slate-300 dark:text-slate-600 rotate-90 sm:rotate-0 mx-auto sm:mx-0" size={14} />
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full shadow-sm bg-white dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                                  <LogoRenderer symbol={rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin} logoUrl={toCoinObj?.logo} bg={toCoinObj?.bg} color={toCoinObj?.color} />
                                </div>
                                <div>
                                  <p className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                                    +{rec.actionType === 'swap' ? rec.toAmount : rec.bridgeReceivedAmount} <span className="text-[9px] text-slate-500 uppercase">{rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin}</span>
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase mt-0.5">
                                    <FaWallet size={9}/> {rec.actionType === 'swap' ? rec.platform : rec.toPlatform}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-end justify-between mt-2 pt-2">
                              <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                <HiOutlineCalendar size={12} /> {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                              </p>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleEdit(rec)} className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors border border-blue-200 dark:border-blue-500/30 active:scale-95 shadow-sm"><HiOutlinePencil size={14}/></button>
                                <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border border-rose-200 dark:border-rose-500/30 active:scale-95 shadow-sm"><HiOutlineTrash size={14}/></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-4 pl-6">Type</th>
                            <th className="p-4">Source</th>
                            <th className="p-4">Destination</th>
                            <th className="p-4 text-right">P&L</th>
                            <th className="p-4 pr-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {month.records.map(rec => {
                            const fromCoinObj = fullDatabase.find(c => c.symbol === (rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin).toUpperCase());
                            const toCoinObj = fullDatabase.find(c => c.symbol === (rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin).toUpperCase());
                            return (
                              <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                                <td className="p-4 pl-6">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${rec.actionType === 'swap' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'}`}>
                                      {rec.actionType === 'swap' ? <FaExchangeAlt size={12} /> : <FaRoute size={12} />}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                      {rec.actionType === 'swap' ? 'Swap' : 'Bridge'}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full shadow-sm bg-white dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                                      <LogoRenderer symbol={rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin} logoUrl={fromCoinObj?.logo} bg={fromCoinObj?.bg} color={fromCoinObj?.color} />
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-800 dark:text-white text-xs">
                                        {rec.actionType === 'swap' ? rec.fromAmount : rec.bridgeSentAmount} <span className="text-[9px] text-slate-500 uppercase">{rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin}</span>
                                      </p>
                                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                        {rec.actionType === 'swap' ? rec.platform : rec.fromPlatform}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full shadow-sm bg-white dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                                      <LogoRenderer symbol={rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin} logoUrl={toCoinObj?.logo} bg={toCoinObj?.bg} color={toCoinObj?.color} />
                                    </div>
                                    <div>
                                      <p className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                                        +{rec.actionType === 'swap' ? rec.toAmount : rec.bridgeReceivedAmount} <span className="text-[9px] text-slate-500 uppercase">{rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin}</span>
                                      </p>
                                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                        {rec.actionType === 'swap' ? rec.platform : rec.toPlatform}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 text-right">
                                  {rec.hiddenFeeBase === 0 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 text-xs font-black">+Profit</span>
                                  ) : (
                                    <span className="text-rose-600 dark:text-rose-400 text-xs font-black">
                                      -{currencySymbol}{(rec.hiddenFeeBase || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 pr-6">
                                  <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-xl transition-all shadow-sm active:scale-95"><HiOutlinePencil size={16}/></button>
                                    <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 rounded-xl transition-all shadow-sm active:scale-95"><HiOutlineTrash size={16}/></button>
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
          })}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={isPaginating}
                className="px-8 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isPaginating ? <HiOutlineRefresh className="animate-spin" size={16} /> : null}
                {isPaginating ? 'Loading...' : 'Load Older Entries'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ✅ EXPORT MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineDownload size={24} /> Export Report</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <button onClick={handleExportPDF} disabled={isGeneratingPDF} className="w-full py-4 px-5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border border-rose-200 dark:border-rose-800">
                <HiOutlineDocumentText size={20} />{isGeneratingPDF ? 'Generating PDF...' : '📄 PDF Document'}
              </button>
              <button onClick={handleExportExcel} disabled={isGeneratingExcel} className="w-full py-4 px-5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border border-emerald-200 dark:border-emerald-800">
                <HiOutlineTable size={20} />{isGeneratingExcel ? 'Generating Excel...' : '📊 Excel (CSV)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[60px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-4rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
            <div className="px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center transition-colors duration-300 bg-gradient-to-r from-blue-600 to-cyan-600 text-white shrink-0">
              <h3 className="text-lg sm:text-xl font-black flex items-center gap-2"><HiOutlineSwitchHorizontal size={20} className="sm:w-[24px] sm:h-[24px]"/> {editingId ? 'Edit Record' : 'Execute Action'}</h3>
              <button type="button" onClick={closeModal} className="p-1.5 sm:p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={18} className="sm:w-5 sm:h-5" /></button>
            </div>
            <form onSubmit={handleSaveEntry} className="p-5 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-5 sm:space-y-6">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm shrink-0">
                <button type="button" onClick={() => setFormData({...formData, actionType: 'swap'})} className={`flex-1 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all flex justify-center items-center gap-1.5 sm:gap-2 ${formData.actionType === 'swap' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><FaExchangeAlt/> Swap Coins</button>
                <button type="button" onClick={() => setFormData({...formData, actionType: 'bridge'})} className={`flex-1 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all flex justify-center items-center gap-1.5 sm:gap-2 ${formData.actionType === 'bridge' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><FaRoute/> Transfer</button>
              </div>

              {formData.actionType === 'swap' ? (
                <div className="space-y-5 sm:space-y-6 animate-in fade-in">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform (Where did you swap?)</label>
                    <div className="relative">
                      <input type="text" list="platform-suggestions" required value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})} placeholder="e.g. Binance, Phantom" className="w-full pl-4 pr-10 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm placeholder-slate-400" />
                      <datalist id="platform-suggestions">
                        {allWalletSuggestions.map(p => <option key={`sp-${p}`} value={p} />)}
                      </datalist>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {currentFormBalance > 0 && (
                    <div
                      onClick={() => setFormData(prev => ({...prev, fromAmount: currentFormBalance}))}
                      className="p-3 sm:p-3.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-all shadow-sm active:scale-[0.98] -mt-2"
                    >
                       <div className="flex items-center gap-2">
                         <FaWallet className="text-emerald-500" size={12} className="sm:w-3.5 sm:h-3.5" />
                         <div>
                           <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Available in {formData.platform || 'Vault'}</p>
                           <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5 hidden sm:block">Tap to auto-fill amount</p>
                         </div>
                       </div>
                       <p className="text-xs sm:text-sm font-black text-emerald-800 dark:text-emerald-300">
                         {currentFormBalance % 1 !== 0 ? currentFormBalance.toFixed(6).replace(/\.?0+$/, '') : currentFormBalance} <span className="text-[8px] sm:text-[10px] uppercase opacity-70">{formData.fromCoin}</span>
                       </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">You Gave (Asset)</label>
                      <div className="relative">
                        <select value={formData.fromCoin} onChange={(e) => setFormData({...formData, fromCoin: e.target.value})} className="w-full pl-4 pr-10 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-base font-black dark:text-white outline-none appearance-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm cursor-pointer">
                          {cryptoSymbols.map(c => <option key={`f-${c}`} value={c}>{c}</option>)}
                        </select>
                        <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <input type="number" step="any" required value={formData.fromAmount} onChange={(e) => setFormData({...formData, fromAmount: e.target.value})} placeholder="Amount Given" className="w-full p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm placeholder-slate-400" />
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[10px] sm:text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">You Received</label>
                      <div className="relative">
                        <select value={formData.toCoin} onChange={(e) => setFormData({...formData, toCoin: e.target.value})} className="w-full pl-4 pr-10 py-3 sm:py-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-300 dark:border-emerald-800/50 rounded-xl text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 outline-none appearance-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm cursor-pointer">
                          {cryptoSymbols.concat(['USDT']).map(c => <option key={`t-${c}`} value={c}>{c}</option>)}
                        </select>
                        <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                      </div>
                      <input type="number" step="any" required value={formData.toAmount} onChange={(e) => setFormData({...formData, toAmount: e.target.value})} placeholder="Amount Received" className="w-full p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-300 dark:border-emerald-800/50 rounded-xl font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm placeholder-emerald-300 dark:placeholder-emerald-800" />
                    </div>
                  </div>

                  {formData.fromAmount && formData.toAmount && (
                    <div className={`p-3 sm:p-4 rounded-xl border flex justify-between items-center shadow-sm ${liveFormFee.isLoss ? 'bg-rose-50 border-rose-300 dark:bg-rose-900/10 dark:border-rose-900/50' : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/10 dark:border-emerald-900/50'}`}>
                      <div className="min-w-0 pr-2">
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">System Analysis (Live)</p>
                        <p className={`text-xs sm:text-sm font-black truncate mt-0.5 sm:mt-0 ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {liveFormFee.isLoss ? 'Hidden Spread Fee' : 'Profitable Arbitrage'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-base sm:text-lg font-black tracking-tight ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {liveFormFee.isLoss ? '-' : '+'}{currencySymbol}{Math.abs(liveFormFee.fee).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                        <p className={`text-[9px] sm:text-[10px] font-bold opacity-70 ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>≈ {liveFormFee.feePct.toFixed(2)}% {liveFormFee.isLoss ? 'Loss' : 'Profit'}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5 sm:space-y-6 animate-in fade-in">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset to Transfer</label>
                    <div className="flex gap-2 sm:gap-3">
                      <div className="w-1/3 relative shrink-0">
                         <select value={formData.bridgeCoin} onChange={(e) => setFormData({...formData, bridgeCoin: e.target.value})} className="w-full pl-3 sm:pl-4 pr-8 sm:pr-10 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-sm sm:text-base dark:text-white outline-none appearance-none focus:ring-2 focus:ring-purple-500/50 transition-colors shadow-sm cursor-pointer">
                           {cryptoSymbols.map(c => <option key={`b-${c}`} value={c}>{c}</option>)}
                         </select>
                         <HiOutlineChevronDown className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <div className="flex-1 text-right pt-2 px-1 sm:px-2 text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                        Moving crypto burns gas fees. Track exactly how much network fee you paid.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:space-y-2 flex flex-col">
                      <label className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">From Wallet</label>
                      <div className="relative">
                         <input type="text" list="platform-suggestions" required value={formData.fromPlatform} onChange={(e) => setFormData({...formData, fromPlatform: e.target.value})} placeholder="e.g., Binance" className="w-full pl-4 pr-10 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm placeholder-slate-400" />
                         <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>

                      {currentFormBalance > 0 && (
                        <div
                          onClick={() => setFormData(prev => ({...prev, bridgeSentAmount: currentFormBalance}))}
                          className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-lg flex items-center justify-between cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-all shadow-sm active:scale-[0.98]"
                        >
                           <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><FaWallet size={10}/> Available</span>
                           <span className="text-[10px] sm:text-xs font-black text-emerald-800 dark:text-emerald-300">{currentFormBalance % 1 !== 0 ? currentFormBalance.toFixed(6).replace(/\.?0+$/, '') : currentFormBalance}</span>
                        </div>
                      )}

                      <input type="number" step="any" required value={formData.bridgeSentAmount} onChange={(e) => setFormData({...formData, bridgeSentAmount: e.target.value})} placeholder="Amount Sent" className="w-full p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm placeholder-slate-400 mt-auto" />
                    </div>

                    <div className="space-y-1.5 sm:space-y-2 flex flex-col justify-end mt-2 sm:mt-0">
                      <label className="text-[10px] sm:text-[11px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">To Destination</label>
                      <div className="relative">
                         <input type="text" list="platform-suggestions" required value={formData.toPlatform} onChange={(e) => setFormData({...formData, toPlatform: e.target.value})} placeholder="e.g., Trust Wallet" className="w-full pl-4 pr-10 py-3 sm:py-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-300 dark:border-purple-800/50 rounded-xl font-bold text-sm sm:text-base dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors shadow-sm placeholder-purple-300 dark:placeholder-purple-700" />
                         <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                      </div>
                      <input type="number" step="any" required value={formData.bridgeReceivedAmount} onChange={(e) => setFormData({...formData, bridgeReceivedAmount: e.target.value})} placeholder="Amount Received" className="w-full p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-300 dark:border-purple-800/50 rounded-xl font-bold text-sm sm:text-base text-purple-600 dark:text-purple-400 outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors shadow-sm placeholder-purple-300 dark:placeholder-purple-700 mt-auto" />
                    </div>
                  </div>

                  {formData.bridgeSentAmount && formData.bridgeReceivedAmount && (
                    <div className={`p-3 sm:p-4 rounded-xl border flex justify-between items-center shadow-sm ${liveFormFee.isLoss ? 'bg-rose-50 border-rose-300 dark:bg-rose-900/10 dark:border-rose-900/50' : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/10 dark:border-emerald-900/50'}`}>
                      <div className="min-w-0 pr-2">
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">Network Gas Fee</p>
                        <p className={`text-xs sm:text-sm font-black truncate mt-0.5 sm:mt-0 ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {liveFormFee.feeCoins.toFixed(6)} <span className="text-[9px] sm:text-[10px]">{formData.bridgeCoin}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-base sm:text-lg font-black tracking-tight ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          -{currencySymbol}{Math.abs(liveFormFee.feeBase).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                        <p className={`text-[9px] sm:text-[10px] font-bold opacity-70 ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>Loss in Fiat</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <datalist id="platform-suggestions">
                {allWalletSuggestions.map(p => <option key={`dl-${p}`} value={p} />)}
              </datalist>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between ml-1">
                  <span>Date & Time</span>
                  <span className="text-blue-500">{formatGlobalDate && formData.datetime ? formatGlobalDate(formData.datetime.split('T')[0], 'short') : ''}</span>
                </label>
                <input type="datetime-local" required value={formData.datetime} onChange={(e) => setFormData({...formData, datetime: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-colors cursor-pointer" />
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-4 sm:mt-6 z-10 border-t border-slate-100 dark:border-slate-800 sm:border-0 sm:pt-0 sm:pb-0">
                <button type="submit" disabled={isSaving} className="w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl font-black text-white text-sm sm:text-lg transition-all active:scale-95 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-xl shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0">
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-xl sm:text-2xl" /> : (editingId ? 'Update Activity' : 'Log Transfer & Sync All Ledgers')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-8 border border-rose-200 dark:border-rose-900/50 relative overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-pink-500"></div>
            <div className="flex flex-col items-center text-center mb-5 sm:mb-6 shrink-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mb-3 sm:mb-4 shadow-inner border border-rose-200 dark:border-rose-500/30"><HiOutlineLockClosed /></div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-1.5 sm:mt-2">Deleting this record will completely reverse the balances from your Crypto Wallet, Income, and Expense ledgers.</p>
            </div>
            <form onSubmit={executeSecureDelete} className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-4">
              <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="ENTER PIN" className="w-full text-center tracking-[0.5em] text-xl sm:text-2xl p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm transition-colors focus:border-rose-500" />
              {pinError && <p className="text-[10px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 text-center animate-bounce mt-2">{pinError}</p>}
              <div className="flex gap-2 sm:gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm border border-slate-300 dark:border-slate-700">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl font-black text-white text-xs sm:text-sm bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex justify-center items-center gap-1 sm:gap-2 active:scale-95 shadow-lg shadow-rose-500/30">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={16} className="sm:w-[18px] sm:h-[18px]" /> : null} Verify & Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SwapAndBridgeContent;