export type DashboardTopProduct = {
  menuItemId: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  qtySold: number;
  revenue: number | null;
};

export type DashboardPaymentRow = {
  id: string;
  orderLabel: string;
  tableLabel: string;
  paidAt: string;
  productsSummary: string;
  total: number | null;
  paymentMethod: string;
  status: string;
};

export type DashboardData = {
  date: string;
  dateFrom?: string;
  dateTo?: string;
  restaurantName: string;
  metrics: {
    totalSales: number;
    totalSalesChangePct: number;
    paidOrders: number;
    paidOrdersChangePct: number;
    topProductName: string;
    topProductUnits: number;
    avgPrepTime: string | null;
    avgPrepTimeChangeMs: number | null;
  };
  topProducts: DashboardTopProduct[];
  salesByHour: { hour: number; label: string; total: number }[];
  paymentRows: DashboardPaymentRow[];
  daySummary: {
    totalOrders: number;
    unitsSold: number;
    totalSales: number;
    averageTicket: number;
    customersServed: number;
  };
  live: { ordersInKitchen: number };
  catalogSize: number;
};
