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

let voicesCache: SpeechSynthesisVoice[] = [];
let voicesPreloadAttached = false;

/** Carga voces al abrir la app (Chrome las lista tarde → sin esto hay ~700 ms de silencio y voz robótica por defecto). */
export function preloadSpeechVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const sync = () => {
    const list = window.speechSynthesis.getVoices();
    if (list.length) voicesCache = list;
  };
  sync();
  if (!voicesPreloadAttached) {
    voicesPreloadAttached = true;
    window.speechSynthesis.addEventListener("voiceschanged", sync);
  }
}

function availableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const live = window.speechSynthesis.getVoices();
  if (live.length) voicesCache = live;
  return voicesCache.length ? voicesCache : live;
}

function pickBestVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = availableVoices();
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
    /** Voces locales arrancan al instante; las “online/neural” suelen tardar y sonar peor al inicio. */
    if (v.localService) s += 6;
    else if (n.includes("online") || n.includes("network")) s -= 3;
    if (primary === "es") {
      if (n.includes("helena") || n.includes("monica") || n.includes("laura") || n.includes("sabina")) s += 4;
      if (n.includes("google") && (n.includes("espa") || n.includes("spanish"))) s += 3;
      if (n.includes("microsoft")) s += 2;
    }
    if (primary === "en") {
      if (n.includes("google") || n.includes("microsoft")) s += 3;
      if (n.includes("jenny") || n.includes("guy") || n.includes("aria") || n.includes("samantha")) s += 2;
      if (n.includes("natural") || n.includes("neural")) s += 2;
    }
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

function waitForVoices(maxMs = 250): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    if (availableVoices().length > 0) {
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
  const isEn = lang.toLowerCase().startsWith("en");
  u.rate = isEn ? 1 : 1.08;
  u.pitch = 1;
}

/** Texto corto para TTS: en pantalla va completo; hablar todo el menú tarda y suena monótono. */
export function compactForSpeech(text: string, maxLen = 300): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const parts = t.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [t];
  let out = "";
  for (const s of parts) {
    const next = out + s;
    if (next.length > maxLen && out.length > 0) break;
    out = next;
  }
  const trimmed = out.trim();
  if (trimmed.length >= 48) return trimmed;
  return t.slice(0, maxLen).trim();
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
  const phrase = compactForSpeech(sanitizeForSpeech(text));
  if (!phrase) return Promise.resolve();

  return waitForVoices().then(
    () =>
      new Promise((resolve) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          resolve();
          return;
        }
        const syn = window.speechSynthesis;
        syn.cancel();
        /** Chrome a veces deja la cola en pausa hasta el primer resume. */
        try {
          syn.resume();
        } catch {
          /* */
        }
        const u = new SpeechSynthesisUtterance(phrase);
        configureUtterance(u, lang);
        u.onend = () => resolve();
        u.onerror = () => resolve();
        syn.speak(u);
        try {
          syn.resume();
        } catch {
          /* */
        }
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
  /** Inclusivo con barra (Bienvenido/a): suena «barra» en TTS */
  t = t.replace(/\b(\w+)o\/a\b/gi, (_, stem) => `${stem}os`);
  t = t.replace(/\b(\w+)a\/o\b/gi, (_, stem) => `${stem}os`);
  t = t.replace(/\s*\/\s*/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}
