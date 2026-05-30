import type { MenuItem, OrderLine } from "./types";
import { applyRepeatQtyBump } from "./menuItemQty";
import { inferLineItemsFromCorpus, isMenuItemInCorpus } from "./inferLineItems";

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

export type DraftAmbiguousGroup = { label: string; options: string[] };

export type DraftMergeOpts = {
  lastUtterance?: string;
  menu?: MenuItem[];
  userHay?: string;
  lastUserHay?: string;
  assistantHay?: string;
};

export function mergeDraftInputs(
  prev: DraftLineInput[] | undefined,
  incoming: DraftLineInput[] | undefined,
  opts?: DraftMergeOpts,
): DraftLineInput[] {
  const map = new Map<string, DraftLineInput>();
  for (const it of prev ?? []) map.set(it.menuItemId, it);
  const lastUtterance = opts?.lastUtterance ?? "";
  for (const it of incoming ?? []) {
    const qty = Math.max(1, Math.min(99, Math.floor(it.qty) || 1));
    const prevLine = map.get(it.menuItemId);
    const name = it.name || prevLine?.name || it.menuItemId;
    const menuItem = opts?.menu?.find((m) => m.id === it.menuItemId);
    const mentionCheck =
      menuItem && opts?.menu
        ? (hay: string) => isMenuItemInCorpus(hay, menuItem, opts.menu!)
        : undefined;
    const mergedQty = prevLine
      ? applyRepeatQtyBump(prevLine.qty, qty, lastUtterance, name, menuItem, {
          userHay: opts?.userHay,
          lastUserHay: opts?.lastUserHay,
          assistantHay: opts?.assistantHay,
          itemMentionedIn: mentionCheck,
        })
      : opts?.userHay
        ? applyRepeatQtyBump(1, qty, lastUtterance, name, menuItem, {
            userHay: opts.userHay,
            lastUserHay: opts?.lastUserHay,
            assistantHay: opts?.assistantHay,
            itemMentionedIn: mentionCheck,
          })
        : qty;
    map.set(it.menuItemId, {
      menuItemId: it.menuItemId,
      name,
      qty: mergedQty,
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

function mergeDisplayLine(map: Map<string, DisplayLine>, it: DisplayLine) {
  const prev = map.get(it.menuItemId);
  if (!prev) {
    map.set(it.menuItemId, it);
    return;
  }
  map.set(it.menuItemId, {
    ...it,
    name: it.name || prev.name,
    qty: Math.max(prev.qty, it.qty),
    unitPrice: it.unitPrice ?? prev.unitPrice,
  });
}

/** Líneas activas del pedido (borrador IA + carrito táctil; sin re-inferir si ya hay borrador). */
export function mergedActiveLines(
  menu: MenuItem[],
  userCorpus: string,
  touchCart: Record<string, number> | undefined,
  assistantDraft?: DraftLineInput[],
) {
  const map = new Map<string, DisplayLine>();
  if (assistantDraft?.length) {
    for (const it of linesFromDraftInput(menu, assistantDraft)) mergeDisplayLine(map, it);
  } else if (userCorpus.trim()) {
    for (const it of draftLinesFromCorpus(userCorpus, menu)) mergeDisplayLine(map, it);
  }
  for (const it of touchCartLines(menu, touchCart)) mergeDisplayLine(map, it);
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
