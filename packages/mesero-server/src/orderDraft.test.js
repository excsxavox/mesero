import { describe, expect, it } from "vitest";
import {
  applyQtyToDraftLines,
  hasRepeatOrderPhrase,
  inferMenuLinesFromAssistantConfirmation,
  inferMenuLinesFromText,
  mergeDraftItemLists,
  qtyForMenuItemInHay,
} from "./orderAmbiguity.js";
import {
  TEST_MENU,
  buildDraftFromConversation,
  buildDraftFromTurn,
  hasItem,
  qtyOf,
} from "./testFixtures.js";

const COCA500 = TEST_MENU.find((m) => m.id === "coca500");
const ARROZ = TEST_MENU.find((m) => m.id === "arroz");
const CHOCLO = TEST_MENU.find((m) => m.id === "choclo");

describe("qtyForMenuItemInHay", () => {
  it("dos arroces → cantidad 2", () => {
    expect(qtyForMenuItemInHay("karen dos arroces", "Arroz", ARROZ)).toBe(2);
  });

  it("una coca personal → cantidad 1", () => {
    expect(qtyForMenuItemInHay("una coca cola personal", "Coca Cola 500 ml", COCA500)).toBe(1);
  });

  it("una coca + otra coca personal en el mismo corpus → cantidad 2", () => {
    const corpus = "una coca cola personal otra coca cola personal";
    expect(qtyForMenuItemInHay(corpus, "Coca Cola 500 ml", COCA500)).toBe(2);
  });
});

describe("hasRepeatOrderPhrase", () => {
  it("detecta otra coca personal en confirmación del mesero", () => {
    expect(hasRepeatOrderPhrase("Listo, otra Coca Cola personal añadida", "Coca Cola 500 ml")).toBe(true);
  });

  it("no confunde listado de menú con pedido repetido", () => {
    expect(hasRepeatOrderPhrase("Tenemos arroz, choclo y habas en la carta", "Arroz")).toBe(false);
  });
});

describe("inferMenuLinesFromText", () => {
  it("detecta choclo con nombre corto del plato del menú", () => {
    const lines = inferMenuLinesFromText("karen un choclo", TEST_MENU);
    expect(hasItem(lines, "choclo")).toBe(true);
    expect(qtyOf(lines, "choclo")).toBe(1);
  });

  it("detecta dos arroces y choclo en un solo turno", () => {
    const lines = inferMenuLinesFromText("dos arroces y un choclo con queso", TEST_MENU);
    expect(qtyOf(lines, "arroz")).toBe(2);
    expect(hasItem(lines, "choclo")).toBe(true);
  });

  it("colapsa varias Coca del LLM a una sola variante personal (500 ml)", () => {
    const draft = buildDraftFromTurn({
      userCorpus: "una coca cola personal",
      llmDraft: [
        { menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 },
        { menuItemId: "coca2l", name: "Coca Cola 2 Litros", qty: 1 },
      ],
    });
    const sodaIds = draft.filter((l) => /^coca/.test(l.menuItemId)).map((l) => l.menuItemId);
    expect(sodaIds).toEqual(["coca500"]);
  });
});

describe("inferMenuLinesFromAssistantConfirmation", () => {
  it("agrega choclo cuando Karen confirma en voz", () => {
    const lines = inferMenuLinesFromAssistantConfirmation(
      "Listo, un choclo agregado. ¿Algo de tomar?",
      TEST_MENU,
    );
    expect(hasItem(lines, "choclo")).toBe(true);
  });

  it("no infiere platos al listar el menú", () => {
    const lines = inferMenuLinesFromAssistantConfirmation(
      "Tenemos arroz, choclo con queso y habas. ¿Qué te provoca?",
      TEST_MENU,
    );
    expect(lines).toHaveLength(0);
  });
});

describe("mergeDraftItemLists", () => {
  it("conserva el mayor qty al fusionar listas", () => {
    const merged = mergeDraftItemLists(
      [{ menuItemId: "arroz", name: "Arroz", qty: 1 }],
      [{ menuItemId: "arroz", name: "Arroz", qty: 2 }],
    );
    expect(qtyOf(merged, "arroz")).toBe(2);
  });

  it("une ítems distintos sin perder ninguno", () => {
    const merged = mergeDraftItemLists(
      [{ menuItemId: "arroz", name: "Arroz", qty: 2 }],
      [{ menuItemId: "choclo", name: "Choclo con queso", qty: 1 }],
    );
    expect(hasItem(merged, "arroz")).toBe(true);
    expect(hasItem(merged, "choclo")).toBe(true);
  });
});

describe("applyQtyToDraftLines", () => {
  it("incrementa a 2 cuando Karen dice otra coca y el borrador tenía 1", () => {
    const draft = [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }];
    const corpus = "una coca cola personal";
    const assist = "Listo, otra Coca Cola personal añadida";
    const out = applyQtyToDraftLines(draft, TEST_MENU, corpus, assist);
    expect(qtyOf(out, "coca500")).toBe(2);
  });

  it("no sobrecuenta si el corpus ya suma dos menciones de coca", () => {
    const draft = [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }];
    const corpus = "una coca cola personal otra coca cola personal";
    const assist = "Listo, otra Coca Cola personal añadida";
    const out = applyQtyToDraftLines(draft, TEST_MENU, corpus, assist);
    expect(qtyOf(out, "coca500")).toBe(2);
  });
});

describe("buildDraftFromTurn (pipeline servidor)", () => {
  it("primer turno: una coca personal → ×1", () => {
    const draft = buildDraftFromTurn({
      userCorpus: "karen una coca cola personal",
      llmDraft: [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }],
    });
    expect(qtyOf(draft, "coca500")).toBe(1);
    expect(draft.filter((l) => l.menuItemId.startsWith("coca"))).toHaveLength(1);
  });

  it("DRAFT_JSON incompleto del LLM se completa por inferencia del corpus", () => {
    const draft = buildDraftFromTurn({
      userCorpus: "dos arroces y un choclo",
      llmDraft: [{ menuItemId: "arroz", name: "Arroz", qty: 1 }],
    });
    expect(qtyOf(draft, "arroz")).toBe(2);
    expect(hasItem(draft, "choclo")).toBe(true);
  });
});

describe("buildDraftFromConversation (varios turnos)", () => {
  it("otra coca personal en segundo turno → Coca 500 ml ×2", () => {
    const { draft } = buildDraftFromConversation([
      {
        user: "karen una coca cola personal",
        llmDraft: [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }],
      },
      {
        user: "otra coca cola personal",
        assistant: "Listo, otra Coca Cola personal añadida. ¿Algo más?",
        llmDraft: [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }],
      },
    ]);
    expect(qtyOf(draft, "coca500")).toBe(2);
  });

  it("arroz primero, choclo en segundo turno → ambos en el borrador", () => {
    const { draft } = buildDraftFromConversation([
      {
        user: "dos arroces",
        llmDraft: [{ menuItemId: "arroz", name: "Arroz", qty: 2 }],
      },
      {
        user: "un choclo",
        assistant: "Listo, un choclo agregado. ¿Algo de tomar?",
        llmDraft: [{ menuItemId: "arroz", name: "Arroz", qty: 1 }],
      },
    ]);
    expect(qtyOf(draft, "arroz")).toBe(2);
    expect(hasItem(draft, "choclo")).toBe(true);
  });

  it("simula fusión cliente+servidor cuando el LLM olvida ítems previos", () => {
    const { draft } = buildDraftFromConversation([
      {
        user: "dos arroces",
        llmDraft: [{ menuItemId: "arroz", name: "Arroz", qty: 2 }],
      },
      {
        user: "un choclo",
        assistant: "Listo, un choclo agregado",
        llmDraft: [{ menuItemId: "arroz", name: "Arroz", qty: 1 }],
        clientPrevDraft: [{ menuItemId: "arroz", name: "Arroz", qty: 2 }],
      },
    ]);
    expect(qtyOf(draft, "arroz")).toBe(2);
    expect(hasItem(draft, "choclo")).toBe(true);
  });
});
