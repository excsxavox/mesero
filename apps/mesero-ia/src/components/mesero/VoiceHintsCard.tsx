type Props = {
  assistantName?: string;
};

function HeaderWaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-mesero-accent/80" fill="currentColor" aria-hidden>
      <rect x="3" y="9" width="2" height="6" rx="1" className="opacity-70" />
      <rect x="7" y="6" width="2" height="12" rx="1" />
      <rect x="11" y="4" width="2" height="16" rx="1" className="opacity-90" />
      <rect x="15" y="7" width="2" height="10" rx="1" className="opacity-80" />
      <rect x="19" y="10" width="2" height="4" rx="1" className="opacity-60" />
    </svg>
  );
}

export function VoiceHintsCard({ assistantName = "Karen" }: Props) {
  const name = assistantName.trim() || "Karen";
  const phrases: { rest: string }[] = [
    { rest: "¿qué me recomiendas?" },
    { rest: "quiero ordenar" },
    { rest: "una coca cola" },
    { rest: "quiero pagar" },
  ];

  return (
    <section className="rounded-xl border border-mesero-line/10 bg-mesero-panel/35 px-3 py-2.5 ring-1 ring-mesero-line/5">
      <div className="mb-2 flex items-center gap-1.5">
        <HeaderWaveIcon />
        <h2 className="text-[11px] font-medium tracking-wide text-mesero-text-muted/85">
          Puedes decir cosas como:
        </h2>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2" aria-label="Ejemplos de frases por voz">
        {phrases.map(({ rest }) => (
          <li
            key={rest}
            className="min-w-0 rounded-lg bg-mesero-deep/10 px-2.5 py-2 text-center sm:text-left"
          >
            <p className="text-xs leading-snug text-mesero-text/75">
              <span className="font-semibold text-mesero-accent/90">{name}</span>{" "}
              <span className="text-mesero-text/70">{rest}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
