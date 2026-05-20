/**
 * Cuentas abiertas por mesa (pedidos no pagados).
 */

/** @param {string} tableStr */
export function parseTableNumber(tableStr, tableCount) {
  const t = String(tableStr ?? "").trim();
  if (!t) return null;
  const m = t.match(/(\d+)/);
  if (!m) return null;
  const n = Math.round(Number(m[1]));
  if (!Number.isFinite(n) || n < 1 || n > tableCount) return null;
  return n;
}

/**
 * @param {import('./index.js').store} store - not exported, pass orders + tablePaymentRequests + settings
 * @param {{ orders: object[]; tablePaymentRequests: Record<string, { requestedAt: string }>; tableCount: number }} ctx
 * @param {import('./index.js').MenuItem[]} menu
 */
export function computeTableBills(ctx, menu) {
  const { orders, tablePaymentRequests, tableCount } = ctx;
  const priceById = new Map((menu || []).map((m) => [m.id, Number(m.price) || 0]));

  /** @type {Map<number, { tableNumber: number; tableLabel: string; lines: Map<string, { menuItemId: string; name: string; qty: number; unitPrice: number | null; notes: string[] }>; orderIds: string[]; paymentRequestedAt?: string }>} */
  const byTable = new Map();

  for (const o of orders) {
    if (o.status === "pagado") continue;
    const num = parseTableNumber(o.table, tableCount);
    if (!num) continue;

    let bucket = byTable.get(num);
    if (!bucket) {
      bucket = {
        tableNumber: num,
        tableLabel: `Mesa ${num}`,
        lines: new Map(),
        orderIds: [],
      };
      byTable.set(num, bucket);
    }
    if (!bucket.orderIds.includes(o.id)) bucket.orderIds.push(o.id);

    for (const it of o.items || []) {
      const key = `${it.menuItemId}::${it.name}`;
      const unit = priceById.has(it.menuItemId) ? priceById.get(it.menuItemId) : null;
      const hit = bucket.lines.get(key);
      if (hit) {
        hit.qty += Number(it.qty) || 1;
        if (it.notes?.trim()) hit.notes.push(it.notes.trim());
      } else {
        bucket.lines.set(key, {
          menuItemId: it.menuItemId,
          name: it.name,
          qty: Number(it.qty) || 1,
          unitPrice: unit,
          notes: it.notes?.trim() ? [it.notes.trim()] : [],
        });
      }
    }
  }

  const bills = [];
  for (const [num, bucket] of byTable) {
    const lines = [...bucket.lines.values()].map((l) => ({
      menuItemId: l.menuItemId,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.unitPrice != null ? l.unitPrice * l.qty : null,
      notes: l.notes.length ? l.notes : undefined,
    }));
    const total = lines.every((l) => l.lineTotal != null)
      ? lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0)
      : null;
    const req = tablePaymentRequests[String(num)];
    const paymentRequested = Boolean(req?.requestedAt) || (req?.phase && req.phase !== "idle");
    bills.push({
      tableNumber: num,
      tableLabel: bucket.tableLabel,
      lines,
      total,
      orderIds: bucket.orderIds,
      paymentRequested,
      paymentRequestedAt: req?.requestedAt ?? null,
      paymentPhase: req?.phase ?? null,
      billingType: req?.billingType ?? null,
      billingCustomer: req?.customer ?? null,
      invoiceId: req?.invoiceId ?? null,
      itemCount: lines.reduce((s, l) => s + l.qty, 0),
    });
  }

  bills.sort((a, b) => {
    if (a.paymentRequested !== b.paymentRequested) return a.paymentRequested ? -1 : 1;
    return a.tableNumber - b.tableNumber;
  });

  return bills;
}

export function requestTablePayment(store, tableNumber, paymentRequest = null) {
  if (!store.tablePaymentRequests) store.tablePaymentRequests = {};
  const now = new Date().toISOString();
  const prev = store.tablePaymentRequests[String(tableNumber)];
  store.tablePaymentRequests[String(tableNumber)] = {
    requestedAt: now,
    phase: "ready",
    billingType: "consumidor_final",
    customer: {
      idType: "CONSUMIDOR_FINAL",
      identification: "9999999999999",
      name: "CONSUMIDOR FINAL",
      email: "",
      address: "",
    },
    invoiceId: null,
    paymentId: null,
    ...prev,
    ...paymentRequest,
    requestedAt: paymentRequest?.requestedAt ?? prev?.requestedAt ?? now,
  };
}

export function setTablePaymentRequest(store, tableNumber, paymentRequest) {
  if (!store.tablePaymentRequests) store.tablePaymentRequests = {};
  store.tablePaymentRequests[String(tableNumber)] = paymentRequest;
}

export function clearTablePaymentRequest(store, tableNumber) {
  if (store.tablePaymentRequests) {
    delete store.tablePaymentRequests[String(tableNumber)];
  }
}

export function markTablePaid(store, tableNumber, tableCount) {
  const label = `Mesa ${tableNumber}`;
  for (const o of store.orders) {
    const num = parseTableNumber(o.table, tableCount);
    if (num === tableNumber || String(o.table ?? "").trim() === label) {
      if (o.status !== "pagado") {
        o.status = "pagado";
        o.statusChangedAt = new Date().toISOString();
      }
    }
  }
  clearTablePaymentRequest(store, tableNumber);
}
