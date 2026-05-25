import { useCallback, useEffect, useState } from "react";
import { useMeseroTheme } from "../../context/MeseroThemeContext";
import { getSettings, putSettings } from "../../lib/api";
import { getPaletteFromSettings, getStoredMeseroPalette, PALETTE_OPTIONS, type MeseroPalette, type MeseroTheme } from "../../lib/meseroTheme";
import type { MeseroPaletteId } from "../../lib/types";

function PreviewCard({
  palette,
  theme,
  selected,
  onSelect,
}: {
  palette: MeseroPalette;
  theme: MeseroTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  const opt = PALETTE_OPTIONS.find((o) => o.id === palette)!;
  const isLight = theme === "light";
  const bg = isLight ? (palette === "rustico" ? "#f5f5f4" : "#f4f6fb") : palette === "rustico" ? "#121110" : "#151b2e";
  const accent = palette === "rustico" ? (isLight ? "#b8863f" : "#d4a373") : isLight ? "#3d6fd4" : "#5b8dee";
  const active = palette === "rustico" ? "#3f4f2e" : accent;
  const text = isLight ? (palette === "rustico" ? "#1c1917" : "#1a2238") : palette === "rustico" ? "#fafaf9" : "#e8eef4";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border p-4 text-left transition ${
        selected
          ? "border-amber-500/60 bg-amber-500/10 ring-2 ring-amber-500/30"
          : "border-zinc-800 bg-zinc-900/50 ring-1 ring-zinc-800 hover:border-amber-500/30"
      }`}
    >
      <div className="font-medium text-zinc-100">{opt.title}</div>
      <p className="mt-1 text-sm text-zinc-500">{opt.description}</p>
      <div
        className="mt-4 overflow-hidden rounded-lg border border-zinc-700/80"
        style={{ background: bg, color: text }}
      >
        <div className="flex items-center justify-between px-3 py-2 text-xs opacity-80">
          <span>Mesero</span>
          <span style={{ color: accent }}>●</span>
        </div>
        <div className="mx-3 mb-3 rounded-md px-3 py-2 text-sm" style={{ background: active, color: isLight ? "#fff" : "#fafaf9" }}>
          ¡Buenas! Bienvenidos
        </div>
        <div className="flex gap-1 px-3 pb-3">
          {opt.swatches.map((c) => (
            <span key={c} className="h-4 w-4 rounded-full ring-1 ring-white/20" style={{ background: c }} />
          ))}
        </div>
      </div>
    </button>
  );
}

export function ThemePage() {
  const { theme, palette, setTheme, setPalette } = useMeseroTheme();
  const [draftPalette, setDraftPalette] = useState<MeseroPalette>(palette);
  const [previewTheme, setPreviewTheme] = useState<MeseroTheme>(theme);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => {
        const fromServer = getPaletteFromSettings(s);
        const p = fromServer ?? getStoredMeseroPalette();
        setDraftPalette(p);
        if (fromServer) setPalette(fromServer);
      })
      .catch(() => setStatus("No se pudo cargar la configuración del servidor."));
  }, [setPalette]);

  const applyPreview = useCallback(
    (p: MeseroPalette, t: MeseroTheme) => {
      setPalette(p);
      setTheme(t);
    },
    [setPalette, setTheme],
  );

  useEffect(() => {
    applyPreview(draftPalette, previewTheme);
  }, [draftPalette, previewTheme, applyPreview]);

  const save = async () => {
    setSaving(true);
    setStatus("");
    try {
      await putSettings({ uiPalette: draftPalette as MeseroPaletteId });
      setPalette(draftPalette);
      setStatus("Paleta guardada. Se aplicará en el quiosco, cocina y receptor al recargar o al sincronizar.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const cancelPreview = () => {
    setDraftPalette(palette);
    setPreviewTheme(theme);
    setPalette(palette);
    setTheme(theme);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Tema</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Elige la paleta de colores del local. Afecta al quiosco del mesero, menú de invitados y panel de cocina
          (receptor). El modo claro u oscuro del dispositivo sigue disponible con el botón de sol en cada pantalla.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Vista previa (claro / oscuro)</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPreviewTheme("light")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              previewTheme === "light"
                ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Claro
          </button>
          <button
            type="button"
            onClick={() => setPreviewTheme("dark")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              previewTheme === "dark"
                ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Oscuro
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {PALETTE_OPTIONS.map((opt) => (
          <PreviewCard
            key={opt.id}
            palette={opt.id}
            theme={previewTheme}
            selected={draftPalette === opt.id}
            onSelect={() => setDraftPalette(opt.id)}
          />
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar para todo el local"}
        </button>
        <button
          type="button"
          onClick={cancelPreview}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Descartar vista previa
        </button>
      </div>

      {status ? (
        <div
          role="status"
          className={`max-w-2xl rounded-lg border px-3 py-2 text-sm ${
            status.includes("guardado") || status.includes("Guardado")
              ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-100"
              : "border-amber-900/50 bg-amber-950/30 text-amber-100"
          }`}
        >
          {status}
        </div>
      ) : null}
    </div>
  );
}
