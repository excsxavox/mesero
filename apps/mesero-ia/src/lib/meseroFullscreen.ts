/** Pantalla completa manual (botón): se mantiene al cambiar de ruta hasta volver a pulsar el botón. */

export const MESERO_FULLSCREEN_PINNED_KEY = "mesero-fullscreen-pinned";
export const MESERO_FULLSCREEN_CHANGED = "mesero-fullscreen-changed";

function ssGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function ssSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* */
  }
}

function ssRemove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* */
  }
}

function notifyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MESERO_FULLSCREEN_CHANGED));
  }
}

export function isMeseroFullscreenPinned(): boolean {
  return ssGet(MESERO_FULLSCREEN_PINNED_KEY) === "1";
}

export function setMeseroFullscreenPinned(pinned: boolean) {
  if (pinned) ssSet(MESERO_FULLSCREEN_PINNED_KEY, "1");
  else ssRemove(MESERO_FULLSCREEN_PINNED_KEY);
  notifyChanged();
}
