// src/pages/Login.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineArrowRight, HiOutlineShieldCheck } from 'react-icons/hi';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';

// Firebase imports for checking PIN status
import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

// Captcha Import
import IconCaptcha from '../../components/ui/IconCaptcha';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); // Can be used for local/session storage later
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Captcha State
  const [isVerified, setIsVerified] = useState(false);

  const { login, loginWithGoogle, loginWithGithub } = useAuth();
  const navigate = useNavigate();

  // 🛡️ THE GATEKEEPER LOGIC: Check if user has PIN set
  const checkPinAndRedirect = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      const isPinSet = userDoc.data()?.security?.isPinSet;

      if (isPinSet) {
        // PIN set hai, The Gatekeeper ke paas bhejo
        navigate('/verify-pin');
      } else {
        // PIN set nahi hai, seedha dashboard par bhejo
        navigate('/dashboard');
      }
    } catch (err) {
      console.error("Error checking PIN status:", err);
      // Agar kuch error aaye, toh safe side dashboard par bhej do (baad mein handle karenge)
      navigate('/dashboard');
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    
    if (!isVerified) {
      setError("Please verify the security captcha.");
      return;
    }

    try {
      setError('');
      setLoading(true);
      const userCredential = await login(email, password);
      // Login success! Ab PIN check karo
      await checkPinAndRedirect(userCredential.user.uid);
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      setLoading(true);
      let userCredential;
      if (provider === 'google') userCredential = await loginWithGoogle();
      if (provider === 'github') userCredential = await loginWithGithub();
      
      // Social login success! Ab PIN check karo
      if (userCredential && userCredential.user) {
         await checkPinAndRedirect(userCredential.user.uid);
      } else {
         navigate('/dashboard'); // Fallback
      }
    } catch (err) {
      setError(`Failed to sign in with ${provider}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-700 px-4">
      <div className="w-full max-w-md space-y-6 p-8 md:p-10 rounded-[3rem] bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-md">
        
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full" />

        <div className="text-center space-y-2 relative">
          <div className="w-14 h-14 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
            <HiOutlineShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Welcome Back</h1>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Secure Access Portal</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold text-center animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-3">
            <div className="relative group">
              <HiOutlineMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="email" required placeholder="Email Address"
                className="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none transition-all dark:text-white"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <HiOutlineLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="password" required placeholder="Password"
                className="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none transition-all dark:text-white"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 border-2 border-slate-200 dark:border-white/10 rounded-md checked:bg-blue-600 transition-all"
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="text-[11px] font-bold text-slate-500">Remember Me</span>
            </label>
            <NavLink to="/forgot-password" virtual className="text-[11px] font-black text-blue-600 hover:text-blue-500">
              Forgot?
            </NavLink>
          </div>

          {/* Captcha Integration */}
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
            {loading ? 'Authenticating...' : isVerified ? 'Secure Sign In' : 'Verify to Unlock'}
            {!loading && <HiOutlineArrowRight size={18} />}
          </button>
        </form>

        <div className="relative flex items-center justify-center py-2">
          <div className="w-full h-[1px] bg-slate-100 dark:bg-white/5" />
          <span className="absolute px-4 bg-white dark:bg-[#0f172a] text-[10px] font-black text-slate-400 uppercase tracking-widest text-[8px]">Social Gateway</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => handleSocialLogin('google')} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 active:scale-95 transition-all">
            <FcGoogle size={18} /> <span className="text-[11px] font-black dark:text-white">Google</span>
          </button>
          <button onClick={() => handleSocialLogin('github')} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 active:scale-95 transition-all">
            <FaGithub size={18} className="dark:text-white" /> <span className="text-[11px] font-black dark:text-white">GitHub</span>
          </button>
        </div>

        <p className="text-center text-xs font-bold text-slate-500">
          New to the platform? {' '}
          <NavLink to="/signup" className="text-blue-600 font-black hover:underline">Create Account</NavLink>
        </p>
      </div>
    </div>
  );
};

export default Login;