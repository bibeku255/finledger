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
      {/* Sticky top-0 makes the header stick to top. z-50 ensures it's above everything else */}
      <header className="shrink-0 sticky top-0 z-50 w-full bg-white dark:bg-slate-950 shadow-sm border-b border-slate-200 dark:border-slate-800/50 flex flex-col">
        {/* NewsTicker and Navbar stack naturally inside the header. Header calculates its own total height automatically. */}
        <NewsTicker />
        <Navbar 
          onLogoClick={() => setSidebarOpen(!isSidebarOpen)} 
          onMenuClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          isMenuOpen={isMobileMenuOpen}
        />
      </header>

      {/* ⚡ PRO FIX: The main container takes the remaining height (flex-1). */}
      {/* Anything rendered inside here with 'absolute inset-0' will perfectly sit BELOW the header without overlapping! */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        
        {/* 2. NAVIGATION OVERLAY (MobileMenu) - Right Side */}
        {/* Mobile menu is rendered here inside the relative container, NOT in the global root. */}
        <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

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