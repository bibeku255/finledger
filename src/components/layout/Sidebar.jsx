import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  HiOutlineViewGrid, HiOutlineLibrary, HiOutlineTrendingUp, HiOutlineTrendingDown, 
  HiOutlinePlusCircle, HiOutlineLightningBolt, HiOutlineRefresh, 
  HiOutlineUsers, HiOutlineShieldCheck, HiOutlineSparkles, 
  HiOutlineCalendar, HiOutlineCog, HiOutlineClock, 
  HiOutlineChevronDown, HiOutlineGlobe, HiOutlineCalculator,
  HiOutlineCash, HiOutlineReceiptTax, HiOutlineChartPie,
  HiOutlinePencilAlt
} from 'react-icons/hi';
import { 
  FaBitcoin, FaExchangeAlt, FaWallet, FaRobot, 
  FaLightbulb, FaTrophy, FaCreditCard,
  FaCoins, FaMapMarkerAlt, FaBullseye
} from 'react-icons/fa';

const Sidebar = ({ isOpen, onClose }) => {
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const location = useLocation();

  // 🚀 Auto-expand submenus if an active child route is loaded initially
  useEffect(() => {
    sections.forEach(sec => {
      sec.items.forEach(item => {
        if (item.submenu && item.submenu.some(sub => location.pathname === sub.path)) {
          setOpenSubmenu(item.name);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleSubmenu = (name) => {
    setOpenSubmenu(openSubmenu === name ? null : name);
  };

  const mainNav = [
    { name: 'Dashboard Overview', path: '/dashboard', icon: <HiOutlineViewGrid /> }
  ];

  const sections = [
    {
      title: "Money & Capital",
      items: [
        {
          name: "Balances",
          icon: <HiOutlineLibrary />,
          submenu: [
            { name: "Cash Wallet", path: "/dashboard/accounts/cash", icon: <HiOutlineCash /> },
            { name: "Bank Balance", path: "/dashboard/accounts/bank", icon: <HiOutlineLibrary /> },
            { name: "Online Wallets", path: "/dashboard/accounts/online", icon: <HiOutlineGlobe /> },
            { name: "Capital Shifting", path: "/dashboard/shifting", icon: <HiOutlineRefresh /> },
          ],
        },
        {
          name: "Cash Flow",
          icon: <HiOutlineTrendingUp />,
          submenu: [
            { name: "Income Streams", path: "/dashboard/income", icon: <HiOutlinePlusCircle /> },
            { name: "Expense Tracker", path: "/dashboard/expense", icon: <HiOutlineReceiptTax /> }, 
            { name: "History Logs", path: "/dashboard/history", icon: <HiOutlineClock /> },
          ],
        },
        {
          name: "Smart Khata & Loans", // 🚀 AI handles the EMI tracking now
          path: "/dashboard/parties",
          icon: <HiOutlineUsers />
        },
      ],
    },
    {
      title: "Digital Assets",
      items: [
        {
          name: "Crypto Engine",
          icon: <FaBitcoin />,
          submenu: [
            { name: "Main Assets", path: "/dashboard/crypto/wallet", icon: <FaWallet /> },
            { name: "Custom Tokens", path: "/dashboard/crypto/tokens", icon: <FaCoins /> }, 
            { name: "Faucet & Micro-Earn", path: "/dashboard/crypto/micro-earn", icon: <HiOutlineSparkles /> },
            { name: "Hold & Swap P/L", path: "/dashboard/crypto/hold-profit", icon: <FaBullseye /> }, 
            { name: "Swap & Bridge", path: "/dashboard/crypto/swap-bridge", icon: <FaExchangeAlt /> },
            { name: "Earn & Farming Vault", path: "/dashboard/crypto/staking", icon: <HiOutlineLightningBolt /> },
          ],
        }
      ],
    },
    {
      title: "Insights & Intelligence",
      items: [
        { name: "Analytics", path: "/dashboard/analytics", icon: <HiOutlineChartPie /> },
        { name: "AI Strategy", path: "/dashboard/strategy", icon: <FaRobot /> },
        { name: "Smart Suggestions", path: "/dashboard/suggestions", icon: <FaLightbulb /> },
        { name: "Goals & Savings", path: "/dashboard/goals", icon: <FaTrophy /> },
      ],
    },
    {
      title: "Reminders & Alerts",
      items: [
        { name: "Bill Payments", path: "/dashboard/alerts/bills", icon: <FaCreditCard /> },
      ],
    },
    {
      title: "Global Utilities",
      items: [
        {
          name: "Smart Tools",
          icon: <HiOutlineCalculator />,
          submenu: [
            { name: "Crypto-to-Forex", path: "/dashboard/tools/converter", icon: <FaExchangeAlt /> },
            { name: "Smart Calendar", path: "/dashboard/calendar", icon: <HiOutlineCalendar /> },
            { name: "Notes & Memos", path: "/dashboard/tools/notes", icon: <HiOutlinePencilAlt /> },
          ],
        },
        { 
          name: "Set Base Currency", 
          path: "/dashboard/settings/currency", 
          icon: <FaMapMarkerAlt />,
          isSpecial: true 
        },
        { name: "Profile Security", path: "/profile", icon: <HiOutlineCog /> },
      ],
    }
  ];

  const activeClass = "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]";
  const inactiveClass = "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-blue-400";

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[140] lg:hidden transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
        aria-label="Close sidebar overlay"
      />

      <aside className={`
        fixed lg:sticky top-[104px] md:top-[112px] left-0 h-[calc(100vh-104px)] z-[150] w-72 
        bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-white/5
        transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col
      `}>
        
        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar scroll-smooth">
          
          <div className="mb-6">
             {mainNav.map((item) => (
               <NavLink 
                key={item.name} 
                to={item.path} 
                end 
                className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${isActive ? activeClass : inactiveClass}`}
                onClick={() => window.innerWidth < 1024 && onClose()}
               >
                 <span className="text-xl shrink-0">{item.icon}</span>
                 <span className="font-bold text-[13px] tracking-tight">{item.name}</span>
               </NavLink>
             ))}
          </div>

          {sections.map((section, idx) => (
            <div key={idx} className="mb-6">
              <h3 className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <span className="w-1 h-1 bg-blue-500 rounded-full"></span> {section.title}
              </h3>
              
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <div key={item.name}>
                    {item.submenu ? (
                      <div>
                        <button 
                          onClick={() => toggleSubmenu(item.name)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-300 
                            ${openSubmenu === item.name ? 'bg-slate-50 dark:bg-white/5 text-blue-600 ring-1 ring-slate-100 dark:ring-white/5' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-blue-400'}`}
                        >
                          <div className={`flex items-center gap-3 font-bold text-[13px] ${item.isSpecial ? 'text-blue-500 dark:text-blue-400' : ''}`}>
                            <span className="text-lg">{item.icon}</span>
                            {item.name}
                          </div>
                          <HiOutlineChevronDown className={`transition-transform duration-300 ${openSubmenu === item.name ? 'rotate-180' : ''}`} />
                        </button>
                        
                        <div className={`overflow-hidden transition-all duration-400 ${openSubmenu === item.name ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                          {item.submenu.map((sub) => (
                            <NavLink 
                              key={sub.name} 
                              to={sub.path} 
                              className={({ isActive }) => `flex items-center gap-3 pl-11 pr-4 py-2 text-[12px] font-bold rounded-lg transition-all 
                                ${isActive ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-500/10 border-l-2 border-blue-600' : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400'}
                                ${sub.isSpecial ? 'text-blue-500 dark:text-blue-400' : ''} 
                              `}
                              onClick={() => {
                                window.innerWidth < 1024 && onClose();
                              }}
                            >
                              <span className="text-base opacity-70">{sub.icon}</span>
                              {sub.name}
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <NavLink 
                        to={item.path} 
                        className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 mb-0.5 ${isActive ? activeClass : inactiveClass} ${item.isSpecial ? '!text-blue-600 !bg-blue-50/50 dark:!bg-blue-500/10 ring-1 ring-blue-500/20' : ''}`} 
                        onClick={() => window.innerWidth < 1024 && onClose()}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span className="font-bold text-[13px]">{item.name}</span>
                      </NavLink>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-50/50 dark:bg-white/5 border-t border-slate-200 dark:border-white/5 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Multi-Gateway Finance Engine Live</span>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;