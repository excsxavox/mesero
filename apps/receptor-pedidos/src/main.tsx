import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { PanelThemeProvider } from "./context/PanelThemeContext.tsx";
import {
  applyMeseroAppearance,
  applyMeseroPalette,
  getPaletteFromSettings,
  getStoredMeseroPalette,
  getStoredMeseroTheme,
} from "./lib/meseroTheme.ts";

applyMeseroAppearance(getStoredMeseroTheme(), getStoredMeseroPalette());

void fetch("/api/settings")
  .then((r) => (r.ok ? r.json() : null))
  .then((s) => {
    const p = getPaletteFromSettings(s);
    if (p) applyMeseroPalette(p);
  })
  .catch(() => {
    /* */
  });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PanelThemeProvider>
      <AuthProvider>
        <div className="h-full">
          <App />
        </div>
      </AuthProvider>
    </PanelThemeProvider>
  </StrictMode>,
);
