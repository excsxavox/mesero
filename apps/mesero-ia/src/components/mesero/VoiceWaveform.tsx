export function MiniWaveform({ active, bars = 5 }: { active: boolean; bars?: number }) {
  const pattern = [4, 7, 5, 8, 6, 5, 7, 4];
  return (
    <span className="inline-flex h-6 items-end justify-center gap-[3px]" aria-hidden>
      {pattern.slice(0, bars).map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-mesero-accent ${active ? "opacity-95" : "opacity-30"}`}
          style={{ height: active ? `${h}px` : "3px" }}
        />
      ))}
    </span>
  );
}
