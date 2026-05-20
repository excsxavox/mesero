import { useCallback, useEffect, useMemo, useState } from "react";
import { TableSelector } from "../../components/mesero/TableSelector";
import { getSettings, putSettings } from "../../lib/api";
import { loadMeseroSession, saveMeseroSession } from "../../lib/meseroSessionStorage";
import type { Settings } from "../../lib/types";
import {
  clampSelectedTable,
  MAX_TABLE_COUNT,
  MIN_TABLE_COUNT,
  normalizeTableCount,
} from "../../lib/tables";
import { displayAssistantName } from "../../lib/wakeWord";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20";
const labelClass = "block text-sm text-zinc-300";

function StatusBanner({ message }: { message: string }) {
  if (!message) return null;
  const ok = message === "Guardado." || message.includes("guardada") || message.includes("eliminada");
  return (
    <div
      role="status"
      className={`max-w-2xl rounded-lg border px-3 py-2 text-sm ${
        ok
          ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-100"
          : "border-amber-900/50 bg-amber-950/30 text-amber-100"
      }`}
    >
      {message}
    </div>
  );
}

export function SettingsPage() {
  const [form, setForm] = useState<Settings>({
    restaurantName: "",
    assistantExtraInstructions: "",
    wakeWord: "karen",
    tableCount: 12,
  });
  const [exitPass, setExitPass] = useState("");
  const [exitPassConfirm, setExitPassConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [kioskTable, setKioskTable] = useState<number | null>(null);

  const tableCount = useMemo(() => normalizeTableCount(form.tableCount), [form.tableCount]);
  const assistantPreview = useMemo(() => displayAssistantName(form.wakeWord), [form.wakeWord]);

  const syncKioskTableFromSession = useCallback(() => {
    const session = loadMeseroSession();
    setKioskTable(clampSelectedTable(session.selectedTable ?? null, tableCount));
  }, [tableCount]);

  useEffect(() => {
    syncKioskTableFromSession();
  }, [syncKioskTableFromSession]);

  const assignKioskTable = (table: number) => {
    const clamped = clampSelectedTable(table, tableCount);
    if (!clamped) return;
    setKioskTable(clamped);
    const session = loadMeseroSession();
    saveMeseroSession({ ...session, selectedTable: clamped });
    setStatus(
      `Mesa ${clamped} asignada a este dispositivo. Otros quioscos pueden usar otra mesa (Admin en cada tablet o ?mesa=N en la URL).`,
    );
  };

  useEffect(() => {
    getSettings()
      .then((s) => {
        const kt =
          typeof s.kioskTable === "number" && Number.isFinite(s.kioskTable)
            ? clampSelectedTable(Math.round(s.kioskTable), normalizeTableCount(s.tableCount))
            : null;
        const local = loadMeseroSession().selectedTable;
        if (!local && kt) setKioskTable(kt);
        setForm({
          ...s,
          wakeWord: s.wakeWord || "karen",
          tableCount: s.tableCount ?? 12,
        });
      })
      .catch((e) => setStatus(String(e)));
  }, []);

  const save = async () => {
    setStatus("Guardando…");
    try {
      const { adminExitPasswordConfigured: _c, ...rest } = form;
      await putSettings(rest);
      const updated = await getSettings();
      setForm({ ...updated, wakeWord: updated.wakeWord || "karen", tableCount: updated.tableCount ?? 12 });
      syncKioskTableFromSession();
      setStatus("Guardado.");
    } catch (e) {
      setStatus(String(e));
    }
  };

  const saveExitPassword = async () => {
    if (exitPass.length < 4) {
      setStatus("La contraseña del candado debe tener al menos 4 caracteres.");
      return;
    }
    if (exitPass !== exitPassConfirm) {
      setStatus("Las contraseñas no coinciden.");
      return;
    }
    setStatus("Guardando contraseña…");
    try {
      await putSettings({ adminExitPassword: exitPass });
      setExitPass("");
      setExitPassConfirm("");
      const updated = await getSettings();
      setForm({ ...updated, wakeWord: updated.wakeWord || "karen", tableCount: updated.tableCount ?? 12 });
      setStatus("Contraseña del candado guardada (solo se almacena un hash en el servidor).");
    } catch (e) {
      setStatus(String(e));
    }
  };

  const clearExitPassword = async () => {
    if (
      !window.confirm(
        "¿Quitar la contraseña del candado? El mesero no podrá bloquear administración hasta que definas una nueva.",
      )
    ) {
      return;
    }
    setStatus("Quitando contraseña…");
    try {
      await putSettings({ adminExitPasswordClear: true });
      const updated = await getSettings();
      setForm({ ...updated, wakeWord: updated.wakeWord || "karen", tableCount: updated.tableCount ?? 12 });
      setStatus("Contraseña del candado eliminada.");
    } catch (e) {
      setStatus(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Configuración IA</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Nombre del local, mesas, palabra de activación e instrucciones del mesero virtual (voz y chat). El idioma se detecta
          automáticamente según el cliente. Con{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-amber-200/90">OPENAI_API_KEY</code> en el servidor, estos
          datos también forman parte del prompt del sistema.
        </p>
      </div>

      <StatusBanner message={status} />

      <section className="max-w-2xl space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 ring-1 ring-zinc-800/80">
        <h2 className="text-sm font-semibold text-zinc-200">Mesero virtual</h2>

        <label className={labelClass}>
          Nombre del restaurante
          <input
            className={inputClass}
            value={form.restaurantName}
            onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))}
          />
        </label>

        <label className={labelClass}>
          Palabra de activación (comando de voz)
          <input
            className={inputClass}
            value={form.wakeWord ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, wakeWord: e.target.value }))}
            placeholder="karen"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="mt-1.5 block text-xs leading-relaxed text-zinc-500">
            El cliente la dice para activar el micrófono (p. ej. «{assistantPreview}, quiero una hamburguesa»). Solo
            letras y números, 2–24 caracteres. En el quiosco se muestra como{" "}
            <strong className="font-medium text-zinc-400">{assistantPreview}</strong>.
          </span>
        </label>

        <label className={labelClass}>
          Instrucciones adicionales
          <textarea
            rows={8}
            className={`${inputClass} leading-relaxed`}
            value={form.assistantExtraInstructions}
            onChange={(e) => setForm((f) => ({ ...f, assistantExtraInstructions: e.target.value }))}
          />
        </label>

        <button
          type="button"
          onClick={() => void save()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          Guardar
        </button>
      </section>

      <section className="max-w-2xl space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 ring-1 ring-zinc-800/80">
        <h2 className="text-sm font-semibold text-zinc-200">Mesas del local</h2>
        <p className="text-sm leading-relaxed text-zinc-500">
          Define cuántas mesas hay y asigna la mesa de este quiosco o tablet. El cliente no elige mesa en pantalla: el
          personal la configura aquí antes del servicio.
        </p>

        <label className={labelClass}>
          Número de mesas
          <input
            type="number"
            min={MIN_TABLE_COUNT}
            max={MAX_TABLE_COUNT}
            className={inputClass}
            value={form.tableCount ?? 12}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                tableCount: Math.min(MAX_TABLE_COUNT, Math.max(MIN_TABLE_COUNT, Number(e.target.value) || 12)),
              }))
            }
          />
          <span className="mt-1.5 block text-xs leading-relaxed text-zinc-500">
            Mesas numeradas del 1 al valor indicado ({MIN_TABLE_COUNT}–{MAX_TABLE_COUNT}). Guarda los cambios con el
            botón de abajo si modificas este número.
          </span>
        </label>

        <TableSelector
          variant="admin"
          tableCount={tableCount}
          selectedTable={kioskTable}
          onSelect={assignKioskTable}
        />
        <p className="text-xs leading-relaxed text-zinc-500">
          Cada tablet o pantalla del mesero guarda su mesa en este navegador. Para varios quioscos a la vez, configura
          cada uno aquí o abre el enlace con{" "}
          <code className="rounded bg-zinc-950 px-1 text-amber-200/90">?mesa=3</code> (ej. mesa 3).
        </p>

        <button
          type="button"
          onClick={() => void save()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          Guardar número de mesas
        </button>
      </section>

      <section className="max-w-2xl space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 ring-1 ring-zinc-800/80">
        <h2 className="text-sm font-semibold text-zinc-200">Candado del mesero</h2>
        <p className="text-sm leading-relaxed text-zinc-500">
          Contraseña para quitar el candado o entrar en Administración desde la pantalla principal del mesero. No se
          guarda en texto plano: el servidor solo conserva un hash en{" "}
          <code className="rounded bg-zinc-950 px-1 py-0.5 text-amber-200/80">store.json</code>.
        </p>
        <p className="text-sm text-zinc-400">
          Estado:{" "}
          <span className={form.adminExitPasswordConfigured ? "font-medium text-emerald-400/90" : "font-medium text-amber-200/80"}>
            {form.adminExitPasswordConfigured
              ? "contraseña configurada"
              : "sin contraseña (activa el candado solo tras definirla)"}
          </span>
        </p>

        <label className={labelClass}>
          Nueva contraseña del candado
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={exitPass}
            onChange={(e) => setExitPass(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Confirmar contraseña
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={exitPassConfirm}
            onChange={(e) => setExitPassConfirm(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => void saveExitPassword()}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
          >
            Guardar contraseña del candado
          </button>
          {form.adminExitPasswordConfigured ? (
            <button
              type="button"
              onClick={() => void clearExitPassword()}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700"
            >
              Quitar contraseña
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
