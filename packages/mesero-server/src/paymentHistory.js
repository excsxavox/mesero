import crypto from "node:crypto";
import { resolveDateRange } from "./salesAnalytics.js";

const MAX_HISTORY = 500;

function isInRange(iso, start, end) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/**
 * @param {object} store
 * @param {import('./tableBills.js').computeTableBills extends Function ? never : any} bill - bill snapshot from computeTableBills
 */
export function recordPaymentHistory(store, bill) {
  if (!bill?.lines?.length && !(bill?.total > 0)) return null;
  if (!Array.isArray(store.paymentHistory)) store.paymentHistory = [];
  const entry = {
    id: crypto.randomUUID(),
    companyId: bill.companyId ?? null,
    branchId: bill.branchId ?? null,
    tableNumber: bill.tableNumber,
    tableLabel: bill.tableLabel,
    lines: bill.lines,
    total: bill.total,
    orderIds: [...(bill.orderIds || [])],
    itemCount: bill.itemCount ?? bill.lines.reduce((s, l) => s + l.qty, 0),
    paidAt: new Date().toISOString(),
    paymentMethod: bill.paymentMethod || "efectivo",
  };
  store.paymentHistory.unshift(entry);
  if (store.paymentHistory.length > MAX_HISTORY) {
    store.paymentHistory.length = MAX_HISTORY;
  }
  return entry;
}

/** @param {object} store @param {{ limit?: number; offset?: number; from?: string; to?: string }} opts */
export function listPaymentHistory(store, opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);
  let all = Array.isArray(store.paymentHistory) ? store.paymentHistory : [];
  if (opts.from || opts.to) {
    const { start, end } = resolveDateRange(opts.from, opts.to);
    all = all.filter((e) => isInRange(e.paidAt, start, end));
  }
  return {
    total: all.length,
    items: all.slice(offset, offset + limit),
  };
}

/** @param {object} store @param {string} id */
export function getPaymentHistoryEntry(store, id) {
  const all = Array.isArray(store.paymentHistory) ? store.paymentHistory : [];
  return all.find((e) => e.id === id) ?? null;
}
