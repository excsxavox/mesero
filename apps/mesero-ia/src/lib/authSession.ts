export type AuthProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  companyName: string;
  branchName: string | null;
  roleName: string | null;
  companyIdDefault: string | null;
  branchIdDefault: string | null;
  companyCode?: string | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string | null;
  email?: string;
  profile?: AuthProfile | null;
};

const STORAGE_KEY = "mesero-auth-session";
const REFRESH_SOON_MS = 90_000;

function formatLoginError(status: number, serverError?: string): string {
  if (serverError?.trim()) return serverError.trim();
  if (status === 502 || status === 503 || status === 504) {
    return "No se pudo conectar con el servidor local (mesero-server). Ejecuta en la raíz del proyecto: npm run dev";
  }
  return `Error de inicio de sesión (${status})`;
}

function decodeJwtExpMs(token: string): number | null {
  try {
    const mid = token.split(".")[1];
    if (!mid) return null;
    const b64 = mid.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64)) as { exp?: number };
    if (typeof json.exp === "number") return json.exp * 1000;
  } catch {
    /* */
  }
  return null;
}

export function isAccessTokenExpiredClient(token: string): boolean {
  const expMs = decodeJwtExpMs(token);
  if (!expMs) return false;
  return Date.now() > expMs + 60_000;
}

function isAccessTokenExpiringSoon(token: string): boolean {
  const expMs = decodeJwtExpMs(token);
  if (!expMs) return false;
  return Date.now() >= expMs - REFRESH_SOON_MS;
}

function readRawSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (typeof parsed?.accessToken !== "string" || !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sessionHeaders(session: AuthSession): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
  };
  const companyId = session.profile?.companyIdDefault?.trim();
  if (companyId) headers["X-Company-Id"] = companyId;
  return headers;
}

/** Sesión en localStorage (access puede estar vencido si hay refreshToken). */
export function getPersistedSession(): AuthSession | null {
  return readRawSession();
}

export function getStoredSession(): AuthSession | null {
  const raw = readRawSession();
  if (!raw) return null;
  if (isAccessTokenExpiredClient(raw.accessToken) && !raw.refreshToken?.trim()) return null;
  return raw;
}

export function setStoredSession(session: AuthSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return getStoredSession()?.accessToken ?? null;
}

export function getCompanyId(): string | null {
  const raw = readRawSession();
  return raw?.profile?.companyIdDefault?.trim() || null;
}

/** POST /api/auth/refresh con el refreshToken guardado del login. */
export async function refreshTokensRequest(refreshToken: string): Promise<AuthSession | null> {
  const rt = refreshToken.trim();
  if (!rt) return null;

  const r = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  });
  const body = (await r.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string | null;
    profile?: AuthProfile | null;
    error?: string;
  };
  if (!r.ok || !body.accessToken) return null;

  const prev = readRawSession();
  const next: AuthSession = {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken ?? rt,
    profile: body.profile ?? prev?.profile ?? null,
    email: body.profile?.email?.trim() || prev?.email,
  };
  setStoredSession(next);
  return next;
}

/** Renueva access si expiró o está por vencer y hay refreshToken. */
export async function ensureValidAccessToken(): Promise<AuthSession | null> {
  const raw = readRawSession();
  if (!raw?.accessToken) return null;

  const needsRefresh =
    isAccessTokenExpiredClient(raw.accessToken) || isAccessTokenExpiringSoon(raw.accessToken);

  if (needsRefresh && raw.refreshToken?.trim()) {
    const renewed = await refreshTokensRequest(raw.refreshToken);
    if (renewed) return renewed;
    if (isAccessTokenExpiredClient(raw.accessToken)) {
      clearStoredSession();
      return null;
    }
  }

  if (isAccessTokenExpiredClient(raw.accessToken)) {
    clearStoredSession();
    return null;
  }

  return raw;
}

export async function loginRequest(email: string, password: string): Promise<AuthSession> {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const body = (await r.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string | null;
    profile?: AuthProfile | null;
    error?: string;
  };
  if (!r.ok) {
    throw new Error(formatLoginError(r.status, body.error));
  }
  if (!body.accessToken) {
    throw new Error("La respuesta no incluye token de acceso.");
  }
  const session: AuthSession = {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken ?? null,
    profile: body.profile ?? null,
    email: body.profile?.email?.trim() || email.trim(),
  };
  setStoredSession(session);
  return session;
}

export async function refreshSession(): Promise<AuthSession | null> {
  const valid = await ensureValidAccessToken();
  if (!valid) return null;

  try {
    const r = await fetch("/api/auth/session", { headers: sessionHeaders(valid) });
    if (r.status === 401) {
      const body = (await r.json().catch(() => ({}))) as { needsRefresh?: boolean };
      if (body.needsRefresh && valid.refreshToken?.trim()) {
        const renewed = await refreshTokensRequest(valid.refreshToken);
        if (renewed) return refreshSession();
      }
      if (isAccessTokenExpiredClient(valid.accessToken)) {
        clearStoredSession();
        return null;
      }
      return valid;
    }
    if (!r.ok) return valid;

    const body = (await r.json().catch(() => ({}))) as { profile?: AuthProfile | null };
    const next: AuthSession = {
      ...valid,
      profile: body.profile ?? valid.profile ?? null,
      email: body.profile?.email?.trim() || valid.email,
    };
    setStoredSession(next);
    return next;
  } catch {
    return valid;
  }
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const session = await ensureValidAccessToken();
  const headers = new Headers(init?.headers);
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);
  const companyId = session?.profile?.companyIdDefault?.trim();
  if (companyId) headers.set("X-Company-Id", companyId);
  return fetch(input, { ...init, headers });
}
