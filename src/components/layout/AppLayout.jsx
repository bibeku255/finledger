import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Navbar from './Navbar';
import Sidebar from './Sidebar'; 
import MobileMenu from '../navbar/MobileMenu'; 
import NewsTicker from '../ui/NewsTicker';
import Footer from './Footer';
import DarkModeToggle from '../ui/DarkModeToggle';

const AppLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDashboard = location.pathname.startsWith('/dashboard') && user;
  
  const hideFooterPaths = ['/login', '/signup', '/forgot-password', '/verify-pin'];
  const isAuthPage = hideFooterPaths.includes(location.pathname);
  const showFooter = !isDashboard && !isAuthPage;

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950 overflow-hidden relative transition-colors duration-500">
      
      {/* 1. TOP HEADER SECTION */}
      <header className="flex-shrink-0 sticky top-0 z-50 w-full bg-white dark:bg-slate-950 shadow-sm">
        <NewsTicker />
        <Navbar 
          onLogoClick={() => setSidebarOpen(!isSidebarOpen)} 
          onMenuClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          isMenuOpen={isMobileMenuOpen}
        />
      </header>

      {/* 2. NAVIGATION OVERLAY (MobileMenu) - Right Side */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* ⚡ PRO FIX: Added 'min-h-0' here! Yeh parent ko stretch hone se rokega aur scroll chalu kar dega */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        
        {/* 3. FINANCIAL SIDEBAR (Sidebar) - Left Side */}
        {user && (
          <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}

        {/* 4. MAIN CONTENT AREA */}
        {/* ⚡ PRO FIX: Added 'overflow-x-hidden' and 'touch-pan-y' for native mobile scrolling support */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar touch-pan-y">
          
          {/* Dashboard Gradient Background */}
          {isDashboard && (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#111827_0%,#020617_100%)] pointer-events-none opacity-20 dark:opacity-100 transition-opacity" />
          )}

          <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-10 relative">
            {children}
          </div>

          {/* 🚀 CONDITIONAL FOOTER */}
          {showFooter && <Footer />}
        </main>
      </div>

      {/* 5. FLOATING DARK MODE TOGGLE (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-50">
        <DarkModeToggle />
      </div>
    </div>
  );
};

export default AppLayout;