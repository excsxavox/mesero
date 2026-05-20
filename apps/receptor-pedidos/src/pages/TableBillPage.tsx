import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { emitInvoice, fetchTableBill, markTablePaid } from "../lib/tableBillsApi";
import type { TableBill } from "../lib/tableBillTypes";
import { formatMoney } from "../lib/format";

export function TableBillPage() {
  const { tableNum } = useParams();
  const num = Number(tableNum);
  const [bill, setBill] = useState<TableBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!Number.isFinite(num) || num < 1) {
      setError("Mesa no válida");
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchTableBill(num)
      .then(setBill)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [num]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const handlePaid = () => {
    setBusy(true);
    const emitNow = bill?.billingType !== "factura";
    void markTablePaid(num, { emitInvoice: emitNow })
      .then((res) => {
        if (bill?.billingType === "factura" && res.invoice?.id) {
          return emitInvoice(res.invoice.id).catch(() => undefined);
        }
      })
      .then(() => load())
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false));
  };

  const label = bill?.tableLabel ?? `Mesa ${num}`;

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Volver
        </Link>
        {bill?.paymentRequested ? (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Cuenta solicitada
          </span>
        ) : null}
      </div>

      <header className="text-center">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Cuenta</p>
        <h1 className="mt-1 text-4xl font-bold text-zinc-50">{label}</h1>
      </header>

      {loading ? <p className="text-center text-zinc-500">Cargando cuenta…</p> : null}
      {error ? (
        <div className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}

      {bill && !loading ? (
        <>
          {bill.lines.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center text-zinc-500">
              No hay consumo pendiente en esta mesa.
            </p>
          ) : (
            <ul className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              {bill.lines.map((line) => (
                <li
                  key={`${line.menuItemId}-${line.name}`}
                  className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100">
                      <span className="text-amber-400">{line.qty}×</span> {line.name}
                    </p>
                    {line.notes?.length ? (
                      <p className="mt-0.5 text-xs text-zinc-500">{line.notes.join(" · ")}</p>
                    ) : null}
                  </div>
                  {line.lineTotal != null ? (
                    <span className="shrink-0 tabular-nums text-zinc-300">{formatMoney(line.lineTotal)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {bill.billingType || bill.billingCustomer ? (
            <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 text-sm text-violet-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">
                Datos de facturación
              </p>
              <p className="mt-2">
                {bill.billingType === "factura" ? "Factura electrónica" : "Consumidor final"}
              </p>
              {bill.billingCustomer?.name ? (
                <p className="mt-1 text-zinc-300">
                  {bill.billingCustomer.name}
                  {bill.billingCustomer.identification
                    ? ` · ${bill.billingCustomer.identification}`
                    : ""}
                </p>
              ) : null}
              {bill.billingCustomer?.email ? (
                <p className="text-zinc-400">{bill.billingCustomer.email}</p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5 text-center ring-1 ring-amber-500/20">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-400/80">Total a pagar</p>
            <p className="mt-2 text-4xl font-bold tabular-nums text-amber-400">
              {bill.total != null ? formatMoney(bill.total) : "—"}
            </p>
            {bill.orderIds.length > 0 ? (
              <p className="mt-2 text-xs text-zinc-500">
                {bill.orderIds.length} pedido{bill.orderIds.length === 1 ? "" : "s"} en cuenta
              </p>
            ) : null}
          </div>

          {bill.lines.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={handlePaid}
              className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Guardando…" : "✓ Marcar como pagado"}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
