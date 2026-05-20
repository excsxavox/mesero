import type { Order } from "./types";
import { authFetch } from "./authSession";

export async function patchOrder(id: string, status: string): Promise<Order> {
  const r = await authFetch(`/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<Order>;
}

export async function fetchMenuPrices(): Promise<Map<string, number>> {
  try {
    const r = await authFetch("/api/menu");
    if (!r.ok) return new Map();
    const menu = (await r.json()) as { id: string; price?: number }[];
    return new Map(menu.map((m) => [m.id, Number(m.price) || 0]));
  } catch {
    return new Map();
  }
}

export function orderTotal(
  items: { menuItemId: string; qty: number }[],
  prices: Map<string, number>,
): number | null {
  let sum = 0;
  let any = false;
  for (const it of items) {
    const p = prices.get(it.menuItemId);
    if (p == null || Number.isNaN(p)) continue;
    any = true;
    sum += p * it.qty;
  }
  return any ? sum : null;
}
