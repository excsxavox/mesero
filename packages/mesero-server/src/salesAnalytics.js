/**
 * Analytics de ventas: catálogo (GET /api/menu), pedidos pagados e historial de cobros.
 */

function dayBounds(dateStr) {
  const d = dateStr || new Date().toISOString().slice(0, 10);
  const start = new Date(`${d}T00:00:00`);
  const end = new Date(`${d}T23:59:59.999`);
  return { dateFrom: d, dateTo: d, start, end };
}

/** Rango inclusivo por fechas YYYY-MM-DD (intercambia si vienen invertidas). */
export function resolveDateRange(fromStr, toStr, fallbackDate) {
  const today = new Date().toISOString().slice(0, 10);
  const a = String(fromStr ?? "").trim() || String(toStr ?? "").trim() || fallbackDate || today;
  const b = String(toStr ?? "").trim() || String(fromStr ?? "").trim() || fallbackDate || today;
  const dateFrom = a <= b ? a : b;
  const dateTo = a <= b ? b : a;
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T23:59:59.999`);
  return { dateFrom, dateTo, start, end, isSingleDay: dateFrom === dateTo };
}

function isInRange(iso, start, end) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function productsSummaryFromLines(lines, maxLen = 48) {
  const s = (lines || [])
    .map((l) => `${l.qty} ${l.name}`)
    .join(", ");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

/**
 * @param {object[]} paymentEntries
 * @param {object[]} menu
 * @param {number} limit
 */
function aggregateProductsFromPayments(paymentEntries, menu, limit = 12) {
  const metaById = new Map((menu || []).map((m) => [m.id, m]));
  /** @type {Map<string, { menuItemId: string; name: string; qty: number; revenue: number }>} */
  const agg = new Map();

  for (const entry of paymentEntries) {
    for (const line of entry.lines || []) {
      const id = String(line.menuItemId || line.name || "").trim();
      if (!id) continue;
      const hit = agg.get(id) || {
        menuItemId: line.menuItemId || id,
        name: line.name,
        qty: 0,
        revenue: 0,
      };
      hit.qty += Number(line.qty) || 1;
      if (line.lineTotal != null) hit.revenue += Number(line.lineTotal) || 0;
      else if (line.unitPrice != null) hit.revenue += Number(line.unitPrice) * hit.qty;
      agg.set(id, hit);
    }
  }

  return [...agg.values()]
    .map((row) => {
      const m = metaById.get(row.menuItemId);
      return {
        menuItemId: row.menuItemId,
        name: m?.name?.trim() || row.name,
        category: m?.category?.trim() || null,
        imageUrl: m?.imageUrl?.trim() || null,
        qtySold: row.qty,
        revenue: row.revenue > 0 ? round2(row.revenue) : null,
      };
    })
    .sort((a, b) => b.qtySold - a.qtySold)
    .slice(0, limit);
}

/**
 * @param {object[]} orders
 * @param {object[]} menu
 * @param {{ limit?: number }} opts
 */
export function computeTopProducts(orders, menu, opts = {}) {
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 12));
  const priceById = new Map((menu || []).map((m) => [m.id, Number(m.price) || 0]));
  const metaById = new Map((menu || []).map((m) => [m.id, m]));

  /** @type {Map<string, { menuItemId: string; name: string; qty: number; revenue: number; orderCount: number }>} */
  const agg = new Map();

  for (const o of orders) {
    if (o.status !== "pagado") continue;
    for (const it of o.items || []) {
      const id = String(it.menuItemId || "").trim() || String(it.name || "").trim();
      if (!id) continue;
      const hit = agg.get(id) || {
        menuItemId: it.menuItemId || id,
        name: it.name || id,
        qty: 0,
        revenue: 0,
        orderCount: 0,
      };
      const q = Number(it.qty) || 1;
      hit.qty += q;
      hit.orderCount += 1;
      const unit = priceById.get(it.menuItemId);
      if (unit != null && !Number.isNaN(unit)) hit.revenue += unit * q;
      agg.set(id, hit);
    }
  }

  const ranked = [...agg.values()]
    .map((row) => {
      const m = metaById.get(row.menuItemId);
      return {
        menuItemId: row.menuItemId,
        name: m?.name?.trim() || row.name,
        category: m?.category?.trim() || null,
        imageUrl: m?.imageUrl?.trim() || null,
        unitPrice: m?.price != null ? Number(m.price) : null,
        qtySold: row.qty,
        revenue: row.revenue > 0 ? round2(row.revenue) : null,
        orderLines: row.orderCount,
      };
    })
    .sort((a, b) => b.qtySold - a.qtySold || (b.revenue ?? 0) - (a.revenue ?? 0))
    .slice(0, limit);

  const totalRevenue = ranked.reduce((s, r) => s + (r.revenue ?? 0), 0);

  return {
    products: ranked,
    summary: {
      paidOrderCount: orders.filter((o) => o.status === "pagado").length,
      distinctProducts: agg.size,
      totalUnitsSold: [...agg.values()].reduce((s, r) => s + r.qty, 0),
      totalRevenue: totalRevenue > 0 ? round2(totalRevenue) : null,
      catalogSize: (menu || []).length,
    },
  };
}

/** @param {object[]} paymentHistory */
export function analyticsFromPaymentHistory(paymentHistory) {
  const entries = Array.isArray(paymentHistory) ? paymentHistory : [];
  const totalRevenue = entries.reduce((s, e) => s + (Number(e.total) || 0), 0);
  return {
    paymentsCount: entries.length,
    totalRevenue: totalRevenue > 0 ? round2(totalRevenue) : 0,
  };
}

function avgPrepTimeMs(orders, orderIdsInDay) {
  const ids = new Set(orderIdsInDay);
  const durations = [];
  for (const o of orders) {
    if (!ids.has(o.id)) continue;
    const created = new Date(o.createdAt).getTime();
    const end = o.statusChangedAt ? new Date(o.statusChangedAt).getTime() : created;
    const d = end - created;
    if (d > 0 && d < 3600_000 * 2) durations.push(d);
  }
  if (!durations.length) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

function formatPrepMs(ms) {
  if (ms == null) return null;
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function salesByHour(paymentEntries) {
  const hours = [];
  for (let h = 10; h <= 22; h++) hours.push({ hour: h, label: `${h}:00`, total: 0 });
  for (const e of paymentEntries) {
    const d = new Date(e.paidAt);
    const h = d.getHours();
    const bucket = hours.find((x) => x.hour === h);
    if (bucket) bucket.total += Number(e.total) || 0;
  }
  return hours.map((x) => ({ ...x, total: round2(x.total) }));
}

function pctChange(current, previous) {
  if (previous == null || previous === 0) return current > 0 ? 100 : 0;
  return round2(((current - previous) / previous) * 100);
}

/**
 * Panel de control: métricas del día, gráficos e historial de pagos.
 * @param {object[]} orders
 * @param {object[]} paymentHistory
 * @param {object[]} menu
 * @param {{ date?: string; dateFrom?: string; dateTo?: string }} opts
 */
export function computeDashboard(orders, paymentHistory, menu, opts = {}) {
  const range =
    opts.dateFrom || opts.dateTo
      ? resolveDateRange(opts.dateFrom, opts.dateTo, opts.date)
      : dayBounds(opts.date);
  const { start, end, dateFrom, dateTo, isSingleDay } = range;
  const allPayments = Array.isArray(paymentHistory) ? paymentHistory : [];

  const dayPayments = allPayments.filter((e) => isInRange(e.paidAt, start, end));

  let yesterdayPayments;
  if (isSingleDay) {
    const yesterday = new Date(start);
    yesterday.setDate(yesterday.getDate() - 1);
    const yBounds = dayBounds(yesterday.toISOString().slice(0, 10));
    yesterdayPayments = allPayments.filter((e) => isInRange(e.paidAt, yBounds.start, yBounds.end));
  } else {
    const spanMs = end.getTime() - start.getTime() + 1;
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs + 1);
    yesterdayPayments = allPayments.filter((e) => isInRange(e.paidAt, prevStart, prevEnd));
  }

  const totalSales = dayPayments.reduce((s, e) => s + (Number(e.total) || 0), 0);
  const yesterdaySales = yesterdayPayments.reduce((s, e) => s + (Number(e.total) || 0), 0);
  const unitsSold = dayPayments.reduce(
    (s, e) => s + (e.itemCount ?? (e.lines || []).reduce((a, l) => a + l.qty, 0)),
    0,
  );

  const topProducts = aggregateProductsFromPayments(dayPayments, menu, 8);
  const topProduct = topProducts[0] ?? null;

  const orderIdsToday = dayPayments.flatMap((e) => e.orderIds || []);
  const prepMs = avgPrepTimeMs(orders, orderIdsToday);
  const yesterdayOrderIds = yesterdayPayments.flatMap((e) => e.orderIds || []);
  const yesterdayPrepMs = avgPrepTimeMs(orders, yesterdayOrderIds);

  const liveOrderCount = orders.filter((o) => o.status !== "pagado" && o.status !== "entregado").length;
  const inKitchenCount = orders.filter((o) =>
    ["nuevo", "preparando", "listo"].includes(o.status),
  ).length;

  const paymentRows = dayPayments.slice(0, 20).map((e, i) => {
    const oid = e.orderIds?.[0] || e.id;
    const short = String(oid).replace(/\D/g, "").slice(-4) || String(i + 1);
    return {
      id: e.id,
      orderLabel: `#${short}`,
      tableLabel: e.tableLabel,
      paidAt: e.paidAt,
      productsSummary: productsSummaryFromLines(e.lines),
      total: e.total,
      paymentMethod: e.paymentMethod || "efectivo",
      status: "pagado",
    };
  });

  return {
    date: dateFrom,
    dateFrom,
    dateTo,
    metrics: {
      totalSales: round2(totalSales),
      totalSalesChangePct: pctChange(totalSales, yesterdaySales),
      paidOrders: dayPayments.length,
      paidOrdersChangePct: pctChange(dayPayments.length, yesterdayPayments.length),
      topProductName: topProduct?.name ?? "—",
      topProductUnits: topProduct?.qtySold ?? 0,
      avgPrepTime: formatPrepMs(prepMs),
      avgPrepTimeChangeMs:
        prepMs != null && yesterdayPrepMs != null ? prepMs - yesterdayPrepMs : null,
    },
    topProducts,
    salesByHour: salesByHour(dayPayments),
    paymentRows,
    daySummary: {
      totalOrders: dayPayments.length,
      unitsSold,
      totalSales: round2(totalSales),
      averageTicket: dayPayments.length ? round2(totalSales / dayPayments.length) : 0,
      customersServed: new Set(dayPayments.map((e) => e.tableNumber)).size,
    },
    live: {
      ordersInKitchen: inKitchenCount,
      paymentAlerts: allPayments.filter((e) => {
        const req = false;
        return req;
      }).length,
    },
    catalogSize: (menu || []).length,
  };
}
