export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Asegura from <= to; si el usuario invierte, se corrige al cambiar. */
export function clampDateRange(from: string, to: string): { from: string; to: string } {
  if (!from || !to) return { from, to };
  if (from <= to) return { from, to };
  return { from: to, to: from };
}
