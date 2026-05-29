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

const SPANISH_QTY = {
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

function clampQty(n) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, Math.floor(n));
}

function qtyBeforeIndex(hay, idx) {
  const before = hay.slice(Math.max(0, idx - 32), idx);
  const m1 = before.match(/(\d{1,2})\s*[x×]\s*$/i);
  if (m1) return clampQty(parseInt(m1[1], 10));
  const m2 = before.match(/(\d{1,2})\s+$/);
  if (m2) return clampQty(parseInt(m2[1], 10));
  for (const [w, q] of Object.entries(SPANISH_QTY)) {
    if (new RegExp(`\\b${w}\\s+$`, "i").test(before)) return q;
  }
  return 1;
}

/** Variantes del nombre en texto hablado (arroz → arroces). */
function nameVariantsForHay(itemName) {
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

/** Cantidad mencionada antes del nombre del plato en el corpus (ej. «dos arroces» → 2). */
export function qtyForMenuItemInHay(text, itemName) {
  const hay = expandedHay(text);
  if (!hay) return 1;
  let maxQ = 1;
  for (const variant of nameVariantsForHay(itemName)) {
    let pos = 0;
    while (pos < hay.length) {
      const idx = hay.indexOf(variant, pos);
      if (idx === -1) break;
      const charBefore = idx > 0 ? hay[idx - 1] : " ";
      const charAfter = idx + variant.length < hay.length ? hay[idx + variant.length] : " ";
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

/** Ajusta cantidades del borrador según lo que dijo el cliente o confirmó el mesero en voz. */
export function applyQtyToDraftLines(lines, menu, ...textParts) {
  const hay = expandedHay(textParts.filter(Boolean).join(" "));
  if (!hay || !Array.isArray(lines)) return lines ?? [];
  return lines.map((line) => {
    const mi = menu.find((m) => m.id === line.menuItemId);
    if (!mi) return line;
    const fromText = qtyForMenuItemInHay(hay, mi.name);
    const prev = Math.max(1, Math.min(99, Math.floor(Number(line.qty)) || 1));
    return { ...line, qty: Math.max(prev, fromText) };
  });
}

function significantTokens(name) {
  return fold(name)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function tokenInHay(hay, token) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = (t) => new RegExp(`(?:^|[\\s,])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[\\s,])`, "i").test(` ${hay} `);
  if (boundary(token)) return true;
  const stem = token.replace(/s$/, "");
  if (stem.length >= 3 && stem !== token && boundary(stem)) return true;
  if (token.endsWith("z") && boundary(`${token.slice(0, -1)}ces`)) return true;
  if (token.endsWith("ces") && token.length > 4 && boundary(`${token.slice(0, -3)}z`)) return true;
  return false;
}

function matchedTokenSignature(itemName, hay) {
  return significantTokens(itemName)
    .filter((t) => tokenInHay(hay, t))
    .sort()
    .join("|");
}

function fullNameInHay(itemName, hay) {
  for (const variant of nameVariantsForHay(itemName)) {
    let pos = 0;
    while (pos < hay.length) {
      const idx = hay.indexOf(variant, pos);
      if (idx === -1) break;
      const charBefore = idx > 0 ? hay[idx - 1] : " ";
      const charAfter = idx + variant.length < hay.length ? hay[idx + variant.length] : " ";
      const boundaryBefore = !/\p{L}|\p{N}/u.test(charBefore);
      const boundaryAfter = !/\p{L}|\p{N}/u.test(charAfter);
      if (boundaryBefore && boundaryAfter) return true;
      pos = idx + Math.max(1, variant.length);
    }
  }
  return false;
}

function isCocaColaProduct(name) {
  const n = fold(name);
  return /\b(coca|cola)\b/.test(n) && !/\bfiora\b/.test(n);
}

/** «choclo» coincide con «Choclo con queso» si es el único plato con esa palabra principal. */
function matchesByPrimaryToken(mi, hay, menu) {
  const tokens = significantTokens(mi.name);
  if (tokens.length < 2) return false;
  const head = tokens[0];
  if (head.length < 4 || !tokenInHay(hay, head)) return false;
  const candidates = menu.filter((m) => {
    if (m.available === false) return false;
    const ot = significantTokens(m.name);
    return ot[0] === head && tokenInHay(hay, head);
  });
  return candidates.length === 1 && candidates[0].id === mi.id;
}

function lineMatchesUserText(mi, hay, menu) {
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
  if (brandTokens.length >= 2 && brandMatched.length === brandTokens.length) return true;

  if (tokens.length >= 3) {
    return matched.length >= Math.ceil(tokens.length * 0.75);
  }
  if (tokens.length === 2) {
    if (matched.length === 2) return true;
    if (Array.isArray(menu) && matchesByPrimaryToken(mi, hay, menu)) return true;
    return false;
  }
  if (tokens.length === 1 && matched.length === 1 && tokens[0].length >= 4) return true;
  if (isCocaColaProduct(mi.name) && matched.length < tokens.length) return false;
  return false;
}

function stripAssistantTags(text) {
  return String(text ?? "")
    .replace(/<<<[\s\S]*?>>>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Karen confirmó que anotó platos (no solo listó el menú). */
export function assistantConfirmsOrderItems(text) {
  const t = expandedHay(stripAssistantTags(text));
  if (!t) return false;
  if (
    /\b(tenemos|ofrecemos|recomiendo|opciones|la carta|men[uú]\s+incluye|puedes\s+elegir)\b/.test(t) &&
    !/\b(agregad|anotad|sum[eé]|apuntad|registrad)\b/.test(t)
  ) {
    return false;
  }
  return /\b(listo|anotad|agregad|agregue|sum[eé]|apuntad|registrad|qued[oó]|va\s+un|van\s+|te\s+anoto)\b/.test(
    t,
  );
}

/** Ítems que Karen acaba de confirmar en voz («Listo, un choclo agregado»). */
export function inferMenuLinesFromAssistantConfirmation(text, menu) {
  const stripped = stripAssistantTags(text);
  if (!assistantConfirmsOrderItems(stripped)) return [];
  return inferMenuLinesFromText(stripped, menu);
}

/** Si el cliente pidió un plato concreto, no arrastrar otro más largo que solo comparte palabras. */
function pruneSupersededLines(lines, menu, hay) {
  if (!lines.length || !hay) return lines;

  const fullHits = lines.filter((line) => {
    const mi = menu.find((m) => m.id === line.menuItemId);
    return mi && fullNameInHay(mi.name, hay);
  });

  return lines.filter((line) => {
    const mi = menu.find((m) => m.id === line.menuItemId);
    if (!mi) return false;
    if (fullNameInHay(mi.name, hay)) return true;

    const exclusive = significantTokens(mi.name).filter((t) => !tokenInHay(hay, t));
    if (exclusive.length === 0) return true;

    const superseded = fullHits.some((fh) => {
      if (fh.menuItemId === line.menuItemId) return false;
      const fm = menu.find((m) => m.id === fh.menuItemId);
      if (!fm) return false;
      const shared = significantTokens(mi.name).filter((t) => significantTokens(fm.name).includes(t));
      return shared.length >= 2;
    });
    return !superseded;
  });
}

function uniqueBrandSodaPick(options, hay) {
  const fioraOpts = options.filter((m) => /\bfiora\b|\bvanti\b/i.test(fold(m.name)));
  if (fioraOpts.length > 0 && (/\bfiora\b/.test(hay) || /\bvanti\b/.test(hay))) {
    const picks = fioraOpts.filter((m) => {
      const bt = significantTokens(m.name).filter((t) => !/^\d+$/.test(t));
      return bt.filter((t) => tokenInHay(hay, t)).length >= 2;
    });
    if (picks.length === 1) return picks[0];
  }
  const cocaOpts = options.filter((m) => isCocaColaProduct(m.name));
  if (cocaOpts.length >= 2 && /\b(cola|coca)\b/.test(hay)) {
    if (/\bpersonal\b/.test(hay)) {
      const personal = cocaOpts.filter((m) => /\b500\s*ml\b/.test(fold(m.name)));
      if (personal.length === 1) return personal[0];
    }
    const sizePicks = cocaOpts.filter((m) => sizeHintsInHay(m.name, hay));
    if (sizePicks.length === 1) return sizePicks[0];
    const fullHits = cocaOpts.filter((m) => fullNameInHay(m.name, hay));
    if (fullHits.length === 1) return fullHits[0];
  }
  return null;
}

function isSodaMenuItem(name) {
  return /\b(coca|cola|pepsi|fiora|vanti|gaseosa|refresco)\b/i.test(fold(name));
}

function collapseVariantLines(lines, menu, hay) {
  const sodaLines = lines.filter((line) => {
    const mi = menu.find((m) => m.id === line.menuItemId);
    return mi && isSodaMenuItem(mi.name);
  });
  if (sodaLines.length <= 1) return lines;
  const candidates = sodaLines.map((l) => menu.find((m) => m.id === l.menuItemId)).filter(Boolean);
  const pick = uniqueBrandSodaPick(candidates, hay) ?? (() => {
    const cocaOnly = candidates.filter((m) => isCocaColaProduct(m.name));
    if (cocaOnly.length >= 2) return null;
    return cocaOnly.length === 1 ? cocaOnly[0] : null;
  })();
  const dropIds = new Set(sodaLines.map((l) => l.menuItemId));
  const rest = lines.filter((l) => !dropIds.has(l.menuItemId));
  if (pick) {
    const prev = sodaLines.find((l) => l.menuItemId === pick.id);
    rest.push(prev ?? { menuItemId: pick.id, name: pick.name, qty: 1 });
  }
  return rest;
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
    if (lineMatchesUserText(m, hay, menu)) {
      lines.push({ menuItemId: m.id, name: m.name, qty: qtyForMenuItemInHay(hay, m.name) });
    }
  }
  return collapseVariantLines(
    filterAmbiguousMenuLines(pruneSupersededLines(lines, menu, hay), menu, hay, { mode: "draft" }),
    menu,
    hay,
  );
}

/** Une listas de borrador por menuItemId (último gana en qty/nombre). */
export function mergeDraftItemLists(...lists) {
  const map = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const line of list) {
      if (!line?.menuItemId) continue;
      const qty = Math.max(1, Math.min(99, Math.floor(Number(line.qty)) || 1));
      const prev = map.get(line.menuItemId);
      map.set(line.menuItemId, {
        menuItemId: line.menuItemId,
        name: line.name || line.menuItemId,
        qty: prev ? Math.max(prev.qty, qty) : qty,
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
    return mi && lineMatchesUserText(mi, hay, menu);
  });
  if (validated.length <= 1) return validated;
  return resolveAmbiguousGroups(validated, menu, hay);
}

function sizeHintsInHay(name, hay) {
  const nm = fold(name);
  if (/\bpersonal\b/.test(hay) && /\b500\s*ml\b/.test(nm)) return true;
  const ml = nm.match(/\b(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (ml && new RegExp(`\\b${ml[1].replace(".", "[.,]")}\\s*ml\\b`, "i").test(hay)) return true;
  const lit = nm.match(/\b(\d+(?:[.,]\d+)?)\s*litros?\b/);
  if (lit && new RegExp(`\\b${lit[1].replace(".", "[.,]")}\\s*(?:litros?|l)\\b`, "i").test(hay)) return true;
  return false;
}

/** Pedidos genéricos («una cola», «un jugo») que abarcan varias variantes del menú. */
const GENERIC_PRODUCT_HINTS = [
  {
    label: "Gaseosa",
    re: /\b(cola|coca\s*cola|cocacola|gaseosa|refresco|soda|fiora|vanti)\b/i,
    matchItem: (name) => /\b(coca|cola|pepsi|fiora|gaseosa|refresco|vanti)\b/i.test(fold(name)),
  },
  {
    label: "Cerveza",
    re: /\b(cerveza|beer)\b/i,
    matchItem: (name) => /\b(cerveza|beer|pilsener|club)\b/i.test(fold(name)),
  },
  {
    label: "Jugo",
    re: /\b(jugo|zumo|juguito)\b/i,
    matchItem: (name) => /\b(jugo|zumo)\b/i.test(fold(name)),
  },
  {
    label: "Agua",
    re: /\b(agua)\b/i,
    matchItem: (name) => /\b(agua)\b/i.test(fold(name)),
  },
];

function findGenericAmbiguousGroups(hay, menu) {
  if (!hay) return [];
  const out = [];
  for (const hint of GENERIC_PRODUCT_HINTS) {
    if (!hint.re.test(hay)) continue;
    const options = menu.filter((m) => m.available !== false && hint.matchItem(m.name));
    if (options.length <= 1) continue;
    if (hint.label === "Gaseosa" && uniqueBrandSodaPick(options, hay)) continue;
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
    if (lineMatchesUserText(m, hay, menu)) matched.push(m);
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

  const deduped = [];
  const seenOpts = new Set();
  for (const g of out.filter((g) => {
    if (g.label !== "Gaseosa") return true;
    const options = menu.filter((m) => m.available !== false && /\b(coca|cola|pepsi|fiora|gaseosa|refresco|vanti)\b/i.test(fold(m.name)));
    return !uniqueBrandSodaPick(options, hay);
  })) {
    const key = [...g.options].sort().join("|");
    if (seenOpts.has(key)) continue;
    seenOpts.add(key);
    deduped.push(g);
  }
  return deduped;
}
