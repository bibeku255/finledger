import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
// 🚀 FIXED: Changed updateDoc to setDoc for safety
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineLockClosed, 
  HiOutlineSparkles, HiOutlineChevronDown, HiOutlineSwitchHorizontal,
  HiOutlineExclamationCircle, HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaExchangeAlt, FaRoute, FaGhost, FaBuilding, FaWallet } from 'react-icons/fa';

// 🚀 Standard Platforms & Assets
const allPlatforms = [
  "Binance", "CoinDCX", "WazirX", "Coinbase", "Bybit", "KuCoin", "OKX", "Kraken", "Mexc",
  "FaucetPay", "Trust Wallet", "MetaMask", "Phantom", "NC Wallet", "Payeer"
];

// 🚀 Fallback Database in case context misses it
const defaultCryptoDatabase = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'tether', symbol: 'CTC', name: 'CryptoTab Coin', fallbackPrice: 1.00, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'tether', symbol: 'ROX', name: 'Robox', fallbackPrice: 1.00, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', color: 'text-slate-800 dark:text-white', bg: 'bg-slate-500/10' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', color: 'text-yellow-600', bg: 'bg-yellow-600/10' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', color: 'text-red-600', bg: 'bg-red-600/10' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', color: 'text-slate-400', bg: 'bg-slate-400/10' },
  { id: 'dash', symbol: 'DASH', name: 'Dash', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'polygon-ecosystem-token', symbol: 'POL', name: 'Polygon', color: 'text-purple-600', bg: 'bg-purple-600/10' },
  { id: 'jumptoken', symbol: 'JMPT', name: 'JumpToken', fallbackPrice: 0.95, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 'feyorra', symbol: 'FEY', name: 'Feyorra', fallbackPrice: 0.0091, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'fluenc', symbol: 'FLT', name: 'FaucetPay Lottery', fallbackPrice: 0.05, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'ice-decentralized-future', symbol: 'ICE', name: 'Ice Network', fallbackPrice: 0.0035, color: 'text-cyan-500', bg: 'bg-cyan-500/10' }
];

const MarketIcon = ({ symbol, customLogo }) => {
  const symbolUpper = symbol?.toUpperCase();
  const symbolLower = symbol?.toLowerCase();
  
  // Try to find local fallback logo if custom is not provided
  const dbCoin = defaultCryptoDatabase.find(c => c.symbol === symbolUpper);
  const src = customLogo || dbCoin?.logo || `https://assets.coincap.io/assets/icons/${symbolLower}@2x.png`;
  
  return (
    <img 
      src={src} 
      className="w-full h-full object-contain p-0.5 bg-white dark:bg-slate-800 rounded-full" 
      alt={symbolUpper} 
      onError={(e) => { 
        e.target.onerror = null; 
        e.target.src = `https://bin.bnbstatic.com/image/admin_mgl/coin-logo/${symbolUpper}.png`; 
      }} 
    />
  );
};

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const SwapAndBridge = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'INR', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];

  // 🚀 CRASH FIX: Extracting string symbols safely from context objects
  const cryptoSymbols = useMemo(() => {
    return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
  }, [selectedCryptos]);

  const activeCryptos = cryptoSymbols.length > 0 ? cryptoSymbols : ['BTC', 'USDT', 'TRX', 'LTC'];

  const [formData, setFormData] = useState({
    actionType: 'swap',
    platform: allPlatforms[0], 
    fromCoin: activeCryptos[0],
    fromAmount: '',
    toCoin: 'USDT',
    toAmount: '',
    fromPlatform: 'Binance', 
    toPlatform: 'Trust Wallet', 
    bridgeCoin: activeCryptos[0],
    bridgeSentAmount: '',
    bridgeReceivedAmount: '',
    date: todayDate,
    linkedId: ''
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "swapBridgeLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 🚀 SMART PRICE FETCHER (Object Safe)
  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const fiatData = await fiatRes.json();
        const userBaseRate = fiatData.rates[baseCurrency] || 1;
        setFiatRate(userBaseRate);

        const coinsToFetch = Array.from(new Set([...activeCryptos, 'USDT', formData.fromCoin, formData.toCoin, formData.bridgeCoin]));
        
        // Map to correct CoinGecko IDs using context objects first, then fallback to default DB
        const ids = coinsToFetch.map(sym => {
           const obj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === sym.toUpperCase());
           const fallback = defaultCryptoDatabase.find(c => c.symbol === sym.toUpperCase());
           return obj?.id || fallback?.id || sym.toLowerCase();
        }).join(',');
        
        let cgJson = {};
        try {
          const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
          if (cgRes.ok) cgJson = await cgRes.json();
        } catch(e) { console.warn("API Rate Limit, using fallbacks"); }
        
        const priceMap = {};
        
        await Promise.all(coinsToFetch.map(async (sym) => {
          const upperSym = sym.toUpperCase();
          const obj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === upperSym) || {};
          const fallback = defaultCryptoDatabase.find(c => c.symbol === upperSym) || {};
          const searchId = obj.id || fallback.id || sym.toLowerCase();

          let priceUsd = null;

          if (cgJson[searchId]?.usd) {
             priceUsd = parseFloat(cgJson[searchId].usd);
          }

          // Binance Fallback
          if (priceUsd === null || isNaN(priceUsd) || priceUsd === 0) {
            try {
              const bSym = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
              const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${bSym}`);
              if (bRes.ok) {
                 const bData = await bRes.json();
                 priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
              }
            } catch(e) {}
          }

          if (priceUsd === null || isNaN(priceUsd) || priceUsd === 0) {
              priceUsd = parseFloat(obj.fallbackPrice || fallback.fallbackPrice || 0);
          }
          
          priceMap[upperSym] = priceUsd;
        }));

        setLivePrices(priceMap);
      } catch (error) { console.error("Crypto Sync Error"); }
    };
    fetchLivePrices();
  }, [activeCryptos, baseCurrency, formData.fromCoin, formData.toCoin, formData.bridgeCoin, selectedCryptos]);

  // 🚀 INSTANT PRICE RESOLVER
  const getLivePrice = (symbol) => {
    if (livePrices[symbol]) return livePrices[symbol] * fiatRate; 
    
    // Final hard fallback
    const obj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === symbol);
    const dbCoin = defaultCryptoDatabase.find(c => c.symbol === symbol);
    const fallbackP = obj?.fallbackPrice || dbCoin?.fallbackPrice || 0;
    
    return fallbackP * fiatRate;
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

  // 🚀 FIXED SPREAD CALCULATOR
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

  // 🚀 REPORT DOWNLOAD LOGIC (Now Includes Global Date)
  const handleDownloadReport = (format) => {
    if (records.length === 0) return alert("No swap/bridge records found.");

    const reportData = records.map(rec => {
      let actionLabel = rec.actionType === 'swap' ? 'Coin Swap' : 'Bridge / Transfer';
      
      let fromLabel = '';
      let toLabel = '';
      if (rec.actionType === 'swap') {
        fromLabel = `${rec.fromAmount} ${rec.fromCoin} (via ${rec.platform})`;
        toLabel = `${rec.toAmount} ${rec.toCoin}`;
      } else {
        fromLabel = `${rec.bridgeSentAmount} ${rec.bridgeCoin} (from ${rec.fromPlatform})`;
        toLabel = `${rec.bridgeReceivedAmount} ${rec.bridgeCoin} (to ${rec.toPlatform})`;
      }

      let accountingLabel = '';
      if (rec.hiddenFeeBase === 0) {
         accountingLabel = `Profit Synced (+${currencySymbol}${Math.abs(rec.hiddenFeeBase).toFixed(2)})`;
      } else {
         accountingLabel = `Fee Logged (-${currencySymbol}${Math.abs(rec.hiddenFeeBase).toFixed(2)})`;
      }

      return {
        // 🚀 GLOBAL DATE FOR REPORTS
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        type: actionLabel,
        fromDetails: fromLabel,
        toDetails: toLabel,
        accountingAction: accountingLabel
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Action Type', key: 'type' },
      { header: 'Source / Deducted', key: 'fromDetails' },
      { header: 'Destination / Received', key: 'toDetails' },
      { header: 'Accounting Impact', key: 'accountingAction' }
    ];

    const fileName = `Swap_Bridge_Tracker`;
    const reportTitle = `Crypto Swap & Bridge - Full Activity Log`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    const timestamp = editingId ? records.find(r => r.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const uniqueId = formData.linkedId || `SB_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    let masterRecord = { actionType: formData.actionType, date: formData.date, timestamp, linkedId: uniqueId };
    let cryptoWalletSyncData = [];
    let incomeSyncData = null;
    let expenseSyncData = null;

    if (formData.actionType === 'swap') {
      const fQty = parseFloat(formData.fromAmount);
      const tQty = parseFloat(formData.toAmount);
      if (fQty <= 0 || tQty <= 0) { alert("Amounts must be > 0"); setIsSaving(false); return; }

      const fromVal = fQty * getLivePrice(formData.fromCoin);
      const toVal = tQty * getLivePrice(formData.toCoin);
      const diff = fromVal - toVal; // Positive = Loss(Fee), Negative = Profit

      masterRecord = {
        ...masterRecord, platform: formData.platform, fromCoin: formData.fromCoin, fromAmount: fQty,
        toCoin: formData.toCoin, toAmount: tQty, baseVolume: fromVal, hiddenFeeBase: Math.max(0, diff) 
      };

      cryptoWalletSyncData.push({ type: 'out', coin: formData.fromCoin, quantity: fQty, platform: formData.platform, reason: `Swapped to ${formData.toCoin}`, referenceNo: uniqueId, date: formData.date, timestamp, linkedRecordId: uniqueId });
      cryptoWalletSyncData.push({ type: 'in', coin: formData.toCoin, quantity: tQty, platform: formData.platform, reason: `Swapped from ${formData.fromCoin}`, referenceNo: uniqueId, date: formData.date, timestamp, linkedRecordId: uniqueId });

      // 🚀 DOUBLE-ENTRY ACCOUNTING (Income/Expense Sync)
      if (diff > 0) { // Spread Loss -> Send to Expenses
        expenseSyncData = {
          title: `Swap Spread Fee (${formData.fromCoin} to ${formData.toCoin})`,
          category: 'Bank & Transaction Fees', amount: diff, currency: baseCurrency, finalBaseAmount: diff,
          date: formData.date, timestamp, linkedExpenseId: uniqueId,
          isVirtualCrypto: true, vault: 'crypto' 
        };
      } else if (diff < 0) { // Arbitrage Profit -> Send to Income
        incomeSyncData = {
          title: `Arbitrage Profit (${formData.fromCoin} to ${formData.toCoin})`,
          category: 'Crypto APR / Yield', asset: baseCurrency, amount: Math.abs(diff), exchangeRate: 1, finalBaseAmount: Math.abs(diff),
          date: formData.date, timestamp, linkedIncomeId: uniqueId,
          isVirtualCrypto: true, vault: 'crypto' 
        };
      }

    } else {
      const sQty = parseFloat(formData.bridgeSentAmount);
      const rQty = parseFloat(formData.bridgeReceivedAmount);
      if (sQty <= 0 || rQty <= 0) { alert("Amounts must be > 0"); setIsSaving(false); return; }

      const feeCoins = sQty - rQty;
      const feeBase = feeCoins * getLivePrice(formData.bridgeCoin);

      masterRecord = {
        ...masterRecord, fromPlatform: formData.fromPlatform, toPlatform: formData.toPlatform,
        bridgeCoin: formData.bridgeCoin, bridgeSentAmount: sQty, bridgeReceivedAmount: rQty,
        feeCoins: feeCoins, baseVolume: sQty * getLivePrice(formData.bridgeCoin), hiddenFeeBase: Math.max(0, feeBase) 
      };

      cryptoWalletSyncData.push({
        type: 'transfer', coin: formData.bridgeCoin, quantity: sQty, fromPlatform: formData.fromPlatform, toPlatform: formData.toPlatform, networkFee: feeCoins,
        reason: `Bridge Transfer`, referenceNo: uniqueId, date: formData.date, timestamp, linkedRecordId: uniqueId
      });

      if (feeBase > 0) {
        expenseSyncData = {
          title: `Network Gas Fee (${formData.fromPlatform} to ${formData.toPlatform})`,
          category: 'Bank & Transaction Fees', amount: feeBase, currency: baseCurrency, finalBaseAmount: feeBase,
          date: formData.date, timestamp, linkedExpenseId: uniqueId,
          isVirtualCrypto: true, vault: 'crypto' 
        };
      }
    }

    try {
      if (editingId) {
        // 🚀 FIXED: Safe editing with setDoc merge
        await setDoc(doc(db, "users", user.uid, "swapBridgeLogs", editingId), masterRecord, { merge: true });
        
        // Clean old linked data
        const cleanupCollections = ["cryptoWalletLogs", "incomeLogs", "expenseLogs"];
        for (const col of cleanupCollections) {
          const field = col === "incomeLogs" ? "linkedIncomeId" : col === "expenseLogs" ? "linkedExpenseId" : "linkedRecordId";
          const q = query(collection(db, "users", user.uid, col), where(field, "==", uniqueId));
          const snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, col, d.id)));
        }
      } else {
        await addDoc(collection(db, "users", user.uid, "swapBridgeLogs"), masterRecord);
      }
      
      // Inject new synced data
      for (const data of cryptoWalletSyncData) await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), data);
      if (incomeSyncData) await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeSyncData);
      if (expenseSyncData) await addDoc(collection(db, "users", user.uid, "expenseLogs"), expenseSyncData);

      closeModal();
    } catch (error) { alert("Failed to save."); } finally { setIsSaving(false); }
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Enter PIN.");
    setIsVerifying(true);
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin; 

      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect PIN."); setIsVerifying(false); return;
      }
      
      await deleteDoc(doc(db, "users", user.uid, "swapBridgeLogs", deleteContext.id));
      
      const cleanupCollections = ["cryptoWalletLogs", "incomeLogs", "expenseLogs"];
      for (const col of cleanupCollections) {
        const field = col === "incomeLogs" ? "linkedIncomeId" : col === "expenseLogs" ? "linkedExpenseId" : "linkedRecordId";
        const q = query(collection(db, "users", user.uid, col), where(field, "==", deleteContext.linkedId));
        const snap = await getDocs(q);
        snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, col, d.id)));
      }

      setDeleteContext(null); 
    } catch (error) { setPinError("Error."); } finally { setIsVerifying(false); }
  };

  const handleEdit = (rec) => {
    setFormData({
      actionType: rec.actionType, platform: rec.platform || allPlatforms[0],
      fromCoin: rec.fromCoin || activeCryptos[0], fromAmount: rec.fromAmount || '',
      toCoin: rec.toCoin || 'USDT', toAmount: rec.toAmount || '',
      fromPlatform: rec.fromPlatform || 'Binance', toPlatform: rec.toPlatform || 'Trust Wallet',
      bridgeCoin: rec.bridgeCoin || activeCryptos[0], bridgeSentAmount: rec.bridgeSentAmount || '',
      bridgeReceivedAmount: rec.bridgeReceivedAmount || '', date: rec.date, linkedId: rec.linkedId
    });
    setEditingId(rec.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false); setEditingId(null);
    setFormData(prev => ({ ...prev, fromAmount: '', toAmount: '', bridgeSentAmount: '', bridgeReceivedAmount: '', linkedId: '' }));
  };

  const filteredLogs = records.filter(t => 
    t.fromCoin?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.toCoin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.bridgeCoin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.platform?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-blue-500/10 text-blue-600 rounded-2xl ring-1 ring-blue-500/20">
              <HiOutlineSwitchHorizontal size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Swap & Bridge Tracker</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            Convert dust coins or bridge between wallets. Our engine syncs arbitrage profits to your Income, and tracks hidden spread fees as Expenses.
          </p>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          {/* 🚀 DOWNLOAD REPORT DROPDOWN */}
          <div className="relative group">
            <button className="flex items-center gap-1 md:gap-2 p-3 md:p-3.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-2xl font-bold text-xs md:text-sm hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
              <HiOutlineDownload size={18}/> 
              <span className="hidden sm:inline">Download Report</span>
              <span className="sm:hidden">Report</span>
            </button>
            <div className="absolute top-full right-0 md:left-0 md:right-auto mt-2 w-36 md:w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
              <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineDocumentText className="text-rose-500" size={16}/> As PDF
              </button>
              <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineTable className="text-emerald-500" size={16}/> As Excel (CSV)
              </button>
            </div>
          </div>

          <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 md:px-7 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shadow-lg shadow-blue-500/25 whitespace-nowrap">
            <HiOutlinePlus size={20} className="hidden sm:inline" /> 
            <span className="hidden sm:inline">Log Swap / Transfer</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
          <div className="absolute right-[-10%] top-[-10%] opacity-[0.03] dark:opacity-5 text-slate-900 dark:text-white"><FaExchangeAlt size={150}/></div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Volume Moved</p>
          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight relative z-10">{currencySymbol}{analytics.totalVolume.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        
        <div className="p-8 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-900/10 rounded-3xl shadow-sm border border-rose-200 dark:border-rose-800/50 md:col-span-2 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 text-rose-500 -mt-8 -mr-8"><FaGhost size={180}/></div>
          <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 relative z-10 flex items-center gap-2">
            <HiOutlineExclamationCircle size={16}/> Total Money Lost to Hidden Fees & Spreads
          </p>
          <h2 className="text-5xl font-black text-rose-600 dark:text-rose-400 tracking-tighter relative z-10">
            -{currencySymbol}{analytics.totalFeesLost.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Activity Log</h2>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="p-4 pl-6">Type & Date</th>
                <th className="p-4">From (Source)</th>
                <th className="p-4">To (Destination)</th>
                <th className="p-4 text-right">Accounting Action</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredLogs.map((rec) => {
                
                // 🚀 Safe Logo Retrieval for Table
                const fromCoinObj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === (rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin).toUpperCase());
                const toCoinObj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === (rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin).toUpperCase());

                return (
                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${rec.actionType === 'swap' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'}`}>
                         {rec.actionType === 'swap' ? <FaExchangeAlt /> : <FaRoute />}
                      </div>
                      <div>
                        <p className={`font-black text-sm uppercase tracking-widest ${rec.actionType === 'swap' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>
                          {rec.actionType === 'swap' ? 'Coin Swap' : 'Bridge / Transfer'}
                        </p>
                        {/* 🚀 GLOBAL DATE FOR TABLE ROWS */}
                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                          {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                        </p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 shrink-0">
                          <MarketIcon symbol={rec.actionType === 'swap' ? rec.fromCoin : rec.bridgeCoin} customLogo={fromCoinObj?.logo} />
                       </div>
                       {rec.actionType === 'swap' ? (
                         <div>
                           <p className="font-black text-slate-800 dark:text-white text-sm">{rec.fromAmount} <span className="text-xs text-slate-500 uppercase">{rec.fromCoin}</span></p>
                           <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase flex items-center gap-1"><FaBuilding/> {rec.platform}</p>
                         </div>
                       ) : (
                         <div>
                           <p className="font-black text-slate-800 dark:text-white text-sm">{rec.bridgeSentAmount} <span className="text-xs text-slate-500 uppercase">{rec.bridgeCoin}</span></p>
                           <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase flex items-center gap-1"><FaWallet/> {rec.fromPlatform}</p>
                         </div>
                       )}
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 shrink-0">
                          <MarketIcon symbol={rec.actionType === 'swap' ? rec.toCoin : rec.bridgeCoin} customLogo={toCoinObj?.logo} />
                       </div>
                       {rec.actionType === 'swap' ? (
                         <div>
                           <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">+{rec.toAmount} <span className="text-xs text-slate-500 uppercase">{rec.toCoin}</span></p>
                         </div>
                       ) : (
                         <div>
                           <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">+{rec.bridgeReceivedAmount} <span className="text-xs text-slate-500 uppercase">{rec.bridgeCoin}</span></p>
                           <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase flex items-center gap-1"><FaWallet/> {rec.toPlatform}</p>
                         </div>
                       )}
                    </div>
                  </td>

                  <td className="p-4 text-right">
                    {rec.hiddenFeeBase === 0 ? (
                       <div>
                         <p className="text-sm font-black text-emerald-500 tracking-tight">Profit Synced</p>
                         <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">To Income Streams</p>
                       </div>
                    ) : (
                       <div>
                         <p className="text-sm font-black text-rose-500 tracking-tight">
                           -{currencySymbol}{(rec.hiddenFeeBase || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                         </p>
                         <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                           Logged to Expenses
                         </p>
                       </div>
                    )}
                  </td>

                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 rounded-xl transition-all shadow-sm"><HiOutlinePencil size={18} /></button>
                      <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 hover:bg-rose-100 rounded-xl transition-all shadow-sm"><HiOutlineTrash size={18} /></button>
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
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            
            <div className="px-6 sm:px-8 py-5 flex justify-between items-center transition-colors duration-300 bg-blue-600 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineSwitchHorizontal size={24}/> {editingId ? 'Edit Record' : 'Execute Action'}</h3>
              <button type="button" onClick={closeModal} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                <button type="button" onClick={() => setFormData({...formData, actionType: 'swap'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-2 ${formData.actionType === 'swap' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}><FaExchangeAlt/> Swap Coins</button>
                <button type="button" onClick={() => setFormData({...formData, actionType: 'bridge'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-2 ${formData.actionType === 'bridge' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}><FaRoute/> Bridge / Transfer</button>
              </div>

              {formData.actionType === 'swap' ? (
                <div className="space-y-6 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform (Where did you swap?)</label>
                    <select value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer">
                      {allPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">You Gave (Asset)</label>
                      <select value={formData.fromCoin} onChange={(e) => setFormData({...formData, fromCoin: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none">
                        {cryptoSymbols.map(c => <option key={`f-${c}`} value={c}>{c}</option>)}
                      </select>
                      <input type="number" step="any" required value={formData.fromAmount} onChange={(e) => setFormData({...formData, fromAmount: e.target.value})} placeholder="Amount Given" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">You Received</label>
                      <select value={formData.toCoin} onChange={(e) => setFormData({...formData, toCoin: e.target.value})} className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl font-black text-emerald-600 dark:text-emerald-400 outline-none">
                        {cryptoSymbols.concat(['USDT']).map(c => <option key={`t-${c}`} value={c}>{c}</option>)}
                      </select>
                      <input type="number" step="any" required value={formData.toAmount} onChange={(e) => setFormData({...formData, toAmount: e.target.value})} placeholder="Amount Received" className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl font-bold text-emerald-600 dark:text-emerald-400 outline-none" />
                    </div>
                  </div>

                  {formData.fromAmount && formData.toAmount && (
                    <div className={`p-4 rounded-xl border flex justify-between items-center ${liveFormFee.isLoss ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-900/50' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/50'}`}>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Analysis (Live)</p>
                        <p className={`text-sm font-black ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {liveFormFee.isLoss ? 'Hidden Spread Fee Detected' : 'Profitable Arbitrage Swap'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black tracking-tight ${liveFormFee.isLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {liveFormFee.isLoss ? '-' : '+'}{currencySymbol}{Math.abs(liveFormFee.fee).toFixed(2)}
                        </p>
                        <p className="text-[10px] font-bold opacity-70">≈ {liveFormFee.feePct.toFixed(2)}% {liveFormFee.isLoss ? 'Loss' : 'Profit'}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset to Transfer</label>
                    <div className="flex gap-3">
                      <select value={formData.bridgeCoin} onChange={(e) => setFormData({...formData, bridgeCoin: e.target.value})} className="w-1/3 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none">
                        {cryptoSymbols.map(c => <option key={`b-${c}`} value={c}>{c}</option>)}
                      </select>
                      <div className="flex-1 text-right pt-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Moving crypto burns gas fees. Track exactly how much network fee you paid.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">From Wallet</label>
                      <select value={formData.fromPlatform} onChange={(e) => setFormData({...formData, fromPlatform: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none">
                        {allPlatforms.map(p => <option key={`bf-${p}`} value={p}>{p}</option>)}
                      </select>
                      <input type="number" step="any" required value={formData.bridgeSentAmount} onChange={(e) => setFormData({...formData, bridgeSentAmount: e.target.value})} placeholder="Amount Sent" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">To Destination</label>
                      <select value={formData.toPlatform} onChange={(e) => setFormData({...formData, toPlatform: e.target.value})} className="w-full p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-xl font-bold dark:text-white outline-none">
                        {allPlatforms.map(p => <option key={`bt-${p}`} value={p}>{p}</option>)}
                      </select>
                      <input type="number" step="any" required value={formData.bridgeReceivedAmount} onChange={(e) => setFormData({...formData, bridgeReceivedAmount: e.target.value})} placeholder="Amount Received" className="w-full p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-xl font-bold text-purple-600 dark:text-purple-400 outline-none" />
                    </div>
                  </div>

                  {formData.bridgeSentAmount && formData.bridgeReceivedAmount && (
                    <div className={`p-4 rounded-xl border flex justify-between items-center ${liveFormFee.isLoss ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-900/50' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/50'}`}>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Network Gas Fee</p>
                        <p className={`text-sm font-black ${liveFormFee.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {liveFormFee.feeCoins.toFixed(6)} {formData.bridgeCoin}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black tracking-tight ${liveFormFee.isLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
                          -{currencySymbol}{Math.abs(liveFormFee.feeBase).toFixed(2)}
                        </p>
                        <p className="text-[10px] font-bold opacity-70">Loss in Fiat</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 🚀 GLOBAL DATE FOR INPUT */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Date</span>
                  <span className="text-blue-500">{formatGlobalDate ? formatGlobalDate(formData.date, 'short') : ''}</span>
                </label>
                <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>

              <button type="submit" disabled={isSaving} className="w-full p-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving ? <HiOutlineRefresh className="animate-spin" size={24}/> : (editingId ? 'Update Activity' : 'Log Transfer & Sync All Ledgers')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 rounded-full flex items-center justify-center text-3xl mb-4"><HiOutlineLockClosed /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">Deleting this record will completely reverse the balances from your Crypto Wallet, Income, and Expense ledgers.</p>
            </div>
            <form onSubmit={executeSecureDelete} className="space-y-4">
              <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="ENTER PIN" className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50" />
              {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce">{pinError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50">Verify & Delete</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SwapAndBridge;