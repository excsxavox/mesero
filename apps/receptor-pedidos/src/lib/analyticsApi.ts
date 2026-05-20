import type { PaymentHistoryEntry, TopProductsResponse } from "./analyticsTypes";
import { authFetch } from "./authSession";

export type DateRangeQuery = { from?: string; to?: string };

export async function fetchPaymentHistory(
  limit = 50,
  offset = 0,
  range?: DateRangeQuery,
) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (range?.from) q.set("from", range.from);
  if (range?.to) q.set("to", range.to);
  const r = await authFetch(`/api/payments/history?${q}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ total: number; items: PaymentHistoryEntry[] }>;
}

export async function fetchPaymentHistoryEntry(id: string) {
  const r = await authFetch(`/api/payments/history/${id}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<PaymentHistoryEntry>;
}

export async function fetchDashboard(range?: DateRangeQuery & { date?: string }) {
  const q = new URLSearchParams();
  if (range?.from) q.set("from", range.from);
  if (range?.to) q.set("to", range.to);
  if (!range?.from && !range?.to && range?.date) q.set("date", range.date);
  const qs = q.toString();
  const r = await authFetch(`/api/analytics/dashboard${qs ? `?${qs}` : ""}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<import("./dashboardTypes").DashboardData>;
}

export async function fetchTopProducts(limit = 12) {
  const r = await authFetch(`/api/analytics/top-products?limit=${limit}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<TopProductsResponse>;
}

export async function fetchMenuCatalog() {
  const r = await authFetch("/api/menu");
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<
    { id: string; name: string; price?: number; category?: string; imageUrl?: string }[]
  >;
}
