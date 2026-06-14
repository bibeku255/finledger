/**
 * ✅ Fetch with retry logic for 429 rate limits
 * Now with timeout support
 */
export const fetchWithRetry = async (url, retries = 2, timeoutMs = 10000) => {
  for (let i = 0; i <= retries; i++) {
    try {
      // ✅ Add timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      // ✅ Retry only on 429
      if (res.status !== 429) return res;

      // ✅ Exponential backoff
      if (i < retries) {
        const delayMs = 1000 * Math.pow(2, i);
        await new Promise(r => setTimeout(r, delayMs));
      }
    } catch (e) {
      clearTimeout(e.timeoutId); // Cleanup if exists
      
      // ✅ Log error
      console.warn(`[fetchWithRetry] Attempt ${i + 1} failed:`, e.message);

      if (i === retries) return null;

      // ✅ Exponential backoff on error too
      const delayMs = 1000 * Math.pow(2, i);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
};

/**
 * Group flat transaction logs by Month and Year for UI accordions
 */
export const groupLogsByMonth = (logs) => {
  if (!logs || logs.length === 0) return {};

  return logs.reduce((acc, log) => {
    let dateObj;
    if (log.timestamp && log.timestamp.seconds) {
      dateObj = new Date(log.timestamp.seconds * 1000);
    } else if (log.date) {
      dateObj = new Date(log.date); 
    } else {
      dateObj = new Date(); 
    }

    const monthYear = dateObj.toLocaleString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });

    if (!acc[monthYear]) {
      acc[monthYear] = [];
    }
    acc[monthYear].push(log);
    
    return acc;
  }, {});
};