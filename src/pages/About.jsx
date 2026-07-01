import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  HiOutlineLightningBolt, HiOutlineShieldCheck, HiOutlineGlobe, HiOutlineArrowRight, 
  HiOutlineChevronDown, HiOutlineCode, HiOutlineServer, HiOutlineUsers,
  HiOutlineQuestionMarkCircle
} from 'react-icons/hi';
import { FaRobot, FaRocket, FaUsers, FaGithub, FaTelegramPlane, FaReact, FaFire, FaDatabase, FaChartBar, FaGlobeAmericas } from 'react-icons/fa';


// ─── STATS DATA ──────────────────────────────────────
const stats = [
  { value: '10K+', label: 'Lines of Code', icon: <HiOutlineCode size={20} /> },
  { value: '15+', label: 'Features Built', icon: <HiOutlineLightningBolt size={20} /> },
  { value: '3', label: 'Firebase Services', icon: <FaDatabase size={20} /> },
  { value: '99.9%', label: 'Uptime Goal', icon: <HiOutlineServer size={20} /> },
];

// ─── ANIMATION VARIANTS ─────────────────────────────────
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } }
};

// ─── COMPONENT ───────────────────────────────────────────
const About = () => {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pt-24 pb-20 animate-in fade-in duration-700">

      {/* ═══════════════════════════════════════════════════════════════
          1. HERO SECTION
         ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 text-center mb-20">
        <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-6 border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <FaRocket size={14} /> Our Mission & Vision
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter mb-6">
          Redefining the future of <br className="hidden md:block" />{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">Personal Finance.</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
          Finledger was built on a simple premise: managing money shouldn't require jumping between ten different apps. We bridge the gap between traditional fiat and decentralized crypto, powered by localized date systems and advanced AI.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. CORE VALUES GRID
         ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-2 transition-all duration-500 group hover:shadow-xl hover:border-blue-500/30">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
              <FaRobot />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">AI-Driven</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">We don't just show you numbers. Our AI J.A.R.V.I.S actively analyzes your vaults to suggest profitable strategies and risk alerts.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-2 transition-all duration-500 group hover:shadow-xl hover:border-rose-500/30">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
              <HiOutlineShieldCheck />
            </div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3">Total Security</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Your data is yours alone. With AES-256 encryption and Master PIN locks, your financial privacy is our highest priority.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-2 transition-all duration-500 group hover:shadow-xl hover:border-purple-500/30">
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
              <HiOutlineGlobe />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">Deep Localization</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">From Nepali Bikram Sambat to Islamic Hijri, we natively support the calendar and currency you actually use.</p>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. STATS SECTION (NEW)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((stat, i) => (
            <div 
              key={i} 
              className="text-center p-5 md:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20 hover:scale-105 transition-transform duration-300"
            >
              <div className="text-blue-500 mb-2 flex justify-center">{stat.icon}</div>
              <p className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400">{stat.value}</p>
              <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          5. FOUNDER / TEAM SECTION (NEW)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mb-24">
        <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-shadow duration-500">
          <div className="flex flex-col md:flex-row items-center gap-8">
            
            {/* Profile Image */}
            <div className="shrink-0">
              <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-4 border-blue-500/20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 mx-auto md:mx-0">
                <img 
                  src="https://ui-avatars.com/api/?name=Bibek+Poudel&background=2563eb&color=fff&size=200&bold=true" 
                  alt="Bibek Poudel - Founder" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></div>
              </div>
            </div>

            {/* Info */}
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center justify-center md:justify-start gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest mb-3 border border-blue-200 dark:border-blue-800 w-fit">
                <HiOutlineLightningBolt size={12} /> Founder & Developer
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-3">
                Bibek Poudel
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-5">
                Full-stack developer passionate about crypto and personal finance. Built Finledger to solve my own tracking problems — tracking fiat across cash, bank, and crypto was a nightmare. Now it's a unified, AI-powered engine.
              </p>

              {/* Social Links */}
              <div className="flex gap-3 justify-center md:justify-start">
                <a 
                  href="https://t.me/bpcryptocraft" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all hover:scale-110"
                >
                  <FaTelegramPlane />
                </a>
                <a 
                  href="https://github.com/bibeku255" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all hover:scale-110"
                >
                  <FaGithub />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      
      {/* ═══════════════════════════════════════════════════════════════
          8. CTA SECTION
         ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="bg-gradient-to-br from-emerald-600 via-blue-600 to-indigo-700 p-10 md:p-16 rounded-[3rem] text-center relative overflow-hidden shadow-2xl border border-emerald-500/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)]" />
          
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-4">
              Ready to Take Control?
            </h2>
            <p className="text-emerald-100 text-lg font-medium mb-8 max-w-2xl mx-auto">
              Join thousands managing their wealth smarter with Finledger. Free forever, always improving.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to="/signup" 
                className="w-full sm:w-auto px-10 py-5 bg-white text-emerald-700 hover:bg-slate-50 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 group border border-white hover:border-slate-200"
              >
                Get Started Free <HiOutlineArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                to="/blogs" 
                className="w-full sm:w-auto px-10 py-5 bg-transparent border-2 border-white/30 hover:border-white text-white hover:bg-white/10 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                Read Our Blog <HiOutlineArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default About;