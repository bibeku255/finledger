import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
// 🚀 FIXED: Changed updateDoc to setDoc for safety
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlineSwitchHorizontal, HiOutlineRefresh, 
  HiOutlineDocumentText, HiOutlineArrowRight, HiOutlineTrash,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineChevronDown,
  HiOutlineDownload, HiOutlineTable
} from 'react-icons/hi';
import { FaGlobe, FaUniversity, FaWallet, FaShieldAlt, FaExchangeAlt, FaGasPump, FaBitcoin } from 'react-icons/fa';

const fiatCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];

// 🚀 CRYPTO PLATFORMS (MUST MATCH CRYPTOWALLET)
const cryptoPlatformsList = [
  "CoinDCX", "WazirX", "ZebPay", "Mudrex", "SunCrypto",
  "Binance", "Coinbase", "Bybit", "KuCoin", "OKX", "Kraken", "Mexc",
  "FaucetPay", "Trust Wallet", "MetaMask", "Phantom", "NC Wallet", "Payeer",
  "Hardware Wallet (Ledger/Trezor)", "Other Wallet"
];

// 🚀 SECURE SHA-256 HASHING ALGORITHM
const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const CapitalShifting = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'INR', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  
  // 🚀 HISTORY STATE
  const [shiftHistory, setShiftHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // 🔐 Security States
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // 🚀 CRASH FIX: Properly mapping objects to strings to avoid React render crash
  const cryptoCurrencies = useMemo(() => {
    const customSymbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    return Array.from(new Set(["USDT", "USDC", "BTC", "ETH", "BNB", "SOL", "TRX", "MATIC", ...customSymbols]));
  }, [selectedCryptos]);

  const [transferData, setTransferData] = useState({
    fromVault: 'online', 
    fromCryptoPlatform: cryptoPlatformsList[0],
    fromAsset: 'USDT', 
    grossAmount: '', 
    fromExchangeRate: 1, 

    // ⛽ PRO NETWORK FEE ENGINE
    networkFeeAsset: 'USDT', 
    networkFee: '', 
    networkFeeExchangeRate: 1,

    routingPlatform: '', 
    routingAgent: '', 
    
    toVault: 'bank', 
    toCryptoPlatform: cryptoPlatformsList[0],
    toAsset: baseCurrency, 
    netReceived: '', 
    toExchangeRate: 1, 
    taxAndFees: '', 
    
    date: new Date().toISOString().split('T')[0],
    referenceId: '' 
  });

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

  // 🌍 SMART TRIPLE-RATE FETCHER (Now properly syncs with Pegged logic)
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
        
        // Fiat check
        if (fiatCurrencies.includes(assetSym)) {
          const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${assetSym}`);
          const data = await res.json();
          return data.rates[baseCurrency] || 1;
        }
        
        if (assetSym === 'USDT' || assetSym === 'USDC') return usdToBase;
        
        // 🚀 SMART CRYPTO CHECK (Extract ID from Context)
        const coinObj = selectedCryptos.find(c => (typeof c === 'string' ? c : c.symbol).toUpperCase() === assetSym.toUpperCase());
        const searchId = coinObj?.id || assetSym.toLowerCase();

        let priceUsd = null;
        try {
          const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${searchId}&vs_currencies=usd`);
          const cgData = await cgRes.json();
          if (cgData[searchId]?.usd) priceUsd = parseFloat(cgData[searchId].usd);
        } catch(e) {}

        if (!priceUsd) {
          try {
             const binanceSymbol = searchId === 'tether' ? 'BTCUSDT' : `${assetSym.toUpperCase()}USDT`;
             const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
             if (bRes.ok) {
               const bData = await bRes.json();
               priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
             }
          } catch (e) { console.warn("Binance fetch failed for", assetSym); }
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

  // 🚀 REPORT DOWNLOAD LOGIC (Now includes Global Date)
  const handleDownloadReport = (format) => {
    if (shiftHistory.length === 0) return alert("No transfer records found to download.");

    const reportData = shiftHistory.map(shift => {
      let fromDetails = `${Number(shift.grossAmount).toLocaleString()} ${shift.fromAsset} (From ${shift.fromVault})`;
      if (shift.fromVault === 'crypto' && shift.fromCryptoPlatform) {
         fromDetails += ` - ${shift.fromCryptoPlatform}`;
      }

      let toDetails = `${Number(shift.netReceived).toLocaleString()} ${shift.toAsset} (To ${shift.toVault})`;
      if (shift.toVault === 'crypto' && shift.toCryptoPlatform) {
         toDetails += ` - ${shift.toCryptoPlatform}`;
      }

      let feeDetails = 'None';
      if (shift.networkFee > 0 || shift.taxAndFees > 0) {
        feeDetails = [];
        if (shift.networkFee > 0) feeDetails.push(`Gas: ${shift.networkFee} ${shift.networkFeeAsset}`);
        if (shift.taxAndFees > 0) feeDetails.push(`Tax: ${shift.taxAndFees} ${shift.toAsset}`);
        feeDetails = feeDetails.join(' | ');
      }

      return {
        date: formatGlobalDate ? formatGlobalDate(shift.date, 'full') : shift.date,
        source: fromDetails,
        destination: toDetails,
        routing: shift.routingPlatform || 'Direct',
        fees: feeDetails
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Source Vault (Deducted)', key: 'source' },
      { header: 'Destination Vault (Added)', key: 'destination' },
      { header: 'Routing Method', key: 'routing' },
      { header: 'Gas & Tax Fees', key: 'fees' }
    ];

    const fileName = `Capital_Shifting_Ledger`;
    const reportTitle = `Internal Capital Shifting & Routing - Audit Report`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please login first!");
    
    if(window.confirm(`Confirm shifting ${transferData.grossAmount} ${transferData.fromAsset} to ${transferData.toVault.toUpperCase()}?`)) {
      setIsProcessing(true);

      const timestamp = new Date(transferData.date).getTime();
      const shiftId = `SHIFT_${timestamp}_${Math.floor(Math.random() * 1000)}`;

      const totalOutBase = fromFinalBase + feeFinalBase;

      // 1️⃣ GENERATE SOURCE RECORD (DEDUCTION)
      let outRecord = {};
      const fromCollection = transferData.fromVault === 'crypto' ? 'cryptoWalletLogs' : 
                             transferData.fromVault === 'online' ? 'onlineWallet' : 
                             transferData.fromVault === 'bank' ? 'bankWallet' : 'cashWallet';

      if (transferData.fromVault === 'crypto') {
        outRecord = {
          type: 'out',
          coin: transferData.fromAsset,
          quantity: parseFloat(transferData.grossAmount),
          platform: transferData.fromCryptoPlatform,
          reason: `Shifted to ${transferData.toVault}`,
          referenceNo: transferData.referenceId,
          date: transferData.date,
          timestamp,
          shiftId,
          isTransfer: true
        };
      } else {
        outRecord = {
          title: `Transferred to ${transferData.toVault.toUpperCase()}`,
          type: 'out', 
          date: transferData.date,
          timestamp,
          currency: transferData.fromAsset,
          foreignAmount: parseFloat(transferData.grossAmount), 
          exchangeRate: parseFloat(transferData.fromExchangeRate) || 1,
          fee: parseFloat(transferData.networkFee) || 0, 
          feeAsset: transferData.networkFeeAsset, 
          feeExchangeRate: parseFloat(transferData.networkFeeExchangeRate) || 1,
          finalBaseAmount: totalOutBase, 
          isTransfer: true,
          shiftId,
          notes: `Platform: ${transferData.routingPlatform} | Agent: ${transferData.routingAgent}`,
          walletName: transferData.routingPlatform || 'Capital Shift', 
          walletCategory: 'Fiat Wallet',
          bankName: transferData.routingPlatform || 'Capital Shift',
          transferType: 'Internal Transfer'
        };
      }

      // 2️⃣ GENERATE DESTINATION RECORD (DEPOSIT)
      let inRecord = {};
      const toCollection = transferData.toVault === 'crypto' ? 'cryptoWalletLogs' : 
                           transferData.toVault === 'bank' ? 'bankWallet' : 
                           transferData.toVault === 'online' ? 'onlineWallet' : 'cashWallet';

      if (transferData.toVault === 'crypto') {
         inRecord = {
          type: 'in',
          coin: transferData.toAsset,
          quantity: parseFloat(transferData.netReceived),
          platform: transferData.toCryptoPlatform,
          reason: `Received from ${transferData.fromVault}`,
          referenceNo: transferData.referenceId,
          date: transferData.date,
          timestamp,
          shiftId,
          isTransfer: true
        };
      } else {
        inRecord = {
          title: `Received from ${transferData.fromVault.toUpperCase()}`,
          type: 'in', 
          date: transferData.date,
          timestamp,
          currency: transferData.toAsset,
          foreignAmount: parseFloat(transferData.netReceived), 
          exchangeRate: parseFloat(transferData.toExchangeRate) || 1, 
          finalBaseAmount: toFinalBase,
          fee: parseFloat(transferData.taxAndFees) || 0, 
          isP2P: transferData.routingPlatform ? true : false, 
          isTransfer: true,
          shiftId,
          referenceNo: transferData.referenceId,
          notes: `Platform: ${transferData.routingPlatform} | Agent: ${transferData.routingAgent}`,
          walletName: transferData.routingPlatform || 'Capital Shift',
          walletCategory: 'Fiat Wallet',
          bankName: transferData.routingPlatform || 'Capital Shift',
          transferType: 'Internal Transfer'
        };
      }

      try {
        await addDoc(collection(db, "users", user.uid, fromCollection), outRecord);
        await addDoc(collection(db, "users", user.uid, toCollection), inRecord);
        await addDoc(collection(db, "users", user.uid, "capitalShifts"), { ...transferData, shiftId, timestamp });

        // 🚀 AUTO-EXPENSE BRIDGE: Log fees to Expense Tracker
        const totalFeeInBase = feeFinalBase + destinationTaxBase;
        if (totalFeeInBase > 0) {
            const expenseRecord = {
                title: `Capital Shift Fee (${transferData.fromVault} to ${transferData.toVault})`,
                category: "Forex & Bank Charges", 
                vault: transferData.fromVault, 
                asset: baseCurrency, 
                amount: totalFeeInBase,
                exchangeRate: 1,
                finalBaseAmount: totalFeeInBase,
                date: transferData.date,
                timestamp,
                linkedExpenseId: shiftId, 
                isSplit: false
            };
            await addDoc(collection(db, "users", user.uid, "expenseLogs"), expenseRecord);
        }

        alert("Capital Shifted Successfully!");
        setTransferData({ ...transferData, grossAmount: '', networkFee: '', taxAndFees: '', netReceived: '', referenceId: ''});
      } catch (error) {
        console.error(error);
        alert("Transfer Failed!");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // 🔐 INIT SECURE DELETE
  const initiateDeleteShift = (shift) => {
    setDeleteContext(shift);
    setPinInput('');
    setPinError('');
  };

  // 🔐 EXECUTE SECURE DELETE
  const executeSecureDeleteShift = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError("Please enter your Security PIN.");
      return;
    }

    setIsVerifying(true);
    setPinError('');

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userData?.security?.pinHash || userData?.securityPin || userData?.pin; 

      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect PIN. Deletion blocked! 🛑");
        setIsVerifying(false);
        return;
      }

      // 1. Delete Master Shift Record
      await deleteDoc(doc(db, "users", user.uid, "capitalShifts", deleteContext.id));
      
      // 2. Remove from ALL possible vaults (Including Crypto) using the unique shiftId
      const collectionsToCheck = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
      for (let col of collectionsToCheck) {
        const q = query(collection(db, "users", user.uid, col), where("shiftId", "==", deleteContext.shiftId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (document) => {
          await deleteDoc(doc(db, "users", user.uid, col, document.id));
        });
      }

      // 3. Remove from Expense Logs
      const expQuery = query(collection(db, "users", user.uid, "expenseLogs"), where("linkedExpenseId", "==", deleteContext.shiftId));
      const expSnapshot = await getDocs(expQuery);
      expSnapshot.forEach(async (document) => {
          await deleteDoc(doc(db, "users", user.uid, "expenseLogs", document.id));
      });

      setDeleteContext(null); 
    } catch (error) {
      console.error(error);
      setPinError("System error during deletion. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };


  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-6xl mx-auto px-4 lg:px-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-3xl ring-1 ring-indigo-500/20 shadow-lg">
            <HiOutlineSwitchHorizontal size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Capital Shifting</h1>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Move assets across Vaults. Supports Fiat-to-Crypto and Crypto-to-Fiat bridging.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* 🚀 DOWNLOAD REPORT DROPDOWN */}
          <div className="relative group w-full sm:w-auto">
            <button className="flex items-center justify-center gap-1 md:gap-2 p-4 md:p-3.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-2xl font-black text-sm hover:bg-indigo-100 transition-colors border border-indigo-200 dark:border-indigo-500/20 shadow-sm w-full">
              <HiOutlineDownload size={20}/> 
              <span>Export History</span>
            </button>
            <div className="absolute top-full right-0 md:left-0 md:right-auto mt-2 w-full sm:w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
              <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineDocumentText className="text-rose-500" size={16}/> As PDF
              </button>
              <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineTable className="text-emerald-500" size={16}/> As Excel (CSV)
              </button>
            </div>
          </div>

          <button type="button" onClick={fetchLiveRates} disabled={isFetchingRate} className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl font-black text-sm hover:scale-95 transition-transform shadow-xl disabled:opacity-50 w-full sm:w-auto">
            <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={20}/>
            {isFetchingRate ? 'Syncing...' : 'Sync Rates'}
          </button>
        </div>
      </div>

      <form onSubmit={handleTransfer} className="space-y-6">
        
        {/* 🔴 STEP 1: SOURCE */}
        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-rose-500"></div>
          <h2 className="text-sm font-black text-rose-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <FaWallet /> Step 1: Withdraw From (Source)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Source Vault</label>
              <div className="relative">
                 <select value={transferData.fromVault} onChange={e => setTransferData({...transferData, fromVault: e.target.value})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none">
                   <option value="crypto">Crypto Engine</option>
                   <option value="online">Online Wallet (PayPal, etc)</option>
                   <option value="bank">Bank Account</option>
                   <option value="cash">Physical Cash</option>
                 </select>
                 <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            
            {/* Conditional Crypto Platform Select */}
            {transferData.fromVault === 'crypto' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform</label>
                <div className="relative">
                  <select value={transferData.fromCryptoPlatform} onChange={e => setTransferData({...transferData, fromCryptoPlatform: e.target.value})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none">
                    {cryptoPlatformsList.map(p => <option key={`src-${p}`} value={p}>{p}</option>)}
                  </select>
                  <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset Sending</label>
               <div className="relative">
                  <select value={transferData.fromAsset} onChange={e => setTransferData({...transferData, fromAsset: e.target.value, fromExchangeRate: e.target.value === baseCurrency ? 1 : ''})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none">
                    <optgroup label="Crypto Assets">{cryptoCurrencies.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                    <optgroup label="Fiat Currencies">
                      <option value={baseCurrency}>{baseCurrency} (Base)</option>
                      {fiatCurrencies.map(c => c !== baseCurrency && <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  </select>
                  <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Gross Amount Sent</label>
              <input type="number" step="any" required placeholder="0.00" value={transferData.grossAmount} onChange={e => setTransferData({...transferData, grossAmount: e.target.value})} className="w-full p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl font-black text-rose-600 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500/50 text-lg" />
              {isFromForeign && transferData.fromVault !== 'crypto' && transferData.grossAmount > 0 && (
                 <p className="text-[10px] font-black text-slate-400 mt-1 pl-1">Gross Value: {currencySymbol}{fromFinalBase.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
              )}
            </div>
          </div>
          
          {isFromForeign && transferData.fromVault !== 'crypto' && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
               <span className="text-xs font-bold text-slate-500 flex items-center gap-2"><FaExchangeAlt/> Conversion Rate:</span>
               <div className="flex items-center gap-2 w-1/2">
                 <span className="text-sm font-bold text-slate-500">1 {transferData.fromAsset} = </span>
                 <input type="number" step="any" required value={transferData.fromExchangeRate} onChange={e => setTransferData({...transferData, fromExchangeRate: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:border-rose-400" />
               </div>
            </div>
          )}

          {/* ⛽ PRO GAS/NETWORK FEE TRACKER */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1"><FaGasPump/> Fee Asset (Gas)</label>
              <div className="relative">
                <select value={transferData.networkFeeAsset} onChange={e => setTransferData({...transferData, networkFeeAsset: e.target.value, networkFeeExchangeRate: e.target.value === baseCurrency ? 1 : ''})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none">
                  <optgroup label="Crypto Assets">{cryptoCurrencies.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  <optgroup label="Fiat Currencies">
                    <option value={baseCurrency}>{baseCurrency} (Base)</option>
                    {fiatCurrencies.map(c => c !== baseCurrency && <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                </select>
                <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Fee Amount ({transferData.networkFeeAsset})</label>
              <input type="number" step="any" placeholder="0.00" value={transferData.networkFee} onChange={e => setTransferData({...transferData, networkFee: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50" />
              {transferData.networkFee > 0 && transferData.fromVault !== 'crypto' && (
                <p className="text-[10px] font-black text-rose-500 mt-1 pl-1">Cost: -{currencySymbol}{feeFinalBase.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
              )}
            </div>
            {isFeeForeign && transferData.fromVault !== 'crypto' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Fee Exchange Rate</label>
                <input type="number" step="any" placeholder={`1 ${transferData.networkFeeAsset} in ${baseCurrency}`} value={transferData.networkFeeExchangeRate} onChange={e => setTransferData({...transferData, networkFeeExchangeRate: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50" />
              </div>
            )}
          </div>
        </div>

        {/* 🌉 STEP 2: THE BRIDGE */}
        <div className="flex flex-col items-center -my-2 relative z-10">
          <div className="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 border-4 border-slate-50 dark:border-slate-950">
            <HiOutlineArrowRight className="rotate-90 md:rotate-0" size={20} />
          </div>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 md:p-8 rounded-[2rem] shadow-sm border border-indigo-100 dark:border-indigo-500/20 relative overflow-hidden">
          <h2 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <FaShieldAlt /> Step 2: Routing Details (Optional)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform / Exchange</label>
              <input type="text" placeholder="e.g. CoinDCX, Binance P2P, ATM" value={transferData.routingPlatform} onChange={e => setTransferData({...transferData, routingPlatform: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Routing Agent / Broker</label>
              <input type="text" placeholder="e.g. Friend's UPI (Rahul)" value={transferData.routingAgent} onChange={e => setTransferData({...transferData, routingAgent: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
          </div>
        </div>

        {/* 🟢 STEP 3: DESTINATION */}
        <div className="flex flex-col items-center -my-2 relative z-10">
          <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 border-4 border-slate-50 dark:border-slate-950">
            <HiOutlineArrowRight className="rotate-90 md:rotate-0" size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
          <h2 className="text-sm font-black text-emerald-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <FaUniversity /> Step 3: Deposit Into (Destination)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Destination Vault</label>
              <div className="relative">
                <select value={transferData.toVault} onChange={e => setTransferData({...transferData, toVault: e.target.value})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer appearance-none">
                  <option value="bank">Bank Account</option>
                  <option value="online">Online Wallet (PayPal, etc)</option>
                  <option value="cash">Physical Cash</option>
                  <option value="crypto">Crypto Engine</option>
                </select>
                <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Conditional Crypto Platform Select for Dest */}
            {transferData.toVault === 'crypto' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform</label>
                <div className="relative">
                  <select value={transferData.toCryptoPlatform} onChange={e => setTransferData({...transferData, toCryptoPlatform: e.target.value})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer appearance-none">
                    {cryptoPlatformsList.map(p => <option key={`dest-${p}`} value={p}>{p}</option>)}
                  </select>
                  <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset Received</label>
              <div className="relative">
                <select value={transferData.toAsset} onChange={e => setTransferData({...transferData, toAsset: e.target.value, toExchangeRate: e.target.value === baseCurrency ? 1 : ''})} className="w-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer appearance-none">
                  <optgroup label="Fiat Currencies">
                    <option value={baseCurrency}>{baseCurrency} (Base)</option>
                    {fiatCurrencies.map(c => c !== baseCurrency && <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                  <optgroup label="Crypto Assets">{cryptoCurrencies.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                </select>
                <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">Net Received</label>
              <input type="number" step="any" required placeholder="0.00" value={transferData.netReceived} onChange={e => setTransferData({...transferData, netReceived: e.target.value})} className="w-full p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl font-black text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 text-lg" />
              {isToForeign && transferData.toVault !== 'crypto' && transferData.netReceived > 0 && (
                 <p className="text-[10px] font-black text-slate-400 mt-1 pl-1">Net Value: {currencySymbol}{toFinalBase.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
             <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">TDS/GST (in {transferData.toAsset})</label>
              <input type="number" step="any" placeholder="0.00" value={transferData.taxAndFees} onChange={e => setTransferData({...transferData, taxAndFees: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
              {transferData.taxAndFees > 0 && transferData.toVault !== 'crypto' && (
                <p className="text-[10px] font-black text-rose-500 mt-1 pl-1">Tax: -{currencySymbol}{destinationTaxBase.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
              )}
            </div>
             {isToForeign && transferData.toVault !== 'crypto' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1 flex items-center gap-1"><FaExchangeAlt/> 1 {transferData.toAsset} Rate</label>
                <input type="number" step="any" required placeholder={`Rate in ${baseCurrency}`} value={transferData.toExchangeRate} onChange={e => setTransferData({...transferData, toExchangeRate: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
            )}
            
            {/* 🚀 FIXED: Date Picker with Local Calendar Label */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between ml-1">
                <span>Date</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatGlobalDate ? formatGlobalDate(transferData.date, 'full') : ''}</span>
              </label>
              <input type="date" required value={transferData.date} onChange={e => setTransferData({...transferData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
          </div>
        </div>

        {/* 📊 SUMMARY & SUBMIT */}
        <div className="bg-slate-900 dark:bg-black p-6 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
          <div className="text-slate-400 text-sm">
            <p>You are shifting <strong className="text-white">{transferData.grossAmount || 0} {transferData.fromAsset}</strong></p>
            <p className="text-[10px] uppercase tracking-widest mt-1 text-emerald-500">Multi-Vault balancing will trigger automatically.</p>
          </div>
          <button type="submit" disabled={isProcessing || !transferData.grossAmount || !transferData.netReceived} className="w-full md:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isProcessing ? <HiOutlineRefresh className="animate-spin text-2xl" /> : <HiOutlineDocumentText size={24} />}
            {isProcessing ? 'Executing...' : 'Execute Ledger Shift'}
          </button>
        </div>
      </form>

      {/* 🚀 CONVERSION HISTORY TABLE */}
      <div className="mt-12">
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">Recent Ledger Shifts</h3>
        
        {isLoadingHistory ? (
           <div className="p-10 text-center animate-pulse text-slate-500 font-bold">Loading Shift History...</div>
        ) : shiftHistory.length === 0 ? (
           <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold shadow-sm">
             No capital shifts recorded yet.
           </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4 pl-6">Date & Route</th>
                    <th className="p-4">Source (Deducted)</th>
                    <th className="p-4">Destination (Received)</th>
                    <th className="p-4 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {shiftHistory.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      
                      <td className="p-4 pl-6">
                        {/* 🚀 FIXED: Date rendering in local format */}
                        <p className="font-black text-slate-800 dark:text-white text-sm mb-1">
                          {formatGlobalDate ? formatGlobalDate(shift.date, 'full') : shift.date}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                           <span className="text-rose-500 flex items-center gap-1">{shift.fromVault === 'crypto' ? <FaBitcoin/> : <FaWallet/>} {shift.fromVault}</span> 
                           <HiOutlineArrowRight/> 
                           <span className="text-emerald-500 flex items-center gap-1">{shift.toVault === 'crypto' ? <FaBitcoin/> : <FaUniversity/>} {shift.toVault}</span>
                        </div>
                        {shift.routingPlatform && (
                          <p className="text-[9px] mt-1 text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-500/10 inline-block px-1.5 py-0.5 rounded">
                            Via: {shift.routingPlatform}
                          </p>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col items-start">
                          <p className="font-black text-rose-600 dark:text-rose-400 text-base">
                            -{Number(shift.grossAmount).toLocaleString()} {shift.fromAsset}
                          </p>
                          {shift.fromVault === 'crypto' && shift.fromCryptoPlatform && (
                            <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {shift.fromCryptoPlatform}
                            </p>
                          )}
                          {shift.fromVault !== 'crypto' && shift.fromAsset !== baseCurrency && (
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                              @ {Number(shift.fromExchangeRate || 1).toLocaleString()} {baseCurrency}
                            </p>
                          )}
                          {shift.networkFee > 0 && (
                             <p className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-1 py-0.5 mt-1 rounded border border-rose-100 dark:border-rose-500/20">
                               Gas: -{shift.networkFee} {shift.networkFeeAsset}
                             </p>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col items-start">
                          <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                            +{Number(shift.netReceived).toLocaleString()} {shift.toAsset}
                          </p>
                          {shift.toVault === 'crypto' && shift.toCryptoPlatform && (
                            <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {shift.toCryptoPlatform}
                            </p>
                          )}
                          {shift.toVault !== 'crypto' && shift.toAsset !== baseCurrency && (
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                              @ {Number(shift.toExchangeRate || 1).toLocaleString()} {baseCurrency}
                            </p>
                          )}
                          {shift.taxAndFees > 0 && (
                             <p className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-1 py-0.5 mt-1 rounded border border-rose-100 dark:border-rose-500/20">
                               Tax/GST: -{shift.taxAndFees} {shift.toAsset}
                             </p>
                          )}
                        </div>
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <button 
                          onClick={() => initiateDeleteShift(shift)} 
                          className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all shadow-sm"
                          title="Delete Shift & Vault Entries"
                        >
                          <HiOutlineTrash size={18} />
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

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-full flex items-center justify-center text-3xl mb-4">
                <HiOutlineLockClosed />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">
                You are about to delete a Capital Shift.
              </p>
              
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                  <HiOutlineExclamationCircle size={16} className="shrink-0" />
                  WARNING: Deleting this record will completely reverse this transaction across both Source and Destination vaults, as well as revert any associated auto-expenses.
                </p>
              </div>
            </div>

            <form onSubmit={executeSecureDeleteShift} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-center block">Enter 4-Digit Security PIN</label>
                <input 
                  type="password" 
                  maxLength={6}
                  required
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                />
                {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce">{pinError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50">
                  Verify & Revert
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