import { useCallback, useEffect, useRef, useState } from "react";

/** Tipos mínimos para Web Speech API (evitan depender del nombre global `SpeechRecognition` en TS). */
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
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

type RecCtor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type Opts = { lang?: string; onLiveText?: (text: string) => void };

/** Dictado con Web Speech API (gratis en el dispositivo; Chrome/Edge suelen ir mejor que Firefox). */
export function useVoiceDictation(options: Opts) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalBuf = useRef("");
  const liveRef = useRef("");
  const onLiveTextRef = useRef(options.onLiveText);
  const lang = options.lang ?? "es-ES";

  useEffect(() => {
    onLiveTextRef.current = options.onLiveText;
  }, [options.onLiveText]);

  const supported = getRecognitionCtor() !== null;

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Tu navegador no expone reconocimiento de voz.");
      return;
    }
    setError(null);
    finalBuf.current = "";
    liveRef.current = "";

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);

    rec.onresult = (ev: SpeechRecEvent) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const chunk = r[0]?.transcript ?? "";
        if (r.isFinal) finalBuf.current += chunk;
        else interim += chunk;
      }
      const live = `${finalBuf.current}${interim}`.trim();
      liveRef.current = live;
      onLiveTextRef.current?.(live);
    };

    rec.onerror = (ev: SpeechRecErrorEvent) => {
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      setError(ev.error);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setError("No se pudo iniciar el micrófono.");
      setListening(false);
    }
  }, [lang]);

  const takeLiveText = useCallback(() => liveRef.current.trim(), []);

  return { supported, listening, error, start, stop, takeLiveText, clearError: () => setError(null) };
}

function pickBestVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const want = lang.replaceAll("_", "-").toLowerCase();
  const [p0, p1] = want.split("-");
  const primary = p0 || want;
  let pool = voices.filter((v) => v.lang.toLowerCase().replaceAll("_", "-").startsWith(`${primary}-`));
  if (!pool.length) pool = voices.filter((v) => v.lang.toLowerCase().startsWith(primary));
  if (!pool.length) return undefined;
  if (p1) {
    const hit = pool.filter((v) => v.lang.toLowerCase().includes(p1));
    if (hit.length) pool = hit;
  }
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    const n = v.name.toLowerCase();
    const l = v.lang.toLowerCase().replaceAll("_", "-");
    if (l === want || l.startsWith(`${want}`)) s += 5;
    if (v.localService) s += 1;
    if (n.includes("natural") || n.includes("neural") || n.includes("online")) s += 4;
    if (primary === "en") {
      if (n.includes("google") || n.includes("microsoft")) s += 3;
      if (n.includes("jenny") || n.includes("guy") || n.includes("aria") || n.includes("samantha")) s += 2;
    }
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

function waitForVoices(maxMs = 700): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    if (window.speechSynthesis.getVoices().length > 0) {
      resolve();
      return;
    }
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      window.clearTimeout(t);
      resolve();
    };
    const t = window.setTimeout(done, maxMs);
    window.speechSynthesis.addEventListener("voiceschanged", done);
  });
}

function configureUtterance(u: SpeechSynthesisUtterance, lang: string) {
  u.lang = lang;
  const voice = pickBestVoice(lang);
  if (voice) u.voice = voice;
  u.rate = lang.toLowerCase().startsWith("en") ? 0.95 : 1;
}

export function speakText(text: string, lang = "es-ES") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(sanitizeForSpeech(text));
  configureUtterance(u, lang);
  window.speechSynthesis.speak(u);
}

/** Igual que `speakText` pero espera a que termine (o falle) la locución. */
export function speakTextAsync(text: string, lang = "es-ES"): Promise<void> {
  return waitForVoices().then(
    () =>
      new Promise((resolve) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(sanitizeForSpeech(text));
        configureUtterance(u, lang);
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      }),
  );
}

function sanitizeForSpeech(raw: string) {
  let t = String(raw ?? "");
  /** Marcadores de pedido interno: no deben oírse en voz. */
  t = t.replace(/<<<ORDER_JSON>>>[\s\S]*?<<<END_ORDER_JSON>>>/gi, " ");
  t = t.replace(/<<<DRAFT_JSON>>>[\s\S]*?<<<END_DRAFT_JSON>>>/gi, " ");
  /** Cualquier otro bloque <<< … >>> residual */
  t = t.replace(/<<<[\s\S]*?>>>/g, " ");
  t = t.replace(/\*\*/g, "");
  t = t.replace(/`+/g, "");
  /** Markdown: encabezados con # suenan como «almohadilla» repetida en TTS */
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/#/g, "");
  /** Enlaces markdown [texto](url) → solo texto */
  t = t.replace(/\[([^\]]+)]\([^)]+\)/g, "$1");
  return t.replace(/\s+/g, " ").trim();
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}
