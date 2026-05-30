/** Filtrado del menú enviado al modelo según lo que pregunta el cliente. */

function stripDiacritics(s) {
  return String(s).normalize("NFD").replace(/\p{M}+/gu, "");
}

export function recentUserTextForMenuScope(messages, maxTurns = 2) {
  const users = messages.filter((m) => m.role === "user").slice(-maxTurns);
  return users.map((m) => String(m.content ?? "")).join(" ");
}

function categoryMatchesUserText(text, category) {
  const t = stripDiacritics(String(text ?? "").toLowerCase());
  const c = stripDiacritics(category.toLowerCase());
  if (!c.trim() || !t.trim()) return false;
  if (t.includes(c)) return true;
  if (c.length >= 4 && c.endsWith("s")) {
    const singular = c.slice(0, -1);
    if (t.includes(singular)) return true;
  } else if (c.length >= 3 && !c.endsWith("s")) {
    if (t.includes(`${c}s`)) return true;
  }
  const userWords = t.split(/\s+/).filter((w) => w.length >= 3);
  for (const uw of userWords) {
    const stem = uw.replace(/s$/, "");
    if (stem.length >= 3 && c.includes(stem)) return true;
  }
  const catWords = c.split(/\s+/).filter((w) => w.length >= 4);
  for (const cw of catWords) {
    const stem = cw.replace(/s$/, "");
    if (t.includes(cw) || (stem.length >= 3 && t.includes(stem))) return true;
  }
  return false;
}

export function categoriesMentionedInText(text, categories) {
  return categories.filter((cat) => categoryMatchesUserText(text, cat));
}

/** Palabras habituales → categorías (por subcadena en el nombre de categoría). */
export function categoriesFromKeywordHints(text, categories) {
  const t = stripDiacritics(String(text ?? "").toLowerCase());
  const hints = [
    [/\b(postres?|dulces?|desserts?|helados?|tartas?)\b/i, /(postre|producto)/i],
    [/\b(entradas?|starters?|ensaladas?|tapas?|aperitivos?)\b/i, /entrada/i],
    [/\b(principales?|fuertes?|segundos?|pastas?|carnes?|pescados?|mains?)\b/i, /principal/i],
    [/\b(jugos?|zumos?|juguitos?)\b/i, /(jugo|zumo)/i],
    [/\b(gaseosas?|cocas?|colas?|refrescos?|sodas?|pepsi|fiora|vanti)\b/i, /(gaseosa|refresco|cola|coca|fiora|vanti)/i],
    [/\b(cervezas?|beers?|pilseners?)\b/i, /(cerveza|beer|pilsener)/i],
    [/\b(aguas?)\b/i, /(agua)/i],
    [/\b(bebidas?|drinks?|vinos?)\b/i, /(bebida)/i],
    [/\b(paquetes?|combos?|menú ejecutivo|menu ejecutivo)\b/i, /paquete/i],
    [/\b(servicios?|reservas?)\b/i, /servicio/i],
    [/\b(adicionales?|acompañamientos?|guarniciones?)\b/i, /(adicional|acompa)/i],
  ];
  const out = [];
  for (const [re, hint] of hints) {
    if (!re.test(t)) continue;
    for (const c of categories) {
      if (hint.test(stripDiacritics(String(c).toLowerCase()))) out.push(c);
    }
  }
  return [...new Set(out)];
}

function categoriesFromMentionedDishNames(text, menu) {
  const t = stripDiacritics(String(text ?? "").toLowerCase());
  const cats = new Set();
  for (const m of menu) {
    const n = stripDiacritics(String(m.name ?? "").toLowerCase()).trim();
    if (n.length < 3) continue;
    if (t.includes(n)) cats.add(String(m.category || "General").trim() || "General");
  }
  return cats;
}

function userExplicitlyWantsFullMenuCatalog(scopeText, categories, menu) {
  const t = stripDiacritics(String(scopeText ?? "").toLowerCase());
  if (!t.trim()) return true;

  const hasSpecificHint =
    categoriesMentionedInText(scopeText, categories).length > 0 ||
    categoriesFromKeywordHints(scopeText, categories).length > 0 ||
    categoriesFromMentionedDishNames(scopeText, menu).size > 0;

  if (/\b(todo|toda|completo|completa|everything|whole menu|entire menu)\b/i.test(t) && /\b(carta|menu|menú|list)\b/i.test(t)) {
    return true;
  }
  if (/\b(carta|menu|menú)\b/i.test(t) && !hasSpecificHint) return true;
  return false;
}

/**
 * Reduce tokens: si el cliente se centra en categorías concretas, solo se envían esos platos al modelo.
 */
export function selectMenuItemsForPrompt(messages, menu, categories) {
  const scopeText = recentUserTextForMenuScope(messages, 2);

  if (userExplicitlyWantsFullMenuCatalog(scopeText, categories, menu)) {
    return { items: menu, scopeNote: "" };
  }

  const catSet = new Set([
    ...categoriesMentionedInText(scopeText, categories),
    ...categoriesFromKeywordHints(scopeText, categories),
    ...categoriesFromMentionedDishNames(scopeText, menu),
  ]);

  if (catSet.size === 0) {
    return { items: menu, scopeNote: "" };
  }

  const cats = [...catSet];
  let items = menu.filter((m) => cats.includes(String(m.category || "").trim() || "General"));
  if (items.length === 0) items = menu;

  const others = categories.filter((c) => !catSet.has(c));
  const scopeNote =
    `\n\nALCANCE DEL CATÁLOGO (contexto acotado para ahorrar tokens): solo figuran platos de: ${cats.join(", ")}.` +
    (others.length
      ? ` Otras categorías del local no están listadas abajo: ${others.join(", ")}. Si el cliente pregunta por alguna de esas secciones (p. ej. jugos, gaseosas), menciona las opciones reales de esa categoría del menú del restaurante; no digas que no existen si la categoría figura aquí como disponible.`
      : "") +
    ` No inventes platos fuera de la lista detallada abajo.`;

  return { items, scopeNote };
}
