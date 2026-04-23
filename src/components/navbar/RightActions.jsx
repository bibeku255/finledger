import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

import { 
  HiOutlineBell, HiOutlineLogout, HiOutlineCog, HiOutlineShieldCheck,
  HiOutlineGlobeAlt, HiCheck, HiOutlineSpeakerphone, HiOutlineSparkles,
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineCreditCard,
  HiOutlineLibrary, HiOutlineExclamationCircle, HiOutlineCalendar,
  HiOutlinePencilAlt, HiOutlineBadgeCheck
} from 'react-icons/hi';
import { 
  FaTrophy, FaRegBellSlash, FaGem, FaCrown 
} from 'react-icons/fa';

import Avatar from '../ui/Avatar'; 

import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

const RightActions = () => {
  const { user, avatar, displayName, dbData, logout, baseCurrency } = useAuth();
  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const currentCalendar = dbData?.settings?.baseCalendar || 'gregorian';
  const calendarLabels = { gregorian: 'AD', bikram_sambat: 'BS', hijri: 'Hijri', jalali: 'Jalali' };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "notifications"), orderBy("timestamp", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    });
    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id, isRead) => {
    if (isRead || !user) return;
    try { await updateDoc(doc(db, "users", user.uid, "notifications", id), { isRead: true }); } catch (error) { console.error(error); }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.isRead).forEach(n => {
        batch.update(doc(db, "users", user.uid, "notifications", n.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) { console.error(error); }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.isRead) await markAsRead(notif.id, notif.isRead);
    if (notif.link) { setIsNotifOpen(false); navigate(notif.link); }
  };

  const getNotifIcon = (type, title = '') => {
    switch (type) {
      case 'market_alert': return title.includes('Pump') 
        ? <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><HiOutlineTrendingUp size={18}/></div>
        : <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"><HiOutlineTrendingDown size={18}/></div>;
      case 'loan_alert': return <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><HiOutlineLibrary size={18}/></div>;
      case 'bill_alert': return <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0"><HiOutlineCreditCard size={18}/></div>;
      case 'system_alert': return <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"><HiOutlineExclamationCircle size={18}/></div>;
      case 'goal_milestone': return <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><FaTrophy size={16}/></div>;
      case 'ai_insight': return <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0"><HiOutlineSparkles size={18}/></div>;
      default: return <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><HiOutlineSpeakerphone size={18}/></div>;
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

  const handleLogout = async () => { try { await logout(); navigate("/"); } catch (error) { console.error(error); } };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      {/* AUTHENTICATED USER */}
      {user ? (
        <>
          {/* 🔔 NOTIFICATIONS */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => { setIsNotifOpen(p => !p); setIsProfileOpen(false); }}
              className={`relative h-10 w-10 md:h-auto md:w-auto md:p-2.5 flex items-center justify-center rounded-xl md:rounded-2xl transition-all border shadow-sm ${
                isNotifOpen 
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <HiOutlineBell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 md:top-1.5 md:right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white dark:border-slate-950" />
                </span>
              )}
            </button>

            {/* Notif Dropdown */}
            <div className={`absolute right-[-40px] md:right-0 top-[130%] w-[320px] md:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-700/50 rounded-[1.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] transition-all duration-300 origin-top-right z-[500] overflow-hidden ${
              isNotifOpen ? 'scale-100 opacity-100 visible translate-y-0' : 'scale-95 opacity-0 invisible translate-y-2'
            }`}>
              <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800/50 bg-gradient-to-r from-slate-50 to-transparent dark:from-white/[0.02] dark:to-transparent">
                <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  Notifications
                  {unreadCount > 0 && <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-sm">{unreadCount}</span>}
                </h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1">
                    <HiCheck size={14}/> Read all
                  </button>
                )}
              </div>
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center">
                    <FaRegBellSlash className="text-3xl text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-black text-slate-500 dark:text-slate-400">All caught up!</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 font-bold">No new alerts</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {notifications.map(notif => (
                      <div key={notif.id} onClick={() => handleNotifClick(notif)}
                        className={`p-4 flex gap-3 transition-colors cursor-pointer ${
                          notif.isRead 
                            ? 'opacity-70 hover:bg-white dark:hover:bg-slate-800' 
                            : 'bg-blue-50/50 dark:bg-blue-500/10 hover:bg-blue-100/50 dark:hover:bg-blue-500/20'
                        }`}>
                        {getNotifIcon(notif.type, notif.title)}
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-[12px] mb-0.5 truncate ${notif.isRead ? 'font-bold text-slate-600 dark:text-slate-300' : 'font-black text-slate-900 dark:text-white'}`}>{notif.title}</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">{notif.message}</p>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-2 block">{timeAgo(notif.timestamp)}</span>
                        </div>
                        {!notif.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900">
                <button onClick={() => { setIsNotifOpen(false); navigate('/dashboard/suggestions'); }}
                  className="w-full py-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:shadow-sm flex items-center justify-center gap-2">
                  <HiOutlineSparkles size={14} /> View AI Insights
                </button>
              </div>
            </div>
          </div>

          {/* 👤 PROFILE - Desktop */}
          <div className="hidden md:block relative" ref={profileRef}>
            <button onClick={() => { setIsProfileOpen(p => !p); setIsNotifOpen(false); }}
              className={`group relative flex items-center justify-center transition-all ${
                isProfileOpen ? 'scale-95' : 'hover:scale-105 active:scale-95'
              }`}>
              <div className={`ring-2 rounded-full p-0.5 transition-all shadow-sm ${
                isProfileOpen 
                  ? 'ring-blue-500 bg-blue-50 dark:bg-blue-500/20' 
                  : 'ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 group-hover:ring-blue-400 dark:group-hover:ring-blue-500'
              }`}>
                <Avatar src={avatar} name={displayName} size={38} />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-blue-500 to-cyan-500 text-[8px] text-white font-black px-1.5 py-0.5 rounded-md shadow-md border-2 border-white dark:border-slate-950">
                {baseCurrency || 'USD'}
              </div>
            </button>

            {/* Profile Dropdown */}
            <div className={`absolute right-0 top-[130%] w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[1.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden z-[500] border border-slate-200 dark:border-slate-700 transition-all duration-300 origin-top-right ${
              isProfileOpen ? 'scale-100 opacity-100 visible translate-y-0' : 'scale-95 opacity-0 invisible translate-y-2'
            }`}>
              
              {/* Profile Header */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-transparent dark:from-white/[0.02] dark:to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <FaGem size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-[13px] text-slate-800 dark:text-white truncate">{displayName}</p>
                    <p className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest truncate flex items-center gap-1 mt-0.5">
                      <HiOutlineBadgeCheck size={12} /> Verified
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-1.5">
                {/* Currency Option */}
                <button onClick={() => { setIsProfileOpen(false); navigate('/dashboard/settings/currency'); }}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                  <span className="flex items-center gap-3 font-bold text-[12px] text-slate-600 dark:text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform border border-blue-100 dark:border-blue-500/20">
                      <HiOutlineGlobeAlt size={16} />
                    </div>
                    Currency
                  </span>
                  <span className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-[9px] font-black px-2.5 py-1 rounded-lg shadow-sm">
                    {baseCurrency || 'USD'}
                  </span>
                </button>

                {/* Calendar Option */}
                <button onClick={() => { setIsProfileOpen(false); navigate('/profile'); }}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                  <span className="flex items-center gap-3 font-bold text-[12px] text-slate-600 dark:text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform border border-indigo-100 dark:border-indigo-500/20">
                      <HiOutlineCalendar size={16} />
                    </div>
                    Calendar
                  </span>
                  <span className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-black px-2.5 py-1 rounded-lg shadow-sm">
                    {calendarLabels[currentCalendar] || 'AD'}
                  </span>
                </button>

                {/* Admin Area */}
                {user?.email?.toLowerCase() === 'vivekpoudel222@gmail.com' && (
                  <Link to="/admin/write" onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3.5 mt-1 rounded-xl font-black text-[11px] bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 shadow-lg active:scale-95 transition-all group uppercase tracking-widest">
                    <div className="w-8 h-8 rounded-lg bg-white/20 dark:bg-black/10 flex items-center justify-center">
                      <HiOutlinePencilAlt size={16} /> 
                    </div>
                    Studio Admin 
                    <FaCrown size={12} className="text-amber-400 ml-auto group-hover:scale-125 transition-transform" />
                  </Link>
                )}

                <div className="h-px bg-slate-100 dark:bg-slate-800/50 my-2 mx-2" />

                {/* Actions */}
                <div className="flex gap-2">
                  <Link to="/profile" onClick={() => setIsProfileOpen(false)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95">
                    <HiOutlineCog size={16} /> Config
                  </Link>
                  <button onClick={handleLogout}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-rose-500 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all border border-rose-200/50 dark:border-rose-500/30 shadow-sm active:scale-95">
                    <HiOutlineLogout size={16} /> Exit
                  </button>
                </div>

              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="font-black text-[12px] px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-transparent hover:border-blue-200 dark:hover:border-blue-500/20">
            Sign In
          </Link>
          <Link to="/signup" className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-2.5 rounded-xl font-black text-[12px] shadow-lg shadow-blue-500/30 active:scale-95 transition-all hover:from-blue-700 hover:to-cyan-700 flex items-center gap-2">
            Join Ecosystem
          </Link>
        </div>
      )}
    </div>
  );
};

export default RightActions;