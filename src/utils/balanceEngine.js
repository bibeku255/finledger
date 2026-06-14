// src/utils/balanceEngine.js
//
// Balance engine for vaults and transactions.
// - Uses safeMath helpers for all numeric ops
// - Unified feeType default: 'inclusive'
// - Handles transfers, income/out, crypto types, and provides single-pass aggregator
// - Exports: calcVaultBalance, calcVaultSummary, calcAllVaultsSummary, calcAllVaultsSummarySinglePass, calcCapitalShifting, calcCapitalShiftingWithRunning

import {
  safeParseFloat,
  safeAdd,
  safeSubtract,
  safeRound,
  safeSumArr,
  safeMultiply,
} from './safeMath';

// -------------------- constants --------------------
const IN_TYPES = new Set([
  'in', 'income', 'credit',
  'buy', 'earn', 'stake_reward', 'unstake', 'bridge_in', 'swap_in', 'airdrop',
]);

const OUT_TYPES = new Set([
  'out', 'expense', 'debit',
  'sell', 'withdraw', 'stake', 'bridge_out', 'swap_out', 'fee_burn',
]);

// -------------------- helpers --------------------
function resolveDeduction(amount, fee, feeType = 'inclusive') {
  return (feeType || '').toLowerCase() === 'exclusive'
    ? safeAdd(amount, fee)
    : amount;
}

function resolveAddition(amount, fee, feeType = 'inclusive') {
  return (feeType || '').toLowerCase() === 'inclusive'
    ? safeSubtract(amount, fee)
    : amount;
}

function safeRound8(n) {
  return safeRound(n, 8);
}

function toUnixSeconds(tx) {
  // Prefer Firestore timestamp.seconds
  if (tx?.timestamp?.seconds) return Number(tx.timestamp.seconds);
  // Try ISO / date string
  if (tx?.date) {
    const parsed = Date.parse(tx.date);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  // fallback to createdAt or 0
  if (tx?.createdAt) {
    const p = Date.parse(tx.createdAt);
    if (!Number.isNaN(p)) return Math.floor(p / 1000);
  }
  return 0;
}

// -------------------- calcVaultSummary --------------------
/**
 * Full breakdown for a single vault (or global if vaultId == null)
 */
export function calcVaultSummary(transactions = [], vaultId = null) {
  const targetId = vaultId != null ? String(vaultId) : null;

  let balance = 0;
  let totalIncome = 0;
  let totalExpense = 0;
  let totalFees = 0;
  let transferIn = 0;
  let transferOut = 0;
  let txnCount = 0;

  transactions.forEach(tx => {
    // vault filter
    if (targetId) {
      const related =
        String(tx.vaultId || '') === targetId ||
        String(tx.fromVaultId || '') === targetId ||
        String(tx.toVaultId || '') === targetId;
      if (!related) return;
    }

    const rawType = (tx.type || tx.logType || '').toLowerCase();
    const fee = Math.max(0, safeParseFloat(tx.fee, 0));
    const amount = safeParseFloat(tx.finalBaseAmount ?? tx.amount, 0);
    const feeType = (tx.feeType || 'inclusive').toLowerCase();

    txnCount++;

    // transfers
    if (rawType === 'transfer' || rawType === 'capital_shift') {
      const fromId = String(tx.fromVaultId || '');
      const toId = String(tx.toVaultId || '');

      if (targetId && fromId === targetId) {
        const deduction = resolveDeduction(amount, fee, feeType);
        balance = safeSubtract(balance, deduction);
        transferOut = safeAdd(transferOut, amount);
      } else if (targetId && toId === targetId) {
        const addition = resolveAddition(amount, fee, feeType);
        balance = safeAdd(balance, addition);
        transferIn = safeAdd(transferIn, amount);
      } else if (!targetId) {
        // global view: transfers net to zero; only fees count
      }

      if (fee > 0) totalFees = safeAdd(totalFees, fee);
      return;
    }

    // income / in types
    if (IN_TYPES.has(rawType)) {
      const addition = resolveAddition(amount, fee, feeType);
      balance = safeAdd(balance, addition);
      totalIncome = safeAdd(totalIncome, amount);
      if (fee > 0) totalFees = safeAdd(totalFees, fee);
      return;
    }

    // expense / out types
    if (OUT_TYPES.has(rawType)) {
      const deduction = resolveDeduction(amount, fee, feeType);
      balance = safeSubtract(balance, deduction);
      totalExpense = safeAdd(totalExpense, amount);
      if (fee > 0) totalFees = safeAdd(totalFees, fee);
      return;
    }

    // unknown type: skip (or extend with custom logic)
  });

  return {
    balance: safeRound8(balance),
    totalIncome: safeRound8(totalIncome),
    totalExpense: safeRound8(totalExpense),
    totalFees: safeRound8(totalFees),
    transferIn: safeRound8(transferIn),
    transferOut: safeRound8(transferOut),
    txnCount,
  };
}

export function calcVaultBalance(transactions = [], vaultId = null) {
  const { balance, totalFees } = calcVaultSummary(transactions, vaultId);
  return { balance, totalFees };
}

// -------------------- calcAllVaultsSummary (original, simple) --------------------
/**
 * Original approach: compute per-vault by calling calcVaultSummary for each discovered vault.
 * Works fine for small datasets but O(n * v) for large ones.
 */
export function calcAllVaultsSummary(transactions = []) {
  const vaultIds = new Set();
  transactions.forEach(tx => {
    if (tx.vaultId) vaultIds.add(String(tx.vaultId));
    if (tx.fromVaultId) vaultIds.add(String(tx.fromVaultId));
    if (tx.toVaultId) vaultIds.add(String(tx.toVaultId));
  });

  const result = {};
  vaultIds.forEach(id => {
    result[id] = calcVaultSummary(transactions, id);
  });

  // compute grand totals (global)
  let totalBalance = 0;
  let totalIncome = 0;
  let totalExpense = 0;
  let totalFees = 0;

  transactions.forEach(tx => {
    const rawType = (tx.type || tx.logType || '').toLowerCase();
    if (rawType === 'transfer' || rawType === 'capital_shift') {
      const fee = Math.max(0, safeParseFloat(tx.fee, 0));
      if (fee > 0) totalFees = safeAdd(totalFees, fee);
      return;
    }
    const amount = safeParseFloat(tx.finalBaseAmount ?? tx.amount, 0);
    const fee = Math.max(0, safeParseFloat(tx.fee, 0));
    const feeType = (tx.feeType || 'inclusive').toLowerCase();

    if (IN_TYPES.has(rawType)) {
      totalIncome = safeAdd(totalIncome, amount);
      totalBalance = safeAdd(totalBalance, resolveAddition(amount, fee, feeType));
      if (fee > 0) totalFees = safeAdd(totalFees, fee);
    } else if (OUT_TYPES.has(rawType)) {
      totalExpense = safeAdd(totalExpense, amount);
      totalBalance = safeSubtract(totalBalance, resolveDeduction(amount, fee, feeType));
      if (fee > 0) totalFees = safeAdd(totalFees, fee);
    }
  });

  result.total = {
    balance: safeRound8(totalBalance),
    totalIncome: safeRound8(totalIncome),
    totalExpense: safeRound8(totalExpense),
    totalFees: safeRound8(totalFees),
  };

  return result;
}

// -------------------- calcAllVaultsSummarySinglePass (recommended for large datasets) --------------------
/**
 * Single-pass aggregator: O(n) across transactions, builds per-vault summaries in one loop.
 * Recommended for large datasets.
 */
export function calcAllVaultsSummarySinglePass(transactions = []) {
  const perVault = new Map();
  let totalBalance = 0;
  let totalIncome = 0;
  let totalExpense = 0;
  let totalFees = 0;

  const ensure = (id) => {
    if (!perVault.has(id)) {
      perVault.set(id, {
        balance: 0,
        totalIncome: 0,
        totalExpense: 0,
        totalFees: 0,
      });
    }
    return perVault.get(id);
  };

  transactions.forEach(tx => {
    const rawType = (tx.type || tx.logType || '').toLowerCase();
    const fee = Math.max(0, safeParseFloat(tx.fee, 0));
    const amount = safeParseFloat(tx.finalBaseAmount ?? tx.amount, 0);
    const feeType = (tx.feeType || 'inclusive').toLowerCase();

    // transfers: update from/to vaults separately
    if (rawType === 'transfer' || rawType === 'capital_shift') {
      const from = tx.fromVaultId ? String(tx.fromVaultId) : null;
      const to = tx.toVaultId ? String(tx.toVaultId) : null;

      if (from) {
        const s = ensure(from);
        const deduction = resolveDeduction(amount, fee, feeType);
        s.balance = safeSubtract(s.balance, deduction);
        s.totalExpense = safeAdd(s.totalExpense, amount);
        s.totalFees = safeAdd(s.totalFees, fee);
      }
      if (to) {
        const s = ensure(to);
        const addition = resolveAddition(amount, fee, feeType);
        s.balance = safeAdd(s.balance, addition);
        s.totalIncome = safeAdd(s.totalIncome, amount);
        s.totalFees = safeAdd(s.totalFees, fee);
      }
      if (fee > 0) totalFees = safeAdd(totalFees, fee);
      return;
    }

    // non-transfer: apply to tx.vaultId if present
    const vid = tx.vaultId ? String(tx.vaultId) : null;

    if (IN_TYPES.has(rawType)) {
      if (vid) {
        const s = ensure(vid);
        s.balance = safeAdd(s.balance, resolveAddition(amount, fee, feeType));
        s.totalIncome = safeAdd(s.totalIncome, amount);
        s.totalFees = safeAdd(s.totalFees, fee);
      }
      totalIncome = safeAdd(totalIncome, amount);
      totalBalance = safeAdd(totalBalance, resolveAddition(amount, fee, feeType));
      if (fee > 0) totalFees = safeAdd(totalFees, fee);
    } else if (OUT_TYPES.has(rawType)) {
      if (vid) {
        const s = ensure(vid);
        s.balance = safeSubtract(s.balance, resolveDeduction(amount, fee, feeType));
        s.totalExpense = safeAdd(s.totalExpense, amount);
        s.totalFees = safeAdd(s.totalFees, fee);
      }
      totalExpense = safeAdd(totalExpense, amount);
      totalBalance = safeSubtract(totalBalance, resolveDeduction(amount, fee, feeType));
      if (fee > 0) totalFees = safeAdd(totalFees, fee);
    } else {
      // unknown type: skip
    }
  });

  const result = {};
  for (const [id, v] of perVault.entries()) {
    result[id] = {
      balance: safeRound8(v.balance),
      totalIncome: safeRound8(v.totalIncome),
      totalExpense: safeRound8(v.totalExpense),
      totalFees: safeRound8(v.totalFees),
    };
  }

  result.total = {
    balance: safeRound8(totalBalance),
    totalIncome: safeRound8(totalIncome),
    totalExpense: safeRound8(totalExpense),
    totalFees: safeRound8(totalFees),
  };

  return result;
}

// -------------------- calcCapitalShifting --------------------
/**
 * Returns transfer-only ledger for a vault with running balance.
 * Sorts by timestamp (oldest first). Uses toUnixSeconds for robust parsing.
 */
export function calcCapitalShifting(transactions = [], vaultId) {
  const targetId = String(vaultId);
  let runningBalance = 0;

  const shifts = transactions
    .filter(tx => {
      const rawType = (tx.type || '').toLowerCase();
      return (
        (rawType === 'transfer' || rawType === 'capital_shift') &&
        (
          String(tx.fromVaultId || '') === targetId ||
          String(tx.toVaultId || '') === targetId
        )
      );
    })
    .sort((a, b) => toUnixSeconds(a) - toUnixSeconds(b))
    .map(tx => {
      const fromId = String(tx.fromVaultId || '');
      const toId = String(tx.toVaultId || '');
      const amount = safeParseFloat(tx.finalBaseAmount ?? tx.amount, 0);
      const fee = Math.max(0, safeParseFloat(tx.fee, 0));
      const feeType = (tx.feeType || 'inclusive').toLowerCase();

      let net = 0;
      if (fromId === targetId) {
        net = -resolveDeduction(amount, fee, feeType);
      } else if (toId === targetId) {
        net = resolveAddition(amount, fee, feeType);
      }

      runningBalance = safeAdd(runningBalance, net);

      return {
        ...tx,
        netChange: safeRound8(net),
        runningBalance: safeRound8(runningBalance),
        direction: fromId === targetId ? 'out' : 'in',
      };
    });

  return { shifts, finalBalance: safeRound8(runningBalance) };
}

// -------------------- exports --------------------
export default {
  calcVaultSummary,
  calcVaultBalance,
  calcAllVaultsSummary,
  calcAllVaultsSummarySinglePass,
  calcCapitalShifting,
};