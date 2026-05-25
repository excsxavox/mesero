---
name: mesero-atencion-cliente
description: >-
  Atención al cliente y flujo conversacional del mesero virtual (Karen).
  Usar al mejorar prompts, flujo de pedido, recomendaciones, DRAFT_JSON/ORDER_JSON
  o la experiencia de voz en mesero-ia / mesero-server.
---

# Mesero — atención al cliente profesional

## Objetivo

El mesero virtual debe sentirse como un **mesero de sala**: breve por voz, recomienda con criterio, aclara variantes y no abruma con listas.

## Archivos clave

| Área | Ruta |
|------|------|
| Tono y fases del servicio | `packages/mesero-server/src/waiterServicePrompt.js` |
| Prompt OpenAI + DRAFT/ORDER | `packages/mesero-server/src/index.js` → `buildSystemPrompt` |
| Pedido ambiguo (ej. varias Coca-Colas) | `packages/mesero-server/src/orderAmbiguity.js` |
| Detección en pantalla | `apps/mesero-ia/src/lib/inferLineItems.ts` |
| Flujo editable (admin) | Administración → Flujo (`FlowPage.tsx`) |
| Instrucciones del local | Administración → Configuración IA → texto extra |

## Reglas de servicio (resumen)

1. **2-4 frases por turno** — el quiosco usa TTS; respuestas largas suenan lentas y robóticas.
2. **Una pregunta por turno** — no «¿bebida, postre y algo más?» en la misma frase.
3. **Recomendar 1-2 ítems** con motivo («va muy bien con…», «es popular»), solo del menú cargado.
4. **Pedido genérico** — ofrecer 2-3 opciones por nombre; `DRAFT_JSON` vacío o un solo ítem hasta que elijan.
5. **Confirmar** antes de `ORDER_JSON` — resumen corto y confirmación explícita.
6. **Precios** — no verbalizar salvo que pregunten; están en pantalla.

## Al cambiar el flujo

- Los nodos en `store.flow` son guía, no un script rígido.
- Si el quiosco tiene **mesa asignada**, los hints que digan «preguntar mesa» se sanitizan en `sanitizeFlowHintForKiosk`.
- Tras editar `waiterServicePrompt.js`, reiniciar `mesero-server`.

## Pruebas manuales sugeridas

- «Karen, quiero una coca cola» → debe preguntar cuál, no agregar todas.
- «¿Qué me recomiendas?» → 1-2 sugerencias, no el menú entero.
- Pedido + confirmación → un solo `ORDER_JSON` con ítems correctos.

## No hacer

- Listar todo el menú por voz sin que lo pidan.
- Poner varias variantes del mismo producto en `DRAFT_JSON` / `ORDER_JSON`.
- Respuestas de más de ~6 frases en un turno normal.
