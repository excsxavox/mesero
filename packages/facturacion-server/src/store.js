import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { prepareConfigPatch, sanitizeConfigForApi } from "./configApi.js";
import { decryptSecret } from "./secrets.js";

const DEFAULT_CONFIG = {
  ruc: "",
  razonSocial: "",
  nombreComercial: "",
  direccionMatriz: "",
  establishment: "001",
  emissionPoint: "001",
  ambiente: "1",
  tipoEmision: "1",
  certificatePath: "",
  certificatePassword: "",
  certificateUploaded: false,
  certificateFileName: "",
  emailEmisor: "",
  secuencialActual: 1,
};

export function createBillingStore(dataDir) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "facturacion.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      external_id TEXT,
      payment_id TEXT,
      table_number INTEGER,
      table_label TEXT,
      billing_type TEXT NOT NULL,
      document_type TEXT DEFAULT '01',
      customer_json TEXT,
      lines_json TEXT NOT NULL,
      total REAL,
      secuencial INTEGER,
      access_key TEXT,
      sri_status TEXT,
      sri_messages TEXT,
      authorization_number TEXT,
      xml_path TEXT,
      pdf_path TEXT,
      company_id TEXT,
      branch_id TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(sri_status);
    CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices(payment_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_external ON invoices(external_id);
  `);
  migrateColumns(db, [
    ["external_id", "TEXT"],
    ["document_type", "TEXT DEFAULT '01'"],
    ["secuencial", "INTEGER"],
    ["metadata_json", "TEXT"],
  ]);

  const getConfigRow = db.prepare("SELECT payload FROM billing_config WHERE id = 1");
  const upsertConfig = db.prepare(
    `INSERT INTO billing_config (id, payload, updated_at) VALUES (1, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = datetime('now')`,
  );

  function getConfig() {
    const row = getConfigRow.get();
    if (!row) return { ...DEFAULT_CONFIG };
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(row.payload) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(patch) {
    const next = prepareConfigPatch(patch, getConfig());
    upsertConfig.run(JSON.stringify(next));
    return next;
  }

  function getConfigForApi() {
    return sanitizeConfigForApi(getConfig());
  }

  function getConfigForSigning() {
    const c = getConfig();
    return { ...c, certificatePassword: decryptSecret(c.certificatePassword) };
  }

  function listInvoices({ status, limit = 50 } = {}) {
    let sql = "SELECT * FROM invoices ORDER BY created_at DESC LIMIT ?";
    const params = [Math.min(200, Math.max(1, limit))];
    if (status) {
      sql = "SELECT * FROM invoices WHERE sri_status = ? ORDER BY created_at DESC LIMIT ?";
      params.unshift(status);
    }
    return db.prepare(sql).all(...params).map(rowToInvoice);
  }

  function getInvoice(id) {
    const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    return row ? rowToInvoice(row) : null;
  }

  function createInvoiceRecord(body) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const config = getConfig();
    const secuencial = config.secuencialActual ?? 1;
    saveConfig({ secuencialActual: secuencial + 1 });

    const invoice = {
      id,
      externalId: body.externalId ?? body.paymentId ?? null,
      paymentId: body.paymentId ?? body.externalId ?? null,
      tableNumber: body.tableNumber ?? null,
      tableLabel: body.tableLabel ?? null,
      billingType: body.billingType || "consumidor_final",
      documentType: body.documentType || "01",
      customer: body.customer ?? defaultCustomer(body.billingType),
      lines: body.lines || [],
      total: body.total ?? null,
      metadata: body.metadata ?? {},
      accessKey: null,
      sriStatus: "BORRADOR",
      sriMessages: [],
      authorizationNumber: null,
      xmlPath: null,
      pdfPath: null,
      companyId: body.companyId ?? null,
      branchId: body.branchId ?? null,
      secuencial,
      issueDate: body.issueDate ?? now,
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(
      `INSERT INTO invoices (id, external_id, payment_id, table_number, table_label, billing_type, document_type,
        customer_json, lines_json, total, secuencial, access_key, sri_status, sri_messages, authorization_number,
        xml_path, pdf_path, company_id, branch_id, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'BORRADOR', '[]', NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
    ).run(
      invoice.id,
      invoice.externalId,
      invoice.paymentId,
      invoice.tableNumber,
      invoice.tableLabel,
      invoice.billingType,
      invoice.documentType,
      JSON.stringify(invoice.customer),
      JSON.stringify(invoice.lines),
      invoice.total,
      invoice.secuencial,
      invoice.companyId,
      invoice.branchId,
      JSON.stringify(invoice.metadata),
      invoice.createdAt,
      invoice.updatedAt,
    );

    return invoice;
  }

  /** @deprecated use createInvoiceRecord */
  function createInvoiceDraft(body) {
    return createInvoiceRecord(body);
  }

  function updateInvoice(id, patch) {
    const cur = getInvoice(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    db.prepare(
      `UPDATE invoices SET
        sri_status = ?, sri_messages = ?, authorization_number = ?, access_key = ?, xml_path = ?, pdf_path = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      next.sriStatus,
      JSON.stringify(next.sriMessages || []),
      next.authorizationNumber,
      next.accessKey,
      next.xmlPath,
      next.pdfPath,
      next.updatedAt,
      id,
    );
    return getInvoice(id);
  }

  function getInvoiceByExternalId(externalId) {
    if (!externalId) return null;
    const row = db.prepare("SELECT * FROM invoices WHERE external_id = ? ORDER BY created_at DESC LIMIT 1").get(
      externalId,
    );
    return row ? rowToInvoice(row) : null;
  }

  return {
    getConfig,
    getConfigForApi,
    getConfigForSigning,
    saveConfig,
    listInvoices,
    getInvoice,
    getInvoiceByExternalId,
    createInvoiceRecord,
    createInvoiceDraft,
    updateInvoice,
    dataDir,
  };
}

function migrateColumns(db, columns) {
  const existing = new Set(db.prepare("PRAGMA table_info(invoices)").all().map((c) => c.name));
  for (const [name, type] of columns) {
    if (!existing.has(name)) {
      try {
        db.exec(`ALTER TABLE invoices ADD COLUMN ${name} ${type}`);
      } catch {
        /* */
      }
    }
  }
}

function defaultCustomer(billingType) {
  if (billingType === "factura") {
    return { idType: "RUC", identification: "", name: "", email: "", address: "" };
  }
  return {
    idType: "CONSUMIDOR_FINAL",
    identification: "9999999999999",
    name: "CONSUMIDOR FINAL",
    email: "",
    address: "",
  };
}

function rowToInvoice(row) {
  return {
    id: row.id,
    externalId: row.external_id ?? null,
    paymentId: row.payment_id,
    tableNumber: row.table_number,
    tableLabel: row.table_label,
    billingType: row.billing_type,
    documentType: row.document_type ?? "01",
    customer: JSON.parse(row.customer_json || "{}"),
    lines: JSON.parse(row.lines_json || "[]"),
    total: row.total,
    secuencial: row.secuencial ?? null,
    accessKey: row.access_key,
    sriStatus: row.sri_status,
    sriMessages: JSON.parse(row.sri_messages || "[]"),
    authorizationNumber: row.authorization_number,
    xmlPath: row.xml_path,
    pdfPath: row.pdf_path,
    companyId: row.company_id,
    branchId: row.branch_id,
    metadata: JSON.parse(row.metadata_json || "{}"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
