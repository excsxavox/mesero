import { useCallback, useEffect, useMemo, useState } from "react";
import { getMenuPublicUrl } from "../../lib/menuPublicUrl";
import type { Settings } from "../../lib/types";

const QR_SIZE_FULL = 148;

type Props = {
  /** Cuando hay artículos en el pedido en curso, solo se muestra el botón para abrir el QR en modal. */
  compact?: boolean;
  settings?: Pick<Settings, "menuPdfConfigured" | "menuPdfUrl" | "companyId"> | null;
};

function useMenuQrDataUrl(publicUrl: string | null, size: number) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQrError(null);
    setQrDataUrl(null);
    if (!publicUrl) return;
    void import("qrcode")
      .then((mod) => {
        const QRCode = mod.default ?? mod;
        return QRCode.toDataURL(publicUrl, {
          width: size,
          margin: 1,
          errorCorrectionLevel: "M",
        });
      })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrError("No se pudo generar el código QR.");
      });
    return () => {
      cancelled = true;
    };
  }, [publicUrl, size]);

  return { qrDataUrl, qrError };
}

function QrImage({ dataUrl, error, size }: { dataUrl: string | null; error: string | null; size: number }) {
  return (
    <div className="rounded-xl bg-white p-2 shadow-md shadow-black/30">
      {dataUrl ? (
        <img src={dataUrl} alt="Código QR del menú" width={size} height={size} className="block" />
      ) : error ? (
        <div
          className="flex items-center justify-center px-2 text-center leading-snug text-red-600"
          style={{ width: size, height: size, fontSize: 11 }}
        >
          {error}
        </div>
      ) : (
        <div
          className="flex items-center justify-center text-zinc-500"
          style={{ width: size, height: size, fontSize: 11 }}
        >
          …
        </div>
      )}
    </div>
  );
}

function MenuQrModal({
  open,
  onClose,
  publicUrl,
  hint,
}: {
  open: boolean;
  onClose: () => void;
  publicUrl: string | null;
  hint: string;
}) {
  const { qrDataUrl, qrError } = useMenuQrDataUrl(publicUrl, QR_SIZE_FULL);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-qr-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl border border-mesero-line/20 bg-mesero-panel p-5 shadow-2xl ring-1 ring-mesero-line/15"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="menu-qr-modal-title" className="text-sm font-semibold uppercase tracking-wide text-mesero-accent">
              Menú
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-mesero-text-muted">{hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-manipulation flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-mesero-text-muted ring-1 ring-mesero-line/25 hover:bg-mesero-panel/50 hover:text-mesero-text"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>
        <div className="flex justify-center">
          <QrImage dataUrl={qrDataUrl} error={qrError} size={QR_SIZE_FULL} />
        </div>
      </div>
    </div>
  );
}

export function MenuQrCard({ compact = false, settings = null }: Props) {
  const publicUrl = useMemo(() => getMenuPublicUrl({ settings }), [settings]);
  const usesPdf = Boolean(settings?.menuPdfUrl?.trim() || settings?.menuPdfConfigured);
  const hint = usesPdf ? "Escanea para abrir la carta en PDF" : "Escanea para ver la carta en tu móvil";
  const [modalOpen, setModalOpen] = useState(false);
  const { qrDataUrl, qrError } = useMenuQrDataUrl(publicUrl, QR_SIZE_FULL);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  if (compact) {
    return (
      <>
        <section className="rounded-2xl border border-mesero-line/15 bg-mesero-panel/90 px-3 py-2.5 ring-1 ring-mesero-line/10">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-mesero-text-muted">Menú</h2>
          <p className="mt-0.5 text-[10px] leading-snug text-mesero-text-muted/80">{usesPdf ? "PDF en móvil" : "Escanear carta en el móvil"}</p>
          <button
            type="button"
            onClick={openModal}
            className="mt-2 w-full touch-manipulation rounded-lg border border-mesero-line/30 bg-mesero-panel/40 px-3 py-2 text-[11px] font-medium text-mesero-accent ring-1 ring-mesero-line/20 hover:bg-mesero-panel/50"
          >
            Mostrar QR
          </button>
        </section>
        <MenuQrModal open={modalOpen} onClose={closeModal} publicUrl={publicUrl} hint={hint} />
      </>
    );
  }

  return (
    <section className="flex flex-col items-center rounded-2xl border border-mesero-line/15 bg-mesero-panel/90 p-4 ring-1 ring-mesero-line/10">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-mesero-text-muted">Menú</h2>
      <p className="mt-1 text-center text-[11px] leading-snug text-mesero-text-muted">{hint}</p>
      <div className="mt-3">
        <QrImage dataUrl={qrDataUrl} error={qrError} size={QR_SIZE_FULL} />
      </div>
    </section>
  );
}
