import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/auth/RequireAuth";
import { KioskFullscreenGuard } from "./components/mesero/KioskFullscreenGuard";
import { AuthProvider } from "./context/AuthContext";
import { MeseroThemeProvider } from "./context/MeseroThemeContext";
import { MeseroLayout } from "./context/MeseroContext";
import { CatalogScreenPage } from "./pages/CatalogScreenPage";
import { ChatPage } from "./pages/ChatPage";
import { GuestMenuPage } from "./pages/GuestMenuPage";
import { LoginPage } from "./pages/LoginPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminHome } from "./pages/admin/AdminHome";
import { FlowPage } from "./pages/admin/FlowPage";
import { SettingsPage } from "./pages/admin/SettingsPage";
import { ExecutionModePage } from "./pages/admin/ExecutionModePage";
import { ThemePage } from "./pages/admin/ThemePage";

export default function App() {
  return (
    <MeseroThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <KioskFullscreenGuard />
          <Routes>
            <Route
              path="/login"
              element={
                <LoginPage appName="Mesero IA" appSubtitle="Inicia sesión para usar el quiosco y administración" />
              }
            />
            <Route path="/menu" element={<GuestMenuPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<MeseroLayout />}>
                <Route path="/" element={<ChatPage />} />
                <Route path="/catalogo" element={<CatalogScreenPage />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminHome />} />
                  <Route path="flujo" element={<FlowPage />} />
                  <Route path="config" element={<SettingsPage />} />
                  <Route path="tema" element={<ThemePage />} />
                  <Route path="ejecucion" element={<ExecutionModePage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </MeseroThemeProvider>
  );
}
