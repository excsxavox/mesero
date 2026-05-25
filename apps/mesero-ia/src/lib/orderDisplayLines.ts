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

export type DraftLineInput = { menuItemId: string; name: string; qty: number };

export function mergeDraftInputs(
  prev: DraftLineInput[] | undefined,
  incoming: DraftLineInput[] | undefined,
): DraftLineInput[] {
  const map = new Map<string, DraftLineInput>();
  for (const it of prev ?? []) map.set(it.menuItemId, it);
  for (const it of incoming ?? []) {
    map.set(it.menuItemId, {
      menuItemId: it.menuItemId,
      name: it.name,
      qty: Math.max(1, Math.min(99, Math.floor(it.qty) || 1)),
    });
  }
  return [...map.values()];
}

/** Texto para inferir platos: lo que dijo el cliente + resumen reciente del mesero. */
export function buildOrderInferenceCorpus(userCorpus: string, assistantTexts: string[]): string {
  const assist = assistantTexts
    .map((s) => String(s ?? "").replace(/<<<[\s\S]*?>>>/g, " "))
    .join(" ");
  return `${userCorpus} ${assist}`.replace(/\s+/g, " ").trim();
}

function linesFromDraftInput(menu: MenuItem[], draft: DraftLineInput[] | undefined) {
  if (!draft?.length) return [] as DisplayLine[];
  const out: DisplayLine[] = [];
  for (const it of draft) {
    const m = menu.find((x) => x.id === it.menuItemId);
    const qty = Math.max(1, Math.min(99, Math.floor(it.qty) || 1));
    const name = (it.name || m?.name || "").trim();
    if (!it.menuItemId || !name) continue;
    if (m && isOnMenu(m)) {
      out.push({ menuItemId: it.menuItemId, name, qty, unitPrice: m.price });
    } else {
      out.push({ menuItemId: it.menuItemId, name, qty, unitPrice: m?.price ?? null });
    }
  }
  return out;
}

/** Líneas activas del pedido (borrador IA + carrito táctil + texto del cliente). */
export function mergedActiveLines(
  menu: MenuItem[],
  corpus: string,
  touchCart: Record<string, number> | undefined,
  assistantDraft?: DraftLineInput[],
) {
  const map = new Map<string, DisplayLine>();
  for (const it of linesFromDraftInput(menu, assistantDraft)) map.set(it.menuItemId, it);
  for (const it of draftLinesFromCorpus(corpus, menu)) {
    const prev = map.get(it.menuItemId);
    if (!prev || it.qty > prev.qty) map.set(it.menuItemId, it);
  }
  for (const it of touchCartLines(menu, touchCart)) map.set(it.menuItemId, it);
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
