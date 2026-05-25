import type { Settings } from "./types";

type MenuPublicUrlInput = {
  settings?: Pick<Settings, "menuPdfConfigured" | "menuPdfUrl" | "companyId"> | null;
  companyId?: string | null;
};

/** URL que codifica el QR del menú (PDF subido, enlace externo o carta web `/menu`). */
export function getMenuPublicUrl(input?: MenuPublicUrlInput) {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  const companyId =
    input?.companyId?.trim() ||
    input?.settings?.companyId?.trim() ||
    import.meta.env.VITE_AIBOX_COMPANY_ID?.trim() ||
    "";

  const withCompany = (base: string) =>
    companyId ? `${base}${base.includes("?") ? "&" : "?"}companyId=${encodeURIComponent(companyId)}` : base;

  const external = input?.settings?.menuPdfUrl?.trim();
  if (external) return external;

  if (input?.settings?.menuPdfConfigured) {
    return withCompany(`${origin}/api/menu-pdf`);
  }

  return withCompany(`${origin}/menu`);
}
