/**
 * Autenticación por token para APIs de facturación.
 * Acepta: Authorization: Bearer <token>, x-billing-api-key, x-api-key
 */

const API_KEY = (process.env.BILLING_API_KEY || "").trim();
const REQUIRE_AUTH = process.env.BILLING_REQUIRE_AUTH !== "false";

export function extractBearerToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const h =
    req.headers["x-billing-api-key"] ||
    req.headers["x-api-key"] ||
    req.query?.apiKey;
  return typeof h === "string" ? h.trim() : "";
}

export function isAuthConfigured() {
  return Boolean(API_KEY);
}

export function requireBillingToken(req, res, next) {
  if (!REQUIRE_AUTH && !API_KEY) {
    console.warn("[facturacion] BILLING_API_KEY no configurada — API abierta (solo desarrollo)");
    return next();
  }
  if (!API_KEY) {
    return res.status(503).json({
      error: "Servicio de facturación sin token configurado (BILLING_API_KEY)",
    });
  }
  const token = extractBearerToken(req);
  if (!token || token !== API_KEY) {
    return res.status(401).json({
      error: "Token inválido o ausente",
      hint: "Use Authorization: Bearer <token> o header x-billing-api-key",
    });
  }
  next();
}
