import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  HiOutlineChevronDown, HiOutlineInformationCircle, HiOutlinePhone, 
  HiOutlineSupport, HiOutlineShieldCheck, HiOutlineDocumentText, 
  HiOutlineQuestionMarkCircle, HiOutlineScale, HiOutlineSparkles
} from 'react-icons/hi';
import { FaTelegramPlane, FaGem } from 'react-icons/fa';

const DesktopMenu = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isAuthenticated = !!user;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const moreLinks = [
    { name: 'About Us', sub: 'Our Mission', path: '/about', icon: <HiOutlineInformationCircle className="text-blue-500" size={18} /> },
    { name: 'Contact', sub: 'Get in touch', path: '/contact', icon: <HiOutlinePhone className="text-emerald-500" size={18} /> },
    { name: 'Support', sub: 'Help center', path: '/support', icon: <HiOutlineSupport className="text-orange-500" size={18} /> },
    { name: 'Privacy', sub: 'Data safety', path: '/privacy', icon: <HiOutlineShieldCheck className="text-cyan-500" size={18} /> },
    { name: 'Terms', sub: 'User agreement', path: '/terms', icon: <HiOutlineDocumentText className="text-indigo-500" size={18} /> },
    { name: 'Disclaimer', sub: 'Legal notes', path: '/disclaimer', icon: <HiOutlineScale className="text-slate-500" size={18} /> },
    { name: 'FAQ', sub: 'Common Q&A', path: '/faq', icon: <HiOutlineQuestionMarkCircle className="text-purple-500" size={18} /> },
    { name: 'Notice', sub: 'Telegram', path: 'https://t.me/bpcryptocraft', icon: <FaTelegramPlane className="text-sky-500" size={18} />, external: true },
  ];

  const isMoreActive = moreLinks.some(link => location.pathname === link.path);

  const linkClass = ({ isActive }) => `
    relative px-4 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 flex items-center gap-1.5
    ${isActive 
      ? 'text-blue-700 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-500/20' 
      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent'
    }
  `;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/60 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-sm">
      
      {/* Primary Links */}
      <NavLink to="/" className={linkClass} end>
        Home
      </NavLink>
      
      {isAuthenticated && (
        <NavLink to="/dashboard" className={({ isActive }) => `
          relative px-5 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 flex items-center gap-1.5
          ${isActive 
            ? 'text-white bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg shadow-blue-500/30' 
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }
        `}>
          {({ isActive }) => (
            <span className="relative flex items-center gap-1.5">
              Dashboard
              {isActive && (
                <span className="absolute -top-1 -right-2.5 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse shadow-lg shadow-amber-400/50" />
              )}
            </span>
          )}
        </NavLink>
      )}
      
      <NavLink to="/services" className={linkClass}>
        Services
      </NavLink>
      
      <NavLink to="/blogs" className={linkClass}>
        Blogs
      </NavLink>

      {/* Dropdown container */}
      <div 
        ref={dropdownRef}
        className="relative group"
      >
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`
          flex items-center gap-1.5 px-4 py-2.5 font-black text-[12px] transition-all rounded-xl border
          ${isMoreActive 
            ? 'text-blue-700 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 shadow-sm border-blue-200/50 dark:border-blue-500/20' 
            : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border-transparent'
          }
        `}>
          <HiOutlineSparkles size={14} className={isMoreActive ? 'text-amber-500' : ''} />
          Explorer
          <HiOutlineChevronDown className={`text-sm transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
        </button>

        {/* Invisible Bridge */}
        <div className="absolute top-full left-0 right-0 h-4 bg-transparent z-[490]" />

        {/* Mega Dropdown */}
        <div className={`absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 transition-all duration-300 z-[500] origin-top ${
          isDropdownOpen ? 'opacity-100 visible scale-100 translate-y-0' : 'opacity-0 invisible scale-95 translate-y-2'
        }`}>
          <div className="w-[440px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] rounded-[1.5rem] p-3 border border-slate-200 dark:border-slate-700">
            
            {/* Dropdown Header */}
            <div className="flex items-center gap-3 px-3 pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-md">
                <FaGem size={14} className="text-white" />
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Discover More
                </p>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                  Resources, Policies & Legal
                </p>
              </div>
            </div>

            {/* Grid Links */}
            <div className="grid grid-cols-2 gap-1.5">
              {moreLinks.map((item) => {
                const isActive = location.pathname === item.path;
                const content = (
                  <>
                    <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isActive 
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30' 
                        : 'bg-slate-100 dark:bg-slate-800 group-hover/item:bg-white dark:group-hover/item:bg-slate-700 group-hover/item:scale-110 shadow-sm'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[12px] font-black transition-colors truncate ${
                        isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400'
                      }`}>
                        {item.name}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">
                        {item.sub}
                      </span>
                    </div>
                  </>
                );

                return item.external ? (
                  <a 
                    key={item.name}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsDropdownOpen(false)} // Close dropdown on click
                    className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 group/item border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    {content}
                  </a>
                ) : (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsDropdownOpen(false)} // Close dropdown on click
                    className={() => `
                      flex items-center gap-3 p-3 rounded-xl transition-all group/item border
                      ${isActive 
                        ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30' 
                        : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                    `}
                  >
                    {content}
                  </NavLink>
                );
              })}
            </div>
            
            {/* Footer */}
            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center border border-slate-100 dark:border-slate-700/50">
              <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
                Trusted Financial Ecosystem
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopMenu;