import type { MenuCategoryPreview } from "../../lib/menuCategories";

type Props = {
  categories: MenuCategoryPreview[];
  onSelectCategory: (category: string) => void;
  onViewCatalog?: () => void;
  disabled?: boolean;
  /** `panel`: ocupa el hueco principal; `strip`: fila horizontal compacta. */
  layout?: "strip" | "panel";
};

function CategoryCard({ cat, panel }: { cat: MenuCategoryPreview; panel?: boolean }) {
  const src = (cat.imageUrl ?? "").trim();
  return (
    <div
      className={`relative aspect-[4/3] overflow-hidden rounded-xl border border-mesero-line/15 bg-mesero-muted ring-1 ring-mesero-line/10 ${
        panel ? "w-full min-w-0" : "w-[9.5rem] shrink-0 sm:w-[10.5rem]"
      }`}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mesero-panel/60 to-mesero-bg text-2xl">
          🍽️
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <p className="absolute bottom-2 left-2 right-2 text-xs font-semibold text-white drop-shadow">{cat.label}</p>
      {cat.itemCount > 0 ? (
        <p className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-mesero-text/90">
          {cat.itemCount}
        </p>
      ) : null}
    </div>
  );
}

export function MenuCategoryStrip({
  categories,
  onSelectCategory,
  onViewCatalog,
  disabled,
  layout = "strip",
}: Props) {
  const panel = layout === "panel";

  return (
    <section
      className={
        panel
          ? "flex min-h-[10rem] flex-col rounded-2xl border border-mesero-line/15 bg-mesero-panel/80 p-4 ring-1 ring-mesero-line/10 lg:min-h-[12rem]"
          : "shrink-0 rounded-2xl border border-mesero-line/15 bg-mesero-panel/60 p-4 ring-1 ring-mesero-line/10"
      }
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-mesero-text-muted">Categorías</h2>
        {onViewCatalog ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onViewCatalog}
            className="touch-manipulation text-xs font-medium text-mesero-accent hover:text-blue-200 disabled:opacity-50"
          >
            Ver catálogo →
          </button>
        ) : null}
      </div>
      {categories.length > 0 ? (
        <div
          className={
            panel
              ? "min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
              : "-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1"
          }
        >
          <div className={panel ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex gap-2"}>
            {categories.map((cat) => (
              <button
                key={cat.category}
                type="button"
                disabled={disabled}
                onClick={() => onSelectCategory(cat.category)}
                className={`touch-manipulation text-left disabled:opacity-50 ${panel ? "min-w-0" : "shrink-0"}`}
              >
                <CategoryCard cat={cat} panel={panel} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-mesero-text-muted/80">No hay categorías en el catálogo.</p>
      )}
    </section>
  );
}
