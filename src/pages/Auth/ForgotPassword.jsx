// src/pages/Auth/ForgotPassword.jsx
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isPermanentEmail } from '../../utils/emailValidator'; // ✅ Imported Validator
import { HiOutlineMail, HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineShieldCheck } from 'react-icons/hi';
// Captcha Import
import IconCaptcha from '../../components/ui/IconCaptcha';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Captcha State
  const [isVerified, setIsVerified] = useState(false);
  
  const { resetPassword } = useAuth(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Security Guard 1: Captcha Check
    if (!isVerified) {
      setError("Please solve the security puzzle first.");
      return;
    }

    // Security Guard 2: Domain Check (Prevents Firebase API Spam)
    if (!isPermanentEmail(email)) {
      setError("🚨 Access Denied: Temporary or invalid email domains are not allowed.");
      return; 
    }

    try {
      setMessage('');
      setError('');
      setLoading(true);
      
      await resetPassword(email);
      
      setMessage('Humne recovery instructions aapke inbox mein bhej diye hain.');
    } catch (err) {
      // Smart Error Handling
      let friendlyMessage = 'System ko yeh email nahi mila. Please check karein.';
      if (err.code === 'auth/too-many-requests') {
        friendlyMessage = 'Too many attempts. Please try again later.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = 'Email format sahi nahi hai.';
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 animate-in fade-in zoom-in-95 duration-700">
      <div className="w-full max-w-md space-y-6 p-8 md:p-12 rounded-[3rem] bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-md">
        
        {/* Back Link */}
        <NavLink 
          to="/login" 
          className="inline-flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest"
        >
          <HiOutlineArrowLeft size={16} />
          Back to Login
        </NavLink>

        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <HiOutlineShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Recover Access</h1>
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed px-4">
            Apna registered email daalein hum aapko recovery link bhejenge.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold text-center animate-shake">
            {error}
          </div>
        )}

        {message ? (
          <div className="text-center space-y-6 py-4 animate-in slide-in-from-bottom-4">
            <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner shadow-emerald-500/20">
              <HiOutlineCheckCircle size={40} className="animate-pulse" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {message}
            </p>
            <NavLink 
              to="/login" 
              className="block w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
            >
              Return to Login
            </NavLink>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative group">
              <HiOutlineMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="email" 
                required 
                placeholder="Email Address"
                className="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none transition-all dark:text-white"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Icon Captcha Logic */}
            <IconCaptcha onVerify={(val) => setIsVerified(val)} />

            <button 
              type="submit"
              disabled={loading || !isVerified}
              className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-sm transition-all shadow-xl
                ${isVerified 
                  ? 'bg-blue-600 text-white shadow-blue-600/20 hover:scale-[1.02] active:scale-95' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-70'}
              `}
            >
              {loading ? 'Sending Request...' : isVerified ? 'Send Recovery Link' : 'Complete Verification'}
            </button>
          </form>
        )}

        <p className="text-center text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-100 dark:border-white/5">
          Having trouble? <NavLink to="/contact" className="text-blue-600 font-black hover:underline">Contact Support</NavLink>
        </p>

      </div>
    </div>
  );
};

export default ForgotPassword;