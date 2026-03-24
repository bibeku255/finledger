import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  HiOutlineShieldCheck, HiOutlineSparkles, HiOutlineChartPie, 
  HiOutlineGlobe, HiOutlineLightningBolt, HiOutlineArrowRight,
  HiOutlineChevronDown, HiOutlineChatAlt2
} from 'react-icons/hi';
import { 
  FaBitcoin, FaRobot, FaWallet, FaChartLine, 
  FaTelegramPlane, FaYoutube, FaFacebook, FaUsers
} from 'react-icons/fa';

// --- DATA SNIPPETS ---
const topFeatures = [
  {
    title: "AI-Powered Intelligence",
    desc: "J.A.R.V.I.S scans your vaults 24/7 to provide actionable strategies.",
    icon: <FaRobot size={28} />,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800"
  },
  {
    title: "Multi-Asset Tracking",
    desc: "Monitor Physical Cash, Bank Balances, E-Wallets, and Crypto Portfolios.",
    icon: <FaWallet size={28} />,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800"
  },
  {
    title: "Global Date Sync",
    desc: "Automatically syncs reports to your local calendar (BS, Hijri, AD).",
    icon: <HiOutlineGlobe size={28} />,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-800"
  },
  {
    title: "Military-Grade Vaults",
    desc: "Master PIN locks and AES-encryption for your sensitive seed phrases.",
    icon: <HiOutlineShieldCheck size={28} />,
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-800"
  }
];

const faqs = [
  { q: "Is my financial data secure?", a: "Yes. We use AES-256 encryption. Your highly sensitive data like Seed Phrases are heavily obfuscated and require a Master PIN to unlock." },
  { q: "Can I track both Crypto and Fiat?", a: "Absolutely! Finledger bridges the gap between traditional banking and decentralized finance. You can manage USD, INR, BTC, USDT, and more in one place." },
  { q: "Is the AI Advisor free to use?", a: "Yes, our base AI J.A.R.V.I.S provides standard portfolio analysis and rebalancing suggestions for all registered users." }
];

const Home = () => {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* 🚀 1. HERO SECTION */}
      <section id="hero" className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-500/10 dark:bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] mb-8 border border-slate-200 dark:border-slate-700 shadow-sm">
            <HiOutlineSparkles className="text-yellow-500" size={16} /> Welcome to the future of finance
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 dark:text-white tracking-tighter leading-[1.1] mb-8 drop-shadow-sm">
            The Ultimate <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Finance Engine.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 font-semibold max-w-2xl mx-auto mb-10 leading-relaxed">
            Track Fiat, trade Crypto, monitor your daily Expenses, and get AI-powered wealth strategies. Finledger is the only OS your money will ever need.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link to="/dashboard" className="w-full sm:w-auto px-10 py-4 md:py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3">
                Go to Dashboard <HiOutlineArrowRight size={20} />
              </Link>
            ) : (
              <>
                <Link to="/signup" className="w-full sm:w-auto px-10 py-4 md:py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3">
                  Start For Free <HiOutlineArrowRight size={20} />
                </Link>
                <Link to="/login" className="w-full sm:w-auto px-10 py-4 md:py-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 text-center shadow-sm">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* QUICK STATS BANNER */}
      <div className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          <div><h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">100%</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Data Privacy</p></div>
          <div><h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">AES</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">256-bit Encryption</p></div>
          <div><h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">24/7</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Live Market Sync</p></div>
          <div><h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">All</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Global Fiats</p></div>
        </div>
      </div>

      {/* 🚀 2. SERVICES SNIPPET */}
      <section id="services" className="py-24 max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            Powerful <span className="text-blue-600">Features.</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-lg">
            Everything you need to manage traditional banking and decentralized finance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-12">
          {topFeatures.map((feature, idx) => (
            <div key={idx} className="p-8 md:p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden">
              <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-50 transition-opacity duration-500 ${feature.bg.split(' ')[0]}`}></div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border ${feature.bg} ${feature.color} relative z-10 transition-transform group-hover:scale-110 duration-300`}>
                {feature.icon}
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight relative z-10">{feature.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed relative z-10">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/services" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md">
            Explore All 9+ Services <HiOutlineArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* 🚀 3. ABOUT SNIPPET (FIXED GREEN BLOB) */}
      <section id="about" className="py-24 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
              Built for the <br/><span className="text-emerald-500">Modern Investor.</span>
            </h2>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-lg leading-relaxed mb-6">
              Finledger was born out of a simple necessity: the financial world is fragmented. You have your bank apps, your crypto exchanges, your expense spreadsheets, and your physical cash.
            </p>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-lg leading-relaxed mb-10">
              We built a unified engine that brings all of these together. Empowered by AI, secured by AES, and localized to your specific culture's calendar.
            </p>
            <Link to="/about" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/30 active:scale-95">
              Read Our Full Story <HiOutlineArrowRight size={18} />
            </Link>
          </div>

          {/* 🚀 Sleek CSS-based Dashboard Graphic (No Image Needed!) */}
          <div className="relative h-[400px] w-full rounded-[3rem] bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
             {/* Abstract floating shapes */}
             <div className="absolute top-10 right-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl"></div>
             <div className="absolute bottom-10 left-10 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl"></div>
             
             {/* Mockup Center Card */}
             <div className="relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-8 rounded-[2rem] shadow-2xl border border-white/50 dark:border-slate-700/50 max-w-[250px] text-center w-full animate-in zoom-in-95 duration-1000">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FaChartLine size={32} />
                </div>
                <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-3"></div>
                <div className="h-2 w-20 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-8"></div>
                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
             </div>

             {/* Floating Mini Icons */}
             <div className="absolute top-[15%] left-[10%] bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl animate-bounce border border-slate-100 dark:border-slate-700">
               <FaBitcoin className="text-orange-500 text-3xl"/>
             </div>
             <div className="absolute bottom-[20%] right-[10%] bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl animate-bounce border border-slate-100 dark:border-slate-700" style={{animationDelay: '1s'}}>
               <FaWallet className="text-blue-500 text-3xl"/>
             </div>
          </div>
        </div>
      </section>

      {/* 🚀 4. FAQ SNIPPET */}
      <section id="faq" className="py-24 max-w-4xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Got Questions?</h2>
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-lg">We've got answers.</p>
        </div>

        <div className="space-y-4 mb-10">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden transition-all shadow-sm">
              <button onClick={() => setOpenFaq(openFaq === idx ? null : idx)} className="w-full flex items-center justify-between p-6 text-left focus:outline-none">
                <span className="font-black text-slate-800 dark:text-white text-lg pr-4">{faq.q}</span>
                <HiOutlineChevronDown className={`text-blue-500 text-2xl transition-transform duration-300 shrink-0 ${openFaq === idx ? 'rotate-180' : ''}`} />
              </button>
              <div className={`px-6 overflow-hidden transition-all duration-300 ${openFaq === idx ? 'max-h-40 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/faq" className="text-blue-600 dark:text-blue-400 font-black text-sm uppercase tracking-widest hover:underline flex items-center justify-center gap-2">
            View All FAQs <HiOutlineArrowRight />
          </Link>
        </div>
      </section>

      {/* 🚀 5. UPDATED SOCIALS & COMMUNITY */}
      <section id="socials" className="py-24 bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            Join the <span className="text-blue-600">Community.</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-lg mb-16 max-w-2xl mx-auto">
            Get real-time market updates, chat with other traders, and reach our support team 24/7.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Telegram Channel Card */}
            <a href="https://t.me/bpcryptocraft" target="_blank" rel="noopener noreferrer" className="group p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] hover:-translate-y-2 transition-all duration-300 shadow-sm hover:shadow-xl hover:border-sky-400 dark:hover:border-sky-500">
              <div className="w-16 h-16 bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                <FaTelegramPlane />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white text-xl mb-1">Channel</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Updates</p>
            </a>

            {/* Telegram Group Card */}
            <a href="https://t.me/cryptoandexpensestracker" target="_blank" rel="noopener noreferrer" className="group p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] hover:-translate-y-2 transition-all duration-300 shadow-sm hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                <FaUsers />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white text-xl mb-1">Group Chat</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Community</p>
            </a>

            {/* YouTube Card */}
            <a href="https://youtube.com/@bibekpoudel2642?si=od_dv3k5xhJMv580" target="_blank" rel="noopener noreferrer" className="group p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] hover:-translate-y-2 transition-all duration-300 shadow-sm hover:shadow-xl hover:border-red-400 dark:hover:border-red-500">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                <FaYoutube />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white text-xl mb-1">YouTube</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Video Guides</p>
            </a>

            {/* Contact Support Card */}
            <Link to="/contact" className="group p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] hover:-translate-y-2 transition-all duration-300 shadow-sm hover:shadow-xl hover:border-emerald-400 dark:hover:border-emerald-500">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                <HiOutlineChatAlt2 />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white text-xl mb-1">Support</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Help Desk</p>
            </Link>

          </div>
          
          {/* Facebook Link */}
          <div className="mt-8">
             <a href="https://www.facebook.com/share/18PN3Dan77/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-widest">
               <FaFacebook size={18} className="text-blue-600" /> Or follow us on Facebook
             </a>
          </div>
        </div>
      </section>

      {/* 🚀 6. FINAL CTA SECTION */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[3rem] p-10 md:p-20 text-center relative overflow-hidden shadow-2xl border border-blue-500/50">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
          
          <div className="relative z-10">
            <HiOutlineChartPie className="mx-auto text-6xl text-blue-300 mb-6 drop-shadow-lg" />
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6">
              Take Control of Your Wealth.
            </h2>
            <p className="text-blue-100 text-lg md:text-xl font-medium mb-10 max-w-2xl mx-auto">
              Join the elite group of individuals who manage their cash flow, crypto assets, and investments like pros. No credit card required.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link to="/dashboard" className="w-full sm:w-auto px-10 py-5 bg-white text-blue-600 hover:bg-slate-50 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2">
                  Launch Dashboard <HiOutlineArrowRight size={18} />
                </Link>
              ) : (
                <Link to="/signup" className="w-full sm:w-auto px-10 py-5 bg-white text-blue-600 hover:bg-slate-50 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2">
                  Create Free Account <HiOutlineLightningBolt size={18} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;