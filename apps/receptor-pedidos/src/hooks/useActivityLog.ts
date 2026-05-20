import { useEffect, useRef, useState } from "react";
import type { ActivityEntry, KanbanStatus, Order } from "../lib/types";
import { itemsSummary, tableLabel } from "../lib/format";

const STATUS_LABEL: Record<string, string> = {
  nuevo: "NUEVO",
  preparando: "EN PREP.",
  listo: "LISTO",
  entregado: "ENTREGADO",
};

function entryFor(order: Order, statusKey: KanbanStatus | "entregado"): ActivityEntry {
  return {
    id: `${order.id}-${statusKey}-${Date.now()}`,
    at: new Date().toISOString(),
    orderId: order.id,
    tableLabel: tableLabel(order.table),
    itemsSummary: itemsSummary(order.items),
    statusKey,
    statusLabel: STATUS_LABEL[statusKey] ?? statusKey.toUpperCase(),
  };
}

export function activityDescription(entry: ActivityEntry): string {
  const id = entry.orderId.slice(-4);
  switch (entry.statusKey) {
    case "nuevo":
      return `Nuevo pedido #${id} de ${entry.tableLabel}`;
    case "preparando":
      return `Pedido #${id} en preparación (${entry.tableLabel})`;
    case "listo":
      return `Pedido #${id} listo para entregar (${entry.tableLabel})`;
    case "entregado":
      return `Pedido #${id} entregado (${entry.tableLabel})`;
    default:
      return `Pedido #${id} — ${entry.tableLabel}`;
  }
}

export function useActivityLog(orders: Order[]) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const seenRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const seen = seenRef.current;
    for (const o of orders) {
      const prev = seen.get(o.id);
      if (!prev) {
        if (o.status === "nuevo" || o.status === "preparando" || o.status === "listo") {
          seen.set(o.id, o.status);
          setEntries((list) => [entryFor(o, o.status as KanbanStatus), ...list].slice(0, 40));
        }
        continue;
      }
      if (prev !== o.status) {
        seen.set(o.id, o.status);
        const key =
          o.status === "entregado"
            ? "entregado"
            : (o.status as KanbanStatus);
        if (key === "nuevo" || key === "preparando" || key === "listo" || key === "entregado") {
          setEntries((list) => [entryFor(o, key), ...list].slice(0, 40));
        }
      }
    }
  }, [orders]);

  const clear = () => setEntries([]);

  return { entries, clear };
}
