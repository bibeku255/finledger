import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

// 🚀 FIXED: Removed unused/crashing icons
import { 
  HiOutlineSwitchHorizontal, HiOutlineRefresh, 
  HiOutlineDocumentText, HiOutlineArrowRight, HiOutlineTrash,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineChevronDown,
  HiOutlineDownload, HiOutlineTable, HiOutlineCalendar,
  HiOutlineShieldCheck
} from 'react-icons/hi';
import { 
  FaGlobe, FaUniversity, FaWallet, FaShieldAlt, FaExchangeAlt, 
  FaGasPump, FaBitcoin, FaArrowRight
} from 'react-icons/fa';

const cryptoPlatformsList = [
  "CoinDCX", "WazirX", "ZebPay", "Mudrex", "SunCrypto",
  "Binance", "Coinbase", "Bybit", "KuCoin", "OKX", "Kraken", "Mexc",
  "FaucetPay", "Trust Wallet", "MetaMask", "Phantom", "NC Wallet", "Payeer",
  "Hardware Wallet (Ledger/Trezor)", "Other Wallet"
];

const fiatFlagMap = {
  USD: 'us', INR: 'in', NPR: 'np', EUR: 'eu', GBP: 'gb', CAD: 'ca', AUD: 'au', 
  JPY: 'jp', AED: 'ae', SAR: 'sa', QAR: 'qa', KWD: 'kw', OMR: 'om', BHD: 'bh',
  PKR: 'pk', BDT: 'bd', SGD: 'sg', CNY: 'cn'
};

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// 🚀 Premium Vault Selector Card (High Contrast)
const VaultSelector = ({ type, value, onChange, options, icon: Icon, color, label }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
      <Icon size={12} className={color} /> {label}
    </label>
    <div className="relative">
      <select 
        value={value} 
        onChange={onChange}
        className="w-full pl-4 pr-10 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer appearance-none transition-all shadow-sm"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  </div>
);

const CapitalShifting = () => {
  // 🚀 FETCHING BASE CURRENCY, FIAT WATCHLIST, AND CRYPTO WATCHLIST
  const { user, baseCurrency = 'INR', selectedFiats = [], selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  // 🚀 STRICT DYNAMIC FIAT LIST
  const availableFiats = useMemo(() => {
    return Array.from(new Set([baseCurrency, ...selectedFiats]));
  }, [baseCurrency, selectedFiats]);

  // 🚀 STRICT DYNAMIC CRYPTO LIST (Plus USDT as a default base for fees)
  const availableCryptos = useMemo(() => {
    const customSymbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    return Array.from(new Set(["USDT", ...customSymbols])).map(s => s.toUpperCase());
  }, [selectedCryptos]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [existingVaultNames, setExistingVaultNames] = useState([]);

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

  useEffect(() => {
     if(!user) return;
     const fetchVaults = async () => {
        const qBank = query(collection(db, "users", user.uid, "bankWallet"));
        const snapBank = await getDocs(qBank);
        const qOnline = query(collection(db, "users", user.uid, "onlineWallet"));
        const snapOnline = await getDocs(qOnline);
        const names = new Set();
        snapBank.docs.forEach(d => { if(d.data().bankName) names.add(d.data().bankName) });
        snapOnline.docs.forEach(d => { if(d.data().walletName) names.add(d.data().walletName) });
        setExistingVaultNames(Array.from(names));
     };
     fetchVaults();
  }, [user]);

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    selectedCryptos.forEach(c => {
       if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c);
    });
    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  const [transferData, setTransferData] = useState({
    fromVault: 'online', fromSubWallet: '', fromCryptoPlatform: cryptoPlatformsList[0],
    fromAsset: availableFiats.includes('USD') ? 'USD' : baseCurrency, grossAmount: '', fromExchangeRate: 1, 
    networkFeeAsset: availableFiats.includes('USD') ? 'USD' : baseCurrency, networkFee: '', networkFeeExchangeRate: 1,
    routingPlatform: '', routingAgent: '', 
    toVault: 'bank', toSubWallet: '', toCryptoPlatform: cryptoPlatformsList[0],
    toAsset: baseCurrency, netReceived: '', toExchangeRate: 1, taxAndFees: '', 
    date: new Date().toISOString().split('T')[0], referenceId: '' 
  });

  // Keep fee asset synced with fromAsset initially
  useEffect(() => {
    setTransferData(prev => ({ ...prev, networkFeeAsset: prev.fromAsset }));
  }, [transferData.fromAsset]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "capitalShifts"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setShiftHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingHistory(false);
    });
    return () => unsubscribe();
  }, [user]);

  const totalShifts = shiftHistory.length;
  const totalVolume = useMemo(() => 
    shiftHistory.reduce((acc, s) => acc + (Number(s.grossAmount) || 0) * (Number(s.fromExchangeRate) || 1), 0)
  , [shiftHistory]);

  const fetchLiveRates = async () => {
    setIsFetchingRate(true);
    try {
      let newFromRate = transferData.fromExchangeRate;
      let newToRate = transferData.toExchangeRate;
      let newFeeRate = transferData.networkFeeExchangeRate;

      const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fiatData = await fiatRes.json();
      const usdToBase = fiatData.rates[baseCurrency] || 1;

      const getAssetRate = async (assetSym) => {
        if (assetSym === baseCurrency) return 1;
        // Check if fiat
        if (availableFiats.includes(assetSym) || assetSym.length === 3) {
          try {
            const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${assetSym}`);
            const data = await res.json();
            return data.rates[baseCurrency] || 1;
          } catch(e) {}
        }
        
        if (assetSym === 'USDT' || assetSym === 'USDC') return usdToBase;
        
        const upperSym = assetSym.toUpperCase();
        const coinObj = fullDatabase.find(c => c.symbol === upperSym) || {};
        const searchId = coinObj?.id || assetSym.toLowerCase();
        let priceUsd = null;

        if (coinObj.fetchMode === 'contract' && coinObj.network && coinObj.contractAddress) {
           try {
              const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${coinObj.network}/tokens/${coinObj.contractAddress}`);
              if (gtRes.ok) {
                 const gtJson = await gtRes.json();
                 priceUsd = parseFloat(gtJson.data.attributes.price_usd);
              }
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
             const binanceSymbol = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
             const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
             if (bRes.ok) {
               const bData = await bRes.json();
               priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
             }
          } catch (e) { }
        }

        const finalPrice = priceUsd || (coinObj?.fallbackPrice || 0);
        return finalPrice * usdToBase; 
      };

      if (transferData.fromAsset !== baseCurrency) {
        const rate = await getAssetRate(transferData.fromAsset);
        if (rate) newFromRate = Number(rate).toFixed(4);
      }
      if (transferData.toAsset !== baseCurrency) {
        const rate = await getAssetRate(transferData.toAsset);
        if (rate) newToRate = Number(rate).toFixed(4);
      }
      if (transferData.networkFeeAsset !== baseCurrency) {
        const rate = await getAssetRate(transferData.networkFeeAsset);
        if (rate) newFeeRate = Number(rate).toFixed(4);
      }

      setTransferData(prev => ({ 
        ...prev, 
        fromExchangeRate: newFromRate, 
        toExchangeRate: newToRate,
        networkFeeExchangeRate: newFeeRate 
      }));
    } catch (error) {
      alert("Failed to fetch live market rates. Please input manually.");
    } finally {
      setIsFetchingRate(false);
    }
  };

  const isFromForeign = transferData.fromAsset !== baseCurrency;
  const isToForeign = transferData.toAsset !== baseCurrency;
  const isFeeForeign = transferData.networkFeeAsset !== baseCurrency;

  const fromFinalBase = (parseFloat(transferData.grossAmount) || 0) * (parseFloat(transferData.fromExchangeRate) || 1);
  const toFinalBase = (parseFloat(transferData.netReceived) || 0) * (parseFloat(transferData.toExchangeRate) || 1);
  const feeFinalBase = (parseFloat(transferData.networkFee) || 0) * (parseFloat(transferData.networkFeeExchangeRate) || 1);
  const destinationTaxBase = (parseFloat(transferData.taxAndFees) || 0) * (parseFloat(transferData.toExchangeRate) || 1);

  const handleDownloadReport = (format) => {
    if (shiftHistory.length === 0) return alert("No transfer records found to download.");
    const reportData = shiftHistory.map(shift => {
      let fromDetails = `${Number(shift.grossAmount).toLocaleString()} ${shift.fromAsset} (From ${shift.fromVault}${shift.fromSubWallet ? ` - ${shift.fromSubWallet}` : ''})`;
      if (shift.fromVault === 'crypto' && shift.fromCryptoPlatform) fromDetails += ` - ${shift.fromCryptoPlatform}`;
      let toDetails = `${Number(shift.netReceived).toLocaleString()} ${shift.toAsset} (To ${shift.toVault}${shift.toSubWallet ? ` - ${shift.toSubWallet}` : ''})`;
      if (shift.toVault === 'crypto' && shift.toCryptoPlatform) toDetails += ` - ${shift.toCryptoPlatform}`;
      let feeDetails = 'None';
      if (shift.networkFee > 0 || shift.taxAndFees > 0) {
        feeDetails = [];
        if (shift.networkFee > 0) feeDetails.push(`Gas: ${shift.networkFee} ${shift.networkFeeAsset}`);
        if (shift.taxAndFees > 0) feeDetails.push(`Tax: ${shift.taxAndFees} ${shift.toAsset}`);
        feeDetails = feeDetails.join(' | ');
      }
      return {
        date: formatGlobalDate ? formatGlobalDate(shift.date, 'full') : shift.date,
        source: fromDetails, destination: toDetails,
        routing: shift.routingPlatform || 'Direct', fees: feeDetails
      };
    });
    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Source', key: 'source' },
      { header: 'Destination', key: 'destination' }, { header: 'Routing', key: 'routing' }, { header: 'Fees', key: 'fees' }
    ];
    const fileName = `Capital_Shifting_Ledger`;
    const reportTitle = `Internal Capital Shifting & Routing - Audit Report`;
    if (format === 'pdf') downloadPDFReport(reportData, columns, fileName, reportTitle);
    else downloadExcelReport(reportData, columns, fileName);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");
    if ((transferData.fromVault === 'bank' || transferData.fromVault === 'online') && !transferData.fromSubWallet.trim()) {
        return alert("Please specify the exact Source Bank or Wallet Name.");
    }
    if ((transferData.toVault === 'bank' || transferData.toVault === 'online') && !transferData.toSubWallet.trim()) {
        return alert("Please specify the exact Destination Bank or Wallet Name.");
    }
    
    if(window.confirm(`Confirm shifting ${transferData.grossAmount} ${transferData.fromAsset} to ${transferData.toVault.toUpperCase()}?`)) {
      setIsProcessing(true);
      const timestamp = new Date(transferData.date).getTime();
      const shiftId = `SHIFT_${timestamp}_${Math.floor(Math.random() * 1000)}`;
      const totalOutBase = fromFinalBase + feeFinalBase;

      let outRecord = {};
      const fromCollection = transferData.fromVault === 'crypto' ? 'cryptoWalletLogs' : 
                             transferData.fromVault === 'online' ? 'onlineWallet' : 
                             transferData.fromVault === 'bank' ? 'bankWallet' : 'cashWallet';

      if (transferData.fromVault === 'crypto') {
        outRecord = {
          type: 'out', coin: transferData.fromAsset, quantity: parseFloat(transferData.grossAmount), 
          platform: transferData.fromCryptoPlatform, reason: `Shifted to ${transferData.toVault}`, 
          referenceNo: transferData.referenceId, date: transferData.date, timestamp, shiftId, isTransfer: true
        };
      } else {
        outRecord = {
          title: `Transferred to ${transferData.toVault.toUpperCase()}`,
          type: 'out', date: transferData.date, timestamp, currency: transferData.fromAsset,
          foreignAmount: parseFloat(transferData.grossAmount), exchangeRate: parseFloat(transferData.fromExchangeRate) || 1,
          fee: parseFloat(transferData.networkFee) || 0, feeAsset: transferData.networkFeeAsset, 
          feeExchangeRate: parseFloat(transferData.networkFeeExchangeRate) || 1,
          finalBaseAmount: totalOutBase, isTransfer: true, shiftId,
          notes: `Platform: ${transferData.routingPlatform} | Agent: ${transferData.routingAgent}`,
          walletName: transferData.fromSubWallet || 'Capital Shift',
          bankName: transferData.fromSubWallet || 'Capital Shift',
          walletCategory: 'Fiat Wallet', transferType: 'Internal Transfer'
        };
      }

      let inRecord = {};
      const toCollection = transferData.toVault === 'crypto' ? 'cryptoWalletLogs' : 
                           transferData.toVault === 'bank' ? 'bankWallet' : 
                           transferData.toVault === 'online' ? 'onlineWallet' : 'cashWallet';

      if (transferData.toVault === 'crypto') {
         inRecord = {
          type: 'in', coin: transferData.toAsset, quantity: parseFloat(transferData.netReceived), 
          platform: transferData.toCryptoPlatform, reason: `Received from ${transferData.fromVault}`, 
          referenceNo: transferData.referenceId, date: transferData.date, timestamp, shiftId, isTransfer: true
        };
      } else {
        inRecord = {
          title: `Received from ${transferData.fromVault.toUpperCase()}`,
          type: 'in', date: transferData.date, timestamp, currency: transferData.toAsset,
          foreignAmount: parseFloat(transferData.netReceived), exchangeRate: parseFloat(transferData.toExchangeRate) || 1, 
          finalBaseAmount: toFinalBase, fee: parseFloat(transferData.taxAndFees) || 0, 
          isP2P: transferData.routingPlatform ? true : false, isTransfer: true, shiftId, referenceNo: transferData.referenceId,
          notes: `Platform: ${transferData.routingPlatform} | Agent: ${transferData.routingAgent}`,
          walletName: transferData.toSubWallet || 'Capital Shift',
          bankName: transferData.toSubWallet || 'Capital Shift',
          walletCategory: 'Fiat Wallet', transferType: 'Internal Transfer'
        };
      }

      try {
        await addDoc(collection(db, "users", user.uid, fromCollection), outRecord);
        await addDoc(collection(db, "users", user.uid, toCollection), inRecord);
        await addDoc(collection(db, "users", user.uid, "capitalShifts"), { 
            ...transferData, 
            fromSubWallet: transferData.fromVault === 'bank' || transferData.fromVault === 'online' ? transferData.fromSubWallet.trim() : '',
            toSubWallet: transferData.toVault === 'bank' || transferData.toVault === 'online' ? transferData.toSubWallet.trim() : '',
            shiftId, timestamp 
        });

        const totalFeeInBase = feeFinalBase + destinationTaxBase;
        if (totalFeeInBase > 0) {
            const expenseRecord = {
                title: `Capital Shift Fee (${transferData.fromVault} to ${transferData.toVault})`,
                category: "Forex & Bank Charges", 
                vault: transferData.fromVault, 
                subWallet: transferData.fromVault === 'bank' || transferData.fromVault === 'online' ? transferData.fromSubWallet.trim() : '',
                asset: baseCurrency, amount: totalFeeInBase, exchangeRate: 1, finalBaseAmount: totalFeeInBase,
                date: transferData.date, timestamp, linkedExpenseId: shiftId, isSplit: false
            };
            await addDoc(collection(db, "users", user.uid, "expenseLogs"), expenseRecord);
        }

        alert("Capital Shifted Successfully!");
        setTransferData(prev => ({ ...prev, grossAmount: '', networkFee: '', taxAndFees: '', netReceived: '', referenceId: ''}));
      } catch (error) {
        console.error(error);
        alert("Transfer Failed!");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const initiateDeleteShift = (shift) => { setDeleteContext(shift); setPinInput(''); setPinError(''); };

  const executeSecureDeleteShift = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) { setPinError("Please enter your Security PIN."); return; }
    setIsVerifying(true); setPinError('');
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userData?.security?.pinHash || userData?.securityPin || userData?.pin; 
      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect PIN. Deletion blocked! 🛑");
        setIsVerifying(false); return;
      }
      await deleteDoc(doc(db, "users", user.uid, "capitalShifts", deleteContext.id));
      const collectionsToCheck = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
      for (let col of collectionsToCheck) {
        const q = query(collection(db, "users", user.uid, col), where("shiftId", "==", deleteContext.shiftId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (document) => {
          await deleteDoc(doc(db, "users", user.uid, col, document.id));
        });
      }
      const expQuery = query(collection(db, "users", user.uid, "expenseLogs"), where("linkedExpenseId", "==", deleteContext.shiftId));
      const expSnapshot = await getDocs(expQuery);
      expSnapshot.forEach(async (document) => {
          await deleteDoc(doc(db, "users", user.uid, "expenseLogs", document.id));
      });
      setDeleteContext(null); 
    } catch (error) {
      setPinError("System error during deletion. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const vaultOptions = [
    { value: 'crypto', label: '🚀 Crypto Engine' },
    { value: 'online', label: '🌐 Online Wallet' },
    { value: 'bank', label: '🏦 Bank Account' },
    { value: 'cash', label: '💵 Physical Cash' }
  ];

  return (
    // 🚀 FIXED: Global layout scrolling bug resolved (w-full h-auto pb-24)
    <div className="w-full h-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto px-4 md:px-6">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <HiOutlineSwitchHorizontal size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Capital Shifting</h1>
                  <p className="text-sm font-medium text-slate-400">Move assets across vaults with full ledger integrity</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10">
                  <HiOutlineDownload size={16} /> Report
                </button>
                <div className="absolute top-full right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
                  <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg">
                    <HiOutlineDocumentText className="text-rose-400" size={16}/> PDF Document
                  </button>
                  <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg">
                    <HiOutlineTable className="text-emerald-400" size={16}/> Excel (CSV)
                  </button>
                </div>
              </div>
              
              <button 
                type="button" 
                onClick={fetchLiveRates} 
                disabled={isFetchingRate} 
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/30 disabled:opacity-50"
              >
                <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={18}/>
                {isFetchingRate ? 'Syncing...' : 'Sync Rates'}
              </button>
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Shifts</p>
              <p className="text-lg font-black text-white">{totalShifts}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Volume</p>
              <p className="text-lg font-black text-white">{currencySymbol}{totalVolume.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Connected Vaults</p>
              <p className="text-lg font-black text-white">{existingVaultNames.length}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleTransfer} className="space-y-6">
          
          {/* 🔴 SOURCE SECTION (High Contrast) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-300 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 dark:bg-rose-500/5 border-b border-slate-300 dark:border-slate-700">
              <h2 className="text-sm font-black text-rose-600 dark:text-rose-500 uppercase tracking-widest flex items-center gap-2">
                <FaWallet /> Step 1: Source Vault (Deduction)
              </h2>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <VaultSelector 
                  value={transferData.fromVault}
                  onChange={e => setTransferData({...transferData, fromVault: e.target.value, fromSubWallet: ''})}
                  options={vaultOptions}
                  icon={FaWallet}
                  color="text-rose-500"
                  label="Source Vault"
                />
                
                {(transferData.fromVault === 'bank' || transferData.fromVault === 'online') && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">
                      {transferData.fromVault === 'bank' ? 'Bank Name' : 'Wallet Name'}
                    </label>
                    <input 
                      type="text" list="existing-vaults-source" required 
                      value={transferData.fromSubWallet} 
                      onChange={(e) => setTransferData({...transferData, fromSubWallet: e.target.value})} 
                      placeholder={transferData.fromVault === 'bank' ? 'e.g., SBI, Chase' : 'e.g., PayPal, Skrill'}
                      className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm placeholder-slate-400" 
                    />
                    <datalist id="existing-vaults-source">
                      {existingVaultNames.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                )}

                {transferData.fromVault === 'crypto' && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                    <div className="relative">
                      <select 
                        value={transferData.fromCryptoPlatform} 
                        onChange={e => setTransferData({...transferData, fromCryptoPlatform: e.target.value})} 
                        className="w-full pl-4 pr-10 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none shadow-sm"
                      >
                        {cryptoPlatformsList.map(p => <option key={`src-${p}`} value={p}>{p}</option>)}
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                  <div className="relative">
                    <select 
                      value={transferData.fromAsset} 
                      onChange={e => setTransferData({...transferData, fromAsset: e.target.value, fromExchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                      className="w-full pl-4 pr-10 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none shadow-sm"
                    >
                      {/* 🚀 STRICT WATCHLIST RENDERED HERE */}
                      <optgroup label="Fiat">
                        {availableFiats.map(c => <option key={`f-${c}`} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}
                      </optgroup>
                      <optgroup label="Crypto">
                        {availableCryptos.map(c => <option key={`c-${c}`} value={c}>{c}</option>)}
                      </optgroup>
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Gross Amount</label>
                  <input 
                    type="number" step="any" required placeholder="0.00" 
                    value={transferData.grossAmount} 
                    onChange={e => setTransferData({...transferData, grossAmount: e.target.value})} 
                    className="w-full p-4 bg-rose-50 dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-500/50 rounded-xl font-black text-rose-700 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500/50 text-lg shadow-sm placeholder-rose-300 dark:placeholder-rose-900" 
                  />
                </div>
              </div>
              
              {isFromForeign && transferData.fromVault !== 'crypto' && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 flex items-center gap-4">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-400 flex items-center gap-2"><FaExchangeAlt/> Rate:</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-black text-slate-600 dark:text-slate-400">1 {transferData.fromAsset} =</span>
                    <input 
                      type="number" step="any" required value={transferData.fromExchangeRate} 
                      onChange={e => setTransferData({...transferData, fromExchangeRate: e.target.value})} 
                      className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none" 
                    />
                    <span className="text-sm font-black text-slate-600 dark:text-slate-400">{baseCurrency}</span>
                  </div>
                </div>
              )}

              {/* Network Fee */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><FaGasPump/> Fee Asset</label>
                  <div className="relative">
                    <select 
                      value={transferData.networkFeeAsset} 
                      onChange={e => setTransferData({...transferData, networkFeeAsset: e.target.value, networkFeeExchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                      className="w-full pl-4 pr-10 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none shadow-sm"
                    >
                      <optgroup label="Fiat">
                        {availableFiats.map(c => <option key={`f-f-${c}`} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}
                      </optgroup>
                      <optgroup label="Crypto">
                        {availableCryptos.map(c => <option key={`c-f-${c}`} value={c}>{c}</option>)}
                      </optgroup>
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Fee Amount</label>
                  <input 
                    type="number" step="any" placeholder="0.00" value={transferData.networkFee} 
                    onChange={e => setTransferData({...transferData, networkFee: e.target.value})} 
                    className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm placeholder-slate-400" 
                  />
                </div>
                {isFeeForeign && transferData.fromVault !== 'crypto' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Fee Rate</label>
                    <input 
                      type="number" step="any" value={transferData.networkFeeExchangeRate} 
                      onChange={e => setTransferData({...transferData, networkFeeExchangeRate: e.target.value})} 
                      className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm" 
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 🌉 BRIDGE ARROW */}
          <div className="flex justify-center -my-4 relative z-10">
            <div className="w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-500/30 border-4 border-white dark:border-slate-950">
              <FaArrowRight size={22} />
            </div>
          </div>

          {/* 🟣 ROUTING SECTION */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-sm border border-indigo-200 dark:border-indigo-800/50 overflow-hidden">
            <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800/50">
              <h2 className="text-sm font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <FaShieldAlt /> Step 2: Routing Details (Optional)
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Platform / Exchange</label>
                  <input 
                    type="text" placeholder="e.g., CoinDCX, Binance P2P" 
                    value={transferData.routingPlatform} 
                    onChange={e => setTransferData({...transferData, routingPlatform: e.target.value})} 
                    className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm placeholder-slate-400" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Agent / Broker</label>
                  <input 
                    type="text" placeholder="e.g., Friend's UPI" 
                    value={transferData.routingAgent} 
                    onChange={e => setTransferData({...transferData, routingAgent: e.target.value})} 
                    className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm placeholder-slate-400" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 🟢 DESTINATION ARROW */}
          <div className="flex justify-center -my-4 relative z-10">
            <div className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 border-4 border-white dark:border-slate-950">
              <FaArrowRight size={22} />
            </div>
          </div>

          {/* 🟢 DESTINATION SECTION */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-300 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 dark:bg-emerald-500/5 border-b border-slate-300 dark:border-slate-700">
              <h2 className="text-sm font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                <FaUniversity /> Step 3: Destination Vault (Deposit)
              </h2>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <VaultSelector 
                  value={transferData.toVault}
                  onChange={e => setTransferData({...transferData, toVault: e.target.value, toSubWallet: ''})}
                  options={vaultOptions}
                  icon={FaUniversity}
                  color="text-emerald-500"
                  label="Destination Vault"
                />

                {(transferData.toVault === 'bank' || transferData.toVault === 'online') && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">
                      {transferData.toVault === 'bank' ? 'Bank Name' : 'Wallet Name'}
                    </label>
                    <input 
                      type="text" list="existing-vaults-dest" required 
                      value={transferData.toSubWallet} 
                      onChange={(e) => setTransferData({...transferData, toSubWallet: e.target.value})} 
                      placeholder={transferData.toVault === 'bank' ? 'e.g., SBI, Chase' : 'e.g., PayPal, Skrill'}
                      className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm placeholder-slate-400" 
                    />
                    <datalist id="existing-vaults-dest">
                      {existingVaultNames.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                )}

                {transferData.toVault === 'crypto' && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                    <div className="relative">
                      <select 
                        value={transferData.toCryptoPlatform} 
                        onChange={e => setTransferData({...transferData, toCryptoPlatform: e.target.value})} 
                        className="w-full pl-4 pr-10 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer appearance-none shadow-sm"
                      >
                        {cryptoPlatformsList.map(p => <option key={`dest-${p}`} value={p}>{p}</option>)}
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset Received</label>
                  <div className="relative">
                    <select 
                      value={transferData.toAsset} 
                      onChange={e => setTransferData({...transferData, toAsset: e.target.value, toExchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                      className="w-full pl-4 pr-10 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer appearance-none shadow-sm"
                    >
                      <optgroup label="Fiat">
                        {availableFiats.map(c => <option key={`f-t-${c}`} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}
                      </optgroup>
                      <optgroup label="Crypto">
                        {availableCryptos.map(c => <option key={`c-t-${c}`} value={c}>{c}</option>)}
                      </optgroup>
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Net Received</label>
                  <input 
                    type="number" step="any" required placeholder="0.00" 
                    value={transferData.netReceived} 
                    onChange={e => setTransferData({...transferData, netReceived: e.target.value})} 
                    className="w-full p-4 bg-emerald-50 dark:bg-slate-900 border-2 border-emerald-300 dark:border-emerald-500/50 rounded-xl font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 text-lg shadow-sm placeholder-emerald-300 dark:placeholder-emerald-900" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Tax/GST ({transferData.toAsset})</label>
                  <input 
                    type="number" step="any" placeholder="0.00" value={transferData.taxAndFees} 
                    onChange={e => setTransferData({...transferData, taxAndFees: e.target.value})} 
                    className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm placeholder-slate-400" 
                  />
                </div>
                {isToForeign && transferData.toVault !== 'crypto' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><FaExchangeAlt/> Rate</label>
                    <input 
                      type="number" step="any" required value={transferData.toExchangeRate} 
                      onChange={e => setTransferData({...transferData, toExchangeRate: e.target.value})} 
                      className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm" 
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                    <span>Date</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{formatGlobalDate ? formatGlobalDate(transferData.date, 'full') : ''}</span>
                  </label>
                  <input 
                    type="date" required value={transferData.date} 
                    onChange={e => setTransferData({...transferData, date: e.target.value})} 
                    className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 📊 SUMMARY BAR */}
          <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-700">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <FaExchangeAlt className="text-indigo-400" size={20} />
              </div>
              <div>
                <p className="text-sm font-black text-white">
                  {transferData.grossAmount || 0} {transferData.fromAsset} → {transferData.netReceived || 0} {transferData.toAsset}
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Multi-vault balancing will trigger automatically</p>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={isProcessing || !transferData.grossAmount || !transferData.netReceived} 
              className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <HiOutlineRefresh className="animate-spin" size={20} /> : <FaArrowRight size={18} />}
              {isProcessing ? 'Executing...' : 'Execute Shift'}
            </button>
          </div>
        </form>

        {/* 📋 HISTORY TABLE (High Contrast) */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <HiOutlineCalendar className="text-indigo-500" size={18} />
              Recent Ledger Shifts
            </h3>
          </div>
          
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-30 animate-pulse" />
                <HiOutlineRefresh className="animate-spin text-3xl text-indigo-500 relative" />
              </div>
              <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-3 animate-pulse">Loading History...</p>
            </div>
          ) : shiftHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-sm">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3 border border-slate-200 dark:border-slate-700">
                <HiOutlineSwitchHorizontal className="text-3xl text-slate-500 dark:text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">No shifts recorded</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Execute a capital shift to see history</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest border-b border-slate-300 dark:border-slate-700">
                    <tr>
                      <th className="p-4 pl-6">Date & Route</th>
                      <th className="p-4">Source</th>
                      <th className="p-4">Destination</th>
                      <th className="p-4 pr-6 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                    {shiftHistory.map((shift) => (
                      <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="p-4 pl-6">
                          <p className="font-black text-slate-900 dark:text-white text-sm">
                            {formatGlobalDate ? formatGlobalDate(shift.date, 'full') : shift.date}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-1">
                            <span className="text-rose-600 dark:text-rose-400">{shift.fromVault}</span> 
                            <FaArrowRight size={10} className="text-slate-400 dark:text-slate-500" /> 
                            <span className="text-emerald-600 dark:text-emerald-400">{shift.toVault}</span>
                          </div>
                          {shift.routingPlatform && (
                            <p className="text-[9px] mt-1 text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-500/10 inline-block px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/30">
                              Via: {shift.routingPlatform}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="font-black text-rose-700 dark:text-rose-400 text-sm">
                            -{Number(shift.grossAmount).toLocaleString()} {shift.fromAsset}
                          </p>
                          {shift.fromSubWallet && (
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">{shift.fromSubWallet}</p>
                          )}
                          {shift.networkFee > 0 && (
                            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">Fee: {shift.networkFee} {shift.networkFeeAsset}</p>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="font-black text-emerald-700 dark:text-emerald-400 text-sm">
                            +{Number(shift.netReceived).toLocaleString()} {shift.toAsset}
                          </p>
                          {shift.toSubWallet && (
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">{shift.toSubWallet}</p>
                          )}
                          {shift.taxAndFees > 0 && (
                            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">Tax: {shift.taxAndFees} {shift.toAsset}</p>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <button 
                            onClick={() => initiateDeleteShift(shift)} 
                            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-slate-300 dark:border-slate-700 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <HiOutlineTrash size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-700">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <HiOutlineShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">Security Verification</h3>
                  <p className="text-xs text-white/70">Enter PIN to confirm deletion</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={executeSecureDeleteShift} className="p-6 space-y-5">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Deleting this shift will reverse the transaction across both vaults and remove associated expenses.
                </p>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Security PIN</label>
                <input 
                  type="password" maxLength={6} required autoFocus
                  value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.3em] text-xl p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors"
                />
                {pinError && <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-2 text-center">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-sm bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30">
                  {isVerifying && <HiOutlineRefresh className="animate-spin" size={18} />}
                  Confirm Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CapitalShifting;