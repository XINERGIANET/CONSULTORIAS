import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApexTheme } from "../context/ThemeContext";
import { getJson } from "../xpande/http";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MESES[(m ?? 1) - 1] ?? period} ${String(y ?? "").slice(2)}`;
}

type CashFlowResponse = {
  ingresos: { period: string; total: string | number }[];
  gastos: { period: string; total: string | number }[];
};

type TrendRow = { name: string; ingresos: number; gastos: number; utilidad: number; isCurrent: boolean };

const tabs = [
  { id: "ingresos" as const, label: "Ingresos" },
  { id: "gastos" as const, label: "Costos" },
  { id: "utilidad" as const, label: "Utilidad" },
];

export function OverviewChart() {
  const { isLight } = useApexTheme();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("ingresos");
  const [raw, setRaw] = useState<CashFlowResponse | null>(null);

  useEffect(() => {
    const from = new Date();
    from.setMonth(from.getMonth() - 6);
    from.setDate(1);
    void getJson<CashFlowResponse>("/api/reports/cash-flow", {
      from: from.toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    }).then(setRaw);
  }, []);

  const lineColor = isLight ? "#007BFF" : "#007BFF";

  const data = useMemo<TrendRow[]>(() => {
    if (!raw) return [];
    const periods = new Map<string, { ingresos: number; gastos: number }>();
    for (const r of raw.ingresos) {
      periods.set(r.period, { ingresos: Number(r.total), gastos: periods.get(r.period)?.gastos ?? 0 });
    }
    for (const r of raw.gastos) {
      const prev = periods.get(r.period);
      periods.set(r.period, { ingresos: prev?.ingresos ?? 0, gastos: Number(r.total) });
    }

    const now = new Date();
    const currentPeriod = now.toISOString().slice(0, 7);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const projectionScale = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

    return Array.from(periods.keys())
      .sort()
      .map((period) => {
        const row = periods.get(period)!;
        const isCurrent = period === currentPeriod;
        const ingresos = isCurrent ? Math.round(row.ingresos * projectionScale) : row.ingresos;
        const gastos = isCurrent ? Math.round(row.gastos * projectionScale) : row.gastos;
        return {
          name: monthLabel(period) + (isCurrent ? " (proy.)" : ""),
          ingresos,
          gastos,
          utilidad: ingresos - gastos,
          isCurrent,
        };
      });
  }, [raw]);

  const tooltipStyles = isLight
    ? {
        background: "#ffffff",
        border: "1px solid #E5E7EB",
        borderRadius: "8px",
        fontSize: 12,
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08)",
      }
    : {
        background: "#161616",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        fontSize: 12,
      };

  const hasCurrentProjection = data.some((d) => d.isCurrent);

  return (
    <div
      className={[
        "flex h-full min-h-[300px] flex-col rounded-xl p-4 sm:rounded-2xl sm:p-5",
        isLight
          ? "border border-[#E5E7EB] bg-white shadow-sm"
          : "rounded-2xl border border-white/[0.05] bg-[#121212] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
      ].join(" ")}
    >
      <div className="mb-2 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className={["text-base font-semibold", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
            Tendencia financiera
          </h2>
          <p className={["text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
            Ingresos, costos y utilidad de los últimos meses, con proyección del mes en curso.
          </p>
        </div>
        <div
          className={[
            "inline-flex gap-0.5 rounded-lg p-0.5",
            isLight ? "border border-[#E5E7EB] bg-[#F9FAFB]" : "border border-white/[0.08] bg-black/30",
          ].join(" ")}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                tab === t.id
                  ? isLight
                    ? "bg-white text-[#007BFF] shadow-sm ring-1 ring-[#E5E7EB]"
                    : "bg-white/[0.1] text-[#7AB8FF] shadow-sm"
                  : isLight
                    ? "text-[#6B7280] hover:text-[#111827]"
                    : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 w-full" style={{ minHeight: 240 }}>
        {!raw ? (
          <p className={["text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>Cargando…</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ov-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={isLight ? 0.25 : 0.3} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isLight ? "#F3F4F6" : "rgba(255,255,255,0.04)"}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                stroke={isLight ? "#9CA3AF" : "#52525b"}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={isLight ? "#9CA3AF" : "#52525b"}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v) => `S/.${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`}
              />
              <Tooltip
                contentStyle={tooltipStyles}
                labelStyle={{ color: isLight ? "#6B7280" : "#a1a1aa" }}
                itemStyle={{ color: lineColor }}
                formatter={(val) => [`S/. ${Number(val).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`, tabs.find((t) => t.id === tab)?.label ?? ""]}
              />
              <Area
                type="monotone"
                dataKey={tab}
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#ov-area)"
                dot={(props: { key?: string; cx?: number; cy?: number; payload?: TrendRow }) => {
                  const isCurrent = props.payload?.isCurrent;
                  return (
                    <circle
                      key={props.key}
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill={isCurrent ? (isLight ? "#ffffff" : "#121212") : lineColor}
                      stroke={lineColor}
                      strokeWidth={2}
                      strokeDasharray={isCurrent ? "2 2" : undefined}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {hasCurrentProjection ? (
        <p className={["mt-2 text-[11px]", isLight ? "text-[#9CA3AF]" : "text-zinc-600"].join(" ")}>
          * El mes en curso está proyectado según el ritmo de registro diario, no es un cierre definitivo.
        </p>
      ) : null}
    </div>
  );
}
