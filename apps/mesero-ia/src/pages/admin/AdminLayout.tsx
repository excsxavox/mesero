import { useLayoutEffect, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useMeseroTheme } from "../../context/MeseroThemeContext";
import { getSettings } from "../../lib/api";
import { isAdminEntryUnlocked, isAdminExitLockArmed } from "../../lib/adminExitLock";
import { getPaletteFromSettings } from "../../lib/meseroTheme";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${
    isActive ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40" : "text-zinc-300 hover:bg-zinc-800"
  }`;

export function AdminLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { setPalette } = useMeseroTheme();

  useEffect(() => {
    getSettings()
      .then((s) => {
        const fromServer = getPaletteFromSettings(s);
        if (fromServer) setPalette(fromServer);
      })
      .catch(() => {
        /* */
      });
  }, [setPalette]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  useLayoutEffect(() => {
    if (isAdminExitLockArmed() && !isAdminEntryUnlocked()) {
      navigate("/", { replace: true, state: { adminGateDenied: true } });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <aside className="w-56 shrink-0 space-y-2">
        <div className="mb-4 text-lg font-semibold text-zinc-50">Administración</div>
        <NavLink to="/admin" end className={linkClass}>
          Resumen
        </NavLink>
        <NavLink to="/admin/flujo" className={linkClass}>
          Flujo (React Flow)
        </NavLink>
        <NavLink to="/admin/config" className={linkClass}>
          Configuración IA
        </NavLink>
        <NavLink to="/admin/tema" className={linkClass}>
          Tema
        </NavLink>
        <NavLink to="/admin/ejecucion" className={linkClass}>
          Modo ejecución
        </NavLink>
        <NavLink to="/" className="mt-6 block text-sm text-zinc-500 hover:text-zinc-300">
          ← Volver al mesero
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          Cerrar sesión
        </button>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
