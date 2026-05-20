type Props = {
  assistantName: string;
  busy: boolean;
  ttsActive: boolean;
  listening: boolean;
  supported: boolean;
  className?: string;
};

import { MiniWaveform } from "./VoiceWaveform";

function voiceStatus(busy: boolean, ttsActive: boolean, wakeMode: boolean, supported: boolean) {
  if (busy) return "Pensando…";
  if (ttsActive) return "Respondiendo…";
  if (wakeMode) return "Escuchando…";
  if (supported) return "En pausa";
  return "Sin voz";
}

export function KarenVoiceHero({ assistantName, busy, ttsActive, listening, supported, className = "" }: Props) {
  const wakeMode = listening && !busy && !ttsActive;
  const active = wakeMode || ttsActive;
  const status = voiceStatus(busy, ttsActive, wakeMode, supported);

  return (
    <section
      className={`flex flex-col items-center rounded-2xl border border-mesero-line/10 bg-mesero-bg/80 px-4 py-5 text-center ring-1 ring-mesero-line/10 ${className}`}
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center gap-3 sm:gap-4">
        <MiniWaveform active={active} bars={4} />

        <div className="relative">
          <div
            className={`absolute -inset-1 rounded-full bg-gradient-to-br from-mesero-accent via-blue-500 to-mesero-accent-strong transition-opacity duration-300 ${
              active ? "opacity-100 blur-[1px]" : "opacity-55"
            }`}
            aria-hidden
          />
          <div
            className={`relative h-[7.25rem] w-[7.25rem] overflow-hidden rounded-full bg-mesero-muted ring-2 transition-shadow duration-300 ${
              active ? "ring-mesero-accent/70 shadow-[0_0_28px_rgba(139,92,246,0.55)]" : "ring-mesero-line/35"
            }`}
          >
            <img
              src="/karen-avatar.png"
              alt={`${assistantName}, mesera virtual`}
              className="pointer-events-none absolute left-1/2 top-0 h-[135%] w-[135%] max-w-none -translate-x-1/2 object-cover"
              style={{ objectPosition: "50% 6%" }}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src.endsWith("/mesero-logo.svg")) return;
                img.src = "/mesero-logo.svg";
                img.className = "h-full w-full object-contain p-3";
                img.style.objectPosition = "";
              }}
            />
          </div>
        </div>

        <MiniWaveform active={active} bars={4} />
      </div>

      <h2 className="mt-4 text-xl font-bold tracking-tight text-mesero-text">{assistantName}</h2>
      <p className="mt-0.5 text-sm text-mesero-text-muted/75">Tu mesera virtual</p>

      <div
        className={`mt-5 flex min-w-[11.5rem] items-center justify-center gap-2.5 rounded-full border px-5 py-2.5 transition-colors ${
          active
            ? "border-mesero-line/35 bg-mesero-deep/90 shadow-[0_0_22px_rgba(124,58,237,0.2)]"
            : "border-mesero-line/15 bg-mesero-panel/50"
        }`}
      >
        <MiniWaveform active={active} bars={5} />
        <span className="text-sm font-medium text-mesero-text">{status}</span>
      </div>
    </section>
  );
}
