import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isPermanentEmail } from '../../utils/emailValidator';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineUser, HiOutlineCheckCircle, HiShieldCheck } from 'react-icons/hi';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
// 1. Captcha Import
import IconCaptcha from '../../components/ui/IconCaptcha';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  
  // 2. Captcha State
  const [isVerified, setIsVerified] = useState(false);

  const { signup, loginWithGoogle, loginWithGithub } = useAuth();
  const navigate = useNavigate();

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    
    // Security Check: Captcha must be verified
    if (!isVerified) {
      setError("Please verify the captcha first.");
      return;
    }

    if (!isPermanentEmail(email)) {
      setError("🚨 Access Denied: Temporary emails are strictly blocked.");
      return; 
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password, name);
      setIsSent(true); 
    } catch (err) {
      let friendlyMessage = err.message;
      if (err.code === 'auth/email-already-in-use') friendlyMessage = "This email is already registered.";
      if (err.code === 'auth/weak-password') friendlyMessage = "Password should be at least 6 characters.";
      setError(friendlyMessage || 'Failed to create an account.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = async (provider) => {
    try {
      setError('');
      setLoading(true);
      if (provider === 'google') await loginWithGoogle();
      if (provider === 'github') await loginWithGithub();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || `Failed to sign up with ${provider}.`);
    } finally {
      setLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 animate-in fade-in zoom-in-95 duration-700">
        <div className="w-full max-w-md text-center p-10 rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-emerald-500 rounded-full" />
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <HiOutlineCheckCircle size={40} className="animate-bounce" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4">Verify Your Email</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed text-sm">
            Humne ek link <span className="text-blue-600 font-bold underline">{email}</span> par bheja hai. Dashboard ke liye link verify karein.
          </p>
          <NavLink to="/login" className="block w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-lg shadow-blue-600/30 active:scale-95 transition-all">
            Back to Login
          </NavLink>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 animate-in fade-in zoom-in-95 duration-700">
      <div className="w-full max-w-md space-y-6 p-8 md:p-10 rounded-[3rem] bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-md">
        
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Create Account</h1>
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">International Finance Standards</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold text-center animate-shake">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => handleSocialSignup('google')} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 active:scale-95 transition-all">
            <FcGoogle size={18} /> <span className="text-[11px] font-black dark:text-white">Google</span>
          </button>
          <button onClick={() => handleSocialSignup('github')} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 active:scale-95 transition-all">
            <FaGithub size={18} className="dark:text-white" /> <span className="text-[11px] font-black dark:text-white">GitHub</span>
          </button>
        </div>

        <form onSubmit={handleEmailSignup} className="space-y-4">
          <div className="space-y-3">
            <div className="relative group">
              <HiOutlineUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
              <input type="text" required placeholder="Full Name" className="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none dark:text-white" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="relative group">
              <HiOutlineMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
              <input type="email" required placeholder="Email Address" className="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none dark:text-white" onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="relative group">
              <HiOutlineLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
              <input type="password" required placeholder="Create Password" minLength={6} className="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none dark:text-white" onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          {/* 3. Captcha Component - Yahan Pass Kiya Callback */}
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
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating Account...</span>
              </div>
            ) : (
              <>
                {!isVerified && <HiShieldCheck size={18} />}
                {isVerified ? 'Create Verified Account' : 'Verify Captcha to Continue'}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs font-bold text-slate-500">
          Already a trusted member? <NavLink to="/login" className="text-blue-600 hover:underline">Login</NavLink>
        </p>
      </div>
    </div>
  );
};

export default Signup;