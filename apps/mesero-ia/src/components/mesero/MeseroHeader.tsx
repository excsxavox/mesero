import { Link } from "react-router-dom";
import { ThemeToggleButton } from "./ThemeToggleButton";
import type { MeseroTheme } from "../../lib/meseroTheme";

type Props = {
  restaurantName: string;
  /** Mesa fijada en este dispositivo (varios quioscos = varias mesas). */
  tableLabel?: string | null;
  lockArmed: boolean;
  onPadlockClick: () => void;
  onAdminClick: () => void;
  adminIsLink: boolean;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  fullscreenSupported?: boolean;
  theme?: MeseroTheme;
  onThemeToggle?: () => void;
};

function IconBurger() {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-mesero-accent to-mesero-accent-strong text-lg shadow-lg shadow-mesero-deep/40">
      🍔
    </span>
  );
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      />
    </svg>
  );
}

function IconLockOpen(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={props.className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function IconFullscreen(props: { className?: string; exit?: boolean }) {
  return props.exit ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={props.className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={props.className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

function IconLockClosed(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={props.className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.6-1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MeseroHeader({
  restaurantName,
  tableLabel,
  lockArmed,
  onPadlockClick,
  onAdminClick,
  adminIsLink,
  isFullscreen = false,
  onFullscreenToggle,
  fullscreenSupported = false,
  theme = "dark",
  onThemeToggle,
}: Props) {
  const adminBtnClass =
    "touch-manipulation inline-flex min-h-10 items-center gap-2 rounded-xl border border-mesero-line/25 bg-mesero-panel/40 px-4 py-2 text-sm font-medium text-mesero-text/95 hover:bg-mesero-panel/50";

  return (
    <header className="mb-4 flex shrink-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <IconBurger />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-mesero-text sm:text-xl">{restaurantName}</h1>
          <p className="text-xs text-mesero-text-muted">
            {tableLabel ? (
              <>
                <span className="badge-mesero-table mr-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold">{tableLabel}</span>
                {lockArmed ? " · candado activo" : " · asistente de voz"}
              </>
            ) : lockArmed ? (
              "Modo quiosco · candado activo"
            ) : (
              "Asistente de voz con IA"
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onThemeToggle ? <ThemeToggleButton theme={theme} onToggle={onThemeToggle} /> : null}
        {fullscreenSupported && onFullscreenToggle && !lockArmed ? (
          <button
            type="button"
            onClick={onFullscreenToggle}
            aria-pressed={isFullscreen}
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            className={`touch-manipulation flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              isFullscreen
                ? "border-mesero-accent/40 bg-mesero-accent/20 text-mesero-text"
                : "border-mesero-line/20 bg-mesero-panel/50 text-mesero-text-muted hover:bg-mesero-panel/40"
            }`}
          >
            <IconFullscreen className="h-5 w-5" exit={isFullscreen} />
            <span className="sr-only">{isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPadlockClick}
          aria-pressed={lockArmed}
          className={`touch-manipulation flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
            lockArmed
              ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
              : "border-mesero-line/20 bg-mesero-panel/50 text-mesero-text-muted hover:bg-mesero-panel/40"
          }`}
        >
          {lockArmed ? <IconLockClosed className="h-5 w-5" /> : <IconLockOpen className="h-5 w-5" />}
        </button>
        {adminIsLink ? (
          <Link to="/admin" className={adminBtnClass}>
            <IconGear />
            Administración
          </Link>
        ) : (
          <button type="button" onClick={onAdminClick} className={adminBtnClass}>
            <IconGear />
            Administración
          </button>
        )}
      </div>
    </header>
  );
}
