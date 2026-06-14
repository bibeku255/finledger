import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from './useAuth';

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    // 🚀 SINGLE SOURCE OF TRUTH: App ke saare alerts yahan se fetch honge
    const q = query(
      collection(db, "users", user.uid, "notifications"), 
      orderBy("timestamp", "desc"), 
      limit(50) // Keep last 50 alerts in memory
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        
        // 🧠 Auto-format icon and label for UI components
        let iconType = 'bulb';
        let typeLabel = 'INFO';

        if (data.type === 'goal_milestone') { iconType = 'trendUp'; typeLabel = 'SUGGESTION'; }
        else if (data.type === 'market_alert') {
          iconType = data.title?.toLowerCase().includes('dump') || data.title?.toLowerCase().includes('crashing') ? 'trendDown' : 'trendUp';
          typeLabel = 'MARKET ALERT';
        } 
        else if (data.type === 'income') { iconType = 'income'; typeLabel = 'INCOME'; }
        else if (data.type === 'expense') { iconType = 'expense'; typeLabel = 'EXPENSE'; }
        else if (data.type?.includes('alert') || data.type?.includes('warning')) { iconType = 'shield'; typeLabel = 'ALERT'; }
        else if (data.type?.includes('system') || data.type === 'ai_insight') { iconType = 'chip'; typeLabel = 'SYSTEM ALERT'; }

        return {
          id: docSnap.id,
          uniqueId: data.uniqueId,
          isFirebase: true,
          type: typeLabel,
          title: data.title || 'Notification',
          message: data.message || '',
          iconType,
          actionText: data.type === 'market_alert' ? 'View Market' : 
                      data.type === 'goal_milestone' ? 'View Goals' : 'Review Detail',
          actionLink: data.link || '/dashboard',
          rawTimestamp: data.timestamp,
          isRead: data.isRead
        };
      });

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    });

    return () => unsubscribe();
  }, [user]);

  // ✅ Global Function to Mark a single alert as read
  const markAsRead = async (id) => {
    if (!user) return;
    try { 
      await updateDoc(doc(db, "users", user.uid, "notifications", id), { isRead: true }); 
    } catch (error) {
      console.error("JARVIS: Failed to mark as read", error);
    }
  };

  // ✅ Global Function to Clear the Bell counter
  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.isRead).forEach(n => {
        batch.update(doc(db, "users", user.uid, "notifications", n.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("JARVIS: Failed to mark all as read", error);
    }
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
};