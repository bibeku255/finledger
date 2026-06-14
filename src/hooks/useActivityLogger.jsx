import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from './useAuth';
import { useAIVoice } from './useAIVoice';
import { useToast } from './useToastNotification';

export const useActivityLogger = () => {
  const { user } = useAuth();
  const { speak, initVoice } = useAIVoice();
  const { addToast } = useToast();

  const logTransaction = async ({ title, amount, type, vault, currencySymbol = '₹', silent = false }) => {
    if (!user) return;
    initVoice(); // Auto-unlock audio engine

    let voiceMessage = "";
    let toastType = "info";
    let alertType = "INFO";

    // 🧠 AI Message Formatting
    if (type === 'income') {
      voiceMessage = `Credited ${currencySymbol}${amount} to ${vault}.`;
      toastType = 'success';
      alertType = 'income';
    } else if (type === 'expense') {
      voiceMessage = `Debited ${currencySymbol}${amount} from ${vault} for ${title}.`;
      toastType = 'error';
      alertType = 'expense';
    } else if (type === 'swap' || type === 'crypto') {
      voiceMessage = `Crypto action recorded: ${title}.`;
      toastType = 'success';
      alertType = 'system_alert';
    }

    addToast(voiceMessage, toastType);

    if (!silent) speak(voiceMessage);

    // 💾 Save to Notification Bell
    try {
      await addDoc(collection(db, "users", user.uid, "notifications"), {
        uniqueId: `LOG_${new Date().getTime()}`,
        title: title,
        message: voiceMessage,
        amount: amount,
        type: alertType,
        isRead: false,
        timestamp: new Date().getTime(),
        link: type === 'expense' ? '/dashboard/expense' : '/dashboard/income'
      });
    } catch (error) {
      console.error("JARVIS: Failed to log activity", error);
    }
  };

  return { logTransaction };
};
