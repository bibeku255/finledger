import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

// Layout
import AppLayout from './components/layout/AppLayout';

// Routes Guard
import ProtectedRoute from './routes/ProtectedRoute';

// Public Pages
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

// 🚀 ADDED: Finledger Studio (Blogger Editor)
import WriteBlog from './pages/WriteBlog'; 

// Protected Dashboard Pages
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings'; 
import VerifyPin from './pages/VerifyPin';
import SetCurrency from './pages/SetCurrency'; 

// Money & Capital (Fiat)
import CashWallet from './pages/accounts/CashWallet';
import BankWallet from './pages/accounts/BankWallet';
import OnlineWallet from './pages/accounts/OnlineWallet';
import CapitalShifting from './pages/accounts/CapitalShifting';
import IncomeStreams from './pages/accounts/IncomeStreams';
import ExpenseTracker from './pages/accounts/ExpenseTracker';
import HistoryLogs from './pages/accounts/HistoryLogs';

// Parties (Smart Khata)
import PartyDirectory from './pages/parties/PartyDirectory';
import PartyLedger from './pages/parties/PartyLedger';

// Digital Assets (Crypto)
import CryptoManager from './pages/CryptoManager'; 
import CryptoWallet from './pages/crypto/CryptoWallet';
import MicroEarn from './pages/crypto/MicroEarn';
import HoldAndSwap from './pages/crypto/HoldAndSwap';
import SwapAndBridge from './pages/crypto/SwapAndBridge';
import StakingAndYield from './pages/crypto/StakingAndYield';

// Insights & Intelligence
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

function App() {
  const { loading } = useContext(AuthContext);
  
  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-white dark:bg-slate-950 flex items-center justify-center">
        {/* Professional Loader */}
        <div className="relative flex items-center justify-center">
          <div className="absolute animate-ping h-20 w-20 rounded-full bg-blue-500/20"></div>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <Routes>
        {/* --- 1. Public Routes --- */}
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/blogs" element={<Blogs />} />
        <Route path="/blogs/:slug" element={<BlogDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<Faq />} />
        
        {/* --- 2. Auth Routes --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} /> 
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Temp Route for Email Verification */}
        <Route path="/verify-email" element={<div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-slate-400">Please Verify Your Email</div>} />

        {/* --- 3. Legal & Support --- */}
        <Route path="/support" element={<Support />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/disclaimer" element={<Disclaimer />} />

        {/* --- 4. Protected Routes (Auth Required) --- */}
        
        {/* 🚀 FINLEDGER STUDIO (ADMIN ONLY WRITER) */}
        <Route path="/admin/write" element={
          <ProtectedRoute>
            <WriteBlog />
          </ProtectedRoute>
        } />
        
        {/* 🛡️ 2FA Gatekeeper Access */}
        <Route path="/verify-pin" element={
          <ProtectedRoute>
            <VerifyPin />
          </ProtectedRoute>
        } />

        {/* Dashboard Overview */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Profile & Security Settings */}
        <Route path="/profile" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />

        {/* 🌍 Base Currency Selector */}
        <Route path="/dashboard/settings/currency" element={
          <ProtectedRoute>
            <SetCurrency />
          </ProtectedRoute>
        } />

        {/* --- MONEY & CAPITAL ROUTES --- */}
        <Route path="/dashboard/accounts/cash" element={
          <ProtectedRoute>
            <CashWallet />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard/accounts/bank" element={
          <ProtectedRoute>
            <BankWallet />
          </ProtectedRoute>
        } />
          
        <Route path="/dashboard/accounts/online" element={
          <ProtectedRoute>
            <OnlineWallet />
          </ProtectedRoute>
        } />
          
        <Route path="/dashboard/shifting" element={
          <ProtectedRoute>
            <CapitalShifting />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard/income" element={
          <ProtectedRoute>
            <IncomeStreams />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard/expense" element={
          <ProtectedRoute>
            <ExpenseTracker />
          </ProtectedRoute>
        } />

        <Route path="/dashboard/history" element={
          <ProtectedRoute>
            <HistoryLogs />
          </ProtectedRoute>
        } />

        {/* --- SMART KHATA (PARTIES) ROUTES --- */}
        <Route path="/dashboard/parties" element={
          <ProtectedRoute>
            <PartyDirectory />
          </ProtectedRoute>
        } />
          
        <Route path="/dashboard/parties/:id" element={
          <ProtectedRoute>
            <PartyLedger />
          </ProtectedRoute>
        } />

        {/* --- DIGITAL ASSETS (CRYPTO) ROUTES --- */}
        <Route path="/dashboard/crypto/tokens" element={
          <ProtectedRoute>
            <CryptoManager />
          </ProtectedRoute>
        } />

        <Route path="/dashboard/crypto/wallet" element={
          <ProtectedRoute>
            <CryptoWallet />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard/crypto/micro-earn" element={
          <ProtectedRoute>
            <MicroEarn />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard/crypto/hold-profit" element={
          <ProtectedRoute>
            <HoldAndSwap />
          </ProtectedRoute>
        } />

        <Route path="/dashboard/crypto/swap-bridge" element={
          <ProtectedRoute>
            <SwapAndBridge />
          </ProtectedRoute>
        } />
          
        <Route path="/dashboard/crypto/staking" element={
          <ProtectedRoute>
            <StakingAndYield />
          </ProtectedRoute>
        } />  
            
        {/* --- INSIGHTS & INTELLIGENCE ROUTES --- */}
        <Route path="/dashboard/analytics" element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        } />

        <Route path="/dashboard/suggestions" element={
          <ProtectedRoute>
            <SmartSuggestions />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard/strategy" element={
          <ProtectedRoute>
            <AiStrategy />
          </ProtectedRoute>
        } />

        <Route path="/dashboard/goals" element={
          <ProtectedRoute>
            <Goals />
          </ProtectedRoute>
        } />
        
        {/* --- ALERTS & UTILITIES --- */}
        <Route path="/dashboard/alerts/bills" element={
          <ProtectedRoute>
            <BillPayments />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard/calendar" element={
          <ProtectedRoute>
            <SmartCalendar />
          </ProtectedRoute>
        } />

        {/* --- SMART TOOLS --- */}
        <Route path="/dashboard/tools/notes" element={
          <ProtectedRoute>
            <SecureNotes />
          </ProtectedRoute>
        } />

        <Route path="/dashboard/tools/converter" element={
          <ProtectedRoute>
            <CryptoForex />
          </ProtectedRoute>
        } />

        {/* --- 5. 404 Fallback --- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default App;