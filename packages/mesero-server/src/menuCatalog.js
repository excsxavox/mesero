import { fetchCommercialOfferings, isCommercialOfferingsConfigured } from "./aiboxOfferings.js";
import { mapOfferingsBodyToMenuItems } from "./aiboxMenuMapping.js";
import { getCompanyContext, getCurrentCompanyId } from "./companyContext.js";
import {
  clearOfferingImages,
  offeringImageProxyPath,
  storeOfferingDataImage,
} from "./offeringImageStore.js";

/** @type {Map<string, { at: number; items: Array<Record<string, unknown>> | null }>} */
const cacheByCompany = new Map();

function cacheTtlMs() {
  const n = Number(process.env.AIBOX_MENU_CACHE_TTL_MS);
  return Number.isFinite(n) && n >= 5000 ? n : 60_000;
}

/** Origen del catálogo expuesto al mesero: AIBox offerings o menú local (store). */
export function catalogSource() {
  return isCommercialOfferingsConfigured() ? "aibox" : "local";
}

function cacheKey(companyId) {
  return companyId || String(process.env.AIBOX_COMPANY_ID ?? "").trim() || "_default";
}

/**
 * Menú activo: si AIBox está configurado, offerings mapeados (con caché por companyId).
 * @param {Array<Record<string, unknown>>} fallbackMenu
 * @param {{ refresh?: boolean; companyId?: string }} [opts]
 */
export async function getResolvedCatalog(fallbackMenu, opts = {}) {
  const companyId = opts.companyId || getCurrentCompanyId() || String(process.env.AIBOX_COMPANY_ID ?? "").trim();
  if (!isCommercialOfferingsConfigured()) return fallbackMenu;

  const key = cacheKey(companyId);
  const ttl = cacheTtlMs();
  const cached = cacheByCompany.get(key);
  if (!opts.refresh && cached?.items && Date.now() - cached.at < ttl) {
    return cached.items;
  }

  try {
    const ctx = getCompanyContext();
    const body = await fetchCommercialOfferings({
      companyId: companyId || undefined,
      admin: true,
      accessToken: ctx?.accessToken ?? undefined,
    });
    clearOfferingImages();
    const items = mapOfferingsBodyToMenuItems(body, {
      storeDataImage: (id, dataUrl) => {
        const version = storeOfferingDataImage(id, dataUrl);
        if (!version) return undefined;
        return offeringImageProxyPath(id, version);
      },
    });
    cacheByCompany.set(key, { at: Date.now(), items });
    return items.length ? items : fallbackMenu;
  } catch {
    return fallbackMenu;
  }
}

export function invalidateCatalogCache(companyId) {
  if (companyId) cacheByCompany.delete(cacheKey(companyId));
  else cacheByCompany.clear();
  clearOfferingImages();
}
