import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { isAdminExitLockArmed, MESERO_LOCK_CHANGED } from "../../lib/adminExitLock";
import { isMeseroFullscreenPinned, MESERO_FULLSCREEN_CHANGED } from "../../lib/meseroFullscreen";
import { useFullscreen } from "../../hooks/useFullscreen";

function fsActive() {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

function shouldKeepFullscreen() {
  return isAdminExitLockArmed() || isMeseroFullscreenPinned();
}

/**
 * Con candado activo o pantalla completa manual, mantiene fullscreen en document y re-entra al cambiar de ruta.
 */
export function KioskFullscreenGuard() {
  const location = useLocation();
  const [lockArmed, setLockArmed] = useState(() => isAdminExitLockArmed());
  const [pinned, setPinned] = useState(() => isMeseroFullscreenPinned());
  const { isFullscreen, enter, supported } = useFullscreen();
  const reentering = useRef(false);

  useEffect(() => {
    const syncLock = () => setLockArmed(isAdminExitLockArmed());
    const syncPinned = () => setPinned(isMeseroFullscreenPinned());
    window.addEventListener(MESERO_LOCK_CHANGED, syncLock);
    window.addEventListener(MESERO_FULLSCREEN_CHANGED, syncPinned);
    return () => {
      window.removeEventListener(MESERO_LOCK_CHANGED, syncLock);
      window.removeEventListener(MESERO_FULLSCREEN_CHANGED, syncPinned);
    };
  }, []);

  const maintain = lockArmed || pinned;

  useEffect(() => {
    if (!maintain || !supported) return;

    const ensureFullscreen = () => {
      if (!shouldKeepFullscreen() || reentering.current) return;
      if (fsActive()) return;
      reentering.current = true;
      void enter().finally(() => {
        window.setTimeout(() => {
          reentering.current = false;
        }, 400);
      });
    };

    ensureFullscreen();

    document.addEventListener("fullscreenchange", ensureFullscreen);
    document.addEventListener("webkitfullscreenchange", ensureFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", ensureFullscreen);
      document.removeEventListener("webkitfullscreenchange", ensureFullscreen);
    };
  }, [maintain, supported, enter, location.pathname]);

  useEffect(() => {
    if (maintain && supported && !isFullscreen && !reentering.current) {
      void enter();
    }
  }, [maintain, supported, isFullscreen, enter, location.pathname]);

  return null;
}
