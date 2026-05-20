import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function RequireAuth() {
  const { session, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-mesero-text-muted">
        Verificando sesión…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
