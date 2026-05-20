/** URL pública del menú para invitados (código QR). */
export function getMenuPublicUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/menu`;
}
