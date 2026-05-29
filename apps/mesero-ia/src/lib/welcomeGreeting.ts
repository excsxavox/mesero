/** Saludo fijo de bienvenida del mesero virtual (nombre del bot y restaurante dinámicos). */
export function buildWelcomeGreetingText(restaurantName?: string, assistantName?: string): string {
  const place = (restaurantName ?? "").trim() || "nuestro restaurante";
  const who = (assistantName ?? "").trim() || "Karen";
  return `¡Qué gusto tenerlos en ${place}!\nSoy ${who}, y estaré acompañándolos durante su experiencia.\nPuedo ayudarles con recomendaciones personalizadas o tomar su pedido cuando gusten.`;
}
