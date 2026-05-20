import type { MenuItem } from "./types";

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
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

/** Guarniciones sueltas: no matchear solo por aparecer en una frase larga del cliente. */
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

  const matched = tokens.filter((t) => tokenBoundaryRegex(t).test(` ${hay} `));
  if (matched.length === 0) return { score: 0, qty: 1 };

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

/**
 * Detecta artículos del catálogo en texto del **cliente** (no del asistente).
 * Prioriza nombres completos y varias palabras clave; evita falsos positivos con guarniciones sueltas.
 */
export function inferLineItemsFromCorpus(corpus: string, menu: MenuItem[]) {
  const hay = fold(corpus).replace(/\s+/g, " ");
  if (!hay.trim()) return [] as { menuItemId: string; name: string; qty: number }[];

  const ranked: { menuItemId: string; name: string; qty: number; score: number }[] = [];
  for (const m of menu) {
    const { score, qty } = scoreMenuItem(m, hay);
    if (score >= 100) ranked.push({ menuItemId: m.id, name: m.name, qty, score });
  }

  ranked.sort((a, b) => b.score - a.score || b.name.length - a.name.length);
  const best = new Map<string, { menuItemId: string; name: string; qty: number }>();
  for (const it of ranked) {
    const prev = best.get(it.menuItemId);
    if (!prev || it.qty > prev.qty) best.set(it.menuItemId, { menuItemId: it.menuItemId, name: it.name, qty: it.qty });
  }

  const topScore = ranked[0]?.score ?? 0;
  const out: { menuItemId: string; name: string; qty: number }[] = [];
  for (const it of ranked) {
    const chosen = best.get(it.menuItemId);
    if (!chosen) continue;
    if (topScore >= 500 && it.score < 150) continue;
    if (!out.some((x) => x.menuItemId === it.menuItemId)) out.push(chosen);
  }

  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}
