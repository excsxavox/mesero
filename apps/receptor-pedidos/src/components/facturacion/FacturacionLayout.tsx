import { NavLink, Outlet } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-violet-600/25 text-violet-200 ring-1 ring-violet-500/40"
      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
  }`;

export function FacturacionLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--panel-border)] px-6 py-5">
        <h1 className="text-2xl font-bold text-[var(--theme-text)]">Facturación electrónica</h1>
        <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
          Configuración del emisor SRI, emisión de comprobantes y cobros con factura.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Sección facturación">
          <NavLink to="/facturacion/comprobantes" className={tabClass}>
            Comprobantes
          </NavLink>
          <NavLink to="/facturacion/configuracion" className={tabClass}>
            Configuración del emisor
          </NavLink>
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
