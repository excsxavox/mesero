import { AsyncLocalStorage } from "node:async_hooks";
import { fetchAiboxProfile, isAccessTokenExpired } from "./aiboxAuth.js";

/** @type {AsyncLocalStorage<{ companyId: string; store: object; save: () => void; branchId?: string | null; accessToken?: string | null }>} */
export const companyStorage = new AsyncLocalStorage();

export function getCompanyContext() {
  return companyStorage.getStore() ?? null;
}

export function getCurrentCompanyId() {
  return companyStorage.getStore()?.companyId ?? null;
}

export function bearerToken(req) {
  const auth = req.headers.authorization;
  return typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

/**
 * Resuelve companyId: header X-Company-Id → perfil AIBox (Bearer) → query → .env
 * @param {import('express').Request} req
 */
export async function resolveCompanyId(req) {
  const header = req.headers["x-company-id"];
  if (typeof header === "string" && header.trim()) return header.trim();

  const q = req.query?.companyId;
  if (typeof q === "string" && q.trim()) return q.trim();

  const token = bearerToken(req);
  if (token && !isAccessTokenExpired(token)) {
    try {
      const profile = await fetchAiboxProfile(token);
      if (profile.companyIdDefault) return profile.companyIdDefault;
    } catch {
      /* */
    }
  }

  const env = String(process.env.AIBOX_COMPANY_ID ?? "").trim();
  return env || null;
}

/**
 * @param {{ get: (id: string) => object; persist: (id: string, slice: object) => void }} storeApi
 */
/** Rutas de auth que no necesitan slice de empresa en store (solo validan JWT / perfil AIBox). */
function isAuthRouteWithoutCompanyStore(path, method) {
  if (path === "/api/auth/login" && method === "POST") return true;
  if (path === "/api/auth/refresh" && method === "POST") return true;
  if (path === "/api/auth/session" && (method === "GET" || method === "POST")) return true;
  if (path === "/api/auth/profile" && method === "GET") return true;
  return false;
}

export function companyContextMiddleware(storeApi) {
  return async (req, res, next) => {
    const path = req.path || "";
    if (isAuthRouteWithoutCompanyStore(path, req.method)) return next();
    if (path === "/api/health") return next();
    if (!path.startsWith("/api/")) return next();

    try {
      const companyId = await resolveCompanyId(req);
      if (!companyId) {
        res.status(400).json({
          error:
            "Falta companyId. Inicia sesión (perfil AIBox) o envía el header X-Company-Id.",
        });
        return;
      }
      const store = storeApi.get(companyId);
      if (store.settings && !store.settings.restaurantName) {
        store.settings.restaurantName = "Mi restaurante";
      }

      let branchId = null;
      let accessToken = null;
      const token = bearerToken(req);
      if (token && !isAccessTokenExpired(token)) {
        accessToken = token;
        try {
          const profile = await fetchAiboxProfile(token);
          branchId = profile.branchIdDefault ?? null;
          if (profile.companyName && store.settings) {
            store.settings.restaurantName = profile.companyName;
          }
        } catch {
          /* */
        }
      }

      req.meseroCompanyId = companyId;
      req.meseroBranchId = branchId;
      req.meseroAccessToken = accessToken;

      companyStorage.run(
        {
          companyId,
          branchId,
          accessToken,
          store,
          save: () => storeApi.persist(companyId, store),
        },
        () => next(),
      );
    } catch (e) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  };
}

/**
 * Tras middlewares que pierden AsyncLocalStorage (p. ej. multer), re-vincula el slice de empresa.
 * @param {{ get: (id: string) => object; persist: (id: string, slice: object) => void }} storeApi
 */
export function withRequestCompanyContext(storeApi) {
  return (req, res, next) => {
    const companyId = req.meseroCompanyId;
    if (!companyId) {
      res.status(400).json({
        error: "Falta companyId. Inicia sesión de nuevo.",
      });
      return;
    }
    const store = storeApi.get(companyId);
    companyStorage.run(
      {
        companyId,
        branchId: req.meseroBranchId ?? null,
        accessToken: req.meseroAccessToken ?? null,
        store,
        save: () => storeApi.persist(companyId, store),
      },
      () => next(),
    );
  };
}
