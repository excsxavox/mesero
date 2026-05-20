import { useMemo, useState } from "react";
import type { MenuItem } from "../../lib/types";
import {
  formatMoney,
  mergedActiveLines,
  orderTotal,
  lineSubtotal,
  type ConfirmedBundle,
} from "../../lib/orderDisplayLines";
import { COPY } from "../../lib/receptionCopy";
import { orderStatusBadgeClass, orderStatusLabel, receptionOrderStatusLabel } from "../../lib/orderStatusLabels";

type Props = {
  menu: MenuItem[];
  corpus: string;
  touchCart?: Record<string, number>;
  confirmed: ConfirmedBundle[];
  onClearConfirmed?: () => void;
  onClearOrder?: () => void;
  onTouchDelta?: (menuItemId: string, delta: number) => void;
  variant?: "reception" | "mesero";
};

function BagIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-mesero-text-muted" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8h15l-1.5 9H7.5L6 8ZM6 8 5 4H2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function OrderSummaryCard({
  menu,
  corpus,
  touchCart,
  confirmed,
  onClearConfirmed,
  onClearOrder,
  onTouchDelta,
  variant = "reception",
}: Props) {
  const reception = variant === "reception";
  const statusLabel = reception ? receptionOrderStatusLabel : orderStatusLabel;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lines = useMemo(() => mergedActiveLines(menu, corpus, touchCart), [menu, corpus, touchCart]);
  const total = orderTotal(lines);
  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const hasOrderDraft =
    lines.length > 0 || Boolean(touchCart && Object.keys(touchCart).length > 0) || confirmed.length > 0;

  const queue = useMemo(
    () => [...confirmed].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    [confirmed],
  );

  return (
    <section className="flex flex-col rounded-2xl border border-mesero-line/15 bg-mesero-panel/90 p-4 ring-1 ring-mesero-line/10">
      <div className="flex items-center gap-2">
        <BagIcon />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-mesero-text-muted">
          {reception
            ? queue.length > 1
              ? COPY.bookingQueue
              : COPY.bookingTitle
            : queue.length > 1
              ? "Cola de pedidos"
              : "Pedido en curso"}
        </h2>
      </div>

      {queue.length > 0 ? (
        <ul className="mt-2 space-y-2" aria-label={reception ? "Solicitudes registradas" : "Pedidos enviados a cocina"}>
          {queue.map((b, index) => (
            <li
              key={b.id}
              className="rounded-lg border border-mesero-line/15 bg-mesero-deep/30 px-2.5 py-2 ring-1 ring-mesero-line/10"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-mesero-accent/80">
                    {reception
                      ? queue.length > 1
                        ? `Solicitud ${index + 1}`
                        : "En gestión"
                      : queue.length > 1
                        ? `Pedido ${index + 1} en cola`
                        : "En cocina"}{" "}
                    · #{b.id.slice(-6)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-mesero-text/90">
                    {b.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${orderStatusBadgeClass(b.status)}`}
                >
                  {statusLabel(b.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-mesero-text-muted/80">
          {reception ? COPY.bookingEmpty : "Aún no hay artículos detectados."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {lines.map((it) => {
            const sub = lineSubtotal(it);
            const m = menuById.get(it.menuItemId);
            const img = (m?.imageUrl ?? "").trim();
            return (
              <li key={it.menuItemId} className="flex items-center gap-2.5">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-mesero-muted ring-1 ring-mesero-line/15">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-mesero-accent/35">{reception ? "🏝️" : "🍽️"}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-mesero-text">{it.name}</p>
                  <p className="text-xs font-semibold text-amber-400">×{it.qty}</p>
                </div>
                {sub != null ? (
                  <span className="shrink-0 text-sm tabular-nums text-blue-200/85">{formatMoney(sub)}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {total != null && lines.length > 0 ? (
        <div className="mt-4 text-center">
          <p className="text-[11px] font-medium uppercase tracking-wide text-mesero-accent/65">Total estimado</p>
          <p className="mt-0.5 text-3xl font-bold tabular-nums text-amber-400">{formatMoney(total)}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="touch-manipulation mt-4 w-full min-h-11 rounded-xl border border-mesero-line/25 bg-mesero-panel/50 py-2.5 text-sm font-medium text-mesero-text hover:bg-mesero-panel/40"
      >
          {detailsOpen ? "Ocultar detalles" : reception ? "Ver detalles de la reserva" : "Ver detalles del pedido"}
      </button>
      {onClearOrder && hasOrderDraft ? (
        <button
          type="button"
          onClick={onClearOrder}
          className="touch-manipulation mx-auto mt-1.5 block px-1 py-0.5 text-[11px] font-medium text-red-400/75 underline-offset-2 hover:text-red-300 hover:underline"
        >
          {reception ? "Limpiar selección" : "Limpiar orden"}
        </button>
      ) : null}

      {detailsOpen ? (
        <div className="mt-3 space-y-3 border-t border-mesero-line/10 pt-3 text-xs text-mesero-text-muted/60">
          {confirmed.length > 0 ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-emerald-400/90">
                  {reception ? "Solicitudes registradas" : "Pedidos en cocina"}
                </span>
                {onClearConfirmed ? (
                  <button type="button" onClick={onClearConfirmed} className="text-mesero-accent hover:text-blue-200">
                    Limpiar
                  </button>
                ) : null}
              </div>
              {confirmed.map((b) => (
                <div key={b.id} className="mb-2 rounded-lg bg-emerald-950/20 px-2 py-1.5 ring-1 ring-emerald-900/30">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[10px] tabular-nums text-mesero-text-muted/70">#{b.id.slice(-6)}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${orderStatusBadgeClass(b.status)}`}
                    >
                      {statusLabel(b.status)}
                    </span>
                  </div>
                  {b.items.map((it) => (
                    <div key={`${b.id}-${it.menuItemId}`}>
                      {it.qty}× {it.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
          {onTouchDelta && touchCart && Object.keys(touchCart).length > 0 ? (
            <p>Ajusta cantidades en el panel avanzado si lo necesitas el personal.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

