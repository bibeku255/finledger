import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { fetchWithRetry } from '../../utils/helpers';
import {
  HiOutlineLightBulb, HiOutlineShieldCheck, HiOutlineTrendingUp,
  HiOutlineExclamation, HiOutlineChartPie, HiOutlineRefresh,
  HiOutlineArrowRight, HiOutlineScale, HiOutlineEye, HiOutlineLightningBolt,
  HiOutlineSparkles
} from 'react-icons/hi';
import {
  FaBrain, FaRobot, FaLeaf, FaWallet, FaChartLine
} from 'react-icons/fa';

// Animated Circular Gauge (unchanged)
const ScoreGauge = ({ score, riskLevel }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 300);
    return () => clearTimeout(timer);
  }, [score]);

  const getScoreColor = (s) => {
    if (s >= 80) return { stroke: '#10b981', glow: 'rgba(16, 185, 129, 0.3)', label: 'Excellent' };
    if (s >= 60) return { stroke: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)', label: 'Good' };
    if (s >= 40) return { stroke: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)', label: 'Fair' };
    return { stroke: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)', label: 'Needs Work' };
  };

  const scoreColor = getScoreColor(animatedScore);
  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="relative w-48 h-48 mx-auto">
      <div className="absolute inset-0 rounded-full blur-2xl opacity-40 transition-colors duration-500" style={{ background: scoreColor.glow }} />
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r="80" fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-200 dark:text-slate-700/50" />
        <circle cx="90" cy="90" r="80" fill="none" stroke={scoreColor.stroke} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1500 ease-out" style={{ filter: `drop-shadow(0 0 8px ${scoreColor.stroke})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums transition-colors duration-500">{animatedScore}</span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">out of 100</span>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg mt-2 transition-colors duration-500 shadow-sm" style={{ color: scoreColor.stroke, background: `${scoreColor.stroke}20`, border: `1px solid ${scoreColor.stroke}40` }}>{scoreColor.label}</span>
      </div>
    </div>
  );
};

// Progress Bar with animation (unchanged)
const ProgressBar = ({ label, icon: Icon, value, color, bgColor, amount }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 200);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="group">
      <div className="flex justify-between items-end mb-2 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl ${bgColor} transition-transform group-hover:scale-110 duration-300 shrink-0`}>
            <Icon size={14} className={color} />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{label}</span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-black text-slate-900 dark:text-white">{value}%</span>
          {amount !== undefined && <p className="text-[9px] font-bold text-slate-400 truncate max-w-[80px] sm:max-w-none">≈ {amount}</p>}
        </div>
      </div>
      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
        <div className={`h-full rounded-full transition-all duration-1500 ease-out ${color}`} style={{ width: `${width}%` }}>
          <div className="h-full w-full bg-white/20 rounded-full animate-shimmer" />
        </div>
      </div>
    </div>
  );
};

// Strategy Card (unchanged)
const StrategyCard = ({ action, index }) => {
  const navigate = useNavigate();
  const typeIcons = { opportunity: HiOutlineLightningBolt, risk: HiOutlineExclamation, health: HiOutlineShieldCheck, growth: HiOutlineTrendingUp };
  const typeStyles = {
    opportunity: { card: 'from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border-emerald-200 dark:border-emerald-500/20', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', dot: 'bg-emerald-400', btn: 'hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
    risk: { card: 'from-rose-50 to-pink-50 dark:from-rose-900/10 dark:to-pink-900/10 border-rose-200 dark:border-rose-500/20', icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400', dot: 'bg-rose-400', btn: 'hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400' },
    health: { card: 'from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 border-blue-200 dark:border-blue-500/20', icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', dot: 'bg-blue-400', btn: 'hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400' },
    growth: { card: 'from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10 border-purple-200 dark:border-purple-500/20', icon: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400', dot: 'bg-purple-400', btn: 'hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-400' }
  };
  const styles = typeStyles[action.type] || typeStyles.health;
  const TypeIcon = typeIcons[action.type] || HiOutlineShieldCheck;

  return (
    <div className={`group relative p-6 rounded-[2rem] border bg-gradient-to-br backdrop-blur-sm shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col ${styles.card}`} style={{ transitionDelay: `${index * 100}ms` }}>
      <div className={`absolute top-4 right-4 w-2 h-2 rounded-full animate-pulse ${styles.dot}`} />
      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex items-start gap-4 mb-5">
          <div className={`p-3.5 rounded-2xl ${styles.icon} ring-1 ring-current/20 shadow-sm transition-transform duration-300 shrink-0`}><TypeIcon size={22} /></div>
          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-current/20 shadow-sm ${styles.badge}`}>{action.type}</span>
        </div>
        <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white mb-2 leading-tight">{action.title}</h3>
        <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed mb-6 flex-1">{action.desc}</p>
        <button onClick={() => navigate(action.link)} className={`w-full py-3.5 bg-white dark:bg-slate-800 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm group/btn active:scale-95 ${styles.btn}`}>{action.actionText} <HiOutlineArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" /></button>
      </div>
    </div>
  );
};

const AiStrategy = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const navigate = useNavigate();

  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const [bankBalance, setBankBalance] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [onlineBalance, setOnlineBalance] = useState(0);
  const [cryptoBalance, setCryptoBalance] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [forceUpdate, setForceUpdate] = useState(0);

  const [strategyData, setStrategyData] = useState(null);

  // Custom user coins (for fallback prices)
  const [customUserCoins, setCustomUserCoins] = useState([]);

  // Build full database (selectedCryptos + customUserCoins)
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

  // Fetch custom coins from Firestore
  useEffect(() => {
    if (!user) return;
    const fetchCustomCoins = async () => {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && userSnap.data().customCoins) {
        setCustomUserCoins(userSnap.data().customCoins);
      }
    };
    fetchCustomCoins();
  }, [user]);

  // Real-time data listeners
  useEffect(() => {
    if (!user) return;

    const calcVaultBalance = (snapshot) => {
      return snapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        let finalAmount = Number(data.finalBaseAmount || data.amount || 0);
        let feeAmount = data.fee ? (data.feeExchangeRate ? Number(data.fee) * Number(data.feeExchangeRate) : data.exchangeRate ? Number(data.fee) * Number(data.exchangeRate) : Number(data.fee)) : 0;
        return acc + (data.type === 'in' ? finalAmount : -(finalAmount + feeAmount));
      }, 0);
    };

    // Robust crypto balance calculation (same logic as CryptoWallet)
    const fetchCryptoFiatValue = async (cryptoSnapshot) => {
      // 1. Calculate holdings per coin
      const holdings = {};
      cryptoSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const coin = d.coin?.toUpperCase();
        if (!coin) return;
        const qty = parseFloat(d.quantity) || 0;
        const fee = parseFloat(d.networkFee) || 0;

        if (d.type === 'in') {
          holdings[coin] = (holdings[coin] || 0) + qty;
        } else if (d.type === 'out') {
          holdings[coin] = (holdings[coin] || 0) - qty;
        } else if (d.type === 'transfer') {
          // transfer reduces total holdings by network fee
          holdings[coin] = (holdings[coin] || 0) - fee;
        }
      });

      // 2. Base currency rate
      let usdToBase = 1;
      try {
        const forexRes = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD');
        if (forexRes && forexRes.ok) {
          usdToBase = parseFloat((await forexRes.json()).rates[baseCurrency]) || 1;
        }
      } catch (e) {}

      const coinsToFetch = Object.keys(holdings);
      if (coinsToFetch.length === 0) {
        setCryptoBalance(0);
        return;
      }

      // 3. Separate normal coins and contract coins
      const normalCoins = [];
      const contractCoins = [];
      coinsToFetch.forEach(sym => {
        const upperSym = sym.toUpperCase();
        const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === upperSym);
        if (dbCoin?.fetchMode === 'contract' && dbCoin.contractAddress) {
          contractCoins.push({ symbol: upperSym, ...dbCoin });
        } else {
          const id = dbCoin?.id || sym.toLowerCase();
          normalCoins.push({ id, symbol: upperSym });
        }
      });

      // 4. Fetch CoinGecko prices for normal coins
      let cgPrices = {};
      try {
        if (normalCoins.length > 0) {
          const uniqueIds = [...new Set(normalCoins.map(c => c.id))].join(',');
          const cgRes = await fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds}&vs_currencies=usd`);
          if (cgRes && cgRes.ok) {
            cgPrices = await cgRes.json();
          }
        }
      } catch (e) {}

      // 5. Fetch prices for contract coins (DexScreener / GeckoTerminal)
      let contractPrices = {};
      for (const coin of contractCoins) {
        let priceUsd = 0;
        try {
          const dexRes = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${coin.contractAddress}`);
          if (dexRes && dexRes.ok) {
            const dexData = await dexRes.json();
            if (dexData.pairs?.length > 0) {
              priceUsd = parseFloat(dexData.pairs[0].priceUsd);
            }
          }
          if (!priceUsd && coin.network) {
            const gtRes = await fetchWithRetry(`https://api.geckoterminal.com/api/v2/networks/${coin.network}/tokens/${coin.contractAddress}`);
            if (gtRes && gtRes.ok) {
              const gtData = await gtRes.json();
              priceUsd = parseFloat(gtData.data?.attributes?.price_usd) || 0;
            }
          }
        } catch (e) {}
        contractPrices[coin.symbol] = priceUsd;
      }

      // 6. Build final price map with fallbacks
      const priceMap = {};
      for (const sym of coinsToFetch) {
        const upperSym = sym.toUpperCase();
        const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === upperSym) || {};
        const normalId = dbCoin.id || sym.toLowerCase();
        let priceUsd = 0;

        if (dbCoin.fetchMode === 'contract') {
          priceUsd = contractPrices[upperSym] || 0;
        } else {
          // CoinGecko
          if (cgPrices[normalId]?.usd) {
            priceUsd = parseFloat(cgPrices[normalId].usd);
          }
        }

        // Binance fallback
        if (!priceUsd) {
          try {
            if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(upperSym)) {
              priceUsd = 1.00;
            } else {
              const bRes = await fetchWithRetry(`https://api.binance.com/api/v3/ticker/price?symbol=${upperSym}USDT`);
              if (bRes && bRes.ok) {
                const bData = await bRes.json();
                priceUsd = parseFloat(bData.price);
              }
            }
          } catch (e) {}
        }

        // Fallback to user's custom fallbackPrice
        if (!priceUsd && dbCoin.fallbackPrice) {
          priceUsd = parseFloat(dbCoin.fallbackPrice);
        }

        priceMap[upperSym] = priceUsd;
      }

      // 7. Calculate total fiat value
      let totalValue = 0;
      for (const sym of coinsToFetch) {
        const qty = holdings[sym] || 0;
        const priceUsd = priceMap[sym] || 0;
        if (qty > 0 && priceUsd > 0) {
          totalValue += qty * priceUsd * usdToBase;
        }
      }
      setCryptoBalance(totalValue);
    };

    const unsubs = [
      onSnapshot(collection(db, "users", user.uid, "bankWallet"), snap => setBankBalance(calcVaultBalance(snap))),
      onSnapshot(collection(db, "users", user.uid, "cashWallet"), snap => setCashBalance(calcVaultBalance(snap))),
      onSnapshot(collection(db, "users", user.uid, "onlineWallet"), snap => setOnlineBalance(calcVaultBalance(snap))),
      onSnapshot(collection(db, "users", user.uid, "cryptoWalletLogs"), snap => fetchCryptoFiatValue(snap))
    ];

    const timeout = setTimeout(() => setDataLoaded(true), 1200);

    return () => {
      unsubs.forEach(unsub => unsub());
      clearTimeout(timeout);
    };
  }, [user, baseCurrency, fullDatabase]); // fullDatabase dependency ensures re-run when custom coins load

  // Progress animation
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + Math.random() * 18;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Main analysis effect
  useEffect(() => {
    const hasData = bankBalance !== 0 || cashBalance !== 0 || cryptoBalance !== 0 || onlineBalance !== 0;
    if (!dataLoaded) return;

    const timer = setTimeout(() => {
      if (!hasData) {
        setStrategyData(generateEmptyStrategy());
        setIsAnalyzing(false);
        return;
      }

      const totalFiat = bankBalance + cashBalance + onlineBalance;
      const totalPortfolio = totalFiat + cryptoBalance;

      if (totalPortfolio <= 0) {
        setStrategyData(generateEmptyStrategy());
        setIsAnalyzing(false);
        return;
      }

      let fiatPct = Math.round((totalFiat / totalPortfolio) * 100);
      let cryptoPct = Math.round((cryptoBalance / totalPortfolio) * 100);
      let yieldPct = Math.max(0, 100 - fiatPct - cryptoPct);

      let risk = 'Safe';
      let score = 85;

      if (cryptoPct > 70) { risk = 'High'; score = 55; }
      else if (cryptoPct > 50) { risk = 'Medium-High'; score = 65; }
      else if (cryptoPct > 35) { risk = 'Moderate'; score = 78; }
      else if (cryptoPct < 5 && totalFiat > 10000) { risk = 'Conservative'; score = 72; }
      else if (cryptoPct >= 5 && cryptoPct <= 35 && fiatPct >= 40) { score = 88; }

      const plan = [];

      if (fiatPct > 70) {
        plan.push({ id: 1, type: 'opportunity', icon: <HiOutlineTrendingUp className="text-emerald-500" size={24} />, title: "Idle Cash Alert", desc: `${currencySymbol}${totalFiat.toLocaleString(undefined, { maximumFractionDigits: 0 })} in fiat vaults. Inflation at ~5-7% erodes value. Shift 20-30% to stablecoins or high-yield deposits.`, actionText: "Rebalance Capital", link: "/dashboard/accounts/capital-shifting" });
      } else if (fiatPct < 20 && totalFiat <= 5000) {
        plan.push({ id: 1, type: 'risk', icon: <HiOutlineExclamation className="text-rose-500" size={24} />, title: "Low Emergency Fund", desc: "Emergency fund below recommended 3-6 months expenses. Prioritize building cash reserves before aggressive investing.", actionText: "Add Emergency Fund", link: "/dashboard/accounts/bank" });
      } else {
        plan.push({ id: 1, type: 'health', icon: <HiOutlineShieldCheck className="text-blue-500" size={24} />, title: "Healthy Cash Position", desc: `Fiat reserves at ${fiatPct}% — strong safety net for emergencies while maintaining investment exposure.`, actionText: "View Bank Vault", link: "/dashboard/accounts/bank" });
      }

      if (cryptoPct > 50) {
        plan.push({ id: 2, type: 'risk', icon: <HiOutlineExclamation className="text-rose-500" size={24} />, title: "Overexposed to Crypto", desc: `${cryptoPct}% in volatile assets. Consider profit-booking 15-25% into stablecoins or fiat to reduce drawdown risk.`, actionText: "Book Profits", link: "/dashboard/crypto/hold-and-swap" });
      } else if (cryptoPct > 0 && cryptoPct <= 35) {
        plan.push({ id: 2, type: 'growth', icon: <FaLeaf className="text-purple-500" size={24} />, title: "Optimize Crypto Holdings", desc: "Balanced exposure. Explore staking (4-12% APY) or DeFi yield opportunities on idle tokens for passive income.", actionText: "Explore Yield Options", link: "/dashboard/crypto/staking-yield" });
      } else if (cryptoPct === 0) {
        plan.push({ id: 2, type: 'opportunity', icon: <FaChartLine className="text-emerald-500" size={24} />, title: "Zero Crypto Exposure", desc: "2-5% in BTC/ETH hedges against fiat inflation & currency devaluation. Start small with dollar-cost averaging.", actionText: "Start Crypto Journey", link: "/dashboard/crypto/hold-and-swap" });
      } else {
        plan.push({ id: 2, type: 'health', icon: <HiOutlineScale className="text-blue-500" size={24} />, title: "Balanced Crypto Exposure", desc: `${cryptoPct}% allocation is within optimal range for growth-oriented portfolios. Monitor quarterly.`, actionText: "Track Portfolio", link: "/dashboard/crypto/hold-and-swap" });
      }

      plan.push({ id: 3, type: 'health', icon: <HiOutlineChartPie className="text-indigo-500" size={24} />, title: "Portfolio Health Check", desc: `Total tracked: ${currencySymbol}${totalPortfolio.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Score: ${score}/100. ${score >= 80 ? 'Great job!' : score >= 60 ? 'Room for improvement.' : 'Needs immediate attention.'}`, actionText: "Full Audit Report", link: "/dashboard/accounts/history" });

      setStrategyData({
        optimizationScore: score, riskLevel: risk, allocations: { fiat: fiatPct, crypto: cryptoPct, yield: yieldPct },
        totalPortfolio, totalFiat, cryptoBalance, actionPlan: plan
      });

      setIsAnalyzing(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [bankBalance, cashBalance, cryptoBalance, onlineBalance, currencySymbol, dataLoaded, forceUpdate]);

  const generateEmptyStrategy = () => ({
    optimizationScore: 0, riskLevel: 'N/A', allocations: { fiat: 0, crypto: 0, yield: 0 },
    totalPortfolio: 0, totalFiat: 0, cryptoBalance: 0,
    actionPlan: [{ id: 1, type: 'risk', icon: <HiOutlineExclamation className="text-rose-500" size={24} />, title: "No Financial Data Found", desc: `J.A.R.V.I.S requires transaction data to analyze. Add your first deposit to Bank, Cash, or Crypto vaults to unlock personalized AI insights and portfolio optimization strategies.`, actionText: "Add First Deposit", link: "/dashboard/accounts/bank" }]
  });

  const reAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setForceUpdate(prev => prev + 1);
  };

  if (!dataLoaded || isAnalyzing) {
    return (
      <div className="pt-24 min-h-screen flex flex-col items-center justify-center px-4 -mt-20">
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse rounded-full scale-[2]" />
          <div className="relative">
            <FaBrain className="text-[80px] sm:text-[100px] text-blue-500 animate-bounce drop-shadow-2xl" />
            <HiOutlineSparkles className="absolute -top-4 -right-4 text-3xl text-yellow-400 animate-ping" />
          </div>
        </div>
        <div className="w-full max-w-sm mb-8 px-4">
          <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
            <span>Analyzing Vaults</span>
            <span className="text-blue-500">{Math.min(Math.round(analysisProgress), 100)}%</span>
          </div>
          <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${Math.min(analysisProgress, 100)}%` }} />
          </div>
        </div>
        <div className="text-center space-y-3 px-4">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">J.A.R.V.I.S is Scanning</h2>
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest h-6 animate-pulse">
            {analysisProgress < 30 ? 'Compiling Bank & Cash Reserves...' : analysisProgress < 60 ? 'Evaluating Crypto P&L Exposure...' : analysisProgress < 90 ? 'Calculating Global Risk Metrics...' : 'Finalizing Wealth Strategy...'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-10">
          {['Bank', 'Cash', 'Crypto', 'Online'].map((vault, i) => (
            <div key={vault} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className={`w-2 h-2 rounded-full ${analysisProgress > (i + 1) * 20 ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-slate-300 dark:bg-slate-600 animate-pulse'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{vault}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 sm:pt-24 space-y-6 sm:space-y-8 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 sm:gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_70%)]" />
        <div className="flex items-center gap-4 sm:gap-5 relative z-10">
          <div className="p-3.5 sm:p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl sm:rounded-[1.5rem] shadow-xl shadow-blue-500/30 ring-1 ring-white/20 shrink-0">
            <FaRobot size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">AI Strategy Matrix</h1>
            <p className="text-[11px] sm:text-sm font-semibold text-slate-400 mt-1 max-w-xl">Real-time portfolio analysis & personalized wealth optimization</p>
          </div>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 relative z-10 w-full lg:w-auto mt-2 lg:mt-0">
          {strategyData?.riskLevel && strategyData.riskLevel !== 'N/A' && (
            <div className={`flex-1 lg:flex-none flex justify-center items-center gap-1.5 px-4 py-3 sm:py-3.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest border backdrop-blur-sm shadow-sm
              ${strategyData.riskLevel === 'Safe' || strategyData.riskLevel === 'Conservative' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : strategyData.riskLevel === 'Moderate' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : strategyData.riskLevel === 'Medium-High' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
              {strategyData.riskLevel === 'Safe' ? '🛡️' : strategyData.riskLevel === 'Conservative' ? '🔒' : strategyData.riskLevel === 'Moderate' ? '⚖️' : strategyData.riskLevel === 'Medium-High' ? '⚠️' : '🔥'}
              <span className="truncate">{strategyData.riskLevel} Risk</span>
            </div>
          )}
          <button onClick={reAnalyze} className="flex-1 lg:flex-none flex justify-center items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 shadow-sm border border-white/10">
            <HiOutlineRefresh size={16} className="shrink-0" /> <span className="truncate">Re-Analyze</span>
          </button>
        </div>
      </div>

      <p className="text-[9px] sm:text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest pl-4 sm:pl-6 -mt-2">
        <HiOutlineEye className="inline mr-1" size={14} /> Last Scan: {formatGlobalDate ? formatGlobalDate(new Date().toISOString(), 'full') : 'Just now'}
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
        <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute -left-10 -top-10 opacity-[0.02] dark:opacity-5 group-hover:scale-110 transition-transform duration-700">
            <FaBrain size={200} className="text-slate-900 dark:text-white" />
          </div>
          <h3 className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-6 relative z-10 text-center">Portfolio Health Score</h3>
          <ScoreGauge score={strategyData?.optimizationScore || 0} riskLevel={strategyData?.riskLevel} />
          {strategyData?.totalPortfolio > 0 && (
            <div className="mt-8 text-center relative z-10 bg-slate-50 dark:bg-slate-800/50 px-6 py-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Tracked Wealth</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate max-w-[200px]" title={`${currencySymbol}${strategyData.totalPortfolio.toLocaleString()}`}>{currencySymbol}{strategyData.totalPortfolio.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 relative z-10">
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><HiOutlineChartPie className="text-blue-500 shrink-0" size={22} />Asset Allocation Blueprint</h3>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" /> Fiat</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 shadow-sm" /> Crypto</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" /> Yield</span>
            </div>
          </div>
          <div className="space-y-6 sm:space-y-8 relative z-10">
            <ProgressBar label="Fiat & Cash Reserves" icon={FaWallet} value={strategyData?.allocations?.fiat || 0} color="bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" bgColor="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20" amount={strategyData?.totalFiat ? `${currencySymbol}${strategyData.totalFiat.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined} />
            <ProgressBar label="Digital Assets (Crypto)" icon={FaChartLine} value={strategyData?.allocations?.crypto || 0} color="bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" bgColor="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20" amount={strategyData?.cryptoBalance ? `${currencySymbol}${strategyData.cryptoBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined} />
            <ProgressBar label="Yield/Staking (Estimated)" icon={FaLeaf} value={strategyData?.allocations?.yield || 0} color="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" bgColor="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20" />
          </div>
          <div className="mt-8 p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 rounded-2xl border border-blue-200 dark:border-blue-500/20 relative z-10 shadow-sm">
            <p className="text-[10px] sm:text-xs font-bold text-blue-700 dark:text-blue-400 flex items-start gap-2.5">
              <HiOutlineLightBulb className="shrink-0 mt-0.5 text-yellow-500" size={18} />
              <span className="leading-relaxed">
                {strategyData?.allocations?.crypto > 50 ? 'Consider rebalancing: High crypto exposure increases volatility risk.' : strategyData?.allocations?.fiat > 80 ? 'Large idle fiat reserves losing value to inflation. Explore yield options.' : 'Your allocation is well-balanced. Focus on consistent contributions.'}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <HiOutlineLightBulb className="text-yellow-500 shrink-0" size={24} /> Strategic Action Plan
          </h2>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
            {strategyData?.actionPlan?.length || 0} Recommendations
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {strategyData?.actionPlan?.map((action, index) => <StrategyCard key={action.id} action={action} index={index} />)}
        </div>
      </div>

      <div className="text-center py-6 px-4 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <p className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 flex-wrap uppercase tracking-widest">
          <FaRobot className="text-blue-500" size={16} /> Powered by J.A.R.V.I.S Engine v2.0 — <span className="text-blue-600 dark:text-blue-400">Real-time cross-vault analysis</span>
        </p>
      </div>
    </div>
  );
};

export default AiStrategy;