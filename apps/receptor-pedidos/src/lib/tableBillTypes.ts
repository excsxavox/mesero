export type TableBillLine = {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number | null;
  lineTotal: number | null;
  notes?: string[];
};

export type BillingCustomer = {
  idType: string;
  identification: string;
  name: string;
  email: string;
  address?: string;
};

export type TableBill = {
  tableNumber: number;
  tableLabel: string;
  lines: TableBillLine[];
  total: number | null;
  orderIds: string[];
  paymentRequested: boolean;
  paymentRequestedAt: string | null;
  paymentPhase?: string | null;
  billingType?: "consumidor_final" | "factura" | null;
  billingCustomer?: BillingCustomer | null;
  invoiceId?: string | null;
  itemCount: number;
};
