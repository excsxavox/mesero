import type { MenuItem, OrderLine } from "./types";
import { inferLineItemsFromCorpus } from "./inferLineItems";

export type DisplayLine = { menuItemId: string; name: string; qty: number; unitPrice: number | null };

function isOnMenu(m: MenuItem) {
  return m.available !== false;
}

export function touchCartLines(menu: MenuItem[], touchCart: Record<string, number> | undefined) {
  if (!touchCart) return [] as DisplayLine[];
  const out: DisplayLine[] = [];
  for (const [id, qty] of Object.entries(touchCart)) {
    if (qty <= 0) continue;
    const m = menu.find((x) => x.id === id);
    if (m && isOnMenu(m)) out.push({ menuItemId: id, name: m.name, qty, unitPrice: m.price });
  }
  return out;
}

export function draftLinesFromCorpus(corpus: string, menu: MenuItem[]) {
  const menuForInfer = menu.filter(isOnMenu);
  return inferLineItemsFromCorpus(corpus, menuForInfer).map((it) => {
    const m = menu.find((x) => x.id === it.menuItemId);
    return { menuItemId: it.menuItemId, name: it.name, qty: it.qty, unitPrice: m?.price ?? null };
  });
}

/** Líneas activas del pedido (carrito táctil + detectado en conversación, sin duplicar id). */
export function mergedActiveLines(
  menu: MenuItem[],
  corpus: string,
  touchCart: Record<string, number> | undefined,
) {
  const map = new Map<string, DisplayLine>();
  for (const it of touchCartLines(menu, touchCart)) map.set(it.menuItemId, it);
  for (const it of draftLinesFromCorpus(corpus, menu)) {
    const prev = map.get(it.menuItemId);
    if (!prev || it.qty > prev.qty) map.set(it.menuItemId, it);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function lineSubtotal(line: DisplayLine) {
  if (line.unitPrice == null) return null;
  return line.unitPrice * line.qty;
}

export function orderTotal(lines: DisplayLine[]) {
  let sum = 0;
  let any = false;
  for (const l of lines) {
    const s = lineSubtotal(l);
    if (s != null) {
      sum += s;
      any = true;
    }
  }
  return any ? sum : null;
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

export type ConfirmedBundle = {
  id: string;
  createdAt: string;
  items: OrderLine[];
  /** Estado en cocina (sincronizado con el receptor). */
  status: string;
  statusChangedAt?: string;
};
