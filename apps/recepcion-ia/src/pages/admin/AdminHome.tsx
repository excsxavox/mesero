import { Link } from "react-router-dom";

export function AdminHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-50">Panel</h1>
      <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
        Configura el flujo y las instrucciones del recepcionista virtual para tu hotel o complejo privado. Puedes
        describir habitaciones, amenidades, horarios y normas de acceso.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/admin/flujo"
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ring-1 ring-zinc-800 hover:border-amber-500/40"
        >
          <div className="font-medium text-zinc-100">Flujo</div>
          <div className="mt-1 text-sm text-zinc-500">Pasos para guiar la conversación en recepción.</div>
        </Link>
        <Link
          to="/admin/config"
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ring-1 ring-zinc-800 hover:border-amber-500/40"
        >
          <div className="font-medium text-zinc-100">Configuración</div>
          <div className="mt-1 text-sm text-zinc-500">Nombre del hotel o complejo, mostradores e instrucciones.</div>
        </Link>
        <Link
          to="/admin/ejecucion"
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ring-1 ring-zinc-800 hover:border-amber-500/40"
        >
          <div className="font-medium text-zinc-100">Modo ejecución</div>
          <div className="mt-1 text-sm text-zinc-500">Avatar, micrófono y salida de audio.</div>
        </Link>
      </ul>
    </div>
  );
}
