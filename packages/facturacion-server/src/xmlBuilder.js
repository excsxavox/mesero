/** Genera XML simplificado de factura (estructura base SRI Ecuador — completar con XSD oficial en producción). */

export function buildInvoiceXml({ config, invoice, customer, lines }) {
  const accessKey = invoice.accessKey || `DEMO-${invoice.id}`;
  const total = Number(invoice.total) || 0;
  const itemsXml = (lines || [])
    .map(
      (l, i) => `
    <detalle>
      <codigoPrincipal>${escapeXml(l.menuItemId || `ITEM${i + 1}`)}</codigoPrincipal>
      <descripcion>${escapeXml(l.name)}</descripcion>
      <cantidad>${l.qty}</cantidad>
      <precioUnitario>${(l.unitPrice ?? 0).toFixed(2)}</precioUnitario>
      <precioTotalSinImpuesto>${(l.lineTotal ?? 0).toFixed(2)}</precioTotalSinImpuesto>
    </detalle>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${config.ambiente ?? "1"}</ambiente>
    <tipoEmision>${config.tipoEmision ?? "1"}</tipoEmision>
    <razonSocial>${escapeXml(config.razonSocial)}</razonSocial>
    <nombreComercial>${escapeXml(config.nombreComercial || config.razonSocial)}</nombreComercial>
    <ruc>${escapeXml(config.ruc)}</ruc>
    <claveAcceso>${escapeXml(accessKey)}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${pad3(config.establishment)}</estab>
    <ptoEmi>${pad3(config.emissionPoint)}</ptoEmi>
    <secuencial>${pad9(invoice.secuencial)}</secuencial>
    <dirMatriz>${escapeXml(config.direccionMatriz || "")}</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${invoice.issueDate}</fechaEmision>
    <totalSinImpuestos>${total.toFixed(2)}</totalSinImpuestos>
    <importeTotal>${total.toFixed(2)}</importeTotal>
    <moneda>USD</moneda>
  </infoFactura>
  <infoAdicional>
    <campoAdicional nombre="Email">${escapeXml(customer?.email || "consumidor@final.ec")}</campoAdicional>
    <campoAdicional nombre="Cliente">${escapeXml(customer?.name || "CONSUMIDOR FINAL")}</campoAdicional>
  </infoAdicional>
  <detalles>${itemsXml}
  </detalles>
</factura>`;
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pad3(n) {
  return String(n ?? "001").padStart(3, "0").slice(-3);
}

function pad9(n) {
  return String(n ?? "1").padStart(9, "0").slice(-9);
}
