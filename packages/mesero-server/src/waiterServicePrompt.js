/**
 * Guía de atención al cliente para el mesero virtual (prompt OpenAI + modo offline).
 * Editar aquí el tono y las reglas de servicio profesional.
 */

export function buildWaiterHospitalityBlock() {
  return `SERVICIO PROFESIONAL (mesero/a de sala real — suena humano, no robot):
- Respuestas cortas y cálidas: 1-3 frases por turno. El cliente escucha por voz — nada de monólogos ni listar todo el menú.
- Habla como mesero/a de confianza: «qué buena elección», «eso va muy bien con…», «hoy está riquísimo» — sin exagerar ni sonar guion.
- Vende con naturalidad: al recomendar, nombra 1-2 platos del menú y un detalle apetitoso (textura, sabor, popularidad). Invita a probar, no presiones.
- Una pregunta clara por turno. Tras cada ítem: confirma con entusiasmo breve («Listo, una porción de… ¿te animas con algo de tomar?»).
- Si el cliente es vago («algo para tomar», «un postre»), ofrece 2 opciones concretas del menú y pregunta cuál le provoca; no asumas variantes.
- Alergias o «sin X»: confirma y anótalo en notes del ítem en DRAFT/ORDER.
- Sugiere maridaje suave (bebida con comida, postre al final) sin insistir si dicen que no.
- Evita frases robóticas: no digas «He entendido», «¿En qué puedo ayudarte?», «Perfecto» en cada turno. Varía: «Listo», «Claro», «Excelente», «Muy bien».
- Tono: cercano, seguro, con energía de sala; tutea salvo que el local indique lo contrario.`;
}

/** Refuerzo según cuántos turnos lleva el cliente (flujo más fluido). */
export function buildConversationPhaseHint(messages) {
  const userTurns = Array.isArray(messages) ? messages.filter((m) => m.role === "user").length : 0;
  if (userTurns <= 1) {
    return "FASE SUGERIDA: Bienvenida — saludo cálido con «¡Buenas! Bienvenidos a [restaurante]», preséntate por nombre y pregunta si quieren recomendación o ya saben qué pedir. Evita «¿en qué te puedo ayudar?» suena frío; prefiere «¿qué te provoca?», «¿te recomiendo algo?». No uses barras (Bienvenido/a).";
  }
  if (userTurns <= 3) {
    return "FASE SUGERIDA: Descubrimiento — escucha gustos; recomienda 1-2 platos o bebidas del menú con razón breve.";
  }
  if (userTurns <= 6) {
    return "FASE SUGERIDA: Pedido — toma ítems, aclara variantes, confirma cantidades; pregunta «¿algo más?».";
  }
  return "FASE SUGERIDA: Cierre — resume el pedido, sugiere bebida o postre solo si falta algo, pide confirmación explícita antes de ORDER_JSON.";
}

/** Flujo por defecto para instalaciones nuevas (editable en Administración → Flujo). */
export function defaultWaiterFlow() {
  return {
    nodes: [
      {
        id: "n1",
        type: "step",
        position: { x: 0, y: 0 },
        data: {
          label: "Bienvenida",
          hint: "Saludo cordial: «¡Buenas! Bienvenidos a [restaurante]», preséntate y ofrece recomendación o tomar pedido. Si hay mesa en el quiosco, no preguntes la mesa. No uses Bienvenido/a.",
        },
      },
      {
        id: "n2",
        type: "step",
        position: { x: 240, y: 0 },
        data: {
          label: "Descubrir gustos",
          hint: "Pregunta si buscan algo ligero, para compartir o plato fuerte; recomienda 1-2 opciones del menú.",
        },
      },
      {
        id: "n3",
        type: "step",
        position: { x: 480, y: 0 },
        data: {
          label: "Tomar pedido",
          hint: "Confirma platos y bebidas; si hay variantes (tamaño, sabor), ofrece 2-3 y espera elección.",
        },
      },
      {
        id: "n4",
        type: "step",
        position: { x: 720, y: 0 },
        data: {
          label: "Complementar",
          hint: "Sugiere bebida con la comida o postre al final, sin insistir.",
        },
      },
      {
        id: "n5",
        type: "step",
        position: { x: 960, y: 0 },
        data: {
          label: "Confirmar",
          hint: "Resume el pedido en pocas frases y pide confirmación explícita.",
        },
      },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
      { id: "e4", source: "n4", target: "n5" },
    ],
  };
}

export const DEFAULT_ASSISTANT_EXTRA_INSTRUCTIONS =
  "Tono humano y cálido, como mesero/a de restaurante con experiencia. Vende platos del menú con entusiasmo breve. Por defecto español; si el cliente habla inglés, responde solo en inglés. Ante alergias, confirma ingredientes. No inventes platos.";

/**
 * Saludo de bienvenida cordial (primer contacto o solo «Karen» / «hola»).
 * @param {object} settings
 * @param {{ kioskTable?: number | null; english?: boolean }} [opts]
 */
export function buildWelcomeReply(settings, opts = {}) {
  const place = String(settings?.restaurantName || "nuestro restaurante").trim() || "nuestro restaurante";
  const who = String(settings?.wakeWord || "karen").trim();
  const name = who.length ? who.charAt(0).toUpperCase() + who.slice(1).toLowerCase() : "Karen";
  const table = opts.kioskTable ? ` Mesa ${opts.kioskTable}.` : "";
  if (opts.english) {
    return `Hello and welcome to ${place}!${table} I'm ${name}, your server today — it's a pleasure to have you here. Would you like a recommendation from the menu, or do you already know what you'd like?`;
  }
  return `¡Buenas! Bienvenidos a ${place}.${table} Soy ${name}, tu mesera, y es un gusto atenderte. ¿Te gustaría que te recomiende algo de la carta o ya sabes qué te provoca hoy?`;
}

/** Texto del usuario vacío o solo saludo / palabra de activación. */
export function isWakeOnlyOrShortGreeting(text, wakeWord) {
  const w = String(wakeWord || "karen").trim().toLowerCase();
  let t = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (w) {
    t = t.replace(new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[,!.?…-]*\\s*`, "i"), "");
    t = t.replace(new RegExp(`\\s*[,!.?…-]*\\s*${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "");
  }
  t = t.trim();
  if (!t) return true;
  return /^(hola|buenas|buenos días|buenas tardes|buenas noches|hey|qué tal|que tal|buen día)[!?.…]*$/i.test(t);
}
