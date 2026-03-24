import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  HiChevronDown, HiOutlineInformationCircle, HiOutlinePhone, 
  HiOutlineSupport, HiOutlineShieldCheck, HiOutlineDocumentText, 
  HiOutlineQuestionMarkCircle, HiOutlineScale 
} from 'react-icons/hi';
import { FaTelegramPlane } from 'react-icons/fa';

const DesktopMenu = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isAuthenticated = !!user;

  const moreLinks = [
    { name: 'About Us', sub: 'Our Mission', path: '/about', icon: <HiOutlineInformationCircle className="text-blue-500" /> },
    { name: 'Contact', sub: 'Get in touch', path: '/contact', icon: <HiOutlinePhone className="text-emerald-500" /> },
    { name: 'Support', sub: 'Help center', path: '/support', icon: <HiOutlineSupport className="text-orange-500" /> },
    { name: 'Privacy', sub: 'Data safety', path: '/privacy', icon: <HiOutlineShieldCheck className="text-cyan-500" /> },
    { name: 'Terms', sub: 'User agreement', path: '/terms', icon: <HiOutlineDocumentText className="text-indigo-500" /> },
    { name: 'Disclaimer', sub: 'Legal notes', path: '/disclaimer', icon: <HiOutlineScale className="text-slate-500" /> },
    { name: 'FAQ', sub: 'Common Q&A', path: '/faq', icon: <HiOutlineQuestionMarkCircle className="text-purple-500" /> },
    { name: 'Notice', sub: 'Telegram', path: 'https://t.me/bpcryptocraft', icon: <FaTelegramPlane className="text-sky-500" />, external: true },
  ];

  const isMoreActive = moreLinks.some(link => location.pathname === link.path);

  const linkClass = ({ isActive }) => `
    px-3.5 py-1.5 rounded-xl text-[12px] font-black transition-all duration-300 flex items-center
    ${isActive 
      ? 'text-blue-600 bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-white/10' 
      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
    }
  `;

  return (
    <div className="flex items-center gap-0.5 bg-slate-100/60 dark:bg-white/5 p-1 rounded-xl border border-slate-200/40 dark:border-white/5 backdrop-blur-md">
      
      {/* Primary Links */}
      <NavLink to="/" className={linkClass} end>Home</NavLink>
      
      {isAuthenticated && (
        <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
      )}
      
      <NavLink to="/services" className={linkClass}>Services</NavLink>
      <NavLink to="/blogs" className={linkClass}>Blogs</NavLink>

      {/* Dropdown Section */}
      <div className="relative group py-1 px-1"> {/* Added padding to bridge the gap for mouse movement */}
        <button className={`
          flex items-center gap-1.5 px-3.5 py-1.5 font-black text-[12px] transition-all rounded-xl
          ${isMoreActive 
            ? 'text-blue-600 bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-white/10' 
            : 'text-slate-500 group-hover:text-blue-600 group-hover:bg-white/50 dark:group-hover:bg-slate-800/50'}
        `}>
          Explorer
          <HiChevronDown className={`text-sm transition-transform duration-500 ${isMoreActive ? '' : 'group-hover:rotate-180'}`} />
        </button>

        {/* Dropdown Menu - Added z-[500] and pointer-events-none adjustment */}
        <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-[400px] pt-4 pointer-events-none group-hover:pointer-events-auto transition-all duration-300 z-[500]">
            <div className="bg-white dark:bg-slate-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] rounded-[1.5rem] p-2.5 border border-slate-100 dark:border-white/10 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 grid grid-cols-2 gap-1 overflow-hidden">
            
            {moreLinks.map((item) => {
                const content = (
                <>
                    <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center text-lg transition-all 
                    ${location.pathname === item.path ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800 group-hover/item:scale-110'}
                    `}>
                    {item.icon}
                    </div>
                    <div className="flex flex-col">
                    <span className={`text-[12px] font-black transition-colors ${location.pathname === item.path ? 'text-blue-600' : 'text-slate-700 dark:text-slate-200'}`}>
                        {item.name}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none">
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
                    className="flex items-center gap-3 p-2 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-white/5 group/item"
                >
                    {content}
                </a>
                ) : (
                <NavLink
                    key={item.name}
                    to={item.path}
                    className={({ isActive }) => `
                    flex items-center gap-3 p-2 rounded-xl transition-all
                    ${isActive 
                        ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-100 dark:ring-blue-500/20' 
                        : 'hover:bg-slate-50 dark:hover:bg-white/5 group/item'}
                    `}
                >
                    {content}
                </NavLink>
                );
            })}
            
            <div className="col-span-2 mt-1.5 p-2 bg-slate-50 dark:bg-white/5 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Trusted Financial Ecosystem
                </p>
            </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopMenu;