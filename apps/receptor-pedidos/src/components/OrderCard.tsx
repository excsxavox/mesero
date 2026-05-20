import type { KanbanStatus, Order } from "../lib/types";
import { formatClock, formatElapsed, formatMoney, orderShortId, sourceLabel, tableLabel } from "../lib/format";
import { orderTotal } from "../lib/api";

const COLUMN_THEME: Record<
  KanbanStatus,
  {
    accent: string;
    accentText: string;
    border: string;
    btn: string;
    btnHover: string;
    progress: string;
  }
> = {
  nuevo: {
    accent: "text-violet-400",
    accentText: "text-violet-300",
    border: "border-violet-500/25 ring-violet-500/10",
    btn: "bg-violet-600 hover:bg-violet-500",
    btnHover: "",
    progress: "bg-violet-500",
  },
  preparando: {
    accent: "text-amber-400",
    accentText: "text-amber-300",
    border: "border-amber-500/25 ring-amber-500/10",
    btn: "bg-amber-600 hover:bg-amber-500",
    btnHover: "",
    progress: "bg-amber-500",
  },
  listo: {
    accent: "text-emerald-400",
    accentText: "text-emerald-300",
    border: "border-emerald-500/25 ring-emerald-500/10",
    btn: "bg-emerald-600 hover:bg-emerald-500",
    btnHover: "",
    progress: "bg-emerald-500",
  },
};

const ACTION: Record<KanbanStatus, { next: string; label: string }> = {
  nuevo: { next: "preparando", label: "→ Iniciar preparación" },
  preparando: { next: "listo", label: "✓ Marcar como listo" },
  listo: { next: "entregado", label: "🔔 Entregar pedido" },
};

type Props = {
  order: Order;
  column: KanbanStatus;
  now: number;
  prices: Map<string, number>;
  onAdvance: (id: string, next: string) => void;
};

function itemIcon(name: string): string {
  const n = name.toLowerCase();
  if (/coca|cola|refresco|agua|limonada|bebida|cerveza/.test(n)) return "🥤";
  if (/hamburg|burger|carne/.test(n)) return "🍔";
  if (/pizza/.test(n)) return "🍕";
  if (/café|cafe/.test(n)) return "☕";
  if (/postre|helado|flan/.test(n)) return "🍰";
  return "🍽️";
}

export function OrderCard({ order, column, now, prices, onAdvance }: Props) {
  const theme = COLUMN_THEME[column];
  const action = ACTION[column];
  const total = orderTotal(order.items, prices);
  const anchor = order.statusChangedAt ?? order.createdAt;
  const elapsedMs = now - new Date(anchor).getTime();
  const prepTargetMs = 5 * 60 * 1000;
  const progressPct =
    column === "preparando" ? Math.min(100, Math.round((elapsedMs / prepTargetMs) * 100)) : 0;

  return (
    <article
      className={`rounded-xl border bg-[var(--theme-elevated)]/85 p-3.5 shadow-lg ring-1 ${theme.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-medium tabular-nums ${theme.accent}`}>
          {formatClock(order.createdAt)}
        </span>
        <span className={`text-sm font-semibold ${theme.accentText}`}>{tableLabel(order.table)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-zinc-50">Pedido #{orderShortId(order.id)}</h3>
        <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 ring-1 ring-zinc-700/80">
          {sourceLabel(order.source)}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {order.items.map((it) => (
          <li key={`${order.id}-${it.menuItemId}`} className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="text-base" aria-hidden>
              {itemIcon(it.name)}
            </span>
            <span>
              <span className="font-semibold text-zinc-100">{it.qty}x</span> {it.name}
            </span>
          </li>
        ))}
      </ul>

      {total != null ? (
        <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2 text-sm">
          <span className="text-zinc-500">Total</span>
          <span className="font-semibold tabular-nums text-zinc-100">{formatMoney(total)}</span>
        </div>
      ) : null}

      {column === "preparando" ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Tiempo transcurrido</span>
            <span className="font-bold tabular-nums text-amber-400">{formatElapsed(elapsedMs)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${theme.progress}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      ) : null}

      {column === "listo" ? (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-zinc-500">Listo desde</span>
          <span className="font-bold tabular-nums text-emerald-400">{formatElapsed(elapsedMs)}</span>
        </div>
      ) : null}

      {order.notes?.trim() ? (
        <p className="mt-2 text-xs text-amber-200/80">Nota: {order.notes.trim()}</p>
      ) : null}

      <button
        type="button"
        onClick={() => onAdvance(order.id, action.next)}
        className={`touch-manipulation mt-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white ${theme.btn}`}
      >
        {action.label}
      </button>
    </article>
  );
}
