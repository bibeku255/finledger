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
      // Agar kuch error aaye, toh safe side dashboard par bhej do (ProtectedRoute handle kar lega)
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
      
      // 🚀 SECURITY UPGRADE: Check email verification BEFORE querying the database
      if (!userCredential.user.emailVerified) {
        navigate('/verify-email');
        return; // Stop execution here
      }

      // Login success & Verified! Ab PIN check karo
      await checkPinAndRedirect(userCredential.user.uid);
    } catch (err) {
      // 🧠 Smart Error Handling for Brute Force Protection
      if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Account temporarily locked. Try resetting your password.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else {
        setError('Failed to securely login. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      setLoading(true);
      setError('');
      let userCredential;
      if (provider === 'google') userCredential = await loginWithGoogle();
      if (provider === 'github') userCredential = await loginWithGithub();
      
      // Social login success! (Google/Github accounts are auto-verified by Firebase)
      if (userCredential && userCredential.user) {
         await checkPinAndRedirect(userCredential.user.uid);
      } else {
         navigate('/dashboard'); // Fallback
      }
    } catch (err) {
      // User closed the popup or network error
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelled by user.');
      } else {
        setError(`Failed to sign in securely with ${provider}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-700 px-4">
      <div className="w-full max-w-md space-y-6 p-8 md:p-10 rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden transition-colors duration-300">
        
        {/* Glow Effect */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-600/10 dark:bg-blue-500/20 blur-3xl rounded-full transition-colors duration-300" />

        <div className="text-center space-y-2 relative z-10">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce-slow border border-blue-100 dark:border-blue-500/20 transition-colors duration-300">
            <HiOutlineShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight transition-colors duration-300">Welcome Back</h1>
          <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] transition-colors duration-300">Secure Access Portal</p>
        </div>

        {error && (
          <div className="relative z-10 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold text-center animate-shake transition-colors duration-300">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4 relative z-10">
          <div className="space-y-3">
            <div className="relative group">
              <HiOutlineMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" size={18} />
              <input 
                type="email" required placeholder="Email Address"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-500/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all duration-300"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <HiOutlineLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" size={18} />
              <input 
                type="password" required placeholder="Password"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-500/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all duration-300"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 border-2 border-slate-300 dark:border-slate-600 rounded-md checked:bg-blue-600 dark:checked:bg-blue-500 transition-all cursor-pointer"
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 transition-colors duration-300">Remember Me</span>
            </label>
            <NavLink to="/forgot-password" virtual="true" className="text-[11px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-300">
              Forgot?
            </NavLink>
          </div>

          {/* Captcha Integration */}
          <IconCaptcha onVerify={(val) => setIsVerified(val)} />

          <button 
            type="submit"
            disabled={loading || !isVerified}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-sm transition-all duration-300 shadow-xl
              ${isVerified 
                ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-blue-600/20 dark:shadow-blue-500/20 active:scale-95' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'}
            `}
          >
            {loading ? 'Authenticating...' : isVerified ? 'Secure Sign In' : 'Verify to Unlock'}
            {!loading && <HiOutlineArrowRight size={18} />}
          </button>
        </form>

        <div className="relative flex items-center justify-center py-2 z-10">
          <div className="w-full h-px bg-slate-200 dark:bg-slate-800 transition-colors duration-300" />
          <span className="absolute px-4 bg-white dark:bg-slate-900 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">
            Social Gateway
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          <button onClick={() => handleSocialLogin('google')} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 transition-all duration-300">
            <FcGoogle size={18} /> <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 transition-colors duration-300">Google</span>
          </button>
          <button onClick={() => handleSocialLogin('github')} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 transition-all duration-300">
            <FaGithub size={18} className="text-slate-700 dark:text-slate-300 transition-colors duration-300" /> <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 transition-colors duration-300">GitHub</span>
          </button>
        </div>

        <p className="text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 relative z-10 transition-colors duration-300">
          New to the platform? {' '}
          <NavLink to="/signup" className="text-blue-600 dark:text-blue-400 font-black hover:underline transition-colors duration-300">Create Account</NavLink>
        </p>
      </div>
    </div>
  );
};

export default Login;