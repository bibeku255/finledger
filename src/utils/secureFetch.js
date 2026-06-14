/**
 * ✅ Secure Fetch Wrapper
 * 
 * Features:
 * - Timeout handling (default 10s)
 * - Automatic retries with exponential backoff
 * - Response validation
 * - Comprehensive error logging
 * - HTTPS enforcement
 * 
 * Usage:
 *   const data = await secureFetch(
 *     'https://api.example.com/data',
 *     validateResponseFunction,
 *     { timeoutMs: 8000, retries: 2 }
 *   );
 */

/**
 * Secure fetch with timeout, retries, and validation
 */
export const secureFetch = async (
  url,
  validator = null,
  options = {}
) => {
  const {
    timeoutMs = 10000,
    retries = 2,
    method = 'GET',
    headers = {},
  } = options;

  // ✅ SECURITY: Enforce HTTPS
  if (!url.startsWith('https://')) {
    throw new Error(`[secureFetch] Only HTTPS allowed, got: ${url.split('?')[0]}`);
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // ✅ Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // ✅ Make request
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // ✅ CHECK: HTTP status code
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // ✅ PARSE: JSON response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${parseError.message}`);
      }

      // ✅ VALIDATE: Response structure
      if (validator && typeof validator === 'function') {
        try {
          validator(data);
        } catch (validationError) {
          throw new Error(`Response validation failed: ${validationError.message}`);
        }
      }

      // ✅ SUCCESS: Return validated data
      return data;

    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === retries;
      const isTimeout = error.name === 'AbortError';
      const errorMsg = isTimeout ? `Timeout (>${timeoutMs}ms)` : error.message;

      // ✅ LOG: Attempt failure
      console.warn(
        `[secureFetch] Attempt ${attempt + 1}/${retries + 1} failed: ${errorMsg}`,
        {
          url: url.split('?')[0], // Hide query params for privacy
          attempt,
        }
      );

      if (isLastAttempt) {
        throw new Error(
          `[${new URL(url).hostname}] Failed after ${retries + 1} attempts: ${lastError.message}`
        );
      }

      // ✅ BACKOFF: Exponential delay before retry
      const delayMs = 1000 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error('Unknown fetch error');
};

/**
 * Secure fetch with automatic error handling
 * Returns null instead of throwing
 */
export const secureFetchSafe = async (
  url,
  validator = null,
  options = {}
) => {
  try {
    return await secureFetch(url, validator, options);
  } catch (error) {
    console.error('[secureFetchSafe] Error:', error.message);
    return null;
  }
};