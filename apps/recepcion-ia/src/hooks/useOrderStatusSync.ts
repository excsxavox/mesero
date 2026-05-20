import { useEffect, useRef } from "react";
import { getOrders } from "../lib/api";
import { getCompanyId } from "../lib/authSession";
import type { Order } from "../lib/types";

export type OrderStatusPatch = { id: string; status: string; statusChangedAt?: string };

function patchesFromOrders(orders: Order[], idSet: Set<string>): OrderStatusPatch[] {
  return orders
    .filter((o) => idSet.has(o.id))
    .map((o) => ({ id: o.id, status: o.status, statusChangedAt: o.statusChangedAt }));
}

/** Sincroniza estado de pedidos confirmados con cocina (mismo store/WebSocket que el receptor). */
export function useOrderStatusSync(orderIds: string[], onPatch: (patches: OrderStatusPatch[]) => void) {
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;
  const idsKey = orderIds.join(",");

  useEffect(() => {
    if (!orderIds.length) return;

    const idSet = new Set(orderIds);
    const apply = (orders: Order[]) => {
      const patches = patchesFromOrders(orders, idSet);
      if (patches.length) onPatchRef.current(patches);
    };

    const poll = () => void getOrders().then(apply).catch(() => {});
    poll();
    const pollTimer = window.setInterval(poll, 10_000);

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const companyId = getCompanyId();
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    const ws = new WebSocket(`${proto}://${location.host}/ws${q}`);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as
          | { type: "snapshot"; payload?: { orders?: Order[] } }
          | { type: "orders"; payload?: Order[] };
        if (msg.type === "snapshot" && msg.payload?.orders) apply(msg.payload.orders);
        if (msg.type === "orders" && msg.payload) apply(msg.payload);
      } catch {
        /* */
      }
    };

    return () => {
      window.clearInterval(pollTimer);
      ws.close();
    };
  }, [idsKey, orderIds.length]);
}
