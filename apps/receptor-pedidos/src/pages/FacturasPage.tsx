import { useCallback, useEffect, useState } from "react";
import { emitInvoice } from "../lib/tableBillsApi";
import { fetchInvoices, type Invoice } from "../lib/billingApi";
import { formatMoney } from "../lib/format";

const STATUS_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  AUTORIZADO: "Autorizado",
  DEVUELTA: "Devuelta",
};

export function FacturasPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void fetchInvoices()
      .then(setInvoices)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = globalThis.setInterval(load, 15000);
    return () => globalThis.clearInterval(id);
  }, [load]);

  const handleEmit = (id: string) => {
    setBusyId(id);
    void emitInvoice(id)
      .then(() => load())
      .catch((e) => setError(String(e)))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm text-[var(--theme-text-muted)]">
        Comprobantes generados al cobrar. Las facturas en borrador pueden enviarse al SRI desde aquí.
      </p>

      {error ? (
        <div className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}

      {loading ? <p className="text-zinc-500">Cargando facturas…</p> : null}

      {!loading && invoices.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
          No hay comprobantes aún. Configure el emisor en la pestaña «Configuración del emisor».
        </p>
      ) : null}

      <ul className="space-y-3">
        {invoices.map((inv) => (
          <li key={inv.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-100">
                  {inv.tableLabel || "—"} · {inv.customer?.name || "Cliente"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {inv.billingType === "factura" ? "Factura" : "Consumidor final"} ·{" "}
                  {new Date(inv.createdAt).toLocaleString("es-EC")}
                </p>
                {inv.customer?.identification ? (
                  <p className="text-xs text-zinc-400">
                    {inv.customer.idType}: {inv.customer.identification}
                    {inv.customer.email ? ` · ${inv.customer.email}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums text-amber-400">
                  {inv.total == null ? "—" : formatMoney(inv.total)}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    inv.sriStatus === "AUTORIZADO"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : inv.sriStatus === "DEVUELTA"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-zinc-700 text-zinc-300"
                  }`}
                >
                  {STATUS_LABEL[inv.sriStatus] ?? inv.sriStatus}
                </span>
              </div>
            </div>
            {inv.sriStatus === "BORRADOR" ? (
              <button
                type="button"
                disabled={busyId === inv.id}
                onClick={() => handleEmit(inv.id)}
                className="mt-3 w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busyId === inv.id ? "Enviando al SRI…" : "Emitir y autorizar (SRI)"}
              </button>
            ) : null}
            {inv.authorizationNumber ? (
              <p className="mt-2 text-xs text-zinc-500">Autorización: {inv.authorizationNumber}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
