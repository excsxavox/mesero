import { COPY, formatStationLabel } from "../../lib/receptionCopy";
import { formatTableLabel } from "../../lib/tables";

type Props = {
  tableCount: number;
  selectedTable: number | null;
  onSelect: (table: number) => void;
  disabled?: boolean;
  /** Estilo del panel: recepción, quiosco mesero o administración (zinc). */
  variant?: "reception" | "mesero" | "admin";
};

export function TableSelector({
  tableCount,
  selectedTable,
  onSelect,
  disabled,
  variant = "reception",
}: Props) {
  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);
  const isAdmin = variant === "admin";
  const isReception = variant === "reception" || variant === "admin";
  const fmt = (n: number) => (isReception ? formatStationLabel(n) : formatTableLabel(n));

  return (
    <section
      className={
        isAdmin
          ? "rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-3"
          : "mb-3 rounded-xl border border-mesero-line/20 bg-mesero-deep/25 px-3 py-3 ring-1 ring-mesero-line/10"
      }
      aria-label={isReception ? "Selección de mostrador" : "Selección de mesa"}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          className={
            isAdmin
              ? "text-xs font-semibold uppercase tracking-wide text-zinc-400"
              : "text-[11px] font-semibold uppercase tracking-wide text-blue-200/90"
          }
        >
          {isAdmin ? COPY.stationAdminTitle : isReception ? COPY.stationTitle : "Tu mesa"}
        </h2>
        {selectedTable ? (
          <span
            className={
              isAdmin ? "text-xs font-medium text-amber-400/95" : "text-xs font-medium text-amber-300/95"
            }
          >
            {fmt(selectedTable)}
          </span>
        ) : (
          <span className={isAdmin ? "text-xs text-zinc-500" : "text-xs text-mesero-accent/70"}>
            {isAdmin ? COPY.stationAdminHint : isReception ? COPY.stationHint : "Elige antes de pedir"}
          </span>
        )}
      </div>
      <div className="mt-2 max-h-40 overflow-y-auto overscroll-y-contain pr-0.5">
        <div className="flex flex-wrap gap-1.5">
          {tables.map((n) => {
            const active = selectedTable === n;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => onSelect(n)}
                className={`touch-manipulation min-h-9 min-w-[2.5rem] rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? isAdmin
                      ? "bg-amber-500 text-zinc-950 shadow-sm"
                      : "bg-gradient-to-r from-mesero-accent to-teal-600 text-white shadow-md shadow-mesero-deep/40"
                    : isAdmin
                      ? "border border-zinc-600 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                      : "border border-mesero-line/25 bg-zinc-950/60 text-mesero-text/90 hover:border-mesero-accent/40 hover:bg-mesero-panel/35"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
