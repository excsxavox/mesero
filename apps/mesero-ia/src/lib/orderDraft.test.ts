import { describe, expect, it } from "vitest";
import { mergeDraftInputs } from "./orderDisplayLines";
import { inferLineItemsFromCorpus } from "./inferLineItems";
import { applyRepeatQtyBump, hasRepeatOrderPhrase, qtyForMenuItemInHay } from "./menuItemQty";
import { assistantConfirmsOrderItems } from "./orderDraftConfirm";
import { collapseVariantLines } from "./variantCollapse";
import type { MenuItem } from "./types";

const TEST_MENU: MenuItem[] = [
  { id: "arroz", name: "Arroz", available: true, price: 1.5, category: "Adicionales" },
  { id: "choclo", name: "Choclo con queso", available: true, price: 2, category: "Adicionales" },
  { id: "coca500", name: "Coca Cola 500 ml", available: true, price: 1.5, category: "Bebidas" },
  { id: "coca2l", name: "Coca Cola 2 Litros", available: true, price: 3, category: "Bebidas" },
];

function qtyOf(lines: { menuItemId: string; qty: number }[], id: string) {
  return lines.find((l) => l.menuItemId === id)?.qty ?? 0;
}

/** Simula cómo MeseroContext fusiona borrador previo + respuesta servidor + inferencia local. */
function simulateClientDraftUpdate(
  prevDraft: { menuItemId: string; name: string; qty: number }[],
  incoming: { menuItemId: string; name: string; qty: number }[],
  inferCorpus: string,
  lastUserHay: string,
  assistantHay = "",
) {
  const repeatHay = assistantHay ? `${lastUserHay} ${assistantHay}`.trim() : lastUserHay;
  const mergeOpts = {
    lastUtterance: repeatHay,
    menu: TEST_MENU,
    userHay: inferCorpus,
    lastUserHay,
    assistantHay,
  };
  let merged = mergeDraftInputs(prevDraft, incoming, mergeOpts);
  const inferred = collapseVariantLines(
    inferLineItemsFromCorpus(inferCorpus, TEST_MENU.filter((m) => m.available !== false)),
    TEST_MENU,
    inferCorpus,
  );
  const serverIds = new Set(incoming.map((it) => it.menuItemId));
  const inferredOnly = incoming.length > 0
    ? inferred.filter((it) => !serverIds.has(it.menuItemId))
    : inferred;
  if (inferredOnly.length > 0) {
    merged = mergeDraftInputs(merged, inferredOnly, mergeOpts);
  }
  return merged;
}

describe("menuItemQty (cliente)", () => {
  it("otra coca personal incrementa respecto al previo en el último turno", () => {
    const coca = TEST_MENU.find((m) => m.id === "coca500")!;
    const bumped = applyRepeatQtyBump(1, 1, "otra coca cola personal", coca.name, coca);
    expect(bumped).toBe(2);
  });

  it("hasRepeatOrderPhrase en confirmación de Karen", () => {
    expect(hasRepeatOrderPhrase("Listo, otra Coca Cola personal añadida", "Coca Cola 500 ml")).toBe(true);
  });

  it("qtyForMenuItemInHay suma menciones en el corpus", () => {
    const coca = TEST_MENU.find((m) => m.id === "coca500")!;
    const corpus = "una coca cola personal otra coca cola personal";
    expect(qtyForMenuItemInHay(corpus, coca.name, coca)).toBe(2);
  });
});

describe("mergeDraftInputs (cliente)", () => {
  it("no pierde choclo cuando el servidor solo envía arroz", () => {
    const prev = [
      { menuItemId: "arroz", name: "Arroz", qty: 2 },
      { menuItemId: "choclo", name: "Choclo con queso", qty: 1 },
    ];
    const incoming = [{ menuItemId: "arroz", name: "Arroz", qty: 1 }];
    const merged = mergeDraftInputs(prev, incoming);
    expect(qtyOf(merged, "arroz")).toBe(2);
    expect(qtyOf(merged, "choclo")).toBe(1);
  });

  it("suma +1 con otra coca en el último utterance", () => {
    const prev = [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }];
    const incoming = [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }];
    const merged = mergeDraftInputs(prev, incoming, {
      lastUtterance: "otra coca cola personal",
      menu: TEST_MENU,
    });
    expect(qtyOf(merged, "coca500")).toBe(2);
  });
});

describe("inferLineItemsFromCorpus (cliente)", () => {
  it("infiere dos arroces y un choclo", () => {
    const lines = inferLineItemsFromCorpus("karen dos arroces y un choclo", TEST_MENU);
    expect(qtyOf(lines, "arroz")).toBe(2);
    expect(qtyOf(lines, "choclo")).toBe(1);
  });
});

describe("assistantConfirmsOrderItems", () => {
  it("confirma pedido anotado", () => {
    expect(assistantConfirmsOrderItems("Listo, un choclo agregado")).toBe(true);
  });

  it("no confunde con listado de carta", () => {
    expect(assistantConfirmsOrderItems("Tenemos arroz y choclo en el menú")).toBe(false);
  });
});

describe("simulateClientDraftUpdate (flujo completo cliente)", () => {
  it("turno 1: una coca → ×1", () => {
    const corpus = "karen una coca cola personal";
    const draft = simulateClientDraftUpdate(
      [],
      [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }],
      corpus,
      "una coca cola personal",
    );
    expect(qtyOf(draft, "coca500")).toBe(1);
  });

  it("turno 2: otra coca → ×2 acumulado", () => {
    const corpus1 = "karen una coca cola personal";
    const draft1 = simulateClientDraftUpdate(
      [],
      [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }],
      corpus1,
      "una coca cola personal",
    );
    const corpus2 = `${corpus1} otra coca cola personal`;
    const draft2 = simulateClientDraftUpdate(
      draft1,
      [{ menuItemId: "coca500", name: "Coca Cola 500 ml", qty: 1 }],
      corpus2,
      "otra coca cola personal",
    );
    expect(qtyOf(draft2, "coca500")).toBe(2);
  });

  it("turno 2: choclo agregado por Karen aunque LLM solo mande arroz", () => {
    const corpus1 = "dos arroces";
    const draft1 = simulateClientDraftUpdate([], [{ menuItemId: "arroz", name: "Arroz", qty: 2 }], corpus1, "dos arroces");
    const corpus2 = `${corpus1} un choclo`;
    const assist2 = "Listo, un choclo agregado";
    const draft2 = simulateClientDraftUpdate(
      draft1,
      [{ menuItemId: "arroz", name: "Arroz", qty: 1 }],
      `${corpus2} ${assist2}`,
      "un choclo",
      assist2,
    );
    expect(qtyOf(draft2, "arroz")).toBe(2);
    expect(qtyOf(draft2, "choclo")).toBe(1);
  });
});
