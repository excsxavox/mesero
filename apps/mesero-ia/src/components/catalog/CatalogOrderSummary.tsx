import { formatMoney } from "../../lib/orderDisplayLines";

type Props = {
  itemCount: number;
  total: number | null;
};

function BasketIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" aria-hidden>
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

/** Resumen del pedido actual: solo informativo, no es clicable. */
export function CatalogOrderSummary({ itemCount, total }: Props) {
  const totalLabel = total != null ? formatMoney(total) : formatMoney(0);
  const countLabel = itemCount > 0 ? `(${itemCount})` : "";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={
        itemCount > 0
          ? `Pedido en curso: ${itemCount} artículos, total ${totalLabel}`
          : "Pedido en curso vacío"
      }
      className="flex shrink-0 items-center gap-2.5 rounded-xl border border-mesero-line/15 bg-mesero-elevated/95 px-3 py-2"
    >
      <BasketIcon />
      <div className="min-w-0 text-left leading-tight">
        <p className="whitespace-nowrap text-xs font-medium text-mesero-text">
          Mi pedido {countLabel}
        </p>
        <p className="text-sm font-bold text-amber-400">{totalLabel}</p>
      </div>
    </div>
  );
}
