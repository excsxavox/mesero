import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applyMeseroTheme,
  getStoredMeseroTheme,
  MESERO_THEME_KEY,
  type MeseroTheme,
} from "../lib/meseroTheme";

type ThemeContextValue = {
  theme: MeseroTheme;
  isLight: boolean;
  setTheme: (theme: MeseroTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useMeseroTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useMeseroTheme debe usarse dentro de MeseroThemeProvider");
  return ctx;
}

export function MeseroThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<MeseroTheme>(() => getStoredMeseroTheme());

  /** Única vía DOM + localStorage (sin eventos que re-disparen setState). */
  useEffect(() => {
    applyMeseroTheme(theme);
  }, [theme]);

  /** Sincronizar si otra pestaña cambia el tema. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MESERO_THEME_KEY) return;
      setThemeState(getStoredMeseroTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((t: MeseroTheme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isLight: theme === "light", setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
