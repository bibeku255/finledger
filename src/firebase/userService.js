import { db } from "./firebaseConfig";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";

/**
 * USER DOCUMENT SYNC
 * Registration/Login ke waqt profile structure ensure karta hai.
 */
export const syncUserProfile = async (user, additionalData = {}) => {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  
  try {
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      // --- NAYA USER: INITIAL SHIELD STRUCTURE ---
      const { displayName, email, photoURL } = user;
      
      const userData = {
        uid: user.uid,
        displayName: displayName || additionalData.displayName || "Finledger User",
        email: email,
        photoURL: photoURL || "",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        role: "user",
        accountStatus: "active",
        
        // 🛡️ SECURITY LAYER: Initialized for Pin/2FA
        security: {
          isEmailVerified: user.emailVerified || false,
          isPinSet: false, // Dashboard check karega
          twoFactor: false,
          lastIp: "localhost" 
        },

        // 📊 FINANCIAL SKELETON: Dashboard crashes rokne ke liye
        stats: {
          balance: 0,
          totalIncome: 0,
          totalExpense: 0,
          currency: "USD"
        },

        ...additionalData,
      };

      await setDoc(userRef, userData);
      console.log("✅ New Secure Profile Created:", email);
    } else {
      // --- EXISTING USER: SESSION REFRESH ---
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        // Email verification status sync
        "security.isEmailVerified": user.emailVerified || false,
        photoURL: user.photoURL || snapshot.data().photoURL
      });
      console.log("🔄 User session refreshed.");
    }
  } catch (error) {
    console.error("❌ Firestore Sync Error:", error.code, error.message);
    throw error; 
  }

  return userRef;
};

// --- Profile Fetch Helper ---
export const fetchUserProfile = async (uid) => {
  const docRef = doc(db, "users", uid);
  const res = await getDoc(docRef);
  return res.exists() ? res.data() : null;
};