import type { MenuItem } from "./types";

/** Orden estable: categoría (es), luego nombre. */
export function sortMenuByCategoryThenName(menu: MenuItem[]): MenuItem[] {
  return [...menu].sort((a, b) => {
    const c = (a.category ?? "").localeCompare(b.category ?? "", "es", { sensitivity: "base" });
    if (c !== 0) return c;
    return (a.name ?? "").localeCompare(b.name ?? "", "es", { sensitivity: "base" });
  });
}
