import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

import { 
  HiOutlineChevronDown, HiOutlineLogout, HiOutlineHome, 
  HiOutlineChartBar, HiOutlineBriefcase, HiOutlineNewspaper,
  HiOutlineInformationCircle, HiOutlinePhone, HiOutlineSupport, 
  HiOutlineShieldCheck, HiOutlineDocumentText, HiOutlineQuestionMarkCircle, 
  HiOutlineScale, HiOutlineCog, HiOutlineGlobeAlt, HiOutlineCalendar,
  HiOutlinePencilAlt, HiOutlineArrowRight, HiOutlineStar, HiOutlineSparkles,
  HiOutlineShieldExclamation, HiOutlineBadgeCheck
} from 'react-icons/hi';
import { 
  FaTelegramPlane, FaRocket, FaUserAstronaut, FaCrown, FaGem 
} from 'react-icons/fa';

import Avatar from '../ui/Avatar'; 

// 🚀 Sub-component for legal nav items (Compact)
const LegalNavItem = ({ item, onClose }) => (
  <NavLink 
    to={item.path} 
    onClick={onClose}
    className={({ isActive }) => `
      flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all group
      ${isActive 
        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20' 
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-white'
      }
    `}
  >
    {({ isActive }) => (
      <>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
          isActive ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-slate-800'
        }`}>
          {item.icon}
        </div>
        <span>{item.name}</span>
      </>
    )}
  </NavLink>
);

const MobileMenu = ({ isOpen, onClose }) => {
  const { user, dbData, logout, baseCurrency, avatar, displayName } = useAuth();
  
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const navigate = useNavigate();

  const currentCalendar = dbData?.settings?.baseCalendar || 'gregorian';
  
  const calendarLabels = {
    gregorian: 'AD',
    bikram_sambat: 'BS',
    hijri: 'Hijri',
    jalali: 'Jalali'
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleNavigation = (path) => {
    onClose();
    setTimeout(() => navigate(path), 200);
  };

  const menuItems = [
    { name: 'Home', path: '/', icon: <HiOutlineHome size={18} /> },
    ...(user ? [{ 
      name: 'Dashboard', path: '/dashboard', icon: <HiOutlineChartBar size={18} />, 
      featured: true, badge: 'PRO'
    }] : []),
    { name: 'Services', path: '/services', icon: <HiOutlineBriefcase size={18} /> },
    { name: 'Blogs', path: '/blogs', icon: <HiOutlineNewspaper size={18} /> },
    { name: 'About Us', path: '/about', icon: <HiOutlineInformationCircle size={18} /> },
    { name: 'Contact', path: '/contact', icon: <HiOutlinePhone size={18} /> },
  ];

  const legalItems = [
    { name: 'Support', path: '/support', icon: <HiOutlineSupport size={16} className="text-orange-500" /> },
    { name: 'Privacy', path: '/privacy', icon: <HiOutlineShieldCheck size={16} className="text-cyan-500" /> },
    { name: 'Terms', path: '/terms', icon: <HiOutlineDocumentText size={16} className="text-indigo-500" /> },
    { name: 'Disclaimer', path: '/disclaimer', icon: <HiOutlineScale size={16} className="text-slate-500" /> },
    { name: 'FAQ', path: '/faq', icon: <HiOutlineQuestionMarkCircle size={16} className="text-purple-500" /> },
    { 
      name: 'Telegram', 
      path: 'https://t.me/bpcryptocraft', 
      icon: <FaTelegramPlane size={16} className="text-sky-500" />, 
      external: true 
    },
  ];

  return (
    <>
      {/* Premium Backdrop Overlay */}
      <div 
        className={`absolute inset-0 z-40 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-slate-950/90 backdrop-blur-xl transition-all duration-500 md:hidden ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
        onClick={onClose}
        aria-label="Close menu"
      />

      {/* 🚀 COMPACT & LESS BROAD Panel - Reduced max-w to 300px */}
      <aside 
        className={`absolute md:hidden top-0 right-0 bottom-0 z-50 w-[75%] max-w-[300px] bg-white/98 dark:bg-slate-950/98 backdrop-blur-2xl border-l border-slate-200/30 dark:border-slate-800/50 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        }`}
      >
        
        {/* Premium Decorative Top Gradient */}
        <div className="shrink-0 relative">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500" />
          <div className="absolute -bottom-1 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 blur-sm" />
        </div>

        {/* Main Navigation - Compact Paddings */}
        <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-2 space-y-1 custom-scrollbar overscroll-contain">
          
          {menuItems.map((item) => (
            <NavLink 
              key={item.name} 
              to={item.path} 
              onClick={onClose} 
              end={item.path === '/'}
              onMouseEnter={() => setHoveredItem(item.name)}
              onMouseLeave={() => setHoveredItem(null)}
              className={({ isActive }) => `
                group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 active:scale-[0.98] overflow-hidden
                ${isActive 
                  ? 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/15 dark:to-cyan-500/15 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/30 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/50'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-r-full shadow-sm" />
                  )}
                  {hoveredItem === item.name && !isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-100/50 to-transparent dark:from-white/5 dark:to-transparent" />
                  )}
                  <div className={`relative shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                    isActive 
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md' 
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                  }`}>
                    {item.icon}
                    {item.featured && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-amber-400 to-orange-400 rounded-full flex items-center justify-center shadow-md animate-pulse">
                        <HiOutlineStar size={8} className="text-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[13px] ${isActive ? 'font-black' : 'font-bold'} transition-colors duration-300`}>
                      {item.name}
                    </span>
                  </div>
                  {item.featured && item.badge && (
                    <span className="shrink-0 px-1.5 py-0.5 bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-600 dark:text-amber-400 text-[8px] font-black rounded-md border border-amber-400/30">
                      {item.badge}
                    </span>
                  )}
                  <HiOutlineArrowRight size={14} className={`shrink-0 transition-all duration-300 ${
                    isActive ? 'opacity-100 translate-x-0 text-blue-500' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 text-slate-400'
                  }`} />
                </>
              )}
            </NavLink>
          ))}

          {/* Legal & Discovery (Compact) */}
          <div className="pt-3 mt-3 border-t border-slate-200/60 dark:border-slate-800/50">
            <button 
              onClick={() => setIsMoreOpen(!isMoreOpen)} 
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group border ${
                isMoreOpen ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5' : 'border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/50'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  isMoreOpen 
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                }`}>
                  <HiOutlineShieldExclamation size={14} />
                </div>
                Legal & Links
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[8px] px-1.5 py-0.5 rounded-md border transition-all ${
                  isMoreOpen 
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}>
                  {legalItems.length}
                </span>
                <HiOutlineChevronDown size={14} className={`transition-transform duration-300 ${isMoreOpen ? 'rotate-180 text-blue-500' : ''}`} />
              </div>
            </button>
            
            <div className={`grid transition-all duration-400 ease-in-out ${
              isMoreOpen ? 'grid-rows-[1fr] opacity-100 mt-1.5' : 'grid-rows-[0fr] opacity-0'
            }`}>
              <div className="overflow-hidden space-y-0.5 ml-2 border-l-2 border-slate-200 dark:border-slate-700/50 pl-3 py-1">
                {legalItems.map((item) => (
                  item.external ? (
                    <a 
                      key={item.name} 
                      href={item.path} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 font-bold text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-white transition-all group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <span className="flex-1">{item.name}</span>
                      <HiOutlineArrowRight size={12} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500" />
                    </a>
                  ) : (
                    <LegalNavItem key={item.name} item={item} onClose={onClose} />
                  )
                ))}
              </div>
            </div>
          </div>
        </nav>

        {/* ============================================ */}
        {/* USER FOOTER (COMPACT) */}
        {/* ============================================ */}
        <div className="px-4 pb-5 pt-3 border-t border-slate-200/60 dark:border-slate-800/50 shrink-0 bg-gradient-to-t from-slate-50/80 via-slate-50/30 to-transparent dark:from-slate-900/80 dark:via-slate-900/30 dark:to-transparent">
          {user ? (
            <div className="space-y-2.5">
              
              {/* User Card */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border border-slate-200/60 dark:border-slate-700/50 p-3 shadow-sm group hover:shadow-md transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center gap-3">
                  <div className="relative">
                    <div className="ring-2 ring-blue-100 dark:ring-slate-700 rounded-full p-0.5 bg-gradient-to-br from-blue-500 to-cyan-500">
                      <div className="ring-2 ring-white dark:ring-slate-800 rounded-full">
                        <Avatar src={avatar} name={displayName} size={36} />
                      </div>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                      <HiOutlineBadgeCheck size={9} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-black text-slate-800 dark:text-white truncate block leading-tight">{displayName}</span>
                    <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                      <HiOutlineSparkles size={9} /> Verified Member
                    </span>
                  </div>
                </div>
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleNavigation('/dashboard/settings/currency')} className="group p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/50 hover:border-blue-400/60 dark:hover:border-blue-500/50 transition-all active:scale-[0.98] shadow-sm text-left overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform mb-2 border border-blue-200/50 dark:border-blue-500/20">
                      <HiOutlineGlobeAlt size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Currency</p>
                    <p className="text-[12px] font-black text-slate-800 dark:text-white truncate">{baseCurrency || 'USD'}</p>
                  </div>
                </button>
                <button onClick={() => handleNavigation('/profile')} className="group p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/50 hover:border-indigo-400/60 dark:hover:border-indigo-500/50 transition-all active:scale-[0.98] shadow-sm text-left overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-500/10 dark:to-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform mb-2 border border-indigo-200/50 dark:border-indigo-500/20">
                      <HiOutlineCalendar size={16} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Calendar</p>
                    <p className="text-[12px] font-black text-slate-800 dark:text-white truncate">{calendarLabels[currentCalendar] || 'AD'}</p>
                  </div>
                </button>
              </div>

              {/* Admin */}
              {user?.email?.toLowerCase() === 'vivekpoudel222@gmail.com' && (
                <button onClick={() => handleNavigation('/admin/write')} className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[11px] uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-1">
                  <HiOutlinePencilAlt size={16} /> Studio Admin <FaCrown size={12} className="text-amber-400" />
                </button>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => handleNavigation('/profile')} className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-[0.98] hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5">
                  <HiOutlineCog size={14} /> Config
                </button>
                <button onClick={() => { logout(); onClose(); navigate('/'); }} className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm transition-all active:scale-[0.98] hover:bg-rose-100 dark:hover:bg-rose-500/20 flex items-center justify-center gap-1.5">
                  <HiOutlineLogout size={14} /> Exit
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center shadow-sm">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <FaUserAstronaut size={24} />
                </div>
                <h3 className="font-black text-slate-800 dark:text-white text-[13px] mb-0.5">Welcome</h3>
                <p className="text-[10px] font-bold text-slate-500">Join the financial ecosystem.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => handleNavigation('/login')} className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm active:scale-[0.98] transition-all hover:bg-slate-50 dark:hover:bg-slate-700">
                  Sign In
                </button>
                <button onClick={() => handleNavigation('/signup')} className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                  Sign Up <FaRocket size={10} />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default MobileMenu;