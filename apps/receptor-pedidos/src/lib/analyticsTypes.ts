import type { TableBillLine } from "./tableBillTypes";

export type PaymentHistoryEntry = {
  id: string;
  tableNumber: number;
  tableLabel: string;
  lines: TableBillLine[];
  total: number | null;
  orderIds: string[];
  itemCount: number;
  paidAt: string;
};

export type TopProductRow = {
  menuItemId: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  unitPrice: number | null;
  qtySold: number;
  revenue: number | null;
  orderLines: number;
};

export type TopProductsResponse = {
  products: TopProductRow[];
  summary: {
    paidOrderCount: number;
    distinctProducts: number;
    totalUnitsSold: number;
    totalRevenue: number | null;
    catalogSize: number;
  };
  payments: {
    paymentsCount: number;
    totalRevenue: number;
  };
};
