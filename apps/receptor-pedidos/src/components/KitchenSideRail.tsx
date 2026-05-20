import { Link } from "react-router-dom";
import type { TableBill } from "../lib/tableBillTypes";
import { formatElapsed, formatMoneyUsd } from "../lib/format";

type Props = {
  bills: TableBill[];
  inView: number;
  preparing: number;
  ready: number;
  delivered: number;
  avgPrepMs: number | null;
  topProductName?: string;
  topProductUnits?: number;
  daySales?: number;
};

export function KitchenSideRail({
  bills,
  inView,
  preparing,
  ready,
  delivered,
  avgPrepMs,
  topProductName,
  topProductUnits,
  daySales,
}: Props) {
  const alerts = bills.filter((b) => b.paymentRequested && b.itemCount > 0);
  const open = bills.filter((b) => b.itemCount > 0 && !b.paymentRequested);

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col gap-3 lg:w-72 xl:w-80">
      {alerts.length > 0 ? (
        <section className="rounded-xl border border-amber-500/35 bg-amber-950/20 p-3 ring-1 ring-amber-500/15">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-amber-200">Cobrar ahora</h2>
          </div>
          <ul className="max-h-[140px] space-y-1.5 overflow-y-auto">
            {alerts.map((b) => (
              <li key={b.tableNumber}>
                <Link
                  to={`/mesa/${b.tableNumber}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-900/25 px-3 py-2 text-sm hover:bg-amber-900/40"
                >
                  <span className="font-medium text-amber-100">{b.tableLabel}</span>
                  <span className="shrink-0 tabular-nums text-amber-300">
                    {b.total != null ? formatMoneyUsd(b.total) : `${b.itemCount} uds.`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)]">
        <header className="border-b border-[var(--panel-border)] px-3 py-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-400">Cuentas abiertas</h2>
        </header>
        <ul className="min-h-[120px] flex-1 space-y-1 overflow-y-auto p-2">
          {open.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-zinc-600">Sin consumo pendiente en mesas</li>
          ) : (
            open.map((b) => (
              <li key={b.tableNumber}>
                <Link
                  to={`/mesa/${b.tableNumber}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-300 hover:bg-zinc-800/60"
                >
                  <span>{b.tableLabel}</span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {b.total != null ? formatMoneyUsd(b.total) : `${b.itemCount} art.`}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)] p-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Hoy</h2>
        {daySales != null && daySales > 0 ? (
          <p className="mt-1 text-lg font-bold tabular-nums text-emerald-400">{formatMoneyUsd(daySales)}</p>
        ) : (
          <p className="mt-1 text-sm text-zinc-600">Sin cobros hoy</p>
        )}
        {topProductName && topProductName !== "—" ? (
          <p className="mt-2 truncate text-xs text-zinc-400">
            Más vendido: <span className="text-zinc-200">{topProductName}</span>
            {topProductUnits ? ` (${topProductUnits})` : ""}
          </p>
        ) : null}
        <Link to="/" className="mt-2 block text-xs font-medium text-violet-400 hover:text-violet-300">
          Ver panel completo →
        </Link>
      </section>

      <section className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)] p-3">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Sesión cocina</h2>
        <div className="grid grid-cols-2 gap-2 text-center">
          <MiniStat label="En cocina" value={inView} className="text-amber-400" />
          <MiniStat label="Preparando" value={preparing} className="text-amber-500" />
          <MiniStat label="Listos" value={ready} className="text-emerald-400" />
          <MiniStat label="Entregados" value={delivered} className="text-zinc-400" />
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          Tiempo prom.{" "}
          <span className="font-semibold tabular-nums text-sky-300">
            {avgPrepMs != null ? formatElapsed(avgPrepMs) : "—"}
          </span>
        </p>
      </section>
    </aside>
  );
}

function MiniStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-lg bg-zinc-900/50 px-1 py-1.5">
      <p className={`text-lg font-bold tabular-nums leading-none ${className}`}>{value}</p>
      <p className="mt-0.5 text-[9px] leading-tight text-zinc-600">{label}</p>
    </div>
  );
}
