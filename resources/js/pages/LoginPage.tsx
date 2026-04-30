import { Lock, Mail } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApexTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { isLight } = useApexTheme();
  const { login, isAuthenticated, loading } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", remember: true });
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(form);
      nav("/", { replace: true });
    } catch {
      setError("Credenciales inválidas.");
    }
  };

  const inputClass = isLight
    ? "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-3 text-sm text-[#111827] outline-none ring-[#007BFF]/18 focus:ring-2"
    : "h-11 w-full rounded-xl border border-white/[0.08] bg-[#121212] pl-10 pr-3 text-sm text-zinc-200 outline-none ring-[#007BFF]/30 focus:ring-2";

  return (
    <main className={["flex min-h-screen items-center justify-center px-4", isLight ? "bg-[#F9FAFB]" : "bg-[#000000]"].join(" ")}>
      <div
        className={[
          "w-full max-w-md rounded-2xl p-6 sm:p-8",
          isLight
            ? "border border-[#E5E7EB] bg-white shadow-sm"
            : "border border-white/[0.06] bg-[#121212] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
        ].join(" ")}
      >
        <p className={["text-xs font-semibold uppercase tracking-[0.2em]", isLight ? "text-[#007BFF]" : "text-[#7AB8FF]"].join(" ")}>Xpande Corp</p>
        <h1 className={["mt-2 text-2xl font-bold", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>Iniciar sesión</h1>
        <p className={["mt-1 text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>Acceda al sistema de laboratorio con su cuenta.</p>

        {error ? <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p> : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <Mail className={["pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", isLight ? "text-[#9CA3AF]" : "text-zinc-500"].join(" ")} />
            <input
              type="email"
              required
              placeholder="correo@empresa.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="relative">
            <Lock className={["pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", isLight ? "text-[#9CA3AF]" : "text-zinc-500"].join(" ")} />
            <input
              type="password"
              required
              placeholder="Contraseña"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputClass}
            />
          </div>

          <label className={["flex items-center gap-2 text-sm", isLight ? "text-[#6B7280]" : "text-zinc-400"].join(" ")}>
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(e) => setForm({ ...form, remember: e.target.checked })}
              className="rounded border-zinc-500"
            />
            Recordar sesión
          </label>

          <button
            type="submit"
            disabled={loading}
            className={[
              "mt-2 w-full rounded-xl py-2.5 text-sm font-semibold transition",
              isLight ? "bg-[#007BFF] text-white hover:bg-[#0063D5]" : "bg-[#007BFF] text-white shadow-[0_0_24px_rgba(0,123,255,0.4)] hover:brightness-110",
            ].join(" ")}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}

