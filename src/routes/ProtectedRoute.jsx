import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children }) => {
  // ✅ FIX: dbData ko import kiya taaki PIN status check kar sakein
  const { user, loading, dbData } = useAuth();
  const location = useLocation();

  // 1. Loading State (Premium UI)
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
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

  // 2. Not Logged In -> Redirect to Login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. 🛡️ 2FA Gatekeeper Logic (THE REAL SECURITY)
  const isPinSet = dbData?.security?.isPinSet;
  const is2faPassed = sessionStorage.getItem('is2faPassed') === 'true';

  // Agar user ka PIN set hai, aur usne abhi tak PIN enter nahi kiya hai, 
  // aur wo /verify-pin page par nahi hai -> Toh usko wapas /verify-pin par bhejo.
  if (isPinSet && !is2faPassed && location.pathname !== '/verify-pin') {
    return <Navigate to="/verify-pin" replace />;
  }

  // 4. Email Verification Guard (Optional/Future)
  // Jab aapko Email Verification strictly enforce karna ho, tab is block ko uncomment kar lein
  /*
  const isSocialUser = user?.providerData?.some(p => p.providerId === 'google.com' || p.providerId === 'github.com');
  if (!user.emailVerified && !isSocialUser) {
    return <Navigate to="/verify-email" state={{ from: location }} replace />;
  }
  */

  // 5. Access Granted ✅
  return children;
};

export default ProtectedRoute;