import { useMemo, useState } from "react";
import type { MenuItem } from "../lib/types";
import { sortMenuByCategoryThenName } from "../lib/menuSort";

type Props = {
  menu: MenuItem[];
  className?: string;
  /** Si se indica, solo muestra platos de esa categoría. */
  filterCategory?: string | null;
};

function formatPrice(n: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function DishPhoto({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-mesero-muted text-[11px] text-mesero-text-muted">
        Sin imagen
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setOk(false)}
    />
  );
}

type CatBlock = { category: string; items: MenuItem[] };

export function MenuVisualPanel({ menu, className = "", filterCategory = null }: Props) {
  const blocks = useMemo(() => {
    const catFilter = (filterCategory ?? "").trim();
    const sorted = sortMenuByCategoryThenName(
      menu.filter((m) => {
        if (!m.name.trim()) return false;
        if (!catFilter) return true;
        return ((m.category || "General").trim() || "General") === catFilter;
      }),
    );
    const out: CatBlock[] = [];
    for (const m of sorted) {
      const category = (m.category || "General").trim() || "General";
      const prev = out[out.length - 1];
      if (prev && prev.category === category) prev.items.push(m);
      else out.push({ category, items: [m] });
    }
    return out;
  }, [menu, filterCategory]);

  if (blocks.length === 0) {
    return (
      <section
        className={`flex flex-col rounded-xl border border-mesero-line/20 bg-mesero-panel/80 p-4 ring-1 ring-mesero-line/15 ${className}`}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-mesero-text-muted">Catálogo</h2>
        <p className="mt-2 text-xs text-mesero-text-muted">No hay platos en esta categoría.</p>
      </section>
    );
  }

  return (
    <section
      className={`flex min-h-0 flex-col rounded-xl border border-mesero-line/20 bg-mesero-panel/80 ring-1 ring-mesero-line/15 ${className}`}
    >
      <div className="shrink-0 border-b border-mesero-line/15 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-mesero-text-muted">
          {filterCategory ? filterCategory : "Catálogo por categorías"}
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-mesero-text-muted">
          Consulta productos. Para pedir, di «Karen» con el micrófono activo.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {blocks.map((block) => (
          <div key={block.category} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-500/90">
              {block.category}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-2">
              {block.items.map((m) => {
                const off = m.available === false;
                const src = (m.imageUrl ?? "").trim();
                return (
                  <article
                    key={m.id}
                    className={`flex flex-col overflow-hidden rounded-lg border border-mesero-line/15 bg-mesero-elevated/80 ring-1 ring-mesero-line/10 ${
                      off ? "opacity-60" : ""
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full bg-mesero-muted">
                      {src ? (
                        <DishPhoto src={src} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] text-mesero-text-muted">
                          Sin imagen
                        </div>
                      )}
                      {off ? (
                        <span className="absolute left-1 top-1 rounded bg-mesero-muted/90 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-200/95 ring-1 ring-amber-700/50">
                          Agotado
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 p-2">
                      <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-mesero-text">{m.name}</h4>
                      <p className="line-clamp-2 text-[10px] leading-snug text-mesero-text-muted">{m.description}</p>
                      <p className="mt-auto pt-1 text-sm font-semibold tabular-nums text-amber-400/95">
                        {formatPrice(m.price)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
