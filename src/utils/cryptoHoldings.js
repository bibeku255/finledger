// src/utils/cryptoHoldings.js
export function calcCryptoHoldings(transactions) {
  const holdings = {};
  transactions.forEach(tx => {
    const coin = tx.coin?.toUpperCase();
    if (!coin) return;
    const qty = parseFloat(tx.quantity) || 0;
    const fee = parseFloat(tx.fee || tx.networkFee) || 0;
    const totalQty = parseFloat(tx.totalQuantity) || (qty + fee); // fallback

    if (!holdings[coin]) holdings[coin] = 0;

    if (tx.type === 'in') {
      holdings[coin] += qty;
    } else if (tx.type === 'out') {
      // कुल कटौती = quantity + fee (totalQuantity)
      holdings[coin] -= totalQty;
    } else if (tx.type === 'transfer') {
      // transfer में सिर्फ़ fee घटती है (total holdings से)
      holdings[coin] -= fee;
    }
  });

  // छोटी मात्रा हटाएँ
  Object.keys(holdings).forEach(coin => {
    if (holdings[coin] <= 0.00000001) delete holdings[coin];
  });

  return holdings;
}