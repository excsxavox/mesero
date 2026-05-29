function fold(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripAssistantTags(text: string) {
  return String(text ?? "")
    .replace(/<<<[\s\S]*?>>>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Karen confirmó que anotó o agregó platos (no solo está listando el menú). */
export function assistantConfirmsOrderItems(text: string) {
  const t = fold(stripAssistantTags(text));
  if (!t) return false;
  if (
    /\b(tenemos|ofrecemos|recomiendo|opciones|la carta|men[uú]\s+incluye|puedes\s+elegir)\b/.test(t) &&
    !/\b(agregad|anotad|sum[eé]|apuntad|registrad)\b/.test(t)
  ) {
    return false;
  }
  return /\b(listo|anotad|agregad|agregue|sum[eé]|apuntad|registrad|qued[oó]|va\s+un|van\s+|te\s+anoto)\b/.test(
    t,
  );
}
