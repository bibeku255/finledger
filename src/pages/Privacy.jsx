import React from 'react';
import { HiOutlineLockClosed } from 'react-icons/hi';

const Privacy = () => {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pt-24 pb-24 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-4">
            <HiOutlineLockClosed size={16} /> Data Safety
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Effective Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="space-y-8">
          
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">1. Information We Collect</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              To provide our services, we collect basic profile information (Email, Name) during authentication via Firebase. We also store the financial logs, transaction history, and custom settings you actively input into your dashboard.
            </p>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-500/10 p-8 rounded-[2rem] border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
            <h2 className="text-xl font-black text-emerald-700 dark:text-emerald-400 mb-4">2. Extreme Security & Encryption</h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium mb-4">
              We take the security of your sensitive data very seriously:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 font-medium">
              <li><strong>Secure Notes:</strong> Any seed phrases or passwords stored in the "Secure Notes" feature are obfuscated on the client side before reaching our database.</li>
              <li><strong>PIN Protection:</strong> Accessing sensitive actions or secure vaults requires a one-way hashed Master PIN. Even database administrators cannot read your PIN.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">3. Data Sharing & Third Parties</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              We <strong>never</strong> sell, rent, or trade your personal financial data to advertisers. We only interact with third-party APIs (like CoinGecko) strictly to fetch anonymous market data (e.g., retrieving the current price of Bitcoin). Your personal holdings are never broadcasted to these APIs.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">4. Your Data Rights</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              You have complete control over your data. You can edit, delete, or wipe your transaction history at any time. If you wish to permanently delete your account and all associated data from our servers, you may contact our support team.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Privacy;