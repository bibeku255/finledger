import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  HiOutlineLightBulb, HiOutlineShieldCheck, HiOutlineTrendingUp, 
  HiOutlineExclamation, HiOutlineChartPie, HiOutlineRefresh,
  HiOutlineArrowRight, HiOutlineAdjustments
} from 'react-icons/hi';
import { FaBrain, FaRobot, FaLeaf, FaWallet, FaChartLine } from 'react-icons/fa';

const AiStrategy = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'USD', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  // 🚀 Simulated AI Analysis Data (In future, this will be calculated from Firebase)
  const [strategyData, setStrategyData] = useState(null);

  useEffect(() => {
    // Simulate AI thinking and analyzing vaults
    const timer = setTimeout(() => {
      setStrategyData({
        optimizationScore: 72, // Out of 100
        riskLevel: 'Moderate', // Safe, Moderate, High
        allocations: {
          fiat: 25,     // Bank & Cash
          crypto: 55,   // Holding Crypto
          yield: 20     // Staked/Farming
        },
        actionPlan: [
          {
            id: 1,
            type: 'opportunity',
            icon: <HiOutlineTrendingUp className="text-emerald-500" />,
            title: "Rebalance Idle Cash",
            desc: `You have ${currencySymbol}1,250 sitting idle in your Bank Vault. Allocating 40% of this to a stablecoin yield farm could generate approx ${currencySymbol}45/year passively.`,
            actionText: "Explore Vaults",
            color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
            borderColor: 'border-emerald-200 dark:border-emerald-800'
          },
          {
            id: 2,
            type: 'risk',
            icon: <HiOutlineExclamation className="text-rose-500" />,
            title: "High Crypto Volatility",
            desc: "Your portfolio is heavily weighted (55%) in volatile digital assets. Consider booking 10-15% profit on your top performer (BNB) and moving it to Fiat or Stablecoins to reduce risk.",
            actionText: "Review Assets",
            color: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
            borderColor: 'border-rose-200 dark:border-rose-800'
          },
          {
            id: 3,
            type: 'health',
            icon: <HiOutlineShieldCheck className="text-blue-500" />,
            title: "Excellent Savings Rate",
            desc: "Your income-to-expense ratio this month is extremely healthy. You've saved 68% of your inflows. Keep this up to reach your financial independence goal 2 years early.",
            actionText: "View Analytics",
            color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
            borderColor: 'border-blue-200 dark:border-blue-800'
          }
        ]
      });
      setIsAnalyzing(false);
    }, 2000); // 2.0 seconds scanning animation

    return () => clearTimeout(timer);
  }, []);

  if (isAnalyzing) {
    return (
      <div className="pt-24 min-h-[80vh] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse rounded-full"></div>
          <FaBrain className="text-7xl text-blue-500 animate-bounce relative z-10 drop-shadow-2xl" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">J.A.R.V.I.S is Scanning...</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Analyzing Cross-Vault Metrics & Risk</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 max-w-6xl mx-auto px-4 md:px-0">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl ring-1 ring-blue-500/20">
              <FaRobot size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">AI Strategy Matrix</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            Your personalized Robo-Advisor. Review your financial health, asset allocation blueprint, and actionable steps to optimize wealth.
          </p>
          {/* 🚀 GLOBAL DATE FOR LAST SCAN TIME */}
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-2">
            Last Scanned: {formatGlobalDate ? formatGlobalDate(new Date(), 'full') : 'Just now'}
          </p>
        </div>
        <button onClick={() => { setIsAnalyzing(true); setTimeout(() => setIsAnalyzing(false), 2000); }} className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-6 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-sm border border-slate-200 dark:border-slate-700">
          <HiOutlineRefresh size={20} /> Re-Analyze
        </button>
      </div>

      {/* TOP DASHBOARD: SCORE & ALLOCATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SCORE GAUGE CARD */}
        <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] shadow-2xl border border-slate-700/50 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute -left-10 -top-10 opacity-5"><FaBrain size={200} className="text-white"/></div>
          
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 relative z-10">Optimization Score</h3>
          
          {/* Custom CSS Circular Progress */}
          <div className="relative w-40 h-40 flex items-center justify-center rounded-full bg-slate-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] z-10 mb-4"
               style={{ background: `conic-gradient(#3b82f6 ${strategyData.optimizationScore}%, #1e293b ${strategyData.optimizationScore}%)` }}>
            <div className="absolute w-32 h-32 bg-slate-900 rounded-full flex flex-col items-center justify-center shadow-2xl">
              <span className="text-4xl font-black text-white tracking-tighter">{strategyData.optimizationScore}</span>
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Out of 100</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/5 backdrop-blur-md z-10">
            <span className="text-xs font-bold text-slate-300">Portfolio Risk:</span>
            <span className={`text-xs font-black uppercase tracking-wider ${strategyData.riskLevel === 'Safe' ? 'text-emerald-400' : strategyData.riskLevel === 'Moderate' ? 'text-yellow-400' : 'text-rose-400'}`}>
              {strategyData.riskLevel}
            </span>
          </div>
        </div>

        {/* ASSET ALLOCATION BLUEPRINT */}
        <div className="lg:col-span-2 p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <HiOutlineChartPie className="text-blue-500" size={24}/> Asset Allocation Blueprint
            </h3>
            <button className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-slate-700">
              <HiOutlineAdjustments className="text-slate-500" size={20}/>
            </button>
          </div>

          <div className="space-y-6">
            {/* Fiat */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg"><FaWallet size={12}/></div>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300">Fiat & Cash Reserves</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-white">{strategyData.allocations.fiat}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{width: `${strategyData.allocations.fiat}%`}}></div>
              </div>
            </div>

            {/* Crypto */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-lg"><FaChartLine size={12}/></div>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300">Digital Assets (Holding)</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-white">{strategyData.allocations.crypto}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all duration-1000" style={{width: `${strategyData.allocations.crypto}%`}}></div>
              </div>
            </div>

            {/* Yield/Staking */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><FaLeaf size={12}/></div>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300">Yield Farms & Staking</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-white">{strategyData.allocations.yield}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{width: `${strategyData.allocations.yield}%`}}></div>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* AI ACTION PLAN */}
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2 mb-6">
          <HiOutlineLightBulb className="text-yellow-500" size={24} /> Strategic Action Plan
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {strategyData.actionPlan.map((action) => (
            <div key={action.id} className={`p-6 bg-white dark:bg-slate-900 rounded-[2rem] border ${action.borderColor} shadow-sm flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}>
              
              <div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-5 ${action.color}`}>
                  {action.icon}
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{action.type} alert</p>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-3">{action.title}</h3>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                  {action.desc}
                </p>
              </div>

              <button className="w-full py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700">
                {action.actionText} <HiOutlineArrowRight />
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default AiStrategy;