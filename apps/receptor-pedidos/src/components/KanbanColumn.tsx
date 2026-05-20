import type { KanbanStatus, Order } from "../lib/types";
import { OrderCard } from "./OrderCard";

const COL_META: Record<
  KanbanStatus,
  { title: string; badge: string; headerBorder: string; headerBg: string }
> = {
  nuevo: {
    title: "NUEVOS",
    badge: "bg-violet-600 text-white",
    headerBorder: "border-violet-500/30",
    headerBg: "bg-violet-950/20",
  },
  preparando: {
    title: "EN PREPARACIÓN",
    badge: "bg-amber-600 text-white",
    headerBorder: "border-amber-500/30",
    headerBg: "bg-amber-950/20",
  },
  listo: {
    title: "LISTOS",
    badge: "bg-emerald-600 text-white",
    headerBorder: "border-emerald-500/30",
    headerBg: "bg-emerald-950/20",
  },
};

type Props = {
  status: KanbanStatus;
  orders: Order[];
  now: number;
  prices: Map<string, number>;
  onAdvance: (id: string, next: string) => void;
};

export function KanbanColumn({ status, orders, now, prices, onAdvance }: Props) {
  const meta = COL_META[status];

  return (
    <section
      className={`flex h-full min-h-[200px] flex-col rounded-xl border ${meta.headerBorder} bg-[var(--panel-card)]/55 ring-1 ring-[var(--panel-border)]/80`}
    >
      <header
        className={`flex items-center justify-between gap-2 rounded-t-xl border-b px-3 py-2.5 ${meta.headerBorder} ${meta.headerBg}`}
      >
        <h2 className="text-xs font-bold tracking-wide text-zinc-200">{meta.title}</h2>
        <span className={`min-w-[1.5rem] rounded-md px-2 py-0.5 text-center text-xs font-bold ${meta.badge}`}>
          {orders.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {orders.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            column={status}
            now={now}
            prices={prices}
            onAdvance={onAdvance}
          />
        ))}
        {orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-600">Sin pedidos en esta columna.</p>
        ) : null}
      </div>
    </section>
  );
}
