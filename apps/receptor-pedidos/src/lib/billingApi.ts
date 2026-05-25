import { authFetch } from "./authSession";

export type BillingConfig = {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccionMatriz: string;
  establishment: string;
  emissionPoint: string;
  ambiente: string;
  tipoEmision: string;
  certificatePath?: string;
  certificatePassword: string;
  certificatePasswordSet?: boolean;
  certificateUploaded?: boolean;
  certificateFileName?: string;
  emailEmisor: string;
  secuencialActual?: number;
};

export type Invoice = {
  id: string;
  paymentId: string | null;
  tableNumber: number | null;
  tableLabel: string | null;
  billingType: string;
  customer: {
    idType: string;
    identification: string;
    name: string;
    email: string;
    address?: string;
  };
  lines: { name: string; qty: number; lineTotal?: number | null }[];
  total: number | null;
  accessKey: string | null;
  sriStatus: string;
  sriMessages: string[];
  authorizationNumber: string | null;
  createdAt: string;
};

export const EMPTY_BILLING_CONFIG: BillingConfig = {
  ruc: "",
  razonSocial: "",
  nombreComercial: "",
  direccionMatriz: "",
  establishment: "001",
  emissionPoint: "001",
  ambiente: "1",
  tipoEmision: "1",
  certificatePath: "",
  certificatePassword: "",
  emailEmisor: "",
};

async function readApiError(r: Response): Promise<string> {
  const text = await r.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* */
  }
  return text || `Error HTTP ${r.status}`;
}

export async function fetchBillingConfig(): Promise<{
  configured: boolean;
  config: BillingConfig | null;
}> {
  const r = await authFetch("/api/billing/config");
  if (!r.ok) throw new Error(await readApiError(r));
  return r.json() as Promise<{ configured: boolean; config: BillingConfig | null }>;
}

export async function saveBillingConfig(config: BillingConfig): Promise<BillingConfig> {
  const { certificatePath: _omitPath, certificatePassword, ...rest } = config;
  const payload: Omit<BillingConfig, "certificatePath" | "certificatePassword"> & {
    certificatePassword?: string;
  } = { ...rest };
  if (certificatePassword !== "***") payload.certificatePassword = certificatePassword;
  const r = await authFetch("/api/billing/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: payload }),
  });
  if (!r.ok) throw new Error(await r.text());
  const data = (await r.json()) as { config: BillingConfig };
  return data.config;
}

export async function uploadBillingCertificate(
  file: File,
  certificatePassword?: string,
): Promise<BillingConfig> {
  const form = new FormData();
  form.append("certificate", file);
  if (certificatePassword?.trim()) {
    form.append("certificatePassword", certificatePassword.trim());
  }
  const r = await authFetch("/api/billing/config/certificate", {
    method: "POST",
    body: form,
  });
  if (!r.ok) throw new Error(await r.text());
  const data = (await r.json()) as { config: BillingConfig };
  return data.config;
}

export async function fetchInvoices(status?: string): Promise<Invoice[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const r = await authFetch(`/api/billing/invoices${qs}`);
  if (!r.ok) throw new Error(await r.text());
  const data = (await r.json()) as { invoices: Invoice[] };
  return data.invoices;
}
