// src/utils/cryptoUtils.js

/**
 * Hash PIN using PBKDF2-SHA256 (100k iterations) with UID as salt
 * @param {string} pin - numeric PIN
 * @param {string} uid - Firebase UID
 * @returns {Promise<string>} - "v2:hexHash"
 */
export async function hashPIN(pin, uid) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
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
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return 'v2:' + hashHex;
}

/**
 * Legacy SHA-256 hash (for backward compatibility)
 * @param {string} pinCode
 * @returns {Promise<string>}
 */
async function hashPIN_Legacy(pinCode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify PIN against stored hash (auto-detects version)
 * @param {string} pin - input PIN
 * @param {string} storedHash - from Firestore
 * @param {string} uid - Firebase UID
 * @returns {Promise<{valid: boolean, newHash?: string}>}
 */
export async function verifyPIN(pin, storedHash, uid) {
  if (!storedHash || !pin) return { valid: false };

  if (storedHash.startsWith('v2:')) {
    // PBKDF2
    const newHash = await hashPIN(pin, uid);
    return { valid: newHash === storedHash };
  } else {
    // Legacy SHA-256
    const legacyHash = await hashPIN_Legacy(pin);
    const valid = legacyHash === storedHash;
    if (valid) {
      // Auto-upgrade to PBKDF2
      const upgradedHash = await hashPIN(pin, uid);
      return { valid: true, newHash: upgradedHash };
    }
    return { valid: false };
  }
}