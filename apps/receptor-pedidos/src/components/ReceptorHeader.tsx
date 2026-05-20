type Props = {
  inView: number;
  delivered: number;
};

export function ReceptorHeader({ inView, delivered }: Props) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-2xl ring-1 ring-amber-500/30"
          aria-hidden
        >
          🍽️
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Receptor de pedidos</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Vista cocina / barra · Los pedidos llegan en vivo desde el mesero IA o el panel admin.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Pedidos en vista</p>
          <p className="text-2xl font-bold tabular-nums text-amber-400">{inView}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Entregados (sesión)</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-400">{delivered}</p>
        </div>
      </div>
    </header>
  );
}
