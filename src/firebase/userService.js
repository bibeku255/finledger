// src/firebase/userService.js - ENHANCED VERSION

import { db } from './firebaseConfig';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

// ✅ Only these fields can come from the caller
const ALLOWED_EXTRA_FIELDS = [
  'displayName',
  'phoneNumber',
  'currency',
  'language',
  'calendarType',
  'timezone',
  'onboardingDone',
];

// ✅ Wallet types
const WALLET_TYPES = ['bank', 'cash', 'online'];

// ✅ Validated lists
const SUPPORTED_CURRENCIES = ['USD', 'INR', 'NPR', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'hi', 'ne', 'ar'];
const CALENDAR_TYPES = ['gregorian', 'bikram_sambat', 'hijri', 'jalali'];

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate and normalize currency
 */
function validateCurrency(currency) {
  if (!currency || typeof currency !== 'string') return 'USD';
  const upper = currency.toUpperCase();
  return SUPPORTED_CURRENCIES.includes(upper) ? upper : 'USD';
}

/**
 * Validate and normalize language
 */
function validateLanguage(language) {
  if (!language || typeof language !== 'string') return 'en';
  const lower = language.toLowerCase();
  return SUPPORTED_LANGUAGES.includes(lower) ? lower : 'en';
}

/**
 * Validate and normalize calendar type
 */
function validateCalendarType(calendarType) {
  if (!calendarType || typeof calendarType !== 'string') return 'gregorian';
  const lower = calendarType.toLowerCase();
  return CALENDAR_TYPES.includes(lower) ? lower : 'gregorian';
}

/**
 * Validate and normalize timezone
 */
function validateTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  
  try {
    const supportedTimezones = Intl.supportedValuesOf('timeZone');
    if (supportedTimezones.includes(timezone)) {
      return timezone;
    }
  } catch (e) {
    console.warn('[userService] Error validating timezone:', e);
  }
  
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ═══════════════════════════════════════════════════════════════════════════
// syncUserProfile
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Called on every sign-in from AuthContext.
 * Creates full profile for new users; refreshes session for returning users.
 *
 * @param {import('firebase/auth').User} user
 * @param {Object} additionalData – only whitelisted fields are applied
 * @returns {Promise<{ isNewUser: boolean, profile: Object }>}
 */
export const syncUserProfile = async (user, additionalData = {}) => {
  if (!user?.uid) {
    throw new Error('[userService] Valid Firebase user required');
  }

  // ✅ Security: Strip non-whitelisted fields
  const safeExtra = Object.fromEntries(
    Object.entries(additionalData).filter(([k]) => ALLOWED_EXTRA_FIELDS.includes(k))
  );

  const userRef = doc(db, 'users', user.uid);

  try {
    const snapshot = await getDoc(userRef);

    // ── NEW USER ────────────────────────────────────────────────────────────
    if (!snapshot.exists()) {
      console.log('[userService] Creating new user profile:', user.uid);

      const displayName =
        safeExtra.displayName ||
        user.displayName ||
        user.email?.split('@')[0] ||
        'Finledger User';

      const newProfile = {
        uid: user.uid,
        email: user.email ?? '',
        photoURL: user.photoURL ?? '',
        displayName,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),

        // ── Preferences (caller-supplied, validated) ─────────────────────
        currency: validateCurrency(safeExtra.currency),
        language: validateLanguage(safeExtra.language),
        calendarType: validateCalendarType(safeExtra.calendarType),
        timezone: validateTimezone(safeExtra.timezone),
        onboardingDone: safeExtra.onboardingDone ?? false,

        // ── Security (never from caller) ───────────────────────────────────
        role: 'user',
        accountStatus: 'active',

        security: {
          isEmailVerified: user.emailVerified ?? false,
          isPinSet: false,
          twoFactor: false,
          lastLoginAt: serverTimestamp(),
        },
      };

      // ✅ Atomic batch: profile + wallet summaries together
      const batch = writeBatch(db);
      batch.set(userRef, newProfile);

      WALLET_TYPES.forEach(walletType => {
        batch.set(
          doc(db, 'users', user.uid, 'walletSummary', walletType),
          {
            totalBalance: 0,
            totalIncome: 0,
            totalExpense: 0,
            txnCount: 0,
            lastUpdated: serverTimestamp(),
          }
        );
      });

      await batch.commit();
      console.log('[userService] New user profile created:', user.uid);

      return { isNewUser: true, profile: newProfile };
    }

    // ── EXISTING USER ──────────────────────────────────────────────────────
    console.log('[userService] Syncing existing user:', user.uid);
    const existing = snapshot.data();

    // ✅ Explicit photo URL handling (Bug 4)
    const photoURL =
      user.photoURL !== undefined && user.photoURL !== null
        ? user.photoURL
        : existing.photoURL ?? '';

    const sessionUpdate = {
      lastLogin: serverTimestamp(),
      photoURL,
      'security.isEmailVerified': user.emailVerified ?? existing.security?.isEmailVerified ?? false,
      'security.lastLoginAt': serverTimestamp(),
    };

    // Merge in safe caller-supplied preference updates
    ALLOWED_EXTRA_FIELDS.forEach(key => {
      if (safeExtra[key] !== undefined) {
        // Validate before adding
        if (key === 'currency') {
          sessionUpdate[key] = validateCurrency(safeExtra[key]);
        } else if (key === 'language') {
          sessionUpdate[key] = validateLanguage(safeExtra[key]);
        } else if (key === 'calendarType') {
          sessionUpdate[key] = validateCalendarType(safeExtra[key]);
        } else if (key === 'timezone') {
          sessionUpdate[key] = validateTimezone(safeExtra[key]);
        } else {
          sessionUpdate[key] = safeExtra[key];
        }
      }
    });

    await updateDoc(userRef, sessionUpdate);

    return { isNewUser: false, profile: { ...existing, ...sessionUpdate } };

  } catch (error) {
    console.error('[userService] syncUserProfile error:', error);
    const err = new Error(`[userService] syncUserProfile: ${error.message}`);
    err.code = error.code;
    err.original = error;
    throw err;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// fetchUserProfile
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch user profile from Firestore
 * ✅ Bug 5 Fix — null/undefined uid guard added
 */
export const fetchUserProfile = async (uid) => {
  if (!uid) {
    console.warn('[userService] fetchUserProfile called with null/undefined uid');
    return null;
  }

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('[userService] fetchUserProfile error:', error.code, error.message);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// updateUserProfile
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update profile preferences (whitelisted only).
 * Role, accountStatus, security fields — never updated from here.
 */
export const updateUserProfile = async (uid, updates = {}) => {
  if (!uid) {
    throw new Error('[userService] uid required');
  }

  const allowed = [...ALLOWED_EXTRA_FIELDS, 'photoURL', 'displayName'];
  const safe = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(safe).length) {
    console.warn('[userService] updateUserProfile: No valid fields to update for uid:', uid);
    return { skipped: true, reason: 'No valid fields' };
  }

  // Validate before updating
  const validated = {};
  Object.keys(safe).forEach(key => {
    if (key === 'currency') {
      validated[key] = validateCurrency(safe[key]);
    } else if (key === 'language') {
      validated[key] = validateLanguage(safe[key]);
    } else if (key === 'calendarType') {
      validated[key] = validateCalendarType(safe[key]);
    } else if (key === 'timezone') {
      validated[key] = validateTimezone(safe[key]);
    } else {
      validated[key] = safe[key];
    }
  });

  await updateDoc(doc(db, 'users', uid), {
    ...validated,
    updatedAt: serverTimestamp(),
  });

  return { success: true };
};

// ═══════════════════════════════════════════════════════════════════════════
// USAGE EXAMPLES
// ═══════════════════════════════════════════════════════════════════════════
//
// AuthContext.jsx:
//   const { isNewUser } = await syncUserProfile(firebaseUser, {
//     displayName: 'Bibek',
//     currency: 'NPR',
//     calendarType: 'bikram_sambat',
//   });
//   if (isNewUser) navigate('/onboarding');
//
// Dashboard.jsx: (use walletSummary, NOT user stats)
//   const { summary: bankSummary } = useWalletSummary(uid, 'bank');
//   <Badge value={bankSummary.totalBalance} />   ✅
//   <Badge value={userProfile.stats?.balance} /> ❌ (removed — stale data