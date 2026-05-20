import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DateRangeFilters } from "../components/panel/DateRangeFilters";
import { fetchPaymentHistory } from "../lib/analyticsApi";
import type { PaymentHistoryEntry } from "../lib/analyticsTypes";
import { clampDateRange, daysAgoIso, todayIso } from "../lib/dateRange";
import { formatDateRangeLabel, formatMoney } from "../lib/format";

export function PaymentHistoryPage() {
  const [items, setItems] = useState<PaymentHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [dateFrom, setDateFrom] = useState(() => daysAgoIso(30));
  const [dateTo, setDateTo] = useState(() => todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetchPaymentHistory(100, 0, { from: dateFrom, to: dateTo })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  const periodLabel = formatDateRangeLabel(dateFrom, dateTo);

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Historial de pedidos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cada vez que marcas una mesa como pagada en cocina, queda registrada aquí con detalle de
            productos.
            {periodLabel ? (
              <span className="mt-1 block text-zinc-600">Periodo: {periodLabel}</span>
            ) : null}
          </p>
        </div>
        <DateRangeFilters from={dateFrom} to={dateTo} onFromChange={setFrom} onToChange={setTo} />
      </header>

      {loading ? <p className="text-sm text-zinc-500">Cargando historial…</p> : null}
      {error ? (
        <div className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-500">
          No hay cuentas cobradas en el periodo seleccionado. Prueba ampliando el rango de fechas.
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((entry) => {
          const open = expanded === entry.id;
          return (
            <li
              key={entry.id}
              className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)] ring-1 ring-zinc-800/80"
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? null : entry.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div>
                  <p className="font-semibold text-zinc-100">{entry.tableLabel}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(entry.paidAt).toLocaleString("es")} · {entry.itemCount} artículos ·{" "}
                    {entry.orderIds.length} pedido{entry.orderIds.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  {entry.total != null ? (
                    <p className="text-lg font-bold tabular-nums text-emerald-400">
                      {formatMoney(entry.total)}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-500">Sin total</p>
                  )}
                  <p className="text-[11px] text-zinc-500">{open ? "Ocultar" : "Ver detalle"}</p>
                </div>
              </button>
              {open ? (
                <ul className="border-t border-zinc-800 px-4 py-3 space-y-2">
                  {entry.lines.map((line) => (
                    <li
                      key={`${entry.id}-${line.menuItemId}-${line.name}`}
                      className="flex justify-between gap-2 text-sm"
                    >
                      <span className="text-zinc-300">
                        <span className="font-semibold text-amber-400/90">{line.qty}×</span>{" "}
                        {line.name}
                      </span>
                      {line.lineTotal != null ? (
                        <span className="shrink-0 tabular-nums text-zinc-400">
                          {formatMoney(line.lineTotal)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {total > items.length ? (
        <p className="text-center text-xs text-zinc-600">
          Mostrando {items.length} de {total} registros en el periodo
        </p>
      ) : null}

      <p className="text-center">
        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Volver al resumen
        </Link>
      </p>
    </div>
  );
}
