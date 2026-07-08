import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";
import { useApexTheme } from "../context/ThemeContext";
import { getJson } from "../xpande/http";

type ActivityItem = {
  id: number;
  type: string;
  subject: string;
  client?: string | null;
  user?: string | null;
  occurred_at?: string | null;
};

type ActivityResponse = { items: ActivityItem[] };

const TYPE_LABELS: Record<string, string> = {
  call: "Llamada",
  meeting: "Reunión",
  email: "Correo",
  note: "Nota",
  task: "Tarea",
  other: "Actividad",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? (type ? type.charAt(0).toUpperCase() + type.slice(1) : "Actividad");
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return "—";
  }
}

export function RecentActivityList() {
  const { isLight } = useApexTheme();
  const [data, setData] = useState<ActivityResponse | null>(null);
  const dotRing = isLight ? "ring-white" : "ring-[#121212]";
  const dotFill = "bg-[#007BFF]";

  useEffect(() => {
    void getJson<ActivityResponse>("/api/reports/recent-activity").then(setData);
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
            Actividad reciente
          </h2>
          <p className={["mt-0.5 text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
            Últimas interacciones registradas con clientes.
          </p>
        </div>
        <a
          href="/clientes"
          className={[
            "shrink-0 text-sm font-medium",
            isLight ? "text-[#007BFF] hover:text-[#0063D5]" : "text-[#7AB8FF] hover:text-[#A8D4FF]",
          ].join(" ")}
        >
          Ver todos
        </a>
      </div>

      {!data ? (
        <div className="flex flex-1 items-center justify-center">
          <p className={["text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>Cargando…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <p className={["text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
            Sin actividad reciente registrada con clientes.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-0">
          {items.map((it, idx) => (
            <li
              key={it.id}
              className={[
                "flex gap-3 py-3",
                idx < items.length - 1 ? (isLight ? "border-b border-[#F3F4F6]" : "border-b border-white/[0.06]") : "",
              ].join(" ")}
            >
              <div className="relative flex shrink-0 flex-col items-center pt-0.5">
                <span className={["relative z-10 h-2.5 w-2.5 rounded-full ring-2", dotFill, dotRing].join(" ")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={["text-sm font-medium", isLight ? "text-[#111827]" : "text-zinc-200"].join(" ")}>
                  {typeLabel(it.type)}{it.client ? ` · ${it.client}` : ""}
                </p>
                <p className={["mt-0.5 truncate text-xs", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                  {it.subject}
                </p>
                <p className={["mt-0.5 text-xs", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                  {it.user ?? "—"} · {timeAgo(it.occurred_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
