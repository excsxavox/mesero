export type MeseroTheme = "dark" | "light";

export const MESERO_THEME_KEY = "mesero-theme";

export function getStoredMeseroTheme(): MeseroTheme {
  try {
    return localStorage.getItem(MESERO_THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyMeseroTheme(theme: MeseroTheme) {
  document.documentElement.setAttribute("data-mesero-theme", theme);
  try {
    localStorage.setItem(MESERO_THEME_KEY, theme);
  } catch {
    /* */
  }
}
