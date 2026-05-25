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

const WAKE_FILLER_RE =
  /^(?:hola|oye|ey|ei|buenas|buenos\s+d[ií]as|buenas\s+tardes|disculpa|por\s+favor)\s*,?\s*/iu;

export function utteranceStartsWithWakeWord(utterance: string, wakeWord: string | undefined | null): boolean {
  const w = normalizeWakeWord(wakeWord);
  const lower = String(utterance ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC");
  if (!lower) return false;
  const rest = lower.replace(WAKE_FILLER_RE, "").trim();
  return rest === w || rest.startsWith(`${w} `) || rest.startsWith(`${w},`);
}

export function commandAfterWakeInUtterance(utterance: string, wakeWord: string | undefined | null): string {
  const re = wakeWordRegex(wakeWord, "i");
  const parts = String(utterance ?? "")
    .trim()
    .split(re);
  return (parts[parts.length - 1] ?? "").trim();
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
