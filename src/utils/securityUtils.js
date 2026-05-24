/**
 * ✅ ENHANCED SECURITY UTILITIES
 * - Better PIN hashing with random salt
 * - Rate limiting for security
 * - Attempt tracking
 * - Input sanitization
 */

import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ========================
// 1. RATE LIMITING & TRACKING
// ========================

const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  ATTEMPT_RESET_TIME: 60 * 60 * 1000, // 1 hour
};

/**
 * Check if user is rate limited
 * @param {string} uid - Firebase UID
 * @returns {Promise<{isLocked: boolean, remainingTime: number, attemptsLeft: number}>}
 */
export async function checkRateLimit(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return { isLocked: false, remainingTime: 0, attemptsLeft: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };

    const data = userDoc.data();
    const security = data?.security || {};
    
    const now = Date.now();
    const lastAttemptTime = security.lastAttemptTime || 0;
    const attemptCount = security.attemptCount || 0;
    const lockedUntil = security.lockedUntil || 0;

    // Check if user is currently locked out
    if (lockedUntil > now) {
      const remainingTime = Math.ceil((lockedUntil - now) / 1000); // seconds
      return {
        isLocked: true,
        remainingTime,
        attemptsLeft: 0,
        message: `Account locked. Try again in ${remainingTime}s`
      };
    }

    // Reset attempts if enough time has passed
    if (now - lastAttemptTime > RATE_LIMIT_CONFIG.ATTEMPT_RESET_TIME) {
      return { isLocked: false, remainingTime: 0, attemptsLeft: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
    }

    const attemptsLeft = Math.max(0, RATE_LIMIT_CONFIG.MAX_ATTEMPTS - attemptCount);
    
    return {
      isLocked: false,
      remainingTime: 0,
      attemptsLeft,
      message: attemptsLeft === 0 ? 'Too many failed attempts. Locking account...' : null
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { isLocked: false, remainingTime: 0, attemptsLeft: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
  }
}

/**
 * Record failed attempt and apply lockout if needed
 * @param {string} uid - Firebase UID
 */
export async function recordFailedAttempt(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const data = userDoc.exists() ? userDoc.data() : {};
    const security = data?.security || {};

    const now = Date.now();
    const lastAttemptTime = security.lastAttemptTime || 0;
    const attemptCount = security.attemptCount || 0;

    // Reset counter if time has elapsed
    let newAttemptCount = (now - lastAttemptTime) > RATE_LIMIT_CONFIG.ATTEMPT_RESET_TIME ? 1 : attemptCount + 1;

    const updates = {
      security: {
        ...security,
        lastAttemptTime: now,
        attemptCount: newAttemptCount,
        lastFailedAttempt: now
      }
    };

    // Lock account if max attempts exceeded
    if (newAttemptCount >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS) {
      updates.security.lockedUntil = now + RATE_LIMIT_CONFIG.LOCKOUT_DURATION;
      updates.security.isLocked = true;
    }

    await setDoc(doc(db, 'users', uid), updates, { merge: true });
  } catch (error) {
    console.error('Failed to record attempt:', error);
  }
}

/**
 * Clear failed attempts on successful verification
 * @param {string} uid - Firebase UID
 */
export async function clearFailedAttempts(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const data = userDoc.exists() ? userDoc.data() : {};

    await setDoc(doc(db, 'users', uid), {
      security: {
        ...data?.security,
        attemptCount: 0,
        isLocked: false,
        lockedUntil: null
      }
    }, { merge: true });
  } catch (error) {
    console.error('Failed to clear attempts:', error);
  }
}

// ========================
// 2. INPUT SANITIZATION
// ========================

/**
 * Sanitize PIN input (only digits, max 6)
 * @param {string} input - User input
 * @returns {string} - Sanitized PIN
 */
export function sanitizePIN(input) {
  return String(input || '')
    .replace(/\D/g, '') // Remove non-digits
    .slice(0, 6); // Max 6 digits
}

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - User input
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .slice(0, 500); // Max 500 chars
}

// ========================
// 3. ENHANCED PIN HASHING
// ========================

/**
 * Generate cryptographically secure random salt
 * @returns {Uint8Array} - Random 16-byte salt
 */
function generateRandomSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} array - Input array
 * @returns {string} - Hex string
 */
function arrayToHex(array) {
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hex - Hex string
 * @returns {Uint8Array} - Byte array
 */
function hexToArray(hex) {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return result;
}

/**
 * Hash PIN with random salt (v3 - ENHANCED)
 * Format: "v3:salt:hash"
 * @param {string} pin - 4-6 digit PIN
 * @param {string} uid - Firebase UID
 * @returns {Promise<string>} - "v3:saltHex:hashHex"
 */
export async function hashPINEnhanced(pin, uid) {
  try {
    // Sanitize input
    const cleanPin = sanitizePIN(pin);
    
    if (cleanPin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    // Generate random salt (16 bytes)
    const randomSalt = generateRandomSalt();
    
    // Combine UID with random salt for extra security
    const enc = new TextEncoder();
    const uidBytes = enc.encode(uid);
    const combinedSalt = new Uint8Array(randomSalt.length + uidBytes.length);
    combinedSalt.set(randomSalt);
    combinedSalt.set(uidBytes, randomSalt.length);

    // Derive key using PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(cleanPin),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: combinedSalt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const hashHex = arrayToHex(new Uint8Array(derivedBits));
    const saltHex = arrayToHex(randomSalt);

    return `v3:${saltHex}:${hashHex}`;
  } catch (error) {
    console.error('PIN hashing error:', error);
    throw new Error('Failed to hash PIN');
  }
}

/**
 * Hash PIN using PBKDF2-SHA256 (v2 - LEGACY, for backward compat)
 * @param {string} pin - numeric PIN
 * @param {string} uid - Firebase UID
 * @returns {Promise<string>} - "v2:hexHash"
 */
export async function hashPINLegacy(pin, uid) {
  try {
    const cleanPin = sanitizePIN(pin);
    const enc = new TextEncoder();
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(cleanPin),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const salt = enc.encode('finledger-pin-' + uid);
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    
    const hashHex = arrayToHex(new Uint8Array(derivedBits));
    return 'v2:' + hashHex;
  } catch (error) {
    console.error('Legacy PIN hashing error:', error);
    throw new Error('Failed to hash PIN');
  }
}

/**
 * Legacy SHA-256 hash (v1 - DEPRECATED)
 * @param {string} pin - PIN code
 * @returns {Promise<string>} - hex hash
 */
async function hashPINLegacySHA256(pin) {
  try {
    const cleanPin = sanitizePIN(pin);
    const encoder = new TextEncoder();
    const data = encoder.encode(cleanPin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return arrayToHex(new Uint8Array(hashBuffer));
  } catch (error) {
    console.error('SHA256 hashing error:', error);
    throw error;
  }
}

/**
 * Verify PIN against stored hash (supports v1, v2, v3)
 * @param {string} pin - User input PIN
 * @param {string} storedHash - Hash from Firestore
 * @param {string} uid - Firebase UID
 * @returns {Promise<{valid: boolean, newHash?: string, upgraded?: boolean}>}
 */
export async function verifyPINEnhanced(pin, storedHash, uid) {
  try {
    // Rate limiting check
    const rateLimitCheck = await checkRateLimit(uid);
    if (rateLimitCheck.isLocked) {
      return {
        valid: false,
        message: rateLimitCheck.message
      };
    }

    if (!storedHash || !pin) {
      await recordFailedAttempt(uid);
      return { valid: false };
    }

    const cleanPin = sanitizePIN(pin);
    let isValid = false;
    let upgraded = false;
    let newHash = null;

    // v3: Enhanced with random salt
    if (storedHash.startsWith('v3:')) {
      try {
        const parts = storedHash.split(':');
        if (parts.length !== 3) {
          await recordFailedAttempt(uid);
          return { valid: false };
        }

        const saltHex = parts[1];
        const storedHashHex = parts[2];
        const randomSalt = hexToArray(saltHex);

        const enc = new TextEncoder();
        const uidBytes = enc.encode(uid);
        const combinedSalt = new Uint8Array(randomSalt.length + uidBytes.length);
        combinedSalt.set(randomSalt);
        combinedSalt.set(uidBytes, randomSalt.length);

        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          enc.encode(cleanPin),
          'PBKDF2',
          false,
          ['deriveBits']
        );

        const derivedBits = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: combinedSalt,
            iterations: 100000,
            hash: 'SHA-256',
          },
          keyMaterial,
          256
        );

        const calculatedHashHex = arrayToHex(new Uint8Array(derivedBits));
        isValid = calculatedHashHex === storedHashHex;
      } catch (error) {
        console.error('v3 verification error:', error);
        await recordFailedAttempt(uid);
        return { valid: false };
      }
    }
    // v2: Legacy PBKDF2
    else if (storedHash.startsWith('v2:')) {
      try {
        const calculatedHash = await hashPINLegacy(cleanPin, uid);
        isValid = calculatedHash === storedHash;
        
        if (isValid) {
          // Auto-upgrade to v3
          newHash = await hashPINEnhanced(cleanPin, uid);
          upgraded = true;
        }
      } catch (error) {
        console.error('v2 verification error:', error);
        await recordFailedAttempt(uid);
        return { valid: false };
      }
    }
    // v1: Legacy SHA-256
    else {
      try {
        const legacyHash = await hashPINLegacySHA256(cleanPin);
        isValid = legacyHash === storedHash;
        
        if (isValid) {
          // Auto-upgrade to v3
          newHash = await hashPINEnhanced(cleanPin, uid);
          upgraded = true;
        }
      } catch (error) {
        console.error('v1 verification error:', error);
        await recordFailedAttempt(uid);
        return { valid: false };
      }
    }

    if (isValid) {
      // Clear failed attempts on success
      await clearFailedAttempts(uid);
      return { valid: true, newHash, upgraded };
    } else {
      // Record failed attempt
      await recordFailedAttempt(uid);
      return { valid: false };
    }
  } catch (error) {
    console.error('PIN verification error:', error);
    await recordFailedAttempt(uid);
    return { valid: false };
  }
}

// ========================
// 4. MIGRATION UTILITIES
// ========================

/**
 * Migrate old plain PIN to hashed (for existing users)
 * @param {string} plainPin - Old plain PIN from database
 * @param {string} uid - Firebase UID
 * @returns {Promise<string>} - New v3 hash
 */
export async function migrateOldPIN(plainPin, uid) {
  try {
    // Hash the plain PIN with new enhanced method
    return await hashPINEnhanced(plainPin, uid);
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

/**
 * Check if PIN needs upgrade/migration
 * @param {string} storedHash - Hash from Firestore
 * @returns {boolean} - true if needs upgrade
 */
export function pinNeedsUpgrade(storedHash) {
  if (!storedHash) return false;
  
  // v3 is latest, no upgrade needed
  if (storedHash.startsWith('v3:')) return false;
  
  // v2 and v1 need upgrade
  return storedHash.startsWith('v2:') || !storedHash.startsWith('v');
}

// ========================
// 5. VALIDATION UTILITIES
// ========================

/**
 * Validate PIN format and strength
 * @param {string} pin - PIN to validate
 * @returns {object} - {valid: boolean, errors: string[]}
 */
export function validatePIN(pin) {
  const errors = [];
  const cleanPin = sanitizePIN(pin);

  if (cleanPin.length < 4) {
    errors.push('PIN must be at least 4 digits');
  }
  if (cleanPin.length > 6) {
    errors.push('PIN must not exceed 6 digits');
  }
  if (/(\d)\1{3,}/.test(cleanPin)) {
    errors.push('PIN cannot have 4+ consecutive same digits (e.g., 1111)');
  }
  if (/^(0123|1234|2345|3456|4567|5678|6789|9876|8765)/.test(cleanPin)) {
    errors.push('PIN cannot be a sequential pattern');
  }

  return {
    valid: errors.length === 0,
    errors,
    cleanPin
  };
}

/**
 * Generate secure random PIN (for testing/recovery)
 * @returns {string} - 6-digit PIN
 */
export function generateSecurePIN() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(4));
  const randomNum = new DataView(randomBytes.buffer).getUint32(0);
  const pin = String(randomNum % 1000000).padStart(6, '0');
  return pin;
}
