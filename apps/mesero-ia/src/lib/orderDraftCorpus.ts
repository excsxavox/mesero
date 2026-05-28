import type { MeseroMsg } from "./meseroSessionStorage";
import { stripWakeWordFromUtterance } from "./speechLocale";
import { buildOrderInferenceCorpus } from "./orderDisplayLines";

/** Texto del cliente en el pedido activo (sin wake word). */
export function buildUserOrderCorpus(
  messages: MeseroMsg[],
  draftEpochMs: number,
  wakeWord: string,
): string {
  const wake = wakeWord.trim() || "karen";
  const users = messages.filter((m) => m.role === "user");
  const scoped = draftEpochMs
    ? users.filter((m) => {
        if (!m.at) return true;
        return new Date(m.at).getTime() > draftEpochMs;
      })
    : users;
  return scoped
    .map((m) => stripWakeWordFromUtterance(m.content, wake))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Incluir el último mensaje del mesero solo cuando el cliente está eligiendo variante. */
export function shouldIncludeAssistantForInference(lastUser: string, lastAssistant: string): boolean {
  const u = fold(lastUser);
  const a = fold(lastAssistant);
  if (!u || !a) return false;
  if (u.length > 120) return false;
  if (
    /\b(esa|ese|esa misma|el de|la de|la misma|ese mismo|s[ií]|ok|dale|listo|perfecto|de acuerdo|agrega esa|ponme esa)\b/.test(
      u,
    )
  ) {
    return true;
  }
  if (/\b\d+(?:[.,]\d+)?\s*(?:ml|litros?|l)\b/.test(u) && /\b(ml|litro|zero|light|grande|pequeñ)/.test(a)) {
    return true;
  }
  if (/\b(zero|light|original|sabor|tamaño|tamanio|mediana|grande|pequeña|pequena)\b/.test(u) && u.length < 50) {
    return true;
  }
  return false;
}

export function assistantTextsForDraftInference(messages: MeseroMsg[], wakeWord: string): string[] {
  const users = messages.filter((m) => m.role === "user");
  const lastUser = stripWakeWordFromUtterance(users[users.length - 1]?.content ?? "", wakeWord);
  const assistants = messages.filter((m) => m.role === "assistant");
  const last = assistants[assistants.length - 1]?.content ?? "";
  if (!shouldIncludeAssistantForInference(lastUser, last)) return [];
  return [last];
}

/** Corpus para inferir platos: cliente + contexto breve del mesero al elegir variante. */
export function buildOrderInferenceCorpusForDraft(
  messages: MeseroMsg[],
  draftEpochMs: number,
  wakeWord: string,
): string {
  const userCorpus = buildUserOrderCorpus(messages, draftEpochMs, wakeWord);
  const assist = assistantTextsForDraftInference(messages, wakeWord);
  return buildOrderInferenceCorpus(userCorpus, assist);
}
