/** Caché en memoria de imágenes data-URL de offerings AIBox (clave = offering id). */

/** @type {Map<string, { mime: string; buffer: Buffer }>} */
const byId = new Map();

/** Tamaño máximo del string data-URL a almacenar (~3 MB de JPEG en base64). */
const MAX_DATA_URL_CHARS = 4_000_000;

/**
 * @param {string} dataUrl
 * @returns {{ mime: string; buffer: Buffer } | null}
 */
export function parseDataImageUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const s = dataUrl.trim();
  if (!s.startsWith("data:image/") || s.length > MAX_DATA_URL_CHARS) return null;
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(s);
  if (!m) return null;
  try {
    const buffer = Buffer.from(m[2], "base64");
    if (!buffer.length) return null;
    return { mime: m[1].toLowerCase(), buffer };
  } catch {
    return null;
  }
}

export function clearOfferingImages() {
  byId.clear();
}

/**
 * @param {string} id
 * @param {string} dataUrl
 * @returns {boolean}
 */
export function storeOfferingDataImage(id, dataUrl) {
  const key = String(id || "").trim();
  if (!key) return false;
  const parsed = parseDataImageUrl(dataUrl);
  if (!parsed) return false;
  byId.set(key, parsed);
  return true;
}

/**
 * @param {string} id
 * @returns {{ mime: string; buffer: Buffer } | null}
 */
export function getOfferingImage(id) {
  const key = String(id || "").trim();
  return key ? byId.get(key) ?? null : null;
}

export function offeringImageProxyPath(id) {
  const key = String(id || "").trim();
  return key ? `/api/menu/items/${encodeURIComponent(key)}/image` : "";
}
