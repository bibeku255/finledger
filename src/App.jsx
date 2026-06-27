// src/App.jsx
import React, { Suspense, lazy, useContext } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './hooks/useToastNotification';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute from './routes/PublicRoutes';
import { CryptoPriceProvider } from './context/CryptoPriceContext';
import { HiOutlineArrowLeft } from 'react-icons/hi';

// ─────────────────────────────────────────────
// 🚀 LAZY LOADED COMPONENTS (Performance Fix)
// ─────────────────────────────────────────────

// Public Pages
const Home = lazy(() => import('./pages/Home'));
const Services = lazy(() => import('./pages/Services'));
const Blogs = lazy(() => import('./pages/Blogs'));
const BlogDetail = lazy(() => import('./pages/BlogDetail'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Faq = lazy(() => import('./pages/Faq'));

// Auth Pages
const Login = lazy(() => import('./pages/Auth/Login'));
const Signup = lazy(() => import('./pages/Auth/Signup'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));

// Legal & Support
const Support = lazy(() => import('./pages/Support'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Disclaimer = lazy(() => import('./pages/Disclaimer'));

// Admin
const WriteBlog = lazy(() => import('./pages/WriteBlog'));

// Dashboard & Security
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const VerifyPin = lazy(() => import('./pages/VerifyPin'));
const SetCurrency = lazy(() => import('./pages/SetCurrency'));

// Money & Capital
const CashWallet = lazy(() => import('./pages/accounts/CashWallet'));
const BankWallet = lazy(() => import('./pages/accounts/BankWallet'));
const OnlineWallet = lazy(() => import('./pages/accounts/OnlineWallet'));
const CapitalShifting = lazy(() => import('./pages/accounts/CapitalShifting'));
const IncomeStreams = lazy(() => import('./pages/accounts/IncomeStreams'));
const ExpenseTracker = lazy(() => import('./pages/accounts/ExpenseTracker'));
const HistoryLogs = lazy(() => import('./pages/accounts/HistoryLogs'));

// Party/Khata
const PartyDirectory = lazy(() => import('./pages/parties/PartyDirectory'));
const PartyLedger = lazy(() => import('./pages/parties/PartyLedger'));

// Crypto
const CryptoManager = lazy(() => import('./pages/CryptoManager'));
const CryptoWallet = lazy(() => import('./pages/crypto/CryptoWallet'));
const MicroEarn = lazy(() => import('./pages/crypto/MicroEarn'));
const HoldAndSwap = lazy(() => import('./pages/crypto/HoldAndSwap'));
const SwapAndBridge = lazy(() => import('./pages/crypto/SwapAndBridge'));
const StakingAndYield = lazy(() => import('./pages/crypto/StakingAndYield'));

// Insights & Analytics
const Analytics = lazy(() => import('./pages/insights/Analytics'));
const SmartSuggestions = lazy(() => import('./pages/insights/SmartSuggestions'));
const AiStrategy = lazy(() => import('./pages/insights/AiStrategy'));
const Goals = lazy(() => import('./pages/insights/Goals'));

// Alerts & Utilities
const BillPayments = lazy(() => import('./pages/alerts/BillPayments'));
const SmartCalendar = lazy(() => import('./pages/SmartCalendar'));

// Smart Tools
const SecureNotes = lazy(() => import('./pages/tools/SecureNotes'));
const CryptoForex = lazy(() => import('./pages/tools/CryptoForex'));

// ─────────────────────────────────────────────
// 🎨 ROUTE LOADER (Enhanced Dark/Light Mode)
// ─────────────────────────────────────────────
const RouteLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-600 dark:border-blue-400/20 dark:border-t-blue-500 rounded-full animate-spin shadow-lg" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2.5 h-2.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-ping" />
      </div>
    </div>
    <p className="mt-8 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-[0.3em] animate-pulse">
      Initializing J.A.R.V.I.S Engine...
    </p>
  </div>
);

// ─────────────────────────────────────────────
// 🚫 404 Not Found (Enhanced UX)
// ─────────────────────────────────────────────
const NotFound = () => (
  <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300 px-4">
    <div className="text-center max-w-md p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800">
      <h1 className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 mb-4 drop-shadow-sm">
        404
      </h1>
      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 uppercase tracking-widest">
        Vault Not Found
      </h2>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
        The financial coordinates you are looking for do not exist or have been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 hover:from-slate-800 hover:to-slate-700 dark:hover:from-slate-200 dark:hover:to-slate-300 text-white dark:text-slate-900 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-slate-900/20 dark:shadow-white/10 w-full focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      >
        <HiOutlineArrowLeft size={16} /> Return to Home
      </Link>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// 📧 EMAIL VERIFICATION COMPONENT (Inline)
// ─────────────────────────────────────────────
const VerifyEmailComponent = () => (
  <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 transition-colors duration-300">
    <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800">
      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      </div>
      Please Verify Your Email
    </div>
  </div>
);

// ─────────────────────────────────────────────
// 🛡️ ENHANCED ERROR BOUNDARY FOR LAZY LOADING
// ─────────────────────────────────────────────
class LazyLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
    // You could also log to an error reporting service here
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
          <div className="text-center max-w-md p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Loading Failed
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              The financial module failed to load. This might be due to a network issue.
            </p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Retry Loading
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─────────────────────────────────────────────
// 🚀 MAIN APP COMPONENT
// ─────────────────────────────────────────────
function App() {
  const { loading } = useContext(AuthContext);

  // Authentication loading state
  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center transition-colors duration-300">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute animate-ping h-24 w-24 rounded-full bg-blue-500/20 dark:bg-blue-400/20"></div>
          <div className="relative animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 border-b-blue-600 dark:border-b-blue-400"></div>
          <div className="absolute h-6 w-6 bg-blue-600 dark:bg-blue-400 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
        </div>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] animate-pulse">
          Authenticating...
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <CryptoPriceProvider>
          <AppLayout>
            <LazyLoadErrorBoundary>
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
                  <Route path="/verify-email" element={<VerifyEmailComponent />} />

                  {/* ── Admin Routes ── */}
                  <Route 
                    path="/admin/write" 
                    element={
                      <ProtectedRoute>
                        <WriteBlog />
                      </ProtectedRoute>
                    } 
                  />

                  {/* ── Security Routes ── */}
                  <Route 
                    path="/verify-pin" 
                    element={
                      <ProtectedRoute>
                        <VerifyPin />
                      </ProtectedRoute>
                    } 
                  />

                  {/* ── Dashboard Core ── */}
                  <Route 
                    path="/dashboard" 
                    element={
                      <ErrorBoundary>
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      </ErrorBoundary>
                    } 
                  />
                  <Route 
                    path="/profile" 
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/dashboard/settings/currency" 
                    element={
                      <ProtectedRoute>
                        <SetCurrency />
                      </ProtectedRoute>
                    } 
                  />

                  {/* ── Money & Capital Routes ── */}
                  <Route path="/dashboard/accounts/cash" element={<ProtectedRoute><CashWallet /></ProtectedRoute>} />
                  <Route path="/dashboard/accounts/bank" element={<ProtectedRoute><BankWallet /></ProtectedRoute>} />
                  <Route path="/dashboard/accounts/online" element={<ProtectedRoute><OnlineWallet /></ProtectedRoute>} />
                  <Route path="/dashboard/shifting" element={<ProtectedRoute><CapitalShifting /></ProtectedRoute>} />
                  <Route path="/dashboard/income" element={<ProtectedRoute><IncomeStreams /></ProtectedRoute>} />
                  <Route path="/dashboard/expense" element={<ProtectedRoute><ExpenseTracker /></ProtectedRoute>} />
                  <Route path="/dashboard/history" element={<ProtectedRoute><HistoryLogs /></ProtectedRoute>} />

                  {/* ── Party/Khata Routes ── */}
                  <Route path="/dashboard/parties" element={<ProtectedRoute><PartyDirectory /></ProtectedRoute>} />
                  <Route path="/dashboard/parties/:id" element={<ProtectedRoute><PartyLedger /></ProtectedRoute>} />

                  {/* ── Crypto Routes ── */}
                  <Route path="/dashboard/crypto/tokens" element={<ProtectedRoute><CryptoManager /></ProtectedRoute>} />
                  <Route path="/dashboard/crypto/wallet" element={<ProtectedRoute><CryptoWallet /></ProtectedRoute>} />
                  <Route path="/dashboard/crypto/micro-earn" element={<ProtectedRoute><MicroEarn /></ProtectedRoute>} />
                  <Route path="/dashboard/crypto/hold-profit" element={<ProtectedRoute><HoldAndSwap /></ProtectedRoute>} />
                  <Route path="/dashboard/crypto/swap-bridge" element={<ProtectedRoute><SwapAndBridge /></ProtectedRoute>} />
                  <Route path="/dashboard/crypto/staking" element={<ProtectedRoute><StakingAndYield /></ProtectedRoute>} />

                  {/* ── Insights & Analytics Routes ── */}
                  <Route path="/dashboard/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/dashboard/suggestions" element={<ProtectedRoute><SmartSuggestions /></ProtectedRoute>} />
                  <Route path="/dashboard/strategy" element={<ProtectedRoute><AiStrategy /></ProtectedRoute>} />
                  <Route path="/dashboard/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />

                  {/* ── Alerts & Utilities Routes ── */}
                  <Route path="/dashboard/alerts/bills" element={<ProtectedRoute><BillPayments /></ProtectedRoute>} />
                  <Route path="/dashboard/calendar" element={<ProtectedRoute><SmartCalendar /></ProtectedRoute>} />

                  {/* ── Smart Tools Routes ── */}
                  <Route path="/dashboard/tools/notes" element={<ProtectedRoute><SecureNotes /></ProtectedRoute>} />
                  <Route path="/dashboard/tools/converter" element={<ProtectedRoute><CryptoForex /></ProtectedRoute>} />

                  {/* ── 404 Catch-all ── */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </LazyLoadErrorBoundary>
          </AppLayout>
        </CryptoPriceProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;