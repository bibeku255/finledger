// src/utils/emailValidator.js

// Sirf trusted providers ki list
const ALLOWED_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.in',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'me.com',
  'live.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'gmx.com',
  'yandex.com'
];

export const isPermanentEmail = (email) => {
  if (!email || typeof email !== 'string') return false;

  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;

  // Check: Kya email domain hamari trusted list mein hai?
  const isAllowed = ALLOWED_DOMAINS.includes(domain);

  return isAllowed; 
};