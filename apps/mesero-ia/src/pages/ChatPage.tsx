import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFullscreen } from "../hooks/useFullscreen";
import { useLocation, useNavigate } from "react-router-dom";
import { saveMeseroSession } from "../lib/meseroSessionStorage";
import { KarenProfileCard } from "../components/mesero/KarenProfileCard";
import { VoiceOrb } from "../components/mesero/VoiceOrb";
import { MeseroHeader } from "../components/mesero/MeseroHeader";
import { MenuQrCard } from "../components/mesero/MenuQrCard";
import { OrderSummaryCard } from "../components/mesero/OrderSummaryCard";
import { MenuQuickPanel } from "../components/mesero/MenuQuickPanel";
import { VoiceHintsCard } from "../components/mesero/VoiceHintsCard";
import { VoiceListeningCard } from "../components/mesero/VoiceListeningCard";
import { useAuth } from "../context/AuthContext";
import { useMesero } from "../context/MeseroContext";
import { useMeseroTheme } from "../context/MeseroThemeContext";
import { categoryPreviewsForStrip } from "../lib/menuCategories";
import { mergedActiveLines } from "../lib/orderDisplayLines";
import {
  clearAdminEntryUnlock,
  isAdminExitLockArmed,
  setAdminEntryUnlocked,
  setAdminExitLockArmed,
} from "../lib/adminExitLock";
import { useRefreshableMenu } from "../hooks/useRefreshableMenu";
import { getHealth, putSettings, verifyAdminExitPassword } from "../lib/api";

type AdminGateMode = null | { kind: "disarm" } | { kind: "navigate"; to: string };

export function ChatPage() {
  const {
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
    assistantName,
    registerOrderToast,
    refreshSettings,
    selectedTable,
    tableLabel,
  } = useMesero();
  const { theme, toggleTheme } = useMeseroTheme();
  const { companyName: profileCompanyName } = useAuth();

  const { menu } = useRefreshableMenu();
  const [input, setInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [lockArmed, setLockArmed] = useState(() => isAdminExitLockArmed());
  const [adminGate, setAdminGate] = useState<AdminGateMode>(null);
  const [gatePassword, setGatePassword] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [setupPass, setSetupPass] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [openAiOnServer, setOpenAiOnServer] = useState<boolean | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, enter: enterFullscreen, exit: exitFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } =
    useFullscreen();

  const onFullscreenToggle = useCallback(() => {
    if (lockArmed) {
      setGateError(null);
      setGatePassword("");
      setAdminGate({ kind: "disarm" });
      return;
    }
    void toggleFullscreen(pageRef.current ?? undefined);
  }, [lockArmed, toggleFullscreen]);

  const bumpTouchDelta = useCallback((menuItemId: string, delta: number) => {
    setTouchCart((prev) => {
      const next = { ...prev };
      const q = (next[menuItemId] ?? 0) + delta;
      if (q <= 0) delete next[menuItemId];
      else next[menuItemId] = Math.min(99, q);
      return next;
    });
  }, [setTouchCart]);

  useEffect(() => {
    registerOrderToast((msg) => {
      setToast(msg);
      window.setTimeout(() => setToast(null), 4000);
    });
    return () => registerOrderToast(null);
  }, [registerOrderToast]);

  const menuCategories = useMemo(() => categoryPreviewsForStrip(menu, [], 12), [menu]);
  const quickMenuCategories = useMemo(() => menuCategories.slice(0, 4), [menuCategories]);

  const hasActiveOrder = useMemo(
    () => mergedActiveLines(menu, orderDraftCorpus, touchCart, pendingDraft).length > 0,
    [menu, orderDraftCorpus, touchCart, pendingDraft],
  );

  const wakeMode = listening && !busy && !ttsActive;

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const handleClearOrder = useCallback(() => {
    clearOrder();
    flashToast("Pedido limpiado.");
  }, [clearOrder, flashToast]);

  const handleClearConversation = useCallback(() => {
    clearConversation();
    flashToast("Conversación reiniciada.");
  }, [clearConversation, flashToast]);

  const openCatalog = useCallback(
    (category: string | null) => {
      saveMeseroSession({ touchCart, corpus: orderDraftCorpus, messages, selectedTable });
      const q = category?.trim() ? `?categoria=${encodeURIComponent(category.trim())}` : "";
      navigate(`/catalogo${q}`);
    },
    [navigate, touchCart, orderDraftCorpus, messages, selectedTable],
  );

  useEffect(() => {
    let cancelled = false;
    void getHealth()
      .then((h) => {
        if (!cancelled)
          setOpenAiOnServer(typeof h.openAiConfigured === "boolean" ? h.openAiConfigured : true);
      })
      .catch(() => {
        if (!cancelled) setOpenAiOnServer(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    clearAdminEntryUnlock();
  }, []);

  useEffect(() => {
    const st = location.state as { adminGateDenied?: boolean; openAdminGate?: string } | null;
    if (st?.adminGateDenied) {
      setToast("Área de administración protegida. Introduce la contraseña al pulsar Administración.");
      setTimeout(() => setToast(null), 5000);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (st?.openAdminGate && lockArmed) {
      openAdmin(st.openAdminGate);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, lockArmed]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void sendWithText(text);
  };

  const openAdmin = (to: string) => {
    if (lockArmed) {
      setGateError(null);
      setGatePassword("");
      setAdminGate({ kind: "navigate", to });
      return;
    }
    navigate(to);
  };

  const onPadlockClick = () => {
    if (!lockArmed) {
      setAdminExitLockArmed(true);
      setLockArmed(true);
      if (fullscreenSupported) void enterFullscreen(pageRef.current ?? undefined);
      setToast(
        "Candado activo: pantalla bloqueada en modo quiosco. Usa la contraseña de administrador para desbloquear.",
      );
      setTimeout(() => setToast(null), 5000);
      return;
    }
    setGateError(null);
    setGatePassword("");
    setAdminGate({ kind: "disarm" });
  };

  const submitGate = async () => {
    const mode = adminGate;
    if (!mode) return;
    setGateBusy(true);
    setGateError(null);
    try {
      await verifyAdminExitPassword(gatePassword);
      if (mode.kind === "disarm") {
        setAdminExitLockArmed(false);
        setLockArmed(false);
        if (fullscreenSupported) void exitFullscreen();
        setAdminGate(null);
        setGatePassword("");
        setToast("Candado desactivado. Ya puedes salir de pantalla completa si quieres.");
        setTimeout(() => setToast(null), 4000);
      } else {
        setAdminEntryUnlocked(true);
        const dest = mode.to;
        setAdminGate(null);
        setGatePassword("");
        navigate(dest);
      }
    } catch (e) {
      setGateError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setGateBusy(false);
    }
  };

  const closeGate = () => {
    setAdminGate(null);
    setGatePassword("");
    setGateError(null);
  };

  const submitMandatoryPasswordSetup = async () => {
    if (setupPass.length < 4) {
      setSetupError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }
    if (setupPass !== setupConfirm) {
      setSetupError("Las contraseñas no coinciden.");
      return;
    }
    setSetupBusy(true);
    setSetupError(null);
    try {
      await putSettings({ adminExitPassword: setupPass });
      await refreshSettings();
      setSetupPass("");
      setSetupConfirm("");
    } catch (e) {
      setSetupError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setSetupBusy(false);
    }
  };

  return (
    <div
      ref={pageRef}
      className={`mx-auto flex min-h-0 flex-col px-3 py-4 sm:px-5 sm:py-5 ${
        isFullscreen ? "h-[100dvh] max-w-none w-full" : "h-full max-w-7xl"
      }`}
    >
      {needsMandatoryPasswordSetup ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/95 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="mandatory-password-title"
          aria-describedby="mandatory-password-desc"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-900 p-6 shadow-2xl ring-1 ring-amber-500/20">
            <h2 id="mandatory-password-title" className="text-xl font-semibold text-zinc-50">
              Contraseña obligatoria
            </h2>
            <p id="mandatory-password-desc" className="mt-2 text-sm leading-relaxed text-zinc-400">
              Aún no hay contraseña de administrador para el candado del mesero. Debes crearla aquí para continuar: la
              usarás al activar el candado y para acceder a Administración cuando esté bloqueado. Solo se guarda un hash
              en el servidor.
            </p>
            <label className="mt-5 block text-sm text-zinc-300">
              Nueva contraseña
              <input
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/25"
                value={setupPass}
                onChange={(e) => {
                  setSetupPass(e.target.value);
                  setSetupError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitMandatoryPasswordSetup();
                }}
              />
            </label>
            <label className="mt-3 block text-sm text-zinc-300">
              Confirmar contraseña
              <input
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/25"
                value={setupConfirm}
                onChange={(e) => {
                  setSetupConfirm(e.target.value);
                  setSetupError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitMandatoryPasswordSetup();
                }}
              />
            </label>
            {setupError ? <p className="mt-3 text-sm text-red-300">{setupError}</p> : null}
            <button
              type="button"
              disabled={setupBusy || !setupPass.trim() || !setupConfirm.trim()}
              onClick={() => void submitMandatoryPasswordSetup()}
              className="mt-6 w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {setupBusy ? "Guardando…" : "Guardar y continuar"}
            </button>
          </div>
        </div>
      ) : null}

      {adminGate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-gate-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl ring-1 ring-zinc-800">
            <h2 id="admin-gate-title" className="text-lg font-semibold text-zinc-50">
              {adminGate.kind === "disarm" ? "Quitar candado" : "Contraseña de administrador"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {adminGate.kind === "disarm"
                ? "Introduce la contraseña que guardaste en Administración → Configuración IA (Candado del mesero)."
                : "Para acceder a Administración con el candado activo."}
            </p>
            <input
              type="password"
              autoComplete="current-password"
              className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30"
              placeholder="Contraseña"
              value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitGate();
              }}
            />
            {gateError ? <p className="mt-2 text-sm text-red-300">{gateError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeGate}
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={gateBusy || !gatePassword.trim()}
                onClick={() => void submitGate()}
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {gateBusy ? "…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MeseroHeader
        restaurantName={profileCompanyName || settings?.restaurantName?.trim() || "Mi restaurante"}
        tableLabel={tableLabel}
        lockArmed={lockArmed}
        onPadlockClick={onPadlockClick}
        onAdminClick={() => openAdmin("/admin")}
        adminIsLink={!lockArmed}
        isFullscreen={isFullscreen}
        onFullscreenToggle={onFullscreenToggle}
        fullscreenSupported={fullscreenSupported && !lockArmed}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
      {openAiOnServer === false ? (
        <div
          className="mb-3 rounded-lg border border-amber-600/40 bg-amber-950/35 px-3 py-2 text-xs leading-relaxed text-amber-100/95 ring-1 ring-amber-700/30"
          role="status"
          aria-label="Estado del servidor: sin clave de OpenAI"
        >
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400/95">
            Estado del servidor (no es el pedido)
          </p>
          El backend está en <strong className="font-semibold">modo demo</strong>: no detecta una clave de OpenAI
          usable. Coloca <code className="rounded bg-zinc-900 px-1 py-0.5 text-amber-200/90">OPENAI_API_KEY</code> en
          el <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">.env</code> de la raíz del monorepo (o en{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">packages/mesero-server/.env</code>) sin
          espacios alrededor del valor, <strong className="font-medium text-amber-200">guarda el archivo en disco</strong>{" "}
          (Ctrl+S) y reinicia <code className="text-zinc-300">mesero-server</code>.
        </div>
      ) : null}

      {(!supported || voiceError) ? (
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-zinc-400">
          {!supported ? (
            <span className="text-amber-200/80">Este navegador no soporta reconocimiento de voz continuo.</span>
          ) : null}
          {voiceError ? <span className="text-red-300">Voz: {voiceError}</span> : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="grid grid-cols-1 gap-4 pb-2 md:grid-cols-[minmax(0,1fr)_minmax(17rem,34%)] md:items-start md:[grid-template-areas:'profile_order'_'voice_order'_'categories_hints']">
            <div className="min-w-0 md:[grid-area:profile]">
              <KarenProfileCard
                assistantName={assistantName}
                lastAssistantText={lastAssistantText}
                onClearConversation={
                  messages.length > 0 && !needsMandatoryPasswordSetup ? handleClearConversation : undefined
                }
                clearConversationDisabled={busy}
              />
            </div>
            <div className="min-w-0 md:[grid-area:voice]">
              <VoiceOrb
                assistantName={assistantName}
                busy={busy}
                ttsActive={ttsActive}
                listening={listening}
                supported={supported}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:[grid-area:order] md:row-span-2 md:self-start">
              <MenuQrCard compact={hasActiveOrder} />
              <OrderSummaryCard
                menu={menu}
                corpus={orderDraftCorpus}
                pendingDraft={pendingDraft}
                touchCart={touchCart}
                confirmed={confirmed}
                busy={busy}
                onClearConfirmed={() => setConfirmed([])}
                onClearOrder={
                  !needsMandatoryPasswordSetup && (hasActiveOrder || confirmed.length > 0)
                    ? handleClearOrder
                    : undefined
                }
                onTouchDelta={needsMandatoryPasswordSetup ? undefined : bumpTouchDelta}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:[grid-area:categories]">
              <VoiceHintsCard assistantName={assistantName} />
              <VoiceListeningCard assistantName={assistantName} active={wakeMode || ttsActive} />
            </div>
            <div className="min-w-0 md:[grid-area:hints] md:self-stretch">
              <MenuQuickPanel
                categories={quickMenuCategories}
                disabled={needsMandatoryPasswordSetup}
                onSelectCategory={(cat) => openCatalog(cat)}
                onViewCatalog={() => openCatalog(null)}
              />
            </div>
          </div>
        </div>

        <footer className="relative z-10 shrink-0 border-t border-mesero-line/15 bg-mesero-deep/95 pt-3 backdrop-blur-sm">
          <div className="flex gap-2 rounded-2xl border border-mesero-line/10 bg-mesero-deep/20 p-2">
            <input
              className="touch-manipulation min-h-12 min-w-0 flex-1 rounded-xl border border-mesero-line/20 bg-mesero-deep px-4 py-3 text-base text-mesero-text outline-none focus:border-mesero-accent/50 focus:ring-2 focus:ring-mesero-accent/25"
              placeholder={
                needsMandatoryPasswordSetup
                  ? "Define la contraseña en el cuadro emergente para usar el mesero"
                  : "Opcional (personal): escribe tu mensaje"
              }
              value={input}
              disabled={busy || needsMandatoryPasswordSetup}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="button"
              aria-label="Enviar mensaje"
              disabled={busy || needsMandatoryPasswordSetup}
              onClick={send}
              className="touch-manipulation flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-mesero-accent to-blue-600 px-4 text-white hover:from-blue-400 hover:to-blue-500 disabled:opacity-50"
            >
              {busy ? (
                <span className="text-lg leading-none">…</span>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 12h12m0 0l-4-4m4 4l-4 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
          {toast ? (
            <div className="mt-2 rounded-lg bg-emerald-900/40 px-3 py-2 text-center text-sm text-emerald-200 ring-1 ring-emerald-700/50">
              {toast}
            </div>
          ) : null}
        </footer>
      </div>

    </div>
  );
}
