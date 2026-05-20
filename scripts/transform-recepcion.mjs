import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "apps/recepcion-ia");
const exts = new Set([".ts", ".tsx", ".css", ".html", ".json"]);

const replacements = [
  ["mesero-auth-session", "recepcion-auth-session"],
  ["mesero-session-updated", "recepcion-session-updated"],
  ["mesero-kiosk-table", "recepcion-desk"],
  ["MESERO_SESSION_UPDATED", "RECEPCION_SESSION_UPDATED"],
  ["mesero-session", "recepcion-session"],
  ["mesero-theme", "recepcion-theme"],
  ["data-mesero-theme", "data-recepcion-theme"],
  ["MeseroThemeProvider", "RecepcionThemeProvider"],
  ["MeseroThemeContext", "RecepcionThemeContext"],
  ["useMeseroTheme", "useRecepcionTheme"],
  ["MeseroLayout", "RecepcionLayout"],
  ["MeseroContext", "RecepcionContext"],
  ["useMesero", "useRecepcion"],
  ["meseroTheme.ts", "recepcionTheme.ts"],
  ["meseroSessionStorage.ts", "recepcionSessionStorage.ts"],
  ["getStoredMeseroTheme", "getStoredRecepcionTheme"],
  ["applyMeseroTheme", "applyRecepcionTheme"],
  ["toggleMeseroTheme", "toggleRecepcionTheme"],
  ["MESERO_THEME_KEY", "RECEPCION_THEME_KEY"],
  ["MeseroTheme", "RecepcionTheme"],
  ["KioskFullscreenGuard", "RecepcionFullscreenGuard"],
  ["KarenProfileCard", "ReceptionProfileCard"],
  ['"mesero-ia"', '"recepcion-ia"'],
  ["Mesero IA", "Recepción IA"],
  ["Tu mesera con IA", "Tu recepcionista con IA"],
  ["mesero virtual", "recepcionista virtual"],
  ["mesero/a virtual", "recepcionista virtual"],
];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "dist") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (exts.has(path.extname(ent.name))) {
      let s = fs.readFileSync(p, "utf8");
      for (const [a, b] of replacements) s = s.split(a).join(b);
      fs.writeFileSync(p, s);
    }
  }
}

walk(root);
console.log("done");
