/** Heurística ligera: último turno del cliente parece inglés (p. ej. turista). */
export function isLikelyEnglishUserMessage(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (/[áéíóúñü¿¡]/i.test(t)) return false;
  const norm = t.replace(/\s+/g, " ");
  if (/\b(hola|gracias|menú|carta|quiero|mesa|por favor|buenas|adiós|chao)\b/i.test(norm)) return false;

  if (
    /^(hi|hey|hello|howdy)(\s+there)?\s*[!?.…,:)]*$/i.test(norm) ||
    /^(good\s+(morning|afternoon|evening)|morning)\s*[!?.…]*$/i.test(norm)
  ) {
    return true;
  }

  if (
    /\b(hello|hi|hey|please|thanks|thank you|english|in english|speak english|the menu|what do you|what's up|whats up|can i|could i|would like|i'd like|i will have|i'll have|i want|give me|can i get|i'?m\b|we'?re\b|table for|order|bill|check|water|beer|wine|dessert|excuse me|sorry|help me|show me|house drink|drink of the house|confirm|confirmation|yes|yeah|yep|okay|ok|sure)\b/i.test(
      norm,
    )
  ) {
    return true;
  }
  return false;
}

function isShortEnglishAffirmation(text: string): boolean {
  const norm = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!norm || /[áéíóúñü¿¡]/i.test(norm)) return false;
  if (/\b(s[ií]|quiero|gracias|por favor|confirmo|vale|bueno|menú|carta)\b/i.test(norm)) return false;
  return (
    /^(yes|yeah|yep|ok|okay|sure|right|correct|please|confirmed?|confirm|go ahead|that'?s (it|right|correct|fine)|sounds good|perfect)[\s,!?.]*$/i.test(
      norm,
    ) || /^(yes|yeah|yep|ok|okay|sure)\b/i.test(norm)
  );
}

/** Misma lógica que el servidor: mantener inglés al confirmar con «yes» / «ok». */
export function conversationPrefersEnglish(
  messages: { role: string; content: string }[],
  wakeWord = "karen",
): boolean {
  const users = messages.filter((m) => m.role === "user").slice(-5);
  if (!users.length) return false;

  let englishTurns = 0;
  for (const m of users) {
    const t = stripWakeWordFromUtterance(m.content, wakeWord);
    if (isLikelyEnglishUserMessage(t)) englishTurns++;
  }

  const last = stripWakeWordFromUtterance(users[users.length - 1]?.content ?? "", wakeWord);
  if (isLikelyEnglishUserMessage(last)) return true;
  if (englishTurns >= 1 && isShortEnglishAffirmation(last)) return true;
  if (englishTurns >= 2) return true;
  return false;
}

export function stripWakeWordFromUtterance(text: string, wakeWord = "karen"): string {
  const w = String(wakeWord ?? "")
    .trim()
    .toLowerCase();
  if (w.length < 2) return String(text ?? "").trim();
  const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return String(text ?? "")
    .replace(re, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Voz del navegador según el último mensaje del usuario (detección automática). */
export function speechLocaleFromConversation(
  messages: { role: string; content: string }[],
  wakeWord?: string,
): "es-ES" | "en-US" {
  return conversationPrefersEnglish(messages, wakeWord) ? "en-US" : "es-ES";
}
