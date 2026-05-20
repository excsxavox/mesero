import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applyMeseroTheme,
  getStoredMeseroTheme,
  MESERO_THEME_KEY,
  type MeseroTheme,
} from "../lib/meseroTheme";

type ThemeContextValue = {
  theme: MeseroTheme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function usePanelTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("usePanelTheme debe usarse dentro de PanelThemeProvider");
  return ctx;
}

export function PanelThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<MeseroTheme>(() => getStoredMeseroTheme());

  useEffect(() => {
    applyMeseroTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MESERO_THEME_KEY) return;
      setTheme(getStoredMeseroTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
