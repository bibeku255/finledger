// src/components/navbar/RightActions.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAIVoice } from '../../hooks/useAIVoice';
import { useNotifications } from '../../hooks/useNotifications';
import { useAIBrain } from '../../hooks/useAIBrain'; // ✅ J.A.R.V.I.S Engine
import {
  HiOutlineBell, HiOutlineLogout, HiOutlineCog, HiOutlineShieldCheck,
  HiOutlineGlobeAlt, HiCheck, HiOutlineSpeakerphone, HiOutlineSparkles,
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineCreditCard,
  HiOutlineLibrary, HiOutlineExclamationCircle, HiOutlineCalendar,
  HiOutlinePencilAlt, HiOutlineBadgeCheck, HiOutlineX
} from 'react-icons/hi';
import {
  FaTrophy, FaRegBellSlash, FaGem, FaCrown, FaBrain,
  FaBriefcase, FaShoppingCart
} from 'react-icons/fa';
import Avatar from '../ui/Avatar';

const RightActions = () => {
  const { user, avatar, displayName, dbData, logout, baseCurrency, isAdmin } = useAuth();
  const { initVoice } = useAIVoice();

  // ✅ J.A.R.V.I.S AI Engine — runs silently in background on every page
  // No UI needed here. It monitors trends and pushes to Firestore notifications.
  useAIBrain();

  // ✅ Central Notification Hub
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const currentCalendar = dbData?.settings?.baseCalendar || 'gregorian';
  const calendarLabels = {
    gregorian: 'AD',
    bikram_sambat: 'BS',
    hijri: 'Hijri',
    jalali: 'Jalali'
  };

  // ── Notification Click & Smart Routing ──
  const handleNotifClick = async (e, notif) => {
    e.stopPropagation();
    initVoice(); // Unlock mobile audio engine on user interaction
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    setIsNotifOpen(false);
    navigate(notif.actionLink || notif.link || '/dashboard/suggestions');
  };

  const getNotifIcon = (type, title = '') => {
    switch (type) {
      case 'MARKET ALERT':
        return title.toLowerCase().includes('dump') || title.toLowerCase().includes('crashing')
          ? <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-sm"><HiOutlineTrendingDown size={18} /></div>
          : <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm"><HiOutlineTrendingUp size={18} /></div>;
      case 'loan_alert':
        return <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm"><HiOutlineLibrary size={18} /></div>;
      case 'bill_alert':
        return <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 shadow-sm"><HiOutlineCreditCard size={18} /></div>;
      case 'SYSTEM ALERT':
        return <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-sm"><HiOutlineExclamationCircle size={18} /></div>;
      case 'SUGGESTION':
        return <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-sm"><FaTrophy size={16} /></div>;
      case 'INCOME':
        return <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm"><FaBriefcase size={16} /></div>;
      case 'EXPENSE':
        return <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-sm"><FaShoppingCart size={16} /></div>;
      default:
        return <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 shadow-sm"><HiOutlineSpeakerphone size={18} /></div>;
    }
  };

  const timeAgo = (timestamp) => {
    if (!timestamp) return '';
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const handleLogout = async () => {
    try { await logout(); navigate("/"); } catch (error) {}
  };

  // ── Click outside to close dropdowns ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {user ? (
        <>
          {/* 🔔 NOTIFICATIONS */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setIsNotifOpen(p => !p); setIsProfileOpen(false); initVoice(); }}
              className={`relative h-10 w-10 md:h-11 md:w-11 flex items-center justify-center rounded-xl md:rounded-2xl transition-all shadow-sm ${isNotifOpen
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
              <HiOutlineBell size={20} className={unreadCount > 0 ? "animate-swing origin-top" : ""} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white dark:border-slate-950" />
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            <div className={`absolute right-[-10px] md:right-0 top-[130%] w-[320px] md:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-700/50 rounded-[1.5rem] shadow-2xl transition-all duration-300 origin-top-right z-[500] overflow-hidden ${isNotifOpen ? 'scale-100 opacity-100 visible translate-y-0' : 'scale-95 opacity-0 invisible translate-y-2'}`}>

              {/* Header */}
              <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800/50 bg-gradient-to-r from-slate-50 to-transparent dark:from-white/[0.02] dark:to-transparent">
                <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  Alerts
                  {unreadCount > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider hover:text-blue-700 transition-colors flex items-center gap-1"
                  >
                    <HiCheck size={14} /> Read all
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                      <FaRegBellSlash className="text-xl text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      All caught up!
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {notifications.map(notif => (
                      <div
                        key={notif.id}
                        onClick={(e) => handleNotifClick(e, notif)}
                        className={`group relative p-4 flex gap-3 transition-colors cursor-pointer ${notif.isRead
                            ? 'opacity-70 hover:bg-white dark:hover:bg-slate-800'
                            : 'bg-blue-50/50 dark:bg-blue-500/10 hover:bg-blue-100/50'
                          }`}
                      >
                        {getNotifIcon(notif.type, notif.title)}
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className={`text-[12px] mb-0.5 truncate ${notif.isRead
                              ? 'font-bold text-slate-600 dark:text-slate-300'
                              : 'font-black text-slate-900 dark:text-white'
                            }`}>
                            {notif.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">
                            {notif.message}
                          </p>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-2 block">
                            {timeAgo(notif.rawTimestamp)}
                          </span>
                        </div>
                        {!notif.isRead && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all z-10"
                            title="Dismiss"
                          >
                            <HiOutlineX size={14} />
                          </button>
                        )}
                        {!notif.isRead && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.6)] group-hover:opacity-0 transition-opacity" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900">
                <button
                  onClick={() => { setIsNotifOpen(false); navigate('/dashboard/suggestions'); }}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:shadow-sm active:scale-95 flex items-center justify-center gap-2"
                >
                  <FaBrain size={14} /> Open J.A.R.V.I.S Engine
                </button>
              </div>
            </div>
          </div>

          {/* 👤 PROFILE DROPDOWN */}
          <div className="hidden md:block relative" ref={profileRef}>
            <button
              onClick={() => { setIsProfileOpen(p => !p); setIsNotifOpen(false); }}
              className={`group relative flex items-center justify-center transition-all ${isProfileOpen ? 'scale-95' : 'hover:scale-105 active:scale-95'}`}
            >
              <div className={`ring-2 rounded-full p-0.5 transition-all shadow-sm ${isProfileOpen
                  ? 'ring-blue-500 bg-blue-50 dark:bg-blue-500/20'
                  : 'ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 group-hover:ring-blue-400 dark:group-hover:ring-blue-500'
                }`}>
                <Avatar src={avatar} name={displayName} size={42} />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-blue-500 to-cyan-500 text-[9px] text-white font-black px-2 py-0.5 rounded-md shadow-md border-2 border-white dark:border-slate-950">
                {baseCurrency || 'USD'}
              </div>
            </button>

            {/* Profile Dropdown */}
            <div className={`absolute right-0 top-[130%] w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[1.5rem] shadow-2xl overflow-hidden z-[500] border border-slate-200 dark:border-slate-700 transition-all duration-300 origin-top-right ${isProfileOpen ? 'scale-100 opacity-100 visible translate-y-0' : 'scale-95 opacity-0 invisible translate-y-2'}`}>

              {/* User Info */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                    <FaGem size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-[14px] text-slate-800 dark:text-white truncate">{displayName}</p>
                    <p className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1 mt-0.5">
                      <HiOutlineBadgeCheck size={12} /> Verified
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-3 space-y-1.5">
                <button
                  onClick={() => { setIsProfileOpen(false); navigate('/dashboard/settings/currency'); }}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
                >
                  <span className="flex items-center gap-3 font-bold text-[12px] text-slate-600 dark:text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100">
                      <HiOutlineGlobeAlt size={16} />
                    </div>
                    Currency
                  </span>
                  <span className="bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-black px-2.5 py-1 rounded-lg">
                    {baseCurrency || 'USD'}
                  </span>
                </button>

                <button
                  onClick={() => { setIsProfileOpen(false); navigate('/profile'); }}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
                >
                  <span className="flex items-center gap-3 font-bold text-[12px] text-slate-600 dark:text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center border border-indigo-100">
                      <HiOutlineCalendar size={16} />
                    </div>
                    Calendar
                  </span>
                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[9px] font-black px-2.5 py-1 rounded-lg">
                    {calendarLabels[currentCalendar] || 'AD'}
                  </span>
                </button>

                {isAdmin && (
                  <Link
                    to="/admin/write"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3.5 mt-1 rounded-xl font-black text-[11px] bg-slate-900 text-white shadow-lg uppercase tracking-widest"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <HiOutlinePencilAlt size={16} />
                    </div>
                    Studio Admin
                    <FaCrown size={12} className="text-amber-400 ml-auto" />
                  </Link>
                )}

                <div className="h-px bg-slate-100 dark:bg-slate-800/50 my-2 mx-2" />

                <div className="flex gap-2">
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex-1 flex justify-center gap-2 px-3 py-3.5 rounded-xl font-black text-[10px] uppercase text-slate-500 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <HiOutlineCog size={16} /> Config
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex-1 flex justify-center gap-2 px-3 py-3.5 rounded-xl font-black text-[10px] uppercase text-rose-500 bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/20"
                  >
                    <HiOutlineLogout size={16} /> Exit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="font-black text-[12px] px-5 py-2.5 text-slate-600 hover:text-blue-600">
            Sign In
          </Link>
          <Link to="/signup" className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-2.5 rounded-xl font-black text-[12px] shadow-lg">
            Join Ecosystem
          </Link>
        </div>
      )}
    </div>
  );
};

export default RightActions;