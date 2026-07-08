import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useApexTheme } from "../context/ThemeContext";
import { getJson } from "../xpande/http";

type CategoryRow = { name: string; current: number; previous: number };

type CostComparison = {
  current_total: number;
  previous_total: number;
  delta_pct: number;
  categories: CategoryRow[];
};

function money(v: number): string {
  return `S/. ${v.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

export function CostComparisonCard() {
  const { isLight } = useApexTheme();
  const [data, setData] = useState<CostComparison | null>(null);

  useEffect(() => {
    void getJson<CostComparison>("/api/reports/cost-comparison").then(setData);
  }, []);

  const up = (data?.delta_pct ?? 0) > 0;
  const flat = (data?.delta_pct ?? 0) === 0;

  return (
    <div
      className={[
        "flex h-full flex-col rounded-xl p-4 sm:rounded-2xl sm:p-5",
        isLight
          ? "border border-[#E5E7EB] bg-white shadow-sm"
          : "rounded-2xl border border-white/[0.05] bg-[#121212] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
      ].join(" ")}
    >
      <div className="mb-4">
        <h2 className={["text-base font-semibold", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
          Comparación de costos
        </h2>
        <p className={["mt-0.5 text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
          Mes actual frente al mes anterior, por categoría.
        </p>
      </div>

      {!data ? (
        <p className={["text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>Cargando…</p>
      ) : (
        <>
          <div className="mb-4 flex items-end justify-between gap-2">
            <div>
              <p className={["text-2xl font-semibold tracking-tight", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
                {money(data.current_total)}
              </p>
              <p className={["mt-0.5 text-xs", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                Mes anterior: {money(data.previous_total)}
              </p>
            </div>
            <div
              className={[
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                flat
                  ? isLight
                    ? "bg-[#F3F4F6] text-[#6B7280]"
                    : "bg-white/[0.06] text-zinc-400"
                  : up
                    ? isLight
                      ? "bg-red-50 text-red-600"
                      : "bg-red-500/10 text-red-400"
                    : isLight
                      ? "bg-[#E6F3FF] text-[#007BFF]"
                      : "bg-[#0a2744] text-[#7AB8FF]",
              ].join(" ")}
            >
              {!flat ? (up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
              {Math.abs(data.delta_pct)}%
            </div>
          </div>

          {data.categories.length === 0 ? (
            <p className={["text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
              Sin costos registrados todavía este mes.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.categories.map((c) => {
                const max = Math.max(c.current, c.previous, 1);
                return (
                  <li key={c.name}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className={["text-sm font-medium", isLight ? "text-[#111827]" : "text-zinc-200"].join(" ")}>
                        {c.name}
                      </span>
                      <span className={["text-xs", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                        {money(c.current)} <span className="opacity-60">vs {money(c.previous)}</span>
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <div className={["h-1.5 flex-1 overflow-hidden rounded-full", isLight ? "bg-[#F3F4F6]" : "bg-white/[0.08]"].join(" ")}>
                        <div className="h-full rounded-full bg-[#007BFF]" style={{ width: `${(c.current / max) * 100}%` }} />
                      </div>
                      <div className={["h-1.5 flex-1 overflow-hidden rounded-full", isLight ? "bg-[#F3F4F6]" : "bg-white/[0.08]"].join(" ")}>
                        <div
                          className={isLight ? "h-full rounded-full bg-[#9CA3AF]" : "h-full rounded-full bg-zinc-600"}
                          style={{ width: `${(c.previous / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
