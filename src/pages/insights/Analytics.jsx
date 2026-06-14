// src/pages/Analytics.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { collection, query } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';

// ✅ IMPORTING ENTERPRISE HOOKS
import { useCryptoPrice } from '../../context/CryptoPriceContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useSecureSnapshot } from '../../hooks/useSecureSnapshot';
import { safeParseFloat } from '../../utils/safeMath';

import { 
  HiOutlineChartPie, HiOutlineTrendingUp, HiOutlineTrendingDown, 
  HiOutlineRefresh, HiOutlineArrowUp, HiOutlineArrowDown,
  HiOutlineCalendar, HiOutlineLightningBolt, HiOutlineChevronDown, 
  HiOutlineChevronUp, HiOutlineClock
} from 'react-icons/hi';
import { 
  FaWallet, FaPiggyBank, FaChartLine, FaChartBar, FaChartPie,
  FaMoneyBillWave, FaCoins, FaPercentage, FaArrowUp, FaArrowDown,
  FaLayerGroup
} from 'react-icons/fa';

// ============================================
// 🎨 PREMIUM DESIGN SYSTEM
// ============================================
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];
const GRADIENTS = {
  income: 'from-emerald-400 via-emerald-500 to-teal-600',
  expense: 'from-rose-400 via-rose-500 to-pink-600',
  savings: 'from-violet-500 via-indigo-500 to-blue-600',
  glow: {
    income: 'shadow-emerald-500/30',
    expense: 'shadow-rose-500/30',
    savings: 'shadow-indigo-500/30',
  }
};

// ============================================
// 🚀 ANIMATED COUNTER HOOK
// ============================================
const useCountUp = (targetValue, duration = 1200, shouldAnimate = true) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayValue(targetValue);
      return;
    }
    
    let startTime = null;
    const startValue = displayValue;
    const diff = targetValue - startValue;
    
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplayValue(startValue + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }, [targetValue, shouldAnimate, duration]);
  
  return displayValue;
};

// ============================================
// ✨ PREMIUM KPI CARD (MOBILE-FIRST)
// ============================================
const PremiumKPICard = ({ 
  icon: Icon, label, value, rawValue, subValue, gradient, glowClass, 
  isPositive, isCurrency, currencySymbol, accentColor, onClick 
}) => {
  const animatedValue = useCountUp(rawValue || 0, 1500);
  const formattedValue = isCurrency 
    ? `${currencySymbol}${Math.round(animatedValue).toLocaleString()}`
    : animatedValue.toLocaleString(undefined, { maximumFractionDigits: 1 });

  return (
    <div 
      onClick={onClick}
      className={`
        group relative overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] 
        bg-white dark:bg-slate-900/90
        border border-slate-200/60 dark:border-slate-700/40
        shadow-lg hover:shadow-2xl ${glowClass || ''}
        transition-all duration-500 ease-out
        hover:-translate-y-1.5 active:scale-[0.98] cursor-pointer
        p-4 sm:p-5 lg:p-6
        backdrop-blur-xl
      `}
    >
      <div className="absolute inset-0 rounded-[1.75rem] sm:rounded-[2.25rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}08, transparent 70%)` }}
      />
      <div 
        className="absolute top-0 left-4 right-4 h-[3px] rounded-full opacity-70 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <div 
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Icon size={16} className="sm:w-[18px] sm:h-[18px]" style={{ color: accentColor }} />
            </div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {label}
            </span>
          </div>
          
          <div className="relative">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }}>
              <div 
                className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-40"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-2 sm:mb-3 truncate">
          {formattedValue}
        </h2>

        {subValue && (
          <div className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 
            rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider
            transition-all duration-300 group-hover:shadow-md
            ${isPositive 
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20' 
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20'
            }
          `}>
            {isPositive ? <FaArrowUp size={8} className="shrink-0" /> : <FaArrowDown size={8} className="shrink-0" />}
            <span className="truncate">{subValue}</span>
          </div>
        )}
      </div>
      
      <div 
        className="absolute -bottom-6 -right-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full opacity-[0.06] group-hover:opacity-[0.12] transition-all duration-500 group-hover:scale-150 pointer-events-none blur-xl"
        style={{ backgroundColor: accentColor }}
      />
    </div>
  );
};

// ============================================
// 📊 PREMIUM CHART CARD
// ============================================
const PremiumChartCard = ({ title, icon: Icon, subtitle, children, isEmpty, accentColor, badge }) => (
  <div className={`
    bg-white dark:bg-slate-900/90 
    border border-slate-200/60 dark:border-slate-700/40
    rounded-[2rem] sm:rounded-[2.5rem] 
    p-4 sm:p-6 lg:p-7 
    shadow-lg hover:shadow-xl 
    transition-all duration-400 
    flex flex-col min-w-0 h-full
    backdrop-blur-xl
    relative overflow-hidden
  `}>
    <div 
      className="absolute top-0 left-6 right-6 h-[2px] rounded-full opacity-50"
      style={{ background: `linear-gradient(90deg, transparent, ${accentColor || '#6366f1'}, transparent)` }}
    />

    <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div 
          className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-transform duration-300 hover:scale-110"
          style={{ backgroundColor: `${accentColor || '#6366f1'}12` }}
        >
          <Icon size={16} className="sm:w-[18px] sm:h-[18px]" style={{ color: accentColor || '#6366f1' }} />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm lg:text-base font-black text-slate-800 dark:text-white uppercase tracking-wider truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {badge && (
        <span className="shrink-0 text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          {badge}
        </span>
      )}
    </div>
    
    <div className="flex-1 w-full min-h-[220px] sm:min-h-[280px] lg:min-h-[300px] relative">
      {isEmpty ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30">
          <FaChartBar size={32} className="mb-3 opacity-25 sm:w-10 sm:h-10" />
          <p className="text-xs sm:text-sm font-black uppercase tracking-widest">Insufficient data</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-1">Add transactions to see trends</p>
        </div>
      ) : children}
    </div>
  </div>
);

// ============================================
// 🔧 CUSTOM TOOLTIP
// ============================================
const PremiumTooltip = ({ active, payload, label, currencySymbol }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/98 dark:bg-slate-800/98 backdrop-blur-2xl text-white p-4 sm:p-5 rounded-2xl border border-slate-700/40 shadow-2xl z-50 min-w-[140px]">
        <p className="font-black text-[9px] sm:text-[10px] mb-3 text-slate-400 uppercase tracking-widest border-b border-slate-700/40 pb-2">
          {label}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shadow-md" style={{ backgroundColor: entry.color }} />
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-300">{entry.name}</span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-black tracking-tight" style={{ color: entry.color }}>
              {currencySymbol}{entry.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ============================================
// 📱 EXPENSE BREAKDOWN CARD
// ============================================
const ExpenseBreakdownCard = ({ categories, currencySymbol, colors }) => {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? categories : categories.slice(0, 4);
  const maxVal = categories[0]?.value || 1;

  return (
    <div className="space-y-3 sm:space-y-4">
      {displayItems.map((cat, idx) => {
        const pct = (cat.value / maxVal) * 100;
        const color = colors[idx % colors.length];
        
        return (
          <div key={idx} className="group/cat">
            <div className="flex justify-between items-center mb-1.5 sm:mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span 
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[55%] sm:max-w-[60%]">
                  {cat.name}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs font-black text-slate-900 dark:text-white shrink-0 ml-2">
                {currencySymbol}{cat.value.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </span>
            </div>
            <div className="w-full h-2 sm:h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ animationDuration: '2s' }} />
              </div>
            </div>
          </div>
        );
      })}
      
      {categories.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          {expanded ? (
            <>Show Less <HiOutlineChevronUp size={14} /></>
          ) : (
            <>Show All {categories.length} Categories <HiOutlineChevronDown size={14} /></>
          )}
        </button>
      )}
    </div>
  );
};

// ============================================
// 🏗️ SKELETON LOADER
// ============================================
const PremiumSkeleton = () => (
  <div className="pt-20 sm:pt-24 space-y-5 sm:space-y-8 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      <div className="space-y-2">
        <div className="h-7 sm:h-8 w-44 sm:w-52 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-3.5 w-64 sm:w-72 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {[1,2,3].map(i => (
        <div key={i} className="h-32 sm:h-36 lg:h-40 bg-slate-200 dark:bg-slate-800 rounded-[1.75rem] sm:rounded-[2.25rem]" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <div className="lg:col-span-2 h-[320px] sm:h-[380px] lg:h-[420px] bg-slate-200 dark:bg-slate-800 rounded-[2rem] sm:rounded-[2.5rem]" />
      <div className="h-[320px] sm:h-[380px] lg:h-[420px] bg-slate-200 dark:bg-slate-800 rounded-[2rem] sm:rounded-[2.5rem]" />
    </div>
  </div>
);

// ============================================
// 🚀 MAIN ANALYTICS COMPONENT
// ============================================
const Analytics = () => {
  const { user, baseCurrency = 'USD', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const navigate = useNavigate();

  const [activeMobileTab, setActiveMobileTab] = useState('overview'); 
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Unified Dashboard Hook (Incomes & Expenses)
  const [dashboardData, setDashboardData] = useState({
    rawIncomes: [], rawExpenses: [],
    incomeTotal: 0, expenseTotal: 0,
  });
  const { loading: dataLoading } = useDashboardData(user, setDashboardData);

  // 2. Enterprise Math Engine (Wallet Summaries O(1) Fetching)
  const summaryQuery = useMemo(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'walletSummary'));
  }, [user?.uid]);

  const { data: summaryDocs, loading: summariesLoading } = useSecureSnapshot(summaryQuery);

  const bankSummary = summaryDocs?.find(s => s.id === 'bank');
  const cashSummary = summaryDocs?.find(s => s.id === 'cash');
  const onlineSummary = summaryDocs?.find(s => s.id === 'online');
  const cryptoSummary = summaryDocs?.find(s => s.id === 'crypto');

  // Vault Balances
  const finalBankTotal = bankSummary?.totalBalance || 0;
  const finalCashTotal = cashSummary?.totalBalance || 0;
  const finalOnlineTotal = onlineSummary?.totalBalance || 0;

  // 3. Crypto Live Price Context
  const { livePrices, fiatRate } = useCryptoPrice();

  // O(1) Crypto Live Value Calculation directly from Summary Engine
  const totalCryptoLiveValue = useMemo(() => {
    if (!cryptoSummary?.holdings) return 0;
    return Object.entries(cryptoSummary.holdings).reduce((sum, [coin, data]) => {
      if (data.total <= 0.00000001) return sum;
      const priceUSD = safeParseFloat(livePrices[coin.toUpperCase()]?.priceUSD);
      return sum + (data.total * priceUSD * fiatRate);
    }, 0);
  }, [cryptoSummary, livePrices, fiatRate]);

  // 4. Metrics & Charts Data Generation
  const { metrics, cashFlowData, assetAllocation, expenseCategories } = useMemo(() => {
    let tIncome = 0;
    let tExpense = 0;
    const monthlyData = {};
    const expCatMap = {};

    // Process Incomes
    dashboardData.rawIncomes.forEach(data => {
      const amt = safeParseFloat(data.finalBaseAmount || data.amount) || 0;
      tIncome += amt;
      const dateObj = new Date(data.date || new Date());
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { sortKey, monthName, Income: 0, Expense: 0 };
      monthlyData[sortKey].Income += amt;
    });

    // Process Expenses
    dashboardData.rawExpenses.forEach(data => {
      const amt = safeParseFloat(data.finalBaseAmount || data.amount) || 0;
      tExpense += amt;
      const dateObj = new Date(data.date || new Date());
      const monthName = formatGlobalDate ? formatGlobalDate(dateObj, 'monthYear') : dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { sortKey, monthName, Income: 0, Expense: 0 };
      monthlyData[sortKey].Expense += amt;

      const cat = data.category || 'Other';
      expCatMap[cat] = (expCatMap[cat] || 0) + amt;
    });

    // Finalize Cashflow Chart Data
    const sortedCashFlow = Object.values(monthlyData)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-6)
      .map(item => ({ name: item.monthName, Income: Math.round(item.Income * 100) / 100, Expense: Math.round(item.Expense * 100) / 100 }));

    // Finalize Asset Allocation
    const realAssetAllocation = [
      { name: 'Bank Vault', value: Math.max(0, Math.round(finalBankTotal * 100) / 100) },
      { name: 'Physical Cash', value: Math.max(0, Math.round(finalCashTotal * 100) / 100) },
      { name: 'Digital Wallets', value: Math.max(0, Math.round(finalOnlineTotal * 100) / 100) },
      { name: 'Crypto Portfolio', value: Math.max(0, Math.round(totalCryptoLiveValue * 100) / 100) }
    ].filter(asset => asset.value > 0);

    // Finalize Expense Categories
    const expCategories = Object.entries(expCatMap)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      metrics: { totalIncome: tIncome, totalExpense: tExpense, netSavings: tIncome - tExpense },
      cashFlowData: sortedCashFlow,
      assetAllocation: realAssetAllocation,
      expenseCategories: expCategories
    };
  }, [dashboardData.rawIncomes, dashboardData.rawExpenses, finalBankTotal, finalCashTotal, finalOnlineTotal, totalCryptoLiveValue, formatGlobalDate]);

  const savingsRate = metrics.totalIncome > 0 ? ((metrics.netSavings / metrics.totalIncome) * 100).toFixed(1) : 0;
  const expenseRatio = metrics.totalIncome > 0 ? ((metrics.totalExpense / metrics.totalIncome) * 100).toFixed(1) : 0;

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  // Show skeleton while loading primary data
  if (dataLoading || summariesLoading) return <PremiumSkeleton />;

  return (
    <div className="pt-20 sm:pt-24 space-y-4 sm:space-y-6 lg:space-y-8 pb-28 sm:pb-32 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">
      
      {/* 🚀 PREMIUM HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative">
            <div className="p-3 sm:p-3.5 lg:p-4 bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 rounded-2xl sm:rounded-[1.75rem] shadow-xl shadow-indigo-500/30 ring-1 ring-white/10">
              <HiOutlineChartPie size={22} className="text-white sm:w-[26px] sm:h-[26px]" />
            </div>
            <div className="absolute -inset-1 rounded-2xl sm:rounded-[1.75rem] border-2 border-indigo-400/20 animate-ping pointer-events-none" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Analytics Center
            </h1>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
              Real-time financial intelligence & wealth insights
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button 
            onClick={handleRefresh}
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 active:scale-95 ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <HiOutlineRefresh size={16} className="sm:w-[18px] sm:h-[18px] text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <HiOutlineCalendar size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">
              {formatGlobalDate ? formatGlobalDate(new Date().toISOString(), 'full') : new Date().toLocaleDateString()}
            </span>
            <span className="xs:hidden">
              {formatGlobalDate ? formatGlobalDate(new Date().toISOString(), 'short') : new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* 📱 MOBILE TAB NAVIGATION */}
      <div className="lg:hidden flex gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto hide-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: FaLayerGroup },
          { id: 'cashflow', label: 'Cash Flow', icon: FaChartBar },
          { id: 'allocation', label: 'Allocation', icon: FaChartPie },
          { id: 'expenses', label: 'Expenses', icon: FaMoneyBillWave },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveMobileTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider
              transition-all duration-300 flex-1 justify-center min-w-fit
              ${activeMobileTab === tab.id 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md shadow-indigo-500/10' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }
            `}
          >
            <tab.icon size={13} className="sm:w-[14px] sm:h-[14px]" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 💎 KPI CARDS */}
      <div className={`
        grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5
        ${activeMobileTab !== 'overview' ? 'hidden lg:grid' : ''}
      `}>
        <PremiumKPICard
          icon={FaArrowUp}
          label="Lifetime Income"
          rawValue={metrics.totalIncome}
          value={`${currencySymbol}${metrics.totalIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
          gradient={GRADIENTS.income}
          glowClass={GRADIENTS.glow.income}
          isCurrency={true}
          currencySymbol={currencySymbol}
          subValue={`${savingsRate}% Saved`}
          isPositive={true}
          accentColor="#10b981"
        />
        <PremiumKPICard
          icon={FaArrowDown}
          label="Lifetime Expenses"
          rawValue={metrics.totalExpense}
          value={`${currencySymbol}${metrics.totalExpense.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
          gradient={GRADIENTS.expense}
          glowClass={GRADIENTS.glow.expense}
          isCurrency={true}
          currencySymbol={currencySymbol}
          subValue={`${expenseRatio}% Burn Rate`}
          isPositive={false}
          accentColor="#ef4444"
        />
        <PremiumKPICard
          icon={FaPiggyBank}
          label="Net Savings"
          rawValue={metrics.netSavings}
          value={`${currencySymbol}${Math.abs(metrics.netSavings).toLocaleString(undefined, {maximumFractionDigits: 0})}`}
          gradient={metrics.netSavings >= 0 ? GRADIENTS.savings : GRADIENTS.expense}
          glowClass={metrics.netSavings >= 0 ? GRADIENTS.glow.savings : GRADIENTS.glow.expense}
          isCurrency={true}
          currencySymbol={currencySymbol}
          subValue={metrics.netSavings >= 0 ? "Positive Cashflow" : "Negative Cashflow"}
          isPositive={metrics.netSavings >= 0}
          accentColor={metrics.netSavings >= 0 ? '#6366f1' : '#ef4444'}
        />
      </div>

      {/* 📊 CHARTS SECTION */}
      <div className={`
        grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6
        ${activeMobileTab !== 'cashflow' && activeMobileTab !== 'allocation' ? 'hidden lg:grid' : ''}
        ${activeMobileTab === 'expenses' ? 'hidden lg:grid' : ''}
      `}>
        {/* Cash Flow Bar Chart */}
        <div className={`${activeMobileTab === 'allocation' ? 'hidden lg:block' : ''} lg:col-span-2`}>
          <PremiumChartCard 
            title="Cash Flow Analysis" 
            icon={FaChartBar}
            subtitle="6-month income vs expenses trend"
            isEmpty={cashFlowData.length === 0}
            accentColor="#6366f1"
            badge="Monthly"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.15} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.15} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} tickFormatter={(val) => `${currencySymbol}${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}`} width={45} />
                <Tooltip content={<PremiumTooltip currencySymbol={currencySymbol} />} cursor={{ fill: '#94a3b8', opacity: 0.04 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, paddingTop: '12px' }} />
                <Bar dataKey="Income" fill="url(#incomeGrad)" radius={[6, 6, 0, 0]} maxBarSize={44} animationDuration={1400} />
                <Bar dataKey="Expense" fill="url(#expenseGrad)" radius={[6, 6, 0, 0]} maxBarSize={44} animationDuration={1400} />
              </BarChart>
            </ResponsiveContainer>
          </PremiumChartCard>
        </div>

        {/* Asset Allocation Pie Chart */}
        <div className={`${activeMobileTab === 'cashflow' ? 'hidden lg:block' : ''}`}>
          <PremiumChartCard 
            title="Portfolio Allocation" 
            icon={FaChartPie}
            subtitle="Cross-vault wealth distribution"
            isEmpty={assetAllocation.length === 0}
            accentColor="#f59e0b"
            badge="Live"
          >
            <ResponsiveContainer width="100%" height="55%">
              <PieChart>
                <Pie data={assetAllocation} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none" animationDuration={1200} animationBegin={200}>
                  {assetAllocation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer drop-shadow-lg" />
                  ))}
                </Pie>
                <Tooltip content={<PremiumTooltip currencySymbol={currencySymbol} />} />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mt-2">
              {assetAllocation.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-1.5 p-1.5 sm:p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg sm:rounded-xl">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{item.name}</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-900 dark:text-white shrink-0">
                    {item.value.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </span>
                </div>
              ))}
            </div>
          </PremiumChartCard>
        </div>
      </div>

      {/* 💸 EXPENSE BREAKDOWN */}
      <div className={`
        grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6
        ${activeMobileTab !== 'expenses' && activeMobileTab !== 'overview' ? 'hidden lg:grid' : ''}
      `}>
        {expenseCategories.length > 0 && (
          <PremiumChartCard 
            title="Top Expense Categories" 
            icon={FaMoneyBillWave}
            subtitle="Where your money flows"
            isEmpty={false}
            accentColor="#ef4444"
            badge={`${expenseCategories.length} Categories`}
          >
            <ExpenseBreakdownCard categories={expenseCategories} currencySymbol={currencySymbol} colors={COLORS} />
          </PremiumChartCard>
        )}
        
        {/* Summary insights card */}
        <PremiumChartCard 
          title="Quick Insights" 
          icon={HiOutlineLightningBolt}
          subtitle="At-a-glance financial health"
          isEmpty={false}
          accentColor="#8b5cf6"
        >
          <div className="space-y-3 sm:space-y-4 pt-1">
            {[
              { 
                label: 'Monthly Savings Rate', 
                value: `${savingsRate}%`, 
                icon: FaPercentage,
                color: parseFloat(savingsRate) >= 20 ? '#10b981' : parseFloat(savingsRate) >= 0 ? '#f59e0b' : '#ef4444',
                subtext: parseFloat(savingsRate) >= 20 ? 'Excellent' : parseFloat(savingsRate) >= 0 ? 'Fair' : 'Critical'
              },
              { 
                label: 'Crypto Exposure', 
                value: `${assetAllocation.find(a => a.name === 'Crypto Portfolio') ? 
                  ((assetAllocation.find(a => a.name === 'Crypto Portfolio').value / 
                  assetAllocation.reduce((sum, a) => sum + a.value, 0)) * 100).toFixed(1) : 0}%`, 
                icon: FaCoins,
                color: '#6366f1',
                subtext: 'Of total portfolio'
              },
              { 
                label: 'Total Vaults Active', 
                value: assetAllocation.length.toString(), 
                icon: FaWallet,
                color: '#06b6d4',
                subtext: 'Diversified storage'
              },
            ].map((insight, idx) => (
              <div key={idx} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                <div className="p-2 sm:p-2.5 rounded-xl" style={{ backgroundColor: `${insight.color}15` }}>
                  <insight.icon size={16} className="sm:w-[18px] sm:h-[18px]" style={{ color: insight.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-slate-900 dark:text-white">{insight.value}</p>
                  <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400">{insight.label}</p>
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-lg shrink-0" style={{ backgroundColor: `${insight.color}12`, color: insight.color }}>
                  {insight.subtext}
                </span>
              </div>
            ))}
          </div>
        </PremiumChartCard>
      </div>

      {/* 🔮 PREMIUM FOOTER */}
      <div className="text-center py-5 sm:py-6 px-4 sm:px-6 bg-white dark:bg-slate-900/90 rounded-[2rem] border border-slate-200/60 dark:border-slate-700/40 shadow-lg mt-6 sm:mt-8 backdrop-blur-xl">
        <p className="text-[9px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 flex-wrap uppercase tracking-widest">
          <HiOutlineLightningBolt className="text-indigo-500" size={14} />
          Real-time analytics powered by cross-vault transaction data
          <span className="text-indigo-500 hidden sm:inline">•</span>
          <span className="hidden sm:inline">Auto-updates dynamically</span>
          <HiOutlineClock className="text-slate-400 hidden sm:inline" size={12} />
        </p>
      </div>

      <div className="h-4 lg:hidden" />
    </div>
  );
};

export default Analytics;