import { useEffect, useRef, useState } from "react";
import { speechLocaleFromConversation } from "../lib/speechLocale";

type Locale = "es-ES" | "en-US";

/**
 * Solo cambia el idioma del reconocimiento cuando el último mensaje del usuario cambia
 * y el locale detectado es distinto (no en cada respuesta del asistente).
 */
export function useStableRecognitionLang(
  messages: { role: string; content: string }[],
  wakeWord?: string,
) {
  const [lang, setLang] = useState<Locale>("es-ES");
  const lastUserTextRef = useRef("");

  useEffect(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (lastUser === lastUserTextRef.current) return;
    lastUserTextRef.current = lastUser;
    const next = speechLocaleFromConversation(messages, wakeWord);
    setLang((prev) => (prev === next ? prev : next));
  }, [messages, wakeWord]);

  return lang;
}
