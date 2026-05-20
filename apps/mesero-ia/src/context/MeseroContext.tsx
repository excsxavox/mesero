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
import { KioskFullscreenGuard } from "../components/mesero/KioskFullscreenGuard";
import { speakTextAsync, stopSpeaking } from "../hooks/useVoiceDictation";
import { useStableRecognitionLang } from "../hooks/useStableRecognitionLang";
import { useOrderStatusSync } from "../hooks/useOrderStatusSync";
import { useWakeWordListening } from "../hooks/useWakeWordListening";
import { chatComplete, getSettings } from "../lib/api";
import {
  loadMeseroSession,
  MESERO_SESSION_UPDATED,
  saveMeseroSession,
  type MeseroMsg,
} from "../lib/meseroSessionStorage";
import { speechLocaleFromConversation } from "../lib/speechLocale";
import type { ConfirmedBundle, DraftLineInput } from "../lib/orderDisplayLines";
import type { Settings } from "../lib/types";
import { applyKioskTableFromUrl } from "../lib/kioskTable";
import { clampSelectedTable, formatTableLabel, normalizeTableCount } from "../lib/tables";
import { displayAssistantName, normalizeWakeWord } from "../lib/wakeWord";

function textForAssistantVoice(content: string): string {
  if (/OPENAI_API_KEY|modo demo/i.test(content) && content.length > 160) {
    return "El mesero está en modo demostración: el servidor no tiene la clave de OpenAI cargada.";
  }
  return content;
}

type MeseroContextValue = {
  settings: Settings | null;
  messages: MeseroMsg[];
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
  /** Borrador devuelto por Karen (DRAFT_JSON) en el último turno. */
  pendingDraft: DraftLineInput[];
  /** Texto del cliente desde el último pedido confirmado (evita arrastrar platos viejos). */
  orderDraftCorpus: string;
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

const MeseroContext = createContext<MeseroContextValue | null>(null);

export function useMesero() {
  const ctx = useContext(MeseroContext);
  if (!ctx) throw new Error("useMesero debe usarse dentro de MeseroLayout");
  return ctx;
}

export function MeseroLayout({ children }: { children?: ReactNode }) {
  const [searchParams] = useSearchParams();
  const initial = loadMeseroSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [messages, setMessages] = useState<MeseroMsg[]>(initial.messages ?? []);
  const [touchCart, setTouchCart] = useState<Record<string, number>>(initial.touchCart);
  const [confirmed, setConfirmed] = useState<ConfirmedBundle[]>([]);
  const [pendingDraft, setPendingDraft] = useState<DraftLineInput[]>([]);
  const [draftEpochMs, setDraftEpochMs] = useState(0);
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
          if (p.status === "listo") orderToastRef.current?.("¡Tu pedido está listo para servir!");
          else if (p.status === "entregado") orderToastRef.current?.("Pedido entregado en cocina.");
          return { ...b, status: p.status, statusChangedAt: p.statusChangedAt ?? b.statusChangedAt };
        });
        return changed ? next : prev;
      });
    },
    [],
  );

  useOrderStatusSync(confirmedOrderIds, applyOrderStatusPatches);

  const needsMandatoryPasswordSetup = Boolean(settings && !settings.adminExitPasswordConfigured);

  const orderDraftCorpus = useMemo(() => {
    const users = messages.filter((m) => m.role === "user");
    const scoped = draftEpochMs
      ? users.filter((m) => {
          if (!m.at) return true;
          return new Date(m.at).getTime() > draftEpochMs;
        })
      : users;
    return scoped.map((m) => m.content).join(" ");
  }, [messages, draftEpochMs]);

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
    () => (selectedTable ? formatTableLabel(selectedTable) : null),
    [selectedTable],
  );

  useEffect(() => {
    const syncTableFromSession = () => {
      const session = loadMeseroSession();
      setSelectedTableState(clampSelectedTable(session.selectedTable ?? null, tableCount));
    };
    syncTableFromSession();
    window.addEventListener(MESERO_SESSION_UPDATED, syncTableFromSession);
    window.addEventListener("focus", syncTableFromSession);
    return () => {
      window.removeEventListener(MESERO_SESSION_UPDATED, syncTableFromSession);
      window.removeEventListener("focus", syncTableFromSession);
    };
  }, [tableCount]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveMeseroSession({
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
      const localTable = loadMeseroSession().selectedTable;
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
    (content: string, messagesForLocale: MeseroMsg[]) => {
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
    setPendingDraft([]);
    setDraftEpochMs(Date.now());
    setMessages((m) => m.filter((x) => x.role !== "user"));
  }, []);

  const clearConversation = useCallback(() => {
    stopSpeaking();
    setTtsActive(false);
    setTouchCart({});
    setConfirmed([]);
    setPendingDraft([]);
    setDraftEpochMs(0);
    setMessages([]);
  }, []);

  const sendWithText = useCallback(
    async (raw: string) => {
      if (needsMandatoryPasswordSetup) return;
      const text = raw.trim();
      if (!text || busy) return;
      const next: MeseroMsg[] = [...messages, { role: "user", content: text, at: new Date().toISOString() }];
      setMessages(next);
      setBusy(true);
      try {
        const payload = next.map((m) => ({ role: m.role, content: m.content }));
        const res = await chatComplete(payload, {
          selectedTable,
          kitchenOrderIds: confirmedRef.current.map((c) => c.id),
        });
        setMessages((m) => [...m, { role: "assistant", content: res.content, at: new Date().toISOString() }]);
        playAssistantVoice(res.content, next);
        if (Array.isArray(res.draftItems)) {
          setPendingDraft(
            res.draftItems.map((it) => ({
              menuItemId: it.menuItemId,
              name: it.name,
              qty: Math.max(1, Math.min(99, Math.floor(it.qty) || 1)),
            })),
          );
        }
        if (res.paymentFlow?.phase === "ready") {
          orderToastRef.current?.("Cuenta enviada a caja con datos de facturación.");
        }
        if (res.order) {
          setTouchCart({});
          setPendingDraft([]);
          setDraftEpochMs(Date.now());
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
          orderToastRef.current?.("Pedido enviado a cocina.");
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

  const value: MeseroContextValue = {
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
    pendingDraft,
    orderDraftCorpus,
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
    <MeseroContext.Provider value={value}>
      <KioskFullscreenGuard />
      {children ?? <Outlet />}
    </MeseroContext.Provider>
  );
}
