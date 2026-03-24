import { 
  auth, 
  googleProvider, 
  githubProvider 
} from "./firebaseConfig";
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";

import { isPermanentEmail } from "../utils/emailValidator";
// ✅ Fixed: Importing the correct name from userService
import { syncUserProfile } from "./userService";

/**
 * 1. SIGNUP WITH DATABASE SYNC
 */
export const registerUser = async (email, password, displayName) => {
  if (!isPermanentEmail(email)) {
    const scamError = new Error("Strict Action: Trusted providers only (Gmail, Outlook, Yahoo).");
    scamError.code = "auth/unauthorized-domain";
    throw scamError; 
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName });
    
    // ✅ Fixed: Using the new function name
    console.log("Saving user to Firestore...");
    await syncUserProfile(user, { displayName });
    
    await sendEmailVerification(user);
    console.log("Verification email sent.");

    await signOut(auth); 
    return userCredential;
  } catch (error) {
    console.error("Signup Process Error:", error.message);
    await signOut(auth);
    throw error;
  }
};

/**
 * 2. LOGIN WITH SECURITY FILTER
 */
export const loginUser = async (email, password) => {
  if (!isPermanentEmail(email)) {
    throw new Error("Security Alert: Restricted email provider.");
  }
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // ✅ Fixed: Calling syncUserProfile
    syncUserProfile(userCredential.user);
    
    return userCredential;
  } catch (error) {
    throw error;
  }
};

/**
 * 3. SOCIAL LOGIN (GitHub & Google)
 */
export const socialLogin = async (provider) => {
  try {
    const selectedProvider = provider === 'google' ? googleProvider : githubProvider;
    const result = await signInWithPopup(auth, selectedProvider);
    const user = result.user;

    const email = user.email || (user.providerData && user.providerData[0]?.email);

    if (!email) {
      await signOut(auth);
      throw new Error("GitHub email is private. Please make it public in settings.");
    }

    if (!isPermanentEmail(email)) {
      await signOut(auth);
      throw new Error(`Domain @${email.split('@')[1]} is not allowed.`);
    }

    // ✅ Fixed: Calling syncUserProfile
    await syncUserProfile(user);

    return result;
  } catch (error) {
    console.error(`🛡️ ${provider} Auth Error:`, error.code);
    throw error;
  }
};

/**
 * 4. LOGOUT & PASSWORD RESET
 */
export const logoutUser = () => signOut(auth);

export const resetPasswordEmail = (email) => {
  if (!isPermanentEmail(email)) {
    throw new Error("Cannot reset password for unverified domains.");
  }
  return sendPasswordResetEmail(auth, email);
};