import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Navbar from './Navbar';
import Sidebar from './Sidebar'; // Financial Sidebar (Logo Trigger)
import MobileMenu from '../navbar/MobileMenu'; // Site Nav (Hamburger Trigger)
import NewsTicker from '../ui/NewsTicker';
import Footer from './Footer';
import DarkModeToggle from '../ui/DarkModeToggle';

const AppLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Two separate states for two different drawers
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDashboard = location.pathname.startsWith('/dashboard') && user;
  
  // 🚀 FIX 1: Hide Footer on Auth Pages too
  const hideFooterPaths = ['/login', '/signup', '/forgot-password', '/verify-pin'];
  const isAuthPage = hideFooterPaths.includes(location.pathname);
  const showFooter = !isDashboard && !isAuthPage;

  return (
    // 🚀 FIX 2: Changed h-screen to h-[100dvh] for perfect mobile rendering
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950 overflow-hidden relative transition-colors duration-500">
      
      {/* 1. TOP HEADER SECTION */}
      {/* ⚡ PRO FIX: Changed z-[200] to z-30. Ab Header Sidebar ke peeche rahega jab Sidebar khulega! */}
       <header className="flex-shrink-0 sticky top-0 z-50 w-full bg-white dark:bg-slate-950 shadow-sm">
        <NewsTicker />
        <Navbar 
          // Match these prop names with your Navbar.jsx destructured props
          onLogoClick={() => setSidebarOpen(!isSidebarOpen)} 
          onMenuClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          isMenuOpen={isMobileMenuOpen}
        />
      </header>

      {/* 2. NAVIGATION OVERLAY (MobileMenu) - Right Side */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* 3. FINANCIAL SIDEBAR (Sidebar) - Left Side */}
        {user && (
          <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}

        {/* 4. MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto relative custom-scrollbar">
          {/* Dashboard Gradient Background */}
          {isDashboard && (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#111827_0%,#020617_100%)] pointer-events-none opacity-20 dark:opacity-100 transition-opacity" />
          )}

          {/* Removed "z-10" from here so modals can globally cover the screen! */}
          <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-10 relative">
            {children}
          </div>

          {/* 🚀 CONDITIONAL FOOTER */}
          {showFooter && <Footer />}
        </main>
      </div>

      {/* 5. FLOATING DARK MODE TOGGLE (Bottom Right) */}
      {/* ⚡ PRO FIX: Changed z-[210] to z-50 to keep stacking contexts clean */}
      <div className="fixed bottom-6 right-6 z-50">
        <DarkModeToggle />
      </div>
    </div>
  );
};

export default AppLayout;