import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/auth/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { RecepcionThemeProvider } from "./context/RecepcionThemeContext";
import { RecepcionLayout } from "./context/RecepcionContext";
import { CatalogScreenPage } from "./pages/CatalogScreenPage";
import { ChatPage } from "./pages/ChatPage";
import { GuestMenuPage } from "./pages/GuestMenuPage";
import { LoginPage } from "./pages/LoginPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminHome } from "./pages/admin/AdminHome";
import { FlowPage } from "./pages/admin/FlowPage";
import { SettingsPage } from "./pages/admin/SettingsPage";
import { ExecutionModePage } from "./pages/admin/ExecutionModePage";
import { COPY } from "./lib/receptionCopy";

export default function App() {
  return (
    <RecepcionThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <LoginPage appName="Recepción IA" appSubtitle={COPY.loginSubtitle} />
              }
            />
            <Route path="/menu" element={<GuestMenuPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<RecepcionLayout />}>
                <Route path="/" element={<ChatPage />} />
                <Route path="/catalogo" element={<CatalogScreenPage />} />
              </Route>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminHome />} />
                <Route path="flujo" element={<FlowPage />} />
                <Route path="config" element={<SettingsPage />} />
                <Route path="ejecucion" element={<ExecutionModePage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </RecepcionThemeProvider>
  );
}
