// src/pages/insights/SmartSuggestions.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIVoice } from '../../hooks/useAIVoice';
import { useAuth } from '../../hooks/useAuth'; 
import { useNotifications } from '../../hooks/useNotifications'; // ✅ Enterprise Hook

import { 
  HiOutlineVolumeUp, HiOutlineVolumeOff, 
  HiOutlinePlay, HiOutlineStop, HiOutlineRefresh,
  HiOutlineShieldCheck, HiOutlineTrendingDown, HiOutlineTrendingUp, 
  HiOutlineLightBulb, HiOutlineSparkles, HiOutlineEye,
  HiOutlineBell, HiOutlineExclamation, HiOutlineCheck,
  HiOutlineArrowRight, HiOutlineClock, HiOutlineChip,
  HiOutlineX
} from 'react-icons/hi';
import { 
  FaRobot, FaBellSlash, FaBrain, FaMicrochip 
} from 'react-icons/fa';

// ============================================
// 🚀 PREMIUM COMPONENTS
// ============================================

const VoiceButton = ({ isSpeaking, isMuted, onToggle }) => (
  <button 
    onClick={onToggle} 
    className={`relative group flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm transition-all duration-500 overflow-hidden shrink-0
      ${isMuted 
        ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/20 shadow-sm' 
        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95'
      }`}
  >
    {isSpeaking && !isMuted && <span className="absolute inset-0 rounded-2xl animate-ping bg-blue-400/20" />}
    
    <span className="relative z-10">{isMuted ? <HiOutlineVolumeOff size={18} /> : <HiOutlineVolumeUp size={18} />}</span>
    <span className="relative z-10 hidden sm:inline">{isMuted ? 'Muted' : isSpeaking ? 'Speaking...' : 'Voice On'}</span>
    
    {isSpeaking && !isMuted && (
      <span className="relative z-10 flex gap-0.5 items-center ml-1">
        <span className="w-1 h-3 bg-white rounded-full animate-bounce" />
        <span className="w-1 h-4 bg-white rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
        <span className="w-1 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
      </span>
    )}
  </button>
);

const StatusBadge = ({ type, isActive }) => {
  const configs = {
    'ALERT': { icon: HiOutlineBell, color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-rose-200 dark:border-rose-500/30', dot: 'bg-rose-500' },
    'SUGGESTION': { icon: HiOutlineLightBulb, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30', dot: 'bg-amber-500' },
    'MARKET ALERT': { icon: HiOutlineTrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', dot: 'bg-emerald-500' },
    'SYSTEM ALERT': { icon: HiOutlineChip, color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-500/30', dot: 'bg-blue-500' },
    'WARNING': { icon: HiOutlineExclamation, color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-500/30', dot: 'bg-orange-500' },
    'INFO': { icon: HiOutlineSparkles, color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border-purple-200 dark:border-purple-500/30', dot: 'bg-purple-500' },
    'INCOME': { icon: HiOutlineTrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', dot: 'bg-emerald-500' },
    'EXPENSE': { icon: HiOutlineTrendingDown, color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-rose-200 dark:border-rose-500/30', dot: 'bg-rose-500' },
  };
  const config = configs[type] || configs['INFO'];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider border shadow-sm ${config.color} ${isActive ? 'ring-2 ring-current/30' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${config.dot}`} />
      <Icon size={12} />
      {type}
    </span>
  );
};

const AlertIcon = ({ type }) => {
  const iconMap = {
    shield: { icon: HiOutlineShieldCheck, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10', ring: 'ring-indigo-200 dark:ring-indigo-500/20' },
    bulb: { icon: HiOutlineLightBulb, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', ring: 'ring-amber-200 dark:ring-amber-500/20' },
    trendDown: { icon: HiOutlineTrendingDown, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', ring: 'ring-rose-200 dark:ring-rose-500/20' },
    trendUp: { icon: HiOutlineTrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', ring: 'ring-emerald-200 dark:ring-emerald-500/20' },
    brain: { icon: FaBrain, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', ring: 'ring-blue-200 dark:ring-blue-500/20' },
    chip: { icon: FaMicrochip, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', ring: 'ring-purple-200 dark:ring-purple-500/20' },
    income: { icon: HiOutlineTrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', ring: 'ring-emerald-200 dark:ring-emerald-500/20' },
    expense: { icon: HiOutlineTrendingDown, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', ring: 'ring-rose-200 dark:ring-rose-500/20' },
  };
  const config = iconMap[type] || iconMap.bulb;
  const Icon = config.icon;

  return (
    <div className={`p-3.5 sm:p-4 rounded-2xl ${config.bg} ring-1 ${config.ring} shadow-sm group-hover:scale-110 transition-transform duration-300 shrink-0`}>
      <Icon size={20} className={`sm:w-[24px] sm:h-[24px] ${config.color}`} />
    </div>
  );
};

const SuggestionCard = ({ item, isActive, onPlay, onNavigate, onDismiss, formatGlobalDate }) => (
  <div className={`group relative p-5 sm:p-6 rounded-[2rem] border-2 transition-all duration-500 overflow-hidden flex flex-col h-full
      ${isActive 
        ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-400 dark:border-blue-500/50 shadow-xl shadow-blue-500/10 scale-[1.01]' 
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg'
      }`}>
    
    {isActive && <div className="absolute inset-0 rounded-[2rem] border-2 border-blue-400/50 animate-ping-slow pointer-events-none" />}
    
    <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${isActive ? 'bg-blue-500' : 'bg-slate-500'}`} />
    
    <button 
      onClick={(e) => { e.stopPropagation(); onDismiss(item.id); }}
      className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-colors z-20"
      title="Dismiss Insight"
    >
      <HiOutlineX size={14} />
    </button>

    <div className="relative z-10 flex flex-col flex-1">
      <div className="flex items-start gap-4 mb-4 pr-6">
        <AlertIcon type={item.iconType} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusBadge type={item.type} isActive={isActive} />
            {item.rawTimestamp && (
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                <HiOutlineClock size={12} className="shrink-0" />
                <span className="truncate">{formatGlobalDate ? formatGlobalDate(item.rawTimestamp, 'short') : new Date(item.rawTimestamp).toLocaleDateString()}</span>
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight mb-2">
            {item.title}
          </h3>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            {item.message}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/50">
        <button 
          onClick={(e) => { e.stopPropagation(); onPlay(item.id, item.message); }} 
          className={`group/btn p-3 sm:p-3.5 rounded-xl transition-all flex items-center justify-center shrink-0 border shadow-sm
            ${isActive 
              ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 hover:bg-rose-100' 
              : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
            }`}
          title={isActive ? "Stop Reading" : "Read Aloud"}
        >
          {isActive ? <HiOutlineStop size={20} className="animate-pulse" /> : <HiOutlinePlay size={20} className="group-hover/btn:scale-110 transition-transform" />}
        </button>
        
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onDismiss(item.id); 
            onNavigate(item.actionLink || '/dashboard'); 
          }}
          className="flex-1 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 hover:from-slate-800 hover:to-slate-700 dark:hover:from-slate-200 dark:hover:to-slate-300 text-white dark:text-slate-900 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
        >
          {item.actionText || 'Review Details'}
          <HiOutlineArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="text-center py-16 sm:py-24 px-4 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm col-span-full">
    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-200 dark:border-slate-700">
      <FaBellSlash className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 dark:text-slate-500" />
    </div>
    <h3 className="text-xl sm:text-2xl font-black text-slate-700 dark:text-white mb-2">All Clear, Sir!</h3>
    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto">
      No new alerts or suggestions. Your financial health looks great — J.A.R.V.I.S is monitoring your vaults 24/7.
    </p>
  </div>
);

const LoadingState = () => (
  <div className="text-center py-16 sm:py-24 px-4 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm col-span-full">
    <div className="relative w-24 h-24 mx-auto mb-8">
      <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse scale-[1.5]" />
      <FaRobot className="w-20 h-20 sm:w-24 sm:h-24 text-blue-500 relative animate-bounce drop-shadow-2xl mx-auto" />
    </div>
    <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mb-3">J.A.R.V.I.S is Thinking...</h3>
    <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
      Analyzing cross-vault metrics, expense patterns & market conditions
    </p>
    
    <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
      {['Scanning Bank Vaults', 'Evaluating Crypto Exposure', 'Checking Bill Deadlines', 'Generating Insights'].map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 animate-pulse"
          style={{ animationDelay: `${i * 0.3}s` }}>
          <HiOutlineRefresh className="animate-spin text-blue-500" size={14} />
          {step}
        </div>
      ))}
    </div>
  </div>
);

// ============================================
// 🚀 MAIN COMPONENT
// ============================================

const SmartSuggestions = () => {
  const navigate = useNavigate(); 
  const { formatGlobalDate } = useAuth();
  const { speak, stop, isSpeaking, isMuted, toggleMute, initVoice } = useAIVoice();
  
  // 🚀 Call Hooks correctly inside the component!
  const { notifications, markAsRead } = useNotifications(); 
  
  const [activeId, setActiveId] = useState(null);
  const [isBrainLoading, setIsBrainLoading] = useState(true);

  // Artificial premium loading state
  useEffect(() => {
    const timer = setTimeout(() => setIsBrainLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // 🚀 SINGLE SOURCE OF TRUTH: Only unread alerts from Hook
  const firebaseAlerts = useMemo(() => {
    return notifications.filter(n => !n.isRead);
  }, [notifications]);

  // 🚀 Enterprise Permanent Dismiss Logic
  const handleDismiss = async (id) => {
    if (activeId === id) stop();
    // This updates Firebase, clearing the alert here AND in Navbar bell
    await markAsRead(id);
  };

  useEffect(() => {
    if (!isSpeaking) setActiveId(null);
  }, [isSpeaking]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const handlePlay = (id, text) => {
    initVoice(); // ✅ Unlock Audio Engine before playing
    if (isSpeaking && activeId === id) {
      stop(); 
      setActiveId(null);
    } else {
      setActiveId(id); 
      speak(text);
    }
  };

  return (
    <div className="pt-20 sm:pt-24 space-y-6 sm:space-y-8 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 🚀 HEADER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-6 sm:p-8 lg:p-10 shadow-2xl border border-slate-700/50 group">
        <div className="absolute right-[-10%] top-[-15%] opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 pointer-events-none">
          <FaRobot size={280} className="text-white" />
        </div>
        
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.5s'}} />
          <div className="absolute bottom-10 left-1/3 w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '1s'}} />
          <div className="absolute bottom-20 right-1/4 w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '1.5s'}} />
        </div>
        
        <div className={`absolute top-1/4 right-1/4 w-48 h-48 rounded-full blur-3xl transition-all duration-700 pointer-events-none
          ${isSpeaking ? 'bg-blue-500/20 scale-150' : 'bg-blue-500/5 scale-100'}`} />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] transition-all duration-500 shrink-0
              ${isSpeaking 
                ? 'bg-blue-500/30 ring-2 ring-blue-400/50 shadow-lg shadow-blue-500/30' 
                : 'bg-blue-500/10 ring-1 ring-blue-500/20'
              }`}>
              <FaRobot size={28} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
                J.A.R.V.I.S
                <span className="text-[9px] sm:text-[10px] font-black text-blue-400 bg-blue-500/20 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-blue-500/30">
                  AI Assistant
                </span>
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-400 max-w-lg mt-1.5">
                Cross-vault intelligence engine • Real-time insights & voice notifications
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isSpeaking && (
              <div className="hidden sm:flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-400 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm">
                <div className="flex gap-0.5 items-center">
                  <span className="w-1.5 h-2.5 bg-blue-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-3.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
                  <span className="w-1.5 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                </div>
                Active
              </div>
            )}
            <VoiceButton 
              isSpeaking={isSpeaking}
              isMuted={isMuted}
              onToggle={toggleMute}
            />
          </div>
        </div>
      </div>

      {/* 🚀 ALERTS LIST */}
      <div className="space-y-4 sm:space-y-6">
        {isBrainLoading ? (
          <LoadingState />
        ) : firebaseAlerts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex items-center justify-between px-2">
              <h2 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <HiOutlineEye size={18} />
                {firebaseAlerts.length} Insight{firebaseAlerts.length !== 1 ? 's' : ''}
              </h2>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                Real-time Active
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {firebaseAlerts.map((item) => (
                <SuggestionCard
                  key={item.id}
                  item={item}
                  isActive={activeId === item.id && isSpeaking}
                  onPlay={handlePlay}
                  onNavigate={(link) => navigate(link)}
                  onDismiss={handleDismiss}
                  formatGlobalDate={formatGlobalDate}
                />
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* 🚀 FOOTER */}
      <div className="text-center py-6 px-4 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm mt-8">
        <p className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 flex-wrap uppercase tracking-widest">
          <FaBrain className="text-blue-500" size={14} />
          Powered by J.A.R.V.I.S Engine v2.0
          <span className="text-blue-500 hidden sm:inline">•</span>
          Cross-vault analysis
          <span className="text-blue-500 hidden sm:inline">•</span>
          24/7 monitoring
        </p>
      </div>

    </div>
  );
};

export default SmartSuggestions;