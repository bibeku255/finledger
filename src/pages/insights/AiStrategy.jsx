import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { useNavigate } from 'react-router-dom';

import { 
  HiOutlineLightBulb, HiOutlineShieldCheck, HiOutlineTrendingUp, 
  HiOutlineExclamation, HiOutlineChartPie, HiOutlineRefresh,
  HiOutlineArrowRight, HiOutlineAdjustments
} from 'react-icons/hi';
import { FaBrain, FaRobot, FaLeaf, FaWallet, FaChartLine } from 'react-icons/fa';

const AiStrategy = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, baseCurrency = 'INR', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const navigate = useNavigate();
  
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  // 🚀 REAL DATA STATES
  const [bankBalance, setBankBalance] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [onlineBalance, setOnlineBalance] = useState(0);
  const [cryptoBalance, setCryptoBalance] = useState(0);
  
  const [strategyData, setStrategyData] = useState(null);

  // 📥 FETCH REAL VAULT BALANCES
  useEffect(() => {
    if (!user) return;

    const calcVaultBalance = (snapshot) => {
      return snapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        let finalAmount = Number(data.finalBaseAmount || data.amount || 0);
        let feeAmount = 0;
        
        if (data.fee && data.feeExchangeRate) {
            feeAmount = Number(data.fee) * Number(data.feeExchangeRate);
        } else if (data.fee && data.exchangeRate) { 
            feeAmount = Number(data.fee) * Number(data.exchangeRate);
        } else if (data.fee) {
            feeAmount = Number(data.fee);
        }

        const netChange = data.type === 'in' ? finalAmount : -(finalAmount + feeAmount);
        return acc + netChange;
      }, 0);
    };

    const unsubBank = onSnapshot(collection(db, "users", user.uid, "bankWallet"), snap => setBankBalance(calcVaultBalance(snap)));
    const unsubCash = onSnapshot(collection(db, "users", user.uid, "cashWallet"), snap => setCashBalance(calcVaultBalance(snap)));
    const unsubOnline = onSnapshot(collection(db, "users", user.uid, "onlineWallet"), snap => setOnlineBalance(calcVaultBalance(snap)));
    const unsubCrypto = onSnapshot(collection(db, "users", user.uid, "cryptoWalletLogs"), snap => {
        // Simple aggregate for crypto base value if saved (this might need complex API logic if live price is needed, using saved base for now)
        setCryptoBalance(calcVaultBalance(snap)); 
    });

    return () => { unsubBank(); unsubCash(); unsubOnline(); unsubCrypto(); };
  }, [user]);

  // 🧠 THE J.A.R.V.I.S ALGORITHM (Dynamic Calculation)
  useEffect(() => {
    if (bankBalance === 0 && cashBalance === 0 && cryptoBalance === 0 && onlineBalance === 0) {
        // Default Wait
        const timer = setTimeout(() => {
          setStrategyData(generateEmptyStrategy());
          setIsAnalyzing(false);
        }, 1500);
        return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      
      const totalFiat = bankBalance + cashBalance + onlineBalance;
      const totalPortfolio = totalFiat + cryptoBalance;
      
      // Prevent division by zero
      if(totalPortfolio <= 0) {
         setStrategyData(generateEmptyStrategy());
         setIsAnalyzing(false);
         return;
      }

      // Calculate Percentages
      let fiatPct = Math.round((totalFiat / totalPortfolio) * 100);
      let cryptoPct = Math.round((cryptoBalance / totalPortfolio) * 100);
      let yieldPct = 0; // Hardcoded for now until we build a yield farm tracker

      // Determine Risk Level
      let risk = 'Safe';
      let score = 85;
      
      if (cryptoPct > 70) {
          risk = 'High';
          score = 65;
      } else if (cryptoPct > 35) {
          risk = 'Moderate';
          score = 80;
      } else if (cryptoPct < 5 && totalFiat > 10000) {
          // Too much idle fiat, losing to inflation
          risk = 'Low Yield';
          score = 70;
      }

      // Generate Smart Action Plan based on Real Balances
      const plan = [];

      // 1. Fiat Strategy
      if (fiatPct > 70) {
          plan.push({
            id: 1, type: 'opportunity', icon: <HiOutlineTrendingUp className="text-emerald-500" />,
            title: "Rebalance Idle Cash",
            desc: `You have ${currencySymbol}${totalFiat.toLocaleString()} sitting in fiat vaults. Inflation is eating your purchasing power. Consider shifting 20% to fixed deposits or stablecoins.`,
            actionText: "Capital Shift", link: "/dashboard/shifting",
            color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', borderColor: 'border-emerald-200 dark:border-emerald-800'
          });
      } else {
          plan.push({
            id: 1, type: 'health', icon: <HiOutlineShieldCheck className="text-blue-500" />,
            title: "Good Fiat Reserves",
            desc: `Your fiat balance is ${fiatPct}% of your portfolio. This provides an excellent safety net for emergencies and sudden expenses.`,
            actionText: "View Bank Ledger", link: "/dashboard/accounts/bank",
            color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400', borderColor: 'border-blue-200 dark:border-blue-800'
          });
      }

      // 2. Crypto Strategy
      if (cryptoPct > 50) {
          plan.push({
            id: 2, type: 'risk', icon: <HiOutlineExclamation className="text-rose-500" />,
            title: "High Crypto Volatility Risk",
            desc: `Your portfolio is heavily weighted (${cryptoPct}%) in digital assets. Consider booking profits and shifting some capital to secure Bank Vaults.`,
            actionText: "Crypto Dashboard", link: "/dashboard/crypto/hold-profit",
            color: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400', borderColor: 'border-rose-200 dark:border-rose-800'
          });
      } else if (cryptoPct > 0) {
          plan.push({
            id: 2, type: 'opportunity', icon: <FaLeaf className="text-emerald-500" />,
            title: "Optimize Crypto Assets",
            desc: "You have a balanced crypto portfolio. Explore Staking or Yield Farming to generate passive income on your idle tokens.",
            actionText: "Explore Staking", link: "/dashboard/crypto/staking",
            color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', borderColor: 'border-emerald-200 dark:border-emerald-800'
          });
      } else {
          plan.push({
            id: 2, type: 'opportunity', icon: <FaChartLine className="text-orange-500" />,
            title: "Missing Digital Assets",
            desc: "You currently hold 0% in crypto. Diversifying a small amount (2-5%) into Bitcoin or Ethereum could hedge against fiat inflation.",
            actionText: "Add Crypto", link: "/dashboard/crypto/hold-profit",
            color: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400', borderColor: 'border-orange-200 dark:border-orange-800'
          });
      }

      // 3. Savings / Overall Health
      plan.push({
        id: 3, type: 'health', icon: <HiOutlineChartPie className="text-purple-500" />,
        title: "Portfolio Snapshot",
        desc: `Net Worth tracked: ${currencySymbol}${totalPortfolio.toLocaleString()}. Keep logging your expenses meticulously to maintain an accurate optimization score.`,
        actionText: "View Master Audit", link: "/dashboard/history",
        color: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400', borderColor: 'border-purple-200 dark:border-purple-800'
      });

      setStrategyData({
        optimizationScore: score,
        riskLevel: risk,
        allocations: { fiat: fiatPct, crypto: cryptoPct, yield: yieldPct },
        actionPlan: plan
      });

      setIsAnalyzing(false);
    }, 2000); 

    return () => clearTimeout(timer);
  }, [bankBalance, cashBalance, cryptoBalance, onlineBalance, currencySymbol]);

  // Fallback for Empty Data
  const generateEmptyStrategy = () => ({
      optimizationScore: 0, riskLevel: 'Unknown',
      allocations: { fiat: 0, crypto: 0, yield: 0 },
      actionPlan: [
        {
          id: 1, type: 'risk', icon: <HiOutlineExclamation className="text-rose-500" />,
          title: "Insufficient Data",
          desc: "J.A.R.V.I.S needs data to analyze. Please add funds to your Bank, Cash, or Crypto vaults to generate a personalized strategy.",
          actionText: "Log Deposit", link: "/dashboard/accounts/bank",
          color: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400', borderColor: 'border-rose-200 dark:border-rose-800'
        }
      ]
  });

  const reAnalyze = () => {
     setIsAnalyzing(true);
     setTimeout(() => setIsAnalyzing(false), 2000);
  };

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
        <button onClick={reAnalyze} className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-6 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-sm border border-slate-200 dark:border-slate-700">
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
            <span className={`text-xs font-black uppercase tracking-wider ${strategyData.riskLevel === 'Safe' || strategyData.riskLevel === 'Low Yield' ? 'text-emerald-400' : strategyData.riskLevel === 'Moderate' ? 'text-yellow-400' : 'text-rose-400'}`}>
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
            <button onClick={reAnalyze} className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-slate-700">
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
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300">Yield Farms & Staking (Est.)</span>
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

              <button onClick={() => navigate(action.link)} className="w-full py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700">
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