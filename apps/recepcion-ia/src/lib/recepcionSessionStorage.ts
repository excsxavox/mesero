export type RecepcionMsg = { role: "user" | "assistant"; content: string; at: string };

export type RecepcionSession = {
  touchCart: Record<string, number>;
  corpus: string;
  messages?: RecepcionMsg[];
  /** Mostrador de recepción asignado en este dispositivo (1…tableCount). */
  selectedTable?: number | null;
};

const KEY = "recepcion-session";
/** Mesa del quiosco: localStorage para compartir entre pestaña de admin y pantalla del mesero. */
const KIOSK_TABLE_KEY = "recepcion-desk";

export const RECEPCION_SESSION_UPDATED = "recepcion-session-updated";

function readKioskTableFromStorage(): number | null {
  try {
    const raw = localStorage.getItem(KIOSK_TABLE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n) : null;
  } catch {
    return null;
  }
}

export function saveKioskTable(table: number | null) {
  try {
    if (table == null) localStorage.removeItem(KIOSK_TABLE_KEY);
    else localStorage.setItem(KIOSK_TABLE_KEY, String(Math.round(table)));
  } catch {
    /* */
  }
}

export function loadRecepcionSession(): RecepcionSession {
  try {
    const raw = sessionStorage.getItem(KEY);
    const base: RecepcionSession = { touchCart: {}, corpus: "", messages: [], selectedTable: null };
    if (!raw) {
      base.selectedTable = readKioskTableFromStorage();
      return base;
    }
    const p = JSON.parse(raw) as Partial<RecepcionSession>;
    const messages = Array.isArray(p.messages)
      ? p.messages.filter(
          (m): m is RecepcionMsg =>
            !!m &&
            typeof m === "object" &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string",
        )
      : [];
    const fromSession =
      typeof p.selectedTable === "number" && Number.isFinite(p.selectedTable)
        ? Math.round(p.selectedTable)
        : null;
    const selectedTable = fromSession ?? readKioskTableFromStorage();
    return {
      touchCart: p.touchCart && typeof p.touchCart === "object" ? p.touchCart : {},
      corpus: typeof p.corpus === "string" ? p.corpus : "",
      messages,
      selectedTable,
    };
  } catch {
    return { touchCart: {}, corpus: "", messages: [], selectedTable: readKioskTableFromStorage() };
  }
}

export function saveRecepcionSession(session: RecepcionSession) {
  if (session.selectedTable != null) saveKioskTable(session.selectedTable);
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      touchCart: session.touchCart,
      corpus: session.corpus,
      messages: session.messages,
    }),
  );
  window.dispatchEvent(new CustomEvent(RECEPCION_SESSION_UPDATED));
}
