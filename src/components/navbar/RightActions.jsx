import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HiOutlineSearch,
  HiOutlineBell,
  HiOutlineLogout,
  HiOutlineCog,
  HiOutlineShieldCheck,
  HiOutlineGlobeAlt,
  HiCheck,
  HiOutlineSpeakerphone,
  HiOutlineSparkles,
  HiOutlineTrendingUp,
  HiOutlineTrendingDown,
  HiOutlineCreditCard,
  HiOutlineLibrary,
  HiOutlineExclamationCircle,
  HiOutlineCalendar,
  HiOutlinePencilAlt // 🚀 ADDED PENCIL ICON FOR ADMIN
} from "react-icons/hi";
import { FaTrophy, FaRegBellSlash } from 'react-icons/fa';

import { useAuth } from "../../hooks/useAuth";
import Avatar from "../ui/Avatar";

// 🔥 Firebase Imports
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

const RightActions = () => {
  const {
    user,
    avatar,
    displayName,
    dbData,
    logout,
    baseCurrency,
  } = useAuth();

  const navigate = useNavigate();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // 🔔 Notification State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

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

  /* ================================
     FETCH FIREBASE NOTIFICATIONS
  ================================= */
  useEffect(() => {
    if (!user) return;
    
    // Listen to the top 20 recent notifications
    const q = query(
      collection(db, "users", user.uid, "notifications"), 
      orderBy("timestamp", "desc"), 
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    });

    return () => unsubscribe();
  }, [user]);

  /* ================================
     NOTIFICATION HANDLERS
  ================================= */
  const markAsRead = async (id, isRead) => {
    if (isRead || !user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "notifications", id), { isRead: true });
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.isRead).forEach(n => {
        const notifRef = doc(db, "users", user.uid, "notifications", n.id);
        batch.update(notifRef, { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif.id, notif.isRead);
    }
    if (notif.link) {
      setIsNotifOpen(false);
      navigate(notif.link);
    }
  };

  const getNotifIcon = (type, title = '') => {
    switch (type) {
      case 'market_alert': 
        return title.includes('Pump') 
          ? <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-200"><HiOutlineTrendingUp size={20}/></div>
          : <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-200"><HiOutlineTrendingDown size={20}/></div>;
      case 'loan_alert': 
        return <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-200"><HiOutlineLibrary size={20}/></div>;
      case 'bill_alert': 
        return <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 border border-orange-200"><HiOutlineCreditCard size={20}/></div>;
      case 'system_alert': 
        return <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-200"><HiOutlineExclamationCircle size={20}/></div>;
      case 'goal_milestone': 
        return <div className="w-10 h-10 rounded-full bg-yellow-50 text-yellow-500 flex items-center justify-center shrink-0 border border-yellow-200"><FaTrophy size={18}/></div>;
      case 'ai_insight': 
        return <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center shrink-0 border border-purple-200"><HiOutlineSparkles size={20}/></div>;
      default: 
        return <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 border border-blue-200"><HiOutlineSpeakerphone size={20}/></div>;
    }
  };

  const timeAgo = (timestamp) => {
    if (!timestamp) return '';
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* 🚀 SEARCH (Visible on Desktop Only) */}
      <div className="hidden md:block relative" ref={searchRef}>
        <button
          onClick={() => {
             setIsSearchOpen((p) => !p);
             setIsProfileOpen(false);
             setIsNotifOpen(false);
          }}
          className="p-2.5 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <HiOutlineSearch size={22} />
        </button>

        {isSearchOpen && (
          <div className="absolute right-0 top-[140%] w-[320px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-4 z-50 border border-slate-100 dark:border-white/5 animate-in fade-in slide-in-from-top-2">
            <input
              autoFocus
              placeholder="Search features, tools..."
              className="w-full bg-slate-100 dark:bg-white/5 p-3 rounded-xl text-sm font-bold outline-none dark:text-white placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {/* AUTHENTICATED USER */}
      {user ? (
        <>
          {/* 🚀 REAL-TIME NOTIFICATIONS (Visible on BOTH Mobile & Desktop) */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => {
                 setIsNotifOpen((p) => !p);
                 setIsProfileOpen(false);
                 setIsSearchOpen(false);
              }}
              // CSS Adjusted for Mobile matching Hamburger Menu
              className={`relative h-10 w-10 md:h-auto md:w-auto md:p-2.5 flex items-center justify-center rounded-xl md:rounded-2xl transition-all ${isNotifOpen ? 'bg-blue-50 dark:bg-slate-800 text-blue-600' : 'bg-slate-100 md:bg-transparent dark:bg-slate-900 md:dark:bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              <HiOutlineBell size={22} className={unreadCount > 0 ? "animate-wiggle" : ""} />
              
              {/* Red Ping Dot indicating unread notifications */}
              {unreadCount > 0 && (
                 <span className="absolute top-2 md:top-2 right-2.5 md:right-2.5 flex h-2.5 w-2.5">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white dark:border-slate-950"></span>
                 </span>
              )}
            </button>

            {/* 🚀 NOTIFICATION DROPDOWN (Mobile Optimized Width & Alignment) */}
            <div className={`absolute right-[-50px] md:right-0 top-[140%] w-[340px] md:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-2xl transition-all duration-300 origin-top-right z-50 overflow-hidden ${isNotifOpen ? 'scale-100 opacity-100 visible animate-in fade-in slide-in-from-top-2' : 'scale-95 opacity-0 invisible'}`}>
              
              {/* Header */}
              <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5">
                <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2">
                  Activity Hub {unreadCount > 0 && <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-lg">{unreadCount} New</span>}
                </h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline flex items-center gap-1 transition-colors">
                    <HiCheck size={14}/> Mark all read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center">
                    <FaRegBellSlash className="text-4xl text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-sm font-bold text-slate-500">You're all caught up!</p>
                    <p className="text-[10px] text-slate-400 mt-1">No new alerts or milestones.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotifClick(notif)}
                        className={`p-4 flex gap-4 transition-colors cursor-pointer ${notif.isRead ? 'opacity-60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800' : 'bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-50/60 dark:hover:bg-blue-900/20'}`}
                      >
                        {getNotifIcon(notif.type, notif.title)}
                        <div className="flex-1">
                          <h4 className={`text-sm mb-0.5 ${notif.isRead ? 'font-bold text-slate-700 dark:text-slate-300' : 'font-black text-slate-900 dark:text-white'}`}>
                            {notif.title}
                          </h4>
                          <p className="text-xs text-slate-500 leading-snug line-clamp-2">
                            {notif.message}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                              {timeAgo(notif.timestamp)}
                            </span>
                            {notif.link && (
                              <span className="text-[10px] font-black text-blue-500 group-hover:underline">
                                View details →
                              </span>
                            )}
                          </div>
                        </div>
                        {!notif.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* View AI Insights Footer */}
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => {
                    setIsNotifOpen(false);
                    navigate('/dashboard/suggestions');
                  }}
                  className="w-full py-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-2"
                >
                  <HiOutlineSparkles size={16} /> Open J.A.R.V.I.S Dashboard
                </button>
              </div>
            </div>
          </div>

          {/* 🚀 PROFILE (Visible on Desktop Only) */}
          <div className="hidden md:block relative" ref={profileRef}>
            <button
              onClick={() => {
                 setIsProfileOpen((p) => !p);
                 setIsNotifOpen(false);
                 setIsSearchOpen(false);
              }}
              className="active:scale-95 transition-transform relative focus:outline-none"
            >
              <Avatar
                src={avatar}
                name={displayName}
                size={40}
                badge={
                  dbData?.security?.isPinSet && (
                    <div className="bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-950">
                      <HiOutlineShieldCheck size={10} />
                    </div>
                  )
                }
              />
              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-[8px] text-white font-black px-1 rounded-md border border-white dark:border-slate-950 shadow-sm">
                {baseCurrency || 'USD'}
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-[140%] w-72 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden z-50 border border-slate-100 dark:border-white/5 animate-in fade-in slide-in-from-top-2">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                  <p className="font-black text-slate-800 dark:text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest truncate">
                    {user.email}
                  </p>
                </div>

                <div className="p-2 space-y-1">
                  
                  {/* Currency Badge */}
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 mb-1">
                    <div className="flex items-center gap-3 font-black text-sm text-slate-700 dark:text-slate-300">
                      <HiOutlineGlobeAlt size={20} className="text-blue-500" />
                      Base Currency
                    </div>
                    <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-blue-500/20">
                      {baseCurrency || 'USD'}
                    </span>
                  </div>

                  {/* Calendar Badge */}
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mb-1">
                    <div className="flex items-center gap-3 font-black text-sm text-slate-700 dark:text-slate-300">
                      <HiOutlineCalendar size={20} className="text-indigo-500" />
                      Base Calendar
                    </div>
                    <span className="bg-indigo-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-indigo-500/20">
                      {calendarBadgeText}
                    </span>
                  </div>

                  {/* 🚀 NEW: ADMIN ONLY BUTTON (Checks your exact email) */}
                  {user?.email?.toLowerCase() === 'vivekpoudel222@gmail.com' && (
                    <Link
                      to="/admin/write"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
                    >
                      <HiOutlinePencilAlt size={20} />
                      Studio (Admin)
                    </Link>
                  )}

                  <Link
                    to="/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <HiOutlineCog size={20} className="text-slate-400" />
                    Profile Settings
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    <HiOutlineLogout size={20} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* GUEST */
        <div className="hidden md:flex gap-3">
          <Link to="/login" className="font-black text-sm py-3 text-slate-700 dark:text-slate-300">
            Login
          </Link>
          <Link
            to="/signup"
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            Get Started
          </Link>
        </div>
      )}
    </div>
  );
};

export default RightActions;