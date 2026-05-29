import type { MenuItem } from "./types";
import { dedupeAmbiguousGroups, pickSingleSodaVariant } from "./variantCollapse";

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

function fold(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function expandedHay(text: string) {
  return fold(text)
    .replace(/\s+/g, " ")
    .replace(/\bcocacola\b/g, "coca cola")
    .trim();
}

function significantTokens(name: string) {
  return fold(name)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function tokenInHay(hay: string, token: string) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s,])${esc}(?:$|[\\s,])`, "i").test(` ${hay} `);
}

function matchedTokenSignature(itemName: string, hay: string) {
  return significantTokens(itemName)
    .filter((t) => tokenInHay(hay, t))
    .sort()
    .join("|");
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
    const boundaryBefore = !/\p{L}|\p{N}/u.test(charBefore);
    const boundaryAfter = !/\p{L}|\p{N}/u.test(charAfter);
    if (boundaryBefore && boundaryAfter) return true;
    pos = idx + Math.max(1, nm.length);
  }
  return false;
}

function isCocaColaProduct(name: string) {
  const n = fold(name);
  return /\b(coca|cola)\b/.test(n) && !/\bfiora\b/.test(n);
}

function lineMatchesUserText(mi: MenuItem, hay: string) {
  if (!hay || !mi) return false;
  if (fullNameInHay(mi.name, hay)) return true;
  if (isCocaColaProduct(mi.name)) {
    if (sizeHintsInHay(mi.name, hay)) return true;
    if (/\bpersonal\b/.test(hay) && /\b500\s*ml\b/.test(fold(mi.name))) return true;
  }
  const tokens = significantTokens(mi.name);
  if (tokens.length === 0) return false;
  const matched = tokens.filter((t) => tokenInHay(hay, t));
  if (matched.length === tokens.length) return true;

  const brandTokens = tokens.filter((t) => !/^\d+$/.test(t) && t !== "litros");
  const brandMatched = brandTokens.filter((t) => tokenInHay(hay, t));
  if (brandTokens.length >= 2 && brandMatched.length === brandTokens.length && !isCocaColaProduct(mi.name)) {
    return true;
  }

  if (tokens.length >= 3) {
    return matched.length >= Math.ceil(tokens.length * 0.75);
  }
  if (tokens.length === 2) {
    return matched.length === 2;
  }
  if (tokens.length === 1 && matched.length === 1 && tokens[0]!.length >= 4) return true;
  if (isCocaColaProduct(mi.name) && matched.length < tokens.length) return false;
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

const GENERIC_PRODUCT_HINTS = [
  {
    label: "Gaseosa",
    re: /\b(cola|coca\s*cola|cocacola|gaseosa|refresco|soda|fiora|vanti)\b/i,
    matchItem: (name: string) => /\b(coca|cola|pepsi|fiora|gaseosa|refresco|vanti)\b/i.test(fold(name)),
  },
  {
    label: "Cerveza",
    re: /\b(cerveza|beer)\b/i,
    matchItem: (name: string) => /\b(cerveza|beer|pilsener|club)\b/i.test(fold(name)),
  },
  {
    label: "Jugo",
    re: /\b(jugo|zumo|juguito)\b/i,
    matchItem: (name: string) => /\b(jugo|zumo)\b/i.test(fold(name)),
  },
  {
    label: "Agua",
    re: /\b(agua)\b/i,
    matchItem: (name: string) => /\b(agua)\b/i.test(fold(name)),
  },
];

function findGenericAmbiguousGroups(hay: string, menu: MenuItem[]) {
  if (!hay) return [] as { label: string; options: string[] }[];
  const out: { label: string; options: string[] }[] = [];
  for (const hint of GENERIC_PRODUCT_HINTS) {
    if (!hint.re.test(hay)) continue;
    const options = menu.filter((m) => m.available !== false && hint.matchItem(m.name));
    if (options.length <= 1) continue;
    if (hint.label === "Gaseosa" && pickSingleSodaVariant(options, hay)) continue;
    const fullHits = options.filter((m) => fullNameInHay(m.name, hay));
    if (fullHits.length === 1) continue;
    const brandResolved = options.filter((m) => {
      const bt = significantTokens(m.name).filter((t) => !/^\d+$/.test(t) && t !== "litros");
      return bt.length >= 2 && bt.every((t) => tokenInHay(hay, t));
    });
    if (brandResolved.length === 1) continue;
    const sizePicks = options.filter((m) => sizeHintsInHay(m.name, hay));
    if (sizePicks.length === 1) continue;
    out.push({ label: hint.label, options: options.map((m) => m.name) });
  }
  return out;
}

export type DraftAmbiguousGroup = { label: string; options: string[] };

/** Productos mencionados sin variante clara (alineado con mesero-server/orderAmbiguity). */
export function findAmbiguousProductGroups(userText: string, menu: MenuItem[]): DraftAmbiguousGroup[] {
  const hay = expandedHay(userText);
  if (!hay) return [];

  const matched: MenuItem[] = [];
  for (const m of menu) {
    if (m.available === false) continue;
    if (lineMatchesUserText(m, hay)) matched.push(m);
  }

  const partial = matched.filter((m) => !fullNameInHay(m.name, hay));
  const groups = new Map<string, MenuItem[]>();
  for (const m of partial) {
    const sig = matchedTokenSignature(m.name, hay);
    if (!sig) continue;
    const g = groups.get(sig) ?? [];
    g.push(m);
    groups.set(sig, g);
  }

  const out: DraftAmbiguousGroup[] = [];
  for (const items of groups.values()) {
    if (items.length <= 1) continue;
    const sizePicks = items.filter((m) => sizeHintsInHay(m.name, hay));
    if (sizePicks.length === 1) continue;
    const exclusivePicks = items.filter((m) => {
      const tokens = significantTokens(m.name);
      const matchedToks = tokens.filter((t) => tokenInHay(hay, t));
      const exclusive = matchedToks.filter((t) =>
        items.every((other) => other.id === m.id || !significantTokens(other.name).includes(t)),
      );
      return exclusive.length > 0;
    });
    if (exclusivePicks.length === 1) continue;
    const label =
      items[0]!.name.split(/\s+/).slice(0, 2).join(" ").trim() ||
      significantTokens(items[0]!.name).slice(0, 2).join(" ");
    out.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      options: items.map((m) => m.name),
    });
  }

  for (const g of findGenericAmbiguousGroups(hay, menu)) {
    if (!out.some((x) => x.label === g.label)) out.push(g);
  }

  return dedupeAmbiguousGroups(
    out.filter((g) => {
      if (g.label !== "Gaseosa") return true;
      const options = menu.filter(
        (m) => m.available !== false && /\b(coca|cola|pepsi|fiora|gaseosa|refresco|vanti)\b/i.test(fold(m.name)),
      );
      return !pickSingleSodaVariant(options, hay);
    }),
  );
}
