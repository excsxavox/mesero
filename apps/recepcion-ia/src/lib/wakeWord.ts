export const DEFAULT_WAKE_WORD = "karen";

/** Palabra de activación en minúsculas (para reconocimiento de voz). */
export function normalizeWakeWord(raw: string | undefined | null): string {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC");
  if (t.length < 2 || t.length > 24) return DEFAULT_WAKE_WORD;
  if (!/^[\p{L}\p{N}]+$/u.test(t)) return DEFAULT_WAKE_WORD;
  return t;
}

/** Nombre visible en la UI (primera letra en mayúscula). */
export function displayAssistantName(wakeWord: string | undefined | null): string {
  const w = normalizeWakeWord(wakeWord);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function quoteWakeWord(wakeWord: string | undefined | null): string {
  return `«${displayAssistantName(wakeWord)}»`;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function wakeWordRegex(wakeWord: string | undefined | null, flags = "i") {
  const w = normalizeWakeWord(wakeWord);
  return new RegExp(`\\b${escapeRegExp(w)}\\b`, flags);
}

/** Tras decir solo el nombre, aceptar el pedido en el siguiente fragmento (segundos). */
export const WAKE_ARM_WINDOW_MS = 6500;

const WAKE_FILLER_RE =
  /^(?:(?:hola|oye|ey|ei|buenas|buenos\s+d[ií]as|buenas\s+tardes|disculpa|por\s+favor|a\s+ver|eh|mmm?|este)\s*,?\s*)+/iu;

const LEADING_PUNCT_RE = /^[\s¿?¡!.,;:—–\-'"«»]+/u;
const TAIL_PUNCT_RE = /^[\s,;:—–\-]+/u;

function utteranceAfterFillers(utterance: string): string {
  return String(utterance ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(WAKE_FILLER_RE, "")
    .replace(LEADING_PUNCT_RE, "")
    .trim();
}

/** El nombre del bot debe ir al inicio (tras saludo o signos de apertura opcionales). */
export function utteranceStartsWithWakeWord(utterance: string, wakeWord: string | undefined | null): boolean {
  const w = normalizeWakeWord(wakeWord);
  const rest = utteranceAfterFillers(utterance);
  if (!rest) return false;
  if (rest === w) return true;
  const re = new RegExp(`^${escapeRegExp(w)}(?:[\\s,;:.?!]|$)`, "u");
  return re.test(rest);
}

/** Pedido en la misma frase, tras el nombre del bot al inicio. */
export function commandAfterWakeInUtterance(utterance: string, wakeWord: string | undefined | null): string {
  const re = wakeWordRegex(wakeWord, "i");
  const parts = String(utterance ?? "")
    .trim()
    .split(re);
  return (parts[parts.length - 1] ?? "").replace(TAIL_PUNCT_RE, "").trim();
}

export function extractCommandIfWakeAtStart(
  utterance: string,
  wakeWord: string | undefined | null,
  minCommandLen = 2,
): string | null {
  if (!utteranceStartsWithWakeWord(utterance, wakeWord)) return null;
  const tail = commandAfterWakeInUtterance(utterance, wakeWord);
  return tail.length >= minCommandLen ? tail : null;
}

export type WakeParseResult = { kind: "command"; command: string } | { kind: "arm" } | { kind: "none" };

export function parseWakeSpeechFragment(
  chunk: string,
  wakeWord: string | undefined | null,
  armedUntil: number,
  minCommandLen = 2,
): { result: WakeParseResult; armedUntil: number } {
  const t = String(chunk ?? "").trim();
  const now = Date.now();
  if (!t) return { result: { kind: "none" }, armedUntil };

  const commandNow = extractCommandIfWakeAtStart(t, wakeWord, minCommandLen);
  if (commandNow) return { result: { kind: "command", command: commandNow }, armedUntil: 0 };

  if (utteranceStartsWithWakeWord(t, wakeWord)) {
    const tail = commandAfterWakeInUtterance(t, wakeWord);
    if (tail.length < minCommandLen) {
      return {
        result: { kind: "command", command: "hola" },
        armedUntil: now + WAKE_ARM_WINDOW_MS,
      };
    }
  }

  if (now <= armedUntil && t.length >= minCommandLen && !utteranceStartsWithWakeWord(t, wakeWord)) {
    return { result: { kind: "command", command: t }, armedUntil: 0 };
  }

  return { result: { kind: "none" }, armedUntil };
}
