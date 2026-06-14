/**
 * ✅ API Response Validators
 * 
 * Validates API responses before using them.
 * Prevents MITM attacks, data poisoning, and malformed responses.
 * 
 * Usage:
 *   await secureFetch(url, validateForexResponse);
 */

// ═══════════════════════════════════════════════════════════════════════════
// FOREX API VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════

export const validateForexResponse = (data, requiredCurrency = null) => {
  // Check if response is object
  if (!data || typeof data !== 'object') {
    throw new Error('Forex: Response is not a valid object');
  }

  // Check if rates exist
  if (!data.rates || typeof data.rates !== 'object') {
    throw new Error('Forex: Missing rates field');
  }

  // Check if rates are not empty
  if (Object.keys(data.rates).length === 0) {
    throw new Error('Forex: Rates object is empty');
  }

  // If checking for specific currency
  if (requiredCurrency) {
    const rate = data.rates[requiredCurrency];
    if (rate === undefined) {
      throw new Error(`Forex: Currency ${requiredCurrency} not found`);
    }
    const num = parseFloat(rate);
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error(`Forex: Invalid rate for ${requiredCurrency}`);
    }
  }

  // Validate all rates are numbers
  Object.entries(data.rates).forEach(([currency, rate]) => {
    const num = parseFloat(rate);
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error(`Forex: Invalid rate for ${currency}: ${rate}`);
    }
  });

  return true;
};

// ═══════════════════════════════════════════════════════════════════════════
// COINGECKO VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════

export const validateCoinGeckoResponse = (data) => {
  // Check if response is object
  if (!data || typeof data !== 'object') {
    throw new Error('CoinGecko: Response is not a valid object');
  }

  // Check for API error
  if (data.status?.error_code) {
    throw new Error(`CoinGecko: ${data.status.error_message || 'API error'}`);
  }

  // Check if response has data
  const entries = Object.entries(data);
  if (entries.length === 0) {
    throw new Error('CoinGecko: Response is empty');
  }

  // Validate structure of first coin
  const [coinId, coinData] = entries[0];
  if (!coinData || typeof coinData !== 'object') {
    throw new Error(`CoinGecko: Invalid structure for ${coinId}`);
  }

  if (!('usd' in coinData)) {
    throw new Error(`CoinGecko: Missing USD price for ${coinId}`);
  }

  const price = parseFloat(coinData.usd);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`CoinGecko: Invalid price for ${coinId}: ${coinData.usd}`);
  }

  return true;
};

// ═══════════════════════════════════════════════════════════════════════════
// BINANCE VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════

export const validateBinanceResponse = (data) => {
  // Check if response is object
  if (!data || typeof data !== 'object') {
    throw new Error('Binance: Response is not a valid object');
  }

  // Check for API error
  if (data.code && data.code < 0) {
    throw new Error(`Binance: Error ${data.code} - ${data.msg}`);
  }

  // Check required fields
  if (!data.lastPrice) {
    throw new Error('Binance: Missing lastPrice field');
  }

  const price = parseFloat(data.lastPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Binance: Invalid price: ${data.lastPrice}`);
  }

  // Validate priceChangePercent if present
  if (data.priceChangePercent !== undefined) {
    const change = parseFloat(data.priceChangePercent);
    if (!Number.isFinite(change)) {
      throw new Error(`Binance: Invalid price change: ${data.priceChangePercent}`);
    }
  }

  return true;
};

// ═══════════════════════════════════════════════════════════════════════════
// DEXSCREENER VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════

export const validateDexScreenerResponse = (data) => {
  // Check if response is object
  if (!data || typeof data !== 'object') {
    throw new Error('DexScreener: Response is not a valid object');
  }

  // Check if pairs exist
  if (!Array.isArray(data.pairs)) {
    throw new Error('DexScreener: Missing or invalid pairs array');
  }

  // If pairs exist, validate first one
  if (data.pairs.length > 0) {
    const pair = data.pairs[0];
    
    if (!pair || typeof pair !== 'object') {
      throw new Error('DexScreener: Invalid pair structure');
    }

    if (!pair.priceUsd) {
      throw new Error('DexScreener: Missing priceUsd in pair');
    }

    const price = parseFloat(pair.priceUsd);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`DexScreener: Invalid price: ${pair.priceUsd}`);
    }
  }

  return true;
};

// ═══════════════════════════════════════════════════════════════════════════
// GECKOTERMINAL VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════

export const validateGeckoTerminalResponse = (data) => {
  // Check if response is object
  if (!data || typeof data !== 'object') {
    throw new Error('GeckoTerminal: Response is not a valid object');
  }

  // Check for data field
  if (!data.data || typeof data.data !== 'object') {
    throw new Error('GeckoTerminal: Missing data field');
  }

  // Check for attributes
  if (!data.data.attributes || typeof data.data.attributes !== 'object') {
    throw new Error('GeckoTerminal: Missing attributes field');
  }

  const price = data.data.attributes.price_usd;
  if (price === undefined) {
    throw new Error('GeckoTerminal: Missing price_usd');
  }

  const num = parseFloat(price);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`GeckoTerminal: Invalid price: ${price}`);
  }

  return true;
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Safe Parse Float
// ═══════════════════════════════════════════════════════════════════════════

export const safeParsePrice = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;
  const num = parseFloat(value);
  return Number.isFinite(num) && num >= 0 ? num : defaultValue;
};

export const safeParseChange = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : defaultValue;
};