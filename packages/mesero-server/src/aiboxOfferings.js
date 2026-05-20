import { clearAiboxAuthCache, getAiboxAccessToken, isAiboxAuthConfigured } from "./aiboxAuth.js";

const DEFAULT_ORIGIN = "http://37.60.247.8:15000";

function apiOrigin() {
  const o = String(process.env.AIBOX_API_ORIGIN ?? "").trim();
  if (o) return o.replace(/\/$/, "");
  return DEFAULT_ORIGIN;
}

export function isCommercialOfferingsConfigured() {
  return (
    isAiboxAuthConfigured() ||
    String(process.env.AIBOX_COMPANY_ID ?? "").trim().length > 0 ||
    Boolean(process.env.AIBOX_AUTH_LOGIN_URL || process.env.AIBOX_API_ORIGIN)
  );
}

/**
 * GET /api/commercial/offerings con Bearer (misma respuesta que expone AIBox).
 *
 * @param {{ companyId?: string; admin?: boolean; accessToken?: string }} [opts]
 * @returns {Promise<unknown>} JSON completo (data + result)
 */
export async function fetchCommercialOfferings(opts = {}) {
  const fromOpts = typeof opts.companyId === "string" ? opts.companyId.trim() : "";
  const companyId = fromOpts || String(process.env.AIBOX_COMPANY_ID ?? "").trim();
  if (!companyId) {
    throw new Error("Indica companyId (perfil, header X-Company-Id o AIBOX_COMPANY_ID en .env).");
  }
  const admin = opts.admin !== false;

  const qs = new URLSearchParams({ companyId });
  if (admin) qs.set("admin", "true");
  const url = `${apiOrigin()}/api/commercial/offerings?${qs.toString()}`;

  const doFetch = async (token) =>
    fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

  let token =
    typeof opts.accessToken === "string" && opts.accessToken.trim()
      ? opts.accessToken.trim()
      : null;
  if (!token) {
    if (!isAiboxAuthConfigured()) {
      throw new Error("Sin token de sesión ni credenciales AIBOX en .env para offerings.");
    }
    token = await getAiboxAccessToken();
  }
  let r = await doFetch(token);
  if (r.status === 401 && !opts.accessToken && isAiboxAuthConfigured()) {
    clearAiboxAuthCache();
    token = await getAiboxAccessToken();
    r = await doFetch(token);
  }

  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Offerings AIBox: respuesta no JSON (${r.status}): ${text.slice(0, 240)}`);
  }
  if (!r.ok) {
    const desc = body?.result?.description || body?.message || text;
    throw new Error(`Offerings AIBox HTTP ${r.status}: ${String(desc).slice(0, 400)}`);
  }
  return body;
}
