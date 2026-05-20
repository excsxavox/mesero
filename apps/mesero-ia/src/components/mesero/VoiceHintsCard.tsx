const HINTS = [
  { id: "burger", text: "Quiero una hamburguesa" },
  { id: "drink", text: "Agrega una coca" },
  { id: "dessert", text: "¿Qué postres tienen?" },
  { id: "pay", text: "Quiero pagar" },
] as const;

type Props = {
  assistantName: string;
  listening: boolean;
  busy?: boolean;
  ttsActive?: boolean;
};

function HintIcon({ id }: { id: (typeof HINTS)[number]["id"] }) {
  const className = "h-4 w-4 shrink-0 text-amber-500/90";
  switch (id) {
    case "burger":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M4 14h16M6 10h12M8 6h8" strokeLinecap="round" />
          <path d="M5 14v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "drink":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M8 4h8l-1 14H9L8 4Z" strokeLinejoin="round" />
          <path d="M10 8h4M9 12h6" strokeLinecap="round" />
        </svg>
      );
    case "dessert":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M6 18h12M8 18c0-3 1.5-6 4-8 2.5 2 4 5 4 8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 10v4" strokeLinecap="round" />
        </svg>
      );
    case "pay":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h4" strokeLinecap="round" />
        </svg>
      );
  }
}

export function VoiceHintsCard({ assistantName, listening, busy, ttsActive }: Props) {
  const wakeMode = listening && !busy && !ttsActive;
  return (
    <section className="rounded-2xl border border-mesero-line/15 bg-mesero-panel/60 p-3 ring-1 ring-mesero-line/10">
      <h2 className="text-[11px] font-medium text-blue-200/90">Puedes decir cosas como:</h2>
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
                ? "Listo para pedir con tu voz"
                : "Micrófono en pausa"}
        </p>
      </div>
    </section>
  );
}
