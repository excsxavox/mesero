import { mergeEmitterConfig } from "./normalize.js";
import { runInvoicePipeline } from "./sriPipeline.js";

/**
 * Crea comprobante y opcionalmente ejecuta pipeline SRI.
 * @param {ReturnType<import('./store.js').createBillingStore>} store
 */
export async function emitInvoiceFromPayload(store, payload, dataDir) {
  const storedConfig = store.getConfigForSigning();
  const config = mergeEmitterConfig(storedConfig, payload.emitter);

  if (!config.ruc?.trim()) {
    const err = new Error("Emisor sin RUC: configure /api/config o envíe emitter en el body");
    err.status = 400;
    throw err;
  }

  const draft = store.createInvoiceRecord({
    externalId: payload.externalId,
    paymentId: payload.externalId,
    tableNumber: payload.tableNumber,
    tableLabel: payload.tableLabel,
    billingType: payload.billingType,
    documentType: payload.documentType,
    customer: payload.customer,
    lines: payload.lines,
    total: payload.totals.total,
    companyId: payload.companyId,
    branchId: payload.branchId,
    metadata: payload.metadata,
    issueDate: payload.options.issueDate,
  });

  if (payload.options.draftOnly) {
    return { invoice: draft, pipeline: null, emitted: false };
  }

  const result = await runInvoicePipeline({
    config,
    invoice: {
      ...draft,
      secuencial: draft.secuencial,
      issueDate: payload.options.issueDate,
    },
    customer: payload.customer,
    lines: payload.lines,
    dataDir,
  });

  const updated = store.updateInvoice(draft.id, {
    accessKey: result.accessKey,
    sriStatus: result.sriStatus,
    sriMessages: result.sriMessages,
    authorizationNumber: result.authorizationNumber,
    xmlPath: result.xmlPath,
    pdfPath: result.pdfPath,
  });

  return {
    invoice: updated,
    pipeline: {
      accessKey: result.accessKey,
      sriStatus: result.sriStatus,
      sriMessages: result.sriMessages,
      authorizationNumber: result.authorizationNumber,
      xmlUrl: `/api/v1/invoices/${updated.id}/xml`,
      pdfUrl: `/api/v1/invoices/${updated.id}/pdf`,
    },
    emitted: true,
  };
}
