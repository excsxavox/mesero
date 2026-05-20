import { normalizeCustomer, normalizeLine, computeTotals } from "./normalize.js";

export const EMIT_INVOICE_SCHEMA = {
  endpoint: "POST /api/v1/invoices/emit",
  auth: "Authorization: Bearer <BILLING_API_KEY> | x-billing-api-key",
  required: ["customer", "lines"],
  customer: {
    identification: "string (13 dígitos RUC o 10 cédula; CF usa 9999999999999)",
    name: "string",
    idType: "RUC | CEDULA | CONSUMIDOR_FINAL | 04 | 05 | 07",
    email: "string (recomendado para envío)",
    address: "string opcional",
  },
  lines: [
    {
      code: "string código principal",
      description: "string",
      quantity: "number > 0",
      unitPrice: "number >= 0",
      discount: "number opcional",
      taxCode: "string opcional (2 = IVA)",
      taxRate: "number opcional (ej. 15)",
    },
  ],
  optional: [
    "externalId",
    "companyId",
    "branchId",
    "documentType",
    "billingType",
    "emitter",
    "totals",
    "payment",
    "metadata",
    "options.draftOnly",
    "options.issueDate",
  ],
};

/**
 * @returns {{ ok: true, payload: object } | { ok: false, status: number, error: string, details?: string[] }}
 */
export function validateAndNormalizeEmitBody(body) {
  const errors = [];
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Cuerpo JSON requerido" };
  }

  const billingType = body.billingType === "factura" ? "factura" : "consumidor_final";
  const customer = normalizeCustomer(body.customer, billingType);

  if (billingType === "factura") {
    if (!customer.identification) errors.push("customer.identification es obligatorio para factura");
    if (!customer.name) errors.push("customer.name es obligatorio para factura");
    if (!customer.email) errors.push("customer.email es obligatorio para factura");
  }

  const rawLines = body.lines ?? body.items ?? body.detalles;
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    errors.push("lines[] requiere al menos un ítem");
  }

  const lines = (rawLines || []).map((l, i) => normalizeLine(l, i));
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].name) errors.push(`lines[${i}].description es obligatorio`);
    if (!(lines[i].qty > 0)) errors.push(`lines[${i}].quantity debe ser > 0`);
    if (lines[i].unitPrice < 0) errors.push(`lines[${i}].unitPrice no puede ser negativo`);
  }

  const totals = computeTotals(lines, body.totals);

  if (errors.length) {
    return { ok: false, status: 400, error: "Datos inválidos para emitir factura", details: errors };
  }

  const payload = {
    externalId: body.externalId ?? body.external_id ?? body.paymentId ?? body.payment_id ?? null,
    companyId: body.companyId ?? body.company_id ?? null,
    branchId: body.branchId ?? body.branch_id ?? null,
    documentType: body.documentType ?? body.codDoc ?? "01",
    billingType,
    customer,
    lines,
    totals,
    payment: body.payment ?? { method: "01", term: "0" },
    emitter: body.emitter ?? null,
    metadata: body.metadata ?? {},
    options: {
      draftOnly: Boolean(body.options?.draftOnly ?? body.draftOnly),
      issueDate: body.options?.issueDate ?? body.issueDate ?? new Date().toISOString(),
      sendEmail: Boolean(body.options?.sendEmail),
    },
    tableNumber: body.tableNumber ?? body.table_number ?? null,
    tableLabel: body.tableLabel ?? body.table_label ?? null,
  };

  return { ok: true, payload };
}
