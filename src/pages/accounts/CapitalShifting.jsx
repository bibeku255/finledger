// src/pages/accounts/CapitalShifting.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  collection, addDoc, doc, setDoc, deleteDoc,
  onSnapshot, query, orderBy, getDoc, where, getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPIN } from '../../utils/cryptoUtils';
import {
  HiOutlineSwitchHorizontal, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineLibrary, HiOutlineSearch, HiOutlineRefresh,
  HiOutlineExclamationCircle, HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineChevronDown, HiOutlineCalendar, HiOutlineShieldCheck,
  HiOutlineGlobe, HiOutlineArrowRight, HiOutlineCheckCircle,
  HiOutlineInformationCircle,
} from 'react-icons/hi';
import {
  FaGlobe, FaWallet, FaShieldAlt, FaExchangeAlt,
  FaArrowDown, FaArrowUp, FaPiggyBank, FaChartLine,
  FaUniversity, FaGasPump, FaArrowRight,
} from 'react-icons/fa';
import { fiatFlagMap } from '../../utils/marketConstants';

// ---------- TOAST SYSTEM ----------
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

// ---------- CONSTANTS ----------
const cryptoPlatformsList = [
  'CoinDCX','WazirX','ZebPay','Mudrex','SunCrypto',
  'Binance','Coinbase','Bybit','KuCoin','OKX',
  'Kraken','Mexc','FaucetPay','Trust Wallet','MetaMask',
  'Phantom','NC Wallet','Payeer','Hardware Wallet','Other Wallet',
];
const getLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// Vault selector component
const VaultSelector = ({ value, onChange, options, icon: Icon, color, label }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
      <Icon size={14} className={color} /> {label}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="w-full pl-4 pr-10 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 cursor-pointer appearance-none transition-colors shadow-sm"
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  </div>
);

// ---------- MAIN COMPONENT ----------
const CapitalShiftingContent = () => {
  const { user, baseCurrency = 'INR', selectedFiats = [], selectedCryptos = [], formatGlobalDate, getCalendarMonthKey } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  const availableFiats = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);
  const availableCryptos = useMemo(() => {
    const customSymbols = selectedCryptos.map(c => (typeof c === 'string' ? c : c.symbol)).filter(Boolean);
    return Array.from(new Set(['USDT', ...customSymbols])).map(s => s.toUpperCase());
  }, [selectedCryptos]);

  const getCurrentMonthKey = () => getCalendarMonthKey(new Date().toISOString());
  const [openMonths, setOpenMonths] = useState(new Set([getCurrentMonthKey()]));
  const toggleMonth = (monthKey) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  };

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [existingVaultNames, setExistingVaultNames] = useState([]);
  const [confirmShift, setConfirmShift] = useState(false);
  const [outFeeType, setOutFeeType] = useState('inclusive');
  const [editingShiftId, setEditingShiftId] = useState(null);

  const [transferData, setTransferData] = useState({
    fromVault: 'online', fromSubWallet: '', fromCryptoPlatform: cryptoPlatformsList[0],
    fromAsset: availableFiats.includes('USD') ? 'USD' : baseCurrency, grossAmount: '',
    fromExchangeRate: 1,
    networkFeeAsset: availableFiats.includes('USD') ? 'USD' : baseCurrency,
    networkFee: '', networkFeeExchangeRate: 1,
    routingPlatform: '', routingAgent: '',
    toVault: 'bank', toSubWallet: '', toCryptoPlatform: cryptoPlatformsList[0],
    toAsset: baseCurrency, netReceived: '', toExchangeRate: 1,
    taxAndFees: '',
    date: getLocalDateTimeString(), referenceId: '',
  });

  // Fetch custom coins & existing vault names
  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists() && userSnap.data().customCoins) setCustomUserCoins(userSnap.data().customCoins);
    };
    fetchUserData();
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const fetchVaults = async () => {
      const qBank = query(collection(db, 'users', user.uid, 'bankWallet'));
      const snapBank = await getDocs(qBank);
      const qOnline = query(collection(db, 'users', user.uid, 'onlineWallet'));
      const snapOnline = await getDocs(qOnline);
      const names = new Set();
      snapBank.docs.forEach(d => { if (d.data().bankName) names.add(d.data().bankName); });
      snapOnline.docs.forEach(d => { if (d.data().walletName) names.add(d.data().walletName); });
      setExistingVaultNames(Array.from(names));
    };
    fetchVaults();
  }, [user]);

  useEffect(() => { setTransferData(prev => ({ ...prev, networkFeeAsset: prev.fromAsset })); }, [transferData.fromAsset]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'capitalShifts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snapshot => {
      setShiftHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingHistory(false);
    }, error => {
      addToast('Failed to load shift history. Please refresh.', 'error');
      setIsLoadingHistory(false);
    });
    return () => unsub();
  }, [user, addToast]);

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    selectedCryptos.forEach(c => { if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c); });
    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  const totalShifts = shiftHistory.length;
  const totalVolume = useMemo(() =>
    shiftHistory.reduce((acc, s) => acc + (Number(s.grossAmount) || 0) * (Number(s.fromExchangeRate) || 1), 0),
    [shiftHistory]
  );

  // ---------- LIVE RATES FETCH ----------
  const fetchLiveRates = async () => {
    setIsFetchingRate(true);
    try {
      let newFromRate = transferData.fromExchangeRate;
      let newToRate = transferData.toExchangeRate;
      let newFeeRate = transferData.networkFeeExchangeRate;
      const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fiatData = await fiatRes.json();
      const usdToBase = fiatData.rates[baseCurrency] || 1;

      const getAssetRate = async assetSym => {
        if (assetSym === baseCurrency) return 1;
        if (availableFiats.includes(assetSym) || assetSym.length === 3) {
          try {
            const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${assetSym}`);
            const data = await res.json();
            return data.rates[baseCurrency] || 1;
          } catch (e) {}
        }
        if (assetSym === 'USDT' || assetSym === 'USDC') return usdToBase;
        const upperSym = assetSym.toUpperCase();
        const coinObj = fullDatabase.find(c => c.symbol === upperSym) || {};
        const searchId = coinObj?.id || assetSym.toLowerCase();
        let priceUsd = null;
        if (coinObj.fetchMode === 'contract' && coinObj.network && coinObj.contractAddress) {
          try {
            const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${coinObj.network}/tokens/${coinObj.contractAddress}`);
            if (gtRes.ok) { const gtJson = await gtRes.json(); priceUsd = parseFloat(gtJson.data.attributes.price_usd); }
          } catch (e) {}
        }
        if (!priceUsd) {
          try {
            const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${searchId}&vs_currencies=usd`);
            const cgData = await cgRes.json();
            if (cgData[searchId]?.usd) priceUsd = parseFloat(cgData[searchId].usd);
          } catch (e) {}
        }
        if (!priceUsd) {
          try {
            const binanceSymbol = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
            const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
            if (bRes.ok) { const bData = await bRes.json(); priceUsd = searchId === 'tether' ? 1.0 : parseFloat(bData.price); }
          } catch (e) {}
        }
        const finalPrice = priceUsd || coinObj?.fallbackPrice || 0;
        return finalPrice * usdToBase;
      };

      if (transferData.fromAsset !== baseCurrency) { const rate = await getAssetRate(transferData.fromAsset); if (rate) newFromRate = Number(rate).toFixed(4); }
      if (transferData.toAsset !== baseCurrency) { const rate = await getAssetRate(transferData.toAsset); if (rate) newToRate = Number(rate).toFixed(4); }
      if (transferData.networkFeeAsset !== baseCurrency) { const rate = await getAssetRate(transferData.networkFeeAsset); if (rate) newFeeRate = Number(rate).toFixed(4); }

      setTransferData(prev => ({ ...prev, fromExchangeRate: newFromRate, toExchangeRate: newToRate, networkFeeExchangeRate: newFeeRate }));
    } catch (error) { addToast('Failed to fetch live market rates. Please input manually.', 'error'); }
    finally { setIsFetchingRate(false); }
  };

  const isFromForeign = transferData.fromAsset !== baseCurrency;
  const isToForeign = transferData.toAsset !== baseCurrency;
  const isFeeForeign = transferData.networkFeeAsset !== baseCurrency;

  // ---------- EXPORT REPORT ----------
  const handleDownloadReport = async format => {
    setIsExportMenuOpen(false);
    if (shiftHistory.length === 0) { addToast('No transfer records found to download.', 'warning'); return; }
    setIsGeneratingReport(true);
    const reportData = shiftHistory.map(shift => {
      const fromPlatform = shift.fromVault === 'crypto' ? shift.fromCryptoPlatform : shift.fromSubWallet || 'Main';
      const toPlatform = shift.toVault === 'crypto' ? shift.toCryptoPlatform : shift.toSubWallet || 'Main';
      const rawDate = shift.date ? shift.date.split('T')[0] : 'N/A';
      const grossBase = (Number(shift.grossAmount) || 0) * (Number(shift.fromExchangeRate) || 1);
      const feeBase = (Number(shift.networkFee) || 0) * (Number(shift.networkFeeExchangeRate) || 1) + (Number(shift.taxAndFees) || 0) * (Number(shift.toExchangeRate) || 1);
      const netBase = (Number(shift.netReceived) || 0) * (Number(shift.toExchangeRate) || 1);
      return {
        date: formatGlobalDate ? formatGlobalDate(shift.date, 'full') : rawDate,
        sourceStr: `${Number(shift.grossAmount).toLocaleString()} ${shift.fromAsset} (${shift.fromVault.toUpperCase()}: ${fromPlatform})`,
        destStr: `${Number(shift.netReceived).toLocaleString()} ${shift.toAsset} (${shift.toVault.toUpperCase()}: ${toPlatform})`,
        routing: shift.routingPlatform || 'Direct',
        grossBase: Number(grossBase.toFixed(2)),
        feeBase: Number(feeBase.toFixed(2)),
        netBase: Number(netBase.toFixed(2)),
      };
    });
    const columns = [
      { header: 'Date', key: 'date' }, { header: 'Sent From', key: 'sourceStr' }, { header: 'Received In', key: 'destStr' },
      { header: 'Routing Engine', key: 'routing' },
      { header: `Gross Sent (${currencySymbol})`, key: 'grossBase', isNumeric: true },
      { header: `Total Fees (${currencySymbol})`, key: 'feeBase', isNumeric: true },
      { header: `Net Value Added (${currencySymbol})`, key: 'netBase', isNumeric: true },
    ];
    const fileName = 'Capital_Shifting_Ledger';
    const reportTitle = `Internal Capital Shifting & Routing - Audit Report`;
    if (format === 'pdf') {
      await downloadPDFReport(reportData, columns, fileName, reportTitle, { onSuccess: () => addToast('PDF report downloaded!', 'success'), onError: msg => addToast(`PDF Error: ${msg}`, 'error') });
    } else {
      await downloadExcelReport(reportData, columns, fileName, reportTitle, { onSuccess: () => addToast('Excel report downloaded!', 'success'), onError: msg => addToast(`Excel Error: ${msg}`, 'error') });
    }
    setIsGeneratingReport(false);
  };

  // ---------- INIT EDIT SHIFT ----------
  const initiateEditShift = (shift) => {
    setTransferData({
      fromVault: shift.fromVault,
      fromSubWallet: shift.fromSubWallet || '',
      fromCryptoPlatform: shift.fromCryptoPlatform || cryptoPlatformsList[0],
      fromAsset: shift.fromAsset,
      grossAmount: shift.grossAmount || '',
      fromExchangeRate: shift.fromExchangeRate || 1,
      networkFeeAsset: shift.networkFeeAsset || shift.fromAsset,
      networkFee: shift.networkFee || '',
      networkFeeExchangeRate: shift.networkFeeExchangeRate || 1,
      routingPlatform: shift.routingPlatform || '',
      routingAgent: shift.routingAgent || '',
      toVault: shift.toVault,
      toSubWallet: shift.toSubWallet || '',
      toCryptoPlatform: shift.toCryptoPlatform || cryptoPlatformsList[0],
      toAsset: shift.toAsset,
      netReceived: shift.netReceived || '',
      toExchangeRate: shift.toExchangeRate || 1,
      taxAndFees: shift.taxAndFees || '',
      date: shift.date,
      referenceId: shift.referenceId || '',
    });
    setOutFeeType(shift.outFeeType || 'inclusive');
    setEditingShiftId(shift.shiftId);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    addToast('Editing mode active. Update the details and click Execute.', 'info');
  };

  // ---------- CANCEL EDIT ----------
  const cancelEdit = () => {
    setEditingShiftId(null);
    setTransferData({
      fromVault: 'online', fromSubWallet: '', fromCryptoPlatform: cryptoPlatformsList[0],
      fromAsset: availableFiats.includes('USD') ? 'USD' : baseCurrency, grossAmount: '',
      fromExchangeRate: 1,
      networkFeeAsset: availableFiats.includes('USD') ? 'USD' : baseCurrency,
      networkFee: '', networkFeeExchangeRate: 1,
      routingPlatform: '', routingAgent: '',
      toVault: 'bank', toSubWallet: '', toCryptoPlatform: cryptoPlatformsList[0],
      toAsset: baseCurrency, netReceived: '', toExchangeRate: 1,
      taxAndFees: '',
      date: getLocalDateTimeString(), referenceId: '',
    });
    setOutFeeType('inclusive');
  };

  // ---------- EXECUTE SHIFT ----------
  const handleTransfer = async () => {
    if (!user) return addToast('Please login first.', 'error');
    if ((transferData.fromVault === 'bank' || transferData.fromVault === 'online') && !transferData.fromSubWallet.trim()) {
      return addToast('Please specify the exact Source Bank or Wallet Name.', 'warning');
    }
    if ((transferData.toVault === 'bank' || transferData.toVault === 'online') && !transferData.toSubWallet.trim()) {
      return addToast('Please specify the exact Destination Bank or Wallet Name.', 'warning');
    }
    setConfirmShift(true);
  };

  const executeShift = async () => {
    setConfirmShift(false);
    setIsProcessing(true);

    try {
      const grossAmt = parseFloat(transferData.grossAmount) || 0;
      const netRecv = parseFloat(transferData.netReceived) || 0;
      const nwFee = parseFloat(transferData.networkFee) || 0;
      const destTax = parseFloat(transferData.taxAndFees) || 0;

      const fromRate = parseFloat(transferData.fromExchangeRate) || 1;
      const toRate = parseFloat(transferData.toExchangeRate) || 1;
      const feeRate = parseFloat(transferData.networkFeeExchangeRate) || 1;

      const freshFromBase = grossAmt * fromRate;
      const freshToBase = netRecv * toRate;
      const freshFeeBase = nwFee * feeRate;
      const freshTaxBase = destTax * toRate;

      const timestamp = new Date(transferData.date).getTime();
      const shiftId = editingShiftId || `SHIFT_${timestamp}_${Math.floor(Math.random() * 1000)}`;

      // 2. REVERSAL LOGIC: If editing, delete all previous records for this shift
      if (editingShiftId) {
        const collectionsToCheck = ['capitalShifts', 'cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
        for (let col of collectionsToCheck) {
          const q = query(collection(db, 'users', user.uid, col), where('shiftId', '==', editingShiftId));
          const querySnapshot = await getDocs(q);
          for (const document of querySnapshot.docs) {
            await deleteDoc(doc(db, 'users', user.uid, col, document.id));
          }
        }
      }

      // 3. Outgoing Record
      let outRecord = {};
      const fromCollection =
        transferData.fromVault === 'crypto' ? 'cryptoWalletLogs'
        : transferData.fromVault === 'online' ? 'onlineWallet'
        : transferData.fromVault === 'bank' ? 'bankWallet' : 'cashWallet';

      if (transferData.fromVault === 'crypto') {
        const cryptoSourceFee = transferData.fromAsset === transferData.networkFeeAsset ? nwFee : 0;
        outRecord = {
          type: 'out', coin: transferData.fromAsset, quantity: grossAmt,
          fee: cryptoSourceFee, feeAsset: transferData.networkFeeAsset,
          totalQuantity: grossAmt + cryptoSourceFee,
          platform: transferData.fromCryptoPlatform, reason: `Shifted to ${transferData.toVault.toUpperCase()}`,
          referenceNo: transferData.referenceId || '', date: transferData.date, timestamp, shiftId, isTransfer: true,
        };
      } else {
        outRecord = {
          title: `Transferred to ${transferData.toVault.toUpperCase()}`,
          type: 'out', feeType: outFeeType, date: transferData.date, timestamp,
          currency: transferData.fromAsset, foreignAmount: grossAmt, exchangeRate: fromRate,
          fee: freshFeeBase, feeAsset: baseCurrency, feeExchangeRate: 1,
          finalBaseAmount: freshFromBase, isTransfer: true, shiftId,
          notes: `Platform: ${transferData.routingPlatform || 'Direct'} | Agent: ${transferData.routingAgent || 'N/A'}`,
          walletName: transferData.fromSubWallet.trim() || 'Main Vault', bankName: transferData.fromSubWallet.trim() || 'Main Vault',
          walletCategory: 'Fiat Wallet', transferType: 'Internal Transfer',
          vaultId: transferData.fromVault === 'bank'
            ? 'bank_' + transferData.fromSubWallet.trim().toUpperCase()
            : transferData.fromVault === 'online'
            ? 'online_' + transferData.fromSubWallet.trim().toUpperCase()
            : 'cash_main',
        };
      }

      // 4. Incoming Record
      let inRecord = {};
      const toCollection =
        transferData.toVault === 'crypto' ? 'cryptoWalletLogs'
        : transferData.toVault === 'bank' ? 'bankWallet'
        : transferData.toVault === 'online' ? 'onlineWallet' : 'cashWallet';

      if (transferData.toVault === 'crypto') {
        inRecord = {
          type: 'in', coin: transferData.toAsset, quantity: netRecv,
          platform: transferData.toCryptoPlatform, reason: `Received from ${transferData.fromVault.toUpperCase()}`,
          referenceNo: transferData.referenceId || '', date: transferData.date, timestamp, shiftId, isTransfer: true,
        };
      } else {
        inRecord = {
          title: `Received from ${transferData.fromVault.toUpperCase()}${transferData.fromSubWallet ? ' - ' + transferData.fromSubWallet : ''}${transferData.routingPlatform ? ' via ' + transferData.routingPlatform : ''}`,
          type: 'in', feeType: 'exclusive', date: transferData.date, timestamp,
          currency: transferData.toAsset, foreignAmount: netRecv, exchangeRate: toRate,
          fee: freshTaxBase, feeAsset: baseCurrency, finalBaseAmount: freshToBase,
          isP2P: !!transferData.routingPlatform, isTransfer: true, shiftId,
          referenceNo: transferData.referenceId || '',
          notes: `Platform: ${transferData.routingPlatform || 'Direct'} | Agent: ${transferData.routingAgent || 'N/A'}`,
          walletName: transferData.toSubWallet.trim() || 'Main Vault', bankName: transferData.toSubWallet.trim() || 'Main Vault',
          walletCategory: 'Fiat Wallet', transferType: 'Internal Transfer',
          vaultId: transferData.toVault === 'bank'
            ? 'bank_' + transferData.toSubWallet.trim().toUpperCase()
            : transferData.toVault === 'online'
            ? 'online_' + transferData.toSubWallet.trim().toUpperCase()
            : 'cash_main',
        };
      }

      // 5. Database Writes
      await addDoc(collection(db, 'users', user.uid, fromCollection), outRecord);
      await addDoc(collection(db, 'users', user.uid, toCollection), inRecord);
      
      await addDoc(collection(db, 'users', user.uid, 'capitalShifts'), {
        ...transferData, grossAmount: grossAmt, netReceived: netRecv,
        networkFee: nwFee, taxAndFees: destTax,
        fromExchangeRate: fromRate, toExchangeRate: toRate, networkFeeExchangeRate: feeRate,
        fromSubWallet: transferData.fromVault === 'bank' || transferData.fromVault === 'online' ? transferData.fromSubWallet.trim() : '',
        toSubWallet: transferData.toVault === 'bank' || transferData.toVault === 'online' ? transferData.toSubWallet.trim() : '',
        outFeeType, shiftId, timestamp,
      });

      addToast(editingShiftId ? 'Capital Shift Updated Successfully! 🎯' : 'Capital Shift Executed Successfully! 🎯', 'success');
      
      setEditingShiftId(null);
      setTransferData({
        fromVault: 'online', fromSubWallet: '', fromCryptoPlatform: cryptoPlatformsList[0],
        fromAsset: availableFiats.includes('USD') ? 'USD' : baseCurrency, grossAmount: '',
        fromExchangeRate: 1, networkFeeAsset: availableFiats.includes('USD') ? 'USD' : baseCurrency,
        networkFee: '', networkFeeExchangeRate: 1, routingPlatform: '', routingAgent: '',
        toVault: 'bank', toSubWallet: '', toCryptoPlatform: cryptoPlatformsList[0],
        toAsset: baseCurrency, netReceived: '', toExchangeRate: 1, taxAndFees: '',
        date: getLocalDateTimeString(), referenceId: '',
      });
      setOutFeeType('inclusive');

    } catch (error) {
      console.error('Shift Execution Error:', error);
      addToast('Transfer Failed! Database system rejection.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete shift
  const initiateDeleteShift = shift => { setDeleteContext(shift); setPinInput(''); setPinError(''); };
  const executeSecureDeleteShift = async e => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError('Please enter your Security PIN.');
    setIsVerifying(true); setPinError('');
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const storedHash = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin;
      const { valid, newHash } = await verifyPIN(pinInput.trim(), storedHash, user.uid);
      if (!valid) { setPinError('Incorrect PIN. Deletion blocked! 🛑'); setIsVerifying(false); return; }
      if (newHash) { await setDoc(doc(db, 'users', user.uid), { security: { pinHash: newHash } }, { merge: true }); }
      await deleteDoc(doc(db, 'users', user.uid, 'capitalShifts', deleteContext.id));
      const collectionsToCheck = ['cashWallet','bankWallet','onlineWallet','cryptoWalletLogs','expenseLogs'];
      for (let col of collectionsToCheck) {
        const q = query(collection(db, 'users', user.uid, col), where('shiftId', '==', deleteContext.shiftId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async document => { await deleteDoc(doc(db, 'users', user.uid, col, document.id)); });
      }
      setDeleteContext(null);
      addToast('Shift deleted successfully. Reversed across vaults.', 'info');
    } catch (error) { setPinError('System error during deletion. Try again.'); } finally { setIsVerifying(false); }
  };

  const vaultOptions = [
    { value: 'crypto', label: '🚀 Crypto Engine' },
    { value: 'online', label: '🌐 Online Wallet' },
    { value: 'bank', label: '🏦 Bank Account' },
    { value: 'cash', label: '💵 Physical Cash' },
  ];

  // ---------- GROUPED HISTORY ----------
  const groupedHistory = useMemo(() => {
    const groups = {};
    shiftHistory.forEach(shift => {
      const monthKey = getCalendarMonthKey(shift.date);
      if (!groups[monthKey]) {
        const dateObj = new Date(shift.date);
        const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        groups[monthKey] = { monthKey, monthName, shifts: [], totalGross: 0, totalFees: 0, totalNetReceived: 0, count: 0 };
      }
      const gross = (Number(shift.grossAmount) || 0) * (Number(shift.fromExchangeRate) || 1);
      const fees = (Number(shift.networkFee) || 0) * (Number(shift.networkFeeExchangeRate) || 1) + (Number(shift.taxAndFees) || 0) * (Number(shift.toExchangeRate) || 1);
      const net = (Number(shift.netReceived) || 0) * (Number(shift.toExchangeRate) || 1);
      groups[monthKey].shifts.push(shift);
      groups[monthKey].totalGross += gross;
      groups[monthKey].totalFees += fees;
      groups[monthKey].totalNetReceived += net;
      groups[monthKey].count++;
    });
    const keys = Object.keys(groups).sort((a, b) => (groups[b].shifts[0]?.timestamp || 0) - (groups[a].shifts[0]?.timestamp || 0));
    return keys.map(key => groups[key]);
  }, [shiftHistory, getCalendarMonthKey, formatGlobalDate]);

  const HistorySkeleton = () => (
    <div className="space-y-4 animate-pulse">
      {[1,2,3].map(i => (
        <div key={i} className="flex items-center gap-6 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg ml-auto" />
        </div>
      ))}
    </div>
  );

  // ---------- RENDER ----------
  return (
    <div className="w-full h-auto pb-28">
      <div className="pt-20 sm:pt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto px-4 md:px-6">
        
        {/* HEADER */}
        <div className="relative rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50 z-20">
          <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.1),transparent_70%)]" />
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-50 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <HiOutlineSwitchHorizontal size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">Capital Shifting</h1>
                  <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">Move assets across vaults with full ledger integrity</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-auto">
                <button onClick={() => !isGeneratingReport && setIsExportMenuOpen(!isExportMenuOpen)} onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)} disabled={isGeneratingReport}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 shadow-sm disabled:opacity-50">
                  {isGeneratingReport ? <><HiOutlineRefresh className="animate-spin" size={16} /> Generating...</> : <><HiOutlineDownload size={16} /> Export</>}
                </button>
                {isExportMenuOpen && !isGeneratingReport && (
                  <div className="absolute top-[110%] right-0 w-full md:w-48 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl flex flex-col p-1.5 z-[100] animate-in fade-in zoom-in-95">
                    <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700 text-slate-200 text-[11px] font-black rounded-lg transition-colors"><HiOutlineDocumentText className="text-rose-400" size={18}/> PDF Document</button>
                    <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700 text-slate-200 text-[11px] font-black rounded-lg transition-colors"><HiOutlineTable className="text-emerald-400" size={18}/> Excel (CSV)</button>
                  </div>
                )}
              </div>
              <button type="button" onClick={fetchLiveRates} disabled={isFetchingRate}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/30 disabled:opacity-50">
                <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={18}/> {isFetchingRate ? 'Syncing...' : 'Sync Rates'}
              </button>
            </div>
          </div>
          <div className="relative z-30 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-8 pt-6 border-t border-white/10">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><HiOutlineSwitchHorizontal size={14}/> Total Shifts</p><p className="text-xl sm:text-2xl font-black text-white">{totalShifts}</p></div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><HiOutlineTrendingUp size={14}/> Total Volume</p><p className="text-xl sm:text-2xl font-black text-white truncate" title={`${currencySymbol}${totalVolume}`}>{currencySymbol}{totalVolume.toLocaleString(undefined, {maximumFractionDigits: 0})}</p></div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5 col-span-2 md:col-span-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><HiOutlineShieldCheck size={14}/> Connected Vaults</p><p className="text-xl sm:text-2xl font-black text-white">{existingVaultNames.length}</p></div>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={(e) => { e.preventDefault(); handleTransfer(); }} className="space-y-6">
          {/* STEP 1: SOURCE */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-300 dark:border-slate-700 overflow-hidden z-10 relative">
            <div className="px-6 py-4 bg-slate-50 dark:bg-rose-500/5 border-b border-slate-300 dark:border-slate-700">
              <h2 className="text-sm font-black text-rose-700 dark:text-rose-500 uppercase tracking-widest flex items-center gap-2"><FaWallet /> Step 1: Source Vault (Deduction)</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <VaultSelector value={transferData.fromVault} onChange={e => setTransferData({...transferData, fromVault: e.target.value, fromSubWallet: ''})}
                  options={vaultOptions} icon={FaWallet} color="text-rose-600 dark:text-rose-500" label="Source Vault" />
                {(transferData.fromVault === 'bank' || transferData.fromVault === 'online') && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">{transferData.fromVault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
                    <input type="text" list="existing-vaults-source" required value={transferData.fromSubWallet}
                      onChange={(e) => setTransferData({...transferData, fromSubWallet: e.target.value})}
                      placeholder={transferData.fromVault === 'bank' ? 'e.g., SBI, Chase' : 'e.g., PayPal, Skrill'}
                      className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
                    <datalist id="existing-vaults-source">{existingVaultNames.map(b => <option key={b} value={b} />)}</datalist>
                  </div>
                )}
                {transferData.fromVault === 'crypto' && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                    <div className="relative">
                      <select value={transferData.fromCryptoPlatform} onChange={e => setTransferData({...transferData, fromCryptoPlatform: e.target.value})}
                        className="w-full pl-4 pr-10 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 cursor-pointer appearance-none shadow-sm transition-colors">
                        {cryptoPlatformsList.map(p => <option key={`src-${p}`} value={p}>{p}</option>)}
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Asset Sent</label>
                  <div className="relative">
                    <select value={transferData.fromAsset} onChange={e => setTransferData({...transferData, fromAsset: e.target.value, fromExchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                      className="w-full pl-4 pr-10 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 cursor-pointer appearance-none shadow-sm transition-colors">
                      <optgroup label="Fiat">{availableFiats.map(c => <option key={`f-${c}`} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}</optgroup>
                      <optgroup label="Crypto">{availableCryptos.map(c => <option key={`c-${c}`} value={c}>{c}</option>)}</optgroup>
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Gross Amount</label>
                  <input type="number" step="any" required placeholder="0.00" value={transferData.grossAmount}
                    onChange={e => setTransferData({...transferData, grossAmount: e.target.value})}
                    className="w-full p-3.5 bg-rose-50 dark:bg-slate-900 border-2 border-rose-300 dark:border-slate-700 rounded-xl font-black text-rose-900 dark:text-rose-400 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/50 text-lg shadow-sm placeholder-rose-400 dark:placeholder-slate-500 transition-colors" />
                </div>
              </div>

              {/* Exchange rate if foreign */}
              {isFromForeign && transferData.fromVault !== 'crypto' && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-400 flex items-center gap-2 shrink-0"><FaExchangeAlt className="text-rose-500" /> Rate:</span>
                  <div className="flex items-center gap-2 flex-1 w-full">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">1 {transferData.fromAsset} =</span>
                    <input type="number" step="any" required value={transferData.fromExchangeRate}
                      onChange={e => setTransferData({...transferData, fromExchangeRate: e.target.value})}
                      className="flex-1 w-full min-w-0 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/50 transition-colors" />
                    <span className="text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">{baseCurrency}</span>
                  </div>
                </div>
              )}

              {/* Network Fee with Fee Type Toggle */}
              <div className="space-y-5 pt-5 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><FaGasPump className="text-rose-500"/> Fee Asset</label>
                    <div className="relative">
                      <select value={transferData.networkFeeAsset} onChange={e => setTransferData({...transferData, networkFeeAsset: e.target.value, networkFeeExchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                        className="w-full pl-4 pr-10 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer appearance-none shadow-sm transition-colors">
                        <optgroup label="Fiat">{availableFiats.map(c => <option key={`f-f-${c}`} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}</optgroup>
                        <optgroup label="Crypto">{availableCryptos.map(c => <option key={`c-f-${c}`} value={c}>{c}</option>)}</optgroup>
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Fee Amount</label>
                    <input type="number" step="any" placeholder="0.00" value={transferData.networkFee}
                      onChange={e => setTransferData({...transferData, networkFee: e.target.value})}
                      className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/50 shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
                  </div>
                  {isFeeForeign && transferData.fromVault !== 'crypto' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Fee Rate</label>
                      <input type="number" step="any" value={transferData.networkFeeExchangeRate}
                        onChange={e => setTransferData({...transferData, networkFeeExchangeRate: e.target.value})}
                        className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/50 shadow-sm transition-colors" />
                    </div>
                  )}
                </div>

                {/* Fee Type Toggle */}
                {transferData.fromVault !== 'crypto' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Fee Calculation</label>
                    <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <button type="button" onClick={() => setOutFeeType('inclusive')}
                        className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${outFeeType === 'inclusive' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Fee Included
                      </button>
                      <button type="button" onClick={() => setOutFeeType('exclusive')}
                        className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${outFeeType === 'exclusive' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Fee Added (+)
                      </button>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 mt-1">
                      {outFeeType === 'inclusive' ? 'Fee is part of the gross amount; total deduction = gross amount.' : 'Fee is extra; total deduction = gross + fee.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BRIDGE ARROWS */}
          <div className="flex justify-center -my-4 relative z-10 pointer-events-none">
            <div className="w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-500/30 border-4 border-slate-50 dark:border-slate-950">
              <HiOutlineArrowRight size={22} className="rotate-90 md:rotate-0" />
            </div>
          </div>

          {/* ROUTING */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-300 dark:border-slate-700 overflow-hidden relative z-10">
            <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-slate-300 dark:border-slate-700">
              <h2 className="text-sm font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2"><FaShieldAlt /> Step 2: Routing Details (Optional)</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Platform / Exchange</label>
                  <input type="text" placeholder="e.g., Binance P2P, Western Union" value={transferData.routingPlatform}
                    onChange={e => setTransferData({...transferData, routingPlatform: e.target.value})}
                    className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Agent / Broker</label>
                  <input type="text" placeholder="e.g., Friend's UPI, Agent Name" value={transferData.routingAgent}
                    onChange={e => setTransferData({...transferData, routingAgent: e.target.value})}
                    className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-4 relative z-10 pointer-events-none">
            <div className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 border-4 border-slate-50 dark:border-slate-950">
              <HiOutlineArrowRight size={22} className="rotate-90 md:rotate-0" />
            </div>
          </div>

          {/* STEP 3: DESTINATION */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-300 dark:border-slate-700 overflow-hidden relative z-10">
            <div className="px-6 py-4 bg-slate-50 dark:bg-emerald-500/5 border-b border-slate-300 dark:border-slate-700">
              <h2 className="text-sm font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2"><FaUniversity /> Step 3: Destination Vault (Deposit)</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <VaultSelector value={transferData.toVault} onChange={e => setTransferData({...transferData, toVault: e.target.value, toSubWallet: ''})}
                  options={vaultOptions} icon={FaUniversity} color="text-emerald-600 dark:text-emerald-500" label="Destination Vault" />
                {(transferData.toVault === 'bank' || transferData.toVault === 'online') && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">{transferData.toVault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
                    <input type="text" list="existing-vaults-dest" required value={transferData.toSubWallet}
                      onChange={(e) => setTransferData({...transferData, toSubWallet: e.target.value})}
                      placeholder={transferData.toVault === 'bank' ? 'e.g., SBI, Chase' : 'e.g., PayPal, Skrill'}
                      className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
                    <datalist id="existing-vaults-dest">{existingVaultNames.map(b => <option key={b} value={b} />)}</datalist>
                  </div>
                )}
                {transferData.toVault === 'crypto' && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                    <div className="relative">
                      <select value={transferData.toCryptoPlatform} onChange={e => setTransferData({...transferData, toCryptoPlatform: e.target.value})}
                        className="w-full pl-4 pr-10 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 cursor-pointer appearance-none shadow-sm transition-colors">
                        {cryptoPlatformsList.map(p => <option key={`dest-${p}`} value={p}>{p}</option>)}
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Asset Received</label>
                  <div className="relative">
                    <select value={transferData.toAsset} onChange={e => setTransferData({...transferData, toAsset: e.target.value, toExchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                      className="w-full pl-4 pr-10 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 cursor-pointer appearance-none shadow-sm transition-colors">
                      <optgroup label="Fiat">{availableFiats.map(c => <option key={`f-t-${c}`} value={c}>{c} {c === baseCurrency ? '(Base)' : ''}</option>)}</optgroup>
                      <optgroup label="Crypto">{availableCryptos.map(c => <option key={`c-t-${c}`} value={c}>{c}</option>)}</optgroup>
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Net Received</label>
                  <input type="number" step="any" required placeholder="0.00" value={transferData.netReceived}
                    onChange={e => setTransferData({...transferData, netReceived: e.target.value})}
                    className="w-full p-3.5 bg-emerald-50 dark:bg-slate-900 border-2 border-emerald-300 dark:border-slate-700 rounded-xl font-black text-emerald-900 dark:text-emerald-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 text-lg shadow-sm placeholder-emerald-400 dark:placeholder-slate-500 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Deposit Tax/Fee ({transferData.toAsset})</label>
                  <input type="number" step="any" placeholder="0.00" value={transferData.taxAndFees}
                    onChange={e => setTransferData({...transferData, taxAndFees: e.target.value})}
                    className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
                </div>
                {isToForeign && transferData.toVault !== 'crypto' && (
                  <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 md:col-span-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-400 flex items-center gap-2 shrink-0"><FaExchangeAlt className="text-emerald-500" /> Rate:</span>
                    <div className="flex items-center gap-2 flex-1 w-full">
                      <span className="text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">1 {transferData.toAsset} =</span>
                      <input type="number" step="any" required value={transferData.toExchangeRate}
                        onChange={e => setTransferData({...transferData, toExchangeRate: e.target.value})}
                        className="flex-1 w-full min-w-0 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" />
                      <span className="text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">{baseCurrency}</span>
                    </div>
                  </div>
                )}
                <div className={`space-y-2 ${isToForeign && transferData.toVault !== 'crypto' ? 'md:col-span-3' : ''}`}>
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                    <span>Date & Time</span><span className="text-emerald-700 dark:text-emerald-400">{formatGlobalDate ? formatGlobalDate(transferData.date, 'short') : ''}</span>
                  </label>
                  <input type="datetime-local" required value={transferData.date}
                    onChange={e => setTransferData({...transferData, date: e.target.value})}
                    className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 shadow-sm transition-colors cursor-pointer" />
                </div>
              </div>
            </div>
          </div>

          {/* SUMMARY BAR */}
          <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-700 relative z-10">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
                <FaExchangeAlt className="text-indigo-400" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-white truncate">
                  {transferData.grossAmount || 0} {transferData.fromAsset} → {transferData.netReceived || 0} {transferData.toAsset}
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                  {transferData.fromVault !== 'crypto' ? (
                    <>{outFeeType === 'inclusive' ? 'Fee included in total out.' : 'Fee added on top.'} </>
                  ) : null}
                  Vault balances will update accurately.
                </p>
              </div>
            </div>
            
            <div className="flex w-full md:w-auto gap-3">
              {editingShiftId && (
                <button type="button" onClick={cancelEdit}
                  className="w-full md:w-auto px-6 py-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-sm border border-slate-600 flex items-center justify-center">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={isProcessing || !transferData.grossAmount || !transferData.netReceived}
                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                {isProcessing ? <HiOutlineRefresh className="animate-spin" size={20} /> : <FaArrowRight size={18} />}
                {isProcessing ? 'Executing...' : (editingShiftId ? 'Update Shift' : 'Execute Shift')}
              </button>
            </div>
          </div>
        </form>

        {/* HISTORY SECTION */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <HiOutlineCalendar className="text-indigo-500" size={18} /> Recent Ledger Shifts
            </h3>
          </div>
          {isLoadingHistory ? <HistorySkeleton /> : groupedHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-sm">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3 border border-slate-200 dark:border-slate-700">
                <HiOutlineSwitchHorizontal className="text-3xl text-slate-500 dark:text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">No shifts recorded</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Execute a capital shift to see history</p>
            </div>
          ) : (
            groupedHistory.map(month => {
              const isOpen = openMonths.has(month.monthKey);
              return (
                <div key={month.monthKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm mb-4">
                  <button onClick={() => toggleMonth(month.monthKey)}
                    className="w-full px-6 py-5 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left">
                    <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg"><HiOutlineCalendar size={18} /></div>
                      {month.monthName}
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex gap-4 text-xs font-bold">
                        <span className="text-emerald-600">Vol: {currencySymbol}{month.totalGross.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                        <span className="text-rose-600">Fees: {currencySymbol}{month.totalFees.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                      </div>
                      <HiOutlineChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="animate-in fade-in duration-200">
                      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800">
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Shifts</p><p className="font-black text-slate-700 dark:text-slate-300">{month.count}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gross Sent</p><p className="font-black text-indigo-600">{currencySymbol}{month.totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Fees</p><p className="font-black text-rose-600">-{currencySymbol}{month.totalFees.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Net Received</p><p className="font-black text-emerald-600">+{currencySymbol}{month.totalNetReceived.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                      </div>
                      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                        {month.shifts.map(shift => {
                          const dateObj = new Date(shift.date);
                          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={shift.id} className="p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col gap-3 group">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                                      <HiOutlineSwitchHorizontal size={12} />
                                    </div>
                                    Capital Shift
                                  </h3>
                                  <div className="mt-2 flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-400">
                                    <span className="text-rose-600 dark:text-rose-400 uppercase tracking-widest">{shift.fromVault}</span> 
                                    <HiOutlineArrowRight size={10} className="text-slate-400 dark:text-slate-500" /> 
                                    <span className="text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{shift.toVault}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm sm:text-base font-black text-slate-800 dark:text-white truncate">
                                    {Number(shift.grossAmount).toLocaleString()} <span className="text-[10px] text-slate-500 uppercase">{shift.fromAsset}</span>
                                  </p>
                                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-widest">Shifted Volume</p>
                                </div>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border border-slate-100 dark:border-slate-800/50 mt-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full shadow-sm bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800/50">
                                    <FaArrowUp size={10} />
                                  </div>
                                  <div>
                                    <p className="font-black text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                                      -{Number(shift.grossAmount).toLocaleString()} <span className="text-[9px] uppercase">{shift.fromAsset}</span>
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest mt-0.5">
                                      <span className="font-black text-rose-700 dark:text-rose-400 uppercase text-[9px]">{shift.fromVault}: {shift.fromVault === 'crypto' ? (shift.fromCryptoPlatform || 'Main') : (shift.fromSubWallet || 'Main')}</span>
                                    </p>
                                    {shift.networkFee > 0 && (
                                      <p className="text-[8px] font-bold text-rose-700 dark:text-rose-400 mt-1 bg-rose-50 dark:bg-rose-500/10 inline-block px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-500/20">Fee: {shift.networkFee} {shift.networkFeeAsset}</p>
                                    )}
                                  </div>
                                </div>
                                <HiOutlineArrowRight className="text-slate-300 dark:text-slate-600 hidden sm:block mx-2" />
                                <HiOutlineArrowRight className="text-slate-300 dark:text-slate-600 block sm:hidden rotate-90 mx-auto my-1" />
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full shadow-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/50">
                                    <FaArrowDown size={10} />
                                  </div>
                                  <div>
                                    <p className="font-black text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                                      +{Number(shift.netReceived).toLocaleString()} <span className="text-[9px] uppercase">{shift.toAsset}</span>
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest mt-0.5">
                                     <span className="font-black text-emerald-700 dark:text-emerald-400 uppercase text-[9px]">{shift.toVault}: {shift.toVault === 'crypto' ? (shift.toCryptoPlatform || 'Main') : (shift.toSubWallet || 'Main')}</span>
                                    </p>
                                    {shift.taxAndFees > 0 && (
                                      <p className="text-[8px] font-bold text-rose-700 dark:text-rose-400 mt-1 bg-rose-50 dark:bg-rose-500/10 inline-block px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-500/20">Tax: {shift.taxAndFees} {shift.toAsset}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-end justify-between mt-1 pt-2">
                                <div className="flex flex-col gap-1.5">
                                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 w-fit">
                                    <HiOutlineCalendar size={12} className="text-slate-500" /> {formatGlobalDate ? formatGlobalDate(shift.date, 'short') : shift.date.split('T')[0]} <span className="opacity-50 ml-1">{timeStr}</span>
                                  </p>
                                  {shift.routingPlatform && (
                                    <p className="text-[9px] sm:text-[10px] font-black text-indigo-600 dark:text-indigo-400 mt-1 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-500/30 w-fit uppercase tracking-widest">
                                      <HiOutlineGlobe size={10} className="inline mr-1" /> Via: {shift.routingPlatform}
                                      {shift.routingAgent && <span> ({shift.routingAgent})</span>}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => initiateEditShift(shift)}
                                    className="p-2 sm:p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg sm:rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors border border-indigo-200 dark:border-indigo-500/30 active:scale-95 shadow-sm md:opacity-0 group-hover:opacity-100">
                                    <HiOutlinePencil size={14} />
                                  </button>
                                  
                                  <button onClick={() => initiateDeleteShift(shift)}
                                    className="p-2 sm:p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg sm:rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border border-rose-200 dark:border-rose-500/30 active:scale-95 shadow-sm md:opacity-0 group-hover:opacity-100">
                                    <HiOutlineTrash size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmShift && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <h3 className="text-xl font-black flex items-center gap-2"><FaExchangeAlt size={20} /> {editingShiftId ? 'Confirm Updates' : 'Confirm Capital Shift'}</h3>
              <p className="text-xs text-white/70 mt-1">This action will securely update both vaults with precise calculations.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 space-y-2">
                <p><span className="text-rose-500">From:</span> {transferData.grossAmount} {transferData.fromAsset} ({transferData.fromVault})</p>
                <p><span className="text-emerald-500">To:</span> {transferData.netReceived} {transferData.toAsset} ({transferData.toVault})</p>
                {transferData.routingPlatform && <p className="text-indigo-500">Via: {transferData.routingPlatform}</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmShift(false)} className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-colors">Cancel</button>
                <button onClick={executeShift} disabled={isProcessing} className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50">
                  {editingShiftId ? 'Update Shift' : 'Confirm Shift'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PIN MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-700">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><HiOutlineShieldCheck size={24} /></div>
                <div><h3 className="text-xl font-black">Security Verification</h3><p className="text-xs text-white/70">Enter PIN to confirm deletion</p></div>
              </div>
            </div>
            <form onSubmit={executeSecureDeleteShift} className="p-6 space-y-5">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Deleting this shift will accurately reverse the transaction across both vaults.</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Security PIN</label>
                <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-[0.3em] text-xl p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm focus:border-rose-500" />
                {pinError && <p className="text-xs font-bold text-rose-700 dark:text-rose-400 mt-2 text-center">{pinError}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors shadow-sm">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 active:scale-95">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : <HiOutlineTrash size={18} />} Confirm Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const CapitalShifting = () => (
  <ToastProvider>
    <CapitalShiftingContent />
  </ToastProvider>
);

export default CapitalShifting;