import type { MeseroTheme } from "../../lib/meseroTheme";

type Props = {
  theme: MeseroTheme;
  onToggle: () => void;
  className?: string;
};

function IconSun({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z"
      />
    </svg>
  );
}

export function ThemeToggleButton({ theme, onToggle, className = "" }: Props) {
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isLight}
      title={isLight ? "Modo oscuro" : "Modo claro"}
      className={`touch-manipulation flex h-10 w-10 items-center justify-center rounded-xl border border-mesero-line/20 bg-mesero-panel/50 text-mesero-text-muted transition-colors hover:bg-mesero-panel/40 hover:text-mesero-text ${className}`}
    >
      {isLight ? <IconMoon className="h-5 w-5" /> : <IconSun className="h-5 w-5" />}
      <span className="sr-only">{isLight ? "Activar modo oscuro" : "Activar modo claro"}</span>
    </button>
  );
}
