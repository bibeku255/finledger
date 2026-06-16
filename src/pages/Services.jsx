import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // 🚀 Added to make buttons smart
import { 
  HiOutlineChartPie, HiOutlineShieldCheck, HiOutlineCalculator, 
  HiOutlineLightningBolt, HiOutlineGlobe, HiOutlineLockClosed,
  HiOutlineArrowRight, HiOutlineLogout
} from 'react-icons/hi';
import { FaRobot, FaBitcoin, FaWallet, FaLeaf, FaExchangeAlt, FaTrophy } from 'react-icons/fa';

const services = [
  {
    title: "AI Strategy & J.A.R.V.I.S",
    description: "Get personalized financial advice, risk analysis, and actionable insights powered by our smart AI engine.",
    icon: <FaRobot size={32} />,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-900/50"
  },
  {
    title: "Comprehensive Crypto Engine",
    description: "Track live market prices, manage multi-wallet holdings, and monitor spot trading P/L with pinpoint accuracy.",
    icon: <FaBitcoin size={32} />,
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    border: "border-orange-200 dark:border-orange-900/50"
  },
  {
    title: "Earn & Farming Vault",
    description: "Log your staking APYs, Liquidity Pool (LP) rewards, and affiliate mining payouts seamlessly.",
    icon: <FaLeaf size={32} />,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-900/50"
  },
  {
    title: "Smart Khata & Loans",
    description: "Manage casual lending, track business ledgers, and automate your EMI due dates in a unified timeline.",
    icon: <HiOutlineCalculator size={32} />,
    color: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    border: "border-indigo-200 dark:border-indigo-900/50"
  },
  {
    title: "Cross-Border Arbitrage",
    description: "Convert dust coins, bridge assets across networks, and auto-sync your spread fees and profits.",
    icon: <FaExchangeAlt size={32} />,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-900/50"
  },
  {
    title: "Military-Grade Security",
    description: "AES-encrypted Secure Notes, Master PIN locks, and robust data protection for your most sensitive seed phrases.",
    icon: <HiOutlineLockClosed size={32} />,
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-900/50"
  },
  {
    title: "Global Multi-Currency",
    description: "Supports global Fiat (USD, EUR, INR, NPR, etc.) alongside Crypto, adapting perfectly to your base currency.",
    icon: <HiOutlineGlobe size={32} />,
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    border: "border-cyan-200 dark:border-cyan-900/50"
  },
  {
    title: "Savings & Goals",
    description: "Set financial targets, lock funds from your vaults, and let our system track your progress automatically.",
    icon: <FaTrophy size={32} />,
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
    border: "border-yellow-200 dark:border-yellow-900/50"
  },
  {
    title: "Live Asset Allocation",
    description: "Visual dashboards, pie charts, and 6-month cashflow trends to keep you at the top of your financial game.",
    icon: <HiOutlineChartPie size={32} />,
    color: "text-teal-500",
    bg: "bg-teal-50 dark:bg-teal-500/10",
    border: "border-teal-200 dark:border-teal-900/50"
  }
];

const Services = () => {
  const { user, logout } = useAuth(); // 🚀 Fetching user status and logout action

  return (
    <div className="pt-24 pb-24 min-h-screen bg-slate-50 dark:bg-slate-950 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 🚀 HERO SECTION WITH TOP BUTTONS */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 text-center mb-20">
        <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-widest mb-6 border border-blue-200 dark:border-blue-800">
          <HiOutlineLightningBolt size={16} /> The Ultimate Finance Engine
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tighter mb-6">
          Everything you need to <br className="hidden md:block"/> master your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-emerald-500">wealth.</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-semibold mb-8">
          From tracking physical cash to monitoring decentralized crypto yield farms, Finledger brings your entire financial universe into one intelligent dashboard.
        </p>

        {/* 🚀 SMART BUTTONS AT THE TOP */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                Go to Dashboard <HiOutlineArrowRight size={18} />
              </Link>
              <button onClick={logout} className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 hover:bg-red-50 hover:dark:bg-red-500/10 text-slate-800 dark:text-white hover:text-red-500 dark:hover:text-red-400 border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-500/30 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 text-center shadow-sm flex items-center justify-center gap-2">
                <HiOutlineLogout size={18} /> Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                Get Started Free <HiOutlineArrowRight size={18} />
              </Link>
              <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 text-center shadow-sm">
                Login
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 🚀 SERVICES GRID */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <div 
              key={index} 
              className="group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:border-transparent transition-all duration-300 hover:-translate-y-2 relative overflow-hidden"
            >
              {/* Background Glow on Hover */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 ${service.bg}`}></div>
              
              <div className="relative z-10">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border transition-transform group-hover:scale-110 duration-300 ${service.bg} ${service.color} ${service.border}`}>
                  {service.icon}
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                  {service.title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 🚀 BOTTOM CTA SECTION */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mt-32">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[3rem] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl border border-slate-700">
          <div className="absolute -left-20 -bottom-20 opacity-5 text-white blur-[2px]"><FaWallet size={300}/></div>
          <div className="absolute -right-20 -top-20 opacity-5 text-blue-500 blur-[2px]"><HiOutlineShieldCheck size={300}/></div>
          
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-6">
              Ready to take control of your finances?
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto font-medium">
              Join the new standard of asset management. Secure, local-date synchronized, and AI-powered.
            </p>
            
            {/* 🚀 SMART BUTTONS AT THE BOTTOM */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <>
                  <Link to="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                    Go to Dashboard <HiOutlineArrowRight size={18} />
                  </Link>
                  <button onClick={logout} className="w-full sm:w-auto px-8 py-4 bg-transparent hover:bg-red-500/10 text-white hover:text-red-400 border border-slate-600 hover:border-red-500 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 text-center flex items-center justify-center gap-2">
                    <HiOutlineLogout size={18} /> Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                    Get Started Free <HiOutlineArrowRight size={18} />
                  </Link>
                  <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 text-center">
                    Sign In
                  </Link>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};

export default Services;