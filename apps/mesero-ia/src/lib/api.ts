import type { FlowState, MenuItem, Order, Settings, SettingsWrite } from "./types";
import { authFetch } from "./authSession";

async function readApiError(r: Response): Promise<string> {
  const clone = r.clone();
  try {
    const data = (await r.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    const t = await clone.text();
    const pre = t.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)?.[1]?.trim();
    if (pre) return pre;
    if (t && !/<html/i.test(t)) return t.slice(0, 400);
  }
  return r.statusText || "Error del servidor";
}

const json = async <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(await readApiError(r));
  return r.json() as Promise<T>;
};

/** Comprueba que el proceso `mesero-server` responda (misma API para mesero y receptor). */
export async function getHealth() {
  return json<{
    ok: boolean;
    openAiConfigured?: boolean;
    aiboxAuthConfigured?: boolean;
    aiboxOfferingsConfigured?: boolean;
    menuCatalogSource?: "aibox" | "local";
  }>(
    await fetch("/api/health"),
  );
}

export async function verifyAdminExitPassword(password: string) {
  const r = await fetch("/api/auth/verify-admin-exit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const t = (await r.json()) as { error?: string };
      if (t.error) msg = t.error;
    } catch {
      /* */
    }
    throw new Error(msg);
  }
  return json<{ ok: boolean }>(r);
}

export async function getMenu(options?: { refresh?: boolean }) {
  const q = options?.refresh ? "?refresh=1" : "";
  return json<MenuItem[]>(
    await authFetch(`/api/menu${q}`, { cache: "no-store" }),
  );
}

export async function putMenu(menu: MenuItem[]) {
  return json<MenuItem[]>(
    await authFetch("/api/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(menu),
    }),
  );
}

export async function getFlow() {
  return json<FlowState>(await authFetch("/api/flow"));
}

export async function putFlow(flow: FlowState) {
  return json<FlowState>(
    await authFetch("/api/flow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flow),
    }),
  );
}

export async function getOrders() {
  return json<Order[]>(await authFetch("/api/orders"));
}

export async function postOrder(body: {
  table?: string;
  items: { menuItemId: string; name: string; qty: number; notes?: string }[];
  notes?: string;
  source?: string;
}) {
  return json<Order>(
    await authFetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function patchOrder(id: string, patch: Partial<Order>) {
  return json<Order>(
    await authFetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteOrder(id: string) {
  await authFetch(`/api/orders/${id}`, { method: "DELETE" });
}

export async function getSettings() {
  return json<Settings>(await authFetch("/api/settings"));
}

export async function putSettings(s: SettingsWrite) {
  return json<Settings>(
    await authFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    }),
  );
}

export async function uploadMenuPdf(file: File) {
  const fd = new FormData();
  fd.append("pdf", file);
  const r = await authFetch("/api/settings/menu-pdf", { method: "POST", body: fd });
  if (!r.ok) throw new Error(await readApiError(r));
  return r.json() as Promise<Settings>;
}

export async function deleteMenuPdf() {
  return json<Settings>(await authFetch("/api/settings/menu-pdf", { method: "DELETE" }));
}

export async function chatComplete(
  messages: { role: string; content: string }[],
  options?: { selectedTable?: number | null; kitchenOrderIds?: string[] },
) {
  const body: {
    messages: typeof messages;
    selectedTable?: number;
    kitchenOrderIds?: string[];
  } = { messages };
  if (options?.selectedTable != null && Number.isFinite(options.selectedTable)) {
    body.selectedTable = Math.round(options.selectedTable);
  }
  if (options?.kitchenOrderIds?.length) {
    body.kitchenOrderIds = options.kitchenOrderIds;
  }
  return json<{
    role: string;
    content: string;
    draftItems?: { menuItemId: string; name: string; qty: number }[];
    order: Order | null;
    paymentFlow?: {
      tableNumber: number;
      phase: string;
      billingType: string | null;
      customer: Record<string, string> | null;
      invoiceId: string | null;
    } | null;
  }>(
    await authFetch("/api/chat/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
