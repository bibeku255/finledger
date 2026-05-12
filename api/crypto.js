// api/crypto.js
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract query params from the frontend call
  const { endpoint, params } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint missing' });
  }

  // Parse params (passed as comma-separated "key=value" pairs)
  const paramsObj = {};
  if (params) {
    params.split(',').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) paramsObj[key] = value;
    });
  }

  const apiKey = process.env.COINMARKETCAP_API_KEY; // server-side env variable
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const queryString = new URLSearchParams(paramsObj).toString();
    const url = `https://pro-api.coinmarketcap.com/v1/${endpoint}${queryString ? '?' + queryString : ''}`;
    const response = await fetch(url, {
      headers: { 'X-CMC_PRO_API_KEY': apiKey },
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}