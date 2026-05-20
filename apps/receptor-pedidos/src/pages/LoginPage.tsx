import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    void login(email, password)
      .then(() => navigate(from, { replace: true }))
      .catch((err) => setError(String(err)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--theme-body-gradient)] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-card)] p-8 shadow-xl ring-1 ring-[var(--panel-border)]">
        <div className="mb-6 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-3xl ring-1 ring-violet-500/30">
            🍽️
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[var(--theme-text)]">Receptor de pedidos</h1>
          <p className="mt-1 text-sm text-[var(--theme-text-muted)]">Cocina, caja y panel de control</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--theme-text-muted)]">Correo</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--panel-border)] bg-[var(--theme-deep)]/50 px-3 py-2.5 text-sm text-[var(--theme-text)] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
              placeholder="tu@correo.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--theme-text-muted)]">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--panel-border)] bg-[var(--theme-deep)]/50 px-3 py-2.5 text-sm text-[var(--theme-text)] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-200 ring-1 ring-red-900/50">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 hover:opacity-95 disabled:opacity-50"
          >
            {busy ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-5 text-center text-[10px] text-[var(--theme-text-muted)]/70">
          Autenticación segura vía AIBox
        </p>
      </div>
    </div>
  );
}
