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

/**
 * Intenta detectar artículos del catálogo mencionados en un texto libre (usuario + asistente).
 * Sirve para cualquier negocio mientras el catálogo esté en administración.
 * Pasa preferiblemente solo el texto dicho/escrito por el **usuario** para no mezclar sugerencias del asistente.
 */
export function inferLineItemsFromCorpus(corpus: string, menu: MenuItem[]) {
  const hay = fold(corpus).replace(/\s+/g, " ");
  if (!hay.trim()) return [] as { menuItemId: string; name: string; qty: number }[];

  const sorted = [...menu].sort((a, b) => fold(b.name).length - fold(a.name).length);
  const best = new Map<string, { menuItemId: string; name: string; qty: number }>();

  for (const m of sorted) {
    const nm = fold(m.name).trim();
    if (nm.length < 2) continue;
    let pos = 0;
    while (pos < hay.length) {
      const idx = hay.indexOf(nm, pos);
      if (idx === -1) break;
      const charBefore = idx > 0 ? hay[idx - 1]! : " ";
      const charAfter = idx + nm.length < hay.length ? hay[idx + nm.length]! : " ";
      const boundaryBefore = !/\p{L}|\p{N}/u.test(charBefore);
      const boundaryAfter = !/\p{L}|\p{N}/u.test(charAfter);
      if (boundaryBefore && boundaryAfter) {
        const qty = qtyBeforeIndex(hay, idx);
        const prev = best.get(m.id);
        if (!prev || qty > prev.qty) best.set(m.id, { menuItemId: m.id, name: m.name, qty });
      }
      pos = idx + Math.max(1, nm.length);
    }
  }

  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}
