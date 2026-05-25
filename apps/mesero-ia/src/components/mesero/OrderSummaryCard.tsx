import { useMemo, useState } from "react";
import type { MenuItem } from "../../lib/types";
import {
  formatMoney,
  mergedActiveLines,
  orderTotal,
  lineSubtotal,
  type ConfirmedBundle,
  type DraftLineInput,
} from "../../lib/orderDisplayLines";
import { orderStatusBadgeClass, orderStatusLabel } from "../../lib/orderStatusLabels";
import { MenuItemImage } from "./MenuItemImage";

type Props = {
  menu: MenuItem[];
  corpus: string;
  pendingDraft?: DraftLineInput[];
  /** Resumen reciente del asistente (para detectar platos mencionados en voz). */
  assistantSummary?: string;
  touchCart?: Record<string, number>;
  confirmed: ConfirmedBundle[];
  busy?: boolean;
  onClearConfirmed?: () => void;
  onClearOrder?: () => void;
  onTouchDelta?: (menuItemId: string, delta: number) => void;
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

function OrderLinesList({
  lines,
  menuById,
}: {
  lines: ReturnType<typeof mergedActiveLines>;
  menuById: Map<string, MenuItem>;
}) {
  return (
    <ul className="space-y-2.5">
      {lines.map((it) => {
        const sub = lineSubtotal(it);
        const m = menuById.get(it.menuItemId);
        return (
          <li key={it.menuItemId} className="flex items-center gap-2.5">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-mesero-muted ring-1 ring-mesero-line/15">
              <MenuItemImage src={m?.imageUrl} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-mesero-text">{it.name}</p>
              <p className="text-xs font-semibold text-mesero-accent">×{it.qty}</p>
            </div>
            {sub != null ? (
              <span className="shrink-0 text-sm tabular-nums text-mesero-text-muted">{formatMoney(sub)}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function OrderSummaryCard({
  menu,
  corpus,
  pendingDraft,
  assistantSummary,
  touchCart,
  confirmed,
  busy,
  onClearConfirmed,
  onClearOrder,
  onTouchDelta,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lines = useMemo(
    () => mergedActiveLines(menu, corpus, touchCart, pendingDraft, assistantSummary),
    [menu, corpus, touchCart, pendingDraft, assistantSummary],
  );
  const total = orderTotal(lines);
  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const hasOrderDraft =
    lines.length > 0 || Boolean(touchCart && Object.keys(touchCart).length > 0) || confirmed.length > 0;

  const queue = useMemo(
    () => [...confirmed].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    [confirmed],
  );

  const showDraftSection = lines.length > 0 || busy || (pendingDraft?.length ?? 0) > 0;

  return (
    <section className="order-summary-panel flex flex-col rounded-2xl border border-mesero-muted bg-mesero-panel p-4">
      <div className="flex items-center gap-2">
        <BagIcon />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-mesero-text-muted">Pedido en curso</h2>
      </div>

      {showDraftSection ? (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-mesero-text-muted">
            Por confirmar
          </p>
          {lines.length > 0 ? (
            <OrderLinesList lines={lines} menuById={menuById} />
          ) : (pendingDraft?.length ?? 0) > 0 ? (
            <ul className="space-y-2.5">
              {pendingDraft!.map((it) => (
                <li key={it.menuItemId} className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-mesero-text">{it.name}</p>
                    <p className="text-xs font-semibold text-mesero-accent">×{it.qty}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : busy ? (
            <p className="text-sm text-mesero-text-muted/80">Escuchando tu pedido…</p>
          ) : (
            <p className="text-sm text-mesero-text-muted/80">Di el plato concreto para verlo aquí.</p>
          )}
          {total != null && lines.length > 0 ? (
            <div className="mt-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wide text-mesero-text-muted">Total estimado</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-mesero-accent">{formatMoney(total)}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-mesero-text-muted/80">Aún no hay artículos en tu pedido.</p>
      )}

      {queue.length > 0 ? (
        <div className={showDraftSection ? "mt-4 border-t border-mesero-line/15 pt-3" : "mt-2"}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-mesero-accent/80">
            {queue.length > 1 ? "En cocina (cola)" : "En cocina"}
          </p>
          <ul className="space-y-2" aria-label="Pedidos enviados a cocina">
            {queue.map((b, index) => (
              <li
                key={b.id}
                className="rounded-lg border border-mesero-line/15 bg-mesero-deep/30 px-2.5 py-2 ring-1 ring-mesero-line/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-mesero-accent/80">
                      {queue.length > 1 ? `Pedido ${index + 1}` : "Confirmado"} · #{b.id.slice(-6)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-mesero-text/90">
                      {b.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${orderStatusBadgeClass(b.status)}`}
                  >
                    {orderStatusLabel(b.status)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="btn-mesero-primary touch-manipulation mt-4 w-full min-h-11 rounded-xl py-2.5 text-sm font-semibold"
      >
        {detailsOpen ? "Ocultar detalles" : "Ver detalles del pedido"}
      </button>
      {onClearOrder && hasOrderDraft ? (
        <button
          type="button"
          onClick={onClearOrder}
          className="btn-mesero-danger touch-manipulation mt-2 w-full min-h-11 rounded-xl py-2.5 text-sm font-semibold"
        >
          Cancelar pedido
        </button>
      ) : null}

      {detailsOpen ? (
        <div className="mt-3 space-y-3 border-t border-mesero-line/10 pt-3 text-xs text-mesero-text-muted/60">
          {confirmed.length > 0 ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-mesero-active">Historial en cocina</span>
                {onClearConfirmed ? (
                  <button type="button" onClick={onClearConfirmed} className="text-mesero-accent hover:text-mesero-accent-strong">
                    Limpiar
                  </button>
                ) : null}
              </div>
              {confirmed.map((b) => (
                <div key={b.id} className="mb-2 rounded-lg bg-mesero-deep px-2 py-1.5 ring-1 ring-mesero-muted">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[10px] tabular-nums text-mesero-text-muted/70">#{b.id.slice(-6)}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${orderStatusBadgeClass(b.status)}`}
                    >
                      {orderStatusLabel(b.status)}
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
