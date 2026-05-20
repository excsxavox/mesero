/** Mismas claves que el Kanban del receptor de pedidos. */
export type KitchenOrderStatus = "nuevo" | "preparando" | "listo" | "entregado" | "pagado";

const LABELS: Record<string, string> = {
  nuevo: "Nuevo en cocina",
  preparando: "En preparación",
  listo: "Listo para servir",
  entregado: "Entregado",
  pagado: "Pagado",
};

const BADGE_CLASS: Record<string, string> = {
  nuevo: "bg-violet-500/20 text-violet-200 ring-violet-500/35",
  preparando: "bg-amber-500/20 text-amber-200 ring-amber-500/35",
  listo: "bg-emerald-500/20 text-emerald-200 ring-emerald-500/35",
  entregado: "bg-zinc-500/25 text-zinc-200 ring-zinc-500/35",
  pagado: "bg-zinc-600/30 text-zinc-300 ring-zinc-500/35",
};

export function orderStatusLabel(status: string | undefined): string {
  const key = String(status ?? "nuevo").trim() || "nuevo";
  return LABELS[key] ?? key;
}

export function orderStatusBadgeClass(status: string | undefined): string {
  const key = String(status ?? "nuevo").trim() || "nuevo";
  return BADGE_CLASS[key] ?? "bg-mesero-panel/60 text-mesero-text-muted ring-mesero-line/25";
}

const RECEPTION_LABELS: Record<string, string> = {
  nuevo: "Solicitud recibida",
  preparando: "En gestión",
  listo: "Confirmado",
  entregado: "Completado",
  pagado: "Cerrado",
};

export function receptionOrderStatusLabel(status: string | undefined): string {
  const key = String(status ?? "nuevo").trim() || "nuevo";
  return RECEPTION_LABELS[key] ?? orderStatusLabel(status);
}
