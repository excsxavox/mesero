import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildInvoiceXml } from "./xmlBuilder.js";

/**
 * Pipeline: venta → XML → firma → SRI → guardar.
 * En desarrollo sin certificado: firma y SRI simulados (AUTORIZADO).
 */

export function generateAccessKey({ config, invoice }) {
  const date = (invoice.issueDate || "").replace(/\//g, "");
  const tipo = "01";
  const ruc = String(config.ruc || "").replace(/\D/g, "").padStart(13, "0").slice(0, 13);
  const amb = String(config.ambiente ?? "1");
  const serie = `${pad3(config.establishment)}${pad3(config.emissionPoint)}`;
  const sec = pad9(invoice.secuencial);
  const cod = String(Math.floor(Math.random() * 99999999)).padStart(8, "0");
  const tipoEmi = String(config.tipoEmision ?? "1");
  const base = `${date}${tipo}${ruc}${amb}${serie}${sec}${cod}${tipoEmi}`;
  const check = modulo11(base);
  return `${base}${check}`;
}

function modulo11(clave) {
  let sum = 0;
  let factor = 2;
  for (let i = clave.length - 1; i >= 0; i--) {
    sum += Number(clave[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return "1";
  return String(mod);
}

function pad3(n) {
  return String(n ?? "001").padStart(3, "0").slice(-3);
}

function pad9(n) {
  return String(n ?? "1").padStart(9, "0").slice(-9);
}

export async function runInvoicePipeline({ config, invoice, customer, lines, dataDir }) {
  const accessKey = generateAccessKey({ config, invoice: { ...invoice, issueDate: formatDateEc(invoice.issueDate) } });
  const xmlUnsigned = buildInvoiceXml({
    config,
    invoice: { ...invoice, accessKey, issueDate: formatDateEc(invoice.issueDate) },
    customer,
    lines,
  });

  const signed = await signXml(xmlUnsigned, config);
  const sriResult = await sendToSri(signed, config);

  const outDir = path.join(dataDir, "invoices", invoice.id);
  fs.mkdirSync(outDir, { recursive: true });
  const xmlPath = path.join(outDir, `${accessKey}.xml`);
  const pdfPath = path.join(outDir, `${accessKey}.pdf`);
  fs.writeFileSync(xmlPath, signed, "utf8");
  fs.writeFileSync(pdfPath, buildSimplePdfPlaceholder(invoice, customer, lines, sriResult), "utf8");

  return {
    accessKey,
    xmlPath,
    pdfPath,
    sriStatus: sriResult.status,
    sriMessages: sriResult.messages,
    authorizationNumber: sriResult.authorizationNumber,
  };
}

function formatDateEc(iso) {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function signXml(xml, config) {
  const certPath = config.certificatePath?.trim();
  if (!certPath || !fs.existsSync(certPath)) {
    return `<!-- FIRMA SIMULADA (configura certificatePath en facturación) -->\n${xml}`;
  }
  // Integración real: node-forge / openssl para .p12
  return `<!-- FIRMA PENDIENTE: cargar certificado ${certPath} -->\n${xml}`;
}

async function sendToSri(signedXml, config) {
  const amb = String(config.ambiente ?? "1");
  if (amb === "1") {
    return {
      status: "AUTORIZADO",
      authorizationNumber: `DEMO-AUTH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      messages: ["Ambiente de pruebas: autorización simulada."],
    };
  }
  // Producción: POST a webservices SRI
  return {
    status: "DEVUELTA",
    authorizationNumber: null,
    messages: ["Configure integración SRI producción (certificatePath + endpoints)."],
  };
}

function buildSimplePdfPlaceholder(invoice, customer, lines, sriResult) {
  const text = [
    "FACTURA ELECTRÓNICA (vista previa)",
    `Estado SRI: ${sriResult.status}`,
    `Cliente: ${customer?.name || "CONSUMIDOR FINAL"}`,
    `Total: $${Number(invoice.total || 0).toFixed(2)}`,
    "",
    ...(lines || []).map((l) => `${l.qty} x ${l.name}`),
  ].join("\n");
  return `%PDF-1.1\n1 0 obj<<>>endobj\n2 0 obj<</Length ${text.length}>>stream\n${text}\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF`;
}
