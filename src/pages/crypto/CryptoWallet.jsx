// src/pages/accounts/CryptoWallet.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  collection, addDoc, setDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, getDoc, getDocs, where
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPIN } from '../../utils/cryptoUtils';
import { useCryptoPrice } from '../../context/CryptoPriceContext';
import {
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineDownload, HiOutlineUpload,
  HiOutlineInformationCircle, HiOutlineChevronDown,
  HiOutlineDocumentText, HiOutlineTable, HiOutlineShieldCheck, HiOutlineSwitchHorizontal, HiOutlineCalendar,
  HiOutlineCheckCircle
} from 'react-icons/hi';
import { 
  FaBitcoin, FaWallet, FaChartPie, FaBuilding, FaExchangeAlt, 
  FaArrowDown, FaArrowUp, FaLock 
} from 'react-icons/fa';

// ============================================
// 🚀 MINI TOAST SYSTEM (Self-contained)
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
  const symbolUpper = symbol?.toUpperCase();

  useEffect(() => { setHasError(false); }, [logoUrl]);

  if (!logoUrl || hasError) {
    return (
      <span className={`w-full h-full rounded-full flex items-center justify-center font-black text-[10px] sm:text-[11px] ${bg || 'bg-slate-200 dark:bg-slate-700'} ${color || 'text-slate-600 dark:text-white'} shadow-inner border border-black/5 dark:border-white/5`}>
        {symbolUpper?.substring(0, 3)}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={symbolUpper}
      className="w-full h-full object-contain rounded-full relative z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-0.5"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
};

const getLocalISOString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
};

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const CryptoWalletContent = () => {
  const { user, baseCurrency = 'USD', selectedCryptos = [], selectedFiats = [], formatGlobalDate, getCalendarMonthKey } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();
  
  // ✅ CONTEXT से लाइव प्राइस – बिल्कुल सही जगह पर
  const { livePrices, fiatRate, isLoading: isMarketSyncing } = useCryptoPrice();

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [transactionType, setTransactionType] = useState('in');

  const [isBridging, setIsBridging] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [existingVaultNames, setExistingVaultNames] = useState([]);
  const [existingCryptoPlatforms, setExistingCryptoPlatforms] = useState([]);

  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const localTimeStr = getLocalISOString();

  const getCurrentMonthKey = () => getCalendarMonthKey ? getCalendarMonthKey(new Date().toISOString()) : `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const [openMonths, setOpenMonths] = useState(new Set([getCurrentMonthKey()]));
  const toggleMonth = (monthKey) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  };

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

  const availableFiats = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);
  const availableCryptos = useMemo(() => fullDatabase.map(c => c.symbol.toUpperCase()), [fullDatabase]);

  const [formData, setFormData] = useState({
    coin: availableCryptos[0] || 'USDT', quantity: '', platform: '',
    reason: '', referenceNo: '', date: localTimeStr,
    fiatAmount: '', fiatFee: '', fiatCurrency: baseCurrency, fiatExchangeRate: 1, 
    destinationVault: 'bankWallet', destinationVaultName: '', isSynced: false
  });

  useEffect(() => {
    if (!user) return;
    const fetchVaultsAndPlatforms = async () => {
      const qBank = query(collection(db, "users", user.uid, "bankWallet"));
      const snapBank = await getDocs(qBank);
      const qOnline = query(collection(db, "users", user.uid, "onlineWallet"));
      const snapOnline = await getDocs(qOnline);
      const names = new Set();
      snapBank.docs.forEach(d => { if(d.data().bankName) names.add(d.data().bankName) });
      snapOnline.docs.forEach(d => { if(d.data().walletName) names.add(d.data().walletName) });
      setExistingVaultNames(Array.from(names));

      const qCrypto = query(collection(db, "users", user.uid, "cryptoWalletLogs"));
      const snapCrypto = await getDocs(qCrypto);
      const cryptoNames = new Set();
      snapCrypto.docs.forEach(d => {
        if(d.data().platform) cryptoNames.add(d.data().platform);
        if(d.data().fromPlatform) cryptoNames.add(d.data().fromPlatform);
        if(d.data().toPlatform) cryptoNames.add(d.data().toPlatform);
      });
      setExistingCryptoPlatforms(Array.from(cryptoNames));
    };
    fetchVaultsAndPlatforms();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const cryptoRef = collection(db, "users", user.uid, "cryptoWalletLogs");
    const q = query(cryptoRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (err) => {
      addToast('Failed to load crypto transactions.', 'error');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, addToast]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().customCoins) setCustomUserCoins(userSnap.data().customCoins);
    };
    fetchUserData();
  }, [user]);

  // ✅ FIXED: Holdings now include fee in out deductions (totalQuantity)
  const holdings = useMemo(() => {
    const vault = {};
    transactions.forEach(t => {
      if (!vault[t.coin]) vault[t.coin] = { total: 0, platforms: {} };
      const qty = parseFloat(t.quantity) || 0;
      const fee = parseFloat(t.networkFee || t.fee) || 0;
      const totalQty = parseFloat(t.totalQuantity) || (qty + fee);

      if (t.type === 'in') {
        vault[t.coin].total += qty;
        vault[t.coin].platforms[t.platform] = (vault[t.coin].platforms[t.platform] || 0) + qty;
      } else if (t.type === 'out') {
        vault[t.coin].total -= totalQty;
        vault[t.coin].platforms[t.platform] = (vault[t.coin].platforms[t.platform] || 0) - totalQty;
      } else if (t.type === 'transfer') {
        vault[t.coin].platforms[t.fromPlatform] = (vault[t.coin].platforms[t.fromPlatform] || 0) - qty;
        vault[t.coin].platforms[t.toPlatform] = (vault[t.coin].platforms[t.toPlatform] || 0) + (qty - fee);
        vault[t.coin].total -= fee;
      }
    });

    Object.keys(vault).forEach(coin => {
      Object.keys(vault[coin].platforms).forEach(plat => {
        if (vault[coin].platforms[plat] <= 0.00000001) delete vault[coin].platforms[plat];
      });
      if (vault[coin].total <= 0.00000001) delete vault[coin];
    });
    return vault;
  }, [transactions]);

  // ✅ कीमतें अब context से आती हैं – किसी fetchMarketData की ज़रूरत नहीं

  const totalVaultValue = useMemo(() => {
    return Object.entries(holdings).reduce((total, [coin, data]) => {
      const priceUSD = livePrices[coin.toUpperCase()]?.priceUSD || 0;
      return total + (data.total * priceUSD * fiatRate);
    }, 0);
  }, [holdings, livePrices, fiatRate]);

  const fetchFiatLiveRate = async () => {
    if (formData.fiatCurrency === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.fiatCurrency}`);
      const data = await res.json();
      if (data.rates[baseCurrency]) setFormData(prev => ({ ...prev, fiatExchangeRate: data.rates[baseCurrency].toFixed(4) }));
    } catch (error) {
      addToast("Failed to fetch live fiat rate.", "error");
    } finally { setIsFetchingRate(false); }
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return;
    const qty = parseFloat(formData.quantity);
    if (qty <= 0 && !formData.isSynced) { addToast("Quantity must be greater than zero.", "warning"); return; }
    if (!formData.platform.trim()) { addToast("Please enter a wallet/platform name!", "warning"); return; }

    if (transactionType === 'out' && !formData.isSynced) {
      if (qty > (holdings[formData.coin]?.platforms[formData.platform] || 0)) {
        addToast(`Insufficient Crypto Funds! Available: ${holdings[formData.coin]?.platforms[formData.platform] || 0}`, "error");
        return;
      }
      if (isBridging && !editingId && (formData.destinationVault === 'bankWallet' || formData.destinationVault === 'onlineWallet') && !formData.destinationVaultName.trim()) {
        addToast("Please specify the exact Bank or Wallet Name for the Fiat conversion.", "warning");
        return;
      }
    }

    setIsSaving(true);
    const timestamp = editingId ? transactions.find(t => t.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const formattedDate = new Date(formData.date).toISOString().split('T')[0];

    const recordData = {
      type: transactionType,
      coin: formData.coin,
      quantity: qty,
      date: formattedDate,
      timestamp,
      referenceNo: formData.referenceNo || '',
      platform: formData.platform.trim(),
      reason: formData.reason || (transactionType === 'in' ? 'Deposit / Buy' : 'Withdrawal / Sell')
    };

    try {
      let cryptoRecordId = editingId;
      if (editingId) {
        if (formData.isSynced) {
          await setDoc(doc(db, "users", user.uid, "cryptoWalletLogs", editingId), {
            platform: formData.platform.trim(),
            reason: formData.reason,
            referenceNo: formData.referenceNo || ''
          }, { merge: true });
          addToast('Platform/Note updated for synced record.', 'success');
        } else {
          await setDoc(doc(db, "users", user.uid, "cryptoWalletLogs", editingId), recordData, { merge: true });
          addToast('Transaction updated.', 'success');
        }
      } else {
        const docRef = await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), recordData);
        cryptoRecordId = docRef.id;

        if (transactionType === 'out' && isBridging) {
          const grossFiat = parseFloat(formData.fiatAmount) || 0;
          const fiatFee = parseFloat(formData.fiatFee) || 0;
          const exRate = parseFloat(formData.fiatExchangeRate) || 1;
          const linkId = `BRIDGE_${timestamp}_${Math.floor(Math.random() * 1000)}`;

          let fiatRecord = {
            title: `Sold ${qty} ${formData.coin} (From ${formData.platform})`,
            type: 'in', date: formattedDate, timestamp, currency: formData.fiatCurrency,
            linkedCryptoId: cryptoRecordId, linkId
          };

          if (formData.destinationVault === 'bankWallet') {
            fiatRecord.foreignAmount = grossFiat;
            fiatRecord.exchangeRate = exRate;
            fiatRecord.fee = fiatFee * exRate;
            fiatRecord.finalBaseAmount = (grossFiat * exRate) - (fiatFee * exRate);
            fiatRecord.bankName = formData.destinationVaultName.trim();
            fiatRecord.transferType = 'Crypto P2P / Sell';
            fiatRecord.vaultId = 'bank_' + formData.destinationVaultName.trim().toUpperCase();
          }
          else if (formData.destinationVault === 'onlineWallet') {
            const net = grossFiat - fiatFee;
            fiatRecord.foreignAmount = grossFiat;
            fiatRecord.fee = fiatFee;
            fiatRecord.exchangeRate = exRate;
            fiatRecord.finalBaseAmount = net * exRate;
            fiatRecord.walletName = formData.destinationVaultName.trim();
            fiatRecord.vaultId = 'online_' + formData.destinationVaultName.trim().toUpperCase();
          }
          else if (formData.destinationVault === 'cashWallet') {
            const net = grossFiat - fiatFee;
            fiatRecord.foreignAmount = net;
            fiatRecord.exchangeRate = exRate;
            fiatRecord.finalBaseAmount = net * exRate;
            fiatRecord.vaultId = 'cash_main';
          }

          await addDoc(collection(db, "users", user.uid, formData.destinationVault), fiatRecord);
        }
        addToast('Transaction logged.', 'success');
      }
      closeModal();
    } catch (error) {
      addToast("System Error. Failed to save transaction.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (rec) => {
    const isSyncedEntry = !!(rec.linkedIncomeId || rec.linkedExpenseId || rec.shiftId || rec.linkedPartyId);
    
    setTransactionType(rec.type === 'transfer' ? 'out' : rec.type);
    setIsBridging(false);

    let editDateStr = rec.date;
    if (editDateStr.length === 10) { editDateStr = editDateStr + 'T12:00'; }
    else if (rec.timestamp) {
      const d = new Date(rec.timestamp);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      editDateStr = d.toISOString().slice(0, 16);
    }

    setFormData({
      coin: rec.coin, quantity: rec.quantity, platform: rec.platform || rec.fromPlatform || existingCryptoPlatforms[0] || '',
      reason: rec.reason || '', referenceNo: rec.referenceNo || '',
      date: editDateStr,
      fiatAmount: '', fiatFee: '', fiatCurrency: baseCurrency, fiatExchangeRate: 1,
      destinationVault: 'bankWallet', destinationVaultName: existingVaultNames[0] || '',
      isSynced: isSyncedEntry
    });
    setEditingId(rec.id);
    setIsModalOpen(true);
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your PIN.");
    setIsVerifying(true);
    setPinError('');
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      const storedHash = userData?.security?.pinHash || userData?.securityPin || userData?.pin;
      const { valid, newHash } = await verifyPIN(pinInput.trim(), storedHash, user.uid);

      if (!valid) {
        setPinError("Incorrect PIN.");
        setIsVerifying(false);
        return;
      }
      if (newHash) {
        await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true });
      }

      await deleteDoc(doc(db, "users", user.uid, "cryptoWalletLogs", deleteContext.id));

      const linkedVaults = ['bankWallet', 'onlineWallet', 'cashWallet'];
      for (const vault of linkedVaults) {
        const q = query(collection(db, "users", user.uid, vault), where("linkedCryptoId", "==", deleteContext.id));
        const snap = await getDocs(q);
        snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, vault, d.id)));
      }
      setDeleteContext(null);
      addToast('Transaction deleted.', 'info');
    } catch (error) {
      setPinError("Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openModal = (type) => {
    if (availableCryptos.length === 0) {
      addToast("Your Watchlist is empty! Please add crypto assets in Settings > Tickers first.", "warning");
      return;
    }
    setTransactionType(type);
    setEditingId(null);
    setIsBridging(false);
    setFormData(prev => ({
      ...prev, coin: availableCryptos[0], quantity: '', reason: '', referenceNo: '',
      platform: existingCryptoPlatforms[0] || '',
      destinationVaultName: existingVaultNames[0] || '', date: getLocalISOString(), isSynced: false
    }));
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const filteredLedger = transactions.filter(t =>
    t.coin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.platform?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const processedMonths = useMemo(() => {
    const sorted = [...filteredLedger].sort((a, b) => new Date(a.date) - new Date(b.date));
    const grouped = {};

    sorted.forEach(t => {
      const dateObj = new Date(t.date || new Date());
      const monthKey = getCalendarMonthKey ? getCalendarMonthKey(t.date) : `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' }),
          records: [],
          totalInQty: 0,
          totalOutQty: 0,
          coinChanges: {} 
        };
      }
      const group = grouped[monthKey];
      group.records.push(t);
      const qty = parseFloat(t.quantity) || 0;
      if (t.type === 'in') {
        group.totalInQty += qty;
        group.coinChanges[t.coin] = (group.coinChanges[t.coin] || 0) + qty;
      } else if (t.type === 'out') {
        group.totalOutQty += qty;
        group.coinChanges[t.coin] = (group.coinChanges[t.coin] || 0) - qty;
      }
    });

    return Object.keys(grouped)
      .sort((a, b) => (grouped[b].records[0]?.timestamp || 0) - (grouped[a].records[0]?.timestamp || 0))
      .map(key => {
        const month = grouped[key];
        month.records = month.records.reverse(); 
        return month;
      });
  }, [filteredLedger, formatGlobalDate, getCalendarMonthKey]);

  const MonthSkeleton = () => (
    <div className="space-y-6">
      {[1,2].map(i => (
        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm animate-pulse">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
            <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="p-6 space-y-4">
            {[1,2].map(j => (
              <div key={j} className="flex items-center gap-6">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const handleDownloadReport = (format) => {
    setIsExportMenuOpen(false);
    if (filteredLedger.length === 0) {
      addToast("No records found.", "warning");
      return;
    }

    const reportData = filteredLedger.map(rec => ({
      date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
      type: rec.type === 'in' ? 'Deposit / Buy' : rec.type === 'out' ? 'Withdraw / Sell' : 'Transfer (Old)',
      coin: rec.coin,
      quantityIn: rec.type === 'in' ? Number(rec.quantity) : 0,
      quantityOut: rec.type === 'out' ? Number(rec.quantity) : 0,
      platform: rec.type === 'transfer' ? `${rec.fromPlatform} → ${rec.toPlatform}` : rec.platform,
      note: rec.reason ? rec.reason.replace(/(\r\n|\n|\r)/gm, " ") : ''
    }));

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Action', key: 'type' },
      { header: 'Asset', key: 'coin' },
      { header: 'Qty Added (In)', key: 'quantityIn', isNumeric: true },
      { header: 'Qty Removed (Out)', key: 'quantityOut', isNumeric: true },
      { header: 'Storage / Platform', key: 'platform' },
      { header: 'Note', key: 'note' }
    ];

    try {
      if (format === 'pdf') {
        downloadPDFReport(reportData, columns, 'Crypto_Vault_Ledger', 'Crypto Vault Ledger', {
          onSuccess: () => addToast('PDF report downloaded!', 'success'),
          onError: (msg) => addToast(`PDF Error: ${msg}`, 'error')
        });
      } else {
        downloadExcelReport(reportData, columns, 'Crypto_Vault_Ledger', 'Crypto Vault Ledger', {
          onSuccess: () => addToast('Excel report downloaded!', 'success'),
          onError: (msg) => addToast(`Excel Error: ${msg}`, 'error')
        });
      }
    } catch (e) {
      addToast('Failed to generate report.', 'error');
    }
  };

  return (
    <div className="h-full min-h-screen overflow-y-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">

        {/* Premium Header */}
        <div className="relative rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50 z-20">
          <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.1),transparent_70%)]" />
             <div className="absolute right-0 top-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg"><FaBitcoin size={24} className="text-white" /></div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Crypto Vault</h1>
                  <p className="text-sm font-medium text-slate-400">Secure storage tracking & Fiat off-ramp</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto mt-4 md:mt-0">
              <div className="relative w-full sm:w-auto z-[100]">
                <button
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 shadow-sm"
                >
                  <HiOutlineDownload size={16} /> Export
                </button>
                {isExportMenuOpen && (
                  <div className="absolute top-[110%] right-0 md:left-0 w-full md:w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl flex flex-col p-1.5 animate-in fade-in zoom-in-95 z-[9999]">
                    <button onMouseDown={(e) => { e.preventDefault(); handleDownloadReport('pdf'); }} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg transition-colors text-left"><HiOutlineDocumentText className="text-rose-400" size={16}/> PDF Report</button>
                    <button onMouseDown={(e) => { e.preventDefault(); handleDownloadReport('excel'); }} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg transition-colors text-left"><HiOutlineTable className="text-emerald-400" size={16}/> Excel (CSV)</button>
                  </div>
                )}
              </div>
              <button onClick={() => openModal('out')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-3.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all border border-white/10 shadow-sm"><FaArrowUp size={14} /> Sell / Out</button>
              <button onClick={() => openModal('in')} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white px-6 py-3.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg shadow-orange-500/30 transition-all active:scale-95"><FaArrowDown size={14} /> Buy / Deposit</button>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 col-span-2 md:col-span-1 overflow-hidden">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Value</p>
              <p className="text-2xl md:text-xl lg:text-2xl font-black text-white truncate" title={`${currencySymbol}${totalVaultValue.toLocaleString()}`}>{currencySymbol}{totalVaultValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Assets</p>
              <p className="text-lg md:text-xl font-black text-white truncate">{Object.keys(holdings).length}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transactions</p>
              <p className="text-lg md:text-xl font-black text-white truncate">{transactions.length}</p>
            </div>
          </div>
        </div>

        {/* Platform Breakdown */}
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><FaChartPie className="text-orange-500" /> Platform Storage Breakdown</h3>
          {Object.keys(holdings).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <FaWallet className="text-4xl text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Empty Vault</p>
              <p className="text-xs text-slate-400 mt-1">Deposit assets to start tracking</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Object.entries(holdings).sort((a, b) => b[1].total * (livePrices[b[0].toUpperCase()]?.priceUSD || 0) - a[1].total * (livePrices[a[0].toUpperCase()]?.priceUSD || 0)).map(([coin, data]) => {
                const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === coin.toUpperCase()) || {};
                const liveData = livePrices[coin.toUpperCase()] || {};
                const livePriceBase = (liveData.priceUSD || dbCoin.fallbackPrice || 0) * fiatRate;
                const totalValBase = data.total * livePriceBase;

                return (
                  <div key={coin} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] shadow-sm hover:shadow-md hover:border-orange-500/30 transition-all group flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                        <LogoRenderer symbol={coin} logoUrl={dbCoin.logo} bg={dbCoin.bg} color={dbCoin.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-900 dark:text-white uppercase text-lg tracking-tight truncate">{dbCoin.name || coin} ({coin})</h4>
                        <p className="text-[11px] font-black text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
                          {currencySymbol}{livePriceBase < 1 ? livePriceBase.toFixed(6) : livePriceBase.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          <span className={`flex items-center shrink-0 ${liveData.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {liveData.change >= 0 ? <HiOutlineTrendingUp size={10} className="mr-0.5" /> : <HiOutlineTrendingDown size={10} className="mr-0.5" />}
                            {Math.abs(liveData.change || 0).toFixed(2)}%
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 mb-4 border border-slate-100 dark:border-slate-700 flex justify-between items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Holdings</p>
                        <p className="text-sm sm:text-base font-black text-slate-800 dark:text-white truncate" title={data.total}>
                          {data.total % 1 !== 0 ? data.total.toFixed(6).replace(/\.?0+$/, '') : data.total} <span className="text-[10px] text-slate-500 uppercase">{coin}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0 max-w-[55%]">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Value</p>
                        <p className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 truncate" title={`${currencySymbol}${totalValBase.toLocaleString()}`}>
                          {currencySymbol}{totalValBase.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><FaBuilding className="shrink-0"/> Storage Locations</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(data.platforms).map(([plat, qty]) => (
                          <span key={plat} className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 truncate max-w-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0"></span>
                            <span className="truncate">{plat}: {qty % 1 !== 0 ? qty.toFixed(4).replace(/\.?0+$/, '') : qty}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative mt-8">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Search transactions by coin, reason or platform..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:border-orange-500 transition-all shadow-sm placeholder-slate-400 dark:placeholder-slate-500" />
        </div>

        {/* 🚀 COLLAPSIBLE MONTHS LEDGER */}
        {isLoading ? (
          <MonthSkeleton />
        ) : processedMonths.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <FaWallet className="text-5xl text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-lg font-black text-slate-700 dark:text-slate-300">No transactions found</p>
            <p className="text-sm text-slate-500">{searchTerm ? 'Adjust your search.' : 'Start by depositing crypto.'}</p>
          </div>
        ) : (
          processedMonths.map((month) => {
            const isOpen = openMonths.has(month.monthKey);
            const summaryParts = [];
            if (month.totalInQty > 0) summaryParts.push(`+${month.totalInQty.toFixed(4)}`);
            if (month.totalOutQty > 0) summaryParts.push(`-${month.totalOutQty.toFixed(4)}`);
            const summaryText = summaryParts.join(', ') || 'No volume';

            return (
              <div key={month.monthKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleMonth(month.monthKey)}
                  className="w-full px-6 py-5 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left"
                >
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="p-2 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-lg">
                      <HiOutlineCalendar size={18} />
                    </div>
                    {month.monthName}
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Monthly Volume</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">{summaryText}</p>
                    </div>
                    <HiOutlineChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="animate-in fade-in duration-200">
                    <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                      {month.records.map((rec) => {
                        const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === rec.coin.toUpperCase()) || {};
                        return (
                          <div key={rec.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${rec.linkedIncomeId || rec.linkedExpenseId || rec.shiftId || rec.linkedPartyId ? 'bg-amber-50/20 dark:bg-amber-900/5' : ''}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3 min-w-0 pr-2">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 border ${rec.type === 'in' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10' : rec.type === 'out' ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10' : 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10'}`}>
                                  <LogoRenderer symbol={rec.coin} logoUrl={dbCoin.logo} bg={dbCoin.bg} color={dbCoin.color} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-black text-slate-900 dark:text-white text-sm uppercase truncate">{rec.coin}</p>
                                  <span className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[8px] font-black uppercase tracking-wider border shadow-sm ${rec.type === 'in' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400' : rec.type === 'out' ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                                    {rec.type === 'in' ? 'Deposit' : rec.type === 'out' ? 'Withdraw' : 'Transfer'}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-base font-black tracking-tight leading-none ${rec.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : rec.type === 'out' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                  {rec.type === 'in' ? '+' : rec.type === 'out' ? '-' : '↔'}{rec.quantity}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-between items-end gap-2 mt-3">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[9px] font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 w-max shadow-sm truncate max-w-[200px]">
                                  {rec.type === 'transfer' ? `${rec.fromPlatform} → ${rec.toPlatform}` : rec.platform}
                                </span>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{rec.reason}</p>
                                <p className="text-[9px] font-medium text-slate-400 mt-0.5 flex items-center gap-1"><HiOutlineCalendar size={10}/> {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}</p>
                              </div>
                              <div className="flex gap-1 items-center">
                                {(rec.linkedIncomeId || rec.linkedExpenseId || rec.shiftId || rec.linkedPartyId) && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[8px] font-black rounded border border-amber-300 dark:border-amber-500/30 shadow-sm mr-1"><FaLock className="inline mb-0.5 mr-0.5" />SYNCED</span>
                                )}
                                <button onClick={() => handleEdit(rec)} className="p-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-500/30 shadow-sm"><HiOutlinePencil size={14}/></button>
                                <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-md border border-rose-200 dark:border-rose-500/30 shadow-sm"><HiOutlineTrash size={14}/></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden md:block overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                          <tr><th className="p-4 pl-6 whitespace-nowrap">Type</th><th className="p-4 whitespace-nowrap">Asset & Event</th><th className="p-4 whitespace-nowrap">Platform</th><th className="p-4 text-right whitespace-nowrap">Quantity</th><th className="p-4 pr-6 text-right whitespace-nowrap">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {month.records.map((rec) => {
                            const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === rec.coin.toUpperCase()) || {};
                            return (
                              <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group ${rec.linkedIncomeId || rec.linkedExpenseId || rec.shiftId || rec.linkedPartyId ? 'bg-amber-50/20 dark:bg-amber-900/5' : ''}`}>
                                <td className="p-4 pl-6"><div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${rec.type === 'in' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : rec.type === 'out' ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' : 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400'}`}>{rec.type === 'in' ? <HiOutlineDownload size={16}/> : rec.type === 'out' ? <HiOutlineUpload size={16}/> : <HiOutlineSwitchHorizontal size={16}/>}</div></td>
                                <td className="p-4 min-w-[200px]"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"><LogoRenderer symbol={rec.coin} logoUrl={dbCoin.logo} bg={dbCoin.bg} color={dbCoin.color} /></div><div className="min-w-0"><p className="font-black text-slate-900 dark:text-white text-sm uppercase truncate">{rec.coin}</p><p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{rec.reason}</p><p className="text-[9px] font-medium text-slate-400 mt-0.5">{formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date}</p></div></div></td>
                                <td className="p-4"><span className="text-[10px] font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-nowrap shadow-sm">{rec.type === 'transfer' ? `${rec.fromPlatform} → ${rec.toPlatform}` : rec.platform}</span></td>
                                <td className="p-4 text-right"><p className={`text-base font-black truncate max-w-[150px] ml-auto ${rec.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : rec.type === 'out' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>{rec.type === 'in' ? '+' : rec.type === 'out' ? '-' : '↔'}{rec.quantity}</p></td>
                                <td className="p-4 pr-6 text-right">
                                  <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    {(rec.linkedIncomeId || rec.linkedExpenseId || rec.shiftId || rec.linkedPartyId) && (
                                      <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[8px] font-black rounded border border-amber-300 dark:border-amber-500/30 shadow-sm mr-1"><FaLock className="inline mb-0.5 mr-0.5" />SYNCED</span>
                                    )}
                                    <button onClick={() => handleEdit(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/20 rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95"><HiOutlinePencil size={16}/></button>
                                    <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/20 rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95"><HiOutlineTrash size={16}/></button>
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
          })
        )}
      </div>

      {/* 🚀 MODAL: ADD/EDIT TRANSACTION */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 pt-[60px] md:pt-0">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-4rem)] sm:max-h-[85vh] border border-slate-300 dark:border-slate-700 animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className={`px-6 py-5 flex justify-between items-center text-white shrink-0 ${
              transactionType === 'in' ? 'bg-gradient-to-r from-orange-500 to-amber-600' : 'bg-gradient-to-r from-rose-600 to-pink-600'
            }`}>
              <h3 className="text-xl font-black flex items-center gap-2">
                {editingId ? <HiOutlinePencil /> : (transactionType === 'in' ? <HiOutlineDownload /> : <HiOutlineUpload /> )}
                {editingId ? 'Edit Vault Record' : (transactionType === 'in' ? 'Deposit / Buy Asset' : 'Withdraw / Sell Asset')}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {/* SYNCED WARNING */}
              {formData.isSynced && (
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-4 rounded-2xl text-xs font-bold leading-relaxed border border-amber-300 dark:border-amber-500/30 shadow-sm">
                  <p className="flex items-center gap-1.5 mb-1.5 font-black"><HiOutlineExclamationCircle size={16}/> Auto-Synced Entry</p>
                  This entry is linked to an external module (like Income Streams). To maintain ledger accuracy, you can only update the <span className="underline decoration-amber-400">Platform/Storage</span> and <span className="underline decoration-amber-400">Notes</span> here. To change the quantity or asset, edit the source log.
                </div>
              )}

              <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <button type="button" disabled={editingId || formData.isSynced} onClick={() => { setTransactionType('in'); setIsBridging(false); }} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${transactionType === 'in' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30'}`}>Deposit / Buy</button>
                <button type="button" disabled={editingId || formData.isSynced} onClick={() => setTransactionType('out')} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${transactionType === 'out' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30'}`}>Withdraw / Sell</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset (Watchlist)</label>
                  <div className="relative mt-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center overflow-hidden z-10 pointer-events-none">
                      <LogoRenderer symbol={formData.coin} logoUrl={fullDatabase.find(c=>c.symbol===formData.coin)?.logo} bg={fullDatabase.find(c=>c.symbol===formData.coin)?.bg} color={fullDatabase.find(c=>c.symbol===formData.coin)?.color} />
                    </div>
                    <select required disabled={editingId || formData.isSynced} value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className="w-full pl-14 pr-10 py-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors appearance-none shadow-sm disabled:opacity-50 cursor-pointer">
                      {availableCryptos.length > 0 ? availableCryptos.map(c => {
                        return <option key={c} value={c}>{c}</option>;
                      }) : <option value="USDT">USDT (Default)</option>}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                  <div className="mt-1.5 ml-2">
                    <p className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                      Live: <span className="text-slate-700 dark:text-slate-300">${(livePrices[formData.coin]?.priceUSD || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</span>
                      {livePrices[formData.coin]?.change !== undefined && (
                        <span className={livePrices[formData.coin]?.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          ({livePrices[formData.coin]?.change >= 0 ? '+' : ''}{livePrices[formData.coin]?.change.toFixed(2)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">Quantity {transactionType === 'out' && !editingId && <span className="text-rose-500">Max: {holdings[formData.coin]?.platforms[formData.platform] || 0}</span>}</label>
                  <input type="number" step="any" required disabled={formData.isSynced} value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} placeholder="e.g. 100" className="w-full mt-1 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-2xl text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors shadow-sm placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-50" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Platform / Storage</label>
                <div className="relative mt-1">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><FaBuilding size={16}/></div>
                  <input type="text" list="crypto-platforms-list" required value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})} placeholder="Type Platform Name (e.g., Phantom)" className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none shadow-sm transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50" />
                  <datalist id="crypto-platforms-list">
                    {existingCryptoPlatforms.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
              </div>

              {/* Fiat Bridge */}
              {transactionType === 'out' && !editingId && !formData.isSynced && (
                <div className="p-4 sm:p-5 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-300 dark:border-amber-700/50 shadow-sm transition-all duration-300">
                  <label className="flex items-start gap-4 cursor-pointer">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input type="checkbox" checked={isBridging} onChange={(e) => setIsBridging(e.target.checked)} className="sr-only" />
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isBridging ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                        {isBridging && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <div>
                      <p className={`font-black flex items-center gap-2 ${isBridging ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-300'}`}><FaExchangeAlt /> Sell for Fiat Currency (P2P / Off-Ramp)</p>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-1">Automatically log the cash/bank deposit for this crypto sale.</p>
                    </div>
                  </label>

                  {isBridging && (
                    <div className="mt-5 pt-5 border-t border-amber-200 dark:border-amber-800/50 space-y-5 animate-in fade-in zoom-in-95">
                      <div className="flex flex-wrap sm:flex-nowrap gap-4">
                        <div className="w-full sm:w-[35%] relative">
                          <select value={formData.fiatCurrency} onChange={(e) => { setFormData({...formData, fiatCurrency: e.target.value}); if(e.target.value !== baseCurrency) fetchFiatLiveRate(); }} className="w-full p-4 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 rounded-xl font-bold text-slate-900 dark:text-white text-sm shadow-sm cursor-pointer outline-none transition-colors appearance-none focus:border-amber-500">
                            <option value={baseCurrency}>{baseCurrency}</option>
                            {availableFiats.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                        </div>
                        <input type="number" step="any" required={isBridging} value={formData.fiatAmount} onChange={(e) => setFormData({...formData, fiatAmount: e.target.value})} placeholder="Gross Fiat Received" className="w-full sm:w-[65%] p-4 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 rounded-xl font-black text-amber-700 dark:text-amber-400 outline-none shadow-sm placeholder-slate-400 transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50" />
                      </div>

                      {formData.fiatCurrency !== baseCurrency && (
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-amber-300 dark:border-amber-700/50 shadow-sm">
                          <button type="button" onClick={fetchFiatLiveRate} disabled={isFetchingRate} className="shrink-0 text-[10px] font-black bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1 transition-colors">
                            <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} size={14} /> <span className="hidden sm:inline">Live</span>
                          </button>
                          <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">1 {formData.fiatCurrency} =</span>
                            <input type="number" step="any" required value={formData.fiatExchangeRate} onChange={(e) => setFormData({...formData, fiatExchangeRate: e.target.value})} className="flex-1 w-full min-w-0 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-900 dark:text-white outline-none transition-colors focus:border-amber-500" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">{baseCurrency}</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-amber-800 dark:text-amber-500 uppercase tracking-widest ml-1">Destination Vault</label>
                          <div className="relative mt-1">
                            <select value={formData.destinationVault} onChange={(e) => setFormData({...formData, destinationVault: e.target.value, destinationVaultName: ''})} className="w-full p-4 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 rounded-xl font-bold text-slate-900 dark:text-white text-sm shadow-sm cursor-pointer appearance-none outline-none transition-colors focus:border-amber-500">
                              <option value="bankWallet">Bank Ledger</option>
                              <option value="cashWallet">Physical Cash</option>
                              <option value="onlineWallet">E-Wallet</option>
                            </select>
                            <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                        {(formData.destinationVault === 'bankWallet' || formData.destinationVault === 'onlineWallet') && (
                          <div className="animate-in fade-in mt-1 sm:mt-0">
                            <label className="text-[9px] font-black text-amber-800 dark:text-amber-500 uppercase tracking-widest ml-1">Bank/Wallet Name</label>
                            <input type="text" list="bridge-vaults" required value={formData.destinationVaultName} onChange={(e) => setFormData({...formData, destinationVaultName: e.target.value})} placeholder="e.g., SBI or PayPal" className="w-full mt-1 p-4 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 rounded-xl font-bold text-slate-900 dark:text-white text-sm shadow-sm placeholder-slate-400 outline-none transition-colors focus:border-amber-500" />
                            <datalist id="bridge-vaults">{existingVaultNames.map(b => <option key={`br-${b}`} value={b} />)}</datalist>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-amber-800 dark:text-amber-500 uppercase tracking-widest ml-1">P2P/Withdrawal Fee (in {formData.fiatCurrency})</label>
                        <input type="number" step="any" value={formData.fiatFee} onChange={(e) => setFormData({...formData, fiatFee: e.target.value})} placeholder="e.g., 2.50" className="w-full mt-1 p-4 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 rounded-xl font-bold text-slate-900 dark:text-white text-sm shadow-sm placeholder-slate-400 outline-none transition-colors focus:border-amber-500" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Date & Time</label>
                  <input type="datetime-local" required disabled={formData.isSynced} value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full mt-1 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm transition-colors cursor-pointer disabled:opacity-50 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Event Note</label>
                  <input type="text" value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} placeholder="e.g., Bought on dip" className="w-full mt-1 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50" />
                </div>
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
                <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black text-white text-sm uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 ${
                  transactionType === 'in' ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-orange-500/30' :
                  'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-500/30'
                }`}>
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-xl" /> : <HiOutlineShieldCheck size={20} />}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Record' : transactionType === 'in' ? 'Confirm Deposit' : 'Confirm Withdrawal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 Delete Confirmation Modal */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-0 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl p-8 border border-rose-200 dark:border-rose-900/50 relative overflow-hidden max-h-[calc(100dvh-4rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 flex flex-col">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-500 to-pink-500"></div>
            <div className="flex flex-col items-center text-center mb-6 shrink-0">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner border border-rose-200 dark:border-rose-500/30"><HiOutlineLockClosed /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-xs font-bold text-slate-500 mt-2">Deleting this record will alter your total {deleteContext.coin} holdings.</p>
            </div>
            <form onSubmit={executeSecureDelete} className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl shadow-sm">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Deleting this will permanently remove <span className="font-black text-amber-900 dark:text-amber-200">{deleteContext.quantity} {deleteContext.coin}</span> from your records. Linked Fiat Bridge records (if any) will also be reversed automatically.</p>
                {(deleteContext.linkedIncomeId || deleteContext.linkedExpenseId || deleteContext.shiftId || deleteContext.linkedPartyId) && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-3 font-bold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-200 dark:border-rose-800/50">
                    <HiOutlineExclamationCircle size={16} className="shrink-0"/> Auto-synced entry. Deletion may cause ledger mismatch. Best practice is to delete from the source.
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Security PIN</label>
                <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="••••••" className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm transition-colors focus:border-rose-500" />
                {pinError && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 text-center animate-bounce mt-2">{pinError}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-sm border border-slate-300 dark:border-slate-700">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-lg shadow-rose-500/30 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : null} Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const CryptoWallet = () => (
  <ToastProvider>
    <CryptoWalletContent />
  </ToastProvider>
);
export default CryptoWallet;