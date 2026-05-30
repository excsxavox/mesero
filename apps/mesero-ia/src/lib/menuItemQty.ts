import type { MenuItem } from "./types";
import { assistantConfirmsOrderItems, stripAssistantTags } from "./orderDraftConfirm";

function fold(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandedHay(text: string) {
  return fold(text).replace(/\bcocacola\b/g, "coca cola");
}

const SPANISH_QTY: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

function clampQty(n: number) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, Math.floor(n));
}

function addSpokenVariants(out: Set<string>, token: string) {
  if (!token || token.length < 3) return;
  out.add(token);
  out.add(`${token}s`);
  out.add(`${token}es`);
  if (token.endsWith("z")) out.add(`${token.slice(0, -1)}ces`);
}

function significantTokens(name: string) {
  return fold(name).split(/\s+/).filter((w) => w.length >= 3);
}

function nameVariantsForHay(itemName: string): string[] {
  const nm = fold(itemName).trim();
  if (!nm) return [];
  const out = new Set([nm]);
  if (!nm.includes(" ")) {
    addSpokenVariants(out, nm);
  } else {
    const head = significantTokens(itemName)[0];
    if (head && head.length >= 4) addSpokenVariants(out, head);
  }
  return [...out];
}

function corpusWithoutTail(fullHay: string, tailHay: string) {
  if (!tailHay || !fullHay) return fullHay ?? "";
  const f = expandedHay(fullHay);
  const t = expandedHay(tailHay);
  if (!t || !f.includes(t)) return f;
  return f.slice(0, f.lastIndexOf(t)).trim();
}

function isCocaColaProduct(name: string) {
  const n = fold(name);
  return /\b(coca|cola)\b/.test(n) && !/\bfiora\b/.test(n);
}

function sizeHintsInHay(name: string, hay: string) {
  const nm = fold(name);
  if (/\bpersonal\b/.test(hay) && /\b500\s*ml\b/.test(nm)) return true;
  const ml = nm.match(/\b(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (ml && new RegExp(`\\b${ml[1]!.replace(".", "[.,]")}\\s*ml\\b`, "i").test(hay)) return true;
  return false;
}

function mentionQtyAt(hay: string, idx: number) {
  const before = hay.slice(Math.max(0, idx - 40), idx);
  const m1 = before.match(/(\d{1,2})\s*[x×]\s*$/i);
  if (m1) return clampQty(parseInt(m1[1], 10));
  const m2 = before.match(/(\d{1,2})\s+$/);
  if (m2) return clampQty(parseInt(m2[1], 10));
  for (const [w, q] of Object.entries(SPANISH_QTY)) {
    if (new RegExp(`\\b${w}\\s+$`, "i").test(before)) return q;
  }
  if (/\b(otra|otro|otras|otros|mas|más|another)\s+$/i.test(before)) return 1;
  return 1;
}

function countCocaPersonalMentions(hay: string) {
  if (!/\bpersonal\b/.test(hay)) return 0;
  let total = 0;
  const re =
    /\b(?:otra|otro|otras|otros|mas|más|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d{1,2})\s+(?:coca\s*cola|cocacola|coca)(?:\s+personal)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(hay)) !== null) {
    const word = m[0].split(/\s+/)[0]!.toLowerCase();
    const q = SPANISH_QTY[word] ?? (/\d+/.test(word) ? clampQty(parseInt(word, 10)) : 1);
    total += q;
  }
  return total;
}

/** «otra coca», «otro arroz» — sumar una unidad más. */
export function hasRepeatOrderPhrase(hay: string, itemName: string) {
  const h = expandedHay(hay);
  if (!h || !/\b(otra|otro|otras|otros|mas|más|another)\b/.test(h)) return false;
  if (isCocaColaProduct(itemName) && /\b(coca|cola)\b/.test(h)) {
    if (/\bpersonal\b/.test(h) && /\b500\s*ml\b/.test(fold(itemName))) return true;
    if (sizeHintsInHay(itemName, h)) return true;
  }
  for (const variant of nameVariantsForHay(itemName)) {
    const esc = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b(otra|otro|otras|otros|mas|más|another)\\s+(?:\\w+\\s+){0,6}${esc}\\b`, "i").test(h)) {
      return true;
    }
  }
  const head = significantTokens(itemName)[0];
  if (head && head.length >= 4) {
    const esc = head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b(otra|otro|otras|otros|mas|más|another)\\s+(?:\\w+\\s+){0,6}${esc}\\b`, "i").test(h)) {
      return true;
    }
  }
  return false;
}

export function qtyForMenuItemInHay(text: string, itemName: string, menuItem?: MenuItem) {
  const hay = expandedHay(text);
  if (!hay) return 1;
  let total = 0;
  for (const variant of nameVariantsForHay(itemName)) {
    let pos = 0;
    while (pos < hay.length) {
      const idx = hay.indexOf(variant, pos);
      if (idx === -1) break;
      const charBefore = idx > 0 ? hay[idx - 1]! : " ";
      const charAfter = idx + variant.length < hay.length ? hay[idx + variant.length]! : " ";
      if (!/\p{L}|\p{N}/u.test(charBefore) && !/\p{L}|\p{N}/u.test(charAfter)) {
        total += mentionQtyAt(hay, idx);
      }
      pos = idx + Math.max(1, variant.length);
    }
  }
  if (
    menuItem &&
    isCocaColaProduct(menuItem.name) &&
    /\b500\s*ml\b/.test(fold(menuItem.name)) &&
    /\bpersonal\b/.test(hay)
  ) {
    total = Math.max(total, countCocaPersonalMentions(hay));
  }
  return Math.max(1, total);
}

export function resolveItemQty(opts: {
  userHay: string;
  lastUserHay?: string;
  assistantHay?: string;
  itemName: string;
  menuItem?: MenuItem;
  itemMentionedIn?: (hay: string) => boolean;
  prevQty?: number;
}) {
  const prev = Math.max(1, Math.min(99, Math.floor(Number(opts.prevQty)) || 1));
  const full = expandedHay(opts.userHay ?? "");
  const last = expandedHay(opts.lastUserHay ?? "");
  const assistRaw = String(opts.assistantHay ?? "");
  const assist = expandedHay(stripAssistantTags(assistRaw));
  const mentioned = opts.itemMentionedIn ?? (() => true);

  let fromUser = full ? qtyForMenuItemInHay(full, opts.itemName, opts.menuItem) : 1;

  if (last && mentioned(last)) {
    const prevPart = corpusWithoutTail(full, last);
    const prevSum = prevPart ? qtyForMenuItemInHay(prevPart, opts.itemName, opts.menuItem) : 0;
    const lastQty = qtyForMenuItemInHay(last, opts.itemName, opts.menuItem);
    if (hasRepeatOrderPhrase(last, opts.itemName)) {
      fromUser = prevSum + Math.max(1, lastQty);
    } else if (lastQty > prevSum) {
      fromUser = lastQty;
    } else {
      fromUser = Math.max(prevSum, lastQty);
    }
  }

  let qty = Math.max(prev, fromUser);

  if (assist && assistantConfirmsOrderItems(assistRaw) && mentioned(assist)) {
    const fromAssist = qtyForMenuItemInHay(assist, opts.itemName, opts.menuItem);
    if (fromAssist > 0) {
      if (!hasRepeatOrderPhrase(last, opts.itemName) && fromUser > fromAssist) {
        qty = Math.max(prev, fromAssist);
      } else {
        qty = Math.max(prev, fromUser, fromAssist);
      }
    }
  }
  if (hasRepeatOrderPhrase(assist, opts.itemName) && !hasRepeatOrderPhrase(last, opts.itemName) && fromUser <= prev) {
    qty = Math.max(qty, prev + 1);
  }

  return Math.min(99, qty);
}

export function applyRepeatQtyBump(
  prevQty: number,
  nextQty: number,
  lastUtterance: string,
  itemName: string,
  menuItem?: MenuItem,
  opts?: { userHay?: string; lastUserHay?: string; assistantHay?: string; itemMentionedIn?: (hay: string) => boolean },
) {
  if (opts?.userHay) {
    return resolveItemQty({
      userHay: opts.userHay,
      lastUserHay: opts.lastUserHay,
      assistantHay: opts.assistantHay,
      itemName,
      menuItem,
      itemMentionedIn: opts.itemMentionedIn,
      prevQty: prevQty,
    });
  }
  const prev = Math.max(1, prevQty);
  const next = Math.max(1, nextQty);
  let qty = Math.max(prev, next);
  if (hasRepeatOrderPhrase(lastUtterance, itemName) && next === 1 && prev >= 1) {
    qty = Math.max(qty, prev + 1);
  }
  return Math.min(99, qty);
}
