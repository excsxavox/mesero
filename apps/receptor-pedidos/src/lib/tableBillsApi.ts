import type { TableBill } from "./tableBillTypes";
import { authFetch } from "./authSession";

export async function fetchTableBills(): Promise<TableBill[]> {
  const r = await authFetch("/api/tables/bills");
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<TableBill[]>;
}

export async function fetchTableBill(tableNumber: number): Promise<TableBill> {
  const r = await authFetch(`/api/tables/${tableNumber}/bill`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<TableBill>;
}

export async function markTablePaid(
  tableNumber: number,
  options?: { emitInvoice?: boolean },
): Promise<{ invoice?: { id: string; sriStatus: string } | null }> {
  const r = await authFetch(`/api/tables/${tableNumber}/mark-paid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emitInvoice: options?.emitInvoice }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ invoice?: { id: string; sriStatus: string } | null }>;
}

export async function emitInvoice(invoiceId: string) {
  const r = await authFetch(`/api/billing/invoices/${encodeURIComponent(invoiceId)}/emit`, {
    method: "POST",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function requestTablePayment(tableNumber: number): Promise<void> {
  const r = await authFetch(`/api/tables/${tableNumber}/request-payment`, { method: "POST" });
  if (!r.ok) throw new Error(await r.text());
}
