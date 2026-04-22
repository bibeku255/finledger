import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { 
  HiOutlineSearch, HiOutlineCheckCircle, HiOutlineGlobeAlt, 
  HiOutlineEye, HiOutlineInformationCircle, HiOutlineLockClosed,
  HiOutlineChevronRight, HiOutlineXCircle, HiOutlineCheck, HiOutlineRefresh,
  HiOutlineShieldCheck
} from 'react-icons/hi';
import { FaCrown, FaGlobeAmericas } from 'react-icons/fa';

const currenciesList = [
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States', flag: '🇺🇸', iconId: 'us', region: 'Americas' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'Canada', flag: '🇨🇦', iconId: 'ca', region: 'Americas' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', country: 'Mexico', flag: '🇲🇽', iconId: 'mx', region: 'Americas' },
  { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee', country: 'Nepal', flag: '🇳🇵', iconId: 'np', region: 'Asia' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'India', flag: '🇮🇳', iconId: 'in', region: 'Asia' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', country: 'Pakistan', flag: '🇵🇰', iconId: 'pk', region: 'Asia' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', country: 'Bangladesh', flag: '🇧🇩', iconId: 'bd', region: 'Asia' },
  { code: 'LKR', symbol: 'රු', name: 'Sri Lankan Rupee', country: 'Sri Lanka', flag: '🇱🇰', iconId: 'lk', region: 'Asia' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', country: 'United Arab Emirates', flag: '🇦🇪', iconId: 'ae', region: 'Middle East' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', country: 'Saudi Arabia', flag: '🇸🇦', iconId: 'sa', region: 'Middle East' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', country: 'Qatar', flag: '🇶🇦', iconId: 'qa', region: 'Middle East' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', country: 'Kuwait', flag: '🇰🇼', iconId: 'kw', region: 'Middle East' },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial', country: 'Oman', flag: '🇴🇲', iconId: 'om', region: 'Middle East' },
  { code: 'BHD', symbol: 'ب.د', name: 'Bahraini Dinar', country: 'Bahrain', flag: '🇧🇭', iconId: 'bh', region: 'Middle East' },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'Eurozone', flag: '🇪🇺', iconId: 'eu', region: 'Europe' },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom', flag: '🇬🇧', iconId: 'gb', region: 'Europe' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'Japan', flag: '🇯🇵', iconId: 'jp', region: 'Asia' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'Australia', flag: '🇦🇺', iconId: 'au', region: 'Oceania' },
];

const regions = ['All', 'Americas', 'Europe', 'Asia', 'Middle East', 'Oceania'];

// 🚀 Premium Currency Card Component
const CurrencyCard = ({ currency, isSelected, isDisabled, onClick, mode }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  return (
    <button 
      onClick={onClick} 
      disabled={isDisabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all duration-300 text-left overflow-hidden
        ${isSelected 
          ? `bg-gradient-to-br ${mode === 'base' ? 'from-blue-600 to-cyan-600 border-blue-400' : 'from-emerald-600 to-teal-600 border-emerald-400'} shadow-xl scale-[1.02]` 
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
      `}
    >
      {/* Background Glow Effect */}
      {!isDisabled && (
        <div className={`absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
          ${mode === 'base' ? 'from-blue-500/5 to-cyan-500/5' : 'from-emerald-500/5 to-teal-500/5'}`} 
        />
      )}

      {/* Flag Container */}
      <div className="relative shrink-0">
        <div className={`absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500
          ${mode === 'base' ? 'bg-blue-500' : 'bg-emerald-500'}`} 
        />
        <div className={`relative w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg border-2 transition-all duration-300
          ${isSelected 
            ? 'border-white/30 shadow-xl' 
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 dark:group-hover:border-blue-500'
          }`}
        >
          {!imageLoaded && (
            <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse" />
          )}
          <img 
            src={`https://flagcdn.com/w80/${currency.iconId}.png`} 
            alt={currency.name}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span className="absolute text-3xl z-[-1]">{currency.flag}</span>
        </div>
      </div>

      {/* Currency Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`font-black text-lg tracking-tight truncate ${isSelected ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
            {currency.code}
          </h3>
          <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
            isSelected 
              ? 'bg-white/20 text-white' 
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
          }`}>
            {currency.symbol}
          </span>
        </div>
        <p className={`text-[11px] font-bold truncate ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
          {currency.name}
        </p>
        <p className={`text-[9px] font-medium mt-1 ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
          {currency.country}
        </p>
      </div>

      {/* Selection Indicator */}
      <div className="shrink-0">
        {isSelected ? (
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <HiOutlineCheck size={18} className="text-white" />
          </div>
        ) : isDisabled ? (
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <HiOutlineLockClosed size={16} className="text-slate-500" />
          </div>
        ) : (
          <div className={`w-8 h-8 rounded-full border-2 border-dashed transition-all duration-300 flex items-center justify-center
            ${mode === 'base' 
              ? 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20' 
              : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20'
            }`}
          >
            <HiOutlineChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity
              ${mode === 'base' ? 'text-blue-500' : 'text-emerald-500'}`} 
            />
          </div>
        )}
      </div>

      {/* Decorative Corner */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-white/20 rounded-full blur-md" />
      )}
    </button>
  );
};

// 🚀 Premium Stat Badge Component
const StatBadge = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r ${color}`}>
    <Icon size={16} className="text-white/80" />
    <div>
      <p className="text-[8px] font-black text-white/60 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  </div>
);

const SetCurrency = () => {
  const { user, baseCurrency, updateBaseCurrency, selectedFiats = ['USD', 'INR'], updateSelectedFiats } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('base'); 
  const [isLocked, setIsLocked] = useState(false);
  const [isCheckingLock, setIsCheckingLock] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('All');
  
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
    (c) => (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           c.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.code.toLowerCase().includes(searchQuery.toLowerCase())) &&
           (selectedRegion === 'All' || c.region === selectedRegion)
  );

  const handleWatchlistToggle = async (code) => {
    const newList = selectedFiats.includes(code) ? selectedFiats.filter(f => f !== code) : [...selectedFiats, code];
    if(updateSelectedFiats) await updateSelectedFiats(newList);
  };

  const handleBaseCurrencyChange = async (newBaseCode) => {
    if (isLocked) {
      alert("⚠️ Base Currency is locked because you have active transactions in your ledger. Delete all transactions to unlock.");
      return;
    }
    if (newBaseCode === baseCurrency) return; 
    await updateBaseCurrency(newBaseCode);
  };

  const baseCurrencyData = currenciesList.find(c => c.code === baseCurrency);

  return (
    <div className="w-full h-auto pb-24">
      <div className="pt-8 md:pt-12 max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(59,130,246,0.15),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <FaGlobeAmericas size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    Currency Manager
                    {isLocked && (
                      <span className="px-2 py-1 bg-rose-500/20 text-rose-300 text-[10px] font-black rounded-lg border border-rose-500/30">
                        LOCKED
                      </span>
                    )}
                  </h1>
                  <p className="text-sm font-medium text-slate-400">
                    Configure your primary accounting currency and market ticker
                  </p>
                </div>
              </div>
            </div>
            
            {/* Current Base Currency Display */}
            <div className="flex items-center gap-3">
              <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm">
                <div className="flex items-center gap-3">
                  {baseCurrencyData && (
                    <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white/20">
                      <img 
                        src={`https://flagcdn.com/w80/${baseCurrencyData.iconId}.png`}
                        alt={baseCurrencyData.code}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Primary Currency</p>
                    <p className="text-xl font-black text-white">{baseCurrency} {baseCurrencyData?.symbol}</p>
                  </div>
                </div>
              </div>
              
              {!isLocked && (
                <div className="bg-emerald-500/20 p-2 rounded-full">
                  <HiOutlineCheckCircle size={24} className="text-emerald-400" />
                </div>
              )}
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="relative z-10 flex flex-wrap gap-3 mt-6">
            <StatBadge 
              icon={HiOutlineGlobeAlt} 
              label="Available Currencies" 
              value={currenciesList.length} 
              color="from-blue-500/30 to-cyan-500/30"
            />
            <StatBadge 
              icon={HiOutlineEye} 
              label="Watchlist Items" 
              value={selectedFiats.length} 
              color="from-emerald-500/30 to-teal-500/30"
            />
            <StatBadge 
              icon={HiOutlineShieldCheck} 
              label="Status" 
              value={isLocked ? 'Locked' : 'Editable'} 
              color={isLocked ? 'from-rose-500/30 to-pink-500/30' : 'from-amber-500/30 to-orange-500/30'}
            />
          </div>
        </div>

        {/* Premium Tabs */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 backdrop-blur-sm rounded-2xl w-full sm:w-auto shadow-sm">
            <button 
              onClick={() => setActiveTab('base')} 
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === 'base' 
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FaCrown size={16} /> Primary Base
            </button>
            <button 
              onClick={() => setActiveTab('watchlist')} 
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === 'watchlist' 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <HiOutlineEye size={16} /> Watchlist
            </button>
          </div>
          
          {/* Region Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {regions.map(region => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
                  selectedRegion === region
                    ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-md border-transparent'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder={`Search ${activeTab === 'base' ? 'base currency' : 'watchlist'} options...`}
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 rounded-2xl py-4 pl-14 pr-12 text-sm font-bold outline-none transition-all text-slate-900 dark:text-white shadow-sm placeholder-slate-400 dark:placeholder-slate-500" 
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <HiOutlineXCircle size={18} />
            </button>
          )}
        </div>

        {/* Info Alert */}
        <div className={`flex items-start gap-4 p-5 rounded-2xl border-2 transition-all shadow-sm ${
          activeTab === 'base' && isLocked 
            ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-500/30' 
            : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-500/30'
        }`}>
          <div className={`p-2 rounded-xl ${
            activeTab === 'base' && isLocked 
              ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' 
              : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
          }`}>
            {activeTab === 'base' && isLocked 
              ? <HiOutlineLockClosed size={20} /> 
              : <HiOutlineInformationCircle size={20} />
            }
          </div>
          <div className="flex-1">
            <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
              activeTab === 'base' && isLocked ? 'text-rose-700 dark:text-rose-400' : 'text-blue-700 dark:text-blue-400'
            }`}>
              {activeTab === 'base' && isLocked ? 'Security Lock Active' : 'Important Information'}
            </p>
            <p className={`text-sm font-bold ${
              activeTab === 'base' && isLocked 
                ? 'text-rose-800 dark:text-rose-300' 
                : 'text-blue-800 dark:text-blue-300'
            }`}>
              {activeTab === 'base' 
                ? (isLocked 
                    ? "Your Base Currency is locked because you have active transactions in your ledger. To change it, you must first delete all transactions across all vaults." 
                    : "Choose your primary accounting currency carefully! Once you log your first transaction, this setting will be permanently locked to maintain financial integrity.")
                : "Add currencies to your watchlist to track them in the NewsTicker and Live Market Portfolio. You can modify this list at any time."}
            </p>
          </div>
        </div>

        {/* Currency Grid */}
        {isCheckingLock ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
              <HiOutlineRefresh className="animate-spin text-4xl text-blue-500 relative" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-4 animate-pulse">
              Checking Security Status...
            </p>
          </div>
        ) : filteredCurrencies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <HiOutlineSearch className="text-4xl text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">No currencies found</p>
            <p className="text-xs text-slate-500 mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
            {filteredCurrencies.map((curr) => {
              const isBase = baseCurrency === curr.code;
              const isInWatchlist = selectedFiats.includes(curr.code);
              const isSelected = activeTab === 'base' ? isBase : isInWatchlist;
              const isDisabledBase = activeTab === 'base' && isLocked && !isBase;

              return (
                <CurrencyCard
                  key={curr.code}
                  currency={curr}
                  isSelected={isSelected}
                  isDisabled={isDisabledBase}
                  onClick={() => activeTab === 'base' ? handleBaseCurrencyChange(curr.code) : handleWatchlistToggle(curr.code)}
                  mode={activeTab}
                />
              );
            })}
          </div>
        )}

        {/* Floating Action Button */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="w-full px-8 py-5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 rounded-full font-black text-sm uppercase tracking-widest shadow-2xl shadow-slate-900/30 dark:shadow-slate-400/30 transition-all active:scale-95 flex items-center justify-center gap-3 border border-slate-700 dark:border-slate-300"
          >
            <HiOutlineCheckCircle size={20} />
            Save & Return to Dashboard
            <HiOutlineChevronRight size={16} className="opacity-60" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default SetCurrency;