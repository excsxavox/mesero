import fs from "node:fs";
import path from "node:path";

/**
 * Ruta del PDF de menú por defecto (env o `data/default-menu.pdf`).
 * @param {string} dataDir
 */
export function resolveDefaultMenuPdfPath(dataDir) {
  const fromEnv = String(process.env.MESERO_DEFAULT_MENU_PDF ?? "").trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const bundled = path.join(dataDir, "default-menu.pdf");
  if (fs.existsSync(bundled)) return bundled;
  return null;
}

/**
 * Copia el menú PDF por defecto a cada empresa del store (y crea el directorio menu-pdfs).
 * @param {{ listCompanyIds: () => string[] }} storeApi
 * @param {string} menuPdfDir
 * @param {string} dataDir
 */
export function seedDefaultMenuPdf(storeApi, menuPdfDir, dataDir) {
  const src = resolveDefaultMenuPdfPath(dataDir);
  if (!src) {
    console.log("[mesero-server] Sin menú PDF por defecto (default-menu.pdf o MESERO_DEFAULT_MENU_PDF).");
    return 0;
  }
  const buf = fs.readFileSync(src);
  const companyIds = storeApi.listCompanyIds();
  const fallback = String(process.env.AIBOX_COMPANY_ID ?? "").trim();
  const ids = companyIds.length > 0 ? companyIds : fallback ? [fallback] : [];
  if (ids.length === 0) {
    console.log("[mesero-server] No hay empresas en BD; no se aplicó el menú PDF por defecto.");
    return 0;
  }
  fs.mkdirSync(menuPdfDir, { recursive: true });
  for (const companyId of ids) {
    fs.writeFileSync(path.join(menuPdfDir, `${companyId}.pdf`), buf);
  }
  const mb = (buf.length / (1024 * 1024)).toFixed(2);
  console.log(
    `[mesero-server] Menú PDF por defecto aplicado a ${ids.length} empresa(s) (${mb} MB, origen: ${src}).`,
  );
  return ids.length;
}
