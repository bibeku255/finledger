// src/routes/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToastNotification'; // 🚀 IMPORTED TOAST
import { HiOutlineMail, HiOutlineRefresh, HiOutlineExclamationCircle } from 'react-icons/hi';
import { sendEmailVerification } from 'firebase/auth';

/**
 * ✅ PROTECTED ROUTE COMPONENT (J.A.R.V.I.S Gatekeeper)
 * * Multi-level security gate for authenticated pages:
 * 1️⃣ Loading Check - Show spinner while verifying auth
 * 2️⃣ Login Check - Is user logged in?
 * 3️⃣ Email Verification - Is email verified? (Checked first for security)
 * 4️⃣ 2FA Check - Has user passed PIN verification?
 * 5️⃣ Access Granted - Show protected page
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading, dbData } = useAuth();
  const { addToast } = useToast(); // 🚀 INITIALIZED TOAST
  const location = useLocation();

  // ═══════════════════════════════════════════════════════════════════════
  // 1️⃣ LOADING STATE - Show spinner while checking auth state
  // ═══════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-transparent">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
          </div>
        </div>
        <p className="mt-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] animate-pulse">
          Securing Connection...
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2️⃣ LOGIN CHECK - Is user logged in?
  // ═══════════════════════════════════════════════════════════════════════
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3️⃣ EMAIL VERIFICATION CHECK - Is email verified? (Shifted UP ⬆️)
  // ═══════════════════════════════════════════════════════════════════════
  const isSocialUser = user?.providerData?.some(
    p => p.providerId === 'google.com' || p.providerId === 'github.com'
  );

  // ✅ Social login users are auto-verified, so skip email check for them
  if (!user.emailVerified && !isSocialUser) {

    const handleResend = async () => {
      try {
        await sendEmailVerification(user);
        addToast('Verification email sent! Check your inbox and spam folder.', 'success');
      } catch (error) {
        if (error.code === 'auth/too-many-requests') {
          addToast('Too many requests. Please wait a minute before resending.', 'error');
        } else {
          addToast('Failed to resend verification email. Try again later.', 'error');
        }
      }
    };

    const handleRefresh = async () => {
      try {
        await user.reload(); // Fetch latest data from Firebase
        if (user.emailVerified) {
          addToast('Email verified successfully! Welcome aboard.', 'success');
          window.location.reload();
        } else {
          addToast('Email is still unverified. Please check your inbox.', 'warning');
        }
      } catch (error) {
        addToast('Failed to sync data. Please try again.', 'error');
      }
    };

    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-transparent px-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center max-w-md bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800">
          {/* Icon */}
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <HiOutlineMail size={40} />
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-2">
            Verify Your Email
          </h1>

          {/* Description */}
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
            We've sent a verification link to <br />
            <strong className="text-blue-600 dark:text-blue-400 break-all">{user.email}</strong>
            <br />
            <span className="text-[11px] uppercase tracking-widest font-bold mt-2 block">Please check your inbox and spam folder.</span>
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Resend Button */}
            <button
              onClick={handleResend}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
            >
              <HiOutlineRefresh size={18} />
              Resend Link
            </button>

            {/* Already Verified Refresh Button */}
            <button
              onClick={handleRefresh}
              className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
            >
              I Have Verified (Refresh)
            </button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-6 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex gap-2 items-start text-left border border-amber-200 dark:border-amber-500/20 font-medium">
            <HiOutlineExclamationCircle size={24} className="shrink-0 mt-0.5" />
            <span>
              If you don't verify your email, J.A.R.V.I.S will block access to your financial vaults to prevent unauthorized entry.
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4️⃣ 2FA CHECK - Has user passed PIN verification? (Shifted DOWN ⬇️)
  // ═══════════════════════════════════════════════════════════════════════
  const isPinSet = dbData?.security?.isPinSet;
  const is2faPassed = sessionStorage.getItem('is2faPassed') === 'true';

  if (isPinSet && !is2faPassed && location.pathname !== '/verify-pin') {
    return <Navigate to="/verify-pin" replace />;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5️⃣ ALL CHECKS PASSED ✅ - Grant access to protected page
  // ═══════════════════════════════════════════════════════════════════════
  return children;
};

export default ProtectedRoute;