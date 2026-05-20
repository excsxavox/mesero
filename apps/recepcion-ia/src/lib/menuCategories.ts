import type { MenuItem } from "./types";

export type MenuCategoryPreview = {
  category: string;
  label: string;
  imageUrl?: string;
  itemCount: number;
};

/** Nombres únicos de categoría en el menú (orden alfabético en español). */
export function uniqueCategoriesFromMenu(menu: MenuItem[]): string[] {
  const set = new Set<string>();
  for (const m of menu) {
    const c = String(m.category ?? "").trim();
    if (c) set.add(c);
  }
  if (!set.size) set.add("General");
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** Categorías del catálogo con imagen representativa (derivadas de los platos). */
export function menuCategoryPreviews(menu: MenuItem[], limit = 4): MenuCategoryPreview[] {
  const byCat = new Map<string, MenuItem[]>();
  for (const m of menu.filter((x) => x.name.trim() && x.available !== false)) {
    const cat = (m.category || "General").trim() || "General";
    const list = byCat.get(cat) ?? [];
    list.push(m);
    byCat.set(cat, list);
  }
  const cats = [...byCat.keys()].sort((a, b) => a.localeCompare(b, "es"));
  return cats.slice(0, limit).map((category) => {
    const items = byCat.get(category) ?? [];
    const withImg = items.find((m) => (m.imageUrl ?? "").trim());
    return {
      category,
      label: category,
      imageUrl: withImg?.imageUrl?.trim() || items[0]?.imageUrl?.trim(),
      itemCount: items.length,
    };
  });
}

/** Lista de categorías del servidor (o inferidas del menú) con vista previa para la franja del chat. */
export function categoryPreviewsForStrip(
  menu: MenuItem[],
  categoryNames: string[],
  limit = 12,
): MenuCategoryPreview[] {
  const fromMenu = menuCategoryPreviews(menu, 99);
  const byCat = new Map(fromMenu.map((p) => [p.category, p]));
  const names =
    categoryNames.length > 0 ? categoryNames : fromMenu.map((p) => p.category);
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  return unique.slice(0, limit).map((category) => {
    const hit = byCat.get(category);
    return (
      hit ?? {
        category,
        label: category,
        itemCount: menu.filter(
          (m) => m.name.trim() && m.available !== false && (m.category || "General").trim() === category,
        ).length,
      }
    );
  });
}
