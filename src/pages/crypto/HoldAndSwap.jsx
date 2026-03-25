import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
// 🚀 FIXED: Changed updateDoc to setDoc for safety
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlineTrendingUp, HiOutlineTrendingDown, 
  HiOutlinePlus, HiOutlineSparkles, HiOutlineX, 
  HiOutlinePencil, HiOutlineTrash, HiOutlineClock, HiOutlineRefresh,
  HiOutlineLockClosed, HiOutlineChevronDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaExchangeAlt, FaShoppingBag, FaBullseye, FaWallet, FaCoins } from 'react-icons/fa';

// Default DB just in case Context is slow
const defaultCryptoDatabase = [
  { id: 'bitcoin', symbol: 'BTC', fallbackPrice: 65000 },
  { id: 'ethereum', symbol: 'ETH', fallbackPrice: 3500 },
  { id: 'tether', symbol: 'USDT', fallbackPrice: 1.00 },
  { id: 'ripple', symbol: 'XRP', fallbackPrice: 0.60 },
  { id: 'binancecoin', symbol: 'BNB', fallbackPrice: 500 }
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

const HoldAndSwap = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // USER CUSTOM COINS STATE (To sync full data including Contract Addresses)
  const [customUserCoins, setCustomUserCoins] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];

  // 🚀 Extracting string symbols from object array
  const cryptoSymbols = useMemo(() => {
    return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
  }, [selectedCryptos]);
  
  const [formData, setFormData] = useState({
    coin: cryptoSymbols.length > 0 ? cryptoSymbols[0] : 'BTC', 
    amount: '', 
    entryPrice: '', 
    wallet: 'FaucetPay',
    date: todayDate
  });

  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [livePrices, setLivePrices] = useState({});

  useEffect(() => {
    if (!user) return;
    const recordsRef = collection(db, "users", user.uid, "holdAndSwap");
    const q = query(recordsRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecords(dbRecords);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Custom User Coins for Contract MetaData
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().customCoins) {
        setCustomUserCoins(userSnap.data().customCoins);
      }
    };
    fetchUserData();
  }, [user]);

  // Merge Context Selected Cryptos + Custom Coins + Default Database
  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    defaultCryptoDatabase.forEach(c => coinMap.set(c.symbol.toUpperCase(), c));
    
    // Add selected cryptos from context if they are objects
    selectedCryptos.forEach(c => {
       if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c);
    });

    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c, logo: c.logo || existing?.logo });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  // 🚀 REBUILT: HYBRID MULTI-TIER PRICE FETCHER FOR TABLE (CG + GeckoTerminal)
  const fetchTablePrices = async () => {
    const coinsToFetch = [...new Set([...cryptoSymbols, ...records.map(r => r.coin)])];
    if (coinsToFetch.length === 0) return;

    try {
      const forexRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const forexJson = await forexRes.json();
      const userBaseRate = forexJson.rates[baseCurrency] || 1;

      let cgJson = {};
      let geckoTerminalData = {};
      const normalCoins = [];
      const contractCoins = [];

      // Sort coins based on fetchMode
      coinsToFetch.forEach(sym => {
         const dbCoin = fullDatabase.find(c => c.symbol === sym.toUpperCase());
         if (dbCoin?.fetchMode === 'contract' && dbCoin.network && dbCoin.contractAddress) {
            contractCoins.push(dbCoin);
         } else {
            normalCoins.push(dbCoin?.id || sym.toLowerCase());
         }
      });

      // Fetch Normal Coins (CoinGecko)
      if (normalCoins.length > 0) {
         try {
           const ids = [...new Set(normalCoins)].join(',');
           const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
           if (cgRes.ok) {
               cgJson = await cgRes.json();
           }
         } catch(e) { console.warn("CoinGecko API blocked or limited"); }
      }

      // Fetch Custom Contract Coins (GeckoTerminal)
      for (const customCoin of contractCoins) {
         try {
            const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${customCoin.network}/tokens/${customCoin.contractAddress}`);
            if (gtRes.ok) {
               const gtJson = await gtRes.json();
               geckoTerminalData[customCoin.id] = {
                  usd: parseFloat(gtJson.data.attributes.price_usd)
               };
            }
         } catch (error) { console.warn(`GeckoTerminal failed for ${customCoin.symbol}`); }
      }

      // Combine Results
      const newPrices = {};

      await Promise.all(coinsToFetch.map(async (sym) => {
        const dbCoin = fullDatabase.find(c => c.symbol === sym.toUpperCase()) || {};
        const searchId = dbCoin.id || sym.toLowerCase();
        
        let priceInUsd = null;

        if (dbCoin.fetchMode === 'contract') {
           priceInUsd = geckoTerminalData[searchId]?.usd;
        } else {
           priceInUsd = cgJson[searchId]?.usd;
        }

        // Binance Fallback
        if (!priceInUsd) {
          try {
            const bSym = searchId === 'tether' ? 'BTCUSDT' : `${sym.toUpperCase()}USDT`;
            const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${bSym}`);
            if (bRes.ok) {
              const bData = await bRes.json();
              priceInUsd = (searchId === 'tether' ? 1.00 : parseFloat(bData.price));
            }
          } catch(err) {}
        }

        // Final Hardcoded Fallback
        if (!priceInUsd && dbCoin.fallbackPrice) {
          priceInUsd = dbCoin.fallbackPrice;
        }

        if (priceInUsd) {
           newPrices[sym.toUpperCase()] = priceInUsd * userBaseRate;
        }
      }));

      setLivePrices(prev => ({...prev, ...newPrices}));
    } catch (error) {
      console.error("Error updating table prices:", error);
    }
  };

  useEffect(() => {
    if (records.length > 0) fetchTablePrices();
    const interval = setInterval(fetchTablePrices, 60000); 
    return () => clearInterval(interval);
  }, [cryptoSymbols, records.length, baseCurrency, fullDatabase]);

  // 🚀 REBUILT: HYBRID LIVE PRICE FETCHER FOR FORM
  const fetchLivePriceForForm = async () => {
    if (!formData.coin) return alert("Please select a coin first!");
    setIsFetchingLive(true);
    try {
      const forexRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const forexJson = await forexRes.json();
      const userBaseRate = forexJson.rates[baseCurrency] || 1;

      const symbol = formData.coin;
      const dbCoin = fullDatabase.find(c => c.symbol === symbol.toUpperCase()) || {};
      const searchId = dbCoin?.id || symbol.toLowerCase();
      
      let priceInUsd = null;

      // 1. Contract Mode (GeckoTerminal)
      if (dbCoin.fetchMode === 'contract' && dbCoin.network && dbCoin.contractAddress) {
         try {
            const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${dbCoin.network}/tokens/${dbCoin.contractAddress}`);
            if (gtRes.ok) {
               const gtJson = await gtRes.json();
               priceInUsd = parseFloat(gtJson.data.attributes.price_usd);
            }
         } catch(e) {}
      } 
      // 2. Normal Mode (CoinGecko)
      else {
         try {
           const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${searchId}&vs_currencies=usd`);
           const cgJson = await cgRes.json();
           if (cgJson[searchId] && cgJson[searchId].usd) priceInUsd = cgJson[searchId].usd;
         } catch(e){}
      }

      // 3. Binance Fallback
      if (!priceInUsd) {
         try {
           const bSym = searchId === 'tether' ? 'BTCUSDT' : `${symbol.toUpperCase()}USDT`;
           const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${bSym}`);
           if (bRes.ok) {
             const bData = await bRes.json();
             priceInUsd = (searchId === 'tether' ? 1.00 : parseFloat(bData.price));
           }
         } catch(e){}
      }

      // 4. Hardcoded Fallback
      if (!priceInUsd && dbCoin && dbCoin.fallbackPrice) {
         priceInUsd = dbCoin.fallbackPrice;
      }

      if (priceInUsd) {
        setFormData(prev => ({ ...prev, entryPrice: (priceInUsd * userBaseRate).toFixed(6) }));
      } else {
        alert("Price stuck or not found. Please enter manually.");
      }
    } catch (error) {
      alert("Network Error!");
    } finally {
      setIsFetchingLive(false);
    }
  };

  // 🚀 ADVANCED AI SIGNALS
  const getAiSignal = (profitPct) => {
    if (profitPct >= 15) {
      return { label: 'SWAP TO USDT (PROFIT)', tooltip: 'Covers swap fees and secures heavy profit.', bg: 'bg-emerald-500', text: 'text-white', icon: <FaExchangeAlt /> };
    }
    if (profitPct >= 5 && profitPct < 15) {
      return { label: 'HOLD (BEATS FEE)', tooltip: 'In profit, but wait for bigger pump to counter 2% swap fees.', bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', icon: <HiOutlineSparkles /> };
    }
    if (profitPct > -5 && profitPct < 5) {
      return { label: 'STAKE / EARN APR', tooltip: 'Market is sideways. Stake to earn interest rather than sitting idle.', bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', icon: <FaCoins /> };
    }
    if (profitPct <= -15) {
      return { label: 'BUY THE DIP', tooltip: 'Market is heavily down. Good time to average out your entry.', bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', icon: <FaShoppingBag /> };
    }
    return { label: 'HOLD ASSET', tooltip: 'Minor loss detected. Do not sell.', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', icon: <HiOutlineClock /> };
  };

  // 🚀 REPORT DOWNLOAD LOGIC
  const handleDownloadReport = (format) => {
    if (records.length === 0) return alert("No tracked assets found.");

    const reportData = records.map(rec => {
      const livePrice = livePrices[rec.coin] || rec.entryPrice;
      const profitPct = (((livePrice - rec.entryPrice) / rec.entryPrice) * 100);
      const isProfit = profitPct >= 0;
      
      const totalInvestedBase = rec.amount * rec.entryPrice;
      const currentLiveBase = rec.amount * livePrice;
      const pnlBase = currentLiveBase - totalInvestedBase;

      const ai = getAiSignal(profitPct);

      return {
        // 🚀 GLOBAL DATE FOR PDF/EXCEL EXPORT
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        asset: `${rec.amount} ${rec.coin} (${rec.wallet})`,
        entryPrice: `${currencySymbol}${rec.entryPrice.toLocaleString(undefined, {maximumFractionDigits: 6})}`,
        livePrice: `${currencySymbol}${livePrice.toLocaleString(undefined, {maximumFractionDigits: 6})}`,
        pnl: `${isProfit ? '+' : ''}${currencySymbol}${pnlBase.toLocaleString(undefined, {minimumFractionDigits: 2})} (${profitPct.toFixed(2)}%)`,
        aiAction: ai.label
      };
    });

    const columns = [
      { header: 'Logged Date', key: 'date' },
      { header: 'Asset / Storage', key: 'asset' },
      { header: 'Target Entry Price', key: 'entryPrice' },
      { header: 'Current Market Price', key: 'livePrice' },
      { header: 'Unrealized P/L', key: 'pnl' },
      { header: 'AI Recommendation', key: 'aiAction' }
    ];

    const fileName = `Hold_And_Swap_Analysis`;
    const reportTitle = `Hold & Swap AI Manager - Performance Report`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");

    const recordData = {
      coin: formData.coin,
      amount: parseFloat(formData.amount),
      entryPrice: parseFloat(formData.entryPrice),
      wallet: formData.wallet || 'Binance',
      date: formData.date || todayDate,
      timestamp: new Date().getTime() 
    };

    try {
      const recordsRef = collection(db, "users", user.uid, "holdAndSwap");
      if (editingId) {
        // 🚀 FIXED: Replaced updateDoc with setDoc for 100% crash safety
        await setDoc(doc(db, "users", user.uid, "holdAndSwap", editingId), recordData, { merge: true });
      } else {
        await addDoc(recordsRef, recordData);
      }
      closeModal();
    } catch (error) {
      alert("Failed to save. Check your connection.");
    }
  };

  const handleEdit = (rec) => {
    setFormData({ 
      coin: rec.coin, 
      amount: rec.amount, 
      entryPrice: rec.entryPrice, 
      wallet: rec.wallet || '', 
      date: rec.date || todayDate
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
      
      await deleteDoc(doc(db, "users", user.uid, "holdAndSwap", deleteContext.id));
      setDeleteContext(null); 
    } catch (error) { setPinError("Verification failed."); } finally { setIsVerifying(false); }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ 
      coin: cryptoSymbols.length > 0 ? cryptoSymbols[0] : 'BTC', 
      amount: '', entryPrice: '', wallet: 'FaucetPay', date: todayDate
    });
  };

  const totalInvested = records.reduce((acc, rec) => acc + (rec.amount * rec.entryPrice), 0);
  const totalCurrent = records.reduce((acc, rec) => acc + (rec.amount * (livePrices[rec.coin] || rec.entryPrice)), 0);
  const totalProfit = totalCurrent - totalInvested;
  const profitPercentage = totalInvested > 0 ? ((totalProfit / totalInvested) * 100).toFixed(2) : 0;

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      <datalist id="wallet-suggestions">
        <option value="FaucetPay" />
        <option value="Binance" />
        <option value="Trust Wallet" />
        <option value="Phantom" />
        <option value="MetaMask" />
        <option value="Payeer" />
        <option value="CoinDCX" />
      </datalist>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><FaBullseye size={24} /></div>
            <h1 className="text-3xl font-black dark:text-white tracking-tight">AI Swap & Stake Manager</h1>
          </div>
          <p className="text-sm font-bold text-slate-500 max-w-xl">
            Never lose money to hidden swap fees. Our AI monitors your assets and tells you exactly when to Swap, Hold, Buy the Dip, or Stake for APR.
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

          <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 md:px-6 py-3.5 rounded-2xl font-black text-xs md:text-sm shadow-lg shadow-blue-500/30 transition-all active:scale-95 whitespace-nowrap">
            <HiOutlinePlus size={20} className="hidden sm:inline" /> 
            <span className="hidden sm:inline">Add Target Asset</span>
            <span className="sm:hidden">Add Target</span>
          </button>
        </div>
      </div>

      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Target Value</p>
          <p className="text-3xl font-black dark:text-white">{currencySymbol}{totalInvested.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm relative">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Live Value</p>
          <p className="text-3xl font-black dark:text-white">{currencySymbol}{totalCurrent.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className={`p-6 border rounded-3xl shadow-lg relative overflow-hidden ${totalProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-500/30'}`}>
          <div className="absolute -right-6 -top-6 opacity-10"><HiOutlineSparkles size={100} /></div>
          <p className="text-[11px] font-black uppercase tracking-widest mb-1 opacity-70">Unrealized P/L</p>
          <div className="flex items-end gap-3">
            <p className={`text-3xl font-black ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {totalProfit >= 0 ? '+' : ''}{currencySymbol}{totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </p>
            <div className={`flex items-center gap-1 text-sm font-black mb-1 ${totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalProfit >= 0 ? <HiOutlineTrendingUp size={16} /> : <HiOutlineTrendingDown size={16} />}
              {profitPercentage}%
            </div>
          </div>
        </div>
      </div>

      {/* TABLE DATA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
          <h2 className="text-lg font-black dark:text-white flex items-center gap-2">
            <FaExchangeAlt className="text-blue-500" /> Watchlist Signals
          </h2>
          <button onClick={fetchTablePrices} className="text-[10px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:text-blue-500 flex items-center gap-1 transition-colors">
            <HiOutlineRefresh /> Sync Live Prices
          </button>
        </div>

        {isLoading ? (
          <div className="p-16 text-center">
            <HiOutlineRefresh className="mx-auto text-4xl text-slate-300 dark:text-slate-600 animate-spin mb-4" />
            <p className="text-slate-500 font-bold animate-pulse">Loading strategy signals...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 shadow-sm">
            <FaBullseye className="mx-auto text-5xl text-slate-200 dark:text-slate-800 mb-4" />
            <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2">No Assets Tracked</h3>
            <p className="text-slate-500 font-semibold">Log your coins to track whether to swap, hold or stake.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 pl-6">Asset & Wallet</th>
                  <th className="p-4">Holdings & Target</th>
                  <th className="p-4">Live Momentum</th>
                  <th className="p-4">AI Smart Action</th>
                  <th className="p-4 pr-6 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {records.map((rec) => {
                  const livePrice = livePrices[rec.coin] || rec.entryPrice;
                  const profitPct = (((livePrice - rec.entryPrice) / rec.entryPrice) * 100);
                  const isProfit = profitPct >= 0;
                  const ai = getAiSignal(profitPct);
                  
                  // 🚀 Safe Logo Retrieval
                  const coinObj = fullDatabase.find(c => c.symbol === rec.coin.toUpperCase());
                  const coinLogo = coinObj?.logo || null;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 p-1 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                             <MarketIcon symbol={rec.coin} apiImage={null} customLogo={coinLogo} />
                          </div>
                          <div>
                            <p className="font-black dark:text-white text-sm uppercase">{rec.coin}</p>
                            {/* 🚀 GLOBAL DATE IN TABLE */}
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                              {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-black dark:text-white text-sm">{rec.amount} <span className="text-[10px] text-slate-500 uppercase">{rec.coin}</span></p>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                          <FaWallet /> {rec.wallet}
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Logged At: {currencySymbol}{rec.entryPrice.toLocaleString(undefined, {maximumFractionDigits: 6})}</p>
                      </td>
                      <td className="p-4">
                        <div className={`inline-flex flex-col items-start px-3 py-1.5 rounded-xl border ${isProfit ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' : 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30'}`}>
                          <p className={`text-xs font-black flex items-center gap-1 ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isProfit ? <HiOutlineTrendingUp size={14} /> : <HiOutlineTrendingDown size={14} />}
                            {isProfit ? '+' : ''}{profitPct.toFixed(2)}%
                          </p>
                          <p className="text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-widest">
                            Live: {currencySymbol}{livePrice.toLocaleString(undefined, {maximumFractionDigits: 6})}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div title={ai.tooltip} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase ${ai.bg} ${ai.text} border border-transparent shadow-sm cursor-help`}>
                          {ai.icon} {ai.label}
                        </div>
                      </td>
                      <td className="p-4 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition-all shadow-sm">
                            <HiOutlinePencil size={18} />
                          </button>
                          <button onClick={() => initiateDelete(rec)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all shadow-sm">
                            <HiOutlineTrash size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🚀 SMART MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            
            <div className="px-6 sm:px-8 py-5 flex justify-between items-center bg-blue-600 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2">
                <FaBullseye size={20} /> {editingId ? 'Edit Ledger Entry' : 'Log New Asset'}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 rounded-full transition-colors hover:bg-white/30">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Coin</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center overflow-hidden z-10 pointer-events-none">
                       {/* 🚀 Safe Modal Icon Mapping */}
                      <MarketIcon symbol={formData.coin} apiImage={null} customLogo={fullDatabase.find(c=>c.symbol===formData.coin)?.logo} />
                    </div>
                    <select required value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className="w-full pl-14 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none cursor-pointer appearance-none">
                      {cryptoSymbols.length > 0 ? cryptoSymbols.map(coin => <option key={coin} value={coin}>{coin}</option>) : <option value="BTC">BTC (Default)</option>}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Quantity</label>
                  <input type="number" step="any" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="e.g. 200" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-2xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 tracking-widest" />
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1">
                    Value To Track From ({currencySymbol})
                  </label>
                  <button type="button" onClick={fetchLivePriceForForm} disabled={isFetchingLive || !formData.coin} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-colors">
                    <HiOutlineRefresh className={isFetchingLive ? "animate-spin" : ""} /> Get Current Value
                  </button>
                </div>
                <input type="number" step="any" required value={formData.entryPrice} onChange={(e) => setFormData({...formData, entryPrice: e.target.value})} placeholder="e.g. 14500" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1"><FaWallet/> Storage Wallet</label>
                  <input type="text" required list="wallet-suggestions" value={formData.wallet} onChange={(e) => setFormData({...formData, wallet: e.target.value})} placeholder="e.g. FaucetPay" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
                
                {/* 🚀 GLOBAL DATE APPLIED FOR MODAL */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between ml-1">
                    <span>Date</span>
                    <span className="text-blue-500">{formatGlobalDate ? formatGlobalDate(formData.date, 'short') : ''}</span>
                  </label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl font-black transition-transform active:scale-95 shadow-xl shadow-blue-500/20">
                {editingId ? 'Update Target' : 'Start Tracking Asset'}
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
              <p className="text-sm font-bold text-slate-500 mt-2">Deleting this record will alter your total invested tracking.</p>
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

export default HoldAndSwap;