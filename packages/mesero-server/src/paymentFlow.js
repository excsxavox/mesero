/** Flujo conversacional de cobro: consumidor final vs factura + datos del cliente. */

const CF_PATTERNS =
  /\b(consumidor\s*final|sin\s*factura|no\s*necesito\s*factura|solo\s*recibo|cf\b)\b/i;
const FACTURA_PATTERNS =
  /\b(factura|con\s*factura|necesito\s*factura|facturar|factura\s*electr[oó]nica)\b/i;
const RUC_PATTERN = /\b(\d{10}|\d{13})\b/;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export function emptyPaymentRequest() {
  return {
    requestedAt: null,
    phase: "idle",
    billingType: null,
    customer: null,
    invoiceId: null,
    paymentId: null,
  };
}

export function normalizePaymentRequest(raw) {
  if (!raw || typeof raw !== "object") return emptyPaymentRequest();
  return {
    requestedAt: raw.requestedAt ?? null,
    phase: raw.phase || "idle",
    billingType: raw.billingType ?? null,
    customer: raw.customer ?? null,
    invoiceId: raw.invoiceId ?? null,
    paymentId: raw.paymentId ?? null,
  };
}

export function startPaymentFlow(tableNum, existing) {
  const now = new Date().toISOString();
  if (existing?.phase && existing.phase !== "idle" && existing.phase !== "invoiced") {
    return { ...normalizePaymentRequest(existing), tableNumber: tableNum };
  }
  return {
    tableNumber: tableNum,
    requestedAt: now,
    phase: "awaiting_billing_type",
    billingType: null,
    customer: null,
    invoiceId: null,
    paymentId: null,
  };
}

/**
 * Procesa el mensaje del cliente durante el cobro.
 * @returns {{ request, assistantReply, done: boolean }}
 */
export function advancePaymentFlow({ userText, request, assistantName = "Karen" }) {
  const text = String(userText || "").trim();
  const req = normalizePaymentRequest(request);

  if (req.phase === "idle") {
    return { request: req, assistantReply: null, done: false };
  }

  if (req.phase === "awaiting_billing_type") {
    if (FACTURA_PATTERNS.test(text)) {
      const next = {
        ...req,
        phase: "collecting_customer",
        billingType: "factura",
        customer: { idType: "RUC", identification: "", name: "", email: "", address: "" },
      };
      return {
        request: next,
        assistantReply: `Perfecto, preparo la factura. Indíqueme por favor: **RUC o cédula**, **razón social o nombre**, **correo electrónico** y, si desea, **dirección**. Puede decirlo en una sola frase.`,
        done: false,
      };
    }
    if (CF_PATTERNS.test(text)) {
      const next = {
        ...req,
        phase: "ready",
        billingType: "consumidor_final",
        customer: {
          idType: "CONSUMIDOR_FINAL",
          identification: "9999999999999",
          name: "CONSUMIDOR FINAL",
          email: "",
          address: "",
        },
      };
      return {
        request: next,
        assistantReply: `Listo, registro el pago como **consumidor final**. La cuenta ya está en caja; en un momento le atienden.`,
        done: true,
      };
    }
    return {
      request: req,
      assistantReply: `Para cerrar la cuenta, ¿desea factura con datos o **consumidor final**?`,
      done: false,
    };
  }

  if (req.phase === "collecting_customer") {
    const customer = { ...(req.customer || {}) };
    const ruc = text.match(RUC_PATTERN);
    if (ruc) customer.identification = ruc[1];
    const email = text.match(EMAIL_PATTERN);
    if (email) customer.email = email[0];
    if (!customer.name && text.length > 8 && !RUC_PATTERN.test(text) && !EMAIL_PATTERN.test(text)) {
      customer.name = text.replace(RUC_PATTERN, "").replace(EMAIL_PATTERN, "").trim() || customer.name;
    }
    if (text.toLowerCase().includes("cédula") || text.toLowerCase().includes("cedula")) {
      customer.idType = "CEDULA";
    }

    const missing = [];
    if (!customer.identification) missing.push("RUC o cédula");
    if (!customer.name?.trim()) missing.push("razón social o nombre");
    if (!customer.email?.trim()) missing.push("correo electrónico");

    if (missing.length) {
      return {
        request: { ...req, customer },
        assistantReply: `Me falta: ${missing.join(", ")}. ¿Puede proporcionarlos?`,
        done: false,
      };
    }

    const next = { ...req, customer, phase: "ready", billingType: "factura" };
    return {
      request: next,
      assistantReply: `Gracias. Registré los datos de facturación a nombre de **${customer.name}**. La cuenta está en caja para emitir su factura electrónica.`,
      done: true,
    };
  }

  return { request: req, assistantReply: null, done: false };
}

export function paymentFlowPromptBlock(request, tableNum) {
  const req = normalizePaymentRequest(request);
  if (req.phase === "idle") return "";
  return `
## Cobro en curso (mesa ${tableNum})
Fase: ${req.phase}
Tipo: ${req.billingType || "pendiente"}
Cliente: ${req.customer ? JSON.stringify(req.customer) : "—"}
Si el cliente aún no eligió, pregunta solo: consumidor final o factura con datos.
No confirmes pedidos de comida en este flujo.`;
}

export function parsePaymentBillingJson(content) {
  const m = content.match(/```(?:json)?\s*([\s\S]*?PAYMENT_BILLING_JSON[\s\S]*?)```/i);
  if (!m) return null;
  try {
    const jsonMatch = m[1].match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}
