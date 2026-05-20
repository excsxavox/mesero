import { useEffect, useRef, useState } from "react";
import { isAdminExitLockArmed, MESERO_LOCK_CHANGED } from "../../lib/adminExitLock";
import { useFullscreen } from "../../hooks/useFullscreen";

/**
 * Con el candado activo, mantiene pantalla completa y vuelve a entrar si el usuario sale (Escape, etc.).
 */
export function RecepcionFullscreenGuard() {
  const [lockArmed, setLockArmed] = useState(() => isAdminExitLockArmed());
  const { isFullscreen, enter, supported } = useFullscreen();
  const reentering = useRef(false);

  useEffect(() => {
    const sync = () => setLockArmed(isAdminExitLockArmed());
    window.addEventListener(MESERO_LOCK_CHANGED, sync);
    return () => window.removeEventListener(MESERO_LOCK_CHANGED, sync);
  }, []);

  useEffect(() => {
    if (!lockArmed || !supported) return;

    const fsActive = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      return !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
    };

    const ensureFullscreen = () => {
      if (!isAdminExitLockArmed() || reentering.current) return;
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
  }, [lockArmed, supported, enter]);

  useEffect(() => {
    if (lockArmed && supported && !isFullscreen && !reentering.current) {
      void enter();
    }
  }, [lockArmed, supported, isFullscreen, enter]);

  return null;
}
