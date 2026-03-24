import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { 
  HiOutlineSearch, HiOutlineCheckCircle, HiOutlineGlobeAlt, 
  HiOutlineEye, HiOutlineInformationCircle, HiOutlineLockClosed
} from 'react-icons/hi';

const currenciesList = [
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States', flag: '🇺🇸', iconId: 'us' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'Canada', flag: '🇨🇦', iconId: 'ca' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', country: 'Mexico', flag: '🇲🇽', iconId: 'mx' },
  { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee', country: 'Nepal', flag: '🇳🇵', iconId: 'np' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'India', flag: '🇮🇳', iconId: 'in' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', country: 'Pakistan', flag: '🇵🇰', iconId: 'pk' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', country: 'Bangladesh', flag: '🇧🇩', iconId: 'bd' },
  { code: 'LKR', symbol: 'රු', name: 'Sri Lankan Rupee', country: 'Sri Lanka', flag: '🇱🇰', iconId: 'lk' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', country: 'United Arab Emirates', flag: '🇦🇪', iconId: 'ae' },
  { code: 'SAR', symbol: 'ر.स', name: 'Saudi Riyal', country: 'Saudi Arabia', flag: '🇸🇦', iconId: 'sa' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', country: 'Qatar', flag: '🇶🇦', iconId: 'qa' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', country: 'Kuwait', flag: '🇰🇼', iconId: 'kw' },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial', country: 'Oman', flag: '🇴🇲', iconId: 'om' },
  { code: 'BHD', symbol: 'ب.د', name: 'Bahraini Dinar', country: 'Bahrain', flag: '🇧🇭', iconId: 'bh' },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'Eurozone', flag: '🇪🇺', iconId: 'eu' },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom', flag: '🇬🇧', iconId: 'gb' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'Japan', flag: '🇯🇵', iconId: 'jp' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'Australia', flag: '🇦🇺', iconId: 'au' },
];

const SetCurrency = () => {
  const { user, baseCurrency, updateBaseCurrency, selectedFiats = ['USD', 'INR'], updateSelectedFiats } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('base'); 
  const [isLocked, setIsLocked] = useState(false);
  const [isCheckingLock, setIsCheckingLock] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    const checkLedgerData = async () => {
      if (!user) return;
      try {
        const vaults = ['cashWallet', 'bankWallet', 'onlineWallet', 'capitalShifts', 'holdAndSwap'];
        let hasData = false;

        for (const vault of vaults) {
          const q = query(collection(db, "users", user.uid, vault), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            hasData = true;
            break;
          }
        }
        setIsLocked(hasData);
      } catch (error) {
        console.error("Error checking ledger locks:", error);
      } finally {
        setIsCheckingLock(false);
      }
    };
    checkLedgerData();
  }, [user]);

  const filteredCurrencies = currenciesList.filter(
    (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           c.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleWatchlistToggle = async (code) => {
    const newList = selectedFiats.includes(code) ? selectedFiats.filter(f => f !== code) : [...selectedFiats, code];
    if(updateSelectedFiats) await updateSelectedFiats(newList);
  };

  const handleBaseCurrencyChange = async (newBaseCode) => {
    if (isLocked) {
      alert("⚠️ Base Currency is locked because you have active transactions in your ledger.");
      return;
    }
    if (newBaseCode === baseCurrency) return; 
    await updateBaseCurrency(newBaseCode);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-20 relative">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="w-12 h-12 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <HiOutlineGlobeAlt size={28} />
          </div>
          <h1 className="text-3xl font-black dark:text-white tracking-tight">Currency Manager</h1>
          <p className="text-sm font-bold text-slate-500 max-w-lg">
            Configure your primary accounting currency and ticker favorites.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/5 flex items-center gap-4 shadow-xl">
          <div className={`p-3 rounded-xl ${isLocked ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}>
            {isLocked ? <HiOutlineLockClosed size={20} /> : <HiOutlineCheckCircle size={20} />}
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">
              Primary Base {isLocked && <span className="text-rose-500 ml-1">(LOCKED)</span>}
            </p>
            <p className="text-lg font-black dark:text-white">{baseCurrency}</p>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl w-full max-w-md">
        <button onClick={() => setActiveTab('base')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'base' ? 'bg-white dark:bg-slate-800 shadow-md text-blue-600' : 'text-slate-500'}`}>
          <HiOutlineGlobeAlt size={18} /> Primary Base
        </button>
        <button onClick={() => setActiveTab('watchlist')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'watchlist' ? 'bg-white dark:bg-slate-800 shadow-md text-emerald-600' : 'text-slate-500'}`}>
          <HiOutlineEye size={18} /> Ticker Watchlist
        </button>
      </div>

      {/* SEARCH & INFO */}
      <div className="space-y-4">
        <div className="relative">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Search currencies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 focus:border-blue-500 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold outline-none transition-all dark:text-white shadow-lg" />
        </div>
        
        <div className={`flex items-start gap-3 p-4 rounded-2xl border ${activeTab === 'base' && isLocked ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-500/20' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-500/20'}`}>
          {activeTab === 'base' && isLocked ? <HiOutlineLockClosed className="text-rose-500 shrink-0 mt-0.5" size={20} /> : <HiOutlineInformationCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />}
          <p className={`text-[11px] font-bold ${activeTab === 'base' && isLocked ? 'text-rose-800/80 dark:text-rose-200/80' : 'text-blue-800/80 dark:text-blue-200/80'}`}>
            {activeTab === 'base' 
              ? (isLocked ? "SECURITY LOCK: Base Currency is locked because you have active transactions. Delete all transactions to unlock." : "Choose carefully! Once you log a transaction, your Base Currency will be permanently locked.") 
              : "Select currencies for the NewsTicker. You can change these at any time."}
          </p>
        </div>
      </div>

      {/* CURRENCY GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
        {isCheckingLock ? (
           <div className="col-span-full py-10 text-center text-slate-500 font-bold animate-pulse">Checking Security Status...</div>
        ) : (
          filteredCurrencies.map((curr) => {
            const isBase = baseCurrency === curr.code;
            const isInWatchlist = selectedFiats.includes(curr.code);
            const isSelected = activeTab === 'base' ? isBase : isInWatchlist;
            const isDisabledBase = activeTab === 'base' && isLocked && !isBase;

            return (
              <button 
                key={curr.code} 
                onClick={() => activeTab === 'base' ? handleBaseCurrencyChange(curr.code) : handleWatchlistToggle(curr.code)} 
                disabled={isDisabledBase}
                className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-300 text-left 
                  ${isSelected 
                    ? (activeTab === 'base' ? 'bg-blue-600 border-blue-600 shadow-xl text-white' : 'bg-emerald-500 border-emerald-500 shadow-xl text-white') 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5'
                  }
                  ${isDisabledBase ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-blue-500/50'}
                `}
              >
                {/* 🚀 FLAG ICON RENDERER */}
                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800 shrink-0 shadow-inner border border-slate-200 dark:border-slate-700">
                  <img 
                    src={`https://flagcdn.com/w80/${curr.iconId}.png`} 
                    alt={curr.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'; // If image fails, emoji shows behind or instead
                    }}
                  />
                  {/* Emoji as fallback if img fails */}
                  <span className="absolute text-2xl z-[-1]">{curr.flag}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black tracking-tight truncate">{curr.code}</h3>
                    <span className={`text-[10px] font-black opacity-60 ${isSelected ? 'text-white' : ''}`}>
                      {curr.symbol}
                    </span>
                  </div>
                  <p className={`text-[10px] font-bold truncate ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                    {curr.name}
                  </p>
                </div>

                {isSelected && <HiOutlineCheckCircle size={20} className="shrink-0" />}
                {isDisabledBase && <HiOutlineLockClosed size={16} className="text-slate-400 absolute right-4" />}
              </button>
            );
          })
        )}
      </div>

      {/* FOOTER ACTION */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[200]">
        <button onClick={() => navigate('/dashboard')} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black text-sm shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
          Done & Go to Dashboard
        </button>
      </div>

    </div>
  );
};
export default SetCurrency;