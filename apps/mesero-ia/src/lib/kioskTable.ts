import { clampSelectedTable, normalizeTableCount } from "./tables";
import { saveKioskTable } from "./meseroSessionStorage";

/** Lee ?mesa=4 o ?table=4 de la URL del quiosco. */
export function parseTableFromSearchParams(params: URLSearchParams): number | null {
  const raw = params.get("mesa") ?? params.get("table") ?? params.get("mesaId");
  if (!raw?.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Fija la mesa de este dispositivo desde la URL y la guarda en localStorage.
 * Cada tablet puede abrir p. ej. http://host:5173/?mesa=3
 */
export function applyKioskTableFromUrl(
  params: URLSearchParams,
  tableCount = normalizeTableCount(undefined),
): number | null {
  const parsed = parseTableFromSearchParams(params);
  if (parsed == null) return null;
  const clamped = clampSelectedTable(parsed, tableCount);
  if (!clamped) return null;
  saveKioskTable(clamped);
  return clamped;
}
