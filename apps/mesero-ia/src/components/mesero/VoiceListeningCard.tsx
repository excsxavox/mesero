type Props = {
  assistantName: string;
  /** Micrófono escuchando al usuario. */
  listening: boolean;
  /** Bot procesando o hablando (micrófono apagado). */
  botActive: boolean;
};

function HeaderWaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-mesero-accent" fill="currentColor" aria-hidden>
      <rect x="3" y="9" width="2" height="6" rx="1" className="opacity-70" />
      <rect x="7" y="6" width="2" height="12" rx="1" />
      <rect x="11" y="4" width="2" height="16" rx="1" className="opacity-90" />
      <rect x="15" y="7" width="2" height="10" rx="1" className="opacity-80" />
      <rect x="19" y="10" width="2" height="4" rx="1" className="opacity-60" />
    </svg>
  );
}

export function VoiceListeningCard({ assistantName, listening, botActive }: Props) {
  const title = botActive ? "Micrófono en pausa" : listening ? "Micrófono en espera" : "Micrófono inactivo";
  const waveActive = listening && !botActive;

  return (
    <section className="flex flex-col rounded-xl border border-mesero-line/15 bg-mesero-panel/60 p-3 ring-1 ring-mesero-line/10">
      <div className="mb-2 flex items-center gap-1.5">
        <HeaderWaveIcon />
        <h2 className="text-xs font-medium text-mesero-text">{title}</h2>
      </div>

      <div className="relative flex h-16 items-center justify-center overflow-hidden rounded-lg border border-mesero-line/10 bg-mesero-deep/40">
        <div
          className={`pointer-events-none absolute inset-0 ${waveActive ? "opacity-70" : "opacity-30"}`}
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 50% 50%, color-mix(in srgb, var(--theme-accent) 35%, transparent) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <svg viewBox="0 0 320 64" className="relative h-11 w-full max-w-md px-1.5" aria-hidden>
          <defs>
            <linearGradient id="meseroWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--theme-accent)" />
              <stop offset="50%" stopColor="var(--theme-line)" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
          </defs>
          {[0, 1, 2].map((layer) => (
            <path
              key={layer}
              fill="none"
              stroke="url(#meseroWaveGrad)"
              strokeWidth={2.2 - layer * 0.4}
              strokeLinecap="round"
              opacity={waveActive ? 0.95 - layer * 0.22 : 0.35 - layer * 0.08}
              d={
                layer === 0
                  ? "M8,32 C40,8 80,56 120,32 S200,8 240,32 S288,56 312,32"
                  : layer === 1
                    ? "M8,36 C50,14 90,50 130,36 S210,14 250,36 S290,52 312,36"
                    : "M8,28 C45,48 85,12 125,28 S205,48 245,28 S285,12 312,28"
              }
            />
          ))}
        </svg>
      </div>

      <p className="mt-2 text-center text-[11px] leading-snug text-mesero-text-muted/80">
        {botActive ? (
          <>Espera a que {assistantName} termine de hablar para volver a pedir.</>
        ) : (
          <>
            Empieza diciendo <span className="font-semibold text-mesero-accent/90">{assistantName}</span> y luego tu
            pedido. Solo responde cuando escucha su nombre.
          </>
        )}
      </p>
    </section>
  );
}
