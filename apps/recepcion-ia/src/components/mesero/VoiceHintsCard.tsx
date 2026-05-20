const HINTS = [
  { id: "reserve", text: "Tengo reserva a nombre de García" },
  { id: "checkin", text: "¿A qué hora es el check-in?" },
  { id: "visit", text: "Voy a visitar al departamento 12-B" },
  { id: "amenity", text: "¿Dónde está la piscina y hasta qué hora abre?" },
  { id: "tour", text: "Quiero reservar el tour a la montaña para mañana" },
] as const;

type Props = {
  assistantName: string;
  listening: boolean;
  busy?: boolean;
  ttsActive?: boolean;
};

function HintIcon({ id }: { id: (typeof HINTS)[number]["id"] }) {
  const className = "h-4 w-4 shrink-0 text-teal-400/90";
  switch (id) {
    case "reserve":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M4 11h16" strokeLinecap="round" />
        </svg>
      );
    case "checkin":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M4 14h16M6 10h12M8 6h8" strokeLinecap="round" />
          <path d="M5 14v4h14v-4" strokeLinejoin="round" />
        </svg>
      );
    case "visit":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" strokeLinecap="round" />
          <path d="M16 11h5M18.5 8.5v5" strokeLinecap="round" />
        </svg>
      );
    case "amenity":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M4 18h16M6 14l2-8h8l2 8" strokeLinejoin="round" />
          <path d="M8 10h8" strokeLinecap="round" />
        </svg>
      );
    case "tour":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M3 12h3l2-7 4 14 2-7h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function VoiceHintsCard({ assistantName, listening, busy, ttsActive }: Props) {
  const wakeMode = listening && !busy && !ttsActive;
  return (
    <section className="rounded-2xl border border-mesero-line/15 bg-mesero-panel/60 p-3 ring-1 ring-mesero-line/10">
      <h2 className="text-[11px] font-medium text-teal-200/90">Puedes decir cosas como:</h2>
      <ul className="mt-2 space-y-1">
        {HINTS.map((h) => (
          <li
            key={h.id}
            className="flex items-center gap-2 rounded-lg border border-mesero-line/10 bg-mesero-deep/25 px-2 py-1.5 text-xs text-mesero-text/90"
          >
            <HintIcon id={h.id} />
            <span className="leading-snug">{h.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-mesero-line/10 pt-2">
        <div className="flex h-4 items-end gap-px">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`w-0.5 rounded-full bg-mesero-accent ${wakeMode || ttsActive ? "animate-pulse" : "opacity-40"}`}
              style={{ height: wakeMode || ttsActive ? `${4 + (i % 3) * 3}px` : "3px" }}
            />
          ))}
        </div>
        <p className="text-[10px] text-mesero-accent/65">
          {busy
            ? "Procesando…"
            : ttsActive
              ? `${assistantName} responde`
              : wakeMode
                ? "Listo para atender con tu voz"
                : "Micrófono en pausa"}
        </p>
      </div>
    </section>
  );
}
