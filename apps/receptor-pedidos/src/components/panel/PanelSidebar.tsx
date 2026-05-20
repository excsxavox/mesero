import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePanelTheme } from "../../context/PanelThemeContext";

type Props = {
  restaurantName: string;
  liveOrders: number;
};

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[var(--panel-purple-dim)] text-violet-200 ring-1 ring-violet-500/30"
      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
  }`;

export function PanelSidebar({ restaurantName, liveOrders }: Props) {
  const { isDark, toggleTheme } = usePanelTheme();
  const { displayName, roleName, profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--panel-border)] bg-[var(--panel-sidebar)]">
      <div className="border-b border-[var(--panel-border)] px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/20 text-lg ring-1 ring-violet-500/30">
            🍽️
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">{restaurantName}</p>
            <p className="text-[10px] text-zinc-500">Panel de control</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <NavLink to="/" end className={itemClass}>
          <GridIcon />
          Resumen
        </NavLink>
        <NavLink to="/cocina" className={itemClass}>
          <LiveIcon />
          Pedidos en vivo
          {liveOrders > 0 ? (
            <span className="ml-auto rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {liveOrders > 99 ? "99+" : liveOrders}
            </span>
          ) : null}
        </NavLink>
        <NavLink to="/historial" className={itemClass}>
          <HistoryIcon />
          Historial de pedidos
        </NavLink>
        <NavLink to="/facturacion" className={itemClass} end={false}>
          <InvoiceIcon />
          Facturación SRI
        </NavLink>
      </nav>

      <div className="border-t border-[var(--panel-border)] p-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-[var(--theme-text-muted)] transition-colors hover:bg-[var(--theme-elevated)]/60"
          aria-pressed={isDark}
        >
          <span>{isDark ? "Tema oscuro" : "Tema claro"}</span>
          <span
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isDark ? "bg-violet-600" : "bg-zinc-400"}`}
            aria-hidden
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isDark ? "right-0.5" : "left-0.5"}`}
            />
          </span>
        </button>
        <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-200">
            {(displayName.charAt(0) || "U").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-300">{displayName}</p>
            <p className="truncate text-[10px] text-zinc-600">
              {roleName || profile?.branchName || "Cocina / caja"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </div>
    </aside>
  );
}

function GridIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
function LiveIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
function InvoiceIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3h10v18l-5-3-5 3V3Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
