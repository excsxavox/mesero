import { describe, expect, it } from "vitest";
import {
  categoriesFromKeywordHints,
  categoriesMentionedInText,
  selectMenuItemsForPrompt,
} from "./menuScope.js";

const CATEGORIES = [
  "Adicionales",
  "Gaseosas",
  "Jugos Naturales",
  "OTRAS BEBIDAS",
  "Platos a la Carta",
];

const MENU = [
  { id: "j1", name: "Jarra Grande", category: "Jugos Naturales", available: true, price: 6 },
  { id: "j2", name: "Jarra Pequeña", category: "Jugos Naturales", available: true, price: 3.5 },
  { id: "j3", name: "Vaso", category: "Jugos Naturales", available: true, price: 1.5 },
  { id: "g1", name: "Coca Cola 500 ml", category: "Gaseosas", available: true, price: 1.5 },
  { id: "o1", name: "Agua con gas", category: "OTRAS BEBIDAS", available: true, price: 1 },
];

describe("categoriesMentionedInText", () => {
  it("«jugos» coincide con categoría Jugos Naturales", () => {
    expect(categoriesMentionedInText("karen que jugos tienen", CATEGORIES)).toContain("Jugos Naturales");
  });
});

describe("categoriesFromKeywordHints", () => {
  it("«jugos» apunta a Jugos Naturales, no solo a OTRAS BEBIDAS", () => {
    const hits = categoriesFromKeywordHints("que jugos tienen", CATEGORIES);
    expect(hits).toContain("Jugos Naturales");
    expect(hits).not.toEqual(["OTRAS BEBIDAS"]);
  });
});

describe("selectMenuItemsForPrompt", () => {
  it("incluye Jarra Grande cuando preguntan por jugos", () => {
    const { items } = selectMenuItemsForPrompt(
      [{ role: "user", content: "Karen que jugos naturales tienen" }],
      MENU,
      CATEGORIES,
    );
    const names = items.map((m) => m.name);
    expect(names).toContain("Jarra Grande");
    expect(names).toContain("Vaso");
    expect(names).not.toContain("Coca Cola 500 ml");
  });
});
