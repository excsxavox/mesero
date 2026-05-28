import { MiniWaveform } from "./VoiceWaveform";

type Props = {
  assistantName: string;
  busy: boolean;
  ttsActive: boolean;
  listening: boolean;
  supported: boolean;
};

export function VoiceOrb({ assistantName, busy, ttsActive, listening, supported }: Props) {
  const micWaiting = listening && !busy && !ttsActive;
  const active = busy || ttsActive;
  const title = busy
    ? "PENSANDO…"
    : ttsActive
      ? "RESPONDIENDO…"
      : micWaiting
        ? "EN ESPERA"
        : supported
          ? "EN PAUSA"
          : "SIN VOZ";
  const subtitle = busy
    ? `${assistantName} está procesando tu mensaje`
    : ttsActive
      ? "Escucha la respuesta"
      : micWaiting
        ? `Di «${assistantName}» y tu pedido (puedes decir el nombre y luego el plato)`
        : supported
          ? "El micrófono se reanuda en un momento"
          : "Este navegador no soporta reconocimiento de voz";

  return (
    <section
      className="voice-orb-panel relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-mesero-line/20 bg-gradient-to-b from-mesero-panel/80 to-mesero-bg px-3 py-4 ring-1 ring-mesero-line/15"
      aria-live="polite"
    >
      <div
        className={`pointer-events-none absolute inset-0 ${active ? "opacity-55" : "opacity-35"}`}
        style={{
          background: active
            ? "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--theme-active) 36%, transparent) 0%, transparent 58%)"
            : "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--theme-accent) 24%, transparent) 0%, transparent 58%)",
        }}
      />

      <div className="relative flex items-center justify-center gap-2.5 sm:gap-3">
        <MiniWaveform active={active} bars={4} />

        <div className="relative flex h-28 w-28 items-center justify-center">
          <span
            className={`absolute h-[6.5rem] w-[6.5rem] rounded-full border ${active ? "border-mesero-active/25 opacity-90" : "border-mesero-accent/20 opacity-35"}`}
          />
          <span
            className={`absolute h-20 w-20 rounded-full border ${active ? "border-mesero-active/35" : "border-mesero-accent/30"}`}
          />
          <span
            className={`absolute h-16 w-16 rounded-full border bg-mesero-accent/10 ${active ? "border-mesero-active/45" : "border-mesero-line/40"}`}
          />
          <span
            className={`relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-[3px] ${
              active
                ? "bg-gradient-to-br from-mesero-active to-mesero-active-strong shadow-mesero-active/40 ring-mesero-active/30"
                : "bg-gradient-to-br from-mesero-accent to-mesero-accent-strong shadow-mesero-accent/40 ring-mesero-accent/30"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor" aria-hidden>
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V19H9v2h6v-2h-2v-1.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </span>
        </div>

        <MiniWaveform active={active} bars={4} />
      </div>

      <div className="relative mt-3 flex h-6 w-40 items-end justify-center gap-0.5">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className={`w-0.5 rounded-full ${active ? "bg-mesero-active/85" : "bg-mesero-accent/85"}`}
            style={{ height: active ? `${6 + ((i * 4) % 14)}px` : "4px", opacity: active ? 0.9 : 0.35 }}
          />
        ))}
      </div>

      <p className={`relative mt-2 text-[11px] font-bold tracking-[0.18em] ${active ? "text-mesero-active" : "text-mesero-accent"}`}>
        {title}
      </p>
      <p className="relative mt-0.5 text-center text-[10px] text-mesero-text-muted/65">{subtitle}</p>

      <div className="relative mt-2 flex justify-center gap-1.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              active ? "bg-mesero-active/70" : micWaiting ? "bg-mesero-accent-strong/45" : "bg-mesero-accent-strong/55"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
