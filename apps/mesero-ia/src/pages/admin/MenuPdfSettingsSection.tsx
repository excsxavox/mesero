import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteMenuPdf, getSettings, putSettings, uploadMenuPdf } from "../../lib/api";
import { getMenuPublicUrl } from "../../lib/menuPublicUrl";
import type { Settings } from "../../lib/types";

const QR_SIZE = 120;

function useQrPreview(url: string | null) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(null);
    if (!url) return;
    void import("qrcode")
      .then((mod) => {
        const QRCode = mod.default ?? mod;
        return QRCode.toDataURL(url, { width: QR_SIZE, margin: 1, errorCorrectionLevel: "M" });
      })
      .then((img) => {
        if (!cancelled) setDataUrl(img);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo generar la vista previa del QR.");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { dataUrl, error };
}

export function MenuPdfSettingsSection() {
  const [form, setForm] = useState<Settings | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const s = await getSettings();
    setForm(s);
    setPdfUrl(s.menuPdfUrl ?? "");
  }, []);

  useEffect(() => {
    void reload().catch(() => setStatus("No se pudo cargar la configuración del menú."));
  }, [reload]);

  const qrTarget = useMemo(
    () =>
      form
        ? getMenuPublicUrl({
            settings: {
              menuPdfConfigured: form.menuPdfConfigured,
              menuPdfUrl: pdfUrl.trim() || form.menuPdfUrl,
              companyId: form.companyId,
            },
          })
        : null,
    [form, pdfUrl],
  );

  const { dataUrl, error: qrError } = useQrPreview(qrTarget);

  const onUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setStatus("El archivo debe ser un PDF.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const updated = await uploadMenuPdf(file);
      setForm(updated);
      setStatus("PDF subido. El QR del mesero ya apunta a este archivo.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Error al subir el PDF.");
    } finally {
      setBusy(false);
    }
  };

  const onSaveUrl = async () => {
    setBusy(true);
    setStatus("");
    try {
      const updated = await putSettings({ menuPdfUrl: pdfUrl.trim() || undefined });
      setForm(updated);
      setPdfUrl(updated.menuPdfUrl ?? "");
      setStatus("Enlace guardado. El QR usará esta URL externa.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Error al guardar el enlace.");
    } finally {
      setBusy(false);
    }
  };

  const onRemovePdf = async () => {
    if (!form?.menuPdfConfigured) return;
    setBusy(true);
    setStatus("");
    try {
      const updated = await deleteMenuPdf();
      setForm(updated);
      setStatus("PDF eliminado del servidor.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Error al eliminar el PDF.");
    } finally {
      setBusy(false);
    }
  };

  const onClearUrl = async () => {
    setBusy(true);
    setStatus("");
    try {
      const updated = await putSettings({ menuPdfUrlClear: true });
      setForm(updated);
      setPdfUrl("");
      setStatus("Enlace externo eliminado.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Error al quitar el enlace.");
    } finally {
      setBusy(false);
    }
  };

  const hasPdf = Boolean(form?.menuPdfConfigured);
  const hasUrl = Boolean((pdfUrl.trim() || form?.menuPdfUrl)?.trim());
  const usesWebMenu = !hasPdf && !hasUrl;

  return (
    <section className="max-w-2xl space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 ring-1 ring-zinc-800/80">
      <h2 className="text-sm font-semibold text-zinc-200">Menú en PDF y código QR</h2>
      <p className="text-sm leading-relaxed text-zinc-500">
        Sube tu carta en PDF o pega un enlace público. El QR de la pantalla del mesero codifica esa dirección: al
        escanearlo, el cliente abre el PDF en su móvil. Si no configuras nada, el QR sigue mostrando la carta web
        interactiva (<code className="rounded bg-zinc-950 px-1 text-amber-200/90">/menu</code>).
      </p>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
        Estado actual:{" "}
        <span className="font-medium text-zinc-200">
          {hasUrl ? "enlace externo" : hasPdf ? "PDF en el servidor" : "carta web del sistema"}
        </span>
      </div>

      <label className="block text-sm text-zinc-300">
        Subir PDF (máx. 15 MB)
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          className="mt-2 block w-full text-sm text-zinc-400 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--theme-active)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--theme-active-strong)]"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onUpload(f);
          }}
        />
      </label>

      {hasPdf ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRemovePdf()}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Quitar PDF del servidor
        </button>
      ) : null}

      <label className="block text-sm text-zinc-300">
        O enlace directo al PDF (https://…)
        <input
          type="url"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/50"
          placeholder="https://tusitio.com/carta.pdf"
          value={pdfUrl}
          disabled={busy}
          onChange={(e) => setPdfUrl(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSaveUrl()}
          className="btn-mesero-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Guardar enlace
        </button>
        {form?.menuPdfUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onClearUrl()}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Quitar enlace
          </button>
        ) : null}
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center">
        <div className="rounded-xl bg-white p-2">
          {dataUrl ? (
            <img src={dataUrl} alt="Vista previa del QR" width={QR_SIZE} height={QR_SIZE} />
          ) : qrError ? (
            <p className="px-2 text-xs text-red-600" style={{ width: QR_SIZE }}>
              {qrError}
            </p>
          ) : (
            <div
              className="flex items-center justify-center text-xs text-zinc-500"
              style={{ width: QR_SIZE, height: QR_SIZE }}
            >
              …
            </div>
          )}
        </div>
        <div className="min-w-0 text-xs leading-relaxed text-zinc-500">
          <p className="font-medium text-zinc-300">Vista previa del QR</p>
          {usesWebMenu ? (
            <p className="mt-1">Apunta a la carta web generada por el sistema.</p>
          ) : (
            <p className="mt-1 break-all">{qrTarget}</p>
          )}
        </div>
      </div>

      {status ? (
        <p
          role="status"
          className={`text-sm ${status.includes("Error") || status.includes("debe") ? "text-amber-200" : "text-emerald-300"}`}
        >
          {status}
        </p>
      ) : null}
    </section>
  );
}
