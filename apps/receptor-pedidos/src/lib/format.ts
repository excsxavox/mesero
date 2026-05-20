export function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatMoney(n: number, currency = "US$"): string {
  return `${n.toFixed(2).replace(".", ",")} ${currency}`;
}

/** Formato $1,248.50 para el panel de control */
export function formatMoneyUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function formatDateLabel(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return isoDate;
  }
}

export function formatDateRangeLabel(from: string, to: string): string {
  if (!from && !to) return "";
  if (from === to || !to) return formatDateLabel(from || to);
  return `${formatDateLabel(from)} – ${formatDateLabel(to)}`;
}

export function tableLabel(table?: string): string {
  const t = (table ?? "").trim();
  if (!t) return "Sin mesa";
  if (/^mesa\s/i.test(t)) return t;
  if (/^\d+$/.test(t)) return `Mesa ${t}`;
  return t;
}

export function orderShortId(id: string): string {
  const digits = id.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return id.slice(0, 8);
}

export function sourceLabel(source?: string): string {
  const s = (source ?? "").toLowerCase();
  if (s === "ia" || s === "mesero") return "Mesero IA";
  if (s === "admin") return "Panel admin";
  return source?.trim() || "Mesero IA";
}

export function itemsSummary(items: { qty: number; name: string }[]): string {
  return items.map((i) => `${i.qty}x ${i.name}`).join(", ");
}
