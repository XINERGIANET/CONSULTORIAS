import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApexTheme } from "../context/ThemeContext";
import { getJson } from "../xpande/http";

type AlertItem = {
  id: string;
  type: "cxc" | "cxp" | "tiempos";
  severity: "danger" | "warning" | "info";
  title: string;
  body: string;
  date: string | null;
  link: string;
};

type AlertsResponse = { count: number; items: AlertItem[] };

function severityIcon(severity: AlertItem["severity"]) {
  if (severity === "danger") return <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
  return <Info className="h-4 w-4 shrink-0 text-blue-500" />;
}

function severityCardClass(severity: AlertItem["severity"], isLight: boolean): string {
  if (severity === "danger") {
    return isLight
      ? "border-l-4 border-red-400 bg-red-50 hover:bg-red-100"
      : "border-l-4 border-red-500 bg-red-500/10 hover:bg-red-500/15";
  }
  if (severity === "warning") {
    return isLight
      ? "border-l-4 border-amber-400 bg-amber-50 hover:bg-amber-100"
      : "border-l-4 border-amber-500 bg-amber-500/10 hover:bg-amber-500/15";
  }
  return isLight
    ? "border-l-4 border-blue-300 bg-blue-50 hover:bg-blue-100"
    : "border-l-4 border-blue-500 bg-blue-500/10 hover:bg-blue-500/15";
}

export function AlertsCard() {
  const { isLight } = useApexTheme();
  const [data, setData] = useState<AlertsResponse | null>(null);

  useEffect(() => {
    void getJson<AlertsResponse>("/api/notifications").then(setData);
  }, []);

  const items = data?.items ?? [];

  return (
    <div
      className={[
        "flex h-full flex-col rounded-xl p-4 sm:rounded-2xl sm:p-5",
        isLight
          ? "border border-[#E5E7EB] bg-white shadow-sm"
          : "rounded-2xl border border-white/[0.05] bg-[#121212] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
      ].join(" ")}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className={["text-base font-semibold", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
            Alertas
          </h2>
          <p className={["mt-0.5 text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
            Cobros y pagos próximos o vencidos, y pendientes de aprobación.
          </p>
        </div>
        {data && data.count > 0 ? (
          <span
            className={[
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white",
              items.some((i) => i.severity === "danger") ? "bg-red-500 animate-pulse" : "bg-amber-500",
            ].join(" ")}
          >
            {data.count}
          </span>
        ) : null}
      </div>

      {!data ? (
        <div className="flex flex-1 items-center justify-center">
          <p className={["text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>Cargando…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <p className={["text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
            Sin alertas pendientes por ahora.
          </p>
        </div>
      ) : (
        <div
          className={[
            "-mr-1 flex flex-col gap-2 overflow-y-auto pr-1",
            isLight ? "apex-card-scroll--light" : "apex-card-scroll--dark",
          ].join(" ")}
          style={{ maxHeight: 260 }}
        >
          {items.map((it) => (
            <Link
              key={it.id}
              to={it.link}
              className={["flex gap-3 rounded-lg px-3 py-2.5 transition-colors", severityCardClass(it.severity, isLight)].join(" ")}
            >
              <span className="mt-0.5">{severityIcon(it.severity)}</span>
              <div className="min-w-0 flex-1">
                <p className={["text-sm font-semibold", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
                  {it.title}
                </p>
                <p className={["mt-0.5 truncate text-xs", isLight ? "text-[#374151]" : "text-zinc-400"].join(" ")}>
                  {it.body}
                  {it.date ? ` · ${it.date}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
