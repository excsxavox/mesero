import { todayIso } from "../../lib/dateRange";

type Props = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

const inputClass =
  "rounded-lg border border-[var(--panel-border)] bg-[var(--panel-card)] px-3 py-2 text-sm text-zinc-200";

export function DateRangeFilters({ from, to, onFromChange, onToChange }: Props) {
  const maxTo = todayIso();

  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Rango de fechas">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Desde</span>
        <input
          type="date"
          value={from}
          max={to || maxTo}
          onChange={(e) => onFromChange(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Hasta</span>
        <input
          type="date"
          value={to}
          min={from}
          max={maxTo}
          onChange={(e) => onToChange(e.target.value)}
          className={inputClass}
        />
      </label>
    </div>
  );
}
