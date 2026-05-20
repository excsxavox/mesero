import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { requireBillingToken } from "./auth.js";
import { emitInvoiceFromPayload } from "./emitService.js";
import { createBillingStore } from "./store.js";
import { runInvoicePipeline } from "./sriPipeline.js";
import { validateAndNormalizeEmitBody, EMIT_INVOICE_SCHEMA } from "./validateEmitRequest.js";
import { mergeEmitterConfig } from "./normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

const DATA_DIR = process.env.BILLING_DATA_DIR || path.join(__dirname, "..", "data");
const PORT = Number(process.env.BILLING_PORT || 3042);

const store = createBillingStore(DATA_DIR);
const CERT_DIR = path.join(DATA_DIR, "certs");
fs.mkdirSync(CERT_DIR, { recursive: true });
const CERT_FILE = path.join(CERT_DIR, "emisor.p12");

const uploadCert = multer({
  storage: multer.diskStorage({
    destination: CERT_DIR,
    filename: (_req, _file, cb) => cb(null, "emisor.p12"),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(p12|pfx)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Solo archivos .p12 o .pfx"));
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

/** Rutas protegidas por token (salvo health y documentación pública del contrato). */
const api = express.Router();
api.use(requireBillingToken);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "facturacion-server",
    version: "1",
    auth: "Bearer token o x-billing-api-key",
  });
});

/** Contrato JSON para integradores externos. */
app.get("/api/v1/schema/emit", (_req, res) => {
  res.json(EMIT_INVOICE_SCHEMA);
});

/**
 * Emisión genérica: recibe todos los datos y crea + envía al SRI en una llamada.
 * Llamable desde cualquier API con el token configurado.
 */
api.post("/v1/invoices/emit", async (req, res) => {
  try {
    const validated = validateAndNormalizeEmitBody(req.body);
    if (!validated.ok) {
      return res.status(validated.status).json({
        error: validated.error,
        details: validated.details,
      });
    }

    const externalId = validated.payload.externalId;
    if (externalId) {
      const existing = store.getInvoiceByExternalId(externalId);
      if (existing?.sriStatus === "AUTORIZADO") {
        return res.json({
          ok: true,
          duplicate: true,
          invoice: existing,
          pipeline: {
            accessKey: existing.accessKey,
            sriStatus: existing.sriStatus,
            authorizationNumber: existing.authorizationNumber,
          },
          emitted: false,
        });
      }
    }

    const result = await emitInvoiceFromPayload(store, validated.payload, DATA_DIR);
    res.status(result.emitted ? 201 : 202).json({ ok: true, ...result });
  } catch (e) {
    console.error("[POST /api/v1/invoices/emit]", e);
    res.status(e.status || 500).json({ error: e.message || "Error al emitir factura" });
  }
});

api.get("/v1/invoices", (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  res.json({ invoices: store.listInvoices({ status, limit }) });
});

api.get("/v1/invoices/:id", (req, res) => {
  const inv = store.getInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: "Factura no encontrada" });
  res.json({ invoice: inv });
});

api.get("/v1/invoices/by-external/:externalId", (req, res) => {
  const inv = store.getInvoiceByExternalId(req.params.externalId);
  if (!inv) return res.status(404).json({ error: "Factura no encontrada" });
  res.json({ invoice: inv });
});

async function handleEmitById(req, res) {
  try {
    const inv = store.getInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: "Factura no encontrada" });
    if (inv.sriStatus === "AUTORIZADO") return res.json({ ok: true, invoice: inv, emitted: false });

    const config = mergeEmitterConfig(store.getConfigForSigning(), req.body?.emitter);
    if (!config.ruc?.trim()) {
      return res.status(400).json({ error: "Configure RUC del emisor en /api/config o envíe emitter" });
    }

    const result = await runInvoicePipeline({
      config,
      invoice: { ...inv, secuencial: inv.secuencial ?? store.getConfig().secuencialActual - 1 },
      customer: inv.customer,
      lines: inv.lines,
      dataDir: DATA_DIR,
    });

    const updated = store.updateInvoice(inv.id, {
      accessKey: result.accessKey,
      sriStatus: result.sriStatus,
      sriMessages: result.sriMessages,
      authorizationNumber: result.authorizationNumber,
      xmlPath: result.xmlPath,
      pdfPath: result.pdfPath,
    });

    res.json({
      ok: true,
      invoice: updated,
      pipeline: result,
      emitted: true,
    });
  } catch (e) {
    console.error("[emit by id]", e);
    res.status(500).json({ error: e.message || "Error al emitir" });
  }
}

api.post("/v1/invoices/:id/emit", handleEmitById);

api.get("/v1/invoices/:id/xml", (req, res) => {
  const inv = store.getInvoice(req.params.id);
  if (!inv?.xmlPath) return res.status(404).json({ error: "XML no disponible" });
  res.sendFile(path.resolve(inv.xmlPath));
});

api.get("/v1/invoices/:id/pdf", (req, res) => {
  const inv = store.getInvoice(req.params.id);
  if (!inv?.pdfPath) return res.status(404).json({ error: "PDF no disponible" });
  res.sendFile(path.resolve(inv.pdfPath));
});

api.get("/config", (_req, res) => {
  res.json({ config: store.getConfigForApi() });
});

api.put("/config", (req, res) => {
  const patch = req.body?.config ?? req.body ?? {};
  store.saveConfig(patch);
  res.json({ config: store.getConfigForApi() });
});

api.post("/config/certificate", uploadCert.single("certificate"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Archivo certificate (.p12) requerido" });
    }
    const pwd = req.body?.certificatePassword;
    const patch = {
      certificatePath: CERT_FILE,
      certificateUploaded: true,
      certificateFileName: req.file.originalname,
    };
    if (pwd && pwd !== "***") patch.certificatePassword = pwd;
    store.saveConfig(patch);
    res.json({ ok: true, config: store.getConfigForApi() });
  } catch (e) {
    res.status(400).json({ error: e.message || "Error al subir certificado" });
  }
});

/** Compatibilidad rutas /api/* anteriores */
api.get("/invoices", (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  res.json({ invoices: store.listInvoices({ status, limit }) });
});

api.get("/invoices/:id", (req, res) => {
  const inv = store.getInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: "Factura no encontrada" });
  res.json({ invoice: inv });
});

api.post("/invoices", (req, res) => {
  const body = req.body || {};
  if (!body.lines?.length && !body.items?.length) {
    return res.status(400).json({ error: "lines requerido" });
  }
  const validated = validateAndNormalizeEmitBody({
    ...body,
    options: { draftOnly: true },
  });
  if (!validated.ok) {
    return res.status(validated.status).json({ error: validated.error, details: validated.details });
  }
  const invoice = store.createInvoiceRecord({
    ...validated.payload,
    total: validated.payload.totals.total,
  });
  res.status(201).json({ invoice });
});

api.post("/invoices/:id/emit", handleEmitById);

app.use("/api", api);

app.listen(PORT, () => {
  console.log(`[facturacion-server] http://localhost:${PORT}`);
  console.log(`  POST /api/v1/invoices/emit  (emisión completa, requiere token)`);
  console.log(`  GET  /api/v1/schema/emit    (contrato JSON)`);
});
