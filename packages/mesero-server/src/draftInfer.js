/**
 * Detecta platos del menú en texto (cliente o resumen del asistente) para completar DRAFT_JSON.
 */

function fold(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(name) {
  return fold(name)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !["con", "de", "la", "el", "los", "las", "del", "una", "uno", "porcion", "porción"].includes(w));
}

function scoreMenuItem(m, hay) {
  const nm = fold(m.name);
  if (!nm || nm.length < 2) return 0;

  if (hay.includes(nm) || nm.includes(hay)) return 1000;

  const tokens = significantTokens(m.name);
  if (tokens.length === 0) return 0;

  let matched = 0;
  for (const t of tokens) {
    if (hay.includes(t)) matched++;
  }
  if (matched === 0) return 0;
  let score = matched * 140;
  if (matched === tokens.length) score += 220;
  if (tokens.length >= 2 && matched < 2) score = Math.min(score, 100);
  return score;
}

/**
 * @param {string} text
 * @param {Array<{ id: string; name: string; available?: boolean }>} menu
 */
export function inferMenuLinesFromText(text, menu) {
  const hay = fold(text);
  if (!hay) return [];

  const ranked = [];
  for (const m of menu) {
    if (m.available === false) continue;
    const score = scoreMenuItem(m, hay);
    if (score >= 200) ranked.push({ menuItemId: m.id, name: m.name, qty: 1, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  const out = [];
  const used = new Set();
  for (const it of ranked) {
    if (used.has(it.menuItemId)) continue;
    const dominated = out.some((o) => {
      const oName = fold(menu.find((x) => x.id === o.menuItemId)?.name ?? "");
      const itName = fold(it.name);
      return oName.length > itName.length && oName.includes(itName) && o.score >= it.score;
    });
    if (dominated) continue;
    used.add(it.menuItemId);
    out.push({ menuItemId: it.menuItemId, name: it.name, qty: it.qty });
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * @param {Array<{ menuItemId: string; name: string; qty: number }>} a
 * @param {Array<{ menuItemId: string; name: string; qty: number }>} b
 */
export function mergeDraftLineLists(a, b) {
  const map = new Map();
  for (const src of [a, b]) {
    for (const it of src || []) {
      const id = String(it.menuItemId ?? "").trim();
      if (!id) continue;
      const prev = map.get(id);
      const qty = Math.max(1, Math.min(99, Math.floor(Number(it.qty)) || 1));
      if (!prev || qty > prev.qty) {
        map.set(id, { menuItemId: id, name: String(it.name ?? "").trim(), qty });
      }
    }
  }
  return [...map.values()];
}
