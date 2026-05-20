import { Link } from "react-router-dom";

export function AdminHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-50">Panel</h1>
      <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
        Desde aquí diseñas el flujo conversacional con React Flow y ajustas las instrucciones del asistente. El catálogo
        viene de AIBox; los pedidos en cocina y caja se gestionan en el receptor.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/admin/flujo"
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ring-1 ring-zinc-800 hover:border-amber-500/40"
        >
          <div className="font-medium text-zinc-100">Flujo</div>
          <div className="mt-1 text-sm text-zinc-500">Editor visual de pasos para guiar al mesero virtual.</div>
        </Link>
        <Link
          to="/admin/config"
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ring-1 ring-zinc-800 hover:border-amber-500/40"
        >
          <div className="font-medium text-zinc-100">Configuración</div>
          <div className="mt-1 text-sm text-zinc-500">Nombre del local e instrucciones extra del sistema.</div>
        </Link>
        <Link
          to="/admin/ejecucion"
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ring-1 ring-zinc-800 hover:border-amber-500/40"
        >
          <div className="font-medium text-zinc-100">Modo ejecución</div>
          <div className="mt-1 text-sm text-zinc-500">Logo del mesero y dispositivos de micrófono y salida de audio.</div>
        </Link>
      </ul>
    </div>
  );
}
