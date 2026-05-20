import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applyRecepcionTheme,
  getStoredRecepcionTheme,
  RECEPCION_THEME_KEY,
  type RecepcionTheme,
} from "../lib/recepcionTheme";

type ThemeContextValue = {
  theme: RecepcionTheme;
  isLight: boolean;
  setTheme: (theme: RecepcionTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useRecepcionTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useRecepcionTheme debe usarse dentro de RecepcionThemeProvider");
  return ctx;
}

export function RecepcionThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<RecepcionTheme>(() => getStoredRecepcionTheme());

  /** Única vía DOM + localStorage (sin eventos que re-disparen setState). */
  useEffect(() => {
    applyRecepcionTheme(theme);
  }, [theme]);

  /** Sincronizar si otra pestaña cambia el tema. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== RECEPCION_THEME_KEY) return;
      setThemeState(getStoredRecepcionTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((t: RecepcionTheme) => {
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
