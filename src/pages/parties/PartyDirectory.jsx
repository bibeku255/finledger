import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
// 🚀 FIXED: Added getDocs, where, getDoc for Secure Delete Sync
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlineUserAdd, HiOutlineSearch, HiOutlineUsers, 
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineX, 
  HiOutlineTrash, HiOutlineChevronRight, HiOutlineLocationMarker,
  HiOutlineExclamationCircle, HiOutlineRefresh, HiOutlinePencil,
  HiOutlineLockClosed, HiOutlineShieldCheck, HiOutlineChevronDown,
  HiOutlineBriefcase, HiOutlineCalendar
} from 'react-icons/hi';
// 🚀 BUG FIXED: Added FaUniversity here!
import { FaUserCircle, FaPhoneAlt, FaUniversity } from 'react-icons/fa'; 

const fiatCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];
const BINANCE_SAFE_COINS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX', 'LTC', 'BCH', 'ADA', 'XMR', 'XLM', 'DAI', 'ZEC', 'SHIB', 'SUI', 'TON', 'DOT', 'PEPE', 'NEAR', 'POL', 'ATOM', 'ARB', 'BONK', 'CAKE', 'XTZ', 'FLOKI', 'OP', 'TWT', 'BAT', 'DGB', 'KAVA', 'AVAX', 'MEME', 'DASH'];

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const PartyDirectory = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'INR', selectedCryptos = [], selectedFiats = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const navigate = useNavigate();

  const [parties, setParties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [activeTab, setActiveTab] = useState('all'); 
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState(null); 
  
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    accountType: 'casual', 
    emiDueDate: '', 
    emiAmount: '', 
    initialBalanceType: 'none', 
    initialAmount: '',
    currency: baseCurrency, 
    exchangeRate: 1
  });

  const cryptoCurrencies = useMemo(() => {
    const customSymbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    return Array.from(new Set(["USDT", "USDC", "BTC", "ETH", "SOL", ...customSymbols]));
  }, [selectedCryptos]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "parties"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const partyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setParties(partyData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const totalReceivables = parties.reduce((acc, curr) => curr.netBalance > 0 && curr.status !== 'bad_debt' ? acc + curr.netBalance : acc, 0);
  const totalPayables = parties.reduce((acc, curr) => curr.netBalance < 0 && curr.status !== 'bad_debt' ? acc + Math.abs(curr.netBalance) : acc, 0);

  const filteredParties = parties.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.phone && p.phone.includes(searchTerm)) ||
                          (p.address && p.address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesTab = true;
    if (activeTab === 'receivable') matchesTab = p.netBalance > 0 && p.status !== 'bad_debt';
    if (activeTab === 'payable') matchesTab = p.netBalance < 0 && p.status !== 'bad_debt';
    if (activeTab === 'settled') matchesTab = p.netBalance === 0 || p.status === 'bad_debt' || p.status === 'settled';
    if (activeTab === 'loans') matchesTab = p.accountType === 'loan';

    return matchesSearch && matchesTab;
  });

  const nameSuggestions = (!editingPartyId && formData.name.trim().length > 0) 
    ? parties.filter(p => p.name.toLowerCase().includes(formData.name.toLowerCase()))
    : [];

  const handleSelectExisting = (partyId) => {
    closeModal();
    navigate(`/dashboard/parties/${partyId}`);
  };

  const existingExactMatch = !editingPartyId && parties.find(p => 
    (formData.phone.length > 5 && p.phone === formData.phone)
  );

  const fetchLiveRate = async () => {
    if (formData.currency === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const fiatData = await fiatRes.json();
      const usdToBase = fiatData.rates[baseCurrency] || 1;

      if (selectedFiats.includes(formData.currency) || fiatCurrencies.includes(formData.currency)) {
        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
        const data = await res.json();
        if (data.rates[baseCurrency]) setFormData(prev => ({ ...prev, exchangeRate: data.rates[baseCurrency].toFixed(4) }));
      } else {
        if (formData.currency === 'USDT' || formData.currency === 'USDC') {
          setFormData(prev => ({ ...prev, exchangeRate: usdToBase.toFixed(4) }));
        } else {
           if(BINANCE_SAFE_COINS.includes(formData.currency.toUpperCase())) {
              const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${formData.currency.toUpperCase()}USDT`);
              if (bRes.ok) {
                const bData = await bRes.json();
                const finalRate = parseFloat(bData.price) * usdToBase;
                setFormData(prev => ({ ...prev, exchangeRate: finalRate.toFixed(4) }));
              }
           } else {
              // Quick fallback using CoinGecko if Binance is not safe
              const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${formData.currency.toLowerCase()}&vs_currencies=usd`);
              if(cgRes.ok) {
                 const cgData = await cgRes.json();
                 if(cgData[formData.currency.toLowerCase()]?.usd) {
                    const finalRate = parseFloat(cgData[formData.currency.toLowerCase()].usd) * usdToBase;
                    setFormData(prev => ({ ...prev, exchangeRate: finalRate.toFixed(4) }));
                 }
              } else {
                 alert(`Live rate for ${formData.currency} is not available. Please enter manually.`);
              }
           }
        }
      }
    } catch (error) {
      alert("Rate fetch failed. Please enter manually.");
    } finally {
      setIsFetchingRate(false);
    }
  };

  const isForeign = formData.currency !== baseCurrency;
  const initialBaseValue = (parseFloat(formData.initialAmount) || 0) * (isForeign ? (parseFloat(formData.exchangeRate) || 1) : 1);

  const handleSaveParty = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!editingPartyId && existingExactMatch) {
      alert(`A party with this phone number (${formData.phone}) already exists. Redirecting to their ledger...`);
      handleSelectExisting(existingExactMatch.id);
      return;
    }

    if (formData.accountType === 'loan' && (!formData.emiDueDate || !formData.emiAmount)) {
      alert("Please provide the EMI Amount and Due Date for formal loans.");
      return;
    }

    setIsSaving(true);

    try {
      if (editingPartyId) {
        await setDoc(doc(db, "users", user.uid, "parties", editingPartyId), {
          name: formData.name.trim(),
          phone: formData.phone || '',
          address: formData.address || '',
          accountType: formData.accountType,
          emiDueDate: formData.accountType === 'loan' ? formData.emiDueDate : null,
          emiAmount: formData.accountType === 'loan' ? parseFloat(formData.emiAmount) : null,
        }, { merge: true });
      } else {
        let startingBalanceBase = 0;
        if (formData.initialBalanceType === 'receivable') startingBalanceBase = initialBaseValue; 
        if (formData.initialBalanceType === 'payable') startingBalanceBase = -initialBaseValue; 

        const newParty = {
          name: formData.name.trim(),
          phone: formData.phone || '',
          address: formData.address || '',
          accountType: formData.accountType,
          emiDueDate: formData.accountType === 'loan' ? formData.emiDueDate : null,
          emiAmount: formData.accountType === 'loan' ? parseFloat(formData.emiAmount) : null,
          netBalance: startingBalanceBase, 
          baseCurrency: baseCurrency,
          createdAt: new Date().getTime(),
          status: 'active', 
          trustScore: 100 
        };

        const docRef = await addDoc(collection(db, "users", user.uid, "parties"), newParty);
        
        if (startingBalanceBase !== 0) {
          await addDoc(collection(db, "users", user.uid, "smartKhata"), {
            partyName: formData.name.trim(),
            type: startingBalanceBase > 0 ? 'gave' : 'got', // Matches Smart Khata Ledger format
            amount: parseFloat(formData.initialAmount),
            currency: formData.currency,
            exchangeRate: formData.exchangeRate,
            baseAmount: Math.abs(startingBalanceBase),
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().getTime(),
            reason: formData.accountType === 'loan' ? 'Initial Loan Principal' : 'Opening Account Balance',
            partyId: docRef.id // Link to specific party
          });
        }
      }
      closeModal();
    } catch (error) {
      alert(editingPartyId ? "Failed to update party." : "Failed to create party.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (party, e) => {
    e.stopPropagation(); 
    setEditingPartyId(party.id);
    setFormData({
      name: party.name,
      phone: party.phone || '',
      address: party.address || '',
      accountType: party.accountType || 'casual',
      emiDueDate: party.emiDueDate || '',
      emiAmount: party.emiAmount || '',
      initialBalanceType: 'none', 
      initialAmount: '',
      currency: baseCurrency,
      exchangeRate: 1
    });
    setShowSuggestions(false);
    setIsModalOpen(true);
  };

  const initiateDelete = (party, e) => {
    e.stopPropagation(); 
    setDeleteContext(party);
    setPinInput('');
    setPinError('');
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your Security PIN.");
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

      await deleteDoc(doc(db, "users", user.uid, "parties", deleteContext.id));
      
      // Cleanup related khata logs
      const q = query(collection(db, "users", user.uid, "smartKhata"), where("partyId", "==", deleteContext.id));
      const snap = await getDocs(q);
      snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, "smartKhata", d.id)));

      setDeleteContext(null); 
    } catch (error) {
      console.error("Delete failed", error);
      setPinError("System error during verification. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openModal = () => {
    setEditingPartyId(null);
    setFormData({ name: '', phone: '', address: '', accountType: 'casual', emiDueDate: '', emiAmount: '', initialBalanceType: 'none', initialAmount: '', currency: baseCurrency, exchangeRate: 1 });
    setShowSuggestions(false);
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setShowSuggestions(false);
    setEditingPartyId(null);
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* 🚀 HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-blue-500/10 text-blue-600 rounded-2xl ring-1 ring-blue-500/20">
              <HiOutlineUsers size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Smart Khata & Loans</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            Manage personal lenders, casual debts, and formal Bank EMIs in one unified system.
          </p>
        </div>
        <button onClick={openModal} className="group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-7 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-lg shadow-blue-500/25">
          <HiOutlineUserAdd size={20} className="group-hover:scale-110 transition-transform duration-300" /> 
          Add Party / Loan
        </button>
      </div>

      {/* 📊 MASTER KHATA STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-[2rem] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <HiOutlineTrendingUp/> Total You Will Get (Assets)
            </p>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{currencySymbol}{totalReceivables.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
        </div>
        <div className="p-6 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-[2rem] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <HiOutlineTrendingDown/> Total You Will Give (Liabilities)
            </p>
            <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{currencySymbol}{totalPayables.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
        </div>
      </div>

      {/* 🔍 SEARCH & TABS */}
      <div className="space-y-4">
        <div className="relative">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
          <input type="text" placeholder="Search by name, phone or bank..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
          <button onClick={() => setActiveTab('all')} className={`px-5 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-colors border ${activeTab === 'all' ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>All Accounts</button>
          <button onClick={() => setActiveTab('loans')} className={`px-5 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 border ${activeTab === 'loans' ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 dark:bg-indigo-500/5 dark:border-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/10'}`}><HiOutlineBriefcase size={14}/> Formal Loans / EMI</button>
          <button onClick={() => setActiveTab('receivable')} className={`px-5 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 border ${activeTab === 'receivable' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 dark:bg-emerald-500/5 dark:border-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/10'}`}><HiOutlineTrendingUp size={14}/> To Get (+)</button>
          <button onClick={() => setActiveTab('payable')} className={`px-5 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 border ${activeTab === 'payable' ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20' : 'bg-white text-rose-600 border-rose-100 hover:bg-rose-50 dark:bg-rose-500/5 dark:border-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/10'}`}><HiOutlineTrendingDown size={14}/> To Give (-)</button>
          <button onClick={() => setActiveTab('settled')} className={`px-5 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 border ${activeTab === 'settled' ? 'bg-slate-500 text-white border-slate-500' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}><HiOutlineShieldCheck size={14}/> Settled / Closed</button>
        </div>
      </div>

      {/* 📒 PARTY LIST */}
      {isLoading ? (
         <div className="p-16 text-center text-slate-500 font-bold animate-pulse">Loading Data...</div>
      ) : filteredParties.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <HiOutlineUsers className="mx-auto text-5xl text-slate-200 dark:text-slate-800 mb-4" />
          <h3 className="text-xl font-black text-slate-700 dark:text-white mb-2">No Accounts Found</h3>
          <p className="text-slate-500 font-semibold mb-6">
            {activeTab === 'loans' ? 'You have no active formal loans or EMIs.' : 'Add friends, relatives, or banks to start tracking.'}
          </p>
          {activeTab === 'all' && (
            <button onClick={openModal} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black px-6 py-2.5 rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Add First Account</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredParties.map(party => (
            <div 
              key={party.id} 
              onClick={() => navigate(`/dashboard/parties/${party.id}`)}
              role="button"
              tabIndex={0}
              className={`bg-white dark:bg-slate-900 p-5 rounded-3xl border shadow-sm hover:shadow-md transition-all cursor-pointer relative flex flex-col justify-between h-full ${party.status === 'bad_debt' ? 'border-rose-300 dark:border-rose-500/50 bg-rose-50/30 dark:bg-rose-900/10' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/50'}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 ${party.status === 'bad_debt' ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/20' : party.accountType === 'loan' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    {party.accountType === 'loan' ? <FaUniversity size={20} /> : <FaUserCircle size={24} />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white text-lg leading-tight capitalize">{party.name}</h3>
                    {party.accountType === 'loan' && (
                       <span className="inline-block bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-1">Formal Loan/EMI</span>
                    )}
                    {party.phone && (
                      <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                        <FaPhoneAlt size={8}/> {party.phone}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* 🚀 FIXED: Buttons are always visible now. Handled hover logic correctly */}
                <div className="flex items-center gap-1">
                  <button onClick={(e) => handleEditClick(party, e)} className="p-2 text-slate-400 hover:text-blue-600 active:bg-blue-50 dark:active:bg-blue-500/10 rounded-lg transition-colors z-10" title="Edit Details">
                    <HiOutlinePencil size={18} />
                  </button>
                  <button onClick={(e) => initiateDelete(party, e)} className="p-2 text-slate-400 hover:text-rose-500 active:bg-rose-50 dark:active:bg-rose-500/10 rounded-lg transition-colors z-10" title="Delete">
                    <HiOutlineTrash size={18} />
                  </button>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${party.status === 'bad_debt' ? 'bg-rose-100/50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'} mt-auto`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                  <span>{party.status === 'bad_debt' ? 'Bad Debt / Defaulter' : party.netBalance > 0 ? 'You will get' : party.netBalance < 0 ? 'You will give' : 'Account Settled'}</span>
                  {/* 🚀 GLOBAL DATE FOR EMI */}
                  {party.accountType === 'loan' && party.emiDueDate && party.netBalance !== 0 && (
                     <span className="text-indigo-500 flex items-center gap-0.5">
                       <HiOutlineCalendar size={12}/> Due: {formatGlobalDate ? formatGlobalDate(party.emiDueDate, 'short') : new Date(party.emiDueDate).getDate()}
                     </span>
                  )}
                </p>
                <p className={`text-2xl font-black ${party.status === 'bad_debt' ? 'text-rose-600 dark:text-rose-400' : party.netBalance > 0 ? 'text-emerald-500' : party.netBalance < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                  {currencySymbol}{Math.abs(party.netBalance).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- ADD/EDIT PARTY MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            <div className="px-6 sm:px-8 py-5 flex justify-between items-center bg-blue-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                {editingPartyId ? <HiOutlinePencil size={24} /> : <HiOutlineUserAdd size={24} />}
                <h3 className="text-xl font-black">{editingPartyId ? 'Edit Details' : 'Add New Account'}</h3>
              </div>
              <button onClick={closeModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                <HiOutlineX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveParty} className="p-6 sm:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-5">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setFormData({...formData, accountType: 'casual'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${formData.accountType === 'casual' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700'}`}>
                  Casual Khata
                </button>
                <button type="button" onClick={() => setFormData({...formData, accountType: 'loan'})} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${formData.accountType === 'loan' ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30' : 'text-slate-500 hover:text-slate-700'}`}>
                  Formal Loan / EMI
                </button>
              </div>

              <div className="space-y-2 relative">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  {formData.accountType === 'loan' ? 'Bank / Lender Name' : 'Person / Company Name'}
                </label>
                <input type="text" required value={formData.name} 
                  onChange={(e) => { setFormData({...formData, name: e.target.value}); if (!editingPartyId) setShowSuggestions(true); }} 
                  onFocus={() => { if(!editingPartyId) setShowSuggestions(true) }}
                  placeholder={formData.accountType === 'loan' ? "e.g. HDFC Home Loan, Bajaj Finance" : "e.g. Rahul, Office Colleague"} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" 
                />
                
                {showSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Existing Accounts Found</span>
                    </div>
                    <ul className="max-h-48 overflow-y-auto custom-scrollbar">
                      {nameSuggestions.map(s => (
                        <li key={s.id} onClick={() => handleSelectExisting(s.id)} className="p-3 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer flex flex-col transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                          <span className="font-black text-sm text-slate-800 dark:text-white capitalize flex justify-between items-center">
                            {s.name} <HiOutlineChevronRight className="text-blue-500"/>
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 mt-0.5">{s.phone} {s.address && `• ${s.address}`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {formData.accountType === 'loan' && (
                <div className="grid grid-cols-2 gap-5 p-4 bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl animate-in fade-in zoom-in-95">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1">EMI Amount</label>
                    <input type="number" required={formData.accountType === 'loan'} value={formData.emiAmount} onChange={(e) => setFormData({...formData, emiAmount: e.target.value})} placeholder="e.g. 5000" 
                      className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                  </div>
                  {/* 🚀 GLOBAL DATE APPLIED FOR EMI PICKER */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1 flex justify-between">
                      <span>Next Due Date</span>
                    </label>
                    <input type="date" required={formData.accountType === 'loan'} value={formData.emiDueDate} onChange={(e) => setFormData({...formData, emiDueDate: e.target.value})} 
                      className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                    {formData.emiDueDate && (
                       <span className="block text-[10px] font-bold text-indigo-500 mt-1">{formatGlobalDate ? formatGlobalDate(formData.emiDueDate, 'full') : ''}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone Number (Optional)</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="e.g. +91 9876543210" 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Notes / Address (Optional)</label>
                  <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="e.g. Loan A/C 4589..." 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                </div>
              </div>

              {!editingPartyId && (
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    {formData.accountType === 'loan' ? 'Total Loan Principal (Remaining)' : 'Previous Balance (If any)'}
                  </label>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <label className={`p-3 rounded-xl border-2 text-center cursor-pointer font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1 ${formData.initialBalanceType === 'none' ? 'bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-700 dark:border-slate-500 dark:text-white' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                      <input type="radio" name="balType" className="hidden" checked={formData.initialBalanceType === 'none'} onChange={() => setFormData({...formData, initialBalanceType: 'none', initialAmount: ''})} />
                      Settled <span className="text-[9px] opacity-70">(Zero)</span>
                    </label>
                    <label className={`p-3 rounded-xl border-2 text-center cursor-pointer font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1 ${formData.initialBalanceType === 'receivable' ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                      <input type="radio" name="balType" className="hidden" checked={formData.initialBalanceType === 'receivable'} onChange={() => setFormData({...formData, initialBalanceType: 'receivable'})} />
                      To Get <span className="text-[9px] opacity-70">(+)</span>
                    </label>
                    <label className={`p-3 rounded-xl border-2 text-center cursor-pointer font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1 ${formData.initialBalanceType === 'payable' ? 'bg-rose-50 border-rose-400 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                      <input type="radio" name="balType" className="hidden" checked={formData.initialBalanceType === 'payable'} onChange={() => setFormData({...formData, initialBalanceType: 'payable'})} />
                      To Give <span className="text-[9px] opacity-70">(-)</span>
                    </label>
                  </div>

                  {formData.initialBalanceType !== 'none' && (
                    <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mt-4 space-y-4 animate-in slide-in-from-top-2">
                      <div className="flex gap-4">
                        <div className="w-1/3 relative">
                          <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value, exchangeRate: e.target.value === baseCurrency ? 1 : ''})} 
                            className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none">
                            <option value={baseCurrency}>{baseCurrency} (Base)</option>
                            {selectedFiats.length > 0 && <optgroup label="Your Fiat">{selectedFiats.filter(c => c !== baseCurrency).map(c => <option key={c} value={c}>{c}</option>)}</optgroup>}
                            {cryptoCurrencies.length > 0 && <optgroup label="Your Crypto">{cryptoCurrencies.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>}
                          </select>
                          <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        
                        <input type="number" required step="any" value={formData.initialAmount} onChange={(e) => setFormData({...formData, initialAmount: e.target.value})} placeholder="Amount" 
                          className={`w-2/3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-lg outline-none focus:ring-2 transition-all ${formData.initialBalanceType === 'receivable' ? 'text-emerald-500 focus:ring-emerald-500/50' : 'text-rose-500 focus:ring-rose-500/50'}`} />
                      </div>

                      {isForeign && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-2 w-1/2">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Rate:</span>
                            <input type="number" step="any" required value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})} placeholder={`in ${baseCurrency}`} 
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold dark:text-white outline-none focus:border-blue-400 text-xs" />
                          </div>
                          <button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} className="text-[9px] font-black bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 px-3 py-1.5 rounded-md hover:bg-blue-200 transition-colors flex items-center gap-1">
                            <HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} /> {isFetchingRate ? 'Syncing...' : 'Live Rate'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={isSaving} onClick={() => setShowSuggestions(false)} className="w-full p-4 rounded-2xl font-black text-white text-lg transition-all shadow-xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                {isSaving ? 'Processing...' : (editingPartyId ? 'Update Details' : 'Create Account')}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh]">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-full flex items-center justify-center text-3xl mb-4">
                <HiOutlineLockClosed />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">
                You are about to delete <span className="text-slate-800 dark:text-white uppercase">"{deleteContext.name}"</span>.
              </p>
              
              {deleteContext.netBalance !== 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-start gap-1 text-left">
                    <HiOutlineExclamationCircle size={16} className="shrink-0" />
                    WARNING: This account has an active balance of {currencySymbol}{Math.abs(deleteContext.netBalance)}. Deleting it might break your cashflow metrics.
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={executeSecureDelete} className="space-y-4">
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
                  Verify & Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PartyDirectory;