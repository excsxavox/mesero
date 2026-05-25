export type MeseroTheme = "dark" | "light";
export type MeseroPalette = "moderno" | "rustico";

export const MESERO_THEME_KEY = "mesero-theme";
export const MESERO_PALETTE_KEY = "mesero-palette";
export const MESERO_THEME_CHANGED = "mesero-theme-changed";
export const MESERO_PALETTE_CHANGED = "mesero-palette-changed";

export function normalizeMeseroPalette(value: unknown): MeseroPalette {
  return value === "rustico" ? "rustico" : "moderno";
}

export function getPaletteFromSettings(settings?: { uiPalette?: unknown } | null): MeseroPalette | null {
  if (!settings || settings.uiPalette == null || settings.uiPalette === "") return null;
  return normalizeMeseroPalette(settings.uiPalette);
}

export function getStoredMeseroTheme(): MeseroTheme {
  try {
    return localStorage.getItem(MESERO_THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function getStoredMeseroPalette(): MeseroPalette {
  try {
    return normalizeMeseroPalette(localStorage.getItem(MESERO_PALETTE_KEY));
  } catch {
    return "moderno";
  }
}

export function applyMeseroTheme(theme: MeseroTheme) {
  document.documentElement.setAttribute("data-mesero-theme", theme);
  try {
    localStorage.setItem(MESERO_THEME_KEY, theme);
  } catch {
    /* */
  }
  window.dispatchEvent(new CustomEvent(MESERO_THEME_CHANGED));
}

export function applyMeseroPalette(palette: MeseroPalette) {
  const p = normalizeMeseroPalette(palette);
  document.documentElement.setAttribute("data-mesero-palette", p);
  try {
    localStorage.setItem(MESERO_PALETTE_KEY, p);
  } catch {
    /* */
  }
  window.dispatchEvent(new CustomEvent(MESERO_PALETTE_CHANGED));
}

export function applyMeseroAppearance(theme: MeseroTheme, palette?: MeseroPalette) {
  applyMeseroTheme(theme);
  applyMeseroPalette(palette ?? getStoredMeseroPalette());
}
