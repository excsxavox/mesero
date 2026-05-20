export type OrderLine = {
  menuItemId: string;
  name: string;
  qty: number;
  notes?: string;
};

export type Order = {
  id: string;
  table?: string;
  items: OrderLine[];
  status: string;
  createdAt: string;
  statusChangedAt?: string;
  notes?: string;
  source?: string;
};

import type { TableBill } from "./tableBillTypes";

export type WsMsg =
  | { type: "snapshot"; payload: { orders?: Order[]; tableBills?: TableBill[] } }
  | { type: "orders"; payload: Order[] }
  | { type: "tableBills"; payload: TableBill[] };

export type KanbanStatus = "nuevo" | "preparando" | "listo";

export type ActivityEntry = {
  id: string;
  at: string;
  orderId: string;
  tableLabel: string;
  itemsSummary: string;
  statusKey: KanbanStatus | "entregado";
  statusLabel: string;
};
