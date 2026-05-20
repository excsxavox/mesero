import { useEffect, useRef, useState } from "react";
import type { Order } from "../lib/types";

/** Promedio de minutos entre «preparando» y «listo» en la sesión. */
export function usePrepStats(orders: Order[]) {
  const [avgPrepMs, setAvgPrepMs] = useState<number | null>(null);
  const prepStartRef = useRef<Map<string, number>>(new Map());
  const durationsRef = useRef<number[]>([]);

  useEffect(() => {
    for (const o of orders) {
      if (o.status === "preparando" && !prepStartRef.current.has(o.id)) {
        const t = o.statusChangedAt ? new Date(o.statusChangedAt).getTime() : new Date(o.createdAt).getTime();
        prepStartRef.current.set(o.id, t);
      }
      if (o.status === "listo" || o.status === "entregado") {
        const start = prepStartRef.current.get(o.id);
        if (start != null) {
          const end = o.statusChangedAt ? new Date(o.statusChangedAt).getTime() : Date.now();
          const d = end - start;
          if (d > 0 && d < 3600_000) {
            durationsRef.current.push(d);
            if (durationsRef.current.length > 30) durationsRef.current.shift();
          }
          prepStartRef.current.delete(o.id);
        }
      }
    }
    const arr = durationsRef.current;
    if (arr.length > 0) {
      setAvgPrepMs(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
  }, [orders]);

  return avgPrepMs;
}
