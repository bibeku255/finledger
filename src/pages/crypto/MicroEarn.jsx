import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
// 🚀 FIXED: Added setDoc for safe editing
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineLockClosed, 
  HiOutlineSparkles, HiOutlineChevronDown, HiOutlineClock,
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaBitcoin, FaGift, FaWallet, FaMedal, FaTrophy } from 'react-icons/fa';

// 🚀 Expanded Micro-Earn Platforms
const microEarnPlatforms = [
  "CoinPayU", "FaucetPay", "Cointiply", "FreeBitcoin", "FireFaucet",
  "PipeFlare", "GlobalHive", "AdBTC", "Viefaucet", "DutchyCorp", 
  "LarvelFaucet", "Coinpot", "Other Faucet"
];

// 🚀 Multiple Earning Methods (Tags)
const earningMethodsList = [
  "Direct Faucet", "PTC Ads", "Surveys", "Offerwalls", 
  "Shortlinks", "Lottery / Spin", "Games", "Freelance Micro-Tasks",
  "Staking (Micro)", "Referrals"
];

// 🚀 Expanded Destination Wallets
const popularCryptoWallets = [
  "Binance", "CoinDCX", "WazirX", "Coinbase", "Trust Wallet", 
  "MetaMask", "Phantom", "FaucetPay", "KuCoin", "OKX", "Kraken", "Mexc"
];

// Crypto Database (Fallback if objects are missing info)
const cryptoDatabase = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', color: 'text-slate-800 dark:text-white', bg: 'bg-slate-500/10' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', color: 'text-yellow-600', bg: 'bg-yellow-600/10' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', color: 'text-red-600', bg: 'bg-red-600/10' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', color: 'text-slate-400', bg: 'bg-slate-400/10' },
  { id: 'dash', symbol: 'DASH', name: 'Dash', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', color: 'text-emerald-600', bg: 'bg-emerald-600/10' },
  { id: 'digibyte', symbol: 'DGB', name: 'DigiByte', color: 'text-blue-600', bg: 'bg-blue-600/10' },
  { id: 'zcash', symbol: 'ZEC', name: 'Zcash', color: 'text-yellow-600', bg: 'bg-yellow-600/10' },
  { id: 'polygon-ecosystem-token', symbol: 'POL', name: 'Polygon', color: 'text-purple-600', bg: 'bg-purple-600/10' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon (Old)', color: 'text-purple-600', bg: 'bg-purple-600/10' },
  { id: 'the-open-network', symbol: 'TON', name: 'Toncoin', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'feyorra', symbol: 'FEY', name: 'Feyorra', logo: 'https://cdn.faucetpay.io/coins/fey.png', fallbackPrice: 0.0091, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'fluenc', symbol: 'FLT', name: 'FaucetPay Lottery', logo: 'https://cdn.faucetpay.io/coins/flt.png', fallbackPrice: 0.05, color: 'text-yellow-500', bg: 'bg-yellow-500/10' }
];

const MarketIcon = ({ symbol, apiImage, customLogo }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const symbolUpper = symbol?.toUpperCase();
  const symbolLower = symbol?.toLowerCase();

  useEffect(() => { setImgIndex(0); }, [symbol, apiImage, customLogo]);

  const sources = [
    customLogo, apiImage, 
    `https://bin.bnbstatic.com/image/admin_mgl/coin-logo/${symbolUpper}.png`, 
    `https://assets.coincap.io/assets/icons/${symbolLower}@2x.png`,
    `https://cryptologos.cc/logos/${symbolLower}-${symbolLower}-logo.png`
  ].filter(Boolean);

  if (imgIndex >= sources.length) return <span className="text-[10px] font-black text-slate-400 w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full">{symbolUpper?.charAt(0)}</span>;
  return <img src={sources[imgIndex]} className="w-full h-full object-contain p-0.5 rounded-full bg-white dark:bg-slate-900" alt={symbolUpper} onError={() => setImgIndex(p => p + 1)} />;
};

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const MicroEarn = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter Included
  const { user, baseCurrency = 'INR', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  const [isCustomWallet, setIsCustomWallet] = useState(false);

  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];

  // 🚀 CRASH FIX: Extracting string symbols from object array safely
  const cryptoSymbols = useMemo(() => {
    return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
  }, [selectedCryptos]);

  const [formData, setFormData] = useState({
    platform: microEarnPlatforms[0],
    methods: [], 
    destinationWallet: popularCryptoWallets[0],
    coin: cryptoSymbols.length > 0 ? cryptoSymbols[0] : 'USDT', // FIXED Default state
    withdrawnAmount: '',
    receivedAmount: '',
    date: todayDate,
    linkedRecordId: ''
  });

  useEffect(() => {
    if (!user) return;
    const earnRef = collection(db, "users", user.uid, "microEarnLogs");
    const q = query(earnRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Live Price Fetcher (Safe Version)
  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const fiatData = await fiatRes.json();
        setFiatRate(fiatData.rates[baseCurrency] || 1);

        const coinsToFetch = Array.from(new Set([...transactions.map(t => t.coin), ...cryptoSymbols, 'USDT']));
        if (coinsToFetch.length > 0) {
          
          // Safe ID extraction
          const validIds = coinsToFetch.map(sym => {
            const obj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === sym.toUpperCase());
            const dbCoin = cryptoDatabase.find(c => c.symbol === sym);
            return obj?.id || dbCoin?.id || sym.toLowerCase();
          });
          const uniqueIds = [...new Set(validIds)].join(',');

          let cgJson = {};
          try {
            const cgRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${uniqueIds}&sparkline=false`);
            if (cgRes.ok) {
              const cgArr = await cgRes.json();
              cgArr.forEach(c => { cgJson[c.id] = c; });
            }
          } catch(e) { console.warn("CoinGecko API blocked, using binance/fallbacks"); }
          
          const priceMap = {};

          await Promise.all(coinsToFetch.map(async (sym) => {
            const coinObj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === sym.toUpperCase()) || {};
            const dbCoin = cryptoDatabase.find(c => c.symbol === sym) || {};
            const id = coinObj.id || dbCoin.id || sym.toLowerCase();

            let finalUsdPrice = 0;
            let finalImage = null;

            if (cgJson[id]) {
                finalUsdPrice = cgJson[id].current_price;
                finalImage = cgJson[id].image;
            } else {
                try {
                  const bSym = id === 'tether' ? 'BTCUSDT' : `${sym.toUpperCase()}USDT`;
                  const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${bSym}`);
                  if (bRes.ok) {
                    const bData = await bRes.json();
                    finalUsdPrice = id === 'tether' ? 1.00 : parseFloat(bData.price);
                  }
                } catch(err) {
                    finalUsdPrice = coinObj.fallbackPrice || dbCoin.fallbackPrice || 0;
                }
            }

            priceMap[sym] = {
              priceUSD: finalUsdPrice,
              image: finalImage,
              customLogo: coinObj.logo || dbCoin.logo,
            };
          }));

          setLivePrices(priceMap);
        }
      } catch (error) { console.error("Crypto Sync Error"); }
    };
    if (!isLoading) fetchLivePrices();
  }, [isLoading, transactions, cryptoSymbols, baseCurrency, selectedCryptos]);

  // 🚀 THE MAGIC: FULLY DYNAMIC LIVE RANKING ENGINE
  const platformRankings = useMemo(() => {
    const stats = {};
    
    // Aggregate Data (Quantities instead of static FIAT)
    transactions.forEach(t => {
      const plat = t.platform;
      if (!stats[plat]) {
        stats[plat] = { platform: plat, totalLiveValue: 0, withdrawCount: 0, coins: new Set(), coinQuantities: {} };
      }
      
      const rQty = parseFloat(t.receivedAmount) || 0;
      stats[plat].withdrawCount += 1;
      stats[plat].coins.add(t.coin);
      
      // Store raw quantity for LIVE calculation
      stats[plat].coinQuantities[t.coin] = (stats[plat].coinQuantities[t.coin] || 0) + rQty;
    });

    // 🚀 CALCULATE LIVE VALUE FOR EACH PLATFORM
    Object.values(stats).forEach(stat => {
      let currentLiveVal = 0;
      Object.entries(stat.coinQuantities).forEach(([coinSymbol, qty]) => {
         const coinPriceUSD = livePrices[coinSymbol]?.priceUSD || 0;
         currentLiveVal += (qty * coinPriceUSD * fiatRate);
      });
      stat.totalLiveValue = currentLiveVal;
    });

    // Convert to array and Sort by Highest LIVE Value
    const sorted = Object.values(stats).sort((a, b) => b.totalLiveValue - a.totalLiveValue);

    // Assign Ranks and Ratings based on Performance
    return sorted.map((stat, index) => {
      let rating = "⚠️ Poor Yield (Consider Quitting)";
      let color = "text-rose-500";
      let bg = "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-900/50";
      let badge = `#${index + 1}`;
      
      if (index === 0) { 
        rating = "🥇 Top Earner (Keep Doing)"; color = "text-yellow-600 dark:text-yellow-400"; bg = "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-300 dark:border-yellow-700"; badge = "🥇 1st";
      }
      else if (index === 1) { 
        rating = "🥈 Highly Profitable"; color = "text-slate-600 dark:text-slate-300"; bg = "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600"; badge = "🥈 2nd";
      }
      else if (index === 2) { 
        rating = "🥉 Good Earner"; color = "text-amber-700 dark:text-amber-500"; bg = "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800"; badge = "🥉 3rd";
      }
      else if (stat.totalLiveValue > 50) { 
        rating = "👍 Average Payer"; color = "text-blue-500"; bg = "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-900/50";
      }

      return { 
        ...stat, 
        rank: index + 1, 
        badge,
        rating, color, bg, 
        coinsList: Array.from(stat.coins).join(', ') 
      };
    });
  }, [transactions, livePrices, fiatRate]); 

  const totalVaultValueBase = useMemo(() => {
    return platformRankings.reduce((total, stat) => total + stat.totalLiveValue, 0);
  }, [platformRankings]);

  const analyticsData = useMemo(() => {
    const platformGroups = {};
    const processedLogs = [];
    const chronologicalLogs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    chronologicalLogs.forEach(t => {
      const plat = t.platform;
      if (!platformGroups[plat]) platformGroups[plat] = { lastDate: null };
      
      let daysSinceLast = null;
      if (platformGroups[plat].lastDate) {
        const diffTime = Math.abs(new Date(t.date) - new Date(platformGroups[plat].lastDate));
        daysSinceLast = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      platformGroups[plat].lastDate = t.date;
      
      // Calculate individual transaction live value vs recorded value
      const coinPriceUSD = livePrices[t.coin]?.priceUSD || 0;
      const currentLiveBaseAmount = (parseFloat(t.receivedAmount) || 0) * coinPriceUSD * fiatRate;
      
      processedLogs.push({ ...t, daysSinceLast, currentLiveBaseAmount });
    });

    processedLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    return processedLogs;
  }, [transactions, livePrices, fiatRate]);

  // 🚀 REPORT DOWNLOAD LOGIC (Now includes Global Date)
  const handleDownloadReport = (format) => {
    const filteredForReport = analyticsData.filter(t => 
      t.coin.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.platform?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredForReport.length === 0) return alert("No records found to download.");

    const reportData = filteredForReport.map(rec => {
      const isProfit = (rec.currentLiveBaseAmount || 0) >= (rec.earnedBaseValue || 0);
      const methodsText = Array.isArray(rec.methods) ? rec.methods.join(", ") : 'N/A';
      
      return {
        // 🚀 GLOBAL DATE IN REPORTS
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        platform: rec.platform || 'Unknown',
        methods: methodsText,
        coin: rec.coin,
        withdrawn: `${rec.withdrawnAmount} ${rec.coin}`,
        received: `${rec.receivedAmount} ${rec.coin}`,
        recordedValue: `${currencySymbol}${(rec.earnedBaseValue || 0).toFixed(2)}`,
        liveValue: `${currencySymbol}${(rec.currentLiveBaseAmount || 0).toFixed(2)} (${isProfit ? 'Profit' : 'Loss'})`
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Website / Faucet', key: 'platform' },
      { header: 'Earning Methods', key: 'methods' },
      { header: 'Coin', key: 'coin' },
      { header: 'Withdrawn', key: 'withdrawn' },
      { header: 'Received', key: 'received' },
      { header: 'Recorded Val.', key: 'recordedValue' },
      { header: 'Current Live Val.', key: 'liveValue' }
    ];

    const fileName = `Micro_Earn_Report`;
    const reportTitle = `Faucet & Micro-Earn Ledger`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  const handleMethodToggle = (method) => {
    if (formData.methods.includes(method)) {
      setFormData({ ...formData, methods: formData.methods.filter(m => m !== method) });
    } else {
      setFormData({ ...formData, methods: [...formData.methods, method] });
    }
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const wQty = parseFloat(formData.withdrawnAmount);
    const rQty = parseFloat(formData.receivedAmount);
    if (wQty <= 0 || rQty <= 0) return alert("Amounts must be greater than zero.");
    if (!formData.platform.trim()) return alert("Please enter a website name!");
    if (!formData.destinationWallet.trim()) return alert("Please select or enter a destination wallet.");
    if (formData.methods.length === 0) return alert("Please select at least one effort tag (e.g. PTC Ads).");

    setIsSaving(true);
    const timestamp = editingId ? transactions.find(t => t.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const uniqueId = formData.linkedRecordId || `MICRO_WD_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    const currentPriceUSD = livePrices[formData.coin]?.priceUSD || 0;
    const effectiveExchangeRate = currentPriceUSD * fiatRate;
    const finalBaseValue = rQty * effectiveExchangeRate;

    // 1. Data for Micro-Earn Log
    const microRecordData = {
      platform: formData.platform,
      methods: formData.methods,
      destinationWallet: formData.destinationWallet,
      coin: formData.coin,
      withdrawnAmount: wQty,
      receivedAmount: rQty, 
      fee: wQty - rQty, 
      earnedBaseValue: finalBaseValue, // Recorded Historical Value
      date: formData.date,
      timestamp: timestamp,
      linkedRecordId: uniqueId
    };

    // 2. Data for Crypto Wallet
    const cryptoVaultData = {
      type: 'in', 
      coin: formData.coin,
      quantity: rQty, 
      platform: formData.destinationWallet, 
      reason: `Website Withdrawal: ${formData.platform}`,
      referenceNo: uniqueId,
      date: formData.date,
      timestamp: timestamp,
      isMicroEarn: true,
      linkedRecordId: uniqueId
    };

    // 3. Data for Income Streams (HISTORICAL - as per accounting rules)
    const incomeRecordData = {
      title: `Platform Yield: ${formData.platform}`,
      category: "Crypto APR / Yield",
      vault: 'crypto',
      cryptoPlatform: formData.destinationWallet,
      asset: formData.coin,
      amount: rQty,
      exchangeRate: effectiveExchangeRate,
      finalBaseAmount: finalBaseValue,
      date: formData.date,
      timestamp: timestamp,
      linkedIncomeId: uniqueId,
      isMicroEarn: true
    };

    try {
      if (editingId) {
        // 🚀 FIXED: Safe setDoc implementation for all 3 collections
        await setDoc(doc(db, "users", user.uid, "microEarnLogs", editingId), microRecordData, { merge: true });
        
        const collectionsToUpdate = [
          { name: "cryptoWalletLogs", data: cryptoVaultData, field: "linkedRecordId" },
          { name: "incomeLogs", data: incomeRecordData, field: "linkedIncomeId" }
        ];

        for (const col of collectionsToUpdate) {
          const q = query(collection(db, "users", user.uid, col.name), where(col.field, "==", uniqueId));
          const snap = await getDocs(q);
          if (!snap.empty) {
              await setDoc(doc(db, "users", user.uid, col.name, snap.docs[0].id), col.data, { merge: true });
          } else {
              await addDoc(collection(db, "users", user.uid, col.name), col.data);
          }
        }
      } else {
        await addDoc(collection(db, "users", user.uid, "microEarnLogs"), microRecordData);
        await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), cryptoVaultData);
        await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeRecordData);
      }
      closeModal();
    } catch (error) {
      alert("Failed to save withdrawal entry.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (rec) => {
    setIsCustomPlatform(!microEarnPlatforms.includes(rec.platform));
    setIsCustomWallet(!popularCryptoWallets.includes(rec.destinationWallet));
    setFormData({
      platform: rec.platform || microEarnPlatforms[0],
      methods: rec.methods || [], 
      destinationWallet: rec.destinationWallet || popularCryptoWallets[0],
      coin: rec.coin,
      withdrawnAmount: rec.withdrawnAmount,
      receivedAmount: rec.receivedAmount,
      date: rec.date,
      linkedRecordId: rec.linkedRecordId || ''
    });
    setEditingId(rec.id);
    setIsModalOpen(true);
  };

  const initiateDelete = (rec) => {
    setDeleteContext(rec);
    setPinInput('');
    setPinError('');
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your PIN.");
    setIsVerifying(true);
    setPinError('');
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userData?.security?.pinHash || userData?.securityPin || userData?.pin; 

      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect Security PIN."); 
        setIsVerifying(false); 
        return;
      }
      
      await deleteDoc(doc(db, "users", user.uid, "microEarnLogs", deleteContext.id));
      
      // Cascade delete synced data
      if (deleteContext.linkedRecordId) {
          const collectionsToClean = ["cryptoWalletLogs", "incomeLogs"];
          for (const colName of collectionsToClean) {
             const fieldName = colName === "incomeLogs" ? "linkedIncomeId" : "linkedRecordId";
             const q = query(collection(db, "users", user.uid, colName), where(fieldName, "==", deleteContext.linkedRecordId));
             const snap = await getDocs(q);
             snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, colName, d.id)));
          }
      }

      setDeleteContext(null); 
    } catch (error) { setPinError("Verification failed."); } finally { setIsVerifying(false); }
  };

  const openModal = () => {
    setEditingId(null);
    setFormData({
      platform: microEarnPlatforms[0], methods: [], destinationWallet: popularCryptoWallets[0],
      coin: cryptoSymbols[0] || 'USDT', withdrawnAmount: '', receivedAmount: '', date: todayDate, linkedRecordId: ''
    });
    setIsCustomPlatform(false);
    setIsCustomWallet(false);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const filteredLogs = analyticsData.filter(t => 
    t.coin.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.platform?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-yellow-500/10 text-yellow-600 rounded-2xl ring-1 ring-yellow-500/20">
              <FaTrophy size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Website Rankings</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            Don't waste time on low-paying sites. Log your withdrawals here and let the system automatically rank the best websites to invest your time in based on Live Prices!
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

          <button onClick={openModal} className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-5 md:px-7 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shadow-lg shadow-yellow-500/25 whitespace-nowrap">
            <HiOutlinePlus size={20} className="hidden sm:inline" /> 
            <span className="hidden sm:inline">Log Site Withdrawal</span>
            <span className="sm:hidden">Log</span>
          </button>
        </div>
      </div>

      {/* 🚀 THE LEADERBOARD GRID (NOW LIVE SYNCED) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <FaMedal /> Live Platform Leaderboard
          </h3>
          <p className="text-xs font-black text-slate-500">Live Total Yield: {currencySymbol}{totalVaultValueBase.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>

        {platformRankings.length === 0 ? (
           <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
             <p className="text-slate-500 font-bold">Log your first withdrawal to generate your personal leaderboard.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {platformRankings.map((stat) => (
              <div key={stat.platform} className={`p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm flex flex-col gap-3 relative overflow-hidden transition-all hover:scale-[1.02] ${stat.bg}`}>
                
                {/* Visual Rank Background Indicator */}
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-10 text-9xl font-black italic pointer-events-none select-none">
                  #{stat.rank}
                </div>

                <div className="flex justify-between items-center z-10">
                  <h4 className="font-black text-slate-900 dark:text-white text-lg">{stat.platform}</h4>
                  <span className={`px-2 py-1 text-[11px] font-black rounded-lg uppercase tracking-widest bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm ${stat.color}`}>
                    {stat.badge}
                  </span>
                </div>

                <div className="z-10 mt-1">
                  <p className={`text-xs font-black uppercase tracking-widest mb-2 ${stat.color}`}>
                    {stat.rating}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left z-10 border-t border-slate-200/50 dark:border-slate-700/50 pt-3">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">Current Live Value <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span></p>
                    <p className="font-black text-slate-800 dark:text-white text-lg tracking-tight">{currencySymbol}{stat.totalLiveValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Withdrawals</p>
                     <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">{stat.withdrawCount} Times</p>
                  </div>
                </div>
                
                <div className="z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Coins Mined:</span>
                  <span className="text-slate-600 dark:text-slate-300">{stat.coinsList}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LEDGER SEARCH & TABLE */}
      <div className="flex gap-4 bg-white dark:bg-slate-900 p-2 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 mt-8">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
          <input type="text" placeholder="Search logs by coin or platform..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-4 py-4 bg-transparent font-bold text-slate-700 dark:text-white outline-none" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Withdrawal History & Analysis</h2>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="p-4 pl-6">Website & Info</th>
                <th className="p-4">Effort / Tags</th>
                <th className="p-4">Time Taken</th>
                <th className="p-4 text-right">Value (Recorded vs Live)</th>
                <th className="p-4 text-right">Received (Net)</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredLogs.map((rec) => {
                const isProfit = (rec.currentLiveBaseAmount || 0) >= (rec.earnedBaseValue || 0);
                
                // Safe Custom Logo Fetch
                const coinObj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === rec.coin.toUpperCase());
                const dbCoin = cryptoDatabase.find(c => c.symbol.toUpperCase() === rec.coin.toUpperCase());
                const coinLogo = coinObj?.logo || dbCoin?.logo;

                return (
                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 p-1 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                         <MarketIcon symbol={rec.coin} apiImage={livePrices[rec.coin]?.image} customLogo={coinLogo} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-white text-sm">{rec.platform}</p>
                        {/* 🚀 GLOBAL DATE IN TABLE */}
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                        </p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                       {(rec.methods || []).map((m, i) => (
                          <span key={i} className="text-[8px] px-1.5 py-0.5 bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 font-black uppercase tracking-widest rounded border border-yellow-200 dark:border-yellow-900/50">
                            {m}
                          </span>
                       ))}
                    </div>
                  </td>

                  <td className="p-4">
                    {rec.daysSinceLast !== null ? (
                      <div className="flex items-center gap-2">
                        <HiOutlineClock className={rec.daysSinceLast > 15 ? 'text-rose-500' : 'text-emerald-500'} size={18} />
                        <div>
                          <p className={`font-black text-sm ${rec.daysSinceLast > 15 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{rec.daysSinceLast} Days</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest">Since last withdraw</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 italic">First Entry</span>
                    )}
                  </td>

                  {/* 🚀 SMART COLUMN: Shows Historical vs Live Value */}
                  <td className="p-4 text-right">
                    <p className="text-sm font-black text-slate-400 line-through decoration-rose-500/50">
                      {currencySymbol}{(rec.earnedBaseValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                    <div className={`flex items-center justify-end gap-1 text-[11px] font-black ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isProfit ? <HiOutlineTrendingUp/> : <HiOutlineTrendingDown/>}
                      {currencySymbol}{(rec.currentLiveBaseAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>
                    <p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Recorded vs Live</p>
                  </td>

                  <td className="p-4 text-right">
                    <p className="text-lg font-black tracking-tight text-slate-800 dark:text-white">
                      +{rec.receivedAmount} <span className="text-xs text-slate-500 uppercase">{rec.coin}</span>
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[9px] font-bold mt-1">
                       <span className="text-slate-400 flex items-center gap-0.5"><FaWallet/> To {rec.destinationWallet}</span>
                       {rec.fee > 0 && <span className="text-rose-500 ml-2">Fee: -{rec.fee}</span>}
                    </div>
                  </td>

                  <td className="p-4 pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 rounded-xl transition-all shadow-sm"><HiOutlinePencil size={18} /></button>
                      <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 hover:bg-rose-100 rounded-xl transition-all shadow-sm"><HiOutlineTrash size={18} /></button>
                    </div>
                  </td>
                </tr>
              )})}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500 font-bold">No withdrawals logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🚀 SMART WITHDRAWAL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            
            <div className="px-6 sm:px-8 py-5 flex justify-between items-center transition-colors duration-300 bg-yellow-500 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineSparkles size={24}/> {editingId ? 'Edit Withdrawal' : 'Log Website Withdrawal'}</h3>
              <button type="button" onClick={closeModal} className="p-2 bg-white/20 rounded-full"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Website Name</label>
                  {isCustomPlatform ? (
                    <div className="flex gap-2">
                      <input type="text" autoFocus required placeholder="Website name..." value={formData.platform} onChange={(e)=>setFormData({...formData, platform: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                      <button type="button" onClick={()=>{setIsCustomPlatform(false); setFormData({...formData, platform: microEarnPlatforms[0]});}} className="px-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500"><HiOutlineX size={20}/></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <select value={microEarnPlatforms.includes(formData.platform) ? formData.platform : 'CUSTOM'} onChange={(e) => { if(e.target.value === 'CUSTOM'){ setIsCustomPlatform(true); setFormData({...formData, platform: ''}); } else { setFormData({...formData, platform: e.target.value}); } }} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none">
                        {microEarnPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="CUSTOM" className="font-black text-yellow-600">✨ Add Custom</option>
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Coin</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center overflow-hidden z-10 pointer-events-none">
                      <MarketIcon symbol={formData.coin} apiImage={livePrices[formData.coin]?.image} customLogo={selectedCryptos.find(c=>(typeof c === 'string' ? c : c.symbol)===formData.coin)?.logo} />
                    </div>
                    <select value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className="w-full pl-14 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none cursor-pointer appearance-none">
                      {cryptoSymbols.length > 0 ? cryptoSymbols.map(c => <option key={c} value={c}>{c}</option>) : <option value="USDT">USDT (Default)</option>}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>

              {/* 🚀 SMART MULTI-SELECT TAGS FOR EFFORT TRACKING */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">How did you earn this? (Select multiple)</label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {earningMethodsList.map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => handleMethodToggle(method)}
                      className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all border ${
                        formData.methods.includes(method) 
                          ? 'bg-yellow-500 text-white border-yellow-500 shadow-md shadow-yellow-500/20' 
                          : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-yellow-300'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Total Withdrawn</label>
                  <input type="number" step="any" required value={formData.withdrawnAmount} onChange={(e) => setFormData({...formData, withdrawnAmount: e.target.value})} placeholder="e.g. 0.05" className="w-full p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold dark:text-white outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">Net Received (In Wallet)</label>
                  <input type="number" step="any" required value={formData.receivedAmount} onChange={(e) => setFormData({...formData, receivedAmount: e.target.value})} placeholder="Actual amount" className="w-full p-3 bg-white dark:bg-slate-900 border border-emerald-400 dark:border-emerald-500 shadow-inner rounded-xl font-black text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
                <div className="col-span-2 text-[10px] font-black text-rose-500 text-right uppercase tracking-widest">
                  Site Network Fee: {Math.max(0, (parseFloat(formData.withdrawnAmount || 0) - parseFloat(formData.receivedAmount || 0))).toFixed(8).replace(/\.?0+$/, '')} {formData.coin}
                </div>
              </div>

              {/* 🚀 EXPANDED WALLET DESTINATIONS */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1"><FaWallet/> Sent To Wallet</label>
                  {isCustomWallet ? (
                    <div className="flex gap-2">
                      <input type="text" autoFocus required placeholder="Wallet name..." value={formData.destinationWallet} onChange={(e)=>setFormData({...formData, destinationWallet: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                      <button type="button" onClick={()=>{setIsCustomWallet(false); setFormData({...formData, destinationWallet: popularCryptoWallets[0]});}} className="px-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500"><HiOutlineX size={20}/></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <select value={popularCryptoWallets.includes(formData.destinationWallet) ? formData.destinationWallet : 'CUSTOM'} onChange={(e) => { if(e.target.value === 'CUSTOM'){ setIsCustomWallet(true); setFormData({...formData, destinationWallet: ''}); } else { setFormData({...formData, destinationWallet: e.target.value}); } }} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none">
                        {popularCryptoWallets.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="CUSTOM" className="font-black text-yellow-600">✨ Add Custom Wallet</option>
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                    </div>
                  )}
                </div>
                {/* 🚀 GLOBAL DATE APPLIED FOR MODAL */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                    <span>Date</span>
                    <span className="text-yellow-600">{formatGlobalDate ? formatGlobalDate(formData.date, 'short') : ''}</span>
                  </label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                </div>
              </div>

              <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black text-white text-lg transition-all shadow-xl active:scale-95 disabled:opacity-70 bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20`}>
                {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl mx-auto" /> : (editingId ? 'Update Withdrawal' : 'Log Withdrawal & Auto-Sync')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 rounded-full flex items-center justify-center text-3xl mb-4"><HiOutlineLockClosed /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">Deleting this record will also remove it from your Crypto Engine and Income Log.</p>
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

export default MicroEarn;