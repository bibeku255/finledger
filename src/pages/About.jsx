import React from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineLightningBolt, HiOutlineShieldCheck, HiOutlineGlobe, HiOutlineArrowRight } from 'react-icons/hi';
import { FaRobot, FaRocket, FaUsers } from 'react-icons/fa';

const About = () => {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pt-24 pb-20 animate-in fade-in duration-700">
      
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 text-center mb-20">
        <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-6 border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <FaRocket size={14} /> Our Mission & Vision
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter mb-6">
          Redefining the future of <br className="hidden md:block"/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">Personal Finance.</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
          Finledger was built on a simple premise: managing money shouldn't require jumping between ten different apps. We bridge the gap between traditional fiat and decentralized crypto, powered by localized date systems and advanced AI.
        </p>
      </div>

      {/* Core Values Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-2 transition-transform">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl mb-6">
              <FaRobot />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">AI-Driven</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium">We don't just show you numbers. Our AI J.A.R.V.I.S actively analyzes your vaults to suggest profitable strategies.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-2 transition-transform">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 rounded-2xl flex items-center justify-center text-2xl mb-6">
              <HiOutlineShieldCheck />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">Total Security</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Your data is yours alone. With AES-256 encryption and Master PIN locks, your financial privacy is our highest priority.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-2 transition-transform">
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500 rounded-2xl flex items-center justify-center text-2xl mb-6">
              <HiOutlineGlobe />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">Deep Localization</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium">From Nepali Bikram Sambat to Islamic Hijri, we natively support the calendar and currency you actually use.</p>
          </div>

        </div>
      </div>

      {/* Story Section */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 text-center mb-24">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">Built by Believers.</h2>
        <p className="text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-8">
          We started as a group of traders and developers tired of fragmented financial tools. The crypto markets move too fast, and traditional banks move too slow. Finledger is our answer—a seamless, high-performance engine that gives you a birds-eye view of your entire net worth.
        </p>
        <Link to="/signup" className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg">
          Join Our Journey <HiOutlineArrowRight size={18} />
        </Link>
      </div>

    </div>
  );
};

export default About;