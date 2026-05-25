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
  isLight: boolean;
  setTheme: (theme: MeseroTheme) => void;
  setPalette: (palette: MeseroPalette) => void;
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
  const [palette, setPaletteState] = useState<MeseroPalette>(() => getStoredMeseroPalette());

  useEffect(() => {
    applyMeseroTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyMeseroPalette(palette);
  }, [palette]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MESERO_THEME_KEY) setThemeState(getStoredMeseroTheme());
      if (e.key === MESERO_PALETTE_KEY) setPaletteState(getStoredMeseroPalette());
    };
    const onTheme = () => setThemeState(getStoredMeseroTheme());
    const onPalette = () => setPaletteState(getStoredMeseroPalette());
    window.addEventListener("storage", onStorage);
    window.addEventListener(MESERO_THEME_CHANGED, onTheme);
    window.addEventListener(MESERO_PALETTE_CHANGED, onPalette);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MESERO_THEME_CHANGED, onTheme);
      window.removeEventListener(MESERO_PALETTE_CHANGED, onPalette);
    };
  }, []);

  const setTheme = useCallback((t: MeseroTheme) => {
    setThemeState(t);
  }, []);

  const setPalette = useCallback((p: MeseroPalette) => {
    setPaletteState(p);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, palette, isLight: theme === "light", setTheme, setPalette, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
