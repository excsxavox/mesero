/**
 * Guía de atención al cliente para el mesero virtual (prompt OpenAI + modo offline).
 * Editar aquí el tono y las reglas de servicio profesional.
 */

export function buildWaiterHospitalityBlock() {
  return `SERVICIO PROFESIONAL (mesero/a de sala real — suena humano, no robot):
- BREVEDAD (obligatorio): máximo 2 frases cortas por turno (~35-45 palabras). El cliente escucha por voz — nada de monólogos ni listar todo el menú.
- Vende con sutileza: si recomiendas, nombra 1 complemento y una razón concreta («va bien con…», «hoy sale mucho»). Sin exagerar: evita metáforas («imagina», «te va a volar la cabeza», «explosión de sabor»), adjetivos en cadena y más de una exclamación por turno.
- Confirma directo: «Listo, arroz anotado. ¿Algo de tomar?» — no repitas lo que ya ve en pantalla (foto, nombre, precio).
- Una pregunta clara por turno. Tras cada ítem: confirmación breve + opcional sugerencia de 1 complemento.
- Si el cliente es vago («algo para tomar», «un jugo», «un postre»), ofrece 2 opciones que estén LITERALMENTE en el menú actual (usa el nombre exacto de la carta); nunca inventes sabores, tamaños ni productos que no aparezcan en el menú; si solo hay una opción de ese tipo, confírmala directamente.
- Los jugos naturales pueden figurar como Jarra Grande, Jarra Pequeña o Vaso bajo la categoría «Jugos Naturales»; si preguntan por jugos, menciona esas presentaciones del menú.
- Alergias o «sin X»: confirma y anótalo en notes del ítem en DRAFT/ORDER.
- Sugiere maridaje suave (bebida con comida, postre al final) sin insistir si dicen que no.
- Evita frases robóticas: no digas «He entendido», «¿En qué puedo ayudarte?», «Perfecto» en cada turno. Varía: «Listo», «Claro», «Muy bien».
- Tono: cercano y seguro, como mesero/a de confianza; tutea salvo que el local indique lo contrario.`;
}

/** Refuerzo según cuántos turnos lleva el cliente (flujo más fluido). */
export function buildConversationPhaseHint(messages) {
  const userTurns = Array.isArray(messages) ? messages.filter((m) => m.role === "user").length : 0;
  if (userTurns <= 1) {
    return "FASE SUGERIDA: Bienvenida — usa el guion fijo de bienvenida (3 frases): «¡Qué gusto tenerlos en [restaurante]! Soy [nombre del bot], y estaré acompañándolos durante su experiencia. Puedo ayudarles con recomendaciones personalizadas o tomar su pedido cuando gusten.» No improvises otro saludo.";
  }
  if (userTurns <= 3) {
    return "FASE SUGERIDA: Descubrimiento — escucha gustos; si recomiendas, 1 plato + 1 frase de razón (sin párrafos).";
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
          hint: "Saludo fijo (3 frases): «¡Qué gusto tenerlos en [restaurante]! Soy [nombre del bot], y estaré acompañándolos durante su experiencia. Puedo ayudarles con recomendaciones personalizadas o tomar su pedido cuando gusten.» Si hay mesa en el quiosco, no preguntes la mesa.",
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
  "Tono humano y directo, como mesero/a con experiencia. Respuestas cortas (máx. 2 frases). Vende con 1 sugerencia concreta, sin exagerar ni usar lenguaje publicitario. Por defecto español; si el cliente habla inglés, responde solo en inglés. Ante alergias, confirma ingredientes. No inventes platos.";

/**
 * Texto de bienvenida estándar (primer contacto o solo palabra de activación).
 * @param {string} restaurantName
 * @param {string} assistantName — nombre visible del bot (p. ej. Karen)
 * @param {{ english?: boolean }} [opts]
 */
export function buildWelcomeGreetingText(restaurantName, assistantName, opts = {}) {
  const place = String(restaurantName || "nuestro restaurante").trim() || "nuestro restaurante";
  const name = String(assistantName || "Karen").trim() || "Karen";
  if (opts.english) {
    return `What a pleasure to have you at ${place}! I'm ${name}, and I'll be with you throughout your experience. I can help you with personalized recommendations or take your order whenever you're ready.`;
  }
  return `¡Qué gusto tenerlos en ${place}!\nSoy ${name}, y estaré acompañándolos durante su experiencia.\nPuedo ayudarles con recomendaciones personalizadas o tomar su pedido cuando gusten.`;
}

/**
 * Saludo de bienvenida cordial (primer contacto o solo «Karen» / «hola»).
 * @param {object} settings
 * @param {{ kioskTable?: number | null; english?: boolean }} [opts]
 */
export function buildWelcomeReply(settings, opts = {}) {
  const place = String(settings?.restaurantName || "nuestro restaurante").trim() || "nuestro restaurante";
  const who = String(settings?.wakeWord || "karen").trim();
  const name = who.length ? who.charAt(0).toUpperCase() + who.slice(1).toLowerCase() : "Karen";
  return buildWelcomeGreetingText(place, name, { english: opts.english });
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
