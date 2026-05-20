import type { MenuCategoryPreview } from "../../lib/menuCategories";
import { MenuItemImage } from "./MenuItemImage";

type Props = {
  categories: MenuCategoryPreview[];
  onSelectCategory: (category: string) => void;
  onViewCatalog?: () => void;
  disabled?: boolean;
};

function categoryEmoji(label: string): string {
  const n = label.toLowerCase();
  if (/hamburg|burger|comida principal/.test(n)) return "🍔";
  if (/bebida|drink|refresco|jugo/.test(n)) return "🥤";
  if (/entrada|aperitivo|snack|papas|frita/.test(n)) return "🍟";
  if (/postre|dessert|dulce|torta/.test(n)) return "🍰";
  if (/ensalada/.test(n)) return "🥗";
  if (/pizza/.test(n)) return "🍕";
  if (/café|coffee/.test(n)) return "☕";
  return "🍽️";
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-mesero-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuQuickPanel({ categories, onSelectCategory, onViewCatalog, disabled }: Props) {
  return (
    <section className="flex min-h-[12rem] flex-col overflow-hidden rounded-2xl border border-mesero-line/15 bg-mesero-panel/80 p-4 ring-1 ring-mesero-line/10">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-tight text-mesero-text">Menú rápido</h2>
        {onViewCatalog ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onViewCatalog}
            className="touch-manipulation text-xs font-semibold text-mesero-accent transition-colors hover:text-blue-200 disabled:opacity-50"
          >
            Ver menú completo
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-0.5">
        {categories.length > 0 ? (
          <ul className="space-y-2.5">
            {categories.map((cat) => {
              const emoji = categoryEmoji(cat.label);
              return (
                <li key={cat.category}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectCategory(cat.category)}
                    className="touch-manipulation flex w-full items-center gap-3 rounded-xl border border-mesero-line/15 bg-mesero-deep/30 px-2.5 py-2.5 text-left transition-colors hover:border-mesero-accent/40 hover:bg-mesero-panel/50 disabled:opacity-50"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-mesero-muted ring-1 ring-mesero-line/15">
                      {cat.imageUrl?.trim() ? (
                        <MenuItemImage src={cat.imageUrl} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl">{emoji}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-mesero-text">
                        <span className="mr-1.5" aria-hidden>
                          {emoji}
                        </span>
                        {cat.label}
                      </p>
                      <p className="mt-0.5 text-xs text-mesero-text-muted/80">
                        {cat.itemCount > 0 ? `${cat.itemCount} opciones` : "Ver platos"}
                      </p>
                    </div>
                    <ChevronRight />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-mesero-text-muted/80">No hay categorías en el catálogo.</p>
        )}
      </div>
    </section>
  );
}
