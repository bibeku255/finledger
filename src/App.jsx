// src/App.jsx
import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './hooks/useToastNotification';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute from './routes/PublicRoutes';
import { CryptoPriceProvider } from './context/CryptoPriceContext';
import { HiOutlineArrowLeft } from 'react-icons/hi';

// ─────────────────────────────────────────────
// Route Loader (✅ Fixed Dark/Light Mode Visibility)
// ─────────────────────────────────────────────
const RouteLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-600 dark:border-blue-400/20 dark:border-t-blue-500 rounded-full animate-spin shadow-lg" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2.5 h-2.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-ping" />
      </div>
    </div>
    {/* ✅ Text visibility fixed for both modes */}
    <p className="mt-8 text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.3em] animate-pulse">
      Initializing J.A.R.V.I.S Engine...
    </p>
  </div>
);

// ─────────────────────────────────────────────
// 404 Not Found (✅ Fixed Dark/Light Mode Visibility)
// ─────────────────────────────────────────────
const NotFound = () => (
  <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300 px-4">
    <div className="text-center max-w-md p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800">
      <h1 className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 mb-4 drop-shadow-sm">
        404
      </h1>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-widest">
        Vault Not Found
      </h2>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
        The financial coordinates you are looking for do not exist or have been moved.
      </p>
      <a
        href="/dashboard"
        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 hover:from-slate-800 hover:to-slate-700 dark:hover:from-slate-200 dark:hover:to-slate-300 text-white dark:text-slate-900 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-slate-900/20 dark:shadow-white/10 w-full"
      >
        <HiOutlineArrowLeft size={16} /> Return to Dashboard
      </a>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Public Pages
// ─────────────────────────────────────────────
import Home from './pages/Home';
import Services from './pages/Services';
import Blogs from './pages/Blogs';
import BlogDetail from './pages/BlogDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import Faq from './pages/Faq';

// Auth Pages
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ForgotPassword from './pages/Auth/ForgotPassword';

// Legal & Support
import Support from './pages/Support';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Disclaimer from './pages/Disclaimer';

// Admin
import WriteBlog from './pages/WriteBlog';

// Dashboard & Security
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import VerifyPin from './pages/VerifyPin';
import SetCurrency from './pages/SetCurrency';

// Money & Capital
import CashWallet from './pages/accounts/CashWallet';
import BankWallet from './pages/accounts/BankWallet';
import OnlineWallet from './pages/accounts/OnlineWallet';
import CapitalShifting from './pages/accounts/CapitalShifting';
import IncomeStreams from './pages/accounts/IncomeStreams';
import ExpenseTracker from './pages/accounts/ExpenseTracker';
import HistoryLogs from './pages/accounts/HistoryLogs';

// Party/Khata
import PartyDirectory from './pages/parties/PartyDirectory';
import PartyLedger from './pages/parties/PartyLedger';

// Crypto
import CryptoManager from './pages/CryptoManager';
import CryptoWallet from './pages/crypto/CryptoWallet';
import MicroEarn from './pages/crypto/MicroEarn';
import HoldAndSwap from './pages/crypto/HoldAndSwap';
import SwapAndBridge from './pages/crypto/SwapAndBridge';
import StakingAndYield from './pages/crypto/StakingAndYield';

// Insights & Analytics
import Analytics from './pages/insights/Analytics';
import SmartSuggestions from './pages/insights/SmartSuggestions';
import AiStrategy from './pages/insights/AiStrategy';
import Goals from './pages/insights/Goals';

// Alerts & Utilities
import BillPayments from './pages/alerts/BillPayments';
import SmartCalendar from './pages/SmartCalendar';

// Smart Tools
import SecureNotes from './pages/tools/SecureNotes';
import CryptoForex from './pages/tools/CryptoForex';

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────
function App() {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center transition-colors duration-300">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute animate-ping h-24 w-24 rounded-full bg-blue-500/20 dark:bg-blue-400/20"></div>
          <div className="relative animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 border-b-blue-600 dark:border-b-blue-400"></div>
          <div className="absolute h-6 w-6 bg-blue-600 dark:bg-blue-400 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
        </div>
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] animate-pulse">
          Authenticating...
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        {/* ✅ FIX: CryptoPriceProvider moved OUTSIDE AppLayout
            so useAIBrain (called in RightActions/Navbar) can access
            useCryptoPrice from anywhere in the tree */}
        <CryptoPriceProvider>
          <AppLayout>
            <Suspense fallback={<RouteLoader />}>
              <Routes>

                {/* ── Public Routes ── */}
                <Route path="/" element={<Home />} />
                <Route path="/services" element={<Services />} />
                <Route path="/blogs" element={<Blogs />} />
                <Route path="/blogs/:slug" element={<BlogDetail />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/faq" element={<Faq />} />

                {/* ── Auth Routes ── */}
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
                <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

                {/* ── Legal & Support ── */}
                <Route path="/support" element={<Support />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/disclaimer" element={<Disclaimer />} />
                <Route
                  path="/verify-email"
                  element={
                    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 transition-colors duration-300">
                      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        Please Verify Your Email
                      </div>
                    </div>
                  }
                />

                {/* ── Admin ── */}
                <Route path="/admin/write" element={<ProtectedRoute><WriteBlog /></ProtectedRoute>} />

                {/* ── Security ── */}
                <Route path="/verify-pin" element={<ProtectedRoute><VerifyPin /></ProtectedRoute>} />

                {/* ── Dashboard ── */}
                <Route path="/dashboard" element={<ErrorBoundary><ProtectedRoute><Dashboard /></ProtectedRoute></ErrorBoundary>} />
                <Route path="/profile" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/dashboard/settings/currency" element={<ProtectedRoute><SetCurrency /></ProtectedRoute>} />

                {/* ── Money & Capital ── */}
                <Route path="/dashboard/accounts/cash" element={<ProtectedRoute><CashWallet /></ProtectedRoute>} />
                <Route path="/dashboard/accounts/bank" element={<ProtectedRoute><BankWallet /></ProtectedRoute>} />
                <Route path="/dashboard/accounts/online" element={<ProtectedRoute><OnlineWallet /></ProtectedRoute>} />
                <Route path="/dashboard/shifting" element={<ProtectedRoute><CapitalShifting /></ProtectedRoute>} />
                <Route path="/dashboard/income" element={<ProtectedRoute><IncomeStreams /></ProtectedRoute>} />
                <Route path="/dashboard/expense" element={<ProtectedRoute><ExpenseTracker /></ProtectedRoute>} />
                <Route path="/dashboard/history" element={<ProtectedRoute><HistoryLogs /></ProtectedRoute>} />

                {/* ── Party/Khata ── */}
                <Route path="/dashboard/parties" element={<ProtectedRoute><PartyDirectory /></ProtectedRoute>} />
                <Route path="/dashboard/parties/:id" element={<ProtectedRoute><PartyLedger /></ProtectedRoute>} />

                {/* ── Crypto ── */}
                <Route path="/dashboard/crypto/tokens" element={<ProtectedRoute><CryptoManager /></ProtectedRoute>} />
                <Route path="/dashboard/crypto/wallet" element={<ProtectedRoute><CryptoWallet /></ProtectedRoute>} />
                <Route path="/dashboard/crypto/micro-earn" element={<ProtectedRoute><MicroEarn /></ProtectedRoute>} />
                <Route path="/dashboard/crypto/hold-profit" element={<ProtectedRoute><HoldAndSwap /></ProtectedRoute>} />
                <Route path="/dashboard/crypto/swap-bridge" element={<ProtectedRoute><SwapAndBridge /></ProtectedRoute>} />
                <Route path="/dashboard/crypto/staking" element={<ProtectedRoute><StakingAndYield /></ProtectedRoute>} />

                {/* ── Insights ── */}
                <Route path="/dashboard/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/dashboard/suggestions" element={<ProtectedRoute><SmartSuggestions /></ProtectedRoute>} />
                <Route path="/dashboard/strategy" element={<ProtectedRoute><AiStrategy /></ProtectedRoute>} />
                <Route path="/dashboard/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />

                {/* ── Alerts & Utilities ── */}
                <Route path="/dashboard/alerts/bills" element={<ProtectedRoute><BillPayments /></ProtectedRoute>} />
                <Route path="/dashboard/calendar" element={<ProtectedRoute><SmartCalendar /></ProtectedRoute>} />

                {/* ── Smart Tools ── */}
                <Route path="/dashboard/tools/notes" element={<ProtectedRoute><SecureNotes /></ProtectedRoute>} />
                <Route path="/dashboard/tools/converter" element={<ProtectedRoute><CryptoForex /></ProtectedRoute>} />

                {/* ── 404 ── */}
                <Route path="*" element={<NotFound />} />

              </Routes>
            </Suspense>
          </AppLayout>
        </CryptoPriceProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;