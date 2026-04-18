import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  HiOutlineViewGrid, HiOutlineLibrary, HiOutlineTrendingUp, HiOutlineTrendingDown, 
  HiOutlinePlusCircle, HiOutlineLightningBolt, HiOutlineRefresh, 
  HiOutlineUsers, HiOutlineShieldCheck, HiOutlineSparkles, 
  HiOutlineCalendar, HiOutlineCog, HiOutlineClock, 
  HiOutlineChevronDown, HiOutlineGlobe, HiOutlineCalculator,
  HiOutlineCash, HiOutlineReceiptTax, HiOutlineChartPie,
  HiOutlinePencilAlt, HiOutlineChevronDoubleLeft, HiOutlineChevronDoubleRight,
  HiOutlineStar, HiOutlineFire, HiOutlineCube, HiOutlineChip
} from 'react-icons/hi';
import { 
  FaBitcoin, FaExchangeAlt, FaWallet, FaRobot, 
  FaLightbulb, FaTrophy, FaCreditCard,
  FaCoins, FaMapMarkerAlt, FaBullseye, FaGem
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// 🚀 PREMIUM: Tooltip Component
const Tooltip = ({ children, text, position = 'right' }) => (
  <div className="relative group/tooltip">
    {children}
    <div className={`absolute ${position === 'right' ? 'left-full ml-2' : 'right-full mr-2'} top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-800/95 dark:bg-slate-700/95 backdrop-blur-md text-white text-[10px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none z-50 shadow-xl border border-slate-600/50`}>
      {text}
      <div className={`absolute top-1/2 -translate-y-1/2 ${position === 'right' ? '-left-1' : '-right-1'} w-2 h-2 bg-inherit rotate-45 border-inherit border-t-0 ${position === 'right' ? 'border-r-0' : 'border-l-0'}`} />
    </div>
  </div>
);

// 🚀 PREMIUM: Animated Submenu Item
const SubmenuItem = ({ sub, onClose, isActive }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <NavLink 
      key={sub.name} 
      to={sub.path} 
      className={({ isActive: active }) => `
        relative flex items-center gap-3 pl-11 pr-4 py-2.5 text-[12px] font-bold rounded-lg transition-all duration-300
        ${active 
          ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 shadow-sm' 
          : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-white/5'
        }
        ${sub.isSpecial ? 'text-purple-500 dark:text-purple-400' : ''} 
      `}
      onClick={() => {
        window.innerWidth < 1024 && onClose();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={`text-base transition-all duration-300 ${isHovered ? 'scale-110 text-blue-500' : 'opacity-70'}`}>
        {sub.icon}
      </span>
      <span className="flex-1">{sub.name}</span>
      {sub.isNew && (
        <span className="px-1.5 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[8px] font-black rounded-full animate-pulse">
          NEW
        </span>
      )}
      {sub.isHot && (
        <span className="px-1.5 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[8px] font-black rounded-full">
          🔥 HOT
        </span>
      )}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-2 text-blue-500"
        >
          <div className="w-1 h-1 rounded-full bg-blue-500" />
        </motion.div>
      )}
    </NavLink>
  );
};

// 🚀 PREMIUM: Section Header with Collapse
const SectionHeader = ({ title, count, isCollapsed, onToggle }) => (
  <button
    onClick={onToggle}
    className="w-full px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center justify-between group"
  >
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isCollapsed ? 'bg-slate-400' : 'bg-blue-500 animate-pulse'}`} />
      <span className="group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
        {title}
      </span>
      {count > 0 && (
        <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[8px] font-black">
          {count}
        </span>
      )}
    </div>
    <HiOutlineChevronDown className={`transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''} opacity-0 group-hover:opacity-100`} size={12} />
  </button>
);

// 🚀 PREMIUM: Nav Item with Hover Effects
const NavItem = ({ item, activeClass, inactiveClass, onClose, toggleSubmenu, openSubmenu, isCollapsed }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isOpen = openSubmenu === item.name;
  
  if (item.submenu) {
    return (
      <div>
        <button 
          onClick={() => toggleSubmenu(item.name)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden
            ${isOpen 
              ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20' 
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
        >
          {/* Hover Background Effect */}
          {isHovered && !isOpen && (
            <motion.div
              layoutId="hover-bg"
              className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-cyan-500/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
          
          <div className={`relative flex items-center gap-3 font-bold text-[13px] ${item.isSpecial ? 'text-purple-500 dark:text-purple-400' : ''}`}>
            <span className={`text-lg transition-all duration-300 ${isHovered ? 'scale-110 text-blue-500' : ''}`}>
              {item.icon}
            </span>
            <span>{item.name}</span>
            {item.isNew && (
              <span className="ml-1 px-1.5 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[8px] font-black rounded-full">
                NEW
              </span>
            )}
          </div>
          
          <div className="relative flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400">
              {item.submenu.length}
            </span>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <HiOutlineChevronDown size={14} />
            </motion.div>
          </div>
        </button>
        
        <AnimatePresence>
          {isOpen && !isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-1 ml-2 space-y-0.5 border-l border-slate-200 dark:border-slate-800/50">
                {item.submenu.map((sub) => (
                  <SubmenuItem 
                    key={sub.name} 
                    sub={sub} 
                    onClose={onClose}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Tooltip text={item.description || item.name} position="right">
      <NavLink 
        to={item.path} 
        className={({ isActive }) => `
          relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 mb-0.5 group overflow-hidden
          ${isActive ? activeClass : inactiveClass} 
          ${item.isSpecial ? '!text-purple-600 dark:!text-purple-400 !bg-purple-50/50 dark:!bg-purple-500/10 ring-1 ring-purple-500/20' : ''}
        `} 
        onClick={() => window.innerWidth < 1024 && onClose()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {({ isActive }) => (
          <>
            {/* Active Indicator */}
            {isActive && (
              <motion.div
                layoutId="active-indicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-r-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
            
            {/* Glow Effect on Hover */}
            {isHovered && !isActive && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent" />
            )}
            
            <span className={`relative text-lg transition-all duration-300 ${isHovered ? 'scale-110 text-blue-500' : ''}`}>
              {item.icon}
            </span>
            <span className="relative font-bold text-[13px] flex-1">{item.name}</span>
            
            {/* Active Dot */}
            {isActive && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-1.5 h-1.5 rounded-full bg-blue-500"
              />
            )}
            
            {/* Hover Arrow */}
            {isHovered && !isActive && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-blue-500"
              >
                <HiOutlineChevronDoubleRight size={12} />
              </motion.div>
            )}
          </>
        )}
      </NavLink>
    </Tooltip>
  );
};

const Sidebar = ({ isOpen, onClose }) => {
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [hoveredSection, setHoveredSection] = useState(null);
  const location = useLocation();
  const sidebarRef = useRef(null);

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

  const toggleSection = (title) => {
    setCollapsedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const mainNav = [
    { 
      name: 'Dashboard Overview', 
      path: '/dashboard', 
      icon: <HiOutlineViewGrid />,
      description: 'View your financial overview'
    }
  ];

  const sections = [
    {
      title: "Money & Capital",
      items: [
        {
          name: "Balances",
          icon: <HiOutlineLibrary />,
          description: "Manage your cash and bank balances",
          submenu: [
            { name: "Cash Wallet", path: "/dashboard/accounts/cash", icon: <HiOutlineCash /> },
            { name: "Bank Balance", path: "/dashboard/accounts/bank", icon: <HiOutlineLibrary /> },
            { name: "Online Wallets", path: "/dashboard/accounts/online", icon: <HiOutlineGlobe /> },
            { name: "Capital Shifting", path: "/dashboard/shifting", icon: <HiOutlineRefresh />, isNew: true },
          ],
        },
        {
          name: "Cash Flow",
          icon: <HiOutlineTrendingUp />,
          description: "Track income and expenses",
          submenu: [
            { name: "Income Streams", path: "/dashboard/income", icon: <HiOutlinePlusCircle /> },
            { name: "Expense Tracker", path: "/dashboard/expense", icon: <HiOutlineReceiptTax /> }, 
            { name: "History Logs", path: "/dashboard/history", icon: <HiOutlineClock /> },
          ],
        },
        {
          name: "Smart Khata & Loans",
          path: "/dashboard/parties",
          icon: <HiOutlineUsers />,
          description: "AI-powered EMI and loan tracking"
        },
      ],
    },
    {
      title: "Digital Assets",
      items: [
        {
          name: "Crypto Engine",
          icon: <FaBitcoin />,
          description: "Manage your crypto portfolio",
          submenu: [
            { name: "Main Assets", path: "/dashboard/crypto/wallet", icon: <FaWallet /> },
            { name: "Custom Tokens", path: "/dashboard/crypto/tokens", icon: <FaCoins /> }, 
            { name: "Faucet & Micro-Earn", path: "/dashboard/crypto/micro-earn", icon: <HiOutlineSparkles />, isHot: true },
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
        { name: "Analytics", path: "/dashboard/analytics", icon: <HiOutlineChartPie />, description: "Visual data insights" },
        { name: "AI Strategy", path: "/dashboard/strategy", icon: <FaRobot />, description: "AI-powered recommendations", isNew: true },
        { name: "Smart Suggestions", path: "/dashboard/suggestions", icon: <FaLightbulb />, description: "Personalized tips" },
        { name: "Goals & Savings", path: "/dashboard/goals", icon: <FaTrophy />, description: "Track your financial goals" },
      ],
    },
    {
      title: "Reminders & Alerts",
      items: [
        { name: "Bill Payments", path: "/dashboard/alerts/bills", icon: <FaCreditCard />, description: "Upcoming bill reminders" },
      ],
    },
    {
      title: "Global Utilities",
      items: [
        {
          name: "Smart Tools",
          icon: <HiOutlineCalculator />,
          description: "Conversion and planning tools",
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
          isSpecial: true,
          description: "Change your default currency"
        },
        { name: "Profile Security", path: "/profile", icon: <HiOutlineCog />, description: "Manage account security" },
      ],
    }
  ];

  const activeClass = "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]";
  const inactiveClass = "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-blue-400";

  return (
    <>
      {/* Premium Overlay: Ensuring it doesn't block clicks when closed */}
      <motion.div 
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[35] lg:hidden ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpen ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClose}
        aria-label="Close sidebar overlay"
      />

      {/* Premium Sidebar: Changed position and height constraints */}
      <motion.aside 
        ref={sidebarRef}
        className={`
          absolute lg:relative left-0 top-0 z-40 w-72
          h-[calc(100dvh-120px)] 
          bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 
          border-r border-slate-200/50 dark:border-white/5
          shadow-2xl shadow-black/5 dark:shadow-black/20
          flex flex-col
        `}
        initial={false}
        animate={{ x: isOpen ? 0 : (window.innerWidth >= 1024 ? 0 : '-100%') }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {/* Decorative Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500" />
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar scroll-smooth h-full">
          
          {/* Main Navigation */}
          <div className="mb-6">
            {mainNav.map((item) => (
              <NavItem
                key={item.name}
                item={item}
                activeClass={activeClass}
                inactiveClass={inactiveClass}
                onClose={onClose}
                toggleSubmenu={toggleSubmenu}
                openSubmenu={openSubmenu}
              />
            ))}
          </div>

          {/* Sections */}
          {sections.map((section, idx) => {
            const isCollapsed = collapsedSections[section.title];
            const itemCount = section.items.reduce((acc, item) => 
              acc + (item.submenu ? item.submenu.length : 1), 0
            );
            
            return (
              <div 
                key={idx} 
                className="mb-6"
                onMouseEnter={() => setHoveredSection(section.title)}
                onMouseLeave={() => setHoveredSection(null)}
              >
                <SectionHeader 
                  title={section.title} 
                  count={itemCount}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleSection(section.title)}
                />
                
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5">
                        {section.items.map((item) => (
                          <NavItem
                            key={item.name}
                            item={item}
                            activeClass={activeClass}
                            inactiveClass={inactiveClass}
                            onClose={onClose}
                            toggleSubmenu={toggleSubmenu}
                            openSubmenu={openSubmenu}
                            isCollapsed={isCollapsed}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Premium Footer */}
        <div className="mx-4 mb-4 shrink-0">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
            <div className="relative p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
                    Multi-Gateway
                  </p>
                  <p className="text-[8px] font-bold text-emerald-400">
                    ● All Systems Live
                  </p>
                </div>
              </div>
              
              {/* Gateway Status Indicators */}
              <div className="grid grid-cols-3 gap-1 mt-3">
                {['API', 'WS', 'DB'].map((gateway) => (
                  <div key={gateway} className="flex items-center justify-center gap-1 px-1 py-1 bg-slate-700/30 rounded-lg">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[7px] font-black text-slate-400">{gateway}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Version Badge */}
          <div className="flex items-center justify-center gap-2 mt-3 text-[8px] font-black text-slate-400 uppercase tracking-wider">
            <span>v2.4.1</span>
            <span className="w-1 h-1 bg-slate-600 rounded-full" />
            <span className="text-emerald-500">Stable</span>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;