import React from 'react';
import Brand from '../navbar/Brand';
import DesktopMenu from '../navbar/DesktopMenu'; 
import RightActions from '../navbar/RightActions';
import { useAuth } from '../../hooks/useAuth';

const Navbar = ({ onLogoClick, onMenuClick, isMenuOpen }) => {
  const { user } = useAuth();

  return (
    <nav className="w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 sticky top-0 z-[200] transition-all duration-300">
      <div className="max-w-[1540px] mx-auto px-4 h-14 md:h-16 flex items-center justify-between gap-2">
        
        {/* LEFT: Brand */}
        <div className="flex-shrink-0">
          <Brand toggleSidebar={onLogoClick} />
        </div>

        {/* CENTER: Desktop Menu */}
        <div className="hidden md:flex items-center justify-center flex-1">
          <DesktopMenu />
        </div>

        {/* RIGHT: Actions & Hamburger */}
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          
          {/* 🚀 RightActions handles both Desktop and Mobile Bell internally now! */}
          <RightActions />

          {/* Hamburger Toggle: Mobile only */}
          <button 
            onClick={onMenuClick} 
            className="relative h-10 w-10 flex flex-col items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 md:hidden active:scale-90"
          >
            <div className="relative h-6 w-6 flex flex-col items-center justify-center">
              <span className={`absolute h-[2.5px] rounded-full transition-all duration-500 ${isMenuOpen ? 'w-6 rotate-[135deg] bg-rose-500' : 'w-5 -translate-y-2 bg-slate-700 dark:bg-slate-300'}`} />
              <span className={`absolute h-[2.5px] w-5 bg-slate-700 dark:bg-slate-300 rounded-full transition-all duration-500 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
              <span className={`absolute h-[2.5px] rounded-full transition-all duration-500 ${isMenuOpen ? 'w-6 -rotate-[135deg] bg-rose-500' : 'w-5 translate-y-2 bg-slate-700 dark:bg-slate-300'}`} />
            </div>
          </button>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;