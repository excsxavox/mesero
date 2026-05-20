import { MiniWaveform } from "./VoiceWaveform";

type Props = {
  assistantName: string;
  busy: boolean;
  ttsActive: boolean;
  listening: boolean;
  supported: boolean;
};

export function VoiceOrb({ assistantName, busy, ttsActive, listening, supported }: Props) {
  const wakeMode = listening && !busy && !ttsActive;
  const active = wakeMode || ttsActive;
  const title = busy
    ? "PENSANDO…"
    : ttsActive
      ? "RESPONDIENDO…"
      : wakeMode
        ? "ESCUCHANDO…"
        : supported
          ? "EN PAUSA"
          : "SIN VOZ";
  const subtitle = busy
    ? `${assistantName} está procesando tu mensaje`
    : ttsActive
      ? "Escucha la respuesta"
      : wakeMode
        ? "Habla ahora para realizar tu pedido"
        : supported
          ? "El micrófono se reanuda en un momento"
          : "Este navegador no soporta reconocimiento de voz";

  return (
    <section
      className="relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-mesero-line/20 bg-gradient-to-b from-mesero-panel/80 to-mesero-bg px-3 py-4 ring-1 ring-mesero-line/15"
      aria-live="polite"
    >
      <div
        className={`pointer-events-none absolute inset-0 ${active ? "opacity-55" : "opacity-35"}`}
        style={{
          background: "radial-gradient(circle at 50% 42%, rgba(139,92,246,0.38) 0%, transparent 58%)",
        }}
      />

      <div className="relative flex items-center justify-center gap-2.5 sm:gap-3">
        <MiniWaveform active={active} bars={4} />

        <div className="relative flex h-28 w-28 items-center justify-center">
          <span
            className={`absolute h-[6.5rem] w-[6.5rem] rounded-full border border-mesero-accent/20 ${active ? "opacity-90" : "opacity-35"}`}
          />
          <span className="absolute h-20 w-20 rounded-full border border-mesero-accent/30" />
          <span className="absolute h-16 w-16 rounded-full border border-mesero-line/40 bg-mesero-accent/10" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-mesero-accent to-blue-600 shadow-lg shadow-mesero-accent/40 ring-[3px] ring-mesero-accent/30">
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
            className="w-0.5 rounded-full bg-mesero-accent/85"
            style={{ height: active ? `${6 + ((i * 4) % 14)}px` : "4px", opacity: active ? 0.9 : 0.35 }}
          />
        ))}
      </div>

      <p className="relative mt-2 text-[11px] font-bold tracking-[0.18em] text-blue-200">{title}</p>
      <p className="relative mt-0.5 text-center text-[10px] text-mesero-text-muted/65">{subtitle}</p>

      <div className="relative mt-2 flex justify-center gap-1.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i === 0 && wakeMode ? "bg-mesero-accent" : "bg-mesero-accent-strong/55"}`}
          />
        ))}
      </div>
    </section>
  );
}
