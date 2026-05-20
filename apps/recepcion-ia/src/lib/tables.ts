export const DEFAULT_TABLE_COUNT = 12;
export const MIN_TABLE_COUNT = 1;
export const MAX_TABLE_COUNT = 99;

export function normalizeTableCount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_TABLE_COUNT;
  return Math.min(MAX_TABLE_COUNT, Math.max(MIN_TABLE_COUNT, Math.round(n)));
}

export function formatTableLabel(tableNumber: number): string {
  return `Mesa ${tableNumber}`;
}

export function clampSelectedTable(
  selected: number | null | undefined,
  tableCount: number,
): number | null {
  if (selected == null || !Number.isFinite(selected)) return null;
  const n = Math.round(selected);
  if (n < 1 || n > tableCount) return null;
  return n;
}
