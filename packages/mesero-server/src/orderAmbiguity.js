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
