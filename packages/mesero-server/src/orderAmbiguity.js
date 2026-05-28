/** Evita agregar todas las variantes cuando el cliente pide algo genérico ("una coca cola"). */

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

function fold(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function expandedHay(text) {
  return fold(text)
    .replace(/\s+/g, " ")
    .replace(/\bcocacola\b/g, "coca cola")
    .trim();
}

function significantTokens(name) {
  return fold(name)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function tokenInHay(hay, token) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s,])${esc}(?:$|[\\s,])`, "i").test(` ${hay} `);
}

function matchedTokenSignature(itemName, hay) {
  return significantTokens(itemName)
    .filter((t) => tokenInHay(hay, t))
    .sort()
    .join("|");
}

function fullNameInHay(itemName, hay) {
  const nm = fold(itemName).trim();
  if (!nm) return false;
  let pos = 0;
  while (pos < hay.length) {
    const idx = hay.indexOf(nm, pos);
    if (idx === -1) break;
    const charBefore = idx > 0 ? hay[idx - 1] : " ";
    const charAfter = idx + nm.length < hay.length ? hay[idx + nm.length] : " ";
    const boundaryBefore = !/\p{L}|\p{N}/u.test(charBefore);
    const boundaryAfter = !/\p{L}|\p{N}/u.test(charAfter);
    if (boundaryBefore && boundaryAfter) return true;
    pos = idx + Math.max(1, nm.length);
  }
  return false;
}

function lineMatchesUserText(mi, hay) {
  if (!hay || !mi) return false;
  if (fullNameInHay(mi.name, hay)) return true;
  const tokens = significantTokens(mi.name);
  if (tokens.length === 0) return false;
  const matched = tokens.filter((t) => tokenInHay(hay, t));
  if (matched.length === tokens.length) return true;
  if (tokens.length >= 3 && matched.length >= Math.ceil(tokens.length * 0.75)) return true;
  if (tokens.length >= 2 && matched.length >= 2) return true;
  if (tokens.length === 1 && matched.length === 1 && tokens[0].length >= 4) return true;
  return false;
}

function resolveAmbiguousGroups(lines, menu, hay) {
  if (lines.length <= 1) return lines;

  const resolved = lines
    .map((line) => {
      const mi = menu.find((m) => m.id === line.menuItemId);
      return mi ? { line, mi } : null;
    })
    .filter(Boolean);

  const fullHits = resolved.filter(({ mi }) => fullNameInHay(mi.name, hay));
  const partial = resolved.filter(({ mi }) => !fullNameInHay(mi.name, hay));

  const groups = new Map();
  for (const entry of partial) {
    const sig = matchedTokenSignature(entry.mi.name, hay);
    if (!sig) continue;
    const g = groups.get(sig) ?? [];
    g.push(entry);
    groups.set(sig, g);
  }

  const partialOut = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      partialOut.push(group[0].line);
      continue;
    }
    const picks = group.filter(({ mi }) => {
      const tokens = significantTokens(mi.name);
      const matched = tokens.filter((t) => tokenInHay(hay, t));
      const exclusive = matched.filter((t) =>
        group.every((other) => other.mi.id === mi.id || !significantTokens(other.mi.name).includes(t)),
      );
      return exclusive.length > 0;
    });
    if (picks.length === 1) partialOut.push(picks[0].line);
  }

  const fullOut = fullHits.map(({ line }) => line);
  const seen = new Set();
  const out = [];
  for (const line of [...fullOut, ...partialOut]) {
    if (seen.has(line.menuItemId)) continue;
    seen.add(line.menuItemId);
    out.push(line);
  }
  return out;
}

/** Detecta platos mencionados en texto (resumen del mesero o cliente). */
export function inferMenuLinesFromText(text, menu) {
  const hay = expandedHay(text);
  if (!hay) return [];

  const lines = [];
  for (const m of menu) {
    if (m.available === false) continue;
    if (lineMatchesUserText(m, hay)) {
      lines.push({ menuItemId: m.id, name: m.name, qty: 1 });
    }
  }
  return filterAmbiguousMenuLines(lines, menu, hay, { mode: "draft" });
}

/** Une listas de borrador por menuItemId (último gana en qty/nombre). */
export function mergeDraftItemLists(...lists) {
  const map = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const line of list) {
      if (!line?.menuItemId) continue;
      map.set(line.menuItemId, {
        menuItemId: line.menuItemId,
        name: line.name || line.menuItemId,
        qty: Math.max(1, Math.min(99, Math.floor(Number(line.qty)) || 1)),
      });
    }
  }
  return [...map.values()];
}

/**
 * Filtra variantes ambiguas (ej. varias Coca-Colas). Para DRAFT en pantalla confía en un solo ítem;
 * para ORDER valida también contra lo que dijo el cliente.
 * @param {Array<{ menuItemId: string; name?: string; qty?: number }>} lines
 * @param {Array<{ id: string; name: string }>} menu
 * @param {string} userText
 * @param {{ mode?: "draft" | "order" }} [opts]
 */
export function filterAmbiguousMenuLines(lines, menu, userText, opts = {}) {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const hay = expandedHay(userText);
  const mode = opts.mode === "order" ? "order" : "draft";

  if (mode === "draft") {
    if (lines.length === 1) return lines;
    if (!hay) return lines;
    return resolveAmbiguousGroups(lines, menu, hay);
  }

  if (!hay) return lines;
  const validated = lines.filter((line) => {
    const mi = menu.find((m) => m.id === line.menuItemId);
    return mi && lineMatchesUserText(mi, hay);
  });
  if (validated.length <= 1) return validated;
  return resolveAmbiguousGroups(validated, menu, hay);
}

function sizeHintsInHay(name, hay) {
  const nm = fold(name);
  const ml = nm.match(/\b(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (ml && new RegExp(`\\b${ml[1].replace(".", "[.,]")}\\s*ml\\b`, "i").test(hay)) return true;
  const lit = nm.match(/\b(\d+(?:[.,]\d+)?)\s*litros?\b/);
  if (lit && new RegExp(`\\b${lit[1].replace(".", "[.,]")}\\s*(?:litros?|l)\\b`, "i").test(hay)) return true;
  return false;
}

/** Pedidos genéricos («una cola») que abarcan varias variantes del menú. */
const GENERIC_PRODUCT_HINTS = [
  {
    label: "Gaseosa",
    re: /\b(cola|coca\s*cola|cocacola|gaseosa|refresco|soda)\b/i,
    matchItem: (name) => /\b(coca|cola|pepsi|fiora|gaseosa|refresco|vanti)\b/i.test(fold(name)),
  },
  {
    label: "Cerveza",
    re: /\b(cerveza|beer)\b/i,
    matchItem: (name) => /\b(cerveza|beer|pilsener|club)\b/i.test(fold(name)),
  },
];

function findGenericAmbiguousGroups(hay, menu) {
  if (!hay) return [];
  const out = [];
  for (const hint of GENERIC_PRODUCT_HINTS) {
    if (!hint.re.test(hay)) continue;
    const options = menu.filter((m) => m.available !== false && hint.matchItem(m.name));
    if (options.length <= 1) continue;
    const fullHits = options.filter((m) => fullNameInHay(m.name, hay));
    if (fullHits.length === 1) continue;
    const sizePicks = options.filter((m) => sizeHintsInHay(m.name, hay));
    if (sizePicks.length === 1) continue;
    out.push({ label: hint.label, options: options.map((m) => m.name) });
  }
  return out;
}

/**
 * Grupos de producto que el cliente mencionó pero sin variante clara (ej. «una cola» con varias Coca-Colas).
 * @returns {Array<{ label: string; options: string[] }>}
 */
export function findAmbiguousProductGroups(userText, menu) {
  const hay = expandedHay(userText);
  if (!hay) return [];

  const matched = [];
  for (const m of menu) {
    if (m.available === false) continue;
    if (lineMatchesUserText(m, hay)) matched.push(m);
  }

  const partial = matched.filter((m) => !fullNameInHay(m.name, hay));
  const groups = new Map();
  for (const m of partial) {
    const sig = matchedTokenSignature(m.name, hay);
    if (!sig) continue;
    const g = groups.get(sig) ?? [];
    g.push(m);
    groups.set(sig, g);
  }

  const out = [];
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
      items[0].name.split(/\s+/).slice(0, 2).join(" ").trim() ||
      significantTokens(items[0].name).slice(0, 2).join(" ");
    out.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      options: items.map((m) => m.name),
    });
  }

  const generic = findGenericAmbiguousGroups(hay, menu);
  for (const g of generic) {
    if (!out.some((x) => x.label === g.label)) out.push(g);
  }
  return out;
}
