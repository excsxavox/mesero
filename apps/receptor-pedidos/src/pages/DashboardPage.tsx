import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DateRangeFilters } from "../components/panel/DateRangeFilters";
import { fetchDashboard } from "../lib/analyticsApi";
import type { DashboardData } from "../lib/dashboardTypes";
import { clampDateRange, todayIso } from "../lib/dateRange";
import { formatDateRangeLabel, formatMoneyUsd, formatPct } from "../lib/format";

function productEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/hamburg|burger/.test(n)) return "🍔";
  if (/pizza/.test(n)) return "🍕";
  if (/coca|cola|bebida/.test(n)) return "🥤";
  if (/papa|frita/.test(n)) return "🍟";
  if (/combo/.test(n)) return "🍱";
  return "🍽️";
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [dateFrom, setDateFrom] = useState(() => todayIso());
  const [dateTo, setDateTo] = useState(() => todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periodLabel = useMemo(
    () => formatDateRangeLabel(dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  const comparisonLabel = dateFrom === dateTo ? "ayer" : "periodo anterior";

  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetchDashboard({ from: dateFrom, to: dateTo })
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  const setFrom = (v: string) => {
    const next = clampDateRange(v, dateTo);
    setDateFrom(next.from);
    setDateTo(next.to);
  };
  const setTo = (v: string) => {
    const next = clampDateRange(dateFrom, v);
    setDateFrom(next.from);
    setDateTo(next.to);
  };

  const maxBar = useMemo(
    () => Math.max(1, ...(data?.topProducts.map((p) => p.qtySold) ?? [1])),
    [data],
  );
  const maxHour = useMemo(
    () => Math.max(1, ...(data?.salesByHour.map((h) => h.total) ?? [1])),
    [data],
  );

  const prepChangeLabel = useMemo(() => {
    const ms = data?.metrics.avgPrepTimeChangeMs;
    if (ms == null || !data?.metrics.avgPrepTime) return null;
    const sign = ms <= 0 ? "−" : "+";
    const sec = Math.abs(Math.round(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} vs ${comparisonLabel}`;
  }, [data, comparisonLabel]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Productos más vendidos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Resumen de ventas y pedidos de tu restaurante
          </p>
        </div>
        <DateRangeFilters from={dateFrom} to={dateTo} onFromChange={setFrom} onToChange={setTo} />
      </header>

      {loading ? <p className="text-zinc-500">Cargando panel…</p> : null}
      {error ? <div className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div> : null}

      {data ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={dateFrom === dateTo ? "Ventas totales (día)" : "Ventas totales (periodo)"}
              value={formatMoneyUsd(data.metrics.totalSales)}
              change={formatPct(data.metrics.totalSalesChangePct)}
              positive={data.metrics.totalSalesChangePct >= 0}
              comparisonLabel={comparisonLabel}
            />
            <MetricCard
              label="Pedidos cobrados"
              value={String(data.metrics.paidOrders)}
              change={formatPct(data.metrics.paidOrdersChangePct)}
              positive={data.metrics.paidOrdersChangePct >= 0}
              comparisonLabel={comparisonLabel}
            />
            <MetricCard
              label="Producto más vendido"
              value={data.metrics.topProductName}
              sub={`${data.metrics.topProductUnits} unidades`}
              positive
            />
            <MetricCard
              label="Tiempo prom. preparación"
              value={data.metrics.avgPrepTime ?? "—"}
              change={prepChangeLabel ?? undefined}
              positive={data.metrics.avgPrepTimeChangeMs != null && data.metrics.avgPrepTimeChangeMs <= 0}
            />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-5">
            <section className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)] p-5 lg:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-zinc-100">Productos más vendidos</h2>
                <span className="text-xs text-zinc-500">Por unidades · {periodLabel}</span>
              </div>
              {data.topProducts.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-600">Sin ventas cobradas en el periodo</p>
              ) : (
                <div className="flex items-end justify-between gap-2 sm:gap-4" style={{ minHeight: 220 }}>
                  {data.topProducts.slice(0, 5).map((p) => {
                    const h = Math.max(12, Math.round((p.qtySold / maxBar) * 180));
                    return (
                      <div key={p.menuItemId} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-amber-400">{p.qtySold}</span>
                        <div
                          className="w-full max-w-[4.5rem] rounded-t-lg bg-gradient-to-t from-amber-700 to-amber-400"
                          style={{ height: h }}
                        />
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-lg ring-1 ring-zinc-700">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            productEmoji(p.name)
                          )}
                        </div>
                        <p className="line-clamp-2 text-center text-[10px] leading-tight text-zinc-500">
                          {p.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)] p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-zinc-100">Ventas por hora</h2>
                <span className="text-xs text-zinc-500">{periodLabel}</span>
              </div>
              <div className="relative flex items-end gap-1" style={{ height: 200 }}>
                {data.salesByHour.map((h) => {
                  const pct = h.total / maxHour;
                  return (
                    <div key={h.hour} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <div
                        className="w-full rounded-t bg-violet-600/80"
                        style={{ height: `${Math.max(4, pct * 160)}px` }}
                      />
                      <span className="text-[9px] text-zinc-600">{h.hour}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)] lg:col-span-2">
              <div className="flex items-center justify-between border-b border-[var(--panel-border)] px-5 py-4">
                <h2 className="font-semibold text-zinc-100">Historial de pagos</h2>
                <Link to="/historial" className="text-xs font-medium text-violet-400 hover:text-violet-300">
                  Ver todas las transacciones →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-zinc-900/50 text-[11px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Mesa</th>
                      <th className="px-4 py-3">Fecha y hora</th>
                      <th className="px-4 py-3">Productos</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Método</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.paymentRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-zinc-600">
                          No hay cobros en el periodo seleccionado
                        </td>
                      </tr>
                    ) : (
                      data.paymentRows.map((row) => (
                        <tr key={row.id} className="border-t border-[var(--panel-border)]/60 text-zinc-300">
                          <td className="px-4 py-3 font-medium text-zinc-100">{row.orderLabel}</td>
                          <td className="px-4 py-3">{row.tableLabel}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                            {new Date(row.paidAt).toLocaleString("es", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="max-w-[12rem] truncate px-4 py-3 text-zinc-500">
                            {row.productsSummary}
                          </td>
                          <td className="px-4 py-3 font-medium tabular-nums text-zinc-100">
                            {row.total != null ? formatMoneyUsd(row.total) : "—"}
                          </td>
                          <td className="px-4 py-3 capitalize text-zinc-500">{row.paymentMethod}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-md bg-emerald-950/50 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-800/50">
                              Pagado
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)] p-5">
              <h2 className="mb-4 font-semibold text-zinc-100">
                {dateFrom === dateTo ? "Resumen del día" : "Resumen del periodo"}
              </h2>
              <ul className="space-y-3 text-sm">
                <SummaryRow label="Pedidos totales" value={String(data.daySummary.totalOrders)} />
                <SummaryRow label="Unidades vendidas" value={String(data.daySummary.unitsSold)} />
                <SummaryRow label="Ventas totales" value={formatMoneyUsd(data.daySummary.totalSales)} />
                <SummaryRow label="Ticket promedio" value={formatMoneyUsd(data.daySummary.averageTicket)} />
                <SummaryRow label="Clientes atendidos" value={String(data.daySummary.customersServed)} />
              </ul>
              <Link
                to="/cocina"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Ir a pedidos en vivo
                {data.live.ordersInKitchen > 0 ? (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{data.live.ordersInKitchen}</span>
                ) : null}
              </Link>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  change,
  positive,
  comparisonLabel = "ayer",
}: {
  label: string;
  value: string;
  sub?: string;
  change?: string;
  positive?: boolean;
  comparisonLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-zinc-50">{value}</p>
      {sub ? <p className="text-xs text-zinc-500">{sub}</p> : null}
      {change ? (
        <p className={`mt-1 text-xs font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {change} vs {comparisonLabel}
        </p>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-2 border-b border-[var(--panel-border)]/50 pb-2 last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium tabular-nums text-zinc-200">{value}</span>
    </li>
  );
}
