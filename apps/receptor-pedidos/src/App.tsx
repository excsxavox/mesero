import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/auth/RequireAuth";
import { PanelLayout } from "./components/panel/PanelLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { KitchenPage } from "./pages/KitchenPage";
import { LoginPage } from "./pages/LoginPage";
import { PaymentHistoryPage } from "./pages/PaymentHistoryPage";
import { FacturacionLayout } from "./components/facturacion/FacturacionLayout";
import { FacturasPage } from "./pages/FacturasPage";
import { BillingConfigPage } from "./pages/BillingConfigPage";
import { TableBillPage } from "./pages/TableBillPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<PanelLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/cocina" element={<KitchenPage />} />
            <Route path="/historial" element={<PaymentHistoryPage />} />
            <Route path="/facturacion" element={<FacturacionLayout />}>
              <Route index element={<Navigate to="comprobantes" replace />} />
              <Route path="comprobantes" element={<FacturasPage />} />
              <Route path="configuracion" element={<BillingConfigPage />} />
            </Route>
            <Route path="/facturas" element={<Navigate to="/facturacion/comprobantes" replace />} />
            <Route path="/facturas/config" element={<Navigate to="/facturacion/configuracion" replace />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
          </Route>
          <Route path="/mesa/:tableNum" element={<TableBillPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
