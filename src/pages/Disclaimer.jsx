import React from 'react';
import { HiOutlineExclamationCircle, HiOutlineShieldExclamation, HiOutlineTrendingDown } from 'react-icons/hi';
import { FaRobot } from 'react-icons/fa';

const Disclaimer = () => {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pt-24 pb-24 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 font-black text-[10px] uppercase tracking-widest mb-4">
            <HiOutlineExclamationCircle size={16} /> Important Legal Notice
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            Platform Disclaimer
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="space-y-8">
          
          {/* CRITICAL WARNING CARD */}
          <div className="bg-rose-50 dark:bg-rose-500/10 p-8 rounded-[2rem] border border-rose-200 dark:border-rose-900/50 shadow-sm relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 opacity-5 text-rose-500"><HiOutlineShieldExclamation size={200} /></div>
            <h2 className="text-xl font-black text-rose-600 dark:text-rose-400 mb-4 relative z-10 flex items-center gap-2">
              1. Not a Financial Advisor or Earning Platform
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium relative z-10">
              Finledger is strictly a <strong>financial tracking and portfolio management utility</strong>. We are <strong>NOT</strong> an earning platform, investment broker, or trading exchange. You cannot deposit, trade, or earn money directly through our platform. All data shown is for informational and tracking purposes only.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FaRobot className="text-blue-500" /> 2. AI Strategy & Information Only
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-4">
              The AI Strategy feature (J.A.R.V.I.S) generates insights based strictly on the mathematical data and logs you input into the system. 
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400 font-medium">
              <li>The AI does <strong>not</strong> predict market movements.</li>
              <li>The insights provided are general observations of your activity, <strong>not</strong> financial advice.</li>
              <li>Users should <strong>never</strong> risk, invest, or waste money solely based on AI-generated suggestions.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <HiOutlineTrendingDown className="text-orange-500" /> 3. Market Risks & Third-Party Data
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Cryptocurrency and Forex markets are highly volatile. While we strive to provide real-time data using reliable third-party APIs (such as CoinGecko and ExchangeRate-API), we do not guarantee the absolute accuracy, timeliness, or completeness of the market prices displayed. You are solely responsible for verifying prices before making any actual trades on external platforms.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">4. Limitation of Liability</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Under no circumstances shall Finledger, its developers, or affiliates be held liable for any direct, indirect, incidental, or consequential financial losses resulting from the use of our app, reliance on our AI, or inaccuracies in the tracked data. <strong>Your financial decisions are 100% your own responsibility.</strong>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Disclaimer;