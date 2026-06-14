import React from 'react';
import { HiOutlineDocumentText } from 'react-icons/hi';

const Terms = () => {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pt-24 pb-24 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest mb-4">
            <HiOutlineDocumentText size={16} /> User Agreement
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Effective Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              By creating an account and using Finledger ("Service", "Platform"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must discontinue use of the platform immediately.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">2. Nature of the Service</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-4">
              Finledger is a personal finance tracker and portfolio aggregator. 
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400 font-medium">
              <li>We do not hold custody of your fiat currency or digital assets.</li>
              <li>We do not facilitate actual trading, swaps, or transfers of real money.</li>
              <li>Any functionality named "Vault", "Staking", or "Swap" is strictly for manual logging and simulation purposes.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">3. User Responsibilities</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              You are entirely responsible for the data you input into the system. Furthermore, you are responsible for maintaining the confidentiality of your account credentials and your Master Security PIN. Finledger cannot recover your Master PIN if lost, nor can we recover obfuscated Secure Notes without it.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">4. Termination of Accounts</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              We reserve the right to suspend or terminate accounts that violate these terms, attempt to hack or exploit the system, or engage in abusive behavior towards our platform or other users.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Terms;