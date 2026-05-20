/** Normaliza líneas y cliente desde distintos formatos de APIs externas. */

const ID_TYPE_MAP = {
  consumidor_final: "07",
  cf: "07",
  ruc: "04",
  cedula: "05",
  cédula: "05",
  pasaporte: "06",
  "04": "04",
  "05": "05",
  "06": "06",
  "07": "07",
};

export function normalizeIdType(raw) {
  const k = String(raw ?? "07")
    .trim()
    .toLowerCase();
  return ID_TYPE_MAP[k] ?? "04";
}

export function normalizeCustomer(raw, billingType) {
  const isCf =
    billingType === "consumidor_final" ||
    raw?.idType === "CONSUMIDOR_FINAL" ||
    raw?.idType === "07";
  if (isCf) {
    return {
      idType: "07",
      idTypeLabel: "CONSUMIDOR_FINAL",
      identification: "9999999999999",
      name: "CONSUMIDOR FINAL",
      email: raw?.email?.trim() || "",
      address: raw?.address?.trim() || "",
      phone: raw?.phone?.trim() || "",
    };
  }
  return {
    idType: normalizeIdType(raw?.idType),
    idTypeLabel: String(raw?.idType ?? "RUC").toUpperCase(),
    identification: String(raw?.identification ?? "").replace(/\s/g, ""),
    name: String(raw?.name ?? raw?.razonSocial ?? "").trim(),
    email: String(raw?.email ?? "").trim(),
    address: String(raw?.address ?? raw?.direccion ?? "").trim(),
    phone: String(raw?.phone ?? raw?.telefono ?? "").trim(),
  };
}

export function normalizeLine(line, index) {
  const qty = Number(line.quantity ?? line.qty ?? 1);
  const unitPrice = Number(line.unitPrice ?? line.precioUnitario ?? 0);
  const discount = Number(line.discount ?? line.descuento ?? 0);
  const lineTotal =
    line.lineTotal != null
      ? Number(line.lineTotal)
      : Math.max(0, qty * unitPrice - discount);

  return {
    menuItemId: line.code ?? line.codigoPrincipal ?? line.menuItemId ?? `ITEM${index + 1}`,
    code: line.code ?? line.codigoPrincipal ?? line.menuItemId ?? `ITEM${index + 1}`,
    name: line.description ?? line.descripcion ?? line.name ?? `Ítem ${index + 1}`,
    qty,
    quantity: qty,
    unitPrice,
    discount,
    lineTotal,
    taxCode: line.taxCode ?? line.codigoImpuesto ?? "2",
    taxRate: Number(line.taxRate ?? line.tarifa ?? 15),
    notes: line.notes ?? line.notas ?? undefined,
  };
}

export function computeTotals(lines, totalsIn) {
  const subtotal = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const tax = totalsIn?.tax != null ? Number(totalsIn.tax) : 0;
  const discount = totalsIn?.discount != null ? Number(totalsIn.discount) : 0;
  const total = totalsIn?.total != null ? Number(totalsIn.total) : subtotal + tax - discount;
  return {
    subtotal: totalsIn?.subtotal != null ? Number(totalsIn.subtotal) : subtotal,
    tax,
    discount,
    total,
  };
}

export function mergeEmitterConfig(stored, override) {
  if (!override || typeof override !== "object") return stored;
  return {
    ...stored,
    ...override,
    ruc: override.ruc ?? stored.ruc,
    razonSocial: override.razonSocial ?? stored.razonSocial,
    nombreComercial: override.nombreComercial ?? stored.nombreComercial,
    direccionMatriz: override.direccionMatriz ?? stored.direccionMatriz,
    establishment: override.establishment ?? override.estab ?? stored.establishment,
    emissionPoint: override.emissionPoint ?? override.ptoEmi ?? stored.emissionPoint,
    ambiente: override.ambiente ?? stored.ambiente,
    tipoEmision: override.tipoEmision ?? stored.tipoEmision,
  };
}
