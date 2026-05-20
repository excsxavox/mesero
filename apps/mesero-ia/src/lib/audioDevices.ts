import { useCallback, useEffect, useState } from "react";

export const AUDIO_INPUT_KEY = "mesero_audioInputId";
export const AUDIO_OUTPUT_KEY = "mesero_audioOutputId";

export function dispatchAudioPrefsChanged() {
  window.dispatchEvent(new Event("mesero-audio-prefs"));
}

async function listDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return navigator.mediaDevices.enumerateDevices();
}

/** Prueba de tono: usa setSinkId en HTMLAudioElement si el navegador lo permite. */
export async function playTestToneOnOutput(sinkId: string | undefined) {
  const sampleRate = 44100;
  const duration = 0.15;
  const freq = 880;
  const frames = Math.floor(sampleRate * duration);
  const buf = new ArrayBuffer(44 + frames * 2);
  const dv = new DataView(buf);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  dv.setUint32(4, 36 + frames * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(36, "data");
  dv.setUint32(40, frames * 2, true);

  let o = 44;
  for (let i = 0; i < frames; i++) {
    const t = (i / sampleRate) * freq * 2 * Math.PI;
    const v = Math.sin(t) * 0.25 * (1 - i / frames);
    dv.setInt16(o, Math.round(Math.max(-1, Math.min(1, v)) * 0x7fff), true);
    o += 2;
  }

  const blob = new Blob([buf], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  try {
    if (sinkId && "setSinkId" in audio && typeof (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId === "function") {
      await (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
    }
    await audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("No se pudo reproducir el tono de prueba.");
  }
}

export function useAudioDevicePicker() {
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [inputId, setInputId] = useState(() => localStorage.getItem(AUDIO_INPUT_KEY) ?? "");
  const [outputId, setOutputId] = useState(() => localStorage.getItem(AUDIO_OUTPUT_KEY) ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const all = await listDevices();
      setInputs(all.filter((d) => d.kind === "audioinput"));
      setOutputs(all.filter((d) => d.kind === "audiooutput"));
    } catch {
      setMsg("No se pudieron listar dispositivos.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const md = navigator.mediaDevices;
    if (!md) {
      setMsg("Este entorno no expone mediaDevices (usa HTTPS o localhost).");
      return;
    }
    const onChange = () => void refresh();
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [refresh]);

  const authorize = async () => {
    setMsg(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      await refresh();
    } catch {
      setMsg("Permiso de micrófono denegado o no disponible.");
    }
  };

  const persistInput = (id: string) => {
    setInputId(id);
    if (id) localStorage.setItem(AUDIO_INPUT_KEY, id);
    else localStorage.removeItem(AUDIO_INPUT_KEY);
    dispatchAudioPrefsChanged();
  };

  const persistOutput = (id: string) => {
    setOutputId(id);
    if (id) localStorage.setItem(AUDIO_OUTPUT_KEY, id);
    else localStorage.removeItem(AUDIO_OUTPUT_KEY);
    dispatchAudioPrefsChanged();
  };

  const testOutput = async () => {
    setMsg(null);
    setTesting(true);
    try {
      await playTestToneOnOutput(outputId || undefined);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setTesting(false);
    }
  };

  return {
    inputs,
    outputs,
    inputId,
    outputId,
    setInputId: persistInput,
    setOutputId: persistOutput,
    msg,
    testing,
    refresh,
    authorize,
    testOutput,
    supportsOutputPick: typeof HTMLAudioElement !== "undefined" && "setSinkId" in HTMLAudioElement.prototype,
  };
}
