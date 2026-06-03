import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../xpande/apiError";
import type { LaravelPaginated } from "../xpande/http";
import { getJson } from "../xpande/http";
import {
  LabBreadcrumbs,
  LabPageHeader,
  labCrudMainClass,
  labPanelClass,
} from "../xpande/XpandeUi";
import { LabNoticeModal } from "../xpande/LabTableKit";
import { useApexTheme } from "../context/ThemeContext";

type TaskRow = {
  id: number;
  title: string;
  description?: string | null;
  project_id?: number | null;
  assigned_user_id?: number | null;
  start_date?: string | null;
  due_date?: string | null;
  estimated_hours?: string | null;
  status: string;
  priority: string;
  is_overdue: boolean;
  started_at?: string | null;
  finished_at?: string | null;
  project?: { id: number; name: string } | null;
  assigned_user?: { id: number; name: string } | null;
};

type StatusFilter = "all" | "pending" | "in_progress" | "finished" | "overdue";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En proceso" },
  { value: "finished", label: "Finalizado" },
  { value: "overdue", label: "Vencido" },
];

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  finished: "Finalizado",
  overdue: "Vencido",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const cells: (Date | null)[] = Array<null>(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function effectiveKey(t: TaskRow): "pending" | "in_progress" | "finished" | "overdue" {
  return (t.is_overdue ? "overdue" : t.status) as "pending" | "in_progress" | "finished" | "overdue";
}

function getColors(t: TaskRow, isLight: boolean) {
  const k = effectiveKey(t);
  if (isLight) {
    const map = {
      pending:    { pill: "bg-amber-50 border border-amber-200 text-amber-700",     dot: "bg-amber-500",   borderL: "border-l-amber-500" },
      in_progress:{ pill: "bg-blue-50 border border-blue-200 text-blue-700",       dot: "bg-blue-500",    borderL: "border-l-blue-500" },
      finished:   { pill: "bg-emerald-50 border border-emerald-200 text-emerald-700", dot: "bg-emerald-500", borderL: "border-l-emerald-500" },
      overdue:    { pill: "bg-red-50 border border-red-200 text-red-700",           dot: "bg-red-500",     borderL: "border-l-red-500" },
    };
    return map[k] ?? { pill: "bg-zinc-100 border border-zinc-200 text-zinc-600", dot: "bg-zinc-400", borderL: "border-l-zinc-400" };
  }
  const map = {
    pending:    { pill: "bg-amber-500/20 text-amber-300",   dot: "bg-amber-500",   borderL: "border-l-amber-500" },
    in_progress:{ pill: "bg-blue-500/20 text-blue-300",     dot: "bg-blue-500",    borderL: "border-l-blue-500" },
    finished:   { pill: "bg-emerald-500/20 text-emerald-300", dot: "bg-emerald-500", borderL: "border-l-emerald-500" },
    overdue:    { pill: "bg-red-500/20 text-red-300",       dot: "bg-red-500",     borderL: "border-l-red-500" },
  };
  return map[k] ?? { pill: "bg-zinc-500/20 text-zinc-400", dot: "bg-zinc-500", borderL: "border-l-zinc-500" };
}

// Primary calendar date for a task (due_date > start_date > null)
function primaryDate(t: TaskRow): string | null {
  if (t.due_date) return String(t.due_date).slice(0, 10);
  if (t.start_date) return String(t.start_date).slice(0, 10);
  return null;
}

// Task "starts" on this day but its due_date is elsewhere
function startsOn(t: TaskRow, dayStr: string): boolean {
  if (!t.start_date) return false;
  const s = String(t.start_date).slice(0, 10);
  if (s !== dayStr) return false;
  const due = t.due_date ? String(t.due_date).slice(0, 10) : null;
  return due !== dayStr;
}

export function CalendarPage() {
  const { isLight } = useApexTheme();
  const { user, isSuperadmin } = useAuth();

  const todayStr = toDateStr(new Date());

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);
  const [allTasks, setAllTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [notice, setNotice] = useState<{ variant: "success" | "error"; title: string; message: string } | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJson<LaravelPaginated<TaskRow>>("/api/tasks", {
        per_page: 500,
        assigned_user_id: !isSuperadmin && user ? user.id : undefined,
      });
      setAllTasks(res.data);
    } catch (e: unknown) {
      setNotice({ variant: "error", title: "Calendario", message: apiErrorMessage(e, "No se pudieron cargar las tareas.") });
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin, user]);

  useEffect(() => { void fetchTasks(); }, [fetchTasks]);

  const prevMonth = () => {
    setCurrentMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    );
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
    );
    setSelectedDay(null);
  };

  const goToday = () => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDay(todayStr);
  };

  const visibleTasks = allTasks.filter(t => {
    if (statusFilter === "all") return true;
    if (statusFilter === "overdue") return t.is_overdue;
    return t.status === statusFilter;
  });

  const overdueTasks = allTasks.filter(t => t.is_overdue);

  function cellTasks(dayStr: string): TaskRow[] {
    return visibleTasks.filter(t => primaryDate(t) === dayStr);
  }

  function cellStarting(dayStr: string): TaskRow[] {
    return visibleTasks.filter(t => startsOn(t, dayStr));
  }

  const cells = buildCalendarGrid(currentMonth.year, currentMonth.month);

  // Side-panel data for selected day
  const panelDue = selectedDay ? cellTasks(selectedDay) : [];
  const panelStarting = selectedDay ? cellStarting(selectedDay) : [];
  const panelTotal = panelDue.length + panelStarting.length;

  const btnBase = isLight
    ? "flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#374151] transition hover:bg-[#F9FAFB]"
    : "flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-[#121212] text-zinc-200 transition hover:bg-white/[0.06]";

  const tabBase = (active: boolean) =>
    [
      "px-3 py-1.5 transition-colors text-xs font-medium",
      active
        ? "bg-[#007BFF] text-white"
        : isLight
          ? "bg-white text-[#6B7280] hover:bg-[#F3F4F6]"
          : "bg-transparent text-zinc-400 hover:bg-white/[0.05]",
    ].join(" ");

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs
        items={[{ label: "Dashboard", to: "/" }, { label: "Calendario" }]}
        isLight={isLight}
      />
      <LabPageHeader
        title="Calendario de productividad"
        subtitle={
          isSuperadmin
            ? "Vista mensual de todas las tareas: fechas límite, inicio planificado y progreso por equipo."
            : "Tu calendario de tareas: pendientes, en proceso y finalizadas con sus fechas clave."
        }
        isLight={isLight}
      />

      {/* Overdue alert banner */}
      {overdueTasks.length > 0 && (
        <div
          className={[
            "mb-4 flex items-center gap-3 rounded-xl border px-4 py-3",
            isLight ? "border-red-200 bg-red-50" : "border-red-500/20 bg-red-500/10",
          ].join(" ")}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <p className={["text-sm font-medium", isLight ? "text-red-700" : "text-red-400"].join(" ")}>
            {overdueTasks.length === 1
              ? "1 tarea vencida sin finalizar"
              : `${overdueTasks.length} tareas vencidas sin finalizar`}
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter("overdue")}
            className={[
              "ml-auto shrink-0 rounded-lg px-3 py-1 text-xs font-semibold transition",
              isLight ? "bg-red-600 text-white hover:bg-red-700" : "bg-red-500/20 text-red-300 hover:bg-red-500/30",
            ].join(" ")}
          >
            Ver vencidas
          </button>
        </div>
      )}

      {/* Controls row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className={btnBase} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className={["min-w-[11rem] text-center text-base font-bold", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
            {MONTHS_ES[currentMonth.month]} {currentMonth.year}
          </span>
          <button type="button" onClick={nextMonth} className={btnBase} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className={[
              "ml-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              isLight
                ? "border-[#007BFF]/30 bg-[#EFF6FF] text-[#007BFF] hover:bg-[#DBEAFE]"
                : "border-[#007BFF]/30 bg-[#007BFF]/10 text-[#7AB8FF] hover:bg-[#007BFF]/20",
            ].join(" ")}
          >
            Hoy
          </button>
        </div>

        {/* Status tabs */}
        <div className={["flex overflow-hidden rounded-lg border", isLight ? "border-[#E5E7EB]" : "border-white/[0.08]"].join(" ")}>
          {STATUS_TABS.map(({ value, label }) => (
            <button key={value} type="button" onClick={() => setStatusFilter(value)} className={tabBase(statusFilter === value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: calendar + side panel */}
      <div className="flex items-start gap-4">

        {/* Calendar grid */}
        <div className={["min-w-0 flex-1", labPanelClass(isLight)].join(" ")}>
          {loading ? (
            <div className="py-20 text-center text-sm text-zinc-500">Cargando tareas…</div>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="mb-1 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((wd) => (
                  <div
                    key={wd}
                    className={[
                      "py-1.5 text-center text-[10px] font-bold uppercase tracking-wider",
                      isLight ? "text-[#6B7280]" : "text-zinc-500",
                    ].join(" ")}
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, idx) => {
                  if (!day) {
                    return <div key={`pad-${idx}`} className="min-h-[80px] rounded-lg" />;
                  }

                  const dayStr = toDateStr(day);
                  const isToday = dayStr === todayStr;
                  const isSel = dayStr === selectedDay;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const due = cellTasks(dayStr);
                  const starting = cellStarting(dayStr);
                  const combined = [...due, ...starting];
                  const maxPills = 3;
                  const overflow = combined.length - maxPills;

                  return (
                    <button
                      key={dayStr}
                      type="button"
                      onClick={() => setSelectedDay(isSel ? null : dayStr)}
                      className={[
                        "min-h-[80px] rounded-lg p-1.5 text-left transition-all",
                        isSel
                          ? isLight
                            ? "ring-2 ring-[#007BFF]/50 bg-[#EFF6FF]"
                            : "ring-2 ring-[#007BFF]/35 bg-[#007BFF]/12"
                          : isLight
                            ? isWeekend
                              ? "bg-[#F3F4F6]/70 hover:bg-[#DBEAFE]/60"
                              : "bg-white hover:bg-[#EFF6FF]/70"
                            : isWeekend
                              ? "bg-white/[0.015] hover:bg-[#007BFF]/10"
                              : "hover:bg-[#007BFF]/10",
                      ].join(" ")}
                    >
                      {/* Day number */}
                      <span
                        className={[
                          "mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                          isToday
                            ? "bg-[#007BFF] text-white"
                            : isSel
                              ? isLight ? "text-[#007BFF]" : "text-[#7AB8FF]"
                              : isLight ? "text-[#374151]" : "text-zinc-300",
                        ].join(" ")}
                      >
                        {day.getDate()}
                      </span>

                      {/* Task pills */}
                      <div className="space-y-[3px]">
                        {combined.slice(0, maxPills).map((t) => {
                          const c = getColors(t, isLight);
                          return (
                            <div
                              key={t.id}
                              className={["flex items-center gap-1 rounded px-1 py-[2px]", c.pill].join(" ")}
                            >
                              <span className={["h-1.5 w-1.5 shrink-0 rounded-full", c.dot].join(" ")} />
                              <span className="line-clamp-1 flex-1 text-[9px] font-medium leading-tight">{t.title}</span>
                            </div>
                          );
                        })}
                        {overflow > 0 && (
                          <div className={["rounded px-1 py-[2px] text-[9px] font-semibold", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                            +{overflow} más
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className={["mt-4 flex flex-wrap gap-3 border-t pt-3 text-[10px] font-semibold uppercase tracking-wide", isLight ? "border-[#E5E7EB] text-[#6B7280]" : "border-white/[0.06] text-zinc-500"].join(" ")}>
                {(["pending", "in_progress", "finished", "overdue"] as const).map((k) => {
                  const dotCls = { pending: "bg-amber-500", in_progress: "bg-blue-500", finished: "bg-emerald-500", overdue: "bg-red-500" }[k];
                  return (
                    <span key={k} className="flex items-center gap-1.5">
                      <span className={["h-2 w-2 rounded-full", dotCls].join(" ")} />
                      {STATUS_LABELS[k]}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Side panel */}
        <div className={["w-[300px] shrink-0", labPanelClass(isLight)].join(" ")}>
          {selectedDay ? (
            <>
              {/* Day header */}
              <div className={["mb-4 border-b pb-3", isLight ? "border-[#E5E7EB]" : "border-white/[0.06]"].join(" ")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={["text-[10px] font-bold uppercase tracking-widest", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                      {selectedDay === todayStr ? "Hoy · " : ""}
                      {WEEKDAYS[(new Date(selectedDay + "T12:00:00").getDay() + 6) % 7]}
                    </p>
                    <h3 className={["text-xl font-bold leading-none", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
                      {new Date(selectedDay + "T12:00:00").getDate()}{" "}
                      <span className="text-base font-normal">
                        {MONTHS_ES[new Date(selectedDay + "T12:00:00").getMonth()]}
                      </span>
                    </h3>
                  </div>
                  <span className={["mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold", isLight ? "bg-[#F3F4F6] text-[#6B7280]" : "bg-white/[0.06] text-zinc-400"].join(" ")}>
                    {panelTotal} tarea{panelTotal !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Task list */}
              {panelTotal === 0 ? (
                <div className="py-8 text-center">
                  <CalendarDays className={["mx-auto mb-2 h-8 w-8", isLight ? "text-[#CBD5E1]" : "text-zinc-700"].join(" ")} />
                  <p className={["text-sm", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                    Sin tareas para este día
                  </p>
                </div>
              ) : (
                <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-0.5">
                  {panelDue.length > 0 && (
                    <div className="mb-1">
                      <p className={["mb-2 text-[10px] font-bold uppercase tracking-wider", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                        Vence este día
                      </p>
                      <div className="space-y-2">
                        {panelDue.map((t) => <TaskCard key={t.id} task={t} isLight={isLight} />)}
                      </div>
                    </div>
                  )}
                  {panelStarting.length > 0 && (
                    <div className={panelDue.length > 0 ? "mt-4" : ""}>
                      <p className={["mb-2 text-[10px] font-bold uppercase tracking-wider", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                        Inicia este día
                      </p>
                      <div className="space-y-2">
                        {panelStarting.map((t) => <TaskCard key={t.id} task={t} isLight={isLight} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className={["mb-3 h-10 w-10", isLight ? "text-[#CBD5E1]" : "text-zinc-700"].join(" ")} />
              <p className={["text-sm font-medium", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                Selecciona un día<br />para ver sus tareas
              </p>
            </div>
          )}
        </div>
      </div>

      <LabNoticeModal
        open={notice !== null}
        variant={notice?.variant ?? "error"}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        isLight={isLight}
        onClose={() => setNotice(null)}
      />
    </main>
  );
}

function TaskCard({ task: t, isLight }: { task: TaskRow; isLight: boolean }) {
  const c = getColors(t, isLight);
  return (
    <div
      className={[
        "rounded-lg border border-l-4 p-3",
        c.borderL,
        isLight ? "border-[#E5E7EB] bg-[#F9FAFB]" : "border-white/[0.06] bg-white/[0.03]",
      ].join(" ")}
    >
      <p className={["text-xs font-semibold leading-tight", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
        {t.title}
      </p>
      {t.project ? (
        <p className={["mt-0.5 text-[10px]", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
          {t.project.name}
        </p>
      ) : null}
      {t.description ? (
        <p className={["mt-1 line-clamp-2 text-[10px] leading-relaxed", isLight ? "text-[#9CA3AF]" : "text-zinc-600"].join(" ")}>
          {t.description}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {/* Status */}
        <span className={["inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase", c.pill].join(" ")}>
          <span className={["h-1.5 w-1.5 rounded-full", c.dot].join(" ")} />
          {STATUS_LABELS[effectiveKey(t)]}
        </span>
        {/* Priority */}
        <span className={["inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase", isLight ? "bg-[#F3F4F6] text-[#6B7280]" : "bg-white/[0.06] text-zinc-400"].join(" ")}>
          {PRIORITY_LABELS[t.priority] ?? t.priority}
        </span>
        {/* Assignee */}
        {t.assigned_user ? (
          <span className={["inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium", isLight ? "bg-[#EFF6FF] text-[#007BFF]" : "bg-[#007BFF]/15 text-[#7AB8FF]"].join(" ")}>
            {t.assigned_user.name.split(" ").slice(0, 2).join(" ")}
          </span>
        ) : null}
        {/* Estimated hours */}
        {t.estimated_hours ? (
          <span className={["inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium", isLight ? "bg-[#F3F4F6] text-[#6B7280]" : "bg-white/[0.06] text-zinc-400"].join(" ")}>
            <Clock className="h-2.5 w-2.5" />
            {parseFloat(t.estimated_hours)}h
          </span>
        ) : null}
      </div>
    </div>
  );
}
