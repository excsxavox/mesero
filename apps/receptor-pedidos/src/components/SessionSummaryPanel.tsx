import { formatElapsed } from "../lib/format";

type Props = {
  inView: number;
  preparing: number;
  ready: number;
  avgPrepMs: number | null;
};

export function SessionSummaryPanel({ inView, preparing, ready, avgPrepMs }: Props) {
  return (
    <section className="flex min-h-[200px] flex-col rounded-xl border border-zinc-800 bg-zinc-950/50 ring-1 ring-zinc-800/80">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2.5">
        <ChartIcon />
        <h2 className="text-sm font-semibold text-zinc-200">Resumen de la sesión</h2>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-3">
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="En vista" value={inView} valueClass="text-amber-400" />
          <StatBox label="En preparación" value={preparing} valueClass="text-amber-500" />
          <StatBox label="Listos" value={ready} valueClass="text-emerald-400" />
        </div>
        <div className="mt-auto rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Tiempo promedio preparación</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-sky-300">
            {avgPrepMs != null ? formatElapsed(avgPrepMs) : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}

function StatBox({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-2 text-center">
      <p className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">{label}</p>
    </div>
  );
}

function ChartIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M9 19V9M14 19v-6M19 19V3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
