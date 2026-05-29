import type { MenuItem } from "./types";
import { collapseVariantLines } from "./variantCollapse";

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function expandedHay(corpus: string): string {
  return fold(corpus)
    .replace(/\s+/g, " ")
    .replace(/\bcocacola\b/g, "coca cola")
    .trim();
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

const STOP_WORDS = new Set([
  "con",
  "de",
  "la",
  "el",
  "los",
  "las",
  "del",
  "al",
  "en",
  "y",
  "o",
  "un",
  "una",
  "para",
  "por",
]);

const SIDE_INGREDIENT_WORDS = new Set([
  "maduro",
  "maduros",
  "papa",
  "papas",
  "ensalada",
  "salsa",
  "frijol",
  "frijoles",
  "yuca",
  "pan",
  "tostones",
]);

function qtyBeforeIndex(hay: string, idx: number): number {
  const before = hay.slice(Math.max(0, idx - 28), idx);
  const m1 = before.match(/(\d{1,2})\s*[x×]\s*$/i);
  if (m1) return clampQty(parseInt(m1[1], 10));
  const m2 = before.match(/(\d{1,2})\s+$/);
  if (m2) return clampQty(parseInt(m2[1], 10));
  for (const [w, q] of Object.entries(SPANISH_QTY)) {
    const re = new RegExp(`\\b${w}\\s+$`, "i");
    if (re.test(before)) return q;
  }
  return 1;
}

function clampQty(n: number) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, Math.floor(n));
}

function significantTokens(name: string): string[] {
  return fold(name)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function tokenBoundaryRegex(token: string) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s,])${esc}(?:$|[\\s,])`, "i");
}

function tokenInHay(hay: string, token: string): boolean {
  if (tokenBoundaryRegex(token).test(` ${hay} `)) return true;
  const stem = token.replace(/s$/, "");
  if (stem.length >= 3 && stem !== token && tokenBoundaryRegex(stem).test(` ${hay} `)) return true;
  if (token.endsWith("z")) {
    const ces = `${token.slice(0, -1)}ces`;
    if (tokenBoundaryRegex(ces).test(` ${hay} `)) return true;
  }
  if (token.endsWith("ces") && token.length > 4) {
    const z = `${token.slice(0, -3)}z`;
    if (tokenBoundaryRegex(z).test(` ${hay} `)) return true;
  }
  return false;
}

function nameVariantsForHay(itemName: string): string[] {
  const nm = fold(itemName).trim();
  if (!nm) return [];
  const out = new Set([nm]);
  if (!nm.includes(" ")) {
    out.add(`${nm}s`);
    out.add(`${nm}es`);
    if (nm.endsWith("z")) out.add(`${nm.slice(0, -1)}ces`);
  }
  return [...out];
}

function fullNameMatchSingle(nm: string, hay: string): { ok: boolean; idx: number } {
  let pos = 0;
  while (pos < hay.length) {
    const idx = hay.indexOf(nm, pos);
    if (idx === -1) break;
    const charBefore = idx > 0 ? hay[idx - 1]! : " ";
    const charAfter = idx + nm.length < hay.length ? hay[idx + nm.length]! : " ";
    const boundaryBefore = !/\p{L}|\p{N}/u.test(charBefore);
    const boundaryAfter = !/\p{L}|\p{N}/u.test(charAfter);
    if (boundaryBefore && boundaryAfter) return { ok: true, idx };
    pos = idx + Math.max(1, nm.length);
  }
  return { ok: false, idx: -1 };
}

function matchedTokenSignature(itemName: string, hay: string): string {
  return significantTokens(itemName)
    .filter((t) => tokenInHay(hay, t))
    .sort()
    .join("|");
}

function fullNameMatch(nm: string, hay: string): { ok: boolean; idx: number } {
  for (const variant of nameVariantsForHay(nm)) {
    const hit = fullNameMatchSingle(variant, hay);
    if (hit.ok) return hit;
  }
  return { ok: false, idx: -1 };
}

/** «choclo» coincide con «Choclo con queso» si es el único plato con esa palabra principal. */
function matchesByPrimaryToken(m: MenuItem, hay: string, menu: MenuItem[]): boolean {
  const tokens = significantTokens(fold(m.name));
  if (tokens.length < 2) return false;
  const head = tokens[0]!;
  if (head.length < 4 || !tokenInHay(hay, head)) return false;
  const candidates = menu.filter((other) => {
    if (other.available === false) return false;
    const ot = significantTokens(fold(other.name));
    return ot[0] === head && tokenInHay(hay, head);
  });
  return candidates.length === 1 && candidates[0]!.id === m.id;
}

/** Cantidad mencionada antes del nombre del plato (ej. «dos arroces» → 2). */
export function qtyForMenuItemInHay(text: string, itemName: string): number {
  const hay = expandedHay(text);
  if (!hay) return 1;
  let maxQ = 1;
  for (const variant of nameVariantsForHay(itemName)) {
    let pos = 0;
    while (pos < hay.length) {
      const idx = hay.indexOf(variant, pos);
      if (idx === -1) break;
      const charBefore = idx > 0 ? hay[idx - 1]! : " ";
      const charAfter = idx + variant.length < hay.length ? hay[idx + variant.length]! : " ";
      const boundaryBefore = !/\p{L}|\p{N}/u.test(charBefore);
      const boundaryAfter = !/\p{L}|\p{N}/u.test(charAfter);
      if (boundaryBefore && boundaryAfter) {
        maxQ = Math.max(maxQ, qtyBeforeIndex(hay, idx));
      }
      pos = idx + Math.max(1, variant.length);
    }
  }
  return maxQ;
}

function userExplicitlyOrdersSide(word: string, hay: string): boolean {
  const w = word.replace(/s$/, "");
  if (new RegExp(`\\b(un|una|porci[oó]n\\s+de)\\s+[^.]{0,40}\\b(${word}|${w})\\b`, "i").test(hay)) {
    return true;
  }
  return new RegExp(
    `\\b(quiero|dame|traeme|ponme|pedir|pido|ordenar|necesito|me das|un|una|dos|tres|\\d+)\\s+(el\\s+)?(${word}|${w})\\b`,
    "i",
  ).test(hay);
}

function productSizeHints(name: string): { kind: "ml" | "l"; value: string }[] {
  const nm = fold(name);
  const out: { kind: "ml" | "l"; value: string }[] = [];
  const ml = nm.match(/\b(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (ml) out.push({ kind: "ml", value: ml[1]!.replace(",", ".") });
  const lit = nm.match(/\b(\d+(?:[.,]\d+)?)\s*litros?\b/);
  if (lit) out.push({ kind: "l", value: lit[1]!.replace(",", ".") });
  return out;
}

function sizeHintsMatchProduct(name: string, hay: string): boolean {
  if (/\bpersonal\b/.test(hay) && /\b500\s*ml\b/i.test(fold(name))) return true;
  const hints = productSizeHints(name);
  if (hints.length === 0) return false;
  return hints.every((h) => {
    const v = h.value.replace(".", "[.,]");
    if (h.kind === "ml") return new RegExp(`\\b${v}\\s*ml\\b`, "i").test(hay);
    return new RegExp(`\\b${v}\\s*(?:litros?|l)\\b`, "i").test(hay);
  });
}

function scoreMenuItem(m: MenuItem, hay: string, menu: MenuItem[]): { score: number; qty: number } {
  const nm = fold(m.name).trim();
  if (nm.length < 2) return { score: 0, qty: 1 };

  const full = fullNameMatch(nm, hay);
  if (full.ok) return { score: 1000, qty: qtyBeforeIndex(hay, full.idx) };

  const tokens = significantTokens(nm);
  if (tokens.length === 0) return { score: 0, qty: 1 };

  if (matchesByPrimaryToken(m, hay, menu)) {
    const head = tokens[0]!;
    const idx = hay.search(tokenBoundaryRegex(head));
    return {
      score: 1000,
      qty: idx >= 0 ? qtyBeforeIndex(hay, idx) : qtyForMenuItemInHay(hay, m.name),
    };
  }

  if (tokens.length === 1 && SIDE_INGREDIENT_WORDS.has(tokens[0]!) && !userExplicitlyOrdersSide(tokens[0]!, hay)) {
    return { score: 0, qty: 1 };
  }

  const matched = tokens.filter((t) => tokenInHay(hay, t));
  if (matched.length === 0) return { score: 0, qty: 1 };

  if (
    (tokens.length >= 2 && matched.length === tokens.length) ||
    (tokens.length >= 3 && matched.length >= Math.ceil(tokens.length * 0.75))
  ) {
    const firstIdx = matched
      .map((t) => hay.search(tokenBoundaryRegex(t)))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0];
    return { score: 1000, qty: firstIdx != null && firstIdx >= 0 ? qtyBeforeIndex(hay, firstIdx) : 1 };
  }

  const brandTokens = tokens.filter((t) => !/^\d+$/.test(t) && t !== "litros");
  const brandMatched = brandTokens.filter((t) => tokenInHay(hay, t));
  if (brandTokens.length >= 2 && brandMatched.length === brandTokens.length) {
    const sodaSiblings = menu.filter(
      (other) =>
        other.id !== m.id &&
        /\b(coca|cola)\b/i.test(fold(other.name)) &&
        /\b(coca|cola)\b/i.test(nm) &&
        !/\bfiora\b/i.test(fold(other.name)),
    );
    if (sodaSiblings.length > 0 && !sizeHintsMatchProduct(m.name, hay) && !/\bpersonal\b/.test(hay)) {
      return { score: 0, qty: 1 };
    }
    const firstIdx = brandMatched
      .map((t) => hay.search(tokenBoundaryRegex(t)))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0];
    return { score: 1000, qty: firstIdx != null && firstIdx >= 0 ? qtyBeforeIndex(hay, firstIdx) : 1 };
  }

  const cat = fold(m.category ?? "");
  let score = matched.length * 120;
  if (matched.length === tokens.length) score += 200;
  if (/\b(plato\s+fuerte|plato\s+principal|segundo|principal)\b/.test(hay) && /(carta|principal|plato|fuerte)/.test(cat)) {
    score += 40;
  }
  if (tokens.length >= 2 && matched.length < 2) score = Math.min(score, 90);

  const firstIdx = matched
    .map((t) => hay.search(tokenBoundaryRegex(t)))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  const qty = firstIdx != null && firstIdx >= 0 ? qtyBeforeIndex(hay, firstIdx) : 1;
  return { score, qty };
}

type RankedLine = { menuItemId: string; name: string; qty: number; score: number };

function resolvePartialAmbiguity(ranked: RankedLine[], menu: MenuItem[], hay: string): RankedLine[] {
  const partial = ranked.filter((it) => it.score < 1000);
  const groups = new Map<string, RankedLine[]>();

  for (const it of partial) {
    const m = menu.find((x) => x.id === it.menuItemId);
    if (!m) continue;
    const sig = matchedTokenSignature(m.name, hay);
    if (!sig) continue;
    const g = groups.get(sig) ?? [];
    g.push(it);
    groups.set(sig, g);
  }

  const out: RankedLine[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    const sizePicks = group.filter((it) => {
      const m = menu.find((x) => x.id === it.menuItemId);
      return m && sizeHintsMatchProduct(m.name, hay);
    });
    if (sizePicks.length === 1) {
      out.push(sizePicks[0]!);
      continue;
    }
    const picks = group.filter((it) => {
      const m = menu.find((x) => x.id === it.menuItemId)!;
      const tokens = significantTokens(m.name);
      const matched = tokens.filter((t) => tokenInHay(hay, t));
      const exclusive = matched.filter((t) =>
        group.every((other) => other.menuItemId === it.menuItemId || !significantTokens(
          menu.find((x) => x.id === other.menuItemId)?.name ?? "",
        ).includes(t)),
      );
      return exclusive.length > 0;
    });
    if (picks.length === 1) out.push(picks[0]!);
  }
  return out;
}

function pruneSupersededItems(
  items: { menuItemId: string; name: string; qty: number }[],
  menu: MenuItem[],
  hay: string,
) {
  if (!items.length || !hay.trim()) return items;

  const fullHits = items.filter((it) => {
    const m = menu.find((x) => x.id === it.menuItemId);
    return m && fullNameMatch(fold(m.name), hay).ok;
  });

  return items.filter((it) => {
    const m = menu.find((x) => x.id === it.menuItemId);
    if (!m) return false;
    if (fullNameMatch(fold(m.name), hay).ok) return true;

    const exclusive = significantTokens(m.name).filter((t) => !tokenInHay(hay, t));
    if (exclusive.length === 0) return true;

    const superseded = fullHits.some((fh) => {
      if (fh.menuItemId === it.menuItemId) return false;
      const fm = menu.find((x) => x.id === fh.menuItemId);
      if (!fm) return false;
      const shared = significantTokens(m.name).filter((t) => significantTokens(fm.name).includes(t));
      return shared.length >= 2;
    });
    return !superseded;
  });
}

/**
 * Detecta artículos del catálogo en texto del cliente o del resumen del mesero.
 * Si hay varias variantes del mismo producto (ej. varias Coca-Colas), no agrega todas:
 * solo una cuando el cliente ya especificó sabor/tamaño; si no, ninguna (Karen debe preguntar).
 */
export function inferLineItemsFromCorpus(corpus: string, menu: MenuItem[]) {
  const hay = expandedHay(corpus);
  if (!hay.trim()) return [] as { menuItemId: string; name: string; qty: number }[];

  const ranked: RankedLine[] = [];
  for (const m of menu) {
    const { score, qty } = scoreMenuItem(m, hay, menu);
    if (score >= 100) ranked.push({ menuItemId: m.id, name: m.name, qty, score });
  }

  ranked.sort((a, b) => b.score - a.score || b.name.length - a.name.length);

  const fullMatches = ranked.filter((it) => it.score >= 1000);
  const partialResolved = resolvePartialAmbiguity(ranked, menu, hay);

  const seen = new Set<string>();
  const out: { menuItemId: string; name: string; qty: number }[] = [];
  for (const it of [...fullMatches, ...partialResolved]) {
    if (seen.has(it.menuItemId)) continue;
    seen.add(it.menuItemId);
    const m = menu.find((x) => x.id === it.menuItemId);
    const qty = m ? Math.max(it.qty, qtyForMenuItemInHay(hay, m.name)) : it.qty;
    out.push({ menuItemId: it.menuItemId, name: it.name, qty });
  }

  return collapseVariantLines(pruneSupersededItems(out, menu, hay), menu, hay).sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
}
