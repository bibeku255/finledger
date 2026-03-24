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
 * User registration ya login ke waqt profile create/update karta hai.
 */
export const syncUserProfile = async (user, additionalData = {}) => {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  
  try {
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      // --- NAYA USER CREATE KAREIN ---
      const { displayName, email, photoURL } = user;
      
      const userData = {
        uid: user.uid,
        displayName: displayName || additionalData.displayName || "Finledger User",
        email: email,
        photoURL: photoURL || "",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        role: "user", // Default security role
        isVerified: user.emailVerified || false,
        accountStatus: "active",
        ...additionalData,
      };

      // setDoc ensure karta hai ki UID hi Document ID bane
      await setDoc(userRef, userData);
      console.log("✅ New Firestore profile created for:", email);
    } else {
      // --- EXISTING USER KI LAST LOGIN UPDATE KAREIN ---
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        // Agar social login se photo change hui ho toh update karein
        photoURL: user.photoURL || snapshot.data().photoURL
      });
      console.log("🔄 User lastLogin updated.");
    }
  } catch (error) {
    console.error("❌ Firestore Sync Error:", error.code, error.message);
    // Agar yahan 'permission-denied' aata hai, toh Rules check karein
    throw error; 
  }

  return userRef;
};