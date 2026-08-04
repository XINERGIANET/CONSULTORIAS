import { AlertCircle, Home, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApexTheme } from "../context/ThemeContext";

export function NotFoundPage() {
  const { isLight } = useApexTheme();
  const navigate = useNavigate();

  return (
    <div
      className={[
        "min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-200",
        isLight ? "bg-[#F8FAFC] text-slate-900" : "bg-[#090D16] text-white",
      ].join(" ")}
    >
      {/* Background Decorative Element */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div
        className={[
          "relative z-10 w-full max-w-lg rounded-3xl border p-8 shadow-2xl backdrop-blur-md",
          isLight ? "border-slate-200 bg-white/80" : "border-white/10 bg-[#121726]/80",
        ].join(" ")}
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 ring-8 ring-indigo-500/5">
          <AlertCircle className="h-10 w-10 text-indigo-500" />
        </div>

        <span className="inline-block rounded-full bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-500 ring-1 ring-indigo-500/20 mb-3">
          404 / Sesión Expirada
        </span>

        <h1 className={["text-2xl font-extrabold tracking-tight sm:text-3xl", isLight ? "text-slate-900" : "text-white"].join(" ")}>
          Página no encontrada o no disponible
        </h1>

        <p className={["mt-3 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-zinc-400"].join(" ")}>
          La sección a la que intentas acceder no existe, ha sido movida o la sesión expiró. Puedes retornar de forma segura al panel general o recargar la página.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <Home className="h-4 w-4" />
            <span>Volver al Panel General</span>
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className={[
              "w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all cursor-pointer",
              isLight
                ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
            ].join(" ")}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Recargar página</span>
          </button>
        </div>
      </div>
    </div>
  );
}
