import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityPanel } from "../components/ActivityPanel";
import { KanbanColumn } from "../components/KanbanColumn";
import { KitchenSideRail } from "../components/KitchenSideRail";
import { ReceptorHeader } from "../components/ReceptorHeader";
import { useActivityLog } from "../hooks/useActivityLog";
import { useNow } from "../hooks/useNow";
import { useOrdersSocket } from "../hooks/useOrdersSocket";
import { usePrepStats } from "../hooks/usePrepStats";
import { fetchDashboard } from "../lib/analyticsApi";
import { fetchMenuPrices, patchOrder } from "../lib/api";
import type { KanbanStatus } from "../lib/types";

const KANBAN: KanbanStatus[] = ["nuevo", "preparando", "listo"];

export function KitchenPage() {
  const { orders, tableBills, error, setError } = useOrdersSocket();
  const now = useNow();
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [daySales, setDaySales] = useState<number | undefined>();
  const [topProductName, setTopProductName] = useState<string | undefined>();
  const [topProductUnits, setTopProductUnits] = useState<number | undefined>();
  const { entries, clear: clearActivity } = useActivityLog(orders);
  const avgPrepMs = usePrepStats(orders);

  useEffect(() => {
    void fetchMenuPrices().then(setPrices);
    const id = window.setInterval(() => void fetchMenuPrices().then(setPrices), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void fetchDashboard()
      .then((d) => {
        setDaySales(d.metrics.totalSales);
        setTopProductName(d.metrics.topProductName);
        setTopProductUnits(d.metrics.topProductUnits);
      })
      .catch(() => {
        /* */
      });
    const t = window.setInterval(() => {
      void fetchDashboard()
        .then((d) => {
          setDaySales(d.metrics.totalSales);
          setTopProductName(d.metrics.topProductName);
          setTopProductUnits(d.metrics.topProductUnits);
        })
        .catch(() => {
          /* */
        });
    }, 60_000);
    return () => window.clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    const g: Record<KanbanStatus, typeof orders> = { nuevo: [], preparando: [], listo: [] };
    for (const o of orders) {
      if (o.status in g) g[o.status as KanbanStatus].push(o);
    }
    for (const k of KANBAN) {
      g[k].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return g;
  }, [orders]);

  const delivered = orders.filter((o) => o.status === "entregado").length;
  const inView = grouped.nuevo.length + grouped.preparando.length + grouped.listo.length;

  const onAdvance = useCallback(
    (id: string, next: string) => {
      void patchOrder(id, next).catch((e) => setError(String(e)));
    },
    [setError],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 p-4 lg:p-5">
      <ReceptorHeader inView={inView} delivered={delivered} />

      {error ? (
        <div className="shrink-0 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-200 ring-1 ring-red-900/60">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          {KANBAN.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              orders={grouped[status]}
              now={now}
              prices={prices}
              onAdvance={onAdvance}
            />
          ))}
        </div>

        <KitchenSideRail
          bills={tableBills}
          inView={inView}
          preparing={grouped.preparando.length}
          ready={grouped.listo.length}
          delivered={delivered}
          avgPrepMs={avgPrepMs}
          topProductName={topProductName}
          topProductUnits={topProductUnits}
          daySales={daySales}
        />
      </div>

      <ActivityPanel
        entries={entries}
        onClear={clearActivity}
        className="h-44 max-h-[min(22vh,220px)] shrink-0"
      />
    </div>
  );
}
