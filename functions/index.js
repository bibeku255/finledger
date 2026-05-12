const functions = require("firebase-functions");
const axios = require("axios");

exports.fetchCoinMarketCap = functions.https.onCall(async (data, context) => {
  const apiKey = functions.config().coinmarketcap.key;
  const { endpoint, params } = data;

  if (!endpoint) {
    throw new functions.https.HttpsError("invalid-argument", "Endpoint missing");
  }

  try {
    const response = await axios.get(
      `https://pro-api.coinmarketcap.com/v1/${endpoint}`,
      {
        headers: { "X-CMC_PRO_API_KEY": apiKey },
        params: params || {},
      }
    );
    return response.data;
  } catch (error) {
    console.error("API call failed:", error.message);
    throw new functions.https.HttpsError("internal", "CoinMarketCap API error");
  }
});
