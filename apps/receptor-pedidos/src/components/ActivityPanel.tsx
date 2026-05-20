import type { ActivityEntry } from "../lib/types";
import { formatClock } from "../lib/format";
import { activityDescription } from "../hooks/useActivityLog";

const BADGE: Record<string, string> = {
  nuevo: "bg-violet-600/80 text-violet-100",
  preparando: "bg-amber-600/80 text-amber-100",
  listo: "bg-emerald-600/80 text-emerald-100",
  entregado: "bg-zinc-600/80 text-zinc-200",
};

type Props = {
  entries: ActivityEntry[];
  onClear: () => void;
  className?: string;
};

export function ActivityPanel({ entries, onClear, className = "" }: Props) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-[var(--panel-border)] bg-[var(--panel-card)] ring-1 ring-zinc-800/80 ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <PulseIcon />
          <h2 className="text-sm font-semibold text-zinc-200">Actividad en tiempo real</h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Limpiar actividad"
        >
          ×
        </button>
      </header>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <li className="text-center text-sm text-zinc-600">Los eventos de pedidos aparecerán aquí.</li>
        ) : (
          entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-start gap-x-2 gap-y-1 rounded-lg bg-zinc-900/50 px-2.5 py-1.5 text-xs"
            >
              <span className="shrink-0 tabular-nums text-zinc-500">{formatClock(e.at)}</span>
              <span className="text-zinc-400" aria-hidden>
                •
              </span>
              <span className="min-w-0 flex-1 text-zinc-300">
                {activityDescription(e)}
                <span className="mt-0.5 block truncate text-zinc-500">{e.itemsSummary}</span>
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${BADGE[e.statusKey] ?? BADGE.nuevo}`}
              >
                {e.statusLabel}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function PulseIcon() {
  return (
    <svg className="h-4 w-4 text-sky-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12h2l2-7 4 14 2-7h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
