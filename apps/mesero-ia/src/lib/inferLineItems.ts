import type { MenuItem } from "./types";

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
  "arroz",
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
  return tokenBoundaryRegex(token).test(` ${hay} `);
}

function matchedTokenSignature(itemName: string, hay: string): string {
  return significantTokens(itemName)
    .filter((t) => tokenInHay(hay, t))
    .sort()
    .join("|");
}

function fullNameMatch(nm: string, hay: string): { ok: boolean; idx: number } {
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

function userExplicitlyOrdersSide(word: string, hay: string): boolean {
  const w = word.replace(/s$/, "");
  return new RegExp(
    `\\b(quiero|dame|traeme|ponme|pedir|pido|ordenar|necesito|me das|un|una|dos|tres|\\d+)\\s+(el\\s+)?(${word}|${w})\\b`,
    "i",
  ).test(hay);
}

function scoreMenuItem(m: MenuItem, hay: string): { score: number; qty: number } {
  const nm = fold(m.name).trim();
  if (nm.length < 2) return { score: 0, qty: 1 };

  const full = fullNameMatch(nm, hay);
  if (full.ok) return { score: 1000, qty: qtyBeforeIndex(hay, full.idx) };

  const tokens = significantTokens(nm);
  if (tokens.length === 0) return { score: 0, qty: 1 };

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

/**
 * Detecta artículos del catálogo en texto del **cliente** (no del asistente).
 * Si hay varias variantes del mismo producto (ej. varias Coca-Colas), no agrega todas:
 * solo una cuando el cliente ya especificó sabor/tamaño; si no, ninguna (Karen debe preguntar).
 */
export function inferLineItemsFromCorpus(corpus: string, menu: MenuItem[]) {
  const hay = expandedHay(corpus);
  if (!hay.trim()) return [] as { menuItemId: string; name: string; qty: number }[];

  const ranked: RankedLine[] = [];
  for (const m of menu) {
    const { score, qty } = scoreMenuItem(m, hay);
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
    out.push({ menuItemId: it.menuItemId, name: it.name, qty: it.qty });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}
