import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIVoice } from '../../hooks/useAIVoice';
import { useAIBrain } from '../../hooks/useAIBrain'; 
import { useAuth } from '../../hooks/useAuth'; 
import { collection, query, where, onSnapshot } from 'firebase/firestore'; 
import { db } from '../../firebase/firebaseConfig';

import { 
  HiOutlineVolumeUp, HiOutlineVolumeOff, 
  HiOutlinePlay, HiOutlineStop, HiOutlineRefresh,
  HiOutlineShieldCheck, HiOutlineTrendingDown, HiOutlineTrendingUp, HiOutlineLightBulb 
} from 'react-icons/hi';
import { FaRobot, FaBellSlash } from 'react-icons/fa';

// 🚀 Upgraded Icon Renderer
const getAlertIcon = (type) => {
  switch(type) {
    case 'shield': return <HiOutlineShieldCheck className="text-indigo-500" size={24} />;
    case 'bulb': return <HiOutlineLightBulb className="text-blue-500" size={24} />;
    case 'trendDown': return <HiOutlineTrendingDown className="text-rose-500" size={24} />;
    case 'trendUp': return <HiOutlineTrendingUp className="text-emerald-500" size={24} />; 
    default: return <HiOutlineLightBulb className="text-slate-500" size={24} />;
  }
};

const SmartSuggestions = () => {
  const navigate = useNavigate(); 
  const { user } = useAuth();
  const { speak, stop, isSpeaking, isMuted, toggleMute } = useAIVoice();
  const { alerts: liveAlerts, isBrainLoading } = useAIBrain(); 
  const [activeId, setActiveId] = useState(null);

  const [firebaseAlerts, setFirebaseAlerts] = useState([]);

  // Fetch Unread Firebase Notifications (Like Market Pumps/Dumps)
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("isRead", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type === 'market_alert' ? 'MARKET ALERT' : 'SYSTEM ALERT',
          title: data.title || 'Notification',
          message: data.message || '',
          iconType: data.title?.includes('Pump') ? 'trendUp' : data.title?.includes('Dump') ? 'trendDown' : 'bulb',
          actionText: 'View Details',
          actionLink: data.link || '/dashboard'
        };
      });
      setFirebaseAlerts(notifs);
    });

    return () => unsubscribe();
  }, [user]);

  // 🚀 MASTER MERGE: Combine Live Brain Alerts with Firebase Inbox Alerts Safely
  const combinedAlerts = [...liveAlerts];
  firebaseAlerts.forEach(fbAlert => {
    const exists = liveAlerts.some(live => live.title === fbAlert.title);
    if (!exists) {
      combinedAlerts.push(fbAlert);
    }
  });

  useEffect(() => {
    if (!isSpeaking) {
      setActiveId(null);
    }
  }, [isSpeaking]);

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlay = (id, text) => {
    if (isSpeaking && activeId === id) {
      stop(); 
      setActiveId(null);
    } else {
      setActiveId(id); 
      speak(text);
    }
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-4xl mx-auto px-4 md:px-0">
      
      {/* HEADER */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border transition-colors duration-500 ${isSpeaking ? 'border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.15)]' : 'border-slate-800'}`}>
        <div className={`absolute right-[-5%] top-[-20%] opacity-10 transition-transform duration-1000 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
          <FaRobot size={200}/>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              Finledger J.A.R.V.I.S
            </h1>
            {isSpeaking && (
              <span className="flex gap-2 items-center bg-blue-500/20 border border-blue-500/50 text-blue-400 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <div className="flex gap-0.5 items-center">
                  <div className="w-1 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-1 h-2.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-1 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                Speaking
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-400 max-w-lg leading-relaxed">
            Your personalized AI financial assistant. I monitor your vaults, sub-wallets, and expenses to give you actionable insights.
          </p>
        </div>

        <button onClick={toggleMute} className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all ${isMuted ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95'}`}>
          {isMuted ? <HiOutlineVolumeOff size={20}/> : <HiOutlineVolumeUp size={20}/>} 
          {isMuted ? 'Voice Muted' : 'Voice Enabled'}
        </button>
      </div>

      {/* SUGGESTIONS LIST */}
      <div className="space-y-4">
        {isBrainLoading ? (
          <div className="p-10 flex flex-col justify-center items-center text-slate-500 font-bold animate-pulse bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm min-h-[250px]">
             <HiOutlineRefresh className="animate-spin text-4xl mb-4 text-blue-500" /> 
             <p>J.A.R.V.I.S is analyzing your vaults...</p>
          </div>
        ) : (!combinedAlerts || combinedAlerts.length === 0) ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center min-h-[300px] justify-center">
            <FaBellSlash className="text-6xl text-slate-300 dark:text-slate-700 mb-6 drop-shadow-md" />
            <h3 className="text-2xl font-black text-slate-700 dark:text-white mb-2">All Clear!</h3>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No new alerts or suggestions. Your portfolio is perfectly balanced.</p>
          </div>
        ) : (
          combinedAlerts.map((item) => {
            const isActive = activeId === item.id && isSpeaking;
            return (
            <div key={item.id} className={`p-6 rounded-[2rem] border transition-all duration-300 ${isActive ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-400 shadow-lg shadow-blue-500/10 scale-[1.01]' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'}`}>
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${isActive ? 'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-700 shadow-inner' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                  {getAlertIcon(item.iconType)}
                </div>

                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{item.type}</p>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 leading-tight">{item.title}</h3>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">{item.message}</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                  <button 
                    onClick={() => handlePlay(item.id, item.message)} 
                    className={`p-4 rounded-2xl transition-all flex items-center justify-center shrink-0 ${isActive ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 hover:bg-rose-200 shadow-inner' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30'}`}
                    aria-label={isActive ? "Stop speaking" : "Read aloud"}
                  >
                    {isActive ? <HiOutlineStop size={24} className="animate-pulse" /> : <HiOutlinePlay size={24} />}
                  </button>
                  
                  <button 
                    onClick={() => navigate(item.actionLink || '/dashboard')}
                    className="flex-1 md:flex-none px-6 py-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 text-center border border-slate-800 dark:border-slate-200 shadow-lg hover:shadow-xl"
                  >
                    {item.actionText || 'Take Action'}
                  </button>
                </div>

              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SmartSuggestions;