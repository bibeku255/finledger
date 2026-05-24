// src/utils/balanceEngine.js

export function calcVaultBalance(transactions = [], vaultId = null) {
  let balance = 0;
  let totalFees = 0;

  const targetVaultId = String(vaultId ?? '');

  transactions.forEach(tx => {
    const rawType = (tx.type || '').toLowerCase();

    // 🧩 Vault filter: Check if transaction is related to the target vault
    if (targetVaultId) {
      const isRelated = 
        String(tx.vaultId || '') === targetVaultId ||
        String(tx.fromVaultId || '') === targetVaultId ||
        String(tx.toVaultId || '') === targetVaultId;
        
      if (!isRelated) return;
    }

    const fee = Number(tx.fee || 0);
    const finalAmount = Number(tx.finalBaseAmount || tx.amount || 0);

    // 🔁 UNIFIED INTERNAL TRANSFERS (Only when fromId & toId are in the SAME record)
    if (rawType === 'transfer' && tx.fromVaultId && tx.toVaultId) {
      const feeType = (tx.feeType || 'exclusive').toLowerCase();
      const fromId = String(tx.fromVaultId || '');
      const toId = String(tx.toVaultId || '');

      if (fromId === targetVaultId) {
        const deduction = feeType === 'exclusive' ? finalAmount + fee : finalAmount;
        balance -= deduction;
      } else if (toId === targetVaultId) {
        const addition = feeType === 'inclusive' ? finalAmount - fee : finalAmount;
        balance += addition;
      }

      if (fee > 0) totalFees += fee;
      return; // Skip standard processing for unified transfers
    }

    // 💰 STANDARD TRANSACTIONS & SPLIT SHIFTS (Income, Expense, Capital Shift In/Out)
    if (rawType === 'in' || rawType === 'income') {
      balance += finalAmount;
    } else if (rawType === 'out' || rawType === 'expense' || rawType === 'debit') {
      const feeType = (tx.feeType || 'inclusive').toLowerCase();
      // If exclusive, fee is added on top of the deduction (Example: 130000 + 20 = 130020)
      const deduction = feeType === 'exclusive' ? finalAmount + fee : finalAmount;
      balance -= deduction;
    }

    // Fee always counts toward global totalFees
    if (fee > 0) totalFees += fee;
  });

  return {
    balance: parseFloat(balance.toFixed(8)),
    totalFees: parseFloat(totalFees.toFixed(8))
  };
}