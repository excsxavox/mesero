/**
 * Convierte la respuesta de GET /api/commercial/offerings al shape de menú del mesero.
 * Los `id` son los UUID de AIBox (ORDER_JSON debe usar esos ids en menuItemId).
 */

/** data-URL pequeñas pueden ir inline; las grandes usan proxy vía `storeDataImage`. */
const MAX_INLINE_IMAGE_CHARS = 120_000;

function resolveCategory(o) {
  const props = o.properties;
  if (props && typeof props === "object" && !Array.isArray(props)) {
    const fromProps = String(props.category ?? props.Category ?? "").trim();
    if (fromProps) return fromProps;
  }
  const type = String(o.type || "product").toLowerCase();
  if (type === "package") return "Paquetes";
  if (type === "service") return "Servicios";
  return "General";
}

/**
 * @param {string | null | undefined} raw
 * @param {{ id: string; storeDataImage?: (id: string, dataUrl: string) => string | undefined }} [opts]
 */
function resolveImageUrl(raw, opts) {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  if (!s.startsWith("data:image/")) return undefined;
  if (opts?.storeDataImage && opts.id) {
    const proxy = opts.storeDataImage(opts.id, s);
    if (proxy) return proxy;
  }
  if (s.length <= MAX_INLINE_IMAGE_CHARS) return s;
  return undefined;
}

function activeBasePrice(o) {
  const prices = Array.isArray(o.prices) ? o.prices : [];
  const activePrice = prices.find((p) => p && Number(p.status) === 1);
  if (activePrice && typeof activePrice.basePrice === "number" && !Number.isNaN(activePrice.basePrice)) {
    return activePrice.basePrice;
  }
  const any = prices.find((p) => p && typeof p.basePrice === "number" && !Number.isNaN(p.basePrice));
  return any?.basePrice ?? 0;
}

/**
 * @param {unknown} body
 * @param {{ storeDataImage?: (id: string, dataUrl: string) => string | undefined }} [opts]
 * @returns {Array<{ id: string; name: string; description: string; price: number; category: string; available?: boolean; imageUrl?: string }>}
 */
export function mapOfferingsBodyToMenuItems(body, opts = {}) {
  const rows = Array.isArray(body?.data) ? body.data : [];
  /** @type {Array<{ id: string; name: string; description: string; price: number; category: string; available?: boolean; imageUrl?: string }>} */
  const out = [];
  const seenIds = new Set();

  for (const o of rows) {
    if (o == null || typeof o !== "object") continue;
    if (o.status != null && Number(o.status) !== 1) continue;

    const id = String(o.id || "").trim();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);

    const name = String(o.name || o.code || "Ítem").trim() || "Ítem";
    const imageUrl = resolveImageUrl(o.image, { id, storeDataImage: opts.storeDataImage });
    const row = {
      id,
      name,
      description: String(o.description || "").trim(),
      price: activeBasePrice(o),
      category: resolveCategory(o),
      available: true,
    };
    if (imageUrl) row.imageUrl = imageUrl;
    out.push(row);
  }

  out.sort((a, b) => {
    const c = a.category.localeCompare(b.category, "es", { sensitivity: "base" });
    if (c !== 0) return c;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });

  return out;
}
