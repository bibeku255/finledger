import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';
import { verifyPIN } from '../../utils/cryptoUtils';
import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineShoppingCart,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineChevronDown,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable,
  HiOutlineCalendar, HiOutlineShieldCheck, HiOutlineTrendingDown,
  HiOutlineCash, HiOutlineCheckCircle, HiOutlineInformationCircle
} from 'react-icons/hi';
import { 
  FaMoneyBillWave, FaUniversity, FaWallet, FaExchangeAlt, 
  FaRandom, FaBitcoin, FaUserFriends, FaTags, FaCreditCard, FaLock
} from 'react-icons/fa';
import { currenciesList } from '../../utils/marketConstants';

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

// ============================================
// 🧩 CONSTANTS & HELPERS
// ============================================
const expenseCategories = [
  "Food & Dining", "Groceries & Supermarket", "Rent & Housing",
  "Bills & Utilities", "Shopping & E-commerce", "Travel & Transport",
  "Entertainment & Subscriptions", "Crypto Trading Fees / Gas",
  "Forex & Bank Charges", "Health & Wellness", "Other Expenses"
];

const getLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const ExpenseTrackerContent = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = [], formatGlobalDate, getCalendarMonthKey } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { addToast } = useToast();

  const availableFiats = useMemo(() => Array.from(new Set([baseCurrency, ...selectedFiats])), [baseCurrency, selectedFiats]);

  // 🗓️ Collapsible months state
  const getCurrentMonthKey = () => getCalendarMonthKey(new Date().toISOString());
  const [openMonths, setOpenMonths] = useState(new Set([getCurrentMonthKey()]));
  const toggleMonth = (monthKey) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey);
      return next;
    });
  };

  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [bankWalletLogs, setBankWalletLogs] = useState([]);
  const [existingParties, setExistingParties] = useState([]);
  const [existingCryptoPlatforms, setExistingCryptoPlatforms] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "expenseLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, snapshot => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, error => {
      addToast('Failed to load expenses. Please refresh.', 'error');
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

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    selectedCryptos.forEach(c => { if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c); });
    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  const availableCryptos = useMemo(() => {
    return Array.from(new Set(["USDT", ...fullDatabase.map(c => c.symbol.toUpperCase())]));
  }, [fullDatabase]);

  useEffect(() => {
    if (!user) return;
    const fetchDynamicLists = async () => {
      const qBank = query(collection(db, "users", user.uid, "bankWallet"));
      const snapBank = await getDocs(qBank);
      const qOnline = query(collection(db, "users", user.uid, "onlineWallet"));
      const snapOnline = await getDocs(qOnline);
      const names = new Set();
      snapBank.docs.forEach(d => { if (d.data().bankName) names.add(d.data().bankName); });
      snapOnline.docs.forEach(d => { if (d.data().walletName) names.add(d.data().walletName); });
      setBankWalletLogs(Array.from(names));

      const qParty = query(collection(db, "users", user.uid, "parties"));
      const snapParty = await getDocs(qParty);
      const partyNames = new Set();
      snapParty.docs.forEach(d => { if (d.data().name) partyNames.add(d.data().name); });
      setExistingParties(Array.from(partyNames));

      const qCrypto = query(collection(db, "users", user.uid, "cryptoWalletLogs"));
      const snapCrypto = await getDocs(qCrypto);
      const cryptoNames = new Set();
      snapCrypto.docs.forEach(d => { if (d.data().platform) cryptoNames.add(d.data().platform); });
      setExistingCryptoPlatforms(Array.from(cryptoNames));
    };
    fetchDynamicLists();
  }, [user]);

  const existingBanks = useMemo(() => Array.from(new Set(bankWalletLogs)), [bankWalletLogs]);

  // 🚀 FIXED: Added 'fee' property to defaults
  const defaultSplitSource = { vault: 'bank', subWallet: '', asset: baseCurrency, cryptoPlatform: '', amount: '', fee: '', exchangeRate: 1 };
  const defaultKhataSplit = { partyName: '', amount: '' };

  const [formData, setFormData] = useState({
    title: '', category: expenseCategories[0], date: getLocalDateTimeString(), linkedExpenseId: '',
    isSplit: false, vault: 'bank', subWallet: '', cryptoPlatform: '', asset: baseCurrency,
    amount: '', fee: '', exchangeRate: 1, isSynced: false,
    splitSources: [{ ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' }],
    isKhataSplit: false, khataSplits: [{ ...defaultKhataSplit }]
  });

  // Live rate fetch
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
    } catch (error) { addToast("Rate fetch failed. Please enter manually.", "error"); } finally { setIsFetchingRate(false); }
  };

  // 🚀 FIXED: New calculation helpers for Inclusive Deductions
  const getBaseAmount = (amount, isForeign, rate) => (parseFloat(amount) || 0) * (isForeign ? (parseFloat(rate) || 1) : 1);
  const getNetBaseAmount = (amount, fee, isForeign, rate) => {
    const gross = parseFloat(amount) || 0;
    const extra = parseFloat(fee) || 0;
    return (gross + extra) * (isForeign ? (parseFloat(rate) || 1) : 1);
  };
  const getSplitTotalBase = () => formData.splitSources.reduce((acc, curr) => acc + getNetBaseAmount(curr.amount, curr.fee, curr.asset !== baseCurrency, curr.exchangeRate), 0);
  const getKhataTotal = () => formData.khataSplits.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  // Processed expenses with calendar‑aware month key
  const processedExpenses = useMemo(() => {
    const filtered = expenses.filter(exp => {
      const matchSearch = exp.title?.toLowerCase().includes(searchTerm.toLowerCase()) || (exp.asset && exp.asset.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCategory = filterCategory === 'all' || exp.category === filterCategory;
      return matchSearch && matchCategory;
    });
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const grouped = {};
    sorted.forEach(t => {
      const dateObj = new Date(t.date || new Date());
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      const monthKey = getCalendarMonthKey(t.date);
      if (!grouped[monthKey]) grouped[monthKey] = { monthName, monthKey, openingBalance: runningBalance, records: [], closingBalance: 0, monthTotal: 0 };
      
      const baseAmt = Number(t.finalBaseAmount) || 0; // Final Base Amount includes Fees
      const feeAmt = Number(t.fee) || 0;
      
      runningBalance += baseAmt;
      grouped[monthKey].monthTotal += baseAmt;
      grouped[monthKey].records.push({ ...t, finalAmount: baseAmt, feeAmount: feeAmt });
      grouped[monthKey].closingBalance = runningBalance;
    });
    return Object.keys(grouped)
      .sort((a, b) => (grouped[b].records[0]?.timestamp || 0) - (grouped[a].records[0]?.timestamp || 0))
      .map(key => ({ ...grouped[key], records: grouped[key].records.reverse() }));
  }, [expenses, searchTerm, filterCategory, formatGlobalDate, getCalendarMonthKey]);

  const totalExpenseBase = expenses.reduce((acc, curr) => acc + (Number(curr.finalBaseAmount) || 0), 0);
  const thisMonthExpense = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return expenses.filter(i => i.date?.startsWith(thisMonth)).reduce((acc, i) => acc + (Number(i.finalBaseAmount) || 0), 0);
  }, [expenses]);

  const handleDownloadReport = async (format) => {
    setIsExportMenuOpen(false);
    const filteredForReport = processedExpenses.flatMap(month => month.records);
    if (filteredForReport.length === 0) { addToast("No records found to download based on filters.", "warning"); return; }
    setIsGeneratingReport(true);

    const reportData = filteredForReport.map(rec => {
      const cleanTitle = (rec.title || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      const sourceText = rec.isSplit ? 'Split Payment' : `${(rec.vault || '').charAt(0).toUpperCase() + (rec.vault || '').slice(1)} Vault${rec.subWallet ? ` (${rec.subWallet})` : ''}`;
      const rawDate = rec.date ? rec.date.split('T')[0] : 'N/A';
      return {
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rawDate,
        payee: cleanTitle,
        category: rec.category || 'N/A',
        source: sourceText,
        nativeAmount: `${(Number(rec.amount) || 0).toLocaleString()} ${rec.asset || baseCurrency}`,
        fee: Number(rec.fee || 0),
        baseValue: Number(rec.finalBaseAmount || 0)
      };
    });

    const columns = [
      { header: 'Date', key: 'date' }, 
      { header: 'Payee / Item', key: 'payee' }, 
      { header: 'Category', key: 'category' }, 
      { header: 'Deducted From', key: 'source' }, 
      { header: 'Gross Amount', key: 'nativeAmount' },
      { header: 'Fee', key: 'fee', isNumeric: true },
      { header: `Total Value (${currencySymbol})`, key: 'baseValue', isNumeric: true }
    ];

    const fileName = `Expense_Tracker_Ledger`;
    const reportTitle = `Expense Ledger${filterCategory !== 'all' ? ` - ${filterCategory}` : ''}${searchTerm ? ` (Filtered)` : ''}`;

    if (format === 'pdf') {
      await downloadPDFReport(reportData, columns, fileName, reportTitle, {
        onSuccess: () => addToast('PDF report downloaded!', 'success'),
        onError: (msg) => addToast(`PDF Error: ${msg}`, 'error')
      });
    } else {
      await downloadExcelReport(reportData, columns, fileName, reportTitle, {
        onSuccess: () => addToast('Excel report downloaded!', 'success'),
        onError: (msg) => addToast(`Excel Error: ${msg}`, 'error')
      });
    }

    setIsGeneratingReport(false);
  };

  // 🚀 FIXED: Added feeToDeduct integration
  const createVaultRecord = (sourceData, linkId, amountToDeduct, feeToDeduct = 0) => {
    const isForeignAsset = sourceData.asset !== baseCurrency;
    const grossNative = parseFloat(amountToDeduct) || 0;
    const feeNative = parseFloat(feeToDeduct) || 0;
    const rate = isForeignAsset ? (parseFloat(sourceData.exchangeRate) || 1) : 1;

    // Base amounts (all in baseCurrency)
    const grossBase = grossNative * rate;
    const feeBase = feeNative * rate;
    const totalDeductionBase = grossBase + feeBase;

    const safeTitle = formData.title || 'Expense Entry';
    const safeCat = formData.category || 'Other Expenses';
    const safeDate = formData.date || getLocalDateTimeString();

    if (sourceData.vault === 'crypto') {
      return {
        collection: 'cryptoWalletLogs',
        data: {
          type: 'out',
          coin: sourceData.asset || 'USDT',
          quantity: grossNative,
          fee: feeNative,
          totalQuantity: grossNative + feeNative,
          platform: sourceData.cryptoPlatform || 'Unknown Platform',
          reason: `Expense: ${safeCat} (${safeTitle}) ${formData.isKhataSplit ? '[Shared]' : ''}`,
          referenceNo: linkId,
          date: safeDate,
          timestamp: new Date(safeDate).getTime() || Date.now(),
          linkedExpenseId: linkId
        }
      };
    }

    // Fiat vault record
    return {
      collection: (sourceData.vault || 'bank') + 'Wallet',
      data: {
        title: `Expense: ${safeCat} (${safeTitle}) ${formData.isKhataSplit ? '[Shared]' : ''}`,
        type: 'out',
        feeType: 'inclusive',  // ✅ fee pehle se total mein shamil hai
        date: safeDate,
        timestamp: new Date(safeDate).getTime() || Date.now(),
        currency: sourceData.asset || baseCurrency,
        foreignAmount: grossNative,
        exchangeRate: rate,
        fee: feeBase,           // ✅ base currency mein fee
        feeAsset: baseCurrency,
        finalBaseAmount: totalDeductionBase,  // gross + fee, dono base mein
        isExpense: true,
        linkedExpenseId: linkId,
        walletName: sourceData.subWallet || 'Default Wallet',
        bankName: sourceData.subWallet || 'Default Bank',
        transferType: 'Payment/Expense',
        walletCategory: sourceData.vault === 'online' ? 'Fiat Wallet' : 'Fiat Wallet',
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
      if (formData.vault === 'crypto' && !(formData.cryptoPlatform || '').trim()) { addToast("Please specify the crypto platform.", "warning"); return; }
      if ((formData.vault === 'bank' || formData.vault === 'online') && !(formData.subWallet || '').trim()) { addToast("Please specify the Bank or Wallet Name.", "warning"); return; }
      if (!formData.amount || parseFloat(formData.amount) <= 0) { addToast("Amount must be greater than zero.", "warning"); return; }
    } else {
      for (let i = 0; i < formData.splitSources.length; i++) {
        const s = formData.splitSources[i];
        if (!s.amount || parseFloat(s.amount) <= 0) { addToast(`Amount in Source ${i + 1} must be greater than zero.`, "warning"); return; }
        if (s.vault === 'crypto' && !(s.cryptoPlatform || '').trim()) { addToast(`Please specify platform for Source ${i + 1}.`, "warning"); return; }
        if ((s.vault === 'bank' || s.vault === 'online') && !(s.subWallet || '').trim()) { addToast(`Please specify Bank/Wallet for Source ${i + 1}.`, "warning"); return; }
      }
    }

    let totalKhataOwed = 0;
    if (formData.isKhataSplit) {
      totalKhataOwed = getKhataTotal();
      const totalPaidAmount = formData.isSplit ? formData.splitSources.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0) : (parseFloat(formData.amount) || 0);
      if (totalKhataOwed >= totalPaidAmount) { addToast("Total amount owed by friends cannot be greater than or equal to the total bill paid!", "warning"); return; }
      for (let i = 0; i < formData.khataSplits.length; i++) {
        if(!(formData.khataSplits[i].partyName || '').trim() || !(formData.khataSplits[i].amount || 0)) { addToast("Please enter valid names and amounts for all split friends.", "warning"); return; }
      }
    }

    setIsSaving(true);
    const oldExp = editingId ? expenses.find(i => i.id === editingId) : null;
    const safeDate = formData.date || getLocalDateTimeString();
    const timestamp = oldExp?.timestamp || new Date(safeDate).getTime() || Date.now();
    const linkId = formData.linkedExpenseId || `EXP_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    // 🚀 ENGINE HOOKUP
    const totalVaultDeductionBase = Number(formData.isSplit ? getSplitTotalBase() : getNetBaseAmount(formData.amount, formData.fee, formData.asset !== baseCurrency, formData.exchangeRate)) || 0;
    const totalKhataOwedBase = Number(formData.isKhataSplit ? getBaseAmount(totalKhataOwed, formData.asset !== baseCurrency, formData.exchangeRate) : 0) || 0;
    const personalNetExpenseBase = Number(totalVaultDeductionBase - totalKhataOwedBase) || 0;

    const expenseRecord = {
      title: formData.title || 'Expense', category: formData.category || 'Other Expenses',
      asset: formData.isSplit ? 'Multiple' : (formData.asset || baseCurrency),
      amount: formData.isSplit ? formData.splitSources.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0) : (parseFloat(formData.amount) || 0),
      fee: formData.isSplit ? formData.splitSources.reduce((acc, curr) => acc + (parseFloat(curr.fee) || 0), 0) : (parseFloat(formData.fee) || 0),
      exchangeRate: formData.isSplit ? 1 : (formData.asset !== baseCurrency ? (parseFloat(formData.exchangeRate) || 1) : 1),
      finalBaseAmount: personalNetExpenseBase, totalPaidFromVault: totalVaultDeductionBase, friendsShare: totalKhataOwedBase,
      date: safeDate, timestamp, linkedExpenseId: linkId, isSplit: formData.isSplit || false,
      vault: formData.isSplit ? 'split' : (formData.vault || 'bank'),
      subWallet: !formData.isSplit && (formData.vault === 'bank' || formData.vault === 'online') ? (formData.subWallet || '') : '',
      cryptoPlatform: !formData.isSplit && formData.vault === 'crypto' ? (formData.cryptoPlatform || '') : '',
      splitDetails: formData.isSplit ? formData.splitSources.map(s => ({
        vault: s.vault || 'bank', subWallet: s.subWallet || '', asset: s.asset || baseCurrency,
        amount: parseFloat(s.amount) || 0, fee: parseFloat(s.fee) || 0, cryptoPlatform: s.vault === 'crypto' ? (s.cryptoPlatform || '') : '',
        exchangeRate: parseFloat(s.exchangeRate) || 1
      })) : null,
      khataDetails: formData.isKhataSplit ? formData.khataSplits.map(k => ({ partyName: k.partyName || '', amount: parseFloat(k.amount) || 0 })) : null
    };

    try {
      if (editingId) {
        if (formData.isSynced) {
          await updateDoc(doc(db, "users", user.uid, "expenseLogs", editingId), { subWallet: formData.subWallet || '', vault: formData.vault || 'bank' });
          const vaults = ['bankWallet', 'onlineWallet'];
          for (const v of vaults) {
            const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", linkId));
            const snap = await getDocs(q);
            const updatePromises = snap.docs.map(d => updateDoc(doc(db, "users", user.uid, v, d.id), { walletName: formData.subWallet || '', bankName: formData.subWallet || '' }));
            await Promise.all(updatePromises);
          }
        } else {
          const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
          for (const v of vaults) {
            const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", linkId));
            const snap = await getDocs(q);
            const deletePromises = snap.docs.map(d => deleteDoc(doc(db, "users", user.uid, v, d.id)));
            await Promise.all(deletePromises);
          }
          const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
          for (const pDoc of partiesSnap.docs) {
            const lQuery = query(collection(db, "users", user.uid, "parties", pDoc.id, "ledger"), where("linkId", "==", linkId));
            const lSnap = await getDocs(lQuery);
            for (const ld of lSnap.docs) {
              const lData = ld.data();
              const currentPartySnap = await getDoc(doc(db, "users", user.uid, "parties", pDoc.id));
              if (currentPartySnap.exists()) {
                const newBal = Number(currentPartySnap.data().netBalance || 0) - Number(lData.baseAmount || 0);
                await updateDoc(doc(db, "users", user.uid, "parties", pDoc.id), { netBalance: newBal, status: newBal === 0 ? 'settled' : 'active' });
              }
              await deleteDoc(doc(db, "users", user.uid, "parties", pDoc.id, "ledger", ld.id));
            }
          }
          await updateDoc(doc(db, "users", user.uid, "expenseLogs", editingId), expenseRecord);
          if (formData.isSplit) {
            for (let s of formData.splitSources) {
              const rec = createVaultRecord(s, linkId, parseFloat(s.amount) || 0, parseFloat(s.fee) || 0);
              await addDoc(collection(db, "users", user.uid, rec.collection), rec.data);
            }
          } else {
            const singleRec = createVaultRecord({ vault: formData.vault, subWallet: formData.subWallet, asset: formData.asset, exchangeRate: formData.exchangeRate, cryptoPlatform: formData.cryptoPlatform }, linkId, parseFloat(formData.amount) || 0, parseFloat(formData.fee) || 0);
            await addDoc(collection(db, "users", user.uid, singleRec.collection), singleRec.data);
          }
          if (formData.isKhataSplit) {
            const freshPartiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
            const existingPartiesDocs = freshPartiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            for (let ks of formData.khataSplits) {
              const partyName = (ks.partyName || '').trim();
              if (!partyName) continue;
              const amountOwedBase = getBaseAmount(ks.amount, formData.asset !== baseCurrency, formData.exchangeRate) || 0;
              const existingParty = existingPartiesDocs.find(p => (p.name || '').toLowerCase() === partyName.toLowerCase());
              let partyId = '';
              if (existingParty) {
                partyId = existingParty.id;
                const newNetBal = Number(existingParty.netBalance || 0) + amountOwedBase;
                await updateDoc(doc(db, "users", user.uid, "parties", partyId), { netBalance: newNetBal, status: newNetBal === 0 ? 'settled' : 'active' });
              } else {
                const newPartyRef = await addDoc(collection(db, "users", user.uid, "parties"), { name: partyName, accountType: 'casual', netBalance: amountOwedBase, baseCurrency: baseCurrency, createdAt: timestamp, status: 'active' });
                partyId = newPartyRef.id;
              }
              await addDoc(collection(db, "users", user.uid, "parties", partyId, "ledger"), {
                type: 'give', amount: parseFloat(ks.amount) || 0,
                currency: formData.isSplit ? baseCurrency : (formData.asset || baseCurrency),
                exchangeRate: formData.isSplit ? 1 : (parseFloat(formData.exchangeRate) || 1),
                baseAmount: amountOwedBase, note: `Shared Bill: ${formData.title || 'Unknown'} (${formData.category || 'Other'})`,
                date: safeDate, timestamp, linkId: linkId
              });
            }
          }
        }
      } else {
        await addDoc(collection(db, "users", user.uid, "expenseLogs"), expenseRecord);
        if (formData.isSplit) {
          for (let s of formData.splitSources) { const rec = createVaultRecord(s, linkId, parseFloat(s.amount) || 0, parseFloat(s.fee) || 0); await addDoc(collection(db, "users", user.uid, rec.collection), rec.data); }
        } else {
          const singleRec = createVaultRecord({ vault: formData.vault, subWallet: formData.subWallet, asset: formData.asset, exchangeRate: formData.exchangeRate, cryptoPlatform: formData.cryptoPlatform }, linkId, parseFloat(formData.amount) || 0, parseFloat(formData.fee) || 0);
          await addDoc(collection(db, "users", user.uid, singleRec.collection), singleRec.data);
        }
        if (formData.isKhataSplit) {
          const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
          const existingPartiesDocs = partiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          for (let ks of formData.khataSplits) {
            const partyName = (ks.partyName || '').trim();
            if (!partyName) continue;
            const amountOwedBase = getBaseAmount(ks.amount, formData.asset !== baseCurrency, formData.exchangeRate) || 0;
            const existingParty = existingPartiesDocs.find(p => (p.name || '').toLowerCase() === partyName.toLowerCase());
            let partyId = '';
            if (existingParty) {
              partyId = existingParty.id;
              const newNetBal = Number(existingParty.netBalance || 0) + amountOwedBase;
              await updateDoc(doc(db, "users", user.uid, "parties", partyId), { netBalance: newNetBal, status: newNetBal === 0 ? 'settled' : 'active' });
            } else {
              const newPartyRef = await addDoc(collection(db, "users", user.uid, "parties"), { name: partyName, accountType: 'casual', netBalance: amountOwedBase, baseCurrency: baseCurrency, createdAt: timestamp, status: 'active' });
              partyId = newPartyRef.id;
            }
            await addDoc(collection(db, "users", user.uid, "parties", partyId, "ledger"), {
              type: 'give', amount: parseFloat(ks.amount) || 0,
              currency: formData.isSplit ? baseCurrency : (formData.asset || baseCurrency),
              exchangeRate: formData.isSplit ? 1 : (parseFloat(formData.exchangeRate) || 1),
              baseAmount: amountOwedBase, note: `Shared Bill: ${formData.title || 'Unknown'} (${formData.category || 'Other'})`,
              date: safeDate, timestamp, linkId: linkId
            });
          }
        }
      }
      addToast(editingId ? 'Expense updated successfully!' : 'Expense logged & vaults debited!', 'success');
      closeModal();
    } catch (error) { addToast("System Error: Failed to save expense log.", "error"); } finally { setIsSaving(false); }
  };

  const initiateDelete = (rec) => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your PIN.");
    setIsVerifying(true); setPinError('');
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const storedHash = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin;
      const { valid, newHash } = await verifyPIN(pinInput.trim(), storedHash, user.uid);
      if (!valid) { setPinError("Incorrect PIN."); setIsVerifying(false); return; }
      if (newHash) { await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true }); }
      await deleteDoc(doc(db, "users", user.uid, "expenseLogs", deleteContext.id));
      if (deleteContext.linkedExpenseId) {
        const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'cryptoWalletLogs'];
        for (const v of vaults) {
          const q = query(collection(db, "users", user.uid, v), where("linkedExpenseId", "==", deleteContext.linkedExpenseId));
          const snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, v, d.id)));
        }
        const partiesSnap = await getDocs(collection(db, "users", user.uid, "parties"));
        for (const pDoc of partiesSnap.docs) {
          const lQuery = query(collection(db, "users", user.uid, "parties", pDoc.id, "ledger"), where("linkId", "==", deleteContext.linkedExpenseId));
          const lSnap = await getDocs(lQuery);
          lSnap.forEach(async (ld) => {
            const lData = ld.data();
            const currentPartySnap = await getDoc(doc(db, "users", user.uid, "parties", pDoc.id));
            if (currentPartySnap.exists()) {
              const newBal = currentPartySnap.data().netBalance - lData.baseAmount;
              await updateDoc(doc(db, "users", user.uid, "parties", pDoc.id), { netBalance: newBal, status: newBal === 0 ? 'settled' : 'active' });
            }
            await deleteDoc(doc(db, "users", user.uid, "parties", pDoc.id, "ledger", ld.id));
          });
        }
      }
      setDeleteContext(null);
      addToast("Expense deleted successfully.", "info");
    } catch (e) { setPinError("System error during deletion."); } finally { setIsVerifying(false); }
  };

  const openModal = () => { 
    setEditingId(null); setIsModalOpen(true); 
    const lastBank = existingBanks.length > 0 ? existingBanks[0] : '';
    setFormData({ 
      title: '', category: expenseCategories[0], date: getLocalDateTimeString(), linkedExpenseId: '', 
      vault: 'bank', subWallet: lastBank, cryptoPlatform: '', asset: baseCurrency, 
      amount: '', fee: '', exchangeRate: 1, isSynced: false,
      splitSources: [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ],
      isKhataSplit: false, khataSplits: [ { ...defaultKhataSplit } ]
    }); 
  };
  
  const closeModal = () => setIsModalOpen(false);
  
  const handleEdit = (rec) => { 
    const isSplit = rec.isSplit || false;
    let mappedSplits = [ { ...defaultSplitSource }, { ...defaultSplitSource, vault: 'cash' } ];
    if (isSplit && rec.splitDetails) {
      mappedSplits = rec.splitDetails.map(s => ({
        vault: s.vault || 'bank', subWallet: s.subWallet || s.bankName || s.walletName || '',
        asset: s.asset || baseCurrency, amount: s.amount || '', fee: s.fee || '', cryptoPlatform: s.cryptoPlatform || '', 
        exchangeRate: s.exchangeRate || 1
      }));
    }
    const isKhataSplit = !!rec.khataDetails && rec.khataDetails.length > 0;
    const mappedKhataSplits = isKhataSplit ? rec.khataDetails : [ { ...defaultKhataSplit } ];
    const isSyncedEntry = !!(rec.linkedExpenseId && !rec.linkedExpenseId.startsWith('EXP_'));

    setFormData({
      title: rec.title || '', category: rec.category || expenseCategories[0], date: rec.date || getLocalDateTimeString(), linkedExpenseId: rec.linkedExpenseId || '', 
      isSplit: isSplit, vault: isSplit ? 'bank' : (rec.vault || 'bank'), subWallet: isSplit ? '' : (rec.subWallet || rec.bankName || rec.walletName || ''),
      asset: isSplit ? baseCurrency : (rec.asset || baseCurrency), amount: isSplit ? '' : (rec.amount || ''), fee: isSplit ? '' : (rec.fee || ''),
      exchangeRate: isSplit ? 1 : (rec.exchangeRate || 1), cryptoPlatform: isSplit ? '' : (rec.cryptoPlatform || ''), 
      splitSources: mappedSplits,
      isKhataSplit: isKhataSplit, khataSplits: mappedKhataSplits, 
      isSynced: isSyncedEntry 
    });
    setEditingId(rec.id);
    setIsModalOpen(true);
  };

  const getVaultIcon = (v) => {
    if (v === 'bank') return <FaUniversity className="text-blue-500" />;
    if (v === 'cash') return <HiOutlineCash className="text-emerald-500" />;
    if (v === 'crypto') return <FaBitcoin className="text-orange-500" />;
    if (v === 'online') return <FaWallet className="text-purple-500" />;
    return <FaCreditCard className="text-slate-500" />;
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

  const updateKhataSplit = (index, field, value) => {
    const updated = [...formData.khataSplits]; updated[index][field] = value;
    setFormData({ ...formData, khataSplits: updated });
  };
  const addKhataSplit = () => setFormData({ ...formData, khataSplits: [...formData.khataSplits, { ...defaultKhataSplit }] });
  const removeKhataSplit = (index) => { if (formData.khataSplits.length > 1) setFormData({ ...formData, khataSplits: formData.khataSplits.filter((_, i) => i !== index) }); };

  const ExpenseSkeleton = () => (
    <div className="space-y-6 sm:space-y-8">
      {[1, 2].map(i => (
        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm animate-pulse">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
            <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(j => (
              <div key={j} className="flex items-center gap-6">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full h-auto pb-24">
      <div className="pt-20 sm:pt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header & Export */}
        <div className="relative rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 lg:p-10 shadow-2xl border border-slate-700/50 z-20">
          <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(244,63,94,0.1),transparent_70%)]" />
             <div className="absolute right-0 top-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl" />
          </div>
          
          <div className="relative z-50 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                  <HiOutlineShoppingCart size={24} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight truncate">Expense Tracker</h1>
                  <p className="text-sm font-medium text-slate-400 truncate">Track expenses and split bills with friends</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
              <div className="relative w-full md:w-auto z-[100]">
                <button 
                  onClick={() => !isGeneratingReport && setIsExportMenuOpen(!isExportMenuOpen)}
                  onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
                  disabled={isGeneratingReport}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10 active:scale-95 shadow-sm disabled:opacity-50"
                >
                  {isGeneratingReport ? (
                    <><HiOutlineRefresh className="animate-spin" size={16} /> Generating...</>
                  ) : (
                    <><HiOutlineDownload size={16} /> Export</>
                  )}
                </button>
                {isExportMenuOpen && !isGeneratingReport && (
                  <div className="absolute top-[110%] left-0 sm:right-0 sm:left-auto w-full md:w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col p-1.5 animate-in fade-in zoom-in-95">
                    <button onMouseDown={(e) => { e.preventDefault(); handleDownloadReport('pdf'); }} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 dark:text-slate-200 text-[10px] font-black rounded-lg transition-colors text-left">
                      <HiOutlineDocumentText className="text-rose-400" size={16}/> PDF Document
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); handleDownloadReport('excel'); }} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 dark:text-slate-200 text-[10px] font-black rounded-lg transition-colors text-left">
                      <HiOutlineTable className="text-emerald-400" size={16}/> Excel (CSV)
                    </button>
                  </div>
                )}
              </div>
              
              <button 
                onClick={openModal} 
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white px-5 py-3.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-500/30"
              >
                <HiOutlinePlus size={18} /> Log Expense
              </button>
            </div>
          </div>
          
          <div className="relative z-30 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineTrendingDown size={14}/> Total Spent</p>
              <p className="text-xl sm:text-2xl font-black text-white truncate" title={`${currencySymbol}${totalExpenseBase.toLocaleString()}`}>{currencySymbol}{(Number(totalExpenseBase) || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><HiOutlineCalendar size={12}/> This Month</p>
              <p className="text-xl sm:text-2xl font-black text-rose-400 truncate" title={`${currencySymbol}${thisMonthExpense.toLocaleString()}`}>{currencySymbol}{(Number(thisMonthExpense) || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 col-span-2 md:col-span-1 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><FaTags size={12}/> Total Entries</p>
              <p className="text-xl sm:text-2xl font-black text-white truncate">{expenses.length}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
            <input 
              type="text" placeholder="Search payee or category..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative w-full sm:w-auto">
              <select 
                value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full sm:w-auto pl-4 pr-10 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs sm:text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-rose-500 cursor-pointer transition-all shadow-sm appearance-none [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="all">All Categories</option>
                {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
            </div>
          </div>
        </div>

        {/* 🚀 COLLAPSIBLE MONTHS LEDGER */}
        {isLoading ? (
          <ExpenseSkeleton />
        ) : processedExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm px-4">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-5 shadow-inner">
              <HiOutlineShoppingCart className="text-5xl text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-lg font-black text-slate-700 dark:text-slate-300">No expense records found</p>
            <p className="text-sm font-medium text-slate-500 mt-2 text-center max-w-sm">{searchTerm || filterCategory !== 'all' ? 'Adjust your search filters.' : 'Log your first expense to track spending.'}</p>
            {!searchTerm && filterCategory === 'all' && (
              <button onClick={openModal} className="mt-6 bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-rose-500/30 transition-all active:scale-95">Log Expense Now</button>
            )}
          </div>
        ) : (
          processedExpenses.map((month) => {
            const opening = month.openingBalance || 0;
            const closing = month.closingBalance || 0;
            const monthTotal = month.monthTotal || 0;
            const isOpen = openMonths.has(month.monthKey);
            return (
              <div key={month.monthKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleMonth(month.monthKey)}
                  className="w-full px-6 py-5 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left"
                >
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="p-2 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg">
                      <HiOutlineCalendar size={18} />
                    </div>
                    {month.monthName}
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Opening</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">{currencySymbol}{opening.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    </div>
                    <HiOutlineChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="animate-in fade-in duration-200">
                    <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800">
                      <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Opening</p><p className="font-black text-slate-700 dark:text-slate-300">{currencySymbol}{opening.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                      <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Expenses</p><p className="font-black text-rose-600">-{currencySymbol}{monthTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                      <div className="col-span-2 sm:col-span-1"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Closing</p><p className="font-black text-rose-700 dark:text-rose-400">{currencySymbol}{closing.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                      {month.records.map((rec) => {
                        const dateObj = new Date(rec.date);
                        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={rec.id} className={`p-4 ${rec.isSplit ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="font-black text-slate-900 dark:text-white text-sm break-words">{rec.title}</p>
                                <span className="inline-block px-1.5 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[8px] font-black uppercase tracking-wider rounded mt-1 border border-rose-200 dark:border-rose-500/20 shadow-sm break-words max-w-full">{rec.category}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-base font-black text-rose-600 dark:text-rose-400 tracking-tight leading-none">-{currencySymbol}{(Number(rec.finalBaseAmount) || 0).toLocaleString(undefined, {minimumFractionDigits: 0})}</p>
                                {rec.asset !== baseCurrency && !rec.isSplit && <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1 break-words">{Number(rec.amount || 0).toLocaleString()} {rec.asset}</p>}
                                {rec.isSplit && <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1">Multiple Assets</p>}
                                {rec.feeAmount > 0 && <p className="text-[9px] font-bold text-rose-500 dark:text-rose-400 mt-0.5">Fee: {Number(rec.feeAmount).toLocaleString()}</p>}
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-between items-end gap-2 mt-3">
                              <div className="flex flex-col gap-1.5">
                                <div className={`flex items-center gap-1.5 w-max px-2 py-1 rounded-md border text-[9px] font-bold shadow-sm ${rec.isSplit ? 'bg-amber-100/50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                  {rec.isSplit ? (<><FaRandom className="text-amber-600 dark:text-amber-500" /> Split Expense</>) : (<>{getVaultIcon(rec.vault)} <span className="capitalize">{rec.vault}</span> {rec.subWallet && <span className="opacity-70 ml-0.5 break-words">· {rec.subWallet}</span>}</>)}
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><HiOutlineCalendar size={10}/> {formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]} <span className="opacity-50">· {timeStr}</span></p>
                              </div>
                              <div className="flex gap-1">
                                {rec.linkedExpenseId && !rec.linkedExpenseId.startsWith('EXP_') && <span className="p-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md border border-amber-300 dark:border-amber-500/30 shadow-sm"><FaLock size={12} /></span>}
                                <button onClick={() => handleEdit(rec)} className="p-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-500/30 shadow-sm hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"><HiOutlinePencil size={14} /></button>
                                <button onClick={() => initiateDelete(rec)} className="p-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-md border border-rose-200 dark:border-rose-500/30 shadow-sm hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"><HiOutlineTrash size={14} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[900px]">
                        <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                          <tr><th className="p-4 pl-6 w-32">Date</th><th className="p-4">Payee & Category</th><th className="p-4">Paid From</th><th className="p-4 text-right">Native Amount</th><th className="p-4 text-right">Base Spent</th><th className="p-4 pr-6 text-right">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {month.records.map((rec) => {
                            const dateObj = new Date(rec.date);
                            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                              <tr key={rec.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group ${rec.isSplit ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                                <td className="p-4 pl-6 align-top"><p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 mt-1">{formatGlobalDate ? formatGlobalDate(rec.date, 'short') : rec.date.split('T')[0]}<span className="opacity-50 mx-1 border-l border-slate-300 dark:border-slate-600 pl-2 text-[10px]">{timeStr}</span></p></td>
                                <td className="p-4 align-top"><p className="font-black text-slate-900 dark:text-white text-sm mt-0.5 max-w-[200px] truncate" title={rec.title}>{rec.title}</p><span className="inline-block px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[8px] font-black uppercase tracking-wider rounded mt-1.5 border border-rose-200 dark:border-rose-500/20 shadow-sm truncate max-w-[180px]">{rec.category}</span>{rec.khataDetails && rec.khataDetails.length > 0 && <span className="inline-block ml-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[8px] font-black uppercase tracking-wider rounded border border-blue-200 dark:border-blue-500/20 shadow-sm"><FaUserFriends className="inline mr-1" size={10} /> Shared</span>}</td>
                                <td className="p-4 align-top"><div className={`flex items-center gap-2 mt-1 ${rec.isSplit ? 'bg-amber-100/50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-500/30 w-max shadow-sm' : ''}`}>{rec.isSplit ? (<><FaRandom className="text-amber-600 dark:text-amber-500" /> <span className="text-xs font-bold text-amber-800 dark:text-amber-400">Split Expense</span></>) : (<>{getVaultIcon(rec.vault)} <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{rec.vault}</span></>)}{!rec.isSplit && rec.subWallet && <span className="text-[9px] text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold border border-slate-300 dark:border-slate-700 shadow-sm">{rec.subWallet}</span>}</div></td>
                                <td className="p-4 text-right align-top">
                                  {rec.isSplit ? (
                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-1">Multiple</p>
                                  ) : (
                                    <>
                                      <p className="font-black text-slate-800 dark:text-slate-200 text-sm mt-1">{(Number(rec.amount) || 0).toLocaleString()} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold ml-0.5">{rec.asset}</span></p>
                                      {rec.feeAmount > 0 && <p className="text-[9px] font-bold text-rose-500 dark:text-rose-400 mt-1 uppercase tracking-widest">Fee: {(Number(rec.feeAmount) || 0).toLocaleString()}</p>}
                                      {rec.asset !== baseCurrency && <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest">Rate: {rec.exchangeRate}</p>}
                                    </>
                                  )}
                                </td>
                                <td className="p-4 text-right align-top"><p className="text-base font-black text-rose-600 dark:text-rose-400 tracking-tight mt-0.5">-{currencySymbol}{(Number(rec.finalBaseAmount) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>{rec.friendsShare > 0 && <p className="text-[9px] text-blue-600 dark:text-blue-400 font-bold mt-1">Friends: {currencySymbol}{(Number(rec.friendsShare)||0).toLocaleString()}</p>}</td>
                                <td className="p-4 pr-6 align-top"><div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">{rec.linkedExpenseId && !rec.linkedExpenseId.startsWith('EXP_') && <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[8px] font-black rounded border border-amber-300 dark:border-amber-500/30 shadow-sm mr-1"><FaLock className="inline mb-0.5 mr-0.5" />SYNCED</span>}<button onClick={() => handleEdit(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/20 rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95"><HiOutlinePencil size={14} /></button><button onClick={() => initiateDelete(rec)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/20 rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-sm active:scale-95"><HiOutlineTrash size={14} /></button></div></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-4 sm:px-6 py-4 sm:py-5 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="text-right bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Closing Flow</p>
                        <p className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-400">{currencySymbol}{closing.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-300 dark:border-slate-700">
              
              <div className={`px-6 sm:px-8 py-5 flex justify-between items-center sticky top-0 z-10 shrink-0 text-white ${formData.isSplit ? 'bg-gradient-to-r from-amber-600 to-orange-600' : 'bg-gradient-to-r from-rose-600 to-pink-600'}`}>
                <h3 className="text-xl font-black flex items-center gap-2">
                  {formData.isSplit ? <FaRandom size={20} /> : <HiOutlineShoppingCart size={24} />} 
                  {editingId ? 'Edit Expense' : 'Log Expense'}
                </h3>
                <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors active:scale-90"><HiOutlineX size={20} /></button>
              </div>
              
              <form onSubmit={handleSaveEntry} className="p-4 sm:p-8 space-y-5 sm:space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                {formData.isSynced && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-4 rounded-xl text-xs font-bold leading-relaxed border border-amber-300 dark:border-amber-500/30 shadow-sm">
                    <p className="flex items-center gap-1.5 mb-1.5 font-black"><HiOutlineExclamationCircle size={16}/> Auto-Synced Entry</p>
                    This entry is securely linked to a bill or system transaction. To maintain accuracy, you can only update the <span className="underline decoration-amber-400">Deduction Vault</span> here.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Payee / Item *</label>
                    <input 
                      disabled={formData.isSynced} type="text" required value={formData.title} 
                      onChange={(e) => setFormData({...formData, title: e.target.value})} 
                      placeholder="e.g., Dinner, Rent"
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 transition-colors shadow-sm placeholder-slate-400 dark:placeholder-slate-500 [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Category</label>
                    <div className="relative">
                      <select 
                        disabled={formData.isSynced} value={formData.category} 
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 appearance-none cursor-pointer transition-colors shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" size={20} />
                    </div>
                  </div>
                </div>

                {!formData.isSynced && (
                  <label className="flex justify-between items-center p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                    <div>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2"><FaRandom className="text-amber-500"/> Split Payment</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-bold">Pay this bill using multiple vaults</p>
                    </div>
                    <div className="relative inline-flex items-center shrink-0 ml-4">
                      <input type="checkbox" className="sr-only peer" checked={formData.isSplit} onChange={(e) => setFormData({...formData, isSplit: e.target.checked})} />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-slate-200 after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 dark:peer-checked:bg-amber-500 shadow-inner"></div>
                    </div>
                  </label>
                )}

                {/* 🚀 SINGLE EXPENSE VIEW */}
                {!formData.isSplit ? (
                  <div className="p-4 sm:p-6 bg-rose-50/50 dark:bg-slate-800/80 rounded-[1.5rem] sm:rounded-[2rem] border border-rose-200 dark:border-slate-700 shadow-sm space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Deduct From</label>
                        <div className="relative">
                          <select 
                            value={formData.vault} 
                            onChange={(e) => {
                              const v = e.target.value;
                              const cList = availableCryptos.length > 0 ? availableCryptos : ['BTC'];
                              setFormData({
                                ...formData, vault: v, 
                                asset: v === 'crypto' ? cList[0] : baseCurrency, 
                                exchangeRate: 1, subWallet: '', cryptoPlatform: ''
                              });
                            }} 
                            className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 appearance-none cursor-pointer transition-colors shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
                          >
                            <option value="bank">Bank Account</option>
                            <option value="cash">Physical Cash</option>
                            <option value="online">Online Wallet</option>
                            <option value="crypto">Crypto Engine</option>
                          </select>
                          <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" size={20} />
                        </div>
                      </div>
                      
                      {(formData.vault === 'bank' || formData.vault === 'online') && (
                        <div className="space-y-1.5 animate-in fade-in">
                          <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">{formData.vault === 'bank' ? 'Bank Name *' : 'Wallet Name *'}</label>
                          <input 
                            type="text" list="sub-wallets-exp" required value={formData.subWallet} 
                            onChange={(e) => setFormData({...formData, subWallet: e.target.value})} 
                            className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                            placeholder={formData.vault === 'bank' ? "e.g. SBI" : "e.g. PayPal"}
                          />
                          <datalist id="sub-wallets-exp">{existingBanks.map(b => <option key={b} value={b} />)}</datalist>
                        </div>
                      )}
                      
                      {formData.vault === 'crypto' && (
                        <div className="space-y-1.5 animate-in fade-in">
                          <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Crypto Platform *</label>
                          <input 
                            type="text" list="crypto-platforms-list" required value={formData.cryptoPlatform} 
                            onChange={(e) => setFormData({...formData, cryptoPlatform: e.target.value})} 
                            placeholder="Platform Name (e.g. Binance)"
                            className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm placeholder-slate-400 dark:placeholder-slate-500 [color-scheme:light] dark:[color-scheme:dark]"
                          />
                          <datalist id="crypto-platforms-list">{existingCryptoPlatforms.map(p => <option key={p} value={p} />)}</datalist>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1">Asset Paid In</label>
                        <div className="relative">
                          <select 
                            disabled={formData.isSynced} value={formData.asset} 
                            onChange={(e) => setFormData({...formData, asset: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})}
                            className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 appearance-none cursor-pointer shadow-sm transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                          >
                            {formData.vault === 'crypto' ? (
                              availableCryptos.map(c => <option key={c} value={c}>{c}</option>)
                            ) : (
                              <>
                                <option value={baseCurrency}>{baseCurrency} (Base)</option>
                                <optgroup label="Fiat">
                                  {availableFiats.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                                </optgroup>
                              </>
                            )}
                          </select>
                          <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" size={20} />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between"><span>Gross ({formData.asset}) *</span></label>
                          <input 
                            disabled={formData.isSynced} type="number" step="any" required value={formData.amount} 
                            onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                            placeholder="0.00"
                            className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-lg text-rose-600 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 shadow-sm placeholder-rose-300 dark:placeholder-slate-600 transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between"><span>Fee (Opt)</span></label>
                          <input 
                            disabled={formData.isSynced} type="number" step="any" value={formData.fee} 
                            onChange={(e) => setFormData({...formData, fee: e.target.value})} 
                            placeholder="0.00"
                            className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-lg text-rose-500 dark:text-rose-500 outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-60 shadow-sm placeholder-rose-300 dark:placeholder-slate-600 transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                          />
                        </div>
                      </div>
                    </div>

                    {formData.asset !== baseCurrency && (
                      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-sm animate-in fade-in">
                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 shrink-0"><FaExchangeAlt className="text-rose-500" /> Rate:</span>
                        <div className="flex items-center gap-2 flex-1 w-full">
                          <span className="text-[10px] sm:text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">1 {formData.asset} =</span>
                          <input disabled={formData.isSynced} type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} className="flex-1 w-full min-w-0 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none disabled:opacity-60 shadow-sm focus:border-rose-500 transition-colors text-center [color-scheme:light] dark:[color-scheme:dark]" />
                          <span className="text-[10px] sm:text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">{baseCurrency}</span>
                        </div>
                        <button type="button" onClick={()=>fetchLiveRate(null)} disabled={isFetchingRate === 'single' || formData.isSynced} className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 sm:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0 active:scale-95">
                          <HiOutlineRefresh className={isFetchingRate === 'single' ? "animate-spin" : ""} size={14} /> Live Rate
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 🚀 SPLIT EXPENSE VIEW WITH FEE */
                  <div className="space-y-4 animate-in fade-in zoom-in-95">
                    {formData.splitSources.map((split, index) => (
                      <div key={index} className="p-4 sm:p-5 border-2 border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl sm:rounded-[2rem] space-y-4 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] sm:text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-center shadow-sm">{index + 1}</span> Source
                          </span>
                          {formData.splitSources.length > 2 && (
                            <button type="button" onClick={() => removeSplitSource(index)} className="text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 p-2 rounded-xl border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-colors active:scale-90 shadow-sm"><HiOutlineTrash size={16}/></button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Vault</label>
                            <div className="relative">
                              <select value={split.vault} onChange={(e) => updateSplit(index, 'vault', e.target.value)} className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer transition-colors focus:ring-2 focus:ring-amber-500/50 appearance-none [color-scheme:light] dark:[color-scheme:dark]">
                                <option value="bank">Bank Account</option><option value="cash">Physical Cash</option><option value="online">Online Wallet</option><option value="crypto">Crypto Engine</option>
                              </select>
                              <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" size={18} />
                            </div>
                          </div>
                          {(split.vault === 'bank' || split.vault === 'online') && (
                            <div className="space-y-1.5 animate-in fade-in"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Bank / Wallet</label><input type="text" list={`split-banks-${index}`} required value={split.subWallet} onChange={(e) => updateSplit(index, 'subWallet', e.target.value)} placeholder={split.vault === 'bank' ? "Bank Name" : "Wallet Name"} className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:ring-2 focus:ring-amber-500/50 [color-scheme:light] dark:[color-scheme:dark]" /></div>
                          )}
                          {split.vault === 'crypto' && (
                            <div className="space-y-1.5 animate-in fade-in">
                              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                              <input type="text" list="crypto-platforms-list" required value={split.cryptoPlatform} onChange={(e) => updateSplit(index, 'cryptoPlatform', e.target.value)} placeholder="e.g. Binance" className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:ring-2 focus:ring-amber-500/50 [color-scheme:light] dark:[color-scheme:dark]" />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                            <div className="relative">
                              <select value={split.asset} onChange={(e) => { updateSplit(index, 'asset', e.target.value); updateSplit(index, 'exchangeRate', 1); }} className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none shadow-sm cursor-pointer transition-colors focus:ring-2 focus:ring-amber-500/50 appearance-none [color-scheme:light] dark:[color-scheme:dark]">
                                {split.vault === 'crypto' ? availableCryptos.map(c => <option key={c} value={c}>{c}</option>) : [baseCurrency, ...availableFiats.filter(c => c !== baseCurrency)].map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" size={18} />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Gross Amount</label>
                              <input type="number" step="any" required value={split.amount} onChange={(e) => updateSplit(index, 'amount', e.target.value)} placeholder="0.00" className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-black text-amber-700 dark:text-amber-500 outline-none shadow-sm placeholder-amber-300 dark:placeholder-slate-600 transition-colors focus:ring-2 focus:ring-amber-500/50 text-sm sm:text-lg [color-scheme:light] dark:[color-scheme:dark]" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Fee</label>
                              <input type="number" step="any" value={split.fee} onChange={(e) => updateSplit(index, 'fee', e.target.value)} placeholder="0.00" className="w-full p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-black text-rose-500 dark:text-rose-500 outline-none shadow-sm placeholder-rose-300 dark:placeholder-slate-600 transition-colors focus:ring-2 focus:ring-rose-500/50 text-sm sm:text-lg [color-scheme:light] dark:[color-scheme:dark]" />
                            </div>
                          </div>
                        </div>
                        
                        {split.asset !== baseCurrency && (
                          <div className="p-3 sm:p-4 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/50 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm relative z-10 animate-in fade-in">
                            <span className="text-[10px] sm:text-xs font-black text-slate-700 dark:text-slate-400 flex items-center gap-2 shrink-0"><FaExchangeAlt className="text-amber-500"/> Rate:</span>
                            <div className="flex items-center gap-2 flex-1 w-full">
                              <span className="text-[10px] sm:text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">1 {split.asset} =</span>
                              <input type="number" step="any" required value={split.exchangeRate} onChange={(e) => updateSplit(index, 'exchangeRate', e.target.value)} className="flex-1 w-full min-w-0 p-2 sm:p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white outline-none shadow-sm focus:ring-2 focus:ring-amber-500/50 transition-colors text-center [color-scheme:light] dark:[color-scheme:dark]" />
                              <span className="text-[10px] sm:text-sm font-black text-slate-700 dark:text-slate-400 whitespace-nowrap">{baseCurrency}</span>
                            </div>
                            <button type="button" onClick={()=>fetchLiveRate(index)} disabled={isFetchingRate === index} className="w-full md:w-auto text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-white px-3 py-2.5 sm:py-2 rounded-lg flex items-center justify-center gap-1 uppercase tracking-widest transition-colors shadow-sm shrink-0 active:scale-95"><HiOutlineRefresh className={isFetchingRate === index ? "animate-spin" : ""} size={14}/> Live Rate</button>
                          </div>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addSplitSource} className="w-full py-3.5 sm:py-4 border-2 border-dashed border-amber-300 dark:border-amber-700/50 text-amber-600 dark:text-amber-500 rounded-[2rem] font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-sm"><HiOutlinePlus size={18}/> Add Payment Source</button>
                  </div>
                )}

                {!formData.isSynced && (
                  <div className="p-4 sm:p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[1.5rem] sm:rounded-[2rem] border border-blue-200 dark:border-blue-800/50 shadow-sm animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-black text-xs sm:text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaUserFriends size={16}/> Split with Friends</h4>
                        <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-bold">Auto-log their share into Khata</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input type="checkbox" className="sr-only peer" checked={formData.isKhataSplit} onChange={(e) => setFormData({...formData, isKhataSplit: e.target.checked})} />
                        <div className="w-10 h-5 sm:w-11 sm:h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-slate-200 after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-500 dark:peer-checked:bg-blue-500 shadow-inner"></div>
                      </label>
                    </div>

                    {formData.isKhataSplit && (
                      <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-4 animate-in fade-in">
                        {formData.khataSplits.map((ks, index) => (
                          <div key={index} className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full bg-white dark:bg-slate-800 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex-1 w-full min-w-0">
                              <input 
                                type="text" list={`khata-${index}`} required placeholder="Friend's Name" 
                                value={ks.partyName} 
                                onChange={(e) => updateKhataSplit(index, 'partyName', e.target.value)} 
                                className="w-full p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-sm text-slate-900 dark:text-white outline-none placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 [color-scheme:light] dark:[color-scheme:dark]" 
                              />
                              <datalist id={`khata-${index}`}>{existingParties.map(p => <option key={p} value={p} />)}</datalist>
                            </div>
                            <div className="w-full sm:w-36 shrink-0 flex items-center gap-2">
                              <input 
                                type="number" step="any" required placeholder="Amt Owed" 
                                value={ks.amount} 
                                onChange={(e) => updateKhataSplit(index, 'amount', e.target.value)} 
                                className="w-full p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-sm text-slate-900 dark:text-white outline-none placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 text-center [color-scheme:light] dark:[color-scheme:dark]" 
                              />
                              {formData.khataSplits.length > 1 && (
                                <button 
                                  type="button" 
                                  onClick={() => removeKhataSplit(index)} 
                                  className="shrink-0 text-rose-500 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-800/50 p-2.5 sm:p-3 rounded-lg transition-colors border border-rose-200 dark:border-rose-800 active:scale-95"
                                >
                                  <HiOutlineTrash size={16}/>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={addKhataSplit} className="text-[10px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5 hover:underline mt-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg w-max active:scale-95 transition-all"><HiOutlinePlus size={14}/> Add Friend</button>
                      </div>
                    )}
                  </div>
                )}

                {/* 🚀 FINAL SUMMARY */}
                <div className="p-4 sm:p-5 bg-slate-100 dark:bg-slate-800/80 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-inner mt-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-5">
                    <div className="w-full sm:w-1/2">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Date & Time *</label>
                      <input 
                        disabled={formData.isSynced} type="datetime-local" required value={formData.date} 
                        onChange={(e) => setFormData({...formData, date: e.target.value})} 
                        className="block w-full mt-1.5 p-3.5 sm:p-4 bg-white dark:bg-slate-900 font-bold text-sm text-slate-900 dark:text-white outline-none cursor-pointer disabled:opacity-60 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/50 rounded-xl [color-scheme:light] dark:[color-scheme:dark]" 
                      />
                      <p className="text-[9px] sm:text-[10px] text-rose-600 dark:text-rose-400 mt-2 ml-1 font-bold">{formatGlobalDate && formData.date ? formatGlobalDate(formData.date.split('T')[0], 'full') : ''}</p>
                    </div>
                    
                    <div className="text-left sm:text-right w-full sm:w-auto sm:border-l border-slate-300 dark:border-slate-700 sm:pl-6">
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Vault Deduction</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-black text-rose-600 dark:text-rose-400 tracking-tight mt-1 truncate">
                        -{currencySymbol}{(Number(formData.isSplit ? getSplitTotalBase() : getNetBaseAmount(formData.amount, formData.fee, formData.asset !== baseCurrency, formData.exchangeRate)) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </p>
                      {(!formData.isSplit && parseFloat(formData.fee) > 0) && (
                        <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400 mt-1 uppercase tracking-widest">Incl Fee: {parseFloat(formData.fee)} {formData.asset}</p>
                      )}
                      {formData.isKhataSplit && (
                        <p className="text-[10px] sm:text-xs font-black text-blue-600 dark:text-blue-400 mt-2 bg-blue-50 dark:bg-blue-900/20 px-2 py-1.5 rounded-lg inline-block shadow-sm">
                          Your Net Share: {currencySymbol}{Math.max(0, (Number(formData.isSplit ? getSplitTotalBase() : getNetBaseAmount(formData.amount, formData.fee, formData.asset !== baseCurrency, formData.exchangeRate)) || 0) - (Number(getBaseAmount(getKhataTotal(), formData.asset !== baseCurrency, formData.exchangeRate)) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-4 z-10">
                  <button 
                    type="submit" disabled={isSaving} 
                    className={`w-full p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] font-black text-sm sm:text-base uppercase tracking-widest text-white transition-all shadow-xl flex items-center justify-center gap-2 shrink-0 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} ${formData.isSplit ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30 hover:from-amber-600 hover:to-orange-600' : 'bg-gradient-to-r from-rose-600 to-pink-600 shadow-rose-500/30 hover:from-rose-700 hover:to-pink-700'}`}
                  >
                    {isSaving ? <HiOutlineRefresh className="animate-spin text-xl" /> : <HiOutlineShoppingCart size={20} />}
                    {isSaving ? 'Processing...' : (editingId ? 'Update Ledger' : (formData.isKhataSplit ? 'Save & Sync Khata' : 'Secure Payment'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteContext && (
          <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-700 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
              <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white shrink-0">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner"><HiOutlineShieldCheck size={24} /></div><div><h3 className="text-xl font-black">Security Verification</h3><p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest">Permanent Deletion</p></div></div>
              </div>
              <form onSubmit={executeSecureDelete} className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-2xl shadow-sm">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed">You are deleting <span className="font-black">"{deleteContext.title}"</span> worth <span className="font-black"> {currencySymbol}{(Number(deleteContext.finalBaseAmount)||0).toLocaleString()}</span></p>
                  {deleteContext.linkedExpenseId && !deleteContext.linkedExpenseId.startsWith('EXP_') && <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-2 font-bold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-200 dark:border-rose-800/50"><HiOutlineExclamationCircle size={14} className="shrink-0"/> Auto-synced entry. Deletion will automatically reverse the original transaction in your vault!</p>}
                </div>
                <div className="space-y-1.5"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 text-center block">Security PIN</label><input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="w-full text-center tracking-[0.4em] text-2xl p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm focus:border-rose-500 [color-scheme:light] dark:[color-scheme:dark]" placeholder="••••" />{pinError && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-2 text-center animate-bounce">{pinError}</p>}</div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors shadow-sm active:scale-95 uppercase tracking-widest">Cancel</button>
                  <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-xl font-black text-sm bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 active:scale-95 uppercase tracking-widest">{isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : <HiOutlineTrash size={18} />} Confirm</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ExpenseTracker = () => (
  <ToastProvider>
    <ExpenseTrackerContent />
  </ToastProvider>
);

export default ExpenseTracker;