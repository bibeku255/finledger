// src/pages/accounts/IncomeStreams.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, deleteDoc, updateDoc, query, orderBy, where, getDocs, getDoc, setDoc, documentId } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPINEnhanced } from '../../utils/securityUtils';
import { useToast } from '../../hooks/useToastNotification';

// ✅ IMPORTING ENTERPRISE HOOKS
import { useSecureSnapshot } from '../../hooks/useSecureSnapshot';
import { usePaginatedMonthlyLogs } from '../../hooks/usePaginatedMonthlyLogs';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineBriefcase,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineChevronDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineCalendar, HiOutlineShieldCheck, HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineCash, HiOutlineCheckCircle, HiOutlineInformationCircle
} from 'react-icons/hi';
import { 
  FaMoneyBillWave, FaBitcoin, FaUniversity, FaWallet, 
  FaExchangeAlt, FaChartLine, FaArrowDown, FaRandom, FaLock, FaUserFriends
} from 'react-icons/fa';

import { currenciesList, fiatFlagMap } from '../../utils/marketConstants';

// ============================================
// 🧩 CONSTANTS & HELPERS
// ============================================
const incomeCategories = [
  "Salary & Wages", "Freelancing & Contracts", "Business & Sales", "Micro-Tasks & Airdrops",
  "Crypto Trading Profits", "Crypto Staking & Yield", "P2P Exchange Profit", "Interest Received (Khata/Loans)",
  "Dividends & Investments", "Rental Income", "Refunds & Cashbacks", "Gifts & Grants", "Other Income"
];

const getLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16); 
};

// 🚀 ENTERPRISE ENGINE: Automatically syncs perfect math for Income
const syncIncomeSummary = async (userId, getCalendarMonthKeyFallback) => {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'incomeLogs'));
    const logs = snap.docs.map(d => d.data());

    let totalIncomeBase = 0;
    const monthTotals = {};

    logs.forEach(t => {
      const amt = Number(t.finalBaseAmount || 0);
      totalIncomeBase += amt;

      let mk;
      try {
        mk = getCalendarMonthKeyFallback(t.date || t.timestamp);
      } catch {
        const d = new Date(t.date || t.timestamp || new Date());
        mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!monthTotals[mk]) monthTotals[mk] = 0;
      monthTotals[mk] += amt;
    });

    const summaryData = {
      totalIncomeBase,
      monthTotals,
      totalEntries: logs.length,
      lastUpdated: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', userId, 'walletSummary', 'income'), summaryData, { merge: true });
    return summaryData;
  } catch (error) {
    console.error("Failed to sync income summary:", error);
    return null;
  }
};

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const IncomeStreamsContent = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = [], formatGlobalDate, getCalendarMonthKey } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  const availableFiats = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);

  // 🗓️ Collapsible months state
  const getCurrentMonthKey = () => {
    try { return getCalendarMonthKey(new Date().toISOString()); }
    catch { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  };
  const [openMonths, setOpenMonths] = useState(new Set([getCurrentMonthKey()]));
  const toggleMonth = useCallback((monthKey) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  }, []);
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const toggleExpandMonth = useCallback((monthKey) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  }, []);

  // 🚀 1. FAST MATH ENGINE
  const [globalSummary, setGlobalSummary] = useState({
    totalIncomeBase: 0, monthTotals: {}, totalEntries: 0
  });

  const summaryQuery = useMemo(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'walletSummary'), where(documentId(), '==', 'income'));
  }, [user?.uid]);

  const { data: summaryDataArray, loading: isSummaryLoading } = useSecureSnapshot(summaryQuery);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (isSummaryLoading) return;
    if (summaryDataArray && summaryDataArray.length > 0) {
      setGlobalSummary(summaryDataArray[0]);
    } else if (summaryDataArray?.length === 0 && user?.uid && !isSyncingRef.current) {
      isSyncingRef.current = true;
      syncIncomeSummary(user.uid, getCalendarMonthKey).then(data => {
        if (data) setGlobalSummary(data);
        isSyncingRef.current = false;
      });
    }
  }, [summaryDataArray, isSummaryLoading, user?.uid, getCalendarMonthKey]);

  // 🚀 2. TRUE FIRESTORE PAGINATION HOOK
  const { 
    months: paginatedMonths, 
    loading: isLoadingLogs, 
    isPaginating, 
    hasMore, 
    loadMore, 
    refresh: refreshIncomes 
  } = usePaginatedMonthlyLogs(user?.uid, 'incomeLogs', 20, !!user, getCalendarMonthKey);


  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]); 
  
  const [bankWalletLogs, setBankWalletLogs] = useState([]);
  const [existingCryptoPlatforms, setExistingCryptoPlatforms] = useState([]);

  // Fetch custom coins
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
    selectedCryptos.forEach(c => { if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c); });
    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  const availableCryptos = useMemo(() => Array.from(new Set(["USDT", ...fullDatabase.map(c => c.symbol.toUpperCase())])), [fullDatabase]);

  // ✅ OPTIMIZED VAULT FETCHING from Summary
  useEffect(() => {
     if(!user) return;
     const fetchVaults = async () => {
        try {
          const bankSum = await getDoc(doc(db, 'users', user.uid, 'walletSummary', 'bank'));
          const onlineSum = await getDoc(doc(db, 'users', user.uid, 'walletSummary', 'online'));
          const cryptoSum = await getDoc(doc(db, 'users', user.uid, 'walletSummary', 'crypto'));
          
          const names = new Set();
          if (bankSum.exists() && bankSum.data().existingBanks) bankSum.data().existingBanks.forEach(n => names.add(n));
          if (onlineSum.exists() && onlineSum.data().existingWallets) onlineSum.data().existingWallets.forEach(n => names.add(n));
          setBankWalletLogs(Array.from(names));

          const cryptoNames = new Set();
          if (cryptoSum.exists() && cryptoSum.data().existingPlatforms) cryptoSum.data().existingPlatforms.forEach(n => cryptoNames.add(n));
          setExistingCryptoPlatforms(Array.from(cryptoNames));
        } catch (e) {
          console.warn("Summary fetch failed for inputs. Using fallback.", e);
        }
     };
     fetchVaults();
  }, [user]);
  
  const existingBanks = useMemo(() => Array.from(new Set(bankWalletLogs)), [bankWalletLogs]);

  const defaultSplitSource = { vault: 'bank', subWallet: '', asset: baseCurrency, cryptoPlatform: '', amount: '', fee: '', exchangeRate: 1 };

  const [formData, setFormData] = useState({
    title: '', category: incomeCategories[0], date: getLocalDateTimeString(), linkedIncomeId: '',
    isSplit: false, vault: 'bank', subWallet: '', cryptoPlatform: '', asset: baseCurrency, 
    amount: '', fee: '', exchangeRate: 1, isSynced: false,
    splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ]
  });

  // Live rate fetching (unchanged)
  const fetchLiveRate = async (index = null) => {
    const isSingle = index === null;
    const assetToCheck = isSingle ? formData.asset : formData.splitSources[index].asset;
    
    if (assetToCheck === baseCurrency) return;
    setIsFetchingRate(isSingle ? 'single' : index);
    
    try {
      const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fiatData = await fiatRes.json();
      const usdToBase = fiatData.rates[baseCurrency] || 1;
      let finalRate = 1;

      if (availableFiats.includes(assetToCheck) || currenciesList.find(c => c.code === assetToCheck)) {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${assetToCheck}`);
        const data = await res.json();
        finalRate = data.rates[baseCurrency] || 1;
      } else {
        const upperSym = assetToCheck.toUpperCase();
        const coinObj = fullDatabase.find(c => c.symbol === upperSym) || {};
        const searchId = coinObj.id || assetToCheck.toLowerCase();
        let priceUsd = null;

        if (coinObj.fetchMode === 'contract' && coinObj.network && coinObj.contractAddress) {
           try {
              const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${coinObj.network}/tokens/${coinObj.contractAddress}`);
              if (gtRes.ok) { const gtJson = await gtRes.json(); priceUsd = parseFloat(gtJson.data.attributes.price_usd); }
           } catch(e) {}
        } 
        if (!priceUsd) {
           try {
               const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${searchId}&vs_currencies=usd`);
               const cgData = await cgRes.json();
               if (cgData[searchId]?.usd) priceUsd = parseFloat(cgData[searchId].usd);
           } catch(e) {}
        }
        if (!priceUsd) {
            try {
                if (['USDT', 'USDC', 'DAI'].includes(upperSym)) priceUsd = 1.00; 
                else {
                    const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${upperSym}USDT`);
                    if (bRes.ok) { const bData = await bRes.json(); priceUsd = parseFloat(bData.price); }
                }
            } catch(e) {}
        }
        finalRate = (priceUsd || (coinObj?.fallbackPrice || 0)) * usdToBase;
      }

      if (isSingle) setFormData(prev => ({ ...prev, exchangeRate: finalRate.toFixed(6) }));
      else {
        const updatedSplits = [...formData.splitSources];
        updatedSplits[index].exchangeRate = finalRate.toFixed(6);
        setFormData(prev => ({ ...prev, splitSources: updatedSplits }));
      }
    } catch (error) { addToast("Rate fetch failed. Enter manually.", "error"); } 
    finally { setIsFetchingRate(false); }
  };

  const getNetBaseAmount = (amount, fee, isForeign, rate) => {
    const gross = parseFloat(amount) || 0;
    const deduction = parseFloat(fee) || 0;
    const net = Math.max(0, gross - deduction);
    return net * (isForeign ? (parseFloat(rate) || 1) : 1);
  };

  const getSplitTotalBase = () => formData.splitSources.reduce((acc, curr) => acc + getNetBaseAmount(curr.amount, curr.fee, curr.asset !== baseCurrency, curr.exchangeRate), 0);

  const isForeign = formData.asset !== baseCurrency;
  const finalBaseAmount = formData.isSplit ? getSplitTotalBase() : getNetBaseAmount(formData.amount, formData.fee, isForeign, formData.exchangeRate);

  // 🚀 3. LOCAL UI FILTERING & CALENDAR FIX
  const filteredLedger = useMemo(() => {
    if (!paginatedMonths) return [];
    
    return paginatedMonths.map(month => {
      const sampleDate = month.records?.[0]?.date || new Date();
      const localizedMonthName = formatGlobalDate 
        ? formatGlobalDate(sampleDate, 'monthYear') 
        : month.monthName;

      const filteredRecords = month.records.filter(r => {
        const term = searchTerm.toLowerCase();
        const matchSearch = r.title?.toLowerCase().includes(term) || r.asset?.toLowerCase().includes(term);
        const matchCategory = filterCategory === 'all' || r.category === filterCategory;
        return matchSearch && matchCategory;
      });

      let pageNet = 0;
      filteredRecords.forEach(r => pageNet += (Number(r.finalBaseAmount) || 0));

      return { 
        ...month, 
        monthName: localizedMonthName, 
        records: filteredRecords, 
        pageNet 
      };
    }).filter(m => m.records.length > 0);
  }, [paginatedMonths, searchTerm, filterCategory, formatGlobalDate]);


  // ✅ EXPORT HANDLERS
  const handleExportPDF = async () => {
    setIsExportModalOpen(false);
    setIsGeneratingPDF(true);

    const filteredForReport = filteredLedger.flatMap(month => month.records);
    if (filteredForReport.length === 0) {
      addToast('No records found to export.', 'warning');
      setIsGeneratingPDF(false);
      return;
    }

    const reportData = filteredForReport.map(rec => {
      const cleanTitle = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const sourceText = rec.isSplit ? 'Split Income' : `${rec.vault.charAt(0).toUpperCase() + rec.vault.slice(1)} Vault${rec.subWallet ? ` (${rec.subWallet})` : ''}`;
      const nativeAmtText = rec.isSplit ? 'Multiple Assets' : `${(Number(rec.amount) || 0).toLocaleString()} ${rec.asset}`;
      const feeBaseValue = rec.isSplit ? Number(rec.baseFee || 0) : Number(rec.fee || 0);

      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : (rec.date ? rec.date.split('T')[0] : 'N/A'),
        source: cleanTitle, category: rec.category, vault: sourceText, nativeAmount: nativeAmtText,
        fee: feeBaseValue, baseValue: Number(rec.finalBaseAmount || 0) 
      };
    });

    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Source / Item', key: 'source' },
      { header: 'Category', key: 'category' }, { header: 'Vault Deposited', key: 'vault' },
      { header: 'Gross Amount', key: 'nativeAmount' }, { header: `Fee (${currencySymbol})`, key: 'fee', isNumeric: true },
      { header: `Net Value (${currencySymbol})`, key: 'baseValue', isNumeric: true }
    ];

    try {
      await downloadPDFReport(reportData, columns, 'Income_Streams_Report', 'Income Streams Ledger', {
        onSuccess: () => addToast('PDF report downloaded!', 'success'),
        onError: (msg) => addToast(`PDF Error: ${msg}`, 'error'),
      });
    } catch (err) {
      addToast(`PDF export failed: ${err.message}`, 'error');
    } finally { setIsGeneratingPDF(false); }
  };

  const handleExportExcel = async () => {
    setIsExportModalOpen(false);
    setIsGeneratingExcel(true);

    const filteredForReport = filteredLedger.flatMap(month => month.records);
    if (filteredForReport.length === 0) {
      addToast('No records found to export.', 'warning');
      setIsGeneratingExcel(false);
      return;
    }

    const reportData = filteredForReport.map(rec => {
      const sourceText = rec.isSplit ? 'Split Income' : `${rec.vault.charAt(0).toUpperCase() + rec.vault.slice(1)} Vault${rec.subWallet ? ` (${rec.subWallet})` : ''}`;
      const nativeAmtText = rec.isSplit ? 'Multiple Assets' : `${(Number(rec.amount) || 0).toLocaleString()} ${rec.asset}`;
      const feeBaseValue = rec.isSplit ? Number(rec.baseFee || 0) : Number(rec.fee || 0);

      return {
        Date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : (rec.date ? rec.date.split('T')[0] : 'N/A'),
        Source: (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " "), 
        Category: rec.category, Vault: sourceText, 
        GrossAmount: nativeAmtText, Fee: feeBaseValue.toFixed(2), 
        NetValue: Number(rec.finalBaseAmount || 0).toFixed(2)
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
    const a = document.createElement('a'); a.href = url; a.download = `Income_Streams_Ledger.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    addToast('Excel (CSV) report downloaded!', 'success');
    setIsGeneratingExcel(false);
  };

  const getVaultIcon = (v) => {
    if (v === 'bank') return <FaUniversity className="text-blue-500" />;
    if (v === 'cash') return <HiOutlineCash className="text-emerald-500" />;
    if (v === 'crypto') return <FaBitcoin className="text-orange-500" />;
    if (v === 'online') return <FaWallet className="text-purple-500" />;
    return <FaRandom className="text-amber-500" />;
  };

  // ✅ PERFECTED VAULT INJECTION PROTOCOL (FIXED NaN BUG)
  const createVaultRecord = (sourceData, linkId, amountToAdd, feeToAdd = 0) => {
    const isForeignAsset = sourceData.asset !== baseCurrency;
    
    // Safely parse amounts to prevent NaN dropping to 0
    const exRate = isForeignAsset ? (parseFloat(sourceData.exchangeRate) || 1) : 1;
    const grossNative = parseFloat(amountToAdd) || 0;
    const nativeFee = parseFloat(feeToAdd) || 0;
    
    const baseFee = nativeFee * exRate;
    const netNative = Math.max(0, grossNative - nativeFee); // Ensured no negative
    const netBase = netNative * exRate;
    
    const safeTitle = formData.title || 'Income Entry';
    const safeCat = formData.category || 'Other Income';
    const safeDate = formData.date || getLocalDateTimeString();

    if (sourceData.vault === 'crypto') {
      return {
        collection: 'cryptoWalletLogs',
        data: { 
          type: 'in', coin: sourceData.asset, quantity: netNative, platform: sourceData.cryptoPlatform || 'Unknown', 
          reason: `Income: ${safeCat} (${safeTitle})`, referenceNo: linkId, date: safeDate, 
          timestamp: new Date(safeDate).getTime(), linkedIncomeId: linkId, fee: nativeFee, grossQuantity: grossNative,
          finalBaseAmount: netBase,
          amount: netNative // 🚀 Fixed: Explicitly passing expected quantity field
        }
      };
    }
    return {
      collection: sourceData.vault + 'Wallet',
      data: { 
        title: `Income: ${safeCat} (${safeTitle})`, type: 'in', date: safeDate, 
        timestamp: new Date(safeDate).getTime(), currency: sourceData.asset, 
        foreignAmount: grossNative, foreignFee: nativeFee, fee: baseFee, exchangeRate: exRate, 
        finalBaseAmount: netBase, isIncome: true, linkedIncomeId: linkId, 
        walletName: sourceData.subWallet || 'Main Vault', bankName: sourceData.subWallet || 'Main Vault', 
        transferType: 'Income Deposit',
        amount: netBase, // 🚀 Fixed: Appending the exact target key for the vault logs
        vaultId: sourceData.vault === 'bank'
          ? 'bank_' + (sourceData.subWallet || 'Main').trim().toUpperCase()
          : sourceData.vault === 'online'
          ? 'online_' + (sourceData.subWallet || 'Main').trim().toUpperCase()
          : 'cash_main'
      }
    };
  }; 

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) { addToast("Please login first!", "error"); return; }

    if (!formData.isSplit) {
      if (formData.vault === 'crypto' && !(formData.cryptoPlatform || '').trim()) { addToast("Specify crypto platform.", "warning"); return; }
      if ((formData.vault === 'bank' || formData.vault === 'online') && !(formData.subWallet || '').trim()) { addToast("Specify Bank/Wallet Name.", "warning"); return; }
      if (!formData.amount || parseFloat(formData.amount) <= 0) { addToast("Amount must be > 0.", "warning"); return; }
    } else {
      for (let i = 0; i < formData.splitSources.length; i++) {
        const s = formData.splitSources[i];
        if (!s.amount || parseFloat(s.amount) <= 0) { addToast(`Source ${i + 1} amount must be > 0.`, "warning"); return; }
        if (s.vault === 'crypto' && !(s.cryptoPlatform || '').trim()) { addToast(`Specify platform for Source ${i + 1}.`, "warning"); return; }
        if ((s.vault === 'bank' || s.vault === 'online') && !(s.subWallet || '').trim()) { addToast(`Specify Bank/Wallet for Source ${i + 1}.`, "warning"); return; }
      }
    }

    setIsSaving(true);
    const timestamp = editingId ? paginatedMonths.flatMap(m=>m.records).find(i => i.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const linkId = formData.linkedIncomeId || `INC_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    const baseGrossTotal = formData.isSplit 
      ? formData.splitSources.reduce((acc, curr) => acc + (parseFloat(curr.amount)||0)*(parseFloat(curr.exchangeRate)||1), 0) 
      : (parseFloat(formData.amount)||0) * (formData.asset !== baseCurrency ? parseFloat(formData.exchangeRate) : 1);
    
    const baseFeeTotal = formData.isSplit 
      ? formData.splitSources.reduce((acc, curr) => acc + (parseFloat(curr.fee)||0)*(parseFloat(curr.exchangeRate)||1), 0) 
      : (parseFloat(formData.fee)||0) * (formData.asset !== baseCurrency ? parseFloat(formData.exchangeRate) : 1);

    const incomeRecord = {
      title: formData.title, category: formData.category, asset: formData.isSplit ? 'Multiple' : formData.asset,
      amount: formData.isSplit ? baseGrossTotal : parseFloat(formData.amount) || 0,
      fee: formData.isSplit ? baseFeeTotal : (parseFloat(formData.fee) || 0),
      baseFee: baseFeeTotal,
      exchangeRate: formData.isSplit ? 1 : (formData.asset !== baseCurrency ? parseFloat(formData.exchangeRate) : 1),
      finalBaseAmount, date: formData.date, timestamp, linkedIncomeId: linkId, isSplit: formData.isSplit,
      vault: formData.isSplit ? 'split' : formData.vault,
      subWallet: !formData.isSplit && (formData.vault === 'bank' || formData.vault === 'online') ? formData.subWallet : '', 
      cryptoPlatform: !formData.isSplit && formData.vault === 'crypto' ? formData.cryptoPlatform : '', 
      splitDetails: formData.isSplit ? formData.splitSources.map(s => ({ vault: s.vault, subWallet: s.subWallet, asset: s.asset, amount: parseFloat(s.amount) || 0, fee: parseFloat(s.fee) || 0, cryptoPlatform: s.vault === 'crypto' ? s.cryptoPlatform : '', exchangeRate: parseFloat(s.exchangeRate) })) : null
    };

    try {
      if (editingId) {
        if (formData.isSynced) {
           await updateDoc(doc(db, "users", user.uid, "incomeLogs", editingId), { subWallet: formData.subWallet, vault: formData.vault });
           const vaults = ['bankWallet', 'onlineWallet', 'cashWallet'];
           for (const v of vaults) {
              const q = query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", linkId));
              const snap = await getDocs(q);
              const updatePromises = snap.docs.map(d => updateDoc(doc(db, "users", user.uid, v, d.id), { walletName: formData.subWallet, bankName: formData.subWallet }));
              await Promise.all(updatePromises);
           }
        } else {
           const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
           for (const v of vaults) {
             const q = query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", linkId));
             const snap = await getDocs(q);
             const deletePromises = snap.docs.map(d => deleteDoc(doc(db, "users", user.uid, v, d.id)));
             await Promise.all(deletePromises);
           }
           await updateDoc(doc(db, "users", user.uid, "incomeLogs", editingId), incomeRecord);
           
           if (formData.isSplit) {
             for (let s of formData.splitSources) { 
               // 🚀 FIXED: Default 0 values
               const rec = createVaultRecord(s, linkId, parseFloat(s.amount) || 0, parseFloat(s.fee) || 0); 
               await addDoc(collection(db, "users", user.uid, rec.collection), rec.data); 
             }
           } else {
             // 🚀 FIXED: Default 0 values
             const singleRec = createVaultRecord({ vault: formData.vault, subWallet: formData.subWallet, asset: formData.asset, exchangeRate: formData.exchangeRate, cryptoPlatform: formData.cryptoPlatform }, linkId, parseFloat(formData.amount) || 0, parseFloat(formData.fee) || 0);
             await addDoc(collection(db, "users", user.uid, singleRec.collection), singleRec.data);
           }
        }
      } else {
        await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeRecord);
        if (formData.isSplit) {
          for (let s of formData.splitSources) { 
            // 🚀 FIXED: Default 0 values
            const rec = createVaultRecord(s, linkId, parseFloat(s.amount) || 0, parseFloat(s.fee) || 0); 
            await addDoc(collection(db, "users", user.uid, rec.collection), rec.data); 
          }
        } else {
          // 🚀 FIXED: Default 0 values
          const singleRec = createVaultRecord({ vault: formData.vault, subWallet: formData.subWallet, asset: formData.asset, exchangeRate: formData.exchangeRate, cryptoPlatform: formData.cryptoPlatform }, linkId, parseFloat(formData.amount) || 0, parseFloat(formData.fee) || 0);
          await addDoc(collection(db, "users", user.uid, singleRec.collection), singleRec.data);
        }
      }

      // ✅ SMART CROSS-VAULT SYNC (Invalidate Summaries)
      const vaultsToClear = new Set();
      if (formData.isSplit) { formData.splitSources.forEach(s => vaultsToClear.add(s.vault)); }
      else { vaultsToClear.add(formData.vault); }
      for (const v of vaultsToClear) {
        if(['bank', 'cash', 'online'].includes(v)) {
           await deleteDoc(doc(db, 'users', user.uid, 'walletSummary', v));
        }
      }
      await syncIncomeSummary(user.uid, getCalendarMonthKey);
      
      addToast(editingId ? 'Income updated successfully!' : 'Income logged & vaults credited!', 'success');
      refreshIncomes();
      closeModal();
    } catch (error) { addToast("System Error: Failed to save income log.", "error"); } 
    finally { setIsSaving(false); }
  };

  const initiateDelete = (rec) => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your PIN.");
    setIsVerifying(true); setPinError('');

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const storedHash = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin;
      const { valid, newHash } = await verifyPINEnhanced(pinInput.trim(), storedHash, user.uid);
      
      if (!valid) { setPinError("Incorrect PIN."); setIsVerifying(false); return; }
      if (newHash) { await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true }); }
      
      await deleteDoc(doc(db, "users", user.uid, "incomeLogs", deleteContext.id));
      if (deleteContext.linkedIncomeId) {
        for (const v of ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs']) {
          const snaps = await getDocs(query(collection(db, "users", user.uid, v), where("linkedIncomeId", "==", deleteContext.linkedIncomeId)));
          snaps.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
        }
      }
      
      // ✅ SMART CROSS-VAULT SYNC (Invalidate Summaries)
      const vaultsToClear = new Set();
      if (deleteContext.isSplit && deleteContext.splitDetails) {
         deleteContext.splitDetails.forEach(s => vaultsToClear.add(s.vault));
      } else { vaultsToClear.add(deleteContext.vault); }
      for (const v of vaultsToClear) {
        if(['bank', 'cash', 'online'].includes(v)) {
           await deleteDoc(doc(db, 'users', user.uid, 'walletSummary', v));
        }
      }
      await syncIncomeSummary(user.uid, getCalendarMonthKey);

      setDeleteContext(null);
      addToast('Income deleted successfully.', 'info');
      refreshIncomes();
    } catch (e) { setPinError("System error during deletion."); } 
    finally { setIsVerifying(false); }
  };

  const openModal = () => { 
    setEditingId(null); setIsModalOpen(true); 
    setFormData({ 
      title: '', category: incomeCategories[0], date: getLocalDateTimeString(), linkedIncomeId: '', isSplit: false,
      vault: 'bank', subWallet: existingBanks[0] || '', cryptoPlatform: existingCryptoPlatforms[0] || '', asset: baseCurrency, 
      amount: '', fee: '', exchangeRate: 1, isSynced: false,
      splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ]
    }); 
  };
  
  const closeModal = () => setIsModalOpen(false);
  
  const handleEdit = (rec) => { 
    const isSplit = rec.isSplit || false;
    let mappedSplits = [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ];
    if (isSplit && rec.splitDetails) {
      mappedSplits = rec.splitDetails.map(s => ({
        vault: s.vault, subWallet: s.subWallet || s.bankName || s.walletName || '',
        asset: s.asset || baseCurrency, amount: s.amount || '', fee: s.fee || '', cryptoPlatform: s.cryptoPlatform || '', exchangeRate: s.exchangeRate || 1
      }));
    }
    const isSyncedEntry = !!(rec.linkedIncomeId && !rec.linkedIncomeId.startsWith('INC_'));

    setFormData({ 
      title: rec.title, category: rec.category, date: rec.date || getLocalDateTimeString(), linkedIncomeId: rec.linkedIncomeId || '', 
      isSplit: isSplit, vault: isSplit ? 'bank' : (rec.vault || 'bank'), subWallet: isSplit ? '' : (rec.subWallet || rec.bankName || rec.walletName || ''),
      asset: isSplit ? baseCurrency : (rec.asset || baseCurrency), amount: isSplit ? '' : (rec.amount || ''), fee: isSplit ? '' : (rec.fee || ''),
      exchangeRate: isSplit ? 1 : (rec.exchangeRate || 1), cryptoPlatform: isSplit ? '' : (rec.cryptoPlatform || ''),
      isSynced: isSyncedEntry, splitSources: mappedSplits
    }); 
    setEditingId(rec.id); setIsModalOpen(true); 
  };

  const updateSplit = (index, field, value) => {
    const updated = [...formData.splitSources]; updated[index][field] = value;
    if (field === 'vault') {
        const cList = availableCryptos.length > 0 ? availableCryptos : ['USDT'];
        updated[index].asset = value === 'crypto' ? (cList[0] || 'USDT') : baseCurrency; updated[index].exchangeRate = 1;
        if(value === 'cash' || value === 'crypto') updated[index].subWallet = ''; 
    }
    setFormData({ ...formData, splitSources: updated });
  };

  const addSplitSource = () => setFormData({ ...formData, splitSources: [...formData.splitSources, { ...defaultSplitSource, vault: 'online' }] });
  const removeSplitSource = (index) => { if (formData.splitSources.length > 2) setFormData({ ...formData, splitSources: formData.splitSources.filter((_, i) => i !== index) }); };

  return (
    <div className="w-full h-auto pb-24">
      <div className="pt-20 sm:pt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* PREMIUM HEADER */}
        <div className="relative rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-700/50 z-20">
          <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.1),transparent_70%)]" />
             <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
          </div>
          
          <div className="relative z-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                  <HiOutlineBriefcase size={24} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight truncate">Income Streams</h1>
                  <p className="text-sm font-medium text-slate-400 truncate">Track salaries, rewards, & freelance income</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
              <div className="relative w-full md:w-auto z-[100]">
                <button 
                  onClick={() => setIsExportModalOpen(true)}
                  disabled={isGeneratingPDF || isGeneratingExcel}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 shadow-sm disabled:opacity-50"
                >
                  {isGeneratingPDF || isGeneratingExcel ? <><HiOutlineRefresh className="animate-spin" size={16} /> Generating...</> : <><HiOutlineDownload size={16} /> Export</>}
                </button>
              </div>
              <button onClick={openModal} className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-3.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/30">
                <HiOutlinePlus size={18} /> Log Income
              </button>
            </div>
          </div>
          
          <div className="relative z-30 grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineBriefcase size={14}/> Total Net Income Added</p>
              <p className="text-lg md:text-xl font-black text-white truncate">{currencySymbol}{(Number(globalSummary.totalIncomeBase) || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineCalendar size={12}/> Net This Month</p>
              <p className="text-lg md:text-xl font-black text-emerald-400 truncate">{currencySymbol}{(Number(globalSummary.monthTotals?.[getCurrentMonthKey()]) || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 col-span-2 md:col-span-1 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><FaChartLine size={12}/> Total Entries</p>
              <p className="text-lg md:text-xl font-black text-white truncate">{globalSummary.totalEntries || 0}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search by source or asset..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 shadow-sm" />
          </div>
          <div className="flex gap-2">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full sm:w-auto px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs sm:text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 cursor-pointer transition-all shadow-sm appearance-none">
              <option value="all">All Categories</option>
              {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* 🚀 COLLAPSIBLE MONTHS LEDGER */}
        {isLoadingLogs ? (
          <div className="p-8 text-center text-slate-500 animate-pulse">Loading Ledger...</div>
        ) : filteredLedger.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm px-4">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-5 shadow-inner"><HiOutlineBriefcase className="text-5xl text-slate-300 dark:text-slate-600" /></div>
            <p className="text-lg font-black text-slate-700 dark:text-slate-300">No income records found</p>
            <p className="text-sm font-medium text-slate-500 mt-2 text-center max-w-sm">{searchTerm || filterCategory !== 'all' ? 'Try adjusting your search or filters.' : 'Log your first income to get started tracking your earnings.'}</p>
          </div>
        ) : (
          <>
            {filteredLedger.map((month) => {
              const isOpen = openMonths.has(month.monthKey);
              const isExpanded = expandedMonths.has(month.monthKey);
              const THRESHOLD = 15;
              const hasMoreRecords = month.records.length > THRESHOLD;
              const hiddenCount = Math.max(0, month.records.length - THRESHOLD);
              const displayedRecords = isExpanded ? month.records : month.records.slice(0, THRESHOLD);

              return (
                <div key={month.monthKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm">
                  <button onClick={() => toggleMonth(month.monthKey)} className="w-full px-6 py-5 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left">
                    <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><HiOutlineCalendar size={18} /></div>
                      {month.monthName}
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Period Net Added</p>
                        <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">+{currencySymbol}{month.pageNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>
                      <HiOutlineChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="animate-in fade-in duration-200">
                      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-2 gap-4 bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800">
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Logs Shown</p><p className="font-black text-slate-700 dark:text-slate-300">{month.records.length}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Period Net Added</p><p className="font-black text-emerald-600">+{currencySymbol}{month.pageNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                      </div>

                      {/* 📱 MOBILE CARDS */}
                      <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                        {displayedRecords.map((rec) => {
                          const dateObj = new Date(rec.date);
                          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={rec.id} className={`p-4 ${rec.isSplit ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0 pr-2">
                                  <p className="font-black text-slate-900 dark:text-white text-sm break-words">{rec.title}</p>
                                  <span className="inline-block px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider rounded mt-1 border border-emerald-200 dark:border-emerald-500/20 shadow-sm break-words max-w-full">{rec.category}</span>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">+{currencySymbol}{(Number(rec.finalBaseAmount) || 0).toLocaleString(undefined, {minimumFractionDigits: 0})}</p>
                                  {rec.asset !== baseCurrency && !rec.isSplit && (<p className="text-[9px] font-bold text-slate-500 mt-1 break-words">{Number(rec.amount || 0).toLocaleString()} {rec.asset}</p>)}
                                  {rec.isSplit && <p className="text-[9px] font-bold text-slate-500 mt-1">Multiple Assets</p>}
                                  {rec.baseFee > 0 && <p className="text-[9px] font-bold text-rose-500 mt-0.5">Fee: -{currencySymbol}{Number(rec.baseFee).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>}
                                  {!rec.baseFee && rec.fee > 0 && <p className="text-[9px] font-bold text-rose-500 mt-0.5">Fee: -{Number(rec.fee).toLocaleString()} {rec.asset}</p>}
                                </div>
                              </div>

                              <div className="flex flex-wrap justify-between items-end gap-2 mt-3">
                                <div className="flex flex-col gap-1.5">
                                  <div className={`flex items-center gap-1.5 w-max px-2 py-1 rounded-md border text-[9px] font-bold shadow-sm ${rec.isSplit ? 'bg-amber-100/50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                    {rec.isSplit ? (<><FaRandom className="text-amber-600 dark:text-amber-500" /> Split Income</>) : (<>{getVaultIcon(rec.vault)} <span className="capitalize">{rec.vault}</span> {rec.subWallet && <span className="opacity-70 ml-0.5 break-words">· {rec.subWallet}</span>}</>)}
                                  </div>
                                  <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><HiOutlineCalendar size={10}/> {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]} <span className="opacity-50">· {timeStr}</span></p>
                                </div>

                                <div className="flex gap-1">
                                  {rec.linkedIncomeId && !rec.linkedIncomeId.startsWith('INC_') && (<span className="p-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md border border-amber-300 dark:border-amber-500/30 shadow-sm"><FaLock size={12} /></span>)}
                                  <button onClick={() => handleEdit(rec)} className="p-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-500/30 shadow-sm"><HiOutlinePencil size={14} /></button>
                                  <button onClick={() => initiateDelete(rec)} className="p-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-md border border-rose-200 dark:border-rose-500/30 shadow-sm"><HiOutlineTrash size={14} /></button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-4 text-center text-emerald-600 font-black text-sm uppercase tracking-widest">{isExpanded ? 'Show Less' : `View ${hiddenCount} more in ${month.monthName}`}</button>)}
                      </div>

                      {/* 💻 DESKTOP TABLE */}
                      <div className="hidden md:block overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left min-w-[900px]">
                          <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="p-4 pl-6 w-32">Date</th>
                              <th className="p-4">Source & Category</th>
                              <th className="p-4">Vault</th>
                              <th className="p-4 text-right">Native Amount</th>
                              <th className="p-4 text-right">Net Base Value</th>
                              <th className="p-4 pr-6 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {displayedRecords.map((rec) => {
                              const dateObj = new Date(rec.date);
                              const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                              return (
                                <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group ${rec.isSplit ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                                  <td className="p-4 pl-6 align-top">
                                    <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 mt-1">
                                      {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}
                                      <span className="opacity-50 mx-1 border-l border-slate-300 dark:border-slate-600 pl-2 text-[10px]">{timeStr}</span>
                                    </p>
                                  </td>
                                  <td className="p-4 align-top">
                                    <p className="font-black text-slate-900 dark:text-white text-sm mt-0.5 max-w-[200px] truncate" title={rec.title}>{rec.title}</p>
                                    <span className="inline-block px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider rounded mt-1.5 border border-emerald-200 dark:border-emerald-500/20 shadow-sm truncate max-w-[180px]">{rec.category}</span>
                                  </td>
                                  <td className="p-4 align-top">
                                    <div className={`flex items-center gap-2 mt-1 ${rec.isSplit ? 'bg-amber-100/50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-500/30 w-max shadow-sm' : ''}`}>
                                      {rec.isSplit ? (
                                        <><FaRandom className="text-amber-600 dark:text-amber-500" /> <span className="text-xs font-bold text-amber-800 dark:text-amber-400">Split Income</span></>
                                      ) : (
                                        <>{getVaultIcon(rec.vault)} <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{rec.vault}</span></>
                                      )}
                                      {!rec.isSplit && rec.subWallet && (
                                        <span className="text-[9px] text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold border border-slate-300 dark:border-slate-700 shadow-sm">{rec.subWallet}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4 text-right align-top">
                                    {rec.isSplit ? (
                                      <>
                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-1">Multiple</p>
                                        {rec.baseFee > 0 && <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-widest">Fee: -{currencySymbol}{(Number(rec.baseFee) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>}
                                      </>
                                    ) : (
                                      <>
                                        <p className="font-black text-slate-800 dark:text-slate-200 text-sm mt-1">{(Number(rec.amount) || 0).toLocaleString()} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold ml-0.5">{rec.asset}</span></p>
                                        {rec.fee > 0 && <p className="text-[9px] font-bold text-rose-500 mt-1 uppercase tracking-widest">Fee: -{(Number(rec.fee) || 0).toLocaleString()} {rec.asset}</p>}
                                        {rec.asset !== baseCurrency && <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Rate: {rec.exchangeRate}</p>}
                                      </>
                                    )}
                                  </td>
                                  <td className="p-4 text-right align-top">
                                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                                      +{currencySymbol}{(Number(rec.finalBaseAmount) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </p>
                                  </td>
                                  <td className="p-4 pr-6 align-top">
                                    <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                                      {rec.linkedIncomeId && !rec.linkedIncomeId.startsWith('INC_') && (
                                        <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[8px] font-black rounded border border-amber-300 dark:border-amber-500/30 shadow-sm mr-1"><FaLock className="inline mb-0.5 mr-0.5" />SYNCED</span>
                                      )}
                                      <button onClick={() => handleEdit(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/20 rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95"><HiOutlinePencil size={14} /></button>
                                      <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/20 rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95"><HiOutlineTrash size={14} /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {hasMoreRecords && (<button onClick={() => toggleExpandMonth(month.monthKey)} className="w-full py-3 text-center text-emerald-600 font-black text-sm uppercase tracking-widest">{isExpanded ? 'Show Less' : `View ${hiddenCount} more in ${month.monthName}`}</button>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {hasMore && (
              <div className="flex justify-center py-6">
                <button onClick={loadMore} disabled={isPaginating} className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95">
                  {isPaginating ? <HiOutlineRefresh className="animate-spin" size={18} /> : <><HiOutlineChevronDown size={18} /> Load Older Incomes</>}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 🚀 ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
            
            <div className={`px-6 sm:px-8 py-5 flex justify-between items-center sticky top-0 z-10 shrink-0 text-white ${formData.isSplit ? 'bg-gradient-to-r from-amber-600 to-orange-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
              <h3 className="text-lg sm:text-xl font-black flex items-center gap-2">
                {formData.isSplit ? <FaRandom size={20} /> : <HiOutlineBriefcase size={24} />} 
                {editingId ? 'Edit Income' : 'Log Income'}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors active:scale-90"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-4 sm:p-8 space-y-5 sm:space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              {formData.isSynced && (
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-4 rounded-xl text-xs font-bold leading-relaxed border border-amber-300 dark:border-amber-500/30 shadow-sm">
                  <p className="flex items-center gap-1.5 mb-1.5 font-black"><HiOutlineExclamationCircle size={16}/> Auto-Synced Entry</p>
                  This entry is linked to a system transaction. To maintain accuracy, you can only update the <span className="underline decoration-amber-400">Vault/Bank Name</span>.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Source / Title *</label>
                  <input 
                    disabled={formData.isSynced} type="text" required value={formData.title} 
                    onChange={(e) => setFormData({...formData, title: e.target.value})} 
                    placeholder="e.g., Monthly Salary"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 transition-colors shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <div className="relative">
                    <select 
                      disabled={formData.isSynced} value={formData.category} 
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 appearance-none cursor-pointer transition-colors shadow-sm"
                    >
                      {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>

              {!formData.isSynced && (
                <label className="flex justify-between items-center p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2"><FaRandom className="text-amber-500"/> Split Income</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-bold">Receive payment into multiple vaults simultaneously</p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0 ml-4">
                    <input type="checkbox" className="sr-only peer" checked={formData.isSplit} onChange={(e) => setFormData({...formData, isSplit: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                  </div>
                </label>
              )}

              {/* 🚀 SINGLE INCOME VIEW */}
              {!formData.isSplit ? (
                <div className="p-4 sm:p-6 bg-emerald-50/40 dark:bg-slate-800/80 rounded-[1.5rem] sm:rounded-[2rem] border border-emerald-200 dark:border-slate-700 shadow-sm space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Destination Vault</label>
                      <div className="relative">
                        <select 
                          value={formData.vault} 
                          onChange={(e) => {
                            const v = e.target.value;
                            const cList = availableCryptos.length > 0 ? availableCryptos : ['BTC'];
                            setFormData({
                              ...formData, vault: v, 
                              asset: v === 'crypto' ? cList[0] : baseCurrency, 
                              subWallet: '', exchangeRate: 1
                            });
                          }}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer transition-colors shadow-sm"
                        >
                          <option value="bank">Bank Account</option>
                          <option value="online">Online E-Wallet</option>
                          <option value="cash">Physical Cash</option>
                          <option value="crypto">Crypto Engine</option>
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                      </div>
                    </div>

                    {(formData.vault === 'bank' || formData.vault === 'online') && (
                      <div className="space-y-1.5 animate-in fade-in">
                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">
                          {formData.vault === 'bank' ? 'Bank Name *' : 'Wallet Name *'}
                        </label>
                        <input 
                          type="text" list="sub-wallets-inc" required value={formData.subWallet} 
                          onChange={(e) => setFormData({...formData, subWallet: e.target.value})} 
                          placeholder={formData.vault === 'bank' ? "e.g., SBI, Chase" : "e.g., PayPal, Skrill"}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm"
                        />
                        <datalist id="sub-wallets-inc">{existingBanks.map(b => <option key={b} value={b} />)}</datalist>
                      </div>
                    )}

                    {formData.vault === 'crypto' && (
                      <div className="space-y-1.5 animate-in fade-in">
                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Crypto Platform *</label>
                        <input 
                          type="text" list="crypto-platforms-list" required value={formData.cryptoPlatform} 
                          onChange={(e) => setFormData({...formData, cryptoPlatform: e.target.value})} 
                          placeholder="Platform Name (e.g. Binance)"
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm"
                        />
                        <datalist id="crypto-platforms-list">{existingCryptoPlatforms.map(p => <option key={p} value={p} />)}</datalist>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mt-4 sm:mt-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                      <div className="relative">
                        <select 
                          disabled={formData.isSynced} value={formData.asset} 
                          onChange={(e) => setFormData({...formData, asset: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 appearance-none cursor-pointer transition-colors shadow-sm"
                        >
                          {formData.vault === 'crypto' ? (
                            availableCryptos.map(a => <option key={a} value={a}>{a}</option>)
                          ) : (
                            <>
                              <option value={baseCurrency}>{baseCurrency} (Base)</option>
                              {availableFiats.filter(c => c !== baseCurrency).map(a => <option key={a} value={a}>{a}</option>)}
                            </>
                          )}
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between"><span>Gross ({formData.asset}) *</span></label>
                        <input 
                          disabled={formData.isSynced} type="number" step="any" required value={formData.amount} 
                          onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                          placeholder="0.00"
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 shadow-sm placeholder-emerald-300 dark:placeholder-slate-600 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between"><span>Fee (Opt)</span></label>
                        <input 
                          disabled={formData.isSynced} type="number" step="any" value={formData.fee} 
                          onChange={(e) => setFormData({...formData, fee: e.target.value})} 
                          placeholder="0.00"
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-rose-500 outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 shadow-sm placeholder-rose-300 dark:placeholder-slate-600 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {formData.asset !== baseCurrency && (
                    <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 shrink-0">
                        <FaExchangeAlt className="text-emerald-500" /> Exchange Rate:
                      </span>
                      <div className="flex items-center gap-2 flex-1 w-full">
                        <span className="text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">1 {formData.asset} =</span>
                        <input 
                          disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} 
                          onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} 
                          className="flex-1 w-full min-w-0 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none disabled:opacity-60 shadow-sm focus:ring-2 focus:ring-emerald-500/50 transition-colors text-center"
                        />
                        <span className="text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">{baseCurrency}</span>
                      </div>
                      <button 
                        type="button" onClick={()=>fetchLiveRate(null)} disabled={isFetchingRate === 'single' || formData.isSynced} 
                        className="w-full sm:w-auto bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-4 py-3 sm:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors shadow-sm shrink-0 active:scale-95"
                      >
                        <HiOutlineRefresh className={isFetchingRate === 'single' ? "animate-spin" : ""} size={14} /> Live Rate
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* 🚀 SPLIT INCOME VIEW */
                <div className="space-y-4 animate-in fade-in zoom-in-95">
                  {formData.splitSources.map((split, index) => (
                    <div key={index} className="p-4 sm:p-6 border-2 border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10 rounded-[1.5rem] sm:rounded-[2rem] space-y-4 sm:space-y-5 shadow-sm relative overflow-hidden group">
                      <div className="flex justify-between items-center relative z-10">
                        <span className="text-[10px] sm:text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-center shadow-sm">{index + 1}</span> Split Target
                        </span>
                        {formData.splitSources.length > 2 && (
                          <button type="button" onClick={() => removeSplitSource(index)} className="text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 p-2 rounded-xl border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-colors active:scale-90 shadow-sm"><HiOutlineTrash size={16}/></button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 relative z-10">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Vault</label>
                          <div className="relative">
                            <select value={split.vault} onChange={(e) => updateSplit(index, 'vault', e.target.value)} className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer transition-colors focus:ring-2 focus:ring-amber-500/50 appearance-none">
                              <option value="bank">Bank Account</option><option value="cash">Physical Cash</option><option value="online">Online Wallet</option><option value="crypto">Crypto Engine</option>
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                          </div>
                        </div>

                        {(split.vault === 'bank' || split.vault === 'online') && (
                          <div className="space-y-1.5 animate-in fade-in">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{split.vault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
                            <input type="text" list={`split-banks-${index}`} required value={split.subWallet} onChange={(e) => updateSplit(index, 'subWallet', e.target.value)} placeholder={split.vault === 'bank' ? "e.g. SBI" : "e.g. PayPal"} className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400 transition-colors focus:ring-2 focus:ring-amber-500/50" />
                          </div>
                        )}

                        {split.vault === 'crypto' && (
                          <div className="space-y-1.5 animate-in fade-in">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                            <input type="text" list="crypto-platforms-list" required value={split.cryptoPlatform} onChange={(e) => updateSplit(index, 'cryptoPlatform', e.target.value)} placeholder="e.g. Binance" className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400 transition-colors focus:ring-2 focus:ring-amber-500/50" />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:gap-4 relative z-10 mt-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                          <div className="relative">
                            <select value={split.asset} onChange={(e) => { updateSplit(index, 'asset', e.target.value); updateSplit(index, 'exchangeRate', 1); }} className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer transition-colors focus:ring-2 focus:ring-amber-500/50 appearance-none">
                              {split.vault === 'crypto' ? availableCryptos.map(c => <option key={c} value={c}>{c}</option>) : [baseCurrency, ...availableFiats.filter(c => c !== baseCurrency)].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Gross</label>
                            <input type="number" step="any" required value={split.amount} onChange={(e) => updateSplit(index, 'amount', e.target.value)} placeholder="0.00" className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-black text-amber-700 dark:text-amber-500 outline-none shadow-sm placeholder-amber-300 transition-colors focus:ring-2 focus:ring-amber-500/50 text-sm sm:text-lg" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Fee</label>
                            <input type="number" step="any" value={split.fee} onChange={(e) => updateSplit(index, 'fee', e.target.value)} placeholder="0.00" className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-black text-rose-500 outline-none shadow-sm placeholder-rose-300 transition-colors focus:ring-2 focus:ring-rose-500/50 text-sm sm:text-lg" />
                          </div>
                        </div>
                      </div>
                      
                      {split.asset !== baseCurrency && (
                        <div className="p-3 sm:p-4 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/50 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm relative z-10 animate-in fade-in">
                          <span className="text-[10px] sm:text-xs font-black text-slate-700 dark:text-slate-400 flex items-center gap-2 shrink-0"><FaExchangeAlt className="text-amber-500"/> Rate:</span>
                          <div className="flex items-center gap-2 flex-1 w-full">
                            <span className="text-[10px] sm:text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">1 {split.asset} =</span>
                            <input type="number" step="any" required value={split.exchangeRate} onChange={(e) => updateSplit(index, 'exchangeRate', e.target.value)} className="flex-1 w-full min-w-0 p-2 sm:p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white outline-none shadow-sm focus:ring-2 focus:ring-amber-500/50 transition-colors text-center" />
                            <span className="text-[10px] sm:text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">{baseCurrency}</span>
                          </div>
                          <button type="button" onClick={()=>fetchLiveRate(index)} disabled={isFetchingRate === index} className="w-full md:w-auto text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-white px-3 py-2.5 sm:py-2 rounded-lg flex items-center justify-center gap-1 uppercase tracking-widest transition-colors shadow-sm shrink-0 active:scale-95"><HiOutlineRefresh className={isFetchingRate === index ? "animate-spin" : ""} size={14}/> Live Rate</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addSplitSource} className="w-full py-3.5 sm:py-4 border-2 border-dashed border-amber-300 dark:border-amber-700/50 text-amber-600 dark:text-amber-500 rounded-[2rem] font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-sm"><HiOutlinePlus size={18}/> Add Payment Target</button>
                </div>
              )}

              {/* SUMMARY SECTION */}
              <div className="p-4 sm:p-5 bg-slate-100 dark:bg-slate-800/80 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-inner mt-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-5">
                  <div className="w-full sm:w-1/2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Date & Time *</label>
                    <input 
                      disabled={formData.isSynced} type="datetime-local" required value={formData.date} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="block w-full mt-1.5 p-3.5 sm:p-4 bg-white dark:bg-slate-900 font-bold text-sm text-slate-900 dark:text-white outline-none cursor-pointer disabled:opacity-60 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 rounded-xl"
                    />
                    <p className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 ml-1 font-bold">{formatGlobalDate ? formatGlobalDate(formData.date, 'full') : ''}</p>
                  </div>
                  
                  <div className="text-left sm:text-right w-full sm:w-auto sm:border-l border-slate-300 dark:border-slate-700 sm:pl-6">
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Net Added</p>
                    <p className="text-2xl sm:text-3xl md:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-1 truncate">
                      +{currencySymbol}{(formData.isSplit ? getSplitTotalBase() : finalBaseAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                    {(!formData.isSplit && parseFloat(formData.fee) > 0) && (
                      <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-widest">Fee Deducted: {parseFloat(formData.fee)} {formData.asset}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-4 z-10">
                <button 
                  type="submit" disabled={isSaving} 
                  className={`w-full p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] font-black text-sm sm:text-base uppercase tracking-widest text-white transition-all shadow-xl flex items-center justify-center gap-2 shrink-0 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} ${formData.isSplit ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/30' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/30'}`}
                >
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : <HiOutlineBriefcase size={20} />}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Ledger' : 'Save Income')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 Delete Confirmation Modal */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border border-rose-200 dark:border-rose-900/50 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                  <HiOutlineShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">Security Verification</h3>
                  <p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest">Permanent Deletion</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={executeSecureDelete} className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-2xl shadow-sm">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed">
                  You are deleting <span className="font-black">"{deleteContext.title}"</span> worth 
                  <span className="font-black"> {currencySymbol}{deleteContext.finalBaseAmount?.toLocaleString()}</span>
                </p>
                {deleteContext.linkedIncomeId && !deleteContext.linkedIncomeId.startsWith('INC_') && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-2 font-bold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-200 dark:border-rose-800/50">
                    <HiOutlineExclamationCircle size={14} className="shrink-0"/> Auto-synced entry - deletion will automatically reverse vault balances.
                  </p>
                )}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 text-center block">Security PIN</label>
                <input 
                  type="password" maxLength={6} required autoFocus
                  value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.4em] text-2xl p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm focus:border-rose-500"
                  placeholder="••••"
                />
                {pinError && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-2 text-center animate-bounce">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95 uppercase tracking-widest">
                  Cancel
                </button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-lg shadow-rose-500/30 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : <HiOutlineTrash size={18} />}
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ EXPORT MODAL (Mobile Bottom Sheet Friendly) */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center">
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

    </div>
  );
};

export default IncomeStreamsContent;