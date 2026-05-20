/** Candado del mesero: bloquea ir a Administración hasta introducir contraseña (servidor). */

export const ADMIN_LOCK_ARMED_KEY = "mesero-admin-lock-armed";
export const ADMIN_ENTRY_OK_KEY = "mesero-admin-entry-ok";
export const MESERO_LOCK_CHANGED = "mesero-lock-changed";

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
    /* modo privado u otro */
  }
}

function ssRemove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* */
  }
}

export function isAdminExitLockArmed(): boolean {
  return ssGet(ADMIN_LOCK_ARMED_KEY) === "1";
}

function notifyLockChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MESERO_LOCK_CHANGED));
  }
}

export function setAdminExitLockArmed(armed: boolean) {
  if (armed) ssSet(ADMIN_LOCK_ARMED_KEY, "1");
  else ssRemove(ADMIN_LOCK_ARMED_KEY);
  notifyLockChanged();
}

export function setAdminEntryUnlocked(unlocked: boolean) {
  if (unlocked) ssSet(ADMIN_ENTRY_OK_KEY, "1");
  else ssRemove(ADMIN_ENTRY_OK_KEY);
}

export function isAdminEntryUnlocked(): boolean {
  return ssGet(ADMIN_ENTRY_OK_KEY) === "1";
}

/** Al volver al mesero principal se invalida el “pase” a administración. */
export function clearAdminEntryUnlock() {
  ssRemove(ADMIN_ENTRY_OK_KEY);
}
