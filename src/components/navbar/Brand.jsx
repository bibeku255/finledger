import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth'; 
import logo from '../../assets/logo.svg'; 

const Brand = ({ toggleSidebar }) => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const title = "Finledger";
  
  // High-End Modern Gradients for each letter
  const letterGradients = [
    'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', // F
    'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)', // i
    'linear-gradient(135deg, #10b981 0%, #34d399 100%)', // n
    'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', // l
    'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)', // e
    'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', // d
    'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)', // g
    'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', // e
    'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)', // r
  ];

  return (
    <div className="flex items-center space-x-2 md:space-x-3 group select-none py-1">
      {/* 1. Logo Section (Acts as Sidebar Trigger) */}
      <div 
        onClick={isAuthenticated ? toggleSidebar : undefined}
        className={`relative transition-all duration-500 p-1.5 rounded-2xl ${
          isAuthenticated 
            ? 'cursor-pointer active:scale-90 hover:bg-blue-500/10' 
            : 'cursor-not-allowed opacity-60'
        }`}
      >
        <div className={`relative z-10 transition-all duration-700 ${isAuthenticated ? 'group-hover:rotate-[360deg] scale-110' : ''}`}>
          <img src={logo} alt="Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-[0_4px_12px_rgba(59,130,246,0.4)]" />
        </div>
        
        {/* Modern Pulse/Glow Effect for Authenticated Users */}
        {isAuthenticated && (
          <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-0 group-hover:scale-125 transition-all duration-700 opacity-0 group-hover:opacity-100 animate-pulse" />
        )}

        {/* Status Indicator */}
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 z-20 flex items-center justify-center transition-colors ${
          isAuthenticated ? 'bg-emerald-500' : 'bg-slate-500'
        }`}>
          {!isAuthenticated && <span className="text-[8px] text-white">🔒</span>}
        </div>
      </div>

      {/* 2. Text Content */}
      <div className="flex flex-col leading-tight">
        <div className="flex items-center">
          <h1 className={`font-black tracking-tighter flex items-center ${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
            {title.split('').map((letter, index) => (
              <span
                key={index}
                className="inline-block transition-all duration-500 group-hover:-translate-y-1"
                style={{
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  backgroundImage: letterGradients[index % letterGradients.length],
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                  transitionDelay: `${index * 0.05}s`
                }}
              >
                {letter}
              </span>
            ))}
          </h1>
          {/* Dashboard Active Dot */}
          {isAuthenticated && (
            <div className="ml-2 flex gap-1">
               <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
               <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-75" />
            </div>
          )}
        </div>

        {/* 3. Subtitle Section (Professional & Clear) */}
        <div className={`font-bold uppercase tracking-widest mt-0.5 ${isMobile ? 'text-[7px]' : 'text-[10px]'}`}>
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">SMART</span>
              <span className="relative px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 overflow-hidden group">
                FINANCE ENGINE
                <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
              </span>
            </div>
          ) : (
            <p className="text-rose-500 flex items-center gap-1.5 italic opacity-80">
              <span className="px-1.5 py-0.5 bg-rose-500/10 rounded-md border border-rose-500/20 font-black">LOGIN REQUIRED</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Brand;