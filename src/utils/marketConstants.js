// File Path: src/utils/marketConstants.js

// 🌍 1. Fiat Flag Mapping (For fast local rendering)
export const fiatFlagMap = {
  USD: 'us', INR: 'in', NPR: 'np', EUR: 'eu', GBP: 'gb', 
  CAD: 'ca', AUD: 'au', JPY: 'jp', CNY: 'cn', AED: 'ae', 
  SAR: 'sa', PKR: 'pk', BDT: 'bd', LKR: 'lk', SGD: 'sg', 
  CHF: 'ch', MXN: 'mx', BRL: 'br', ZAR: 'za', KRW: 'kr'
};

// 🌍 2. Complete Currencies List (Top 20 Most Traded & Used)
export const currenciesList = [
  // Core & Subcontinent
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States', flag: '🇺🇸', iconId: 'us', region: 'Americas' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'India', flag: '🇮🇳', iconId: 'in', region: 'Asia' },
  { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee', country: 'Nepal', flag: '🇳🇵', iconId: 'np', region: 'Asia' },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'Eurozone', flag: '🇪🇺', iconId: 'eu', region: 'Europe' },

  // Rest of Asia
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', country: 'Pakistan', flag: '🇵🇰', iconId: 'pk', region: 'Asia' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', country: 'Bangladesh', flag: '🇧🇩', iconId: 'bd', region: 'Asia' },
  { code: 'LKR', symbol: 'රු', name: 'Sri Lankan Rupee', country: 'Sri Lanka', flag: '🇱🇰', iconId: 'lk', region: 'Asia' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'Japan', flag: '🇯🇵', iconId: 'jp', region: 'Asia' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', country: 'China', flag: '🇨🇳', iconId: 'cn', region: 'Asia' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', country: 'Singapore', flag: '🇸🇬', iconId: 'sg', region: 'Asia' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', country: 'South Korea', flag: '🇰🇷', iconId: 'kr', region: 'Asia' },

  // Middle East (Crucial for Remittance)
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', country: 'United Arab Emirates', flag: '🇦🇪', iconId: 'ae', region: 'Middle East' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', country: 'Saudi Arabia', flag: '🇸🇦', iconId: 'sa', region: 'Middle East' },

  // Americas
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'Canada', flag: '🇨🇦', iconId: 'ca', region: 'Americas' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', country: 'Mexico', flag: '🇲🇽', iconId: 'mx', region: 'Americas' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', country: 'Brazil', flag: '🇧🇷', iconId: 'br', region: 'Americas' },

  // Europe (Non-Euro)
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom', flag: '🇬🇧', iconId: 'gb', region: 'Europe' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', country: 'Switzerland', flag: '🇨🇭', iconId: 'ch', region: 'Europe' },

  // Oceania
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'Australia', flag: '🇦🇺', iconId: 'au', region: 'Oceania' },

  // Africa
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', country: 'South Africa', flag: '🇿🇦', iconId: 'za', region: 'Africa' }
];

// 🌍 3. Region Filter List
export const regions = ['All', 'Americas', 'Europe', 'Asia', 'Middle East', 'Africa', 'Oceania'];
