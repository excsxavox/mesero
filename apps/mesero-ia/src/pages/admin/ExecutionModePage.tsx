import { useState } from "react";
import { useMesero } from "../../context/MeseroContext";
import { useAudioDevicePicker } from "../../lib/audioDevices";
import { RestaurantLogo } from "../../components/mesero/RestaurantLogo";

export function ExecutionModePage() {
  const { voiceError, supported, activateMicrophone } = useMesero();
  const {
    inputs,
    outputs,
    inputId,
    outputId,
    setInputId,
    setOutputId,
    msg,
    testing,
    authorize,
    testOutput,
    supportsOutputPick,
  } = useAudioDevicePicker();
  const [activating, setActivating] = useState(false);

  const handleActivateMicrophone = async () => {
    setActivating(true);
    try {
      const granted = await authorize();
      if (granted) await activateMicrophone();
    } finally {
      setActivating(false);
    }
  };

  const micEnvBlocked = typeof navigator !== "undefined" && !navigator.mediaDevices;
  const msgLower = msg?.toLowerCase() ?? "";
  const showMicAlert =
    micEnvBlocked ||
    Boolean(voiceError) ||
    /denegad|mediadevices|https|localhost|no disponible|no expone/.test(msgLower);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-8 ring-1 ring-zinc-800/80">
        <RestaurantLogo size={96} className="rounded-2xl" />
        <h1 className="text-center text-2xl font-semibold text-zinc-50">Modo ejecución</h1>
        <p className="text-center text-sm text-zinc-500">
          Elige el micrófono y la salida de audio del quiosco o tablet. Se guarda en este navegador. En la pantalla
          principal del mesero, el idioma del asistente (texto y voz) se detecta automáticamente según lo que escribe el
          cliente.
        </p>
      </div>

      {showMicAlert ? (
        <div
          className="space-y-3 rounded-xl border border-red-900/60 bg-red-950/35 px-4 py-4 ring-1 ring-red-800/40"
          role="alert"
        >
          <p className="text-sm font-medium text-red-200">Micrófono no disponible en el quiosco</p>
          {voiceError ? <p className="text-sm text-red-100/90">Voz: {voiceError}</p> : null}
          {msg && !voiceError ? <p className="text-sm text-red-100/90">{msg}</p> : null}
          {micEnvBlocked ? (
            <p className="text-sm text-red-100/90">
              Este entorno no expone <code className="text-red-50">mediaDevices</code> (usa HTTPS o localhost).
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-red-200/70">
            {micEnvBlocked
              ? "Con HTTP y una IP pública el navegador no permite el micrófono. Configura HTTPS (certificado o túnel) y vuelve a abrir esta página."
              : "Pulsa el botón y acepta el permiso cuando el navegador lo solicite. En producción usa HTTPS (no solo la IP en HTTP)."}
          </p>
          <button
            type="button"
            disabled={activating || !supported || micEnvBlocked}
            onClick={() => void handleActivateMicrophone()}
            className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activating ? "Activando…" : "Activar micrófono"}
          </button>
          {!supported ? (
            <p className="text-xs text-amber-200/90">Este navegador no soporta reconocimiento de voz continuo.</p>
          ) : null}
        </div>
      ) : null}

      {msg && !showMicAlert ? (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">{msg}</div>
      ) : null}

      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={activating || micEnvBlocked}
            onClick={() => void handleActivateMicrophone()}
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activating ? "Activando…" : "Activar micrófono"}
          </button>
          <button
            type="button"
            onClick={() => void authorize()}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700"
          >
            Actualizar lista de dispositivos
          </button>
          <button
            type="button"
            disabled={testing}
            onClick={() => void testOutput()}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700 disabled:opacity-50"
            title={supportsOutputPick ? "Tono corto en la salida elegida" : "Tu navegador puede no permitir elegir salida"}
          >
            {testing ? "Probando…" : "Probar salida"}
          </button>
        </div>

        <label className="block text-sm text-zinc-300">
          Entrada (micrófono)
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
          >
            <option value="">Predeterminado del sistema</option>
            {inputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Micrófono ${d.deviceId.slice(0, 8)}…`}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-zinc-300">
          Salida de audio
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={outputId}
            onChange={(e) => setOutputId(e.target.value)}
          >
            <option value="">Predeterminado del sistema</option>
            {outputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Salida ${d.deviceId.slice(0, 8)}…`}
              </option>
            ))}
          </select>
        </label>

        {outputs.length === 0 ? (
          <p className="text-xs leading-relaxed text-zinc-500">
            Si no ves altavoces/auriculares listados, prueba con <strong className="text-zinc-400">Chrome o Edge</strong> en
            HTTPS o localhost. La lectura con <code className="text-amber-200/80">speechSynthesis</code> del mesero sigue
            la salida por defecto del sistema en muchos navegadores; el selector y la prueba usan{" "}
            <code className="text-amber-200/80">setSinkId</code> cuando está disponible.
          </p>
        ) : null}
      </div>
    </div>
  );
}
