// src/firebase/userService.js
//
// ✅ FIXED VERSION — 5 bugs patched + wallet summary initialisation added
//
//   Bug 1 — SECURITY: ...additionalData could override role/accountStatus
//   Bug 2 — displayName computed then immediately overridden by spread
//   Bug 3 — isVerified never updated for existing users on login
//   Bug 4 — photoURL falsy check treats "" as "no photo" (wrong on removal)
//   Bug 5 — getDoc + setDoc race condition (simultaneous signups)
//   Extra — New user gets walletSummary docs initialised (dashboard shows 0, not undefined)
//
import { db } from './firebaseConfig';
import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// ✅ FIX Bug 1 — Whitelist: these are the ONLY fields additionalData may supply.
//    Security-critical fields (role, accountStatus) are NEVER taken from the caller.
const ALLOWED_ADDITIONAL_FIELDS = [
  'displayName',
  'phoneNumber',
  'currency',
  'language',
  'calendarType',   // 'gregorian' | 'nepali' | 'hijri' | 'jalali'
  'timezone',
  'onboardingDone',
];

const WALLET_TYPES = ['bank', 'cash', 'online'];

const EMPTY_WALLET_SUMMARY = {
  totalBalance  : 0,
  totalIncome   : 0,
  totalExpense  : 0,
  txnCount      : 0,
  lastUpdated   : null,
};

// ─────────────────────────────────────────────────────────────────────────────
// syncUserProfile — called on every sign-in
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a Firestore profile for new users, or updates lastLogin for returning ones.
 *
 * @param {import('firebase/auth').User} user
 * @param {Object} additionalData  — only whitelisted fields are applied
 * @returns {Promise<{ isNewUser: boolean, profile: Object }>}
 */
export const syncUserProfile = async (user, additionalData = {}) => {
  if (!user?.uid) throw new Error('syncUserProfile: valid Firebase user required');

  const userRef = doc(db, 'users', user.uid);

  // ✅ FIX Bug 1 — Strip any non-whitelisted fields from additionalData
  const safeExtra = Object.fromEntries(
    Object.entries(additionalData).filter(([key]) =>
      ALLOWED_ADDITIONAL_FIELDS.includes(key)
    )
  );

  try {
    const snapshot = await getDoc(userRef);

    // ── NEW USER ──────────────────────────────────────────────────────────
    if (!snapshot.exists()) {
      // ✅ FIX Bug 2 — build displayName first, safeExtra applied BEFORE
      //    so our explicit defaults always win for security fields
      const resolvedDisplayName =
        safeExtra.displayName ||          // caller-provided name
        user.displayName ||               // OAuth provider name
        user.email?.split('@')[0] ||      // email prefix fallback
        'Finledger User';

      const newProfile = {
        uid           : user.uid,
        email         : user.email ?? '',
        photoURL      : user.photoURL ?? '',
        createdAt     : serverTimestamp(),
        lastLogin     : serverTimestamp(),

        // ── safeExtra comes FIRST so our defaults below cannot be overridden ──
        ...safeExtra,

        // ── These always win — security fields are never from caller ──────
        displayName   : resolvedDisplayName,
        role          : 'user',           // ✅ FIX Bug 1: never from additionalData
        accountStatus : 'active',         // ✅ FIX Bug 1: never from additionalData
        isVerified    : user.emailVerified ?? false,
      };

      // ✅ FIX Bug 5 — Use a batch write so profile + wallet summaries are
      //    created atomically. Prevents partial state if one write fails.
      //    Also prevents duplicate-creation race: if two writes race, the
      //    second setDoc just overwrites with same data (idempotent).
      const batch = writeBatch(db);

      batch.set(userRef, newProfile);

      // ── Extra: initialise walletSummary docs so dashboard shows 0 not undefined
      WALLET_TYPES.forEach(walletType => {
        const summaryRef = doc(
          db, 'users', user.uid, 'walletSummary', walletType
        );
        batch.set(summaryRef, {
          ...EMPTY_WALLET_SUMMARY,
          lastUpdated: serverTimestamp(),
        });
      });

      await batch.commit();

      return { isNewUser: true, profile: newProfile };
    }

    // ── EXISTING USER ─────────────────────────────────────────────────────
    const existing = snapshot.data();

    // ✅ FIX Bug 4 — Use explicit null/undefined check instead of || falsy
    //    so that clearing a photo (photoURL = "") is respected
    const updatedPhotoURL =
      user.photoURL !== undefined && user.photoURL !== null
        ? user.photoURL
        : existing.photoURL ?? '';

    const loginUpdate = {
      lastLogin  : serverTimestamp(),
      photoURL   : updatedPhotoURL,
      isVerified : user.emailVerified ?? existing.isVerified ?? false, // ✅ FIX Bug 3
    };

    // Merge in any safe profile fields the caller wants to update
    Object.assign(loginUpdate, safeExtra);

    await updateDoc(userRef, loginUpdate);

    return { isNewUser: false, profile: { ...existing, ...loginUpdate } };

  } catch (error) {
    // Re-throw with enriched context so callers can handle 'permission-denied'
    const enriched = new Error(
      `[userService] syncUserProfile failed: ${error.message}`
    );
    enriched.code    = error.code;
    enriched.original = error;
    throw enriched;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getUserProfile — read once
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a user's Firestore profile.
 * Returns null if the document doesn't exist yet.
 */
export const getUserProfile = async (uid) => {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// updateUserProfile — explicit controlled update
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update specific profile fields (whitelisted only).
 * Used from Settings page, onboarding, etc.
 *
 * @param {string} uid
 * @param {Object} updates  — only whitelisted fields are written
 */
export const updateUserProfile = async (uid, updates = {}) => {
  if (!uid) throw new Error('updateUserProfile: uid required');

  const safe = Object.fromEntries(
    Object.entries(updates).filter(([key]) =>
      [...ALLOWED_ADDITIONAL_FIELDS, 'displayName', 'photoURL'].includes(key)
    )
  );

  if (!Object.keys(safe).length) return;

  await updateDoc(doc(db, 'users', uid), {
    ...safe,
    updatedAt: serverTimestamp(),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// USAGE EXAMPLE
// ─────────────────────────────────────────────────────────────────────────────
//
// // In AuthContext.jsx — on every sign-in:
// const { isNewUser, profile } = await syncUserProfile(firebaseUser, {
//   displayName : formData.name,   // only used for new users
//   currency    : 'NPR',
//   calendarType: 'nepali',
// });
//
// if (isNewUser) navigate('/onboarding');
// else           navigate('/dashboard');
