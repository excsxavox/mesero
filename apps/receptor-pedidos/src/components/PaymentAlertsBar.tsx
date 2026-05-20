import { Link } from "react-router-dom";
import type { TableBill } from "../lib/tableBillTypes";
import { formatMoney } from "../lib/format";

type Props = {
  bills: TableBill[];
};

export function PaymentAlertsBar({ bills }: Props) {
  const alerts = bills.filter((b) => b.paymentRequested && (b.itemCount > 0 || (b.total ?? 0) > 0));
  const open = bills.filter((b) => b.itemCount > 0 && !b.paymentRequested);

  if (alerts.length === 0 && open.length === 0) return null;

  return (
    <section className="space-y-2">
      {alerts.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-3 ring-1 ring-amber-500/20">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <h2 className="text-sm font-semibold text-amber-200">Cuenta solicitada — cobrar</h2>
          </div>
          <ul className="flex flex-wrap gap-2">
            {alerts.map((b) => (
              <li key={b.tableNumber}>
                <Link
                  to={`/mesa/${b.tableNumber}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-900/30 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/50"
                >
                  <span>{b.tableLabel}</span>
                  {b.billingType === "factura" ? (
                    <span className="rounded bg-violet-600/40 px-1.5 py-0.5 text-[10px] text-violet-200">
                      Factura
                    </span>
                  ) : b.billingType === "consumidor_final" ? (
                    <span className="rounded bg-zinc-600/40 px-1.5 py-0.5 text-[10px] text-zinc-300">CF</span>
                  ) : null}
                  {b.total != null ? (
                    <span className="tabular-nums text-amber-300">{formatMoney(b.total)}</span>
                  ) : (
                    <span className="text-amber-400/80">{b.itemCount} artículos</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-400">Cuentas abiertas:</span>
          {open.map((b) => (
            <Link
              key={b.tableNumber}
              to={`/mesa/${b.tableNumber}`}
              className="rounded-md border border-zinc-700/80 bg-zinc-900/60 px-2 py-1 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
            >
              {b.tableLabel}
              {b.total != null ? ` · ${formatMoney(b.total)}` : ""}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
