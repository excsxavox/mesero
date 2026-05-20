import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { PanelThemeProvider } from "./context/PanelThemeContext.tsx";
import { applyMeseroTheme, getStoredMeseroTheme } from "./lib/meseroTheme.ts";

applyMeseroTheme(getStoredMeseroTheme());

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
