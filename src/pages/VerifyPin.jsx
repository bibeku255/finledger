// src/pages/VerifyPin.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { HiOutlineShieldCheck, HiOutlineArrowRight, HiOutlineLogout } from 'react-icons/hi';
import { verifyPINEnhanced } from '../utils/securityUtils'; // ✅ Naya enhanced import

const VerifyPin = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { user, dbData, logout } = useAuth();
  const navigate = useNavigate();

  // Agar user bina login ke yahan aa jaye, toh wapas Login par bhejo
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setError("Please enter your 4-6 digit passcode.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      // ✅ Enhanced verification (rate limiting, lockout, auto-upgrade)
      const result = await verifyPINEnhanced(pin, dbData?.security?.pinHash, user.uid);

      if (result.valid) {
        // Auto-upgrade old hash to v3 if needed
        if (result.upgraded && result.newHash) {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../firebase/firebaseConfig');
          await setDoc(doc(db, "users", user.uid), 
            { security: { pinHash: result.newHash } }, 
            { merge: true }
          );
        }
        sessionStorage.setItem('is2faPassed', 'true');
        navigate('/dashboard');
      } else {
        // result.message contains lockout or error info
        setError(result.message || "Incorrect Passcode. Access Denied! 🛑");
        setPin('');
      }
    } catch (err) {
      console.error(err);
      setError("Verification failed due to a system error.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-700 px-4">
      <div className="w-full max-w-md space-y-8 p-8 md:p-10 rounded-[3rem] bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-md">
        
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />

        <div className="text-center space-y-3 relative">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner shadow-emerald-500/20">
            <HiOutlineShieldCheck size={36} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">2FA Verification</h1>
          <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400">
            Dashboard is locked. Please enter your secure passcode to continue.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-black text-center animate-shake uppercase tracking-wider">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="relative">
            <input 
              type="password" 
              maxLength="6"
              inputMode="numeric"
              autoFocus
              required 
              placeholder="Enter Passcode"
              className="w-full bg-slate-50 dark:bg-slate-950/50 border border-transparent focus:border-emerald-500/50 rounded-2xl py-5 text-center text-2xl tracking-[0.5em] font-black outline-none transition-all dark:text-white shadow-inner"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // Only numbers
            />
          </div>

          <button 
            type="submit"
            disabled={loading || pin.length < 4}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-sm transition-all shadow-xl
              ${pin.length >= 4 
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-500/20 hover:scale-[1.02] active:scale-95' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-70'}
            `}
          >
            {loading ? 'Verifying...' : 'Unlock Dashboard'}
            {!loading && <HiOutlineArrowRight size={18} />}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors uppercase tracking-widest"
          >
            <HiOutlineLogout size={16} /> Cancel & Logout
          </button>
        </div>

      </div>
    </div>
  );
};

export default VerifyPin;