import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CatalogKarenProfile } from "../components/catalog/CatalogSidebarPanel";
import { CatalogOrderSummary } from "../components/catalog/CatalogOrderSummary";
import { RestaurantLogo } from "../components/mesero/RestaurantLogo";
import { useAuth } from "../context/AuthContext";
import { useMesero } from "../context/MeseroContext";
import { useMeseroTheme } from "../context/MeseroThemeContext";
import { ThemeToggleButton } from "../components/mesero/ThemeToggleButton";
import { useRefreshableMenu } from "../hooks/useRefreshableMenu";
import { MenuItemImage } from "../components/mesero/MenuItemImage";
import { sortMenuByCategoryThenName } from "../lib/menuSort";
import { formatMoney, mergedActiveLines, orderTotal } from "../lib/orderDisplayLines";
import { quoteWakeWord } from "../lib/wakeWord";
import type { MenuItem } from "../lib/types";

function formatPrice(n: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("combo") || n.includes("paquete")) return "🍱";
  if (n.includes("hambur")) return "🍔";
  if (n.includes("bebida") || n.includes("refresco")) return "🥤";
  if (n.includes("entrada")) return "🍟";
  if (n.includes("postre")) return "🍰";
  if (n.includes("extra") || n.includes("servicio") || n.includes("producto")) return "➕";
  return "🍽️";
}

function groupByCategory(menu: MenuItem[]) {
  const sorted = sortMenuByCategoryThenName(menu.filter((m) => m.name.trim() && m.available !== false));
  const blocks: { category: string; items: MenuItem[] }[] = [];
  for (const m of sorted) {
    const cat = (m.category || "General").trim() || "General";
    const prev = blocks[blocks.length - 1];
    if (prev?.category === cat) prev.items.push(m);
    else blocks.push({ category: cat, items: [m] });
  }
  return blocks;
}

function ProductCardSkeleton() {
  return (
    <article
      className="flex w-[11.5rem] shrink-0 flex-col overflow-hidden rounded-xl border border-mesero-line/10 bg-mesero-elevated/60 ring-1 ring-mesero-line/5 sm:w-[12.5rem]"
      aria-hidden
    >
      <div className="aspect-[4/3] animate-pulse bg-mesero-panel/50" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-mesero-panel/50" />
        <div className="h-3 w-full animate-pulse rounded bg-mesero-panel/35" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="h-4 w-14 animate-pulse rounded bg-amber-900/30" />
          <div className="h-8 w-16 animate-pulse rounded-lg bg-mesero-accent-strong/40" />
        </div>
      </div>
    </article>
  );
}

function CatalogMenuLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando menú">
      <p className="flex items-center justify-center gap-2 text-sm text-mesero-text-muted">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-mesero-accent/30 border-t-mesero-accent" />
        Cargando menú…
      </p>
      {[0, 1].map((section) => (
        <section key={section}>
          <div className="mb-3 h-5 w-28 animate-pulse rounded bg-mesero-panel/45" />
          <div className="flex gap-3 overflow-x-hidden pb-2">
            {Array.from({ length: 4 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ProductCard({
  item,
  onAdd,
}: {
  item: MenuItem;
  onAdd: () => void;
}) {
  return (
    <article className="flex w-[11.5rem] shrink-0 flex-col overflow-hidden rounded-xl border border-mesero-line/15 bg-mesero-elevated/90 ring-1 ring-mesero-line/10 sm:w-[12.5rem]">
      <div className="relative aspect-[4/3] bg-mesero-muted">
        <MenuItemImage src={item.imageUrl} />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-mesero-text">{item.name}</h3>
        {item.description?.trim() ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-mesero-text-muted">{item.description}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-sm font-bold text-mesero-accent">{formatPrice(item.price)}</span>
          <button
            type="button"
            onClick={onAdd}
            className="btn-mesero-primary touch-manipulation rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
          >
            + Añadir
          </button>
        </div>
      </div>
    </article>
  );
}

export function CatalogScreenPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCat = (searchParams.get("categoria") ?? "").trim();

  const {
    settings,
    listening,
    busy,
    ttsActive,
    supported,
    voiceError,
    touchCart,
    setTouchCart,
    assistantName,
    wakeWord,
    orderInferenceCorpus,
    pendingDraft,
    registerOrderMenu,
  } = useMesero();
  const { theme, toggleTheme } = useMeseroTheme();
  const { companyName: profileCompanyName } = useAuth();

  const { menu, menuLoading } = useRefreshableMenu();

  useEffect(() => {
    registerOrderMenu(menu);
  }, [menu, registerOrderMenu]);
  const restaurantName =
    profileCompanyName || settings?.restaurantName?.trim() || "Mi restaurante";
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const blocks = useMemo(() => groupByCategory(menu), [menu]);
  const categories = useMemo(() => blocks.map((b) => b.category), [blocks]);

  const q = search.trim().toLowerCase();
  const visibleBlocks = useMemo(() => {
    let list = blocks;
    if (activeCat && activeCat !== "todos") list = list.filter((b) => b.category === activeCat);
    if (!q) return list;
    return list
      .map((b) => ({
        ...b,
        items: b.items.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.description ?? "").toLowerCase().includes(q) ||
            b.category.toLowerCase().includes(q),
        ),
      }))
      .filter((b) => b.items.length > 0);
  }, [blocks, activeCat, q]);

  const orderLines = useMemo(
    () => mergedActiveLines(menu, orderInferenceCorpus, touchCart, pendingDraft),
    [menu, orderInferenceCorpus, touchCart, pendingDraft],
  );
  const total = orderTotal(orderLines);
  const orderItemCount = useMemo(() => orderLines.reduce((n, l) => n + l.qty, 0), [orderLines]);

  const bumpItem = useCallback(
    (id: string) => {
      setTouchCart((prev) => {
        const next = { ...prev };
        next[id] = Math.min(99, (next[id] ?? 0) + 1);
        return next;
      });
      setToast(`Añadido. Di ${quoteWakeWord(wakeWord)} para confirmar el pedido.`);
      window.setTimeout(() => setToast(null), 2800);
    },
    [setTouchCart, wakeWord],
  );

  const selectCategory = (cat: string | null) => {
    if (!cat || cat === "todos") setSearchParams({});
    else setSearchParams({ categoria: cat });
  };

  return (
    <div className="flex h-full min-h-0 bg-mesero-bg text-mesero-text">
      <aside className="flex w-[15.5rem] shrink-0 flex-col border-r border-mesero-line/15 bg-mesero-panel/95 lg:w-[17rem]">
        <div className="border-b border-mesero-line/10 p-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="touch-manipulation mb-3 text-xs font-medium text-mesero-accent hover:text-mesero-accent-strong"
          >
            ← Volver al mesero
          </button>
          <div className="flex items-center gap-2">
            <RestaurantLogo size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-mesero-text">{restaurantName}</p>
              <p className="text-[10px] text-mesero-text-muted">{assistantName} · mesera IA</p>
            </div>
            <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
          </div>
        </div>

        <CatalogKarenProfile
          assistantName={assistantName}
          listening={listening}
          busy={busy}
          ttsActive={ttsActive}
          supported={supported}
        />
        {voiceError ? (
          <p className="mx-3 mb-2 text-center text-[10px] leading-snug text-red-300/90">{voiceError}</p>
        ) : null}

        <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Categorías">
          <button
            type="button"
            onClick={() => selectCategory("todos")}
            className={`mb-1 flex w-full touch-manipulation items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${
              !activeCat || activeCat === "todos"
                ? "bg-mesero-active/25 font-semibold text-mesero-text ring-1 ring-mesero-active/40"
                : "text-mesero-text-muted hover:bg-mesero-panel/50"
            }`}
          >
            <span aria-hidden>📋</span>
            Menú completo
          </button>
          {menuLoading
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="mb-1 h-10 animate-pulse rounded-xl bg-mesero-panel/55" aria-hidden />
              ))
            : categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => selectCategory(cat)}
                  className={`mb-1 flex w-full touch-manipulation items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${
                    activeCat === cat
                      ? "bg-mesero-active/25 font-semibold text-mesero-text ring-1 ring-mesero-active/40"
                      : "text-mesero-text-muted hover:bg-mesero-panel/50"
                  }`}
                >
                  <span aria-hidden>{categoryIcon(cat)}</span>
                  <span className="truncate">{cat}</span>
                </button>
              ))}
        </nav>

        <div className="shrink-0 border-t border-mesero-line/15 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-mesero-accent/80">Pedido en curso</p>
          {orderLines.length === 0 ? (
            <p className="mt-2 text-xs text-mesero-accent/50">Sin artículos aún</p>
          ) : (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-mesero-text/85">
              {orderLines.map((l) => (
                <li key={l.menuItemId} className="flex justify-between gap-1">
                  <span className="truncate">
                    {l.name} <span className="text-mesero-accent">×{l.qty}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm font-bold text-mesero-accent">
            {total != null ? formatMoney(total) : "—"}
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="btn-mesero-primary touch-manipulation mt-3 w-full rounded-xl py-2 text-xs font-semibold"
          >
            Volver y pedir con {assistantName}
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-mesero-line/15 bg-mesero-deep/90 px-3 py-3 sm:px-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en el menú…"
            className="min-w-0 flex-1 rounded-xl border border-mesero-line/20 bg-mesero-elevated px-3 py-2.5 text-sm text-mesero-text outline-none focus:border-mesero-accent/40"
          />
          <CatalogOrderSummary itemCount={orderItemCount} total={total} />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
          <p className="mb-4 text-center text-xs text-mesero-accent/60">
            Di {quoteWakeWord(wakeWord)} para pedir desde aquí. Los precios son orientativos.
          </p>
          {menuLoading ? (
            <CatalogMenuLoading />
          ) : visibleBlocks.length === 0 ? (
            <p className="text-center text-sm text-mesero-accent/50">No hay productos que coincidan.</p>
          ) : (
            visibleBlocks.map((block) => (
              <section key={block.category} id={`cat-${block.category}`} className="mb-8">
                <h2 className="mb-3 text-base font-bold text-mesero-text">{block.category}</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 overscroll-x-contain">
                  {block.items.map((item) => (
                    <ProductCard key={item.id} item={item} onAdd={() => bumpItem(item.id)} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {toast ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-xl bg-emerald-900/90 px-4 py-2 text-center text-sm text-emerald-100 ring-1 ring-emerald-600/50">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
