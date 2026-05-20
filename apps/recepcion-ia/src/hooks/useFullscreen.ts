import { useCallback, useEffect, useState } from "react";

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

function fullscreenElement(): Element | null {
  const doc = document as FsDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function isSupported() {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FsElement;
  return !!(el.requestFullscreen ?? el.webkitRequestFullscreen);
}

export function useFullscreen() {
  const [active, setActive] = useState(() => !!fullscreenElement());

  useEffect(() => {
    const sync = () => setActive(!!fullscreenElement());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const enter = useCallback(async (target?: HTMLElement | null) => {
    const el = (target ?? document.documentElement) as FsElement;
    const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    if (!req) return false;
    try {
      await req();
      return true;
    } catch {
      return false;
    }
  }, []);

  const exit = useCallback(async () => {
    if (!fullscreenElement()) return false;
    const doc = document as FsDocument;
    const fn = document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(document);
    if (!fn) return false;
    try {
      await fn();
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggle = useCallback(
    async (target?: HTMLElement | null) => {
      if (fullscreenElement()) return exit();
      return enter(target);
    },
    [enter, exit],
  );

  return {
    isFullscreen: active,
    supported: isSupported(),
    enter,
    exit,
    toggle,
  };
}
