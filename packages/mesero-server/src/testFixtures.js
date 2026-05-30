import {
  applyQtyToDraftLines,
  collapseVariantLines,
  inferMenuLinesFromAssistantConfirmation,
  inferMenuLinesFromText,
  mergeDraftItemLists,
} from "./orderAmbiguity.js";

/** Menú mínimo para pruebas de borrador (adicionales + gaseosas). */
export const TEST_MENU = [
  { id: "arroz", name: "Arroz", available: true, price: 1.5 },
  { id: "choclo", name: "Choclo con queso", available: true, price: 2 },
  { id: "coca500", name: "Coca Cola 500 ml", available: true, price: 1.5 },
  { id: "coca2l", name: "Coca Cola 2 Litros", available: true, price: 3 },
  { id: "coca135", name: "Coca Cola 1.35 Litros", available: true, price: 2.5 },
  { id: "fiora", name: "Fiora Vanti 500 ml", available: true, price: 1.2 },
];

/**
 * Simula cómo el servidor arma draftItems tras /api/chat/complete.
 * @param {{ userCorpus: string; assistantText?: string; llmDraft?: { menuItemId: string; name: string; qty: number }[]; menu?: typeof TEST_MENU }} opts
 */
export function buildDraftFromTurn({ userCorpus, assistantText = "", llmDraft = [], menu = TEST_MENU, lastUserHay = "" }) {
  let draftItems = mergeDraftItemLists(
    llmDraft,
    inferMenuLinesFromText(userCorpus, menu),
    inferMenuLinesFromAssistantConfirmation(assistantText, menu),
  );
  draftItems = applyQtyToDraftLines(
    draftItems,
    menu,
    userCorpus,
    assistantText,
    lastUserHay || userCorpus,
  );
  return collapseVariantLines(draftItems, menu, userCorpus || assistantText);
}

/** Acumula turnos como en una conversación real (corpus de usuario crece). */
export function buildDraftFromConversation(turns, menu = TEST_MENU) {
  let userCorpus = "";
  let draft = [];

  for (const turn of turns) {
    userCorpus = `${userCorpus} ${turn.user ?? ""}`.replace(/\s+/g, " ").trim();
    draft = buildDraftFromTurn({
      userCorpus,
      assistantText: turn.assistant ?? "",
      llmDraft: turn.llmDraft ?? [],
      menu,
      lastUserHay: turn.user ?? "",
    });
    if (turn.clientPrevDraft?.length) {
      draft = mergeDraftItemLists(turn.clientPrevDraft, draft);
      draft = applyQtyToDraftLines(
        draft,
        menu,
        userCorpus,
        turn.assistant ?? "",
        turn.user ?? "",
      );
    }
  }

  return { draft, userCorpus };
}

export function qtyOf(draft, menuItemId) {
  return draft.find((l) => l.menuItemId === menuItemId)?.qty ?? 0;
}

export function hasItem(draft, menuItemId) {
  return draft.some((l) => l.menuItemId === menuItemId);
}
