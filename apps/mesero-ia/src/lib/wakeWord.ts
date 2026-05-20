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
