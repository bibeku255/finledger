// src/firebase/auth.js - HARDENED VERSION
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
import { syncUserProfile } from "./userService";

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * User-friendly error messages for auth errors
 */
const AUTH_ERROR_MESSAGES = {
  'auth/user-not-found': 'No account found with this email. Please sign up.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact support.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your internet connection.',
  'auth/operation-not-allowed': 'This authentication method is not enabled.',
  'auth/account-exists-with-different-credential': 'This email is linked with another provider.',
  'auth/popup-blocked': 'Login popup was blocked. Please allow popups.',
  'auth/popup-closed-by-user': 'Login popup was closed.',
};

/**
 * Get user-friendly error message
 */
const getErrorMessage = (error) => {
  if (error instanceof Error && error.message) {
    return error.message; // Already formatted
  }
  return AUTH_ERROR_MESSAGES[error.code] || error.message || 'Authentication failed.';
};

/**
 * Retry async function with exponential backoff
 */
const retryAsync = async (fn, maxRetries = 3, delayMs = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Only retry on transient errors
      const isTransient = [
        'auth/network-request-failed',
        'unavailable',
        'internal'
      ].includes(error.code);

      if (!isTransient) throw error;

      const delay = delayMs * Math.pow(2, i);
      console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`, error.code);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

const resetAttempts = new Map();
const resetLimitMs = 60000; // 60 seconds

/**
 * Check if user can request password reset
 */
const canRequestPasswordReset = (email) => {
  const lastAttempt = resetAttempts.get(email) || 0;
  const timeSinceLastAttempt = Date.now() - lastAttempt;
  return timeSinceLastAttempt >= resetLimitMs;
};

/**
 * Record password reset attempt
 */
const recordResetAttempt = (email) => {
  resetAttempts.set(email, Date.now());
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 1. SIGNUP WITH DATABASE SYNC
 */
export const registerUser = async (email, password, displayName) => {
  // Validate email domain
  if (!isPermanentEmail(email)) {
    const err = new Error("Email provider not allowed. Use Gmail, Outlook, Yahoo, etc.");
    err.code = "auth/unauthorized-domain";
    throw err;
  }

  let user = null;

  try {
    // Create auth account
    console.log('[AUTH] Creating account for:', email);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    user = userCredential.user;

    // Update profile
    await updateProfile(user, { displayName });

    // Sync to Firestore (with retry)
    console.log('[AUTH] Syncing profile to Firestore...');
    await retryAsync(
      () => syncUserProfile(user, { displayName }),
      3,
      1000
    );

    // Send verification email (with retry)
    console.log('[AUTH] Sending verification email...');
    await retryAsync(
      () => sendEmailVerification(user),
      2,
      500
    );

    console.log('[AUTH] Signup successful, logging out for email verification...');

    // Log out to force email verification
    await signOut(auth);

    return {
      success: true,
      email: email,
      message: 'Signup successful! Please check your email to verify your account.'
    };

  } catch (error) {
    console.error('[AUTH] Signup failed:', error.code, error.message);

    // Cleanup: Remove auth account if profile creation failed
    if (user) {
      try {
        await user.delete();
        console.log('[AUTH] Cleaned up incomplete account');
      } catch (cleanupError) {
        console.error('[AUTH] Cleanup failed:', cleanupError);
      }
    }

    throw new Error(getErrorMessage(error));
  }
};

/**
 * 2. LOGIN WITH SECURITY FILTER & PROFILE SYNC
 */
export const loginUser = async (email, password) => {
  // Validate email domain
  if (!isPermanentEmail(email)) {
    throw new Error("Email provider not allowed.");
  }

  try {
    console.log('[AUTH] Logging in:', email);
    
    // Sign in
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Sync profile (important for returning users)
    try {
      console.log('[AUTH] Syncing profile...');
      await retryAsync(
        () => syncUserProfile(userCredential.user),
        2,
        1000
      );
    } catch (syncError) {
      console.warn('[AUTH] Profile sync failed, continuing:', syncError.message);
      // Don't fail login if profile sync fails, it will be retried by AuthContext
    }

    console.log('[AUTH] Login successful');
    return userCredential;

  } catch (error) {
    console.error('[AUTH] Login failed:', error.code, error.message);
    throw new Error(getErrorMessage(error));
  }
};

/**
 * 3. SOCIAL LOGIN (GitHub & Google)
 */
export const socialLogin = async (provider) => {
  try {
    console.log('[AUTH] Starting social login:', provider);

    const selectedProvider = provider === 'google' ? googleProvider : githubProvider;
    const result = await signInWithPopup(auth, selectedProvider);
    const user = result.user;

    // Extract email
    const email = user.email || user.providerData?.[0]?.email;

    if (!email) {
      await signOut(auth);
      throw new Error(`${provider} email is private. Please make it public in your account settings.`);
    }

    // Validate email domain
    if (!isPermanentEmail(email)) {
      await signOut(auth);
      const domain = email.split('@')[1];
      throw new Error(`Email domain @${domain} is not allowed. Use Gmail, Outlook, etc.`);
    }

    // Sync profile with error recovery
    try {
      console.log('[AUTH] Syncing profile for social login...');
      await retryAsync(
        () => syncUserProfile(user),
        3,
        1000
      );
    } catch (syncError) {
      console.error('[AUTH] Profile sync failed, rolling back auth:', syncError);
      await signOut(auth);
      throw new Error(`Account setup failed. Please try again.`);
    }

    console.log('[AUTH] Social login successful:', provider);
    return result;

  } catch (error) {
    console.error(`[AUTH] ${provider} login error:`, error.code);
    throw new Error(getErrorMessage(error));
  }
};

/**
 * 4. LOGOUT
 */
export const logoutUser = async () => {
  try {
    console.log('[AUTH] Logging out...');
    await signOut(auth);
    console.log('[AUTH] Logout successful');
  } catch (error) {
    console.error('[AUTH] Logout failed:', error);
    throw new Error('Failed to sign out. Please try again.');
  }
};

/**
 * 5. PASSWORD RESET WITH RATE LIMITING
 */
export const resetPasswordEmail = async (email) => {
  // Validate email domain
  if (!isPermanentEmail(email)) {
    throw new Error("Password reset not allowed for this email provider.");
  }

  // Check rate limit
  if (!canRequestPasswordReset(email)) {
    const lastAttempt = resetAttempts.get(email) || 0;
    const secondsToWait = Math.ceil((resetLimitMs - (Date.now() - lastAttempt)) / 1000);
    throw new Error(`Please wait ${secondsToWait} seconds before requesting another reset.`);
  }

  try {
    console.log('[AUTH] Sending password reset email:', email);
    recordResetAttempt(email);
    
    await sendPasswordResetEmail(auth, email);
    
    console.log('[AUTH] Password reset email sent');
    return { success: true, email };

  } catch (error) {
    console.error('[AUTH] Password reset failed:', error.code);
    throw new Error(getErrorMessage(error));
  }
};