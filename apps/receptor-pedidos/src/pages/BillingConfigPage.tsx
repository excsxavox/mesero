import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_BILLING_CONFIG,
  fetchBillingConfig,
  saveBillingConfig,
  uploadBillingCertificate,
  type BillingConfig,
} from "../lib/billingApi";

type FieldDef = {
  key: keyof BillingConfig;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
  span?: 1 | 2;
};

const INPUT_CLASS =
  "mt-1.5 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500/40";

const SECTIONS: { title: string; description: string; fields: FieldDef[] }[] = [
  {
    title: "Datos tributarios del emisor",
    description: "Información que aparece en la factura electrónica ante el SRI.",
    fields: [
      { key: "ruc", label: "RUC", placeholder: "179XXXXXXXX001", span: 1 },
      { key: "razonSocial", label: "Razón social", span: 1 },
      { key: "nombreComercial", label: "Nombre comercial", span: 1 },
      { key: "emailEmisor", label: "Correo del emisor", span: 1 },
      { key: "direccionMatriz", label: "Dirección matriz", span: 2 },
    ],
  },
  {
    title: "Punto de emisión",
    description: "Establecimiento y punto según su autorización del SRI.",
    fields: [
      { key: "establishment", label: "Establecimiento", placeholder: "001", span: 1 },
      { key: "emissionPoint", label: "Punto de emisión", placeholder: "001", span: 1 },
    ],
  },
];

function ConfigField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={`block text-sm ${field.span === 2 ? "md:col-span-2" : ""}`}>
      <span className="text-[var(--theme-text-muted)]">{field.label}</span>
      <input
        type={field.type ?? "text"}
        className={INPUT_CLASS}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function BillingConfigPage() {
  const [config, setConfig] = useState<BillingConfig>(EMPTY_BILLING_CONFIG);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [serviceUp, setServiceUp] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setMessage(null);
    void fetchBillingConfig()
      .then((data) => {
        setServiceUp(true);
        if (data.config) {
          setConfig({ ...EMPTY_BILLING_CONFIG, ...data.config, certificatePassword: "" });
        }
        setCertFile(null);
        setCertPassword("");
      })
      .catch((e) => {
        setServiceUp(false);
        setMessage({ type: "err", text: String(e) });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isReady = useMemo(
    () => Boolean(config.ruc?.trim() && config.razonSocial?.trim()),
    [config.ruc, config.razonSocial],
  );

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      let latest = { ...config };
      if (certFile) {
        const uploaded = await uploadBillingCertificate(certFile, certPassword || undefined);
        latest = { ...latest, ...uploaded };
        setCertFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      const toSave = { ...latest };
      if (certPassword.trim()) {
        toSave.certificatePassword = certPassword.trim();
      }
      const saved = await saveBillingConfig(toSave);
      latest = { ...latest, ...saved, certificatePassword: "" };
      setCertPassword("");
      setConfig(latest);
      setMessage({ type: "ok", text: "Configuración guardada correctamente." });
    } catch (e) {
      setMessage({ type: "err", text: String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-[var(--theme-text-muted)]">Cargando configuración del facturador…</p>;
  }

  return (
    <div className="w-full px-6 py-6 pb-10 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {!serviceUp && message ? (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-200">
            {message.text}
          </div>
        ) : null}

        <div
          className={`mb-6 rounded-xl border p-4 text-sm lg:flex lg:items-center lg:justify-between lg:gap-4 ${
            isReady
              ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
              : "border-zinc-600/40 bg-zinc-900/50 text-zinc-400"
          }`}
        >
          <p>
            {isReady
              ? "Emisor configurado. Puede emitir comprobantes desde Comprobantes o al cobrar una mesa."
              : "Complete al menos RUC y razón social para poder emitir facturas."}
          </p>
          {config.secuencialActual != null ? (
            <p className="mt-2 shrink-0 text-xs opacity-80 lg:mt-0">
              Próximo secuencial: <strong>{config.secuencialActual}</strong>
            </p>
          ) : null}
        </div>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {SECTIONS.map((section) => (
            <fieldset
              key={section.title}
              className="rounded-xl border border-[var(--panel-border)] bg-[var(--theme-elevated)]/30 p-5 lg:p-6"
            >
              <legend className="px-1 text-base font-semibold text-[var(--theme-text)]">
                {section.title}
              </legend>
              <p className="mb-4 text-xs text-[var(--theme-text-muted)]">{section.description}</p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                {section.fields.map((f) => (
                  <ConfigField
                    key={f.key}
                    field={f}
                    value={String(config[f.key] ?? "")}
                    onChange={(v) => setConfig((c) => ({ ...c, [f.key]: v }))}
                  />
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset className="rounded-xl border border-[var(--panel-border)] bg-[var(--theme-elevated)]/30 p-5 lg:p-6">
            <legend className="px-1 text-base font-semibold text-[var(--theme-text)]">
              Certificado digital
            </legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="text-[var(--theme-text-muted)]">Archivo .p12 / .pfx</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".p12,.pfx,application/x-pkcs12"
                  className={`${INPUT_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:text-white`}
                  onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                />
                {config.certificateUploaded && !certFile ? (
                  <p className="mt-1 text-xs text-emerald-400/90">
                    Cargado: {config.certificateFileName || "emisor.p12"}
                  </p>
                ) : null}
                {certFile ? (
                  <p className="mt-1 text-xs text-zinc-400">Seleccionado: {certFile.name}</p>
                ) : null}
              </label>
              <label className="block text-sm">
                <span className="text-[var(--theme-text-muted)]">Contraseña del certificado</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={INPUT_CLASS}
                  value={certPassword}
                  placeholder={config.certificatePasswordSet ? "••••••••" : ""}
                  onChange={(e) => setCertPassword(e.target.value)}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-[var(--panel-border)] bg-[var(--theme-elevated)]/30 p-5 lg:p-6">
            <legend className="px-1 text-base font-semibold text-[var(--theme-text)]">Ambiente SRI</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-[var(--theme-text-muted)]">Ambiente</span>
                <select
                  className={INPUT_CLASS}
                  value={config.ambiente}
                  onChange={(e) => setConfig((c) => ({ ...c, ambiente: e.target.value }))}
                >
                  <option value="1">1 — Pruebas</option>
                  <option value="2">2 — Producción</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-[var(--theme-text-muted)]">Tipo de emisión</span>
                <select
                  className={INPUT_CLASS}
                  value={config.tipoEmision}
                  onChange={(e) => setConfig((c) => ({ ...c, tipoEmision: e.target.value }))}
                >
                  <option value="1">1 — Normal</option>
                </select>
              </label>
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="submit"
              disabled={saving || !serviceUp}
              className="rounded-xl bg-violet-600 px-8 py-3.5 font-semibold text-white hover:bg-violet-500 disabled:opacity-50 sm:min-w-[280px]"
            >
              {saving ? "Guardando…" : "Guardar configuración del emisor"}
            </button>
          </div>
        </form>

        {message ? (
          <p
            className={`mt-4 text-sm ${message.type === "ok" ? "text-emerald-400" : "text-red-300"}`}
            role="status"
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
