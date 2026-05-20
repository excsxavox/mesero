/** Cliente HTTP hacia facturacion-server (API genérica v1 + token). */

const BILLING_URL = (process.env.BILLING_URL || "http://localhost:3042").replace(/\/$/, "");
const BILLING_API_KEY = (process.env.BILLING_API_KEY || "").trim();

function authHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  if (BILLING_API_KEY) {
    headers.Authorization = `Bearer ${BILLING_API_KEY}`;
    headers["x-billing-api-key"] = BILLING_API_KEY;
  }
  return headers;
}

async function billingFetch(path, options = {}) {
  const res = await fetch(`${BILLING_URL}${path}`, {
    ...options,
    headers: authHeaders(options.headers),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Billing HTTP ${res.status}`);
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

/**
 * Emisión genérica: envía todos los datos en una sola llamada.
 * @param {object} body - Ver GET {BILLING_URL}/api/v1/schema/emit
 * @param {{ draftOnly?: boolean }} [opts]
 */
export async function emitInvoiceComplete(body, opts = {}) {
  const payload = {
    ...body,
    options: {
      ...(body.options || {}),
      draftOnly: opts.draftOnly ?? body.options?.draftOnly ?? false,
    },
  };
  return billingFetch("/api/v1/invoices/emit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBillingConfig() {
  return billingFetch("/api/config");
}

export async function saveBillingConfig(patch) {
  return billingFetch("/api/config", { method: "PUT", body: JSON.stringify({ config: patch }) });
}

export async function uploadBillingCertificate(fileBuffer, originalname, password) {
  const form = new FormData();
  form.append("certificate", new Blob([fileBuffer], { type: "application/x-pkcs12" }), originalname);
  if (password && password !== "***") {
    form.append("certificatePassword", password);
  }
  const headers = {};
  if (BILLING_API_KEY) {
    headers.Authorization = `Bearer ${BILLING_API_KEY}`;
    headers["x-billing-api-key"] = BILLING_API_KEY;
  }
  const res = await fetch(`${BILLING_URL}/api/config/certificate`, {
    method: "POST",
    body: form,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Billing HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** @deprecated Preferir emitInvoiceComplete */
export async function createInvoiceDraft(body) {
  return billingFetch("/api/invoices", { method: "POST", body: JSON.stringify(body) });
}

/** @deprecated Preferir emitInvoiceComplete con draftOnly:false */
export async function emitInvoice(invoiceId) {
  return billingFetch(`/api/v1/invoices/${encodeURIComponent(invoiceId)}/emit`, { method: "POST" });
}

export async function listInvoices(query = {}) {
  const qs = new URLSearchParams();
  if (query.status) qs.set("status", query.status);
  if (query.limit) qs.set("limit", String(query.limit));
  const q = qs.toString();
  return billingFetch(`/api/v1/invoices${q ? `?${q}` : ""}`);
}

export async function getInvoice(id) {
  return billingFetch(`/api/v1/invoices/${encodeURIComponent(id)}`);
}

export function isBillingConfigured() {
  return Boolean(BILLING_URL);
}

export function isBillingTokenConfigured() {
  return Boolean(BILLING_API_KEY);
}
