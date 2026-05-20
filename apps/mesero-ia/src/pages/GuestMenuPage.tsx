import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MenuVisualPanel } from "../components/MenuVisualPanel";
import { ThemeToggleButton } from "../components/mesero/ThemeToggleButton";
import { useMeseroTheme } from "../context/MeseroThemeContext";
import type { MenuItem, Settings } from "../lib/types";

/** Vista pública del menú (enlace del código QR). Solo lectura. */
export function GuestMenuPage() {
  const { theme, toggleTheme } = useMeseroTheme();
  const [searchParams] = useSearchParams();
  const companyId = useMemo(
    () => searchParams.get("companyId")?.trim() || import.meta.env.VITE_AIBOX_COMPANY_ID?.trim() || "",
    [searchParams],
  );
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [title, setTitle] = useState("Menú");

  useEffect(() => {
    const apiWithCompany = (path: string) => {
      if (!companyId) return path;
      const sep = path.includes("?") ? "&" : "?";
      return `${path}${sep}companyId=${encodeURIComponent(companyId)}`;
    };
    void fetch(apiWithCompany("/api/menu"))
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMenu(data as MenuItem[]))
      .catch(() => setMenu([]));
    void fetch(apiWithCompany("/api/settings"))
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Settings | null) => {
        if (s?.restaurantName?.trim()) setTitle(s.restaurantName.trim());
      })
      .catch(() => null);
  }, [companyId]);

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col bg-mesero-bg px-4 py-6 text-mesero-text">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-mesero-text">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
          <Link
            to="/"
            className="touch-manipulation shrink-0 rounded-lg px-3 py-2 text-sm text-mesero-text-muted ring-1 ring-mesero-line/25 hover:bg-mesero-panel hover:text-mesero-text"
          >
            Mesero
          </Link>
        </div>
      </header>
      <MenuVisualPanel menu={menu} className="min-h-0 flex-1" />
    </div>
  );
}
