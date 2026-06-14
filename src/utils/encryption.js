// src/utils/encryption.js

/**
 * ✅ ENHANCED ENCRYPTION FOR SECURE NOTES
 * - v1: Legacy fixed salt (backward compatible)
 * - v2: Random per‑note salt + AES‑256‑GCM
 */

// ==================== KEY DERIVATION ====================

/**
 * Derive AES-GCM key from PIN + salt
 * @param {string} pin - User's master PIN
 * @param {Uint8Array|string} salt - Salt (16 bytes recommended)
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKeyWithSalt(pin, salt) {
  const enc = new TextEncoder();
  const saltBytes = typeof salt === 'string' ? enc.encode(salt) : salt;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Legacy fixed salt key derivation (for v1 decryption only)
export async function deriveKey(pin, uid) {
  const enc = new TextEncoder();
  const salt = enc.encode('finledger-notes-' + uid);
  return deriveKeyWithSalt(pin, salt);
}

// ==================== ENCRYPTION (NEW v2) ====================

/**
 * Encrypt data with random salt (v2 format)
 * @param {string} plaintext - Note content
 * @param {string} pin - User master PIN
 * @param {string} uid - User UID (not used for v2, kept for backward compat)
 * @returns {Promise<string>} "v2:base64Salt:base64IV:base64Ciphertext"
 */
export async function encryptDataV2(plaintext, pin, uid) {
  const salt = crypto.getRandomValues(new Uint8Array(16)); // random 16 bytes
  const key = await deriveKeyWithSalt(pin, salt);
  return encryptWithKey(plaintext, key, salt);
}

async function encryptWithKey(plaintext, key, salt) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  // Combine: salt (16) + iv (12) + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return 'v2:' + btoa(String.fromCharCode(...combined));
}

// ==================== DECRYPTION (v2 + legacy v1) ====================

/**
 * Decrypt data (supports v1 and v2)
 * @param {string} data - Encrypted string
 * @param {string} pin - User master PIN
 * @param {string} uid - User UID (needed for v1 only)
 * @returns {Promise<string>} - Decrypted plaintext
 */
export async function decryptDataV2(data, pin, uid) {
  if (!data || typeof data !== 'string') return '';

  // v2: random salt
  if (data.startsWith('v2:')) {
    const raw = data.slice(3);
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));

    // extract salt (first 16 bytes), iv (next 12), ciphertext (rest)
    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const ciphertext = bytes.slice(28);

    const key = await deriveKeyWithSalt(pin, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  // v1: fixed salt (legacy)
  if (data.startsWith('v1:')) {
    const raw = data.slice(3);
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const key = await deriveKey(pin, uid);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  // plain old base64 (no version prefix) — migration
  try {
    return atob(data);
  } catch {
    return data; // fallback, probably plaintext already
  }
}

// ==================== LEGACY (keep for backward compat) ====================

export async function encryptData(plaintext, key) {
  // legacy wrapper, if needed anywhere
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return 'v1:' + btoa(String.fromCharCode(...combined));
}

export async function decryptData(data, key) {
  // legacy wrapper, if needed
  if (data.startsWith('v1:')) {
    const raw = data.slice(3);
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } else {
    try {
      return atob(data);
    } catch {
      return data;
    }
  }
}