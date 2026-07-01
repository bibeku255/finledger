import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion'; // ✅ ADDED
import { useAuth } from '../hooks/useAuth';
import { 
  HiOutlineChartPie, HiOutlineShieldCheck, HiOutlineCalculator, 
  HiOutlineLightningBolt, HiOutlineGlobe, HiOutlineLockClosed,
  HiOutlineArrowRight, HiOutlineLogout, HiOutlineClock,
  HiOutlineCheckCircle, HiOutlineSparkles, HiOutlineCash
} from 'react-icons/hi';
import { FaRobot, FaBitcoin, FaLeaf, FaExchangeAlt, FaTrophy } from 'react-icons/fa'; // FIXED IMPORT PATH

// ─── ANIMATION VARIANTS (Same as Home & About) ───────────────
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};
const stagger = {
  visible: { transition: { staggerChildren: 0.08 } }
};

const services = [
  {
    title: "AI Strategy & J.A.R.V.I.S",
    description: "Get personalized financial advice, risk analysis, and actionable insights powered by our smart AI engine that scans your vaults.",
    icon: <FaRobot size={32} />,
    color: "blue",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-900/50",
    badge: null
  },
  {
    title: "Comprehensive Crypto Engine",
    description: "Track live market prices, manage multi-wallet holdings, and monitor spot trading P/L with pinpoint accuracy.",
    icon: <FaBitcoin size={32} />,
    color: "orange",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    border: "border-orange-200 dark:border-orange-900/50",
    badge: "Popular" // ✅ ADDED
  },
  {
    title: "Earn & Farming Vault",
    description: "Log your staking APYs, Liquidity Pool (LP) rewards, and affiliate mining payouts seamlessly in one place.",
    icon: <FaLeaf size={32} />,
    color: "emerald",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-900/50",
    badge: null
  },
  {
    title: "Smart Khata & Loans",
    description: "Manage casual lending, track business ledgers, and automate your EMI due dates in a unified timeline.",
    icon: <HiOutlineCalculator size={32} />,
    color: "indigo",
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    border: "border-indigo-200 dark:border-indigo-900/50",
    badge: null
  },
  {
    title: "Cross-Border Arbitrage",
    description: "Convert dust coins, bridge assets across networks, and auto-sync your spread fees and profits across chains.",
    icon: <FaExchangeAlt size={32} />,
    color: "purple",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-900/50",
    badge: "New" // ✅ ADDED
  },
  {
    title: "Military-Grade Security",
    description: "AES-encrypted Secure Notes, Master PIN locks, and robust data protection for your most sensitive seed phrases.",
    icon: <HiOutlineLockClosed size={32} />,
    color: "rose",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-900/50",
    badge: null
  }, // ✅ FIXED EXTRA BRACE HERE
  {
    title: "Global Multi-Currency",
    description: "Supports global Fiat (USD, EUR, INR, NPR, etc.) alongside Crypto, adapting perfectly to your base currency.",
    icon: <HiOutlineGlobe size={32} />,
    color: "cyan",
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    border: "border-cyan-200 dark:border-cyan-900/50",
    badge: null
  },
  {
    title: "Savings & Goals",
    description: "Set financial targets, lock funds from your vaults, and let our system track your progress automatically.",
    icon: <FaTrophy size={32} />,
    color: "amber",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-900/50",
    badge: "Popular" // ✅ ADDED
  },
  {
    title: "Live Asset Allocation",
    description: "Visual dashboards, pie charts, and 6-month cashflow trends to keep you at the top of your financial game.",
    icon: <HiOutlineChartPie size={32} />,
    color: "teal",
    bg: "bg-teal-50 dark:bg-teal-500/10",
    border: "border-teal-200 dark:border-teal-900/50",
    badge: null
  }
];

// ─── HOW IT WORKS STEPS ────────────────────────────────────────
const steps = [
  {
    num: "01",
    title: "Connect Wallets",
    desc: "Link your Cash, Bank, and Crypto accounts in one secure place.",
    icon: <HiOutlineCash size={28} />
  },
  {
    num: "02",
    title: "Track & Analyze",
    desc: "AI scans your data and provides actionable financial insights.",
    icon: <HiOutlineSparkles size={28} />
  },
  {
    num: "03",
    title: "Grow Wealth",
    desc: "Make data-driven decisions and watch your net worth grow.",
    icon: <HiOutlineChartPie size={28} />
  }
];

const Services = () => {
  const { user, logout } = useAuth();

  return (
    <div className="pt-24 pb-24 min-h-screen bg-slate-50 dark:bg-slate-950 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ═══════════════════════════════════════════════════════════════
          1. HERO SECTION
         ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-7xl mx-auto px-4 md:px-8 text-center mb-20"
      >
        <motion.div variants={fadeInUp} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-widest mb-6 border border-blue-200 dark:border-blue-800 shadow-sm">
          <HiOutlineLightningBolt size={16} /> The Ultimate Finance Engine
        </motion.div>
        <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tighter mb-6">
          Everything you need to <br className="hidden md:block"/> master your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-emerald-500">wealth.</span>
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-semibold mb-8">
          From tracking physical cash to monitoring decentralized crypto yield farms, Finledger brings your entire financial universe into one intelligent dashboard.
        </motion.p>

        {/* Smart Buttons */}
        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                Go to Dashboard <HiOutlineArrowRight size={18} />
              </Link>
              <button onClick={logout} className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 hover:bg-red-50 hover:dark:bg-red-500/10 text-slate-800 dark:text-white hover:text-red-500 dark:hover:text-red-400 border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-500/30 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 text-center shadow-sm flex items-center gap-2">
                <HiOutlineLogout size={18} /> Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                Get Started Free <HiOutlineArrowRight size={18} />
              </Link>
              <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-800 dark:text-white border border-white/10 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 text-center shadow-sm">
                Sign In
              </Link>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* ═════════════════════════════════════════════════════════════
          2. SERVICES GRID (With Numbered Badges)
         ═════════════════════════════════════════════════════════════ */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-7xl mx-auto px-4 md:px-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              whileHover={{ y: -8 }}
              className="group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:border-transparent transition-all duration-300 relative overflow-hidden"
            >
              {/* Background Glow on Hover */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 ${service.bg}`}></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110 duration-300 ${service.bg} text-${service.color}-500 ${service.border}`}>
                    {service.icon}
                  </div>
                  {/* ✅ NUMBERED BADGE */}
                  <span className={`text-[10px] font-black uppercase tracking-widest ${service.color === 'blue' ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                  {service.title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  {service.description}
                </p>
                {/* ✅ HIGHLIGHT BADGE (Popular / New) */}
                {service.badge && (
                  <span className={`inline-block mt-4 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    service.badge === 'Popular' 
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30' 
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                  }`}>
                    {service.badge === 'Popular' ? '🔥 Popular' : '✨ New'}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ═════════════════════════════════════════════════════════════
          3. HOW IT WORKS SECTION (NEW)
         ═════════════════════════════════════════════════════════════ */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto px-4 md:px-8 mb-24 mt-24" // ADDED MT
      >
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-6 border border-indigo-200 dark:border-indigo-800 shadow-sm">
            <HiOutlineSparkles size={14} /> Simple 3-Step Process {/* FIXED BRACE */}
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            How Finledger Works
          </h2>
        </div>

        <div className="space-y-6">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              variants={fadeInUp}
              className="flex items-start gap-5 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all duration-300"
            >
              <div className="w-12 h-12 shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-black border border-indigo-200 dark:border-indigo-800">
                {step.num}
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1">{step.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{step.desc}</p>
              </div>
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700">
                  <HiOutlineArrowRight size={20} />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ═════════════════════════════════════════════════════════════
          4. BOTTOM CTA (Unique — Different Messaging, Not Repeated Buttons)
         ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
        className="max-w-5xl mx-auto px-4 md:px-8"
      >
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[3rem] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl border border-slate-700">
          {/* Decorative Background Icons */}
          <div className="absolute -left-20 -bottom-20 opacity-5 text-white blur-[2px]"><HiOutlineCash size={300}/></div>
          <div className="absolute -right-20 -top-20 opacity-5 text-blue-500 blur-[2px]"><HiOutlineShieldCheck size={300}/></div>
          
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
              Don't just track. <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">Optimize.</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto font-medium">
              Join the new standard of asset management — secure, local-date synced, and AI-powered.
            </p>
            
            {/* ✅ DIFFERENT CTA — Links to specific features, not just Dashboard */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                  <Link to="/dashboard/analytics" className="flex-1 sm:flex-none px-6 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/30 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 text-center flex items-center justify-center gap-2">
                    📊 View Analytics
                  </Link>
                  <Link to="/dashboard/strategy" className="flex-1 sm:flex-none px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                    🧠 AI Strategy
                  </Link>
                </div>
              ) : (
                <Link to="/signup" className="w-full sm:w-auto px-8 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                  Get Started Free <HiOutlineArrowRight size={18} />
                </Link>
              )}
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-slate-700/50">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <HiOutlineCheckCircle size={14} className="text-emerald-500" />
                <span className="font-bold">Free Forever</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <HiOutlineShieldCheck size={14} className="text-blue-500" />
                <span className="font-bold">No Data Shared</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <HiOutlineLockClosed size={14} className="text-rose-500" />
                <span className="font-bold">Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
};

export default Services;