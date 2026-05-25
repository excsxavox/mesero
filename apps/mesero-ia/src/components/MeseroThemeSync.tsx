import { useEffect, useRef } from "react";
import { useMesero } from "../context/MeseroContext";
import { useMeseroTheme } from "../context/MeseroThemeContext";
import { getPaletteFromSettings } from "../lib/meseroTheme";

/** Aplica la paleta guardada en el servidor cuando el admin la configuró. */
export function MeseroThemeSync() {
  const { settings } = useMesero();
  const { setPalette } = useMeseroTheme();
  const lastServerPalette = useRef<string | null>(null);

  useEffect(() => {
    const fromServer = getPaletteFromSettings(settings);
    if (!fromServer) return;
    if (lastServerPalette.current === fromServer) return;
    lastServerPalette.current = fromServer;
    setPalette(fromServer);
  }, [settings?.uiPalette, setPalette, settings]);

  return null;
}
