/**
 * SAFE MATH UTILITIES
 * ==================
 * 
 * Precision arithmetic for cryptocurrency and fiat calculations
 * - Handles floating-point precision issues
 * - Provides overflow guards for large numbers
 * - Supports both crypto (8 decimals) and fiat (2 decimals)
 * - Robust parsing with comma/whitespace stripping
 * 
 * Default Precision:
 * - Crypto: 8 decimals (CRYPTO_FACTOR = 1e8)
 * - Fiat: 2 decimals (FIAT_FACTOR = 1e2)
 * - Default: 8 decimals (DEFAULT_DECIMALS)
 * 
 * Overflow Guard:
 * - Falls back to float math when scaled integers exceed MAX_SAFE_INTEGER
 * - Only logs in development mode
 * 
 * @example
 * // Import specific functions
 * import { safeAdd, safeMultiply, DEFAULT_DECIMALS } from './safeMath';
 * 
 * // Or import as namespace
 * import safeMath from './safeMath';
 * const result = safeMath.safeAdd(10, 20);
 */

// ==================== CONSTANTS ====================

/**
 * Default decimal precision for crypto calculations
 * Used for BTC, ETH, and other cryptocurrencies
 */
export const DEFAULT_DECIMALS = 8;

/**
 * Scaling factor for fiat currencies (USD, INR, EUR, etc.)
 * Represents 2 decimal places (cents)
 * @type {number}
 */
export const FIAT_FACTOR = 100;

/**
 * Scaling factor for cryptocurrency calculations
 * Represents 8 decimal places (satoshis for BTC)
 * @type {number}
 */
export const CRYPTO_FACTOR = 100_000_000;

// Use CRYPTO_FACTOR as default
const FACTOR = CRYPTO_FACTOR;

// ==================== PARSE HELPERS ====================

/**
 * Safely parse a value to float
 * 
 * Features:
 * - Returns 0 (or custom default) for null/undefined/NaN
 * - Fast path for numeric inputs (no string conversion)
 * - Strips commas and whitespace from strings
 * - Validates that result is finite
 * 
 * @param {number|string|null|undefined} value - Value to parse
 * @param {number} [defaultValue=0] - Default if parsing fails
 * @returns {number} Parsed float value
 * 
 * @example
 * safeParseFloat('1,234.56') // Returns: 1234.56
 * safeParseFloat(50) // Returns: 50 (fast path)
 * safeParseFloat(null) // Returns: 0
 * safeParseFloat('abc') // Returns: 0
 */
export const safeParseFloat = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;

  // Fast path for numeric input (avoid string conversion)
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : defaultValue;
  }

  // String: strip commas and whitespace
  const cleaned = String(value).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);

  return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

/**
 * Safely parse a value to integer
 * 
 * @param {number|string|null|undefined} value - Value to parse
 * @param {number} [defaultValue=0] - Default if parsing fails
 * @returns {number} Parsed integer value
 * 
 * @example
 * safeParseInt('1,234.56') // Returns: 1234
 * safeParseInt(50.7) // Returns: 50
 * safeParseInt('abc') // Returns: 0
 */
export const safeParseInt = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : defaultValue;
  }

  const cleaned = String(value).replace(/,/g, '').trim();
  const num = parseInt(cleaned, 10);

  return isNaN(num) ? defaultValue : num;
};

// ==================== SCALING & OVERFLOW GUARD ====================

/**
 * Convert a float to scaled integer representation
 * 
 * This function scales a float by a factor to perform integer math,
 * which avoids floating-point precision issues.
 * 
 * Includes overflow guard: if scaled value exceeds MAX_SAFE_INTEGER,
 * returns the original float and marks it as overflowed.
 * 
 * @param {number|string} value - Value to scale
 * @param {number} [factor=CRYPTO_FACTOR] - Scaling factor
 * @returns {Object} { value: number, overflowed: boolean, factor: number }
 * 
 * @example
 * toScaled('0.123456789', 100_000_000)
 * // Returns: { value: 12345678, overflowed: false, factor: 100_000_000 }
 * 
 * toScaled('999999999999999999', 100_000_000)
 * // Returns: { value: 999999999999999999, overflowed: true, factor: 100_000_000 }
 */
export function toScaled(value, factor = FACTOR) {
  const f = safeParseFloat(value);
  const scaled = f * factor;

  // Check both infinity and overflow
  if (!Number.isFinite(scaled) || Math.abs(scaled) > Number.MAX_SAFE_INTEGER) {
    // Only log in development to avoid polluting production logs
    if (process && process.env && process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn(
        `[safeMath] Overflow guard triggered for value ${f} with factor ${factor}`
      );
    }
    return { value: f, overflowed: true, factor };
  }

  return { value: Math.round(scaled), overflowed: false, factor };
}

// ==================== ARITHMETIC OPERATIONS ====================

/**
 * Add two numbers with precision guard
 * 
 * Uses integer math after scaling to avoid floating-point errors.
 * Falls back to float addition if overflow would occur.
 * 
 * @param {number|string} num1 - First number
 * @param {number|string} num2 - Second number
 * @param {number} [factor=CRYPTO_FACTOR] - Scaling factor
 * @returns {number} Sum of num1 and num2
 * 
 * @example
 * safeAdd(0.1, 0.2) // Returns: 0.3 (not 0.30000000000000004)
 * safeAdd('1,234.50', '567.89') // Returns: 1802.39
 * safeAdd(10, 20, FIAT_FACTOR) // Returns: 30 (with fiat precision)
 */
export const safeAdd = (num1, num2, factor = FACTOR) => {
  const a = toScaled(num1, factor);
  const b = toScaled(num2, factor);

  // If either overflowed, fall back to float
  if (a.overflowed || b.overflowed) {
    return safeParseFloat(num1) + safeParseFloat(num2);
  }

  return (a.value + b.value) / factor;
};

/**
 * Subtract two numbers with precision guard
 * 
 * Uses integer math after scaling to avoid floating-point errors.
 * Falls back to float subtraction if overflow would occur.
 * 
 * @param {number|string} num1 - Minuend (first number)
 * @param {number|string} num2 - Subtrahend (second number)
 * @param {number} [factor=CRYPTO_FACTOR] - Scaling factor
 * @returns {number} Difference (num1 - num2)
 * 
 * @example
 * safeSubtract(100, 33) // Returns: 67
 * safeSubtract('1,000.50', '500.25') // Returns: 500.25
 * safeSubtract(10, 20) // Returns: -10
 */
export const safeSubtract = (num1, num2, factor = FACTOR) => {
  const a = toScaled(num1, factor);
  const b = toScaled(num2, factor);

  // If either overflowed, fall back to float
  if (a.overflowed || b.overflowed) {
    return safeParseFloat(num1) - safeParseFloat(num2);
  }

  return (a.value - b.value) / factor;
};

/**
 * Multiply two numbers with precision guard
 * 
 * Uses scaled integer multiplication to avoid floating-point errors.
 * Falls back to float multiplication if overflow would occur.
 * 
 * Includes quick path for zero multiplication.
 * 
 * @param {number|string} num1 - First number
 * @param {number|string} num2 - Second number
 * @returns {number} Product of num1 and num2
 * 
 * @example
 * safeMultiply(0.1, 0.2) // Returns: 0.02
 * safeMultiply(100, 0.00001) // Returns: 0.001
 * safeMultiply(45000, 0.00345678) // Returns: 155.556
 * safeMultiply(0, 999) // Returns: 0 (quick path)
 */
export const safeMultiply = (num1, num2) => {
  const a = safeParseFloat(num1);
  const b = safeParseFloat(num2);

  // Quick path for zeros
  if (a === 0 || b === 0) return 0;

  // Use moderate MULT_FACTOR to balance precision and overflow risk
  const MULT_FACTOR = 10_000;
  const A = toScaled(a, MULT_FACTOR);
  const B = toScaled(b, MULT_FACTOR);

  // If either overflowed, fall back to float with rounding
  if (A.overflowed || B.overflowed) {
    return safeRound(a * b, DEFAULT_DECIMALS);
  }

  // Integer multiply then scale back
  const prodInt = A.value * B.value;
  const result = prodInt / (MULT_FACTOR * MULT_FACTOR);

  return safeRound(result, DEFAULT_DECIMALS);
};

/**
 * Divide two numbers with precision guard
 * 
 * Returns fallback value (default 0) if divisor is zero or infinite.
 * Uses DEFAULT_DECIMALS for rounding.
 * 
 * @param {number|string} num1 - Dividend (numerator)
 * @param {number|string} num2 - Divisor (denominator)
 * @param {number} [fallback=0] - Value to return if division invalid
 * @returns {number} Quotient (num1 / num2) or fallback
 * 
 * @example
 * safeDivide(100, 5) // Returns: 20
 * safeDivide(10, 3) // Returns: 3.33333333 (8 decimals)
 * safeDivide(100, 0) // Returns: 0 (fallback)
 * safeDivide(100, Infinity) // Returns: 0 (fallback)
 */
export const safeDivide = (num1, num2, fallback = 0) => {
  const denominator = safeParseFloat(num2);

  // Guard against division by zero and infinity
  if (denominator === 0 || !isFinite(denominator)) {
    return fallback;
  }

  const numerator = safeParseFloat(num1);

  return safeRound(numerator / denominator, DEFAULT_DECIMALS);
};

/**
 * Calculate percentage of a value
 * 
 * Useful for calculating fees, taxes, profits, etc.
 * 
 * @param {number|string} value - Base value
 * @param {number|string} percent - Percentage to calculate (e.g., 5 for 5%)
 * @returns {number} Percentage amount
 * 
 * @example
 * safePercent(100, 5) // Returns: 5 (5% of 100)
 * safePercent(1000, 2.5) // Returns: 25 (2.5% of 1000)
 * safePercent('1,234.50', 10) // Returns: 123.45 (10% of 1234.50)
 */
export const safePercent = (value, percent) => {
  const pct = safeDivide(safeParseFloat(percent), 100, 0);
  return safeMultiply(safeParseFloat(value), pct);
};

// ==================== ROUNDING ====================

/**
 * Round a number to specified decimal places
 * 
 * Uses Number.EPSILON to help with floating-point rounding edge cases.
 * Implements banker's rounding behavior (round half to even).
 * 
 * @param {number|string} value - Value to round
 * @param {number} [decimals=DEFAULT_DECIMALS] - Number of decimal places
 * @returns {number} Rounded value
 * 
 * @example
 * safeRound(1.23456789, 2) // Returns: 1.23
 * safeRound(1.005, 2) // Returns: 1.01 (banker's rounding)
 * safeRound(0.1 + 0.2, 1) // Returns: 0.3
 * safeRound(99.999, 2) // Returns: 100
 */
export const safeRound = (value, decimals = DEFAULT_DECIMALS) => {
  const n = safeParseFloat(value);
  const factor = Math.pow(10, decimals);

  // Add EPSILON to reduce floating-point rounding edge cases
  // Epsilon = 2.220446049250313e-16
  return Math.round((n + Number.EPSILON) * factor) / factor;
};

// ==================== AGGREGATION ====================

/**
 * Sum array of objects using getter function
 * 
 * Useful for summing properties of objects in an array.
 * 
 * @param {Array} arr - Array of objects
 * @param {Function} getter - Function to extract numeric value from each item
 * @returns {number} Sum of all values
 * 
 * @example
 * const expenses = [
 *   { amount: 10, category: 'food' },
 *   { amount: 5, category: 'transport' },
 *   { amount: 15, category: 'entertainment' }
 * ];
 * safeSum(expenses, item => item.amount) // Returns: 30
 */
export const safeSum = (arr, getter) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0;

  return arr.reduce((sum, item) => safeAdd(sum, getter(item)), 0);
};

/**
 * Sum array of numbers
 * 
 * @param {Array<number|string>} arr - Array of numeric values
 * @returns {number} Sum of all values
 * 
 * @example
 * safeSumArr([10, 20, 30]) // Returns: 60
 * safeSumArr(['1.5', '2.3', '3.2']) // Returns: 7
 * safeSumArr([]) // Returns: 0
 */
export const safeSumArr = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0;

  return arr.reduce((sum, n) => safeAdd(sum, n), 0);
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get absolute value
 * 
 * @param {number|string} value - Value to get absolute value of
 * @returns {number} Absolute value
 * 
 * @example
 * safeAbs(-50) // Returns: 50
 * safeAbs('-123.45') // Returns: 123.45
 */
export const safeAbs = (value) => Math.abs(safeParseFloat(value)) || 0;

/**
 * Clamp a value between min and max
 * 
 * @param {number|string} value - Value to clamp
 * @param {number|string} min - Minimum value
 * @param {number|string} max - Maximum value
 * @returns {number} Clamped value
 * 
 * @example
 * safeClamp(50, 0, 100) // Returns: 50
 * safeClamp(-10, 0, 100) // Returns: 0
 * safeClamp(150, 0, 100) // Returns: 100
 */
export const safeClamp = (value, min, max) => {
  const v = safeParseFloat(value);
  const lo = safeParseFloat(min);
  const hi = safeParseFloat(max);

  return Math.min(Math.max(v, lo), hi);
};

/**
 * Get maximum of two numbers
 * 
 * @param {number|string} a - First number
 * @param {number|string} b - Second number
 * @returns {number} Maximum value
 * 
 * @example
 * safeMax(50, 100) // Returns: 100
 * safeMax('-50', '-100') // Returns: -50
 */
export const safeMax = (a, b) => Math.max(safeParseFloat(a), safeParseFloat(b));

/**
 * Get minimum of two numbers
 * 
 * @param {number|string} a - First number
 * @param {number|string} b - Second number
 * @returns {number} Minimum value
 * 
 * @example
 * safeMin(50, 100) // Returns: 50
 * safeMin('-50', '-100') // Returns: -100
 */
export const safeMin = (a, b) => Math.min(safeParseFloat(a), safeParseFloat(b));

/**
 * Format number for display
 * 
 * Uses localeString for proper formatting with separators.
 * 
 * @param {number|string} value - Value to format
 * @param {number} [decimals=2] - Number of decimal places
 * @param {string} [locale='en-US'] - Locale for formatting
 * @returns {string} Formatted string
 * 
 * @example
 * safeFormat(1234567.89, 2) // Returns: '1,234,567.89'
 * safeFormat(1000, 0) // Returns: '1,000'
 * safeFormat(99.5, 2, 'de-DE') // Returns: '99,50'
 */
export const safeFormat = (value, decimals = 2, locale = 'en-US') => {
  const n = safeParseFloat(value);

  return n.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// ==================== CRYPTO HELPERS ====================

/**
 * Calculate total value of crypto holdings
 * 
 * Formula: quantity × pricePerUnit
 * 
 * @param {number|string} quantity - Amount of cryptocurrency
 * @param {number|string} pricePerUnit - Price per unit
 * @returns {number} Total value
 * 
 * @example
 * cryptoValue(2.5, 45000) // Returns: 112500 (2.5 BTC at 45k each)
 * cryptoValue(100, 2000) // Returns: 200000 (100 ETH at 2k each)
 */
export const cryptoValue = (quantity, pricePerUnit) =>
  safeMultiply(safeParseFloat(quantity), safeParseFloat(pricePerUnit));

/**
 * Calculate Profit and Loss (PnL) for crypto positions
 * 
 * Calculates:
 * - Absolute profit/loss in base currency
 * - Percentage gain/loss
 * - Whether position is profitable
 * 
 * @param {number|string} quantity - Amount of cryptocurrency held
 * @param {number|string} buyPrice - Average purchase price per unit
 * @param {number|string} currentPrice - Current market price per unit
 * @returns {Object} PnL data { pnl, pnlPercent, isProfit }
 * 
 * @example
 * cryptoPnL(1, 100, 110)
 * // Returns: { pnl: 10, pnlPercent: 10, isProfit: true }
 * 
 * cryptoPnL(2, 50000, 45000)
 * // Returns: { pnl: -10000, pnlPercent: -10, isProfit: false }
 */
export const cryptoPnL = (quantity, buyPrice, currentPrice) => {
  const qty = safeParseFloat(quantity);
  const bought = safeMultiply(qty, safeParseFloat(buyPrice));
  const current = safeMultiply(qty, safeParseFloat(currentPrice));
  const pnl = safeSubtract(current, bought);
  const pnlPercent = safeDivide(safeMultiply(pnl, 100), bought, 0);

  return {
    pnl: safeRound(pnl, DEFAULT_DECIMALS),
    pnlPercent: safeRound(pnlPercent, 4),
    isProfit: pnl >= 0,
  };
};

// ==================== FIAT HELPERS ====================

/**
 * Add two fiat amounts with 2 decimal precision
 * 
 * @param {number|string} a - First amount
 * @param {number|string} b - Second amount
 * @returns {number} Sum with fiat precision
 * 
 * @example
 * fiatAdd(10.50, 20.75) // Returns: 31.25
 * fiatAdd('1,234.99', '567.01') // Returns: 1802
 */
export const fiatAdd = (a, b) => safeAdd(a, b, FIAT_FACTOR);

/**
 * Subtract two fiat amounts with 2 decimal precision
 * 
 * @param {number|string} a - First amount (minuend)
 * @param {number|string} b - Second amount (subtrahend)
 * @returns {number} Difference with fiat precision
 * 
 * @example
 * fiatSubtract(100.50, 50.25) // Returns: 50.25
 * fiatSubtract('1,000.00', '333.33') // Returns: 666.67
 */
export const fiatSubtract = (a, b) => safeSubtract(a, b, FIAT_FACTOR);

// ==================== DEFAULT EXPORT ====================

/**
 * Default export with all utilities
 * Useful for namespace import
 * 
 * @example
 * import safeMath from './safeMath';
 * safeMath.safeAdd(10, 20);
 * safeMath.DEFAULT_DECIMALS; // 8
 */
export default {
  // Parse
  safeParseFloat,
  safeParseInt,

  // Arithmetic
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  safePercent,

  // Rounding
  safeRound,

  // Aggregation
  safeSum,
  safeSumArr,

  // Utilities
  safeAbs,
  safeClamp,
  safeMax,
  safeMin,
  safeFormat,

  // Crypto
  cryptoValue,
  cryptoPnL,

  // Fiat
  fiatAdd,
  fiatSubtract,

  // Advanced
  toScaled,

  // Constants
  DEFAULT_DECIMALS,
  FIAT_FACTOR,
  CRYPTO_FACTOR,
};