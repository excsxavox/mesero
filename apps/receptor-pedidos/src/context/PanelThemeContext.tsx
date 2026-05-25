import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applyMeseroPalette,
  applyMeseroTheme,
  getStoredMeseroPalette,
  getStoredMeseroTheme,
  MESERO_PALETTE_KEY,
  MESERO_THEME_KEY,
  MESERO_PALETTE_CHANGED,
  MESERO_THEME_CHANGED,
  type MeseroPalette,
  type MeseroTheme,
} from "../lib/meseroTheme";

type ThemeContextValue = {
  theme: MeseroTheme;
  palette: MeseroPalette;
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
  const [palette, setPalette] = useState<MeseroPalette>(() => getStoredMeseroPalette());

  useEffect(() => {
    applyMeseroTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyMeseroPalette(palette);
  }, [palette]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MESERO_THEME_KEY) setTheme(getStoredMeseroTheme());
      if (e.key === MESERO_PALETTE_KEY) setPalette(getStoredMeseroPalette());
    };
    const onTheme = () => setTheme(getStoredMeseroTheme());
    const onPalette = () => setPalette(getStoredMeseroPalette());
    window.addEventListener("storage", onStorage);
    window.addEventListener(MESERO_THEME_CHANGED, onTheme);
    window.addEventListener(MESERO_PALETTE_CHANGED, onPalette);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MESERO_THEME_CHANGED, onTheme);
      window.removeEventListener(MESERO_PALETTE_CHANGED, onPalette);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, palette, isDark: theme === "dark", toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
