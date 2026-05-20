/**
 * Cliente de login contra el API de seguridad (AIBox / mismo contrato que Postman).
 * Credenciales y URL por variables de entorno; no hardcodear secretos en código.
 *
 * @typedef {{ accessToken: string; refreshToken?: string | null; user?: unknown; raw: unknown }} AiboxLoginResult
 */

const DEFAULT_LOGIN_URL = "http://37.60.247.8:15000/api/security/auth/login";
const DEFAULT_PROFILE_URL = "http://37.60.247.8:15000/api/security/profile";
/** Margen antes del exp del JWT para renovar el token en caché (ms). */
const EXPIRY_SAFETY_MS = 90_000;
/** Si el JWT no trae `exp`, re-login cada esta cantidad de ms. */
const FALLBACK_TTL_MS = 45 * 60 * 1000;

/** @type {{ accessToken: string | null; refreshToken: string | null; expiresAtMs: number }} */
let cache = { accessToken: null, refreshToken: null, expiresAtMs: 0 };

function loginUrl() {
  const u = process.env.AIBOX_AUTH_LOGIN_URL || process.env.AIBOX_AUTH_URL || DEFAULT_LOGIN_URL;
  return String(u).trim();
}

function credentials() {
  const email = String(process.env.AIBOX_AUTH_EMAIL ?? "").trim();
  const password = String(process.env.AIBOX_AUTH_PASSWORD ?? "").trim();
  if (!email || !password) return null;
  return { email, password };
}

/**
 * Decodifica `exp` del JWT (sin verificar firma; solo planificación de caché).
 * @param {string} token
 * @returns {number | null} exp en ms desde epoch, o null
 */
function decodeJwtExpMs(token) {
  try {
    const mid = token.split(".")[1];
    if (!mid) return null;
    const json = JSON.parse(Buffer.from(mid, "base64url").toString("utf8"));
    if (typeof json.exp === "number") return json.exp * 1000;
  } catch {
    /* */
  }
  return null;
}

export function isAiboxAuthConfigured() {
  return credentials() !== null;
}

export function getAiboxLoginUrl() {
  return loginUrl();
}

function profileUrl() {
  const explicit = String(process.env.AIBOX_AUTH_PROFILE_URL ?? "").trim();
  if (explicit) return explicit;
  const login = loginUrl();
  if (login.includes("/auth/login")) return login.replace("/auth/login", "/profile");
  const origin = String(process.env.AIBOX_API_ORIGIN ?? "http://37.60.247.8:15000").trim().replace(/\/$/, "");
  return `${origin}/api/security/profile`;
}

export function getAiboxProfileUrl() {
  return profileUrl();
}

function refreshTokenUrl() {
  const explicit = String(process.env.AIBOX_AUTH_REFRESH_URL ?? "").trim();
  if (explicit) return explicit;
  const login = loginUrl();
  // Mantener /auth/ en la ruta (no usar .../security/refresh-token — da 404 en AIBox).
  if (login.includes("/auth/login")) return login.replace("/auth/login", "/auth/refresh-token");
  const origin = String(process.env.AIBOX_API_ORIGIN ?? "http://37.60.247.8:15000").trim().replace(/\/$/, "");
  return `${origin}/api/security/auth/refresh-token`;
}

export function getAiboxRefreshTokenUrl() {
  return refreshTokenUrl();
}

/**
 * Renueva access/refresh con el refresh token del login AIBox.
 * @param {string} refreshToken
 * @returns {Promise<AiboxLoginResult>}
 */
export async function refreshAiboxTokens(refreshToken) {
  const rt = String(refreshToken ?? "").trim();
  if (!rt) {
    throw new Error("refreshToken requerido.");
  }
  const url = refreshTokenUrl();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ refreshToken: rt }),
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Refresh AIBox: respuesta no JSON (${r.status}): ${text.slice(0, 240)}`);
  }
  if (!r.ok) {
    const desc = body?.result?.description || body?.message || text;
    throw new Error(`Refresh AIBox HTTP ${r.status}: ${String(desc).slice(0, 400)}`);
  }
  const access = body?.data?.accessToken;
  const refresh = body?.data?.refreshToken ?? rt;
  if (typeof access !== "string" || !access) {
    throw new Error("Refresh AIBox: la respuesta no incluye data.accessToken.");
  }
  const result = {
    accessToken: access,
    refreshToken: typeof refresh === "string" ? refresh : null,
    user: body?.data?.user ?? null,
    raw: body,
  };
  const expMs = decodeJwtExpMs(access);
  const expiresAtMs = expMs ? expMs - EXPIRY_SAFETY_MS : Date.now() + FALLBACK_TTL_MS;
  cache = {
    accessToken: access,
    refreshToken: typeof refresh === "string" ? refresh : null,
    expiresAtMs,
  };
  return result;
}

/**
 * @param {unknown} body
 */
export function normalizeAiboxProfile(body) {
  const user = body?.data?.user;
  if (!user || typeof user !== "object") {
    throw new Error("Perfil AIBox: respuesta sin data.user.");
  }
  const companies = Array.isArray(user.companies) ? user.companies : [];
  const defaultCo =
    companies.find((c) => c && c.id === user.companyIdDefault) || companies[0] || null;
  const branches = Array.isArray(defaultCo?.branches) ? defaultCo.branches : [];
  const branch =
    branches.find((b) => b && b.id === user.branchIdDefault) || branches[0] || null;
  const roles = Array.isArray(defaultCo?.roles) ? defaultCo.roles : [];
  const role = roles[0] || null;
  const firstName = String(user.firstName ?? "").trim();
  const lastName = String(user.lastName ?? "").trim();
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || String(user.email ?? "").trim();

  return {
    id: String(user.id ?? ""),
    email: String(user.email ?? "").trim(),
    firstName,
    lastName,
    displayName,
    companyIdDefault: user.companyIdDefault ? String(user.companyIdDefault) : null,
    branchIdDefault: user.branchIdDefault ? String(user.branchIdDefault) : null,
    companyName: String(defaultCo?.name ?? "").trim() || "Mi restaurante",
    branchName: branch?.name ? String(branch.name).trim() : null,
    roleName: role?.name ? String(role.name).trim() : null,
    companyCode: defaultCo?.code ? String(defaultCo.code).trim() : null,
    companies,
  };
}

/**
 * @param {string} accessToken
 */
export async function fetchAiboxProfile(accessToken) {
  const token = String(accessToken ?? "").trim();
  if (!token) throw new Error("Token de acceso requerido para obtener el perfil.");
  const url = profileUrl();
  const r = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Perfil AIBox: respuesta no JSON (${r.status}): ${text.slice(0, 240)}`);
  }
  if (!r.ok) {
    const desc = body?.result?.description || body?.message || text;
    throw new Error(`Perfil AIBox HTTP ${r.status}: ${String(desc).slice(0, 400)}`);
  }
  return normalizeAiboxProfile(body);
}

/**
 * Login con email/contraseña (UI o .env).
 * @param {string} email
 * @param {string} password
 * @param {{ updateServerCache?: boolean }} [opts]
 * @returns {Promise<AiboxLoginResult>}
 */
export async function loginWithCredentials(email, password, opts = {}) {
  const e = String(email ?? "").trim();
  const p = String(password ?? "");
  if (!e || !p) {
    throw new Error("Email y contraseña son obligatorios.");
  }
  const url = loginUrl();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email: e, password: p }),
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Login AIBox: respuesta no JSON (${r.status}): ${text.slice(0, 240)}`);
  }
  if (!r.ok) {
    const desc = body?.result?.description || body?.message || text;
    throw new Error(`Login AIBox HTTP ${r.status}: ${String(desc).slice(0, 400)}`);
  }
  const access = body?.data?.accessToken;
  const refresh = body?.data?.refreshToken ?? null;
  if (typeof access !== "string" || !access) {
    throw new Error("Login AIBox: la respuesta no incluye data.accessToken.");
  }
  const result = {
    accessToken: access,
    refreshToken: typeof refresh === "string" ? refresh : null,
    user: body?.data?.user ?? null,
    raw: body,
  };
  if (opts.updateServerCache !== false) {
    const expMs = decodeJwtExpMs(access);
    const expiresAtMs = expMs ? expMs - EXPIRY_SAFETY_MS : Date.now() + FALLBACK_TTL_MS;
    cache = {
      accessToken: access,
      refreshToken: typeof refresh === "string" ? refresh : null,
      expiresAtMs,
    };
  }
  return result;
}

/** Margen de reloj al validar exp del JWT (ms). */
const JWT_CLOCK_SKEW_MS = 60_000;

/** @param {string} token */
export function isAccessTokenExpired(token) {
  const expMs = decodeJwtExpMs(token);
  if (!expMs) return false;
  return Date.now() > expMs + JWT_CLOCK_SKEW_MS;
}

/** @param {string} token @param {number} [withinMs] */
export function isAccessTokenExpiringSoon(token, withinMs = EXPIRY_SAFETY_MS) {
  const expMs = decodeJwtExpMs(token);
  if (!expMs) return false;
  return Date.now() >= expMs - withinMs;
}

/**
 * Fuerza un POST de login y actualiza la caché.
 * @returns {Promise<AiboxLoginResult>}
 */
export async function fetchAiboxAuthToken() {
  const cred = credentials();
  if (!cred) {
    throw new Error("Configura AIBOX_AUTH_EMAIL y AIBOX_AUTH_PASSWORD en .env para usar el login AIBox.");
  }
  return loginWithCredentials(cred.email, cred.password, { updateServerCache: true });
}

/**
 * Devuelve un access token válido, reutilizando caché hasta cerca del vencimiento del JWT.
 * @returns {Promise<string>}
 */
export async function getAiboxAccessToken() {
  if (cache.accessToken && Date.now() < cache.expiresAtMs) {
    return cache.accessToken;
  }
  if (cache.refreshToken && cache.accessToken && isAccessTokenExpiringSoon(cache.accessToken)) {
    try {
      const t = await refreshAiboxTokens(cache.refreshToken);
      return t.accessToken;
    } catch {
      /* re-login con .env */
    }
  }
  const t = await fetchAiboxAuthToken();
  return t.accessToken;
}

/** Limpia caché (p. ej. tras 401 en un API que use este token). */
export function clearAiboxAuthCache() {
  cache = { accessToken: null, refreshToken: null, expiresAtMs: 0 };
}
