import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineLockClosed, 
  HiOutlineChevronDown, HiOutlineSwitchHorizontal,
  HiOutlineExclamationCircle, HiOutlineDownload, 
  HiOutlineDocumentText, HiOutlineTable, HiOutlineShieldCheck
} from 'react-icons/hi';
import { FaExchangeAlt, FaRoute, FaGhost, FaBuilding, FaWallet } from 'react-icons/fa';

const fetchWithRetry = async (url, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status !== 429) return res;
      if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch (e) {
      if (i === retries) return null;
    }
  }
  return null; 
};

const LogoRenderer = ({ symbol, logoUrl, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => { setHasError(false); }, [logoUrl]);
  if (!logoUrl || hasError) return <span className={`w-full h-full flex items-center justify-center font-black text-[10px] sm:text-[11px] ${bg || 'bg-slate-200 dark:bg-slate-700'} ${color || 'text-slate-500'} rounded-full`}>{symbol?.toUpperCase()?.substring(0, 3)}</span>;
  return <img src={logoUrl} alt={symbol} className="w-full h-full object-contain p-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm" onError={() => setHasError(true)} />;
};

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const getLocalISOString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
};

const SwapAndBridge = () => {
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [records, setRecords] = useState([]);
  const [walletHoldings, setWalletHoldings] = useState({}); // 🚀 State for Live Balances
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  const [customUserCoins, setCustomUserCoins] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [existingPlatforms, setExistingPlatforms] = useState([]);

  const localTimeStr = getLocalISOString();

  const cryptoSymbols = useMemo(() => selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean), [selectedCryptos]);
  const activeCryptos = cryptoSymbols.length > 0 ? cryptoSymbols : ['BTC', 'USDT', 'TRX', 'LTC'];

  const [formData, setFormData] = useState({
    actionType: 'swap', platform: '', fromCoin: activeCryptos[0], fromAmount: '', toCoin: 'USDT', toAmount: '',
    fromPlatform: '', toPlatform: '', bridgeCoin: activeCryptos[0], bridgeSentAmount: '', bridgeReceivedAmount: '',
    datetime: localTimeStr, linkedId: ''
  });

  // 🚀 FETCH SWAP LOGS AND CRYPTO WALLET LOGS FOR AUTO-FILL
  useEffect(() => {
    if (!user) return;
    
    const qSB = query(collection(db, "users", user.uid, "swapBridgeLogs"), orderBy("timestamp", "desc"));
    const unsubscribeSB = onSnapshot(qSB, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    const qVault = query(collection(db, "users", user.uid, "cryptoWalletLogs"), orderBy("timestamp", "desc"));
    const unsubscribeVault = onSnapshot(qVault, (snapshot) => {
       const vaultData = {};
       const platforms = new Set();
       snapshot.docs.forEach(doc => {
          const t = doc.data();
          if (t.platform) platforms.add(t.platform);
          if (t.fromPlatform) platforms.add(t.fromPlatform);
          if (t.toPlatform) platforms.add(t.toPlatform);

          if (!vaultData[t.coin]) vaultData[t.coin] = { platforms: {} };
          const qty = parseFloat(t.quantity) || 0;
          const fee = parseFloat(t.networkFee) || 0;
          
          if (t.type === 'in') { vaultData[t.coin].platforms[t.platform] = (vaultData[t.coin].platforms[t.platform] || 0) + qty; }
          else if (t.type === 'out') { vaultData[t.coin].platforms[t.platform] = (vaultData[t.coin].platforms[t.platform] || 0) - qty; }
          else if (t.type === 'transfer') { 
             vaultData[t.coin].platforms[t.fromPlatform] = (vaultData[t.coin].platforms[t.fromPlatform] || 0) - qty; 
             vaultData[t.coin].platforms[t.toPlatform] = (vaultData[t.coin].platforms[t.toPlatform] || 0) + (qty - fee); 
          }
       });
       setWalletHoldings(vaultData);
       setExistingPlatforms(Array.from(platforms));
    });

    return () => { unsubscribeSB(); unsubscribeVault(); };
  }, [user]);

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

  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const fiatRes = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD');
        let userBaseRate = 1;
        if (fiatRes && fiatRes.ok) userBaseRate = (await fiatRes.json()).rates[baseCurrency] || 1;
        setFiatRate(userBaseRate);

        const coinsToFetch = Array.from(new Set([...activeCryptos, 'USDT', formData.fromCoin, formData.toCoin, formData.bridgeCoin])).filter(Boolean);
        if (coinsToFetch.length === 0) return;

        let cgJson = {};
        let geckoTerminalData = {};
        const normalCoins = [];
        const contractCoins = [];

        coinsToFetch.forEach(sym => {
           const dbCoin = fullDatabase.find(c => c.symbol === sym.toUpperCase());
           if (dbCoin?.fetchMode === 'contract' && dbCoin.network && dbCoin.contractAddress) contractCoins.push(dbCoin);
           else normalCoins.push(dbCoin?.id || sym.toLowerCase());
        });

        if (normalCoins.length > 0) {
           try {
             const cgRes = await fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${[...new Set(normalCoins)].join(',')}&vs_currencies=usd`);
             if (cgRes && cgRes.ok) cgJson = await cgRes.json();
           } catch(e) {}
        }

        for (const customCoin of contractCoins) {
           try {
              const gtRes = await fetchWithRetry(`https://api.geckoterminal.com/api/v2/networks/${customCoin.network}/tokens/${customCoin.contractAddress}`);
              if (gtRes && gtRes.ok) {
                 const gtJson = await gtRes.json();
                 geckoTerminalData[customCoin.id] = { usd: parseFloat(gtJson.data.attributes.price_usd) };
              } else {
                 const dexRes = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${customCoin.contractAddress}`);
                 if(dexRes && dexRes.ok) {
                    const dexData = await dexRes.json();
                    if(dexData.pairs?.length > 0) geckoTerminalData[customCoin.id] = { usd: parseFloat(dexData.pairs[0].priceUsd) };
                 }
              }
           } catch (error) {}
        }
        
        const priceMap = {};
        
        await Promise.all(coinsToFetch.map(async (sym) => {
          const upperSym = sym.toUpperCase();
          const dbCoin = fullDatabase.find(c => c.symbol === upperSym) || {};
          const searchId = dbCoin.id || sym.toLowerCase();
          let priceUsd = dbCoin.fetchMode === 'contract' ? geckoTerminalData[searchId]?.usd : cgJson[searchId]?.usd;

          if (!priceUsd) {
            try {
               const bSym = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
               const bRes = await fetchWithRetry(`https://api.binance.com/api/v3/ticker/price?symbol=${bSym}`);
               if (bRes && bRes.ok) {
                  const bData = await bRes.json();
                  priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
               }
            } catch(e) {}
          }

          if (!priceUsd && dbCoin.fallbackPrice) priceUsd = dbCoin.fallbackPrice;
          if(priceUsd) priceMap[upperSym] = priceUsd;
        }));

        setLivePrices(priceMap);
      } catch (error) {}
    };
    
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000);
    return () => clearInterval(interval);
  }, [activeCryptos, baseCurrency, formData.fromCoin, formData.toCoin, formData.bridgeCoin, fullDatabase]);

  const getLivePrice = (symbol) => {
    if (livePrices[symbol]) return livePrices[symbol] * fiatRate; 
    const dbCoin = fullDatabase.find(c => c.symbol === symbol.toUpperCase());
    return (dbCoin?.fallbackPrice || 0) * fiatRate;
  };

  const analytics = useMemo(() => {
    let totalVolume = 0;
    let totalFeesLost = 0;
    records.forEach(t => {
      totalVolume += (t.baseVolume || 0);
      totalFeesLost += (t.hiddenFeeBase || 0);
    });
    return { totalVolume, totalFeesLost };
  }, [records]);

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
  }, [formData, livePrices, fiatRate]);

  // 🚀 CALCULATE AVAILABLE BALANCE DYNAMICALLY FOR FORM
  const getAvailableBalance = () => {
    let coin, platform;
    if (formData.actionType === 'swap') {
      coin = formData.fromCoin;
      platform = formData.platform;
    } else {
      coin = formData.bridgeCoin;
      platform = formData.fromPlatform;
    }
    if (!coin || !platform) return 0;
    const val = walletHoldings[coin]?.platforms[platform];
    return val > 0.00000001 ? val : 0;
  };
  const currentFormBalance = getAvailableBalance();

  const filteredLogs = records.filter(t => 
    t.fromCoin?.toLowerCase().includes(searchTerm.toLowerCase()) || t.toCoin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.bridgeCoin?.toLowerCase().includes(searchTerm.toLowerCase()) || t.platform?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.fromPlatform?.toLowerCase().includes(searchTerm.toLowerCase()) || t.toPlatform?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🚀 FIXED: Math-mapped export engine for proper Excel summing based on filtered data
  const handleDownloadReport = (format) => {
    setIsExportMenuOpen(false);
    if (filteredLogs.length === 0) return alert("No swap/bridge records found based on your search.");
    
    const reportData = filteredLogs.map(rec => {
      let actionLabel = rec.actionType === 'swap' ? 'Coin Swap' : 'Bridge / Transfer';
      let fromLabel = rec.actionType === 'swap' ? `${rec.fromAmount} ${rec.fromCoin} (via ${rec.platform})` : `${rec.bridgeSentAmount} ${rec.bridgeCoin} (from ${rec.fromPlatform})`;
      let toLabel = rec.actionType === 'swap' ? `${rec.toAmount} ${rec.toCoin}` : `${rec.bridgeReceivedAmount} ${rec.bridgeCoin} (to ${rec.toPlatform})`;
      let isProfit = rec.hiddenFeeBase <= 0;

      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date.split('T')[0],
        type: actionLabel, 
        fromDetails: fromLabel, 
        toDetails: toLabel, 
        pnlType: isProfit ? 'Profit (In)' : 'Fee (Out)',
        pnlBase: Number(Math.abs(rec.hiddenFeeBase || 0).toFixed(2)) // Numeric for Math calculations
      };
    });

    const columns = [
      { header: 'Date', key: 'date' }, 
      { header: 'Action Type', key: 'type' }, 
      { header: 'Source / Deducted', key: 'fromDetails' },
      { header: 'Destination / Received', key: 'toDetails' }, 
      { header: 'P&L Type', key: 'pnlType' },
      { header: `P&L Impact (${currencySymbol})`, key: 'pnlBase', isNumeric: true }
    ];

    const fileName = `Swap_Bridge_Tracker`;
    const reportTitle = `Crypto Swap & Bridge - Full Activity Log`;

    if (format === 'pdf') downloadPDFReport(reportData, columns, fileName, reportTitle);
    else downloadExcelReport(reportData, columns, fileName, reportTitle);
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault(); if (!user) return; setIsSaving(true);

    const timestamp = editingId ? records.find(r => r.id === editingId)?.timestamp : new Date(formData.datetime).getTime();
    const formattedDate = new Date(formData.datetime).toISOString().split('T')[0];
    const uniqueId = formData.linkedId || `SB_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    let masterRecord = { actionType: formData.actionType, date: formattedDate, datetime: formData.datetime, timestamp, linkedId: uniqueId };
    let cryptoWalletSyncData = [];
    let incomeSyncData = null;
    let expenseSyncData = null;

    if (formData.actionType === 'swap') {
      if(!formData.platform.trim()) { alert("Please enter platform."); setIsSaving(false); return; }
      const fQty = parseFloat(formData.fromAmount); const tQty = parseFloat(formData.toAmount);
      if (fQty <= 0 || tQty <= 0) { alert("Amounts must be > 0"); setIsSaving(false); return; }

      const fromVal = fQty * getLivePrice(formData.fromCoin);
      const toVal = tQty * getLivePrice(formData.toCoin);
      const diff = fromVal - toVal; 

      masterRecord = { ...masterRecord, platform: formData.platform.trim(), fromCoin: formData.fromCoin, fromAmount: fQty, toCoin: formData.toCoin, toAmount: tQty, baseVolume: fromVal, hiddenFeeBase: Math.max(0, diff) };
      cryptoWalletSyncData.push({ type: 'out', coin: formData.fromCoin, quantity: fQty, platform: formData.platform.trim(), reason: `Swapped to ${formData.toCoin}`, referenceNo: uniqueId, date: formattedDate, timestamp, linkedRecordId: uniqueId });
      cryptoWalletSyncData.push({ type: 'in', coin: formData.toCoin, quantity: tQty, platform: formData.platform.trim(), reason: `Swapped from ${formData.fromCoin}`, referenceNo: uniqueId, date: formattedDate, timestamp, linkedRecordId: uniqueId });

      if (diff > 0) expenseSyncData = { title: `Swap Spread Fee (${formData.fromCoin} to ${formData.toCoin})`, category: 'Bank & Transaction Fees', amount: diff, currency: baseCurrency, finalBaseAmount: diff, date: formattedDate, timestamp, linkedExpenseId: uniqueId, isVirtualCrypto: true, vault: 'crypto' };
      else if (diff < 0) incomeSyncData = { title: `Arbitrage Profit (${formData.fromCoin} to ${formData.toCoin})`, category: 'Crypto APR / Yield', asset: baseCurrency, amount: Math.abs(diff), exchangeRate: 1, finalBaseAmount: Math.abs(diff), date: formattedDate, timestamp, linkedIncomeId: uniqueId, isVirtualCrypto: true, vault: 'crypto' };
    } else {
      if(!formData.fromPlatform.trim() || !formData.toPlatform.trim()) { alert("Please enter both platforms."); setIsSaving(false); return; }
      const sQty = parseFloat(formData.bridgeSentAmount); const rQty = parseFloat(formData.bridgeReceivedAmount);
      if (sQty <= 0 || rQty <= 0) { alert("Amounts must be > 0"); setIsSaving(false); return; }

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
      } else { await addDoc(collection(db, "users", user.uid, "swapBridgeLogs"), masterRecord); }
      
      for (const data of cryptoWalletSyncData) await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), data);
      if (incomeSyncData) await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeSyncData);
      if (expenseSyncData) await addDoc(collection(db, "users", user.uid, "expenseLogs"), expenseSyncData);

      closeModal();
    } catch (error) { alert("Failed to save."); } finally { setIsSaving(false); }
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault(); if (!pinInput.trim()) return setPinError("Enter PIN."); setIsVerifying(true);
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin; 
      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) { setPinError("Incorrect PIN."); setIsVerifying(false); return; }
      
      await deleteDoc(doc(db, "users", user.uid, "swapBridgeLogs", deleteContext.id));
      for (const col of ["cryptoWalletLogs", "incomeLogs", "expenseLogs"]) {
        const field = col === "incomeLogs" ? "linkedIncomeId" : col === "expenseLogs" ? "linkedExpenseId" : "linkedRecordId";
        const q = query(collection(db, "users", user.uid, col), where(field, "==", deleteContext.linkedId));
        const snap = await getDocs(q);
        snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, col, d.id)));
      }
      setDeleteContext(null); 
    } catch (error) { setPinError("Error."); } finally { setIsVerifying(false); }
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

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); setFormData(prev => ({ ...prev, fromAmount: '', toAmount: '', bridgeSentAmount: '', bridgeReceivedAmount: '', linkedId: '', datetime: getLocalISOString() })); };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-700/50 backdrop-blur-sm z-20">
        <div className="absolute right-[-5%] top-[-20%] opacity-[0.03] text-white blur-[2px] pointer-events-none"><FaExchangeAlt size={250}/></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none" />
        
        <div className="relative z-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400 rounded-2xl flex items-center justify-center shadow-[inset_0_0_20px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/30">
              <HiOutlineSwitchHorizontal size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Swap & Bridge Tracker</h1>
              <p className="text-sm font-semibold text-slate-400 max-w-xl">Convert dust coins or bridge networks. Auto-syncs P&L directly.</p>
            </div>
          </div>
        </div>
        
        <div className="relative z-50 flex items-center gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0">
          {/* 🚀 EXPORT MENU FIX: High Z-Index, Mobile Responsive */}
          <div className="relative w-full sm:w-auto z-50">
            <button 
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 shadow-sm"
            >
              <HiOutlineDownload size={16}/> <span className="hidden md:inline">Export</span>
            </button>
            {isExportMenuOpen && (
              <div className="absolute top-[110%] right-0 md:left-0 w-full md:w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl flex flex-col p-1.5 z-[100] animate-in fade-in zoom-in-95">
                <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg transition-colors"><HiOutlineDocumentText className="text-rose-400" size={16}/> PDF Report</button>
                <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg transition-colors"><HiOutlineTable className="text-emerald-400" size={16}/> Excel (CSV)</button>
              </div>
            )}
          </div>
          
          <button onClick={() => setIsModalOpen(true)} className="flex-1 md:flex-none w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-5 py-3.5 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shadow-lg shadow-blue-500/25 whitespace-nowrap">
            <HiOutlinePlus size={20} className="hidden sm:inline" /> Action
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
        <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute right-[-10%] top-[-10%] opacity-[0.03] dark:opacity-5 text-slate-900 dark:text-white"><FaExchangeAlt size={150}/></div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Volume Moved</p>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-white tracking-tight relative z-10 truncate" title={`${currencySymbol}${analytics.totalVolume.toLocaleString()}`}>{currencySymbol}{analytics.totalVolume.toLocaleString(undefined, {maximumFractionDigits: 0})}</h2>
        </div>
        
        <div className="p-6 sm:p-8 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-900/10 rounded-[2rem] shadow-sm border border-rose-200 dark:border-rose-800/50 md:col-span-2 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute right-0 top-0 opacity-10 text-rose-500 -mt-8 -mr-8"><FaGhost size={180}/></div>
          <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 relative z-10 flex items-center gap-2">
            <HiOutlineExclamationCircle size={16}/> Total Loss to Hidden Fees & Spreads
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-rose-600 dark:text-rose-400 tracking-tighter relative z-10 truncate" title={`${currencySymbol}${analytics.totalFeesLost.toLocaleString()}`}>
            -{currencySymbol}{analytics.totalFeesLost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </h2>
        </div>
      </div>

      <div className="relative mt-8">
        <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
        <input type="text" placeholder="Search by coin or platform..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500 transition-colors shadow-sm placeholder-slate-400" />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Activity Log</h2>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="p-4 pl-6 whitespace-nowrap">Type & Date</th>
                <th className="p-4 whitespace-nowrap">From (Source)</th>
                <th className="p-4 whitespace-nowrap">To (Destination)</th>
                <th className="p-4 text-right whitespace-nowrap">Accounting Action</th>
                <th className="p-4 pr-6 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredLogs.map((rec) => {
                const fromCoinObj = fullDatabase.find(c => c.symbol === (rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin).toUpperCase());
                const toCoinObj = fullDatabase.find(c => c.symbol === (rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin).toUpperCase());

                return (
                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${rec.actionType === 'swap' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'}`}>
                         {rec.actionType === 'swap' ? <FaExchangeAlt /> : <FaRoute />}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-black text-sm uppercase tracking-widest truncate ${rec.actionType === 'swap' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>
                          {rec.actionType === 'swap' ? 'Coin Swap' : 'Bridge / Transfer'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 truncate">
                          {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                        </p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full shadow-inner bg-slate-100 dark:bg-slate-800 shrink-0">
                          <LogoRenderer symbol={rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin} logoUrl={fromCoinObj?.logo} bg={fromCoinObj?.bg} color={fromCoinObj?.color} />
                       </div>
                       <div className="min-w-0">
                         {rec.actionType === 'swap' ? (
                           <>
                             <p className="font-black text-slate-800 dark:text-white text-sm truncate">{rec.fromAmount} <span className="text-[10px] text-slate-500 uppercase">{rec.fromCoin}</span></p>
                             <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase flex items-center gap-1 truncate"><FaBuilding className="shrink-0"/> {rec.platform}</p>
                           </>
                         ) : (
                           <>
                             <p className="font-black text-slate-800 dark:text-white text-sm truncate">{rec.bridgeSentAmount} <span className="text-[10px] text-slate-500 uppercase">{rec.bridgeCoin}</span></p>
                             <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase flex items-center gap-1 truncate"><FaWallet className="shrink-0"/> {rec.fromPlatform}</p>
                           </>
                         )}
                       </div>
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full shadow-inner bg-slate-100 dark:bg-slate-800 shrink-0">
                          <LogoRenderer symbol={rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin} logoUrl={toCoinObj?.logo} bg={toCoinObj?.bg} color={toCoinObj?.color} />
                       </div>
                       <div className="min-w-0">
                         {rec.actionType === 'swap' ? (
                           <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm truncate">+{rec.toAmount} <span className="text-[10px] text-slate-500 uppercase">{rec.toCoin}</span></p>
                         ) : (
                           <>
                             <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm truncate">+{rec.bridgeReceivedAmount} <span className="text-[10px] text-slate-500 uppercase">{rec.bridgeCoin}</span></p>
                             <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase flex items-center gap-1 truncate"><FaWallet className="shrink-0"/> {rec.toPlatform}</p>
                           </>
                         )}
                       </div>
                    </div>
                  </td>

                  <td className="p-4 text-right">
                    {rec.hiddenFeeBase === 0 ? (
                       <div className="flex flex-col items-end">
                         <p className="text-sm font-black text-emerald-500 tracking-tight">Profit Synced</p>
                         <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">To Income Streams</p>
                       </div>
                    ) : (
                       <div className="flex flex-col items-end">
                         <p className="text-sm font-black text-rose-500 tracking-tight">
                           -{currencySymbol}{(rec.hiddenFeeBase || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                         </p>
                         <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                           Logged to Expenses
                         </p>
                       </div>
                    )}
                  </td>

                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/20 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700 active:scale-95"><HiOutlinePencil size={16} /></button>
                      <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/20 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700 active:scale-95"><HiOutlineTrash size={16} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500 font-bold">No swaps or transfers logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[60px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-4rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
            
            <div className="px-6 sm:px-8 py-5 flex justify-between items-center transition-colors duration-300 bg-gradient-to-r from-blue-600 to-cyan-600 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineSwitchHorizontal size={24}/> {editingId ? 'Edit Record' : 'Execute Action'}</h3>
              <button type="button" onClick={closeModal} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm">
                <button type="button" onClick={() => setFormData({...formData, actionType: 'swap'})} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-1 sm:gap-2 ${formData.actionType === 'swap' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><FaExchangeAlt/> Swap Coins</button>
                <button type="button" onClick={() => setFormData({...formData, actionType: 'bridge'})} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-1 sm:gap-2 ${formData.actionType === 'bridge' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><FaRoute/> Transfer</button>
              </div>

              {formData.actionType === 'swap' ? (
                <div className="space-y-6 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform (Where did you swap?)</label>
                    <div className="relative">
                      <input type="text" list="platform-suggestions" required value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})} placeholder="e.g. Binance, Phantom" className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm placeholder-slate-400" />
                      <datalist id="platform-suggestions">
                        {existingPlatforms.map(p => <option key={`sp-${p}`} value={p} />)}
                      </datalist>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* 🚀 AUTO-FILL BALANCE BADGE (SWAP) */}
                  {currentFormBalance > 0 && (
                    <div 
                      onClick={() => setFormData(prev => ({...prev, fromAmount: currentFormBalance}))}
                      className="p-3.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-all shadow-sm active:scale-[0.98] -mt-2"
                    >
                       <div className="flex items-center gap-2">
                         <FaWallet className="text-emerald-500" size={14}/>
                         <div>
                           <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Available in {formData.platform || 'Vault'}</p>
                           <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5">Tap to auto-fill amount</p>
                         </div>
                       </div>
                       <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                         {currentFormBalance % 1 !== 0 ? currentFormBalance.toFixed(6).replace(/\.?0+$/, '') : currentFormBalance} <span className="text-[10px] uppercase opacity-70">{formData.fromCoin}</span>
                       </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">You Gave (Asset)</label>
                      <div className="relative">
                        <select value={formData.fromCoin} onChange={(e) => setFormData({...formData, fromCoin: e.target.value})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none appearance-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm cursor-pointer">
                          {cryptoSymbols.map(c => <option key={`f-${c}`} value={c}>{c}</option>)}
                        </select>
                        <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <input type="number" step="any" required value={formData.fromAmount} onChange={(e) => setFormData({...formData, fromAmount: e.target.value})} placeholder="Amount Given" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm placeholder-slate-400" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">You Received</label>
                      <div className="relative">
                        <select value={formData.toCoin} onChange={(e) => setFormData({...formData, toCoin: e.target.value})} className="w-full pl-4 pr-10 py-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-300 dark:border-emerald-800/50 rounded-xl font-black text-emerald-600 dark:text-emerald-400 outline-none appearance-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm cursor-pointer">
                          {cryptoSymbols.concat(['USDT']).map(c => <option key={`t-${c}`} value={c}>{c}</option>)}
                        </select>
                        <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                      </div>
                      <input type="number" step="any" required value={formData.toAmount} onChange={(e) => setFormData({...formData, toAmount: e.target.value})} placeholder="Amount Received" className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-300 dark:border-emerald-800/50 rounded-xl font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm placeholder-emerald-300 dark:placeholder-emerald-800" />
                    </div>
                  </div>

                  {formData.fromAmount && formData.toAmount && (
                    <div className={`p-4 rounded-xl border flex justify-between items-center shadow-sm ${liveFormFee.isLoss ? 'bg-rose-50 border-rose-300 dark:bg-rose-900/10 dark:border-rose-900/50' : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/10 dark:border-emerald-900/50'}`}>
                      <div className="min-w-0 pr-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Analysis (Live)</p>
                        <p className={`text-sm font-black truncate ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {liveFormFee.isLoss ? 'Hidden Spread Fee Detected' : 'Profitable Arbitrage Swap'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-lg font-black tracking-tight ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {liveFormFee.isLoss ? '-' : '+'}{currencySymbol}{Math.abs(liveFormFee.fee).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                        <p className={`text-[10px] font-bold opacity-70 ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>≈ {liveFormFee.feePct.toFixed(2)}% {liveFormFee.isLoss ? 'Loss' : 'Profit'}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset to Transfer</label>
                    <div className="flex gap-3">
                      <div className="w-1/3 relative shrink-0">
                         <select value={formData.bridgeCoin} onChange={(e) => setFormData({...formData, bridgeCoin: e.target.value})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none appearance-none focus:ring-2 focus:ring-purple-500/50 transition-colors shadow-sm cursor-pointer">
                           {cryptoSymbols.map(c => <option key={`b-${c}`} value={c}>{c}</option>)}
                         </select>
                         <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <div className="flex-1 text-right pt-2 px-2 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Moving crypto burns gas fees. Track exactly how much network fee you paid.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 flex flex-col">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">From Wallet</label>
                      <div className="relative">
                         <input type="text" list="platform-suggestions" required value={formData.fromPlatform} onChange={(e) => setFormData({...formData, fromPlatform: e.target.value})} placeholder="e.g., Binance" className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm placeholder-slate-400" />
                         <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>

                      {/* 🚀 AUTO-FILL BALANCE BADGE (BRIDGE) */}
                      {currentFormBalance > 0 && (
                        <div 
                          onClick={() => setFormData(prev => ({...prev, bridgeSentAmount: currentFormBalance}))}
                          className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-lg flex items-center justify-between cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-all shadow-sm active:scale-[0.98]"
                        >
                           <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><FaWallet size={10}/> Available</span>
                           <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">{currentFormBalance % 1 !== 0 ? currentFormBalance.toFixed(6).replace(/\.?0+$/, '') : currentFormBalance}</span>
                        </div>
                      )}

                      <input type="number" step="any" required value={formData.bridgeSentAmount} onChange={(e) => setFormData({...formData, bridgeSentAmount: e.target.value})} placeholder="Amount Sent" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors shadow-sm placeholder-slate-400 mt-auto" />
                    </div>

                    <div className="space-y-2 flex flex-col justify-end">
                      <label className="text-[11px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">To Destination</label>
                      <div className="relative">
                         <input type="text" list="platform-suggestions" required value={formData.toPlatform} onChange={(e) => setFormData({...formData, toPlatform: e.target.value})} placeholder="e.g., Trust Wallet" className="w-full pl-4 pr-10 py-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-300 dark:border-purple-800/50 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors shadow-sm placeholder-purple-300 dark:placeholder-purple-700" />
                         <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                      </div>
                      <input type="number" step="any" required value={formData.bridgeReceivedAmount} onChange={(e) => setFormData({...formData, bridgeReceivedAmount: e.target.value})} placeholder="Amount Received" className="w-full p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-300 dark:border-purple-800/50 rounded-xl font-bold text-purple-600 dark:text-purple-400 outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors shadow-sm placeholder-purple-300 dark:placeholder-purple-700 mt-auto" />
                    </div>
                  </div>

                  {formData.bridgeSentAmount && formData.bridgeReceivedAmount && (
                    <div className={`p-4 rounded-xl border flex justify-between items-center shadow-sm ${liveFormFee.isLoss ? 'bg-rose-50 border-rose-300 dark:bg-rose-900/10 dark:border-rose-900/50' : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/10 dark:border-emerald-900/50'}`}>
                      <div className="min-w-0 pr-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Network Gas Fee</p>
                        <p className={`text-sm font-black truncate ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {liveFormFee.feeCoins.toFixed(6)} <span className="text-[10px]">{formData.bridgeCoin}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-lg font-black tracking-tight ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          -{currencySymbol}{Math.abs(liveFormFee.feeBase).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                        <p className={`text-[10px] font-bold opacity-70 ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>Loss in Fiat</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 🚀 GLOBAL DATETIME FOR INPUT */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between ml-1">
                  <span>Date & Time</span>
                  <span className="text-blue-500">{formatGlobalDate && formData.datetime ? formatGlobalDate(formData.datetime.split('T')[0], 'short') : ''}</span>
                </label>
                <input type="datetime-local" required value={formData.datetime} onChange={(e) => setFormData({...formData, datetime: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-colors cursor-pointer" />
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
                <button type="submit" disabled={isSaving} className="w-full p-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-xl shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0">
                  {isSaving ? <HiOutlineRefresh className="animate-spin" size={24}/> : (editingId ? 'Update Activity' : 'Log Transfer & Sync All Ledgers')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 border border-rose-200 dark:border-rose-900/50 relative overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-pink-500"></div>
            <div className="flex flex-col items-center text-center mb-6 shrink-0">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner border border-rose-200 dark:border-rose-500/30"><HiOutlineLockClosed /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-2">Deleting this record will completely reverse the balances from your Crypto Wallet, Income, and Expense ledgers.</p>
            </div>
            <form onSubmit={executeSecureDelete} className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-4">
              <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="ENTER PIN" className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm transition-colors focus:border-rose-500" />
              {pinError && <p className="text-xs font-bold text-rose-600 dark:text-rose-400 text-center animate-bounce mt-2">{pinError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm border border-slate-300 dark:border-slate-700">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex justify-center items-center gap-2 active:scale-95 shadow-lg shadow-rose-500/30">
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

export default SwapAndBridge;