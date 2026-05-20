import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import { RecepcionFullscreenGuard } from "../components/mesero/RecepcionFullscreenGuard";
import { speakTextAsync, stopSpeaking } from "../hooks/useVoiceDictation";
import { useStableRecognitionLang } from "../hooks/useStableRecognitionLang";
import { useOrderStatusSync } from "../hooks/useOrderStatusSync";
import { useWakeWordListening } from "../hooks/useWakeWordListening";
import { chatComplete, getSettings } from "../lib/api";
import {
  loadRecepcionSession,
  RECEPCION_SESSION_UPDATED,
  saveRecepcionSession,
  type RecepcionMsg,
} from "../lib/recepcionSessionStorage";
import { speechLocaleFromConversation } from "../lib/speechLocale";
import type { ConfirmedBundle } from "../lib/orderDisplayLines";
import type { Settings } from "../lib/types";
import { applyKioskTableFromUrl } from "../lib/kioskTable";
import { formatStationLabel } from "../lib/receptionCopy";
import { clampSelectedTable, normalizeTableCount } from "../lib/tables";
import { displayAssistantName, normalizeWakeWord } from "../lib/wakeWord";

function textForAssistantVoice(content: string): string {
  if (/OPENAI_API_KEY|modo demo/i.test(content) && content.length > 160) {
    return "La recepción está en modo demostración: el servidor no tiene la clave de OpenAI cargada.";
  }
  return content;
}

type RecepcionContextValue = {
  settings: Settings | null;
  messages: RecepcionMsg[];
  busy: boolean;
  ttsActive: boolean;
  listening: boolean;
  supported: boolean;
  voiceError: string | null;
  needsMandatoryPasswordSetup: boolean;
  touchCart: Record<string, number>;
  setTouchCart: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  confirmed: ConfirmedBundle[];
  setConfirmed: React.Dispatch<React.SetStateAction<ConfirmedBundle[]>>;
  clearOrder: () => void;
  clearConversation: () => void;
  sendWithText: (raw: string) => Promise<void>;
  lastAssistantText: string;
  wakeWord: string;
  assistantName: string;
  tableCount: number;
  selectedTable: number | null;
  /** Asigna la mesa de este dispositivo (solo local; no pisa otros quioscos). */
  assignKioskTable: (table: number) => void;
  tableLabel: string | null;
  registerOrderToast: (fn: ((msg: string) => void) | null) => void;
  refreshSettings: () => Promise<void>;
};

const RecepcionContext = createContext<RecepcionContextValue | null>(null);

export function useRecepcion() {
  const ctx = useContext(RecepcionContext);
  if (!ctx) throw new Error("useRecepcion debe usarse dentro de RecepcionLayout");
  return ctx;
}

export function RecepcionLayout({ children }: { children?: ReactNode }) {
  const [searchParams] = useSearchParams();
  const initial = loadRecepcionSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [messages, setMessages] = useState<RecepcionMsg[]>(initial.messages ?? []);
  const [touchCart, setTouchCart] = useState<Record<string, number>>(initial.touchCart);
  const [confirmed, setConfirmed] = useState<ConfirmedBundle[]>([]);
  const [selectedTable, setSelectedTableState] = useState<number | null>(() =>
    clampSelectedTable(initial.selectedTable ?? null, normalizeTableCount(undefined)),
  );
  const [busy, setBusy] = useState(false);
  const [ttsActive, setTtsActive] = useState(false);
  const orderToastRef = useRef<((msg: string) => void) | null>(null);
  const confirmedRef = useRef(confirmed);
  confirmedRef.current = confirmed;

  const confirmedOrderIds = useMemo(() => confirmed.map((c) => c.id), [confirmed]);

  const applyOrderStatusPatches = useCallback(
    (patches: { id: string; status: string; statusChangedAt?: string }[]) => {
      setConfirmed((prev) => {
        let changed = false;
        const next = prev.map((b) => {
          const p = patches.find((x) => x.id === b.id);
          if (!p || p.status === b.status) return b;
          changed = true;
          if (p.status === "listo") orderToastRef.current?.("¡Tu tour o producto está confirmado!");
          else if (p.status === "entregado") orderToastRef.current?.("Experiencia completada.");
          return { ...b, status: p.status, statusChangedAt: p.statusChangedAt ?? b.statusChangedAt };
        });
        return changed ? next : prev;
      });
    },
    [],
  );

  useOrderStatusSync(confirmedOrderIds, applyOrderStatusPatches);

  const needsMandatoryPasswordSetup = Boolean(settings && !settings.adminExitPasswordConfigured);

  const orderDraftCorpus = useMemo(
    () => messages.filter((m) => m.role === "user").map((m) => m.content).join(" "),
    [messages],
  );

  const tableCount = useMemo(
    () => normalizeTableCount(settings?.tableCount),
    [settings?.tableCount],
  );

  useEffect(() => {
    setSelectedTableState((prev) => clampSelectedTable(prev, tableCount));
  }, [tableCount]);

  useEffect(() => {
    const fromUrl = applyKioskTableFromUrl(searchParams, tableCount);
    if (fromUrl) setSelectedTableState(fromUrl);
  }, [searchParams, tableCount]);

  const assignKioskTable = useCallback(
    (table: number) => {
      const clamped = clampSelectedTable(table, tableCount);
      if (!clamped) return;
      setSelectedTableState(clamped);
    },
    [tableCount],
  );

  const tableLabel = useMemo(
    () => (selectedTable ? formatStationLabel(selectedTable) : null),
    [selectedTable],
  );

  useEffect(() => {
    const syncTableFromSession = () => {
      const session = loadRecepcionSession();
      setSelectedTableState(clampSelectedTable(session.selectedTable ?? null, tableCount));
    };
    syncTableFromSession();
    window.addEventListener(RECEPCION_SESSION_UPDATED, syncTableFromSession);
    window.addEventListener("focus", syncTableFromSession);
    return () => {
      window.removeEventListener(RECEPCION_SESSION_UPDATED, syncTableFromSession);
      window.removeEventListener("focus", syncTableFromSession);
    };
  }, [tableCount]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveRecepcionSession({
        touchCart,
        corpus: orderDraftCorpus,
        messages,
        selectedTable,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [touchCart, orderDraftCorpus, messages, selectedTable]);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await getSettings();
      setSettings(s);
      const localTable = loadRecepcionSession().selectedTable;
      const fromServer =
        typeof s.kioskTable === "number" && Number.isFinite(s.kioskTable) ? Math.round(s.kioskTable) : null;
      if (!localTable && fromServer) {
        setSelectedTableState((prev) => prev ?? clampSelectedTable(fromServer, normalizeTableCount(s.tableCount)));
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
    return () => stopSpeaking();
  }, [refreshSettings]);

  useEffect(() => {
    const onFocus = () => void refreshSettings();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshSettings]);

  const wakeWord = useMemo(() => normalizeWakeWord(settings?.wakeWord), [settings?.wakeWord]);

  const playAssistantVoice = useCallback(
    (content: string, messagesForLocale: RecepcionMsg[]) => {
      setTtsActive(true);
      const locale =
        messagesForLocale.length > 0
          ? speechLocaleFromConversation(messagesForLocale, wakeWord)
          : "es-ES";
      void speakTextAsync(textForAssistantVoice(content), locale).finally(() => setTtsActive(false));
    },
    [wakeWord],
  );

  const clearOrder = useCallback(() => {
    stopSpeaking();
    setTtsActive(false);
    setTouchCart({});
    setConfirmed([]);
    setMessages((m) => m.filter((x) => x.role !== "user"));
  }, []);

  const clearConversation = useCallback(() => {
    stopSpeaking();
    setTtsActive(false);
    setTouchCart({});
    setConfirmed([]);
    setMessages([]);
  }, []);

  const sendWithText = useCallback(
    async (raw: string) => {
      if (needsMandatoryPasswordSetup) return;
      const text = raw.trim();
      if (!text || busy) return;
      const next: RecepcionMsg[] = [...messages, { role: "user", content: text, at: new Date().toISOString() }];
      setMessages(next);
      setBusy(true);
      try {
        const payload = next.map((m) => ({ role: m.role, content: m.content }));
        const res = await chatComplete(payload, {
          selectedTable,
          kitchenOrderIds: confirmedRef.current.map((c) => c.id),
          appMode: "reception",
        });
        setMessages((m) => [...m, { role: "assistant", content: res.content, at: new Date().toISOString() }]);
        playAssistantVoice(res.content, next);
        if (res.order) {
          setTouchCart({});
          setConfirmed((c) => [
            {
              id: res.order!.id,
              createdAt: res.order!.createdAt,
              items: res.order!.items,
              status: res.order!.status || "nuevo",
              statusChangedAt: res.order!.statusChangedAt,
            },
            ...c,
          ]);
          orderToastRef.current?.("Tour o producto registrado en recepción.");
        }
      } catch (e) {
        const errText = `No pude contactar al servidor: ${String(e)}`;
        setMessages((m) => [...m, { role: "assistant", content: errText, at: new Date().toISOString() }]);
        playAssistantVoice(errText, next);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, playAssistantVoice, needsMandatoryPasswordSetup, selectedTable],
  );

  const sendRef = useRef(sendWithText);
  sendRef.current = sendWithText;

  const recognitionLang = useStableRecognitionLang(messages, wakeWord);
  const assistantName = useMemo(() => displayAssistantName(wakeWord), [wakeWord]);

  const { supported, listening, error: voiceError } = useWakeWordListening({
    wakeWord,
    lang: recognitionLang,
    paused: busy || ttsActive || needsMandatoryPasswordSetup,
    onCommand: (t) => void sendRef.current(t),
  });

  const lastAssistantText = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    return last?.content ?? "";
  }, [messages]);

  const value: RecepcionContextValue = {
    settings,
    messages,
    busy,
    ttsActive,
    listening,
    supported,
    voiceError,
    needsMandatoryPasswordSetup,
    touchCart,
    setTouchCart,
    confirmed,
    setConfirmed,
    clearOrder,
    clearConversation,
    sendWithText,
    lastAssistantText,
    wakeWord,
    assistantName,
    tableCount,
    selectedTable,
    assignKioskTable,
    tableLabel,
    registerOrderToast: (fn) => {
      orderToastRef.current = fn;
    },
    refreshSettings,
  };

  return (
    <RecepcionContext.Provider value={value}>
      <RecepcionFullscreenGuard />
      {children ?? <Outlet />}
    </RecepcionContext.Provider>
  );
}
