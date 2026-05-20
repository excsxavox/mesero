import { useCallback, useEffect, useState } from "react";
import { getMenu } from "../lib/api";
import type { MenuItem } from "../lib/types";

/** Carga el menú y lo vuelve a pedir al servidor (refresh AIBox) al enfocar la ventana. */
export function useRefreshableMenu() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  const reloadMenu = useCallback((refresh = true) => {
    setMenuLoading(true);
    void getMenu({ refresh })
      .then(setMenu)
      .catch(() => setMenu([]))
      .finally(() => setMenuLoading(false));
  }, []);

  useEffect(() => {
    reloadMenu(true);
  }, [reloadMenu]);

  useEffect(() => {
    const onFocus = () => reloadMenu(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") reloadMenu(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reloadMenu]);

  return { menu, setMenu, menuLoading, reloadMenu };
}
