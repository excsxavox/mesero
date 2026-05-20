export type RecepcionTheme = "dark" | "light";

export const RECEPCION_THEME_KEY = "recepcion-theme";

export function getStoredRecepcionTheme(): RecepcionTheme {
  try {
    return localStorage.getItem(RECEPCION_THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyRecepcionTheme(theme: RecepcionTheme) {
  document.documentElement.setAttribute("data-recepcion-theme", theme);
  try {
    localStorage.setItem(RECEPCION_THEME_KEY, theme);
  } catch {
    /* */
  }
}

export function toggleRecepcionTheme(): RecepcionTheme {
  const next: RecepcionTheme = getStoredRecepcionTheme() === "light" ? "dark" : "light";
  applyRecepcionTheme(next);
  return next;
}
