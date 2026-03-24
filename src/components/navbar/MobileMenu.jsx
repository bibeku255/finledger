import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

import { 
  HiOutlineSearch, HiChevronDown, HiOutlineLogout, HiOutlineHome, 
  HiOutlineChartBar, HiOutlineBriefcase, HiOutlineNewspaper,
  HiOutlineInformationCircle, HiOutlinePhone, HiOutlineSupport, 
  HiOutlineShieldCheck, HiOutlineDocumentText, HiOutlineQuestionMarkCircle, 
  HiOutlineScale, HiOutlineCog, HiOutlineGlobeAlt, HiOutlineCalendar,
  HiOutlinePencilAlt // 🚀 ADDED PENCIL ICON
} from 'react-icons/hi';
import { FaTelegramPlane } from 'react-icons/fa';

import Avatar from '../ui/Avatar'; 

const MobileMenu = ({ isOpen, onClose }) => {
  const { user, dbData, logout, baseCurrency, avatar, displayName } = useAuth();
  
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const navigate = useNavigate();

  // 🚀 Fetch current base calendar from user settings (default to gregorian)
  const currentCalendar = dbData?.settings?.baseCalendar || 'gregorian';
  
  // Format calendar name for the small badge
  const calendarLabels = {
    gregorian: 'AD',
    bikram_sambat: 'BS',
    hijri: 'Hijri',
    jalali: 'Jalali'
  };
  const calendarBadgeText = calendarLabels[currentCalendar] || 'AD';

  const menuItems = [
    { name: 'Home', path: '/', icon: <HiOutlineHome /> },
    ...(user ? [{ name: 'Dashboard', path: '/dashboard', icon: <HiOutlineChartBar /> }] : []),
    { name: 'Services', path: '/services', icon: <HiOutlineBriefcase /> },
    { name: 'Blogs', path: '/blogs', icon: <HiOutlineNewspaper /> },
    { name: 'About Us', path: '/about', icon: <HiOutlineInformationCircle /> },
    { name: 'Contact', path: '/contact', icon: <HiOutlinePhone /> },
  ];

  const moreItems = [
    { name: 'Support', sub: 'Help center', path: '/support', icon: <HiOutlineSupport className="text-orange-500" /> },
    { name: 'Privacy', sub: 'Data safety', path: '/privacy', icon: <HiOutlineShieldCheck className="text-cyan-500" /> },
    { name: 'Terms', sub: 'User agreement', path: '/terms', icon: <HiOutlineDocumentText className="text-indigo-500" /> },
    { name: 'Disclaimer', sub: 'Legal notes', path: '/disclaimer', icon: <HiOutlineScale className="text-slate-500" /> },
    { name: 'FAQ', sub: 'Common Q&A', path: '/faq', icon: <HiOutlineQuestionMarkCircle className="text-purple-500" /> },
    { name: 'Notice', sub: 'Telegram', path: 'https://t.me/bpcryptocraft', icon: <FaTelegramPlane className="text-sky-500" />, external: true },
  ];

  const activeClass = ({ isActive }) => `
    flex items-center gap-3.5 p-3.5 rounded-2xl font-black text-[13px] transition-all active:scale-95
    ${isActive 
      ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-500/20 shadow-sm' 
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
    }
  `;

  const handleNavigation = (path) => {
    onClose();
    setTimeout(() => navigate(path), 150);
  };

  return (
    <div className={`fixed inset-0 z-[300] md:hidden transition-all ${isOpen ? 'visible' : 'invisible'}`}>
      <div 
        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose} 
      />

      <div className={`absolute right-4 top-20 bottom-6 w-[88%] max-w-[320px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] border border-slate-200/50 dark:border-white/10 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col overflow-hidden ${isOpen ? "translate-x-0" : "translate-x-[110%]"}`}>
        
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-7 custom-scrollbar">
          
          <div className="relative">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search feature..." className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-2xl py-4 pl-12 text-xs font-bold outline-none dark:text-white" />
          </div>

          <nav className="space-y-1.5">
            {menuItems.map((item) => (
              <NavLink key={item.name} to={item.path} onClick={onClose} className={activeClass} end={item.path === '/'}>
                <span className="text-xl opacity-70">{item.icon}</span>
                {item.name}
              </NavLink>
            ))}

            <div className="pt-4">
              <button 
                onClick={() => setIsMoreOpen(!isMoreOpen)} 
                className="w-full flex items-center justify-between p-4 rounded-2xl font-black text-[10px] text-slate-400 bg-slate-50 dark:bg-white/5 uppercase tracking-widest"
              >
                <span>Legal & Discovery</span>
                <HiChevronDown className={`transition-transform duration-500 ${isMoreOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <div className={`grid transition-all duration-500 ease-in-out ${isMoreOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden space-y-1">
                  {moreItems.map((item) => (
                    item.external ? (
                      <a key={item.name} href={item.path} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3.5 p-3.5 text-slate-600 dark:text-slate-300 font-black text-[13px]">
                        <span className="text-xl">{item.icon}</span>
                        <span>{item.name}</span>
                      </a>
                    ) : (
                      <NavLink key={item.name} to={item.path} onClick={onClose} className={activeClass}>
                        <span className="text-xl">{item.icon}</span>
                        <div className="flex flex-col">
                           <span>{item.name}</span>
                           <span className="text-[8px] opacity-50 uppercase tracking-tighter">{item.sub}</span>
                        </div>
                      </NavLink>
                    )
                  ))}
                </div>
              </div>
            </div>
          </nav>

          <div className="pt-6 border-t border-slate-100 dark:border-white/5">
            {user ? (
              <div className="space-y-4">
                
                {/* User Info Card */}
                <div className="flex items-center gap-3 p-3.5 rounded-[1.5rem] bg-blue-50/50 dark:bg-blue-600/5 border border-blue-100/50 dark:border-blue-500/10 shadow-sm">
                  <div className="relative">
                    <Avatar src={avatar} name={displayName} size={48} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-black text-slate-900 dark:text-white truncate">
                      {displayName}
                    </span>
                    <span className="text-[9px] font-bold text-blue-500 truncate uppercase tracking-tighter">
                      Verified Member
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  {/* Currency Badge */}
                  <button 
                    onClick={() => handleNavigation('/dashboard/settings/currency')}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-blue-500/20 mb-1 transition-all active:scale-95"
                  >
                    <div className="flex items-center gap-3.5 font-black text-[13px] text-slate-700 dark:text-slate-300">
                      <HiOutlineGlobeAlt size={20} className="text-blue-500" />
                      Base Currency
                    </div>
                    <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-blue-500/20">
                      {baseCurrency || 'USD'}
                    </span>
                  </button>

                  {/* 🚀 Calendar Badge */}
                  <button 
                    onClick={() => handleNavigation('/profile')}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-indigo-500/20 mb-2 transition-all active:scale-95"
                  >
                    <div className="flex items-center gap-3.5 font-black text-[13px] text-slate-700 dark:text-slate-300">
                      <HiOutlineCalendar size={20} className="text-indigo-500" />
                      Base Calendar
                    </div>
                    <span className="bg-indigo-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-indigo-500/20">
                      {calendarBadgeText}
                    </span>
                  </button>

                  {/* 🚀 NEW: ADMIN ONLY BUTTON FOR MOBILE */}
                  {user?.email?.toLowerCase() === 'vivekpoudel222@gmail.com' && (
                    <button 
                      onClick={() => handleNavigation('/admin/write')}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent mb-2 transition-all active:scale-95 shadow-md shadow-blue-500/20"
                    >
                      <div className="flex items-center gap-3.5 font-black text-[13px] text-white">
                        <HiOutlinePencilAlt size={20} />
                        Studio (Admin)
                      </div>
                    </button>
                  )}

                  <button 
                    onClick={() => handleNavigation('/profile')} 
                    className="w-full flex items-center gap-3.5 p-4 rounded-2xl text-[13px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-95"
                  >
                    <HiOutlineCog size={20} className="text-slate-400" /> Account Settings
                  </button>
                  <button 
                    onClick={() => { logout(); onClose(); navigate('/'); }} 
                    className="w-full flex items-center gap-3.5 p-4 rounded-2xl text-[13px] font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/5 transition-all active:scale-95"
                  >
                    <HiOutlineLogout size={20} /> Sign Out Account
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button onClick={() => handleNavigation('/login')} className="w-full py-4 rounded-2xl text-[13px] font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 active:scale-95 transition-all">
                  Sign In
                </button>
                <button onClick={() => handleNavigation('/signup')} className="w-full py-4 rounded-2xl text-[13px] font-black text-white bg-blue-600 shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                  Join Ecosystem
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;