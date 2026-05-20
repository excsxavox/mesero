import { useEffect, useState } from "react";
import { getCompanyId } from "../lib/authSession";
import type { TableBill } from "../lib/tableBillTypes";
import type { Order, WsMsg } from "../lib/types";

type SnapshotPayload = {
  orders?: Order[];
  tableBills?: TableBill[];
};

export function useOrdersSocket() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tableBills, setTableBills] = useState<TableBill[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const companyId = getCompanyId();
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    const ws = new WebSocket(`${proto}://${location.host}/ws${q}`);

    ws.onopen = () => {
      setWsConnected(true);
      setError(null);
    };
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => {
      setWsConnected(false);
      setError(
        "WebSocket: revisa que mesero-server esté en marcha (puerto en PORT del .env; defecto 3041).",
      );
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsMsg | { type: "tableBills"; payload: TableBill[] };
        if (msg.type === "snapshot") {
          const p = msg.payload as SnapshotPayload;
          if (p.orders) setOrders(p.orders);
          if (p.tableBills) setTableBills(p.tableBills);
        }
        if (msg.type === "orders") setOrders(msg.payload);
        if (msg.type === "tableBills") setTableBills(msg.payload);
      } catch {
        /* ignore */
      }
    };

    return () => ws.close();
  }, []);

  return { orders, tableBills, wsConnected, error, setError };
}
