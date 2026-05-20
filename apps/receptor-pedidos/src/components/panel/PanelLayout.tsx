import { useMemo } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useOrdersSocket } from "../../hooks/useOrdersSocket";
import { PanelSidebar } from "./PanelSidebar";

export function PanelLayout() {
  const { orders } = useOrdersSocket();
  const { companyName } = useAuth();
  const liveOrders = useMemo(
    () => orders.filter((o) => ["nuevo", "preparando", "listo"].includes(o.status)).length,
    [orders],
  );

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-[var(--theme-body-gradient)]">
      <PanelSidebar restaurantName={companyName} liveOrders={liveOrders} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
