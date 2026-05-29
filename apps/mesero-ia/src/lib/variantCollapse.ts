import type { MenuItem } from "./types";

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

function tokenBoundaryRegex(token: string) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s,])${esc}(?:$|[\\s,])`, "i");
}

function tokenInHay(hay: string, token: string) {
  if (tokenBoundaryRegex(token).test(` ${hay} `)) return true;
  const stem = token.replace(/s$/, "");
  if (stem.length >= 3 && stem !== token && tokenBoundaryRegex(stem).test(` ${hay} `)) return true;
  return false;
}

function fullNameInHay(itemName: string, hay: string) {
  const nm = fold(itemName).trim();
  if (!nm) return false;
  let pos = 0;
  while (pos < hay.length) {
    const idx = hay.indexOf(nm, pos);
    if (idx === -1) break;
    const charBefore = idx > 0 ? hay[idx - 1]! : " ";
    const charAfter = idx + nm.length < hay.length ? hay[idx + nm.length]! : " ";
    if (!/\p{L}|\p{N}/u.test(charBefore) && !/\p{L}|\p{N}/u.test(charAfter)) return true;
    pos = idx + Math.max(1, nm.length);
  }
  return false;
}

function sizeHintsInHay(name: string, hay: string) {
  const nm = fold(name);
  if (/\bpersonal\b/.test(hay) && /\b500\s*ml\b/.test(nm)) return true;
  const ml = nm.match(/\b(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (ml && new RegExp(`\\b${ml[1]!.replace(".", "[.,]")}\\s*ml\\b`, "i").test(hay)) return true;
  const lit = nm.match(/\b(\d+(?:[.,]\d+)?)\s*litros?\b/);
  if (lit && new RegExp(`\\b${lit[1]!.replace(".", "[.,]")}\\s*(?:litros?|l)\\b`, "i").test(hay)) return true;
  return false;
}

export function isSodaMenuItem(name: string) {
  return /\b(coca|cola|pepsi|fiora|vanti|gaseosa|refresco)\b/i.test(fold(name));
}

/** Elige una sola gaseosa cuando hay varias variantes en el menú. */
export function pickSingleSodaVariant(items: MenuItem[], hay: string): MenuItem | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0]!;
  const h = expandedHay(hay);

  if (/\bpersonal\b/.test(h)) {
    const personal = items.filter((m) => /\b500\s*ml\b/i.test(fold(m.name)));
    if (personal.length === 1) return personal[0]!;
  }

  const sizePicks = items.filter((m) => sizeHintsInHay(m.name, h));
  if (sizePicks.length === 1) return sizePicks[0]!;

  const fullHits = items.filter((m) => fullNameInHay(m.name, h));
  if (fullHits.length === 1) return fullHits[0]!;

  const fioraOpts = items.filter((m) => /\bfiora\b|\bvanti\b/i.test(fold(m.name)));
  if (fioraOpts.length > 0 && (/\bfiora\b/.test(h) || /\bvanti\b/.test(h))) {
    const picks = fioraOpts.filter((m) => {
      const tokens = fold(m.name)
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !["con", "de", "ml", "litros"].includes(w));
      return tokens.filter((t) => tokenInHay(h, t)).length >= 2;
    });
    if (picks.length === 1) return picks[0]!;
  }

  const cocaOpts = items.filter((m) => /\bcoca\b|\bcola\b/i.test(fold(m.name)) && !/\bfiora\b/i.test(fold(m.name)));
  if (cocaOpts.length >= 2 && /\b(cola|coca)\b/.test(h)) return null;

  return null;
}

export function collapseVariantLines<T extends { menuItemId: string; name: string; qty: number }>(
  lines: T[],
  menu: MenuItem[],
  hay: string,
): T[] {
  const sodaLines = lines.filter((l) => {
    const m = menu.find((x) => x.id === l.menuItemId);
    return m && isSodaMenuItem(m.name);
  });
  if (sodaLines.length <= 1) return lines;

  const candidates = sodaLines
    .map((l) => menu.find((m) => m.id === l.menuItemId))
    .filter((m): m is MenuItem => Boolean(m));
  const pick = pickSingleSodaVariant(candidates, hay);
  const dropIds = new Set(sodaLines.map((l) => l.menuItemId));
  const rest = lines.filter((l) => !dropIds.has(l.menuItemId));
  if (pick) {
    const prev = sodaLines.find((l) => l.menuItemId === pick.id);
    rest.push(
      (prev ?? { menuItemId: pick.id, name: pick.name, qty: 1 }) as T,
    );
  }
  return rest;
}

export function dedupeAmbiguousGroups(groups: { label: string; options: string[] }[]) {
  const seen = new Set<string>();
  const out: { label: string; options: string[] }[] = [];
  for (const g of groups) {
    const key = [...g.options].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}
