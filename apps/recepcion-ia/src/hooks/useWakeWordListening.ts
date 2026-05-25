import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_INPUT_KEY } from "../lib/audioDevices";
import { extractCommandIfWakeAtStart } from "../lib/wakeWord";

interface SpeechRecAlternative {
  readonly transcript: string;
}

interface SpeechRecResult {
  readonly isFinal: boolean;
  readonly 0: SpeechRecAlternative;
}

interface SpeechRecResultList {
  readonly length: number;
  [index: number]: SpeechRecResult;
}

interface SpeechRecEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecResultList;
}

interface SpeechRecErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort?(): void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

type RecCtor = new () => SpeechRecognitionInstance;

const RESTART_BASE_MS = 2200;
const RESTART_MAX_MS = 12000;
const COOLDOWN_AFTER_STORM_MS = 45_000;
const MAX_RAPID_RESTARTS = 6;
const LANG_RESTART_MS = 1200;

/** Solo una instancia activa en toda la app (evita doble micrófono). */
let globalListenSlots = 0;

function getRecognitionCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const POST_PAUSE_COOLDOWN_MS = 2800;
const DEDUPE_MS = 2000;
const MIN_COMMAND_LEN = 2;

async function warmMicrophoneOnce() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  const id = localStorage.getItem(AUDIO_INPUT_KEY);
  const constraints: MediaStreamConstraints = id ? { audio: { deviceId: { exact: id } } } : { audio: true };
  try {
    const s = await navigator.mediaDevices.getUserMedia(constraints);
    s.getTracks().forEach((t) => t.stop());
  } catch {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      /* */
    }
  }
}

export type WakeListenOpts = {
  wakeWord?: string;
  lang?: string;
  paused: boolean;
  onCommand: (textAfterWake: string) => void | Promise<void>;
};

/**
 * Escucha continua con palabra de activación. Una sola instancia global; reinicios con backoff largo.
 */
export function useWakeWordListening(opts: WakeListenOpts) {
  const onCommandRef = useRef(opts.onCommand);
  const pausedRef = useRef(opts.paused);
  const wakeRef = useRef(opts.wakeWord ?? "karen");
  const langRef = useRef(opts.lang ?? "es-ES");
  const hiddenRef = useRef(false);
  const slotRef = useRef(0);

  useEffect(() => {
    onCommandRef.current = opts.onCommand;
  }, [opts.onCommand]);
  pausedRef.current = opts.paused;
  wakeRef.current = opts.wakeWord ?? "karen";
  langRef.current = opts.lang ?? "es-ES";

  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const supported = getRecognitionCtor() !== null;

  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const postPauseCooldownUntilRef = useRef(0);
  const lastFiredRef = useRef({ text: "", at: 0 });
  const wasPausedRef = useRef(opts.paused);
  const shuttingDownRef = useRef(false);
  const warmedRef = useRef(false);
  const restartTimerRef = useRef(0);
  const langRestartTimerRef = useRef(0);
  const cooldownTimerRef = useRef(0);
  const rapidRestartsRef = useRef(0);
  const startingRef = useRef(false);
  const fatalErrorRef = useRef(false);

  const sessionActive = supported && !opts.paused && !hidden && !coolingDown && slotRef.current === 1;

  const clearRestart = useCallback(() => {
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = 0;
  }, []);

  const clearLangRestart = useCallback(() => {
    if (langRestartTimerRef.current) window.clearTimeout(langRestartTimerRef.current);
    langRestartTimerRef.current = 0;
  }, []);

  const clearCooldown = useCallback(() => {
    if (cooldownTimerRef.current) window.clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = 0;
    setCoolingDown(false);
  }, []);

  const stopRec = useCallback(() => {
    clearRestart();
    shuttingDownRef.current = true;
    startingRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.abort?.();
    } catch {
      /* */
    }
    try {
      rec?.stop();
    } catch {
      /* */
    }
    window.setTimeout(() => {
      shuttingDownRef.current = false;
    }, 120);
  }, [clearRestart]);

  useEffect(() => {
    if (wasPausedRef.current && !opts.paused) {
      postPauseCooldownUntilRef.current = Date.now() + POST_PAUSE_COOLDOWN_MS;
    }
    wasPausedRef.current = opts.paused;
  }, [opts.paused]);

  const processFinalUtterance = useCallback((chunk: string) => {
    if (pausedRef.current || hiddenRef.current) return;
    if (Date.now() < postPauseCooldownUntilRef.current) return;

    const t = chunk.trim();
    if (!t) return;
    const w = wakeRef.current || "karen";
    const command = extractCommandIfWakeAtStart(t, w, MIN_COMMAND_LEN);
    if (!command) return;

    const now = Date.now();
    const last = lastFiredRef.current;
    if (last.text === command && now - last.at < DEDUPE_MS) return;
    lastFiredRef.current = { text: command, at: now };
    void Promise.resolve(onCommandRef.current(command)).catch(() => null);
  }, []);

  const enterCooldown = useCallback(() => {
    stopRec();
    setCoolingDown(true);
    clearCooldown();
    cooldownTimerRef.current = window.setTimeout(() => {
      cooldownTimerRef.current = 0;
      rapidRestartsRef.current = 0;
      fatalErrorRef.current = false;
      setCoolingDown(false);
      if (!pausedRef.current && !hiddenRef.current && slotRef.current === 1) {
        restartTimerRef.current = window.setTimeout(() => startRecRef.current(), RESTART_BASE_MS);
      }
    }, COOLDOWN_AFTER_STORM_MS);
  }, [stopRec, clearCooldown]);

  const scheduleRestart = useCallback(() => {
    if (pausedRef.current || hiddenRef.current || shuttingDownRef.current || fatalErrorRef.current) return;
    if (slotRef.current !== 1) return;
    clearRestart();
    rapidRestartsRef.current += 1;
    if (rapidRestartsRef.current > MAX_RAPID_RESTARTS) {
      setError("Micrófono en pausa breve para estabilizar el navegador…");
      enterCooldown();
      return;
    }
    const n = rapidRestartsRef.current;
    const delay = Math.min(RESTART_MAX_MS, RESTART_BASE_MS + (n > 2 ? (n - 2) * 800 : 0));
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = 0;
      startRecRef.current();
    }, delay);
  }, [clearRestart, enterCooldown]);

  const bindHandlers = useCallback(
    (rec: SpeechRecognitionInstance) => {
      rec.onstart = () => {
        startingRef.current = false;
        rapidRestartsRef.current = 0;
        setError(null);
      };

      rec.onresult = (ev: SpeechRecEvent) => {
        if (pausedRef.current || hiddenRef.current) return;
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (!r.isFinal) continue;
          const t = (r[0]?.transcript ?? "").trim();
          if (!t) continue;
          processFinalUtterance(t);
        }
      };

      rec.onerror = (ev: SpeechRecErrorEvent) => {
        startingRef.current = false;
        const code = ev.error;
        if (code === "aborted" || code === "no-speech") return;
        if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
          fatalErrorRef.current = true;
          setError(
            code === "not-allowed"
              ? "Micrófono denegado. Permite el acceso al micrófono."
              : "No se pudo usar el micrófono en este dispositivo.",
          );
          return;
        }
        if (code === "network") {
          rapidRestartsRef.current += 2;
          setError("Sin conexión al servicio de voz. Reintentando…");
        }
      };

      rec.onend = () => {
        if (recRef.current === rec) recRef.current = null;
        startingRef.current = false;
        if (shuttingDownRef.current || pausedRef.current || hiddenRef.current || fatalErrorRef.current) return;
        scheduleRestart();
      };
    },
    [processFinalUtterance, scheduleRestart],
  );

  const startRec = useCallback(() => {
    if (!supported || pausedRef.current || hiddenRef.current || shuttingDownRef.current || fatalErrorRef.current) return;
    if (slotRef.current !== 1) return;
    if (startingRef.current || recRef.current) return;

    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    startingRef.current = true;

    const rec = new Ctor();
    rec.lang = langRef.current;
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    bindHandlers(rec);
    recRef.current = rec;

    try {
      rec.start();
    } catch {
      startingRef.current = false;
      recRef.current = null;
      scheduleRestart();
    }
  }, [supported, bindHandlers, scheduleRestart]);

  const startRecRef = useRef(startRec);
  startRecRef.current = startRec;

  useEffect(() => {
    globalListenSlots += 1;
    slotRef.current = globalListenSlots === 1 ? 1 : 0;
    if (globalListenSlots > 1) {
      setError("Conflicto de micrófono interno. Recarga la página.");
    }
    return () => {
      globalListenSlots = Math.max(0, globalListenSlots - 1);
      slotRef.current = 0;
      clearRestart();
      clearLangRestart();
      clearCooldown();
      stopRec();
    };
  }, [stopRec, clearRestart, clearLangRestart, clearCooldown]);

  useEffect(() => {
    const onVis = () => {
      const h = document.visibilityState === "hidden";
      hiddenRef.current = h;
      setHidden(h);
      if (h) {
        clearLangRestart();
        stopRec();
      } else if (!pausedRef.current && slotRef.current === 1 && !coolingDown) {
        restartTimerRef.current = window.setTimeout(() => startRecRef.current(), 800);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [supported, stopRec, clearLangRestart, coolingDown]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (opts.paused || hiddenRef.current || slotRef.current !== 1) {
        clearLangRestart();
        stopRec();
        return;
      }
      if (!warmedRef.current) {
        await warmMicrophoneOnce();
        warmedRef.current = true;
      }
      if (cancelled || opts.paused || hiddenRef.current || slotRef.current !== 1) return;
      clearRestart();
      restartTimerRef.current = window.setTimeout(() => startRecRef.current(), 400);
    })();

    return () => {
      cancelled = true;
      clearRestart();
      stopRec();
    };
  }, [opts.paused, supported, stopRec, clearRestart, clearLangRestart]);

  const prevLangRef = useRef(opts.lang ?? "es-ES");

  useEffect(() => {
    const next = opts.lang ?? "es-ES";
    if (next === prevLangRef.current) return;
    prevLangRef.current = next;
    if (opts.paused || !supported || slotRef.current !== 1) return;
    clearLangRestart();
    langRestartTimerRef.current = window.setTimeout(() => {
      langRestartTimerRef.current = 0;
      if (pausedRef.current || hiddenRef.current) return;
      stopRec();
      restartTimerRef.current = window.setTimeout(() => startRecRef.current(), LANG_RESTART_MS);
    }, LANG_RESTART_MS);
    return () => clearLangRestart();
  }, [opts.lang, opts.paused, supported, stopRec, clearLangRestart, clearRestart]);

  const clearError = useCallback(() => {
    fatalErrorRef.current = false;
    setError(null);
  }, []);

  return { supported, listening: sessionActive, error, clearError };
}
