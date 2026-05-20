import { formatTableLabel } from "../../lib/tables";

type Props = {
  tableCount: number;
  selectedTable: number | null;
  onSelect: (table: number) => void;
  disabled?: boolean;
  /** Estilo del panel: quiosco (violeta) o administración (zinc). */
  variant?: "mesero" | "admin";
};

export function TableSelector({
  tableCount,
  selectedTable,
  onSelect,
  disabled,
  variant = "mesero",
}: Props) {
  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);
  const isAdmin = variant === "admin";

  return (
    <section
      className={
        isAdmin
          ? "rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-3"
          : "mb-3 rounded-xl border border-mesero-line/20 bg-mesero-deep/25 px-3 py-3 ring-1 ring-mesero-line/10"
      }
      aria-label="Selección de mesa"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          className={
            isAdmin
              ? "text-xs font-semibold uppercase tracking-wide text-zinc-400"
              : "text-[11px] font-semibold uppercase tracking-wide text-blue-200/90"
          }
        >
          {isAdmin ? "Mesa del quiosco" : "Tu mesa"}
        </h2>
        {selectedTable ? (
          <span
            className={
              isAdmin ? "text-xs font-medium text-amber-400/95" : "text-xs font-medium text-amber-300/95"
            }
          >
            {formatTableLabel(selectedTable)}
          </span>
        ) : (
          <span className={isAdmin ? "text-xs text-zinc-500" : "text-xs text-mesero-accent/70"}>
            {isAdmin ? "Sin asignar" : "Elige antes de pedir"}
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
                      : "bg-gradient-to-r from-mesero-accent to-blue-600 text-white shadow-md shadow-mesero-deep/40"
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
