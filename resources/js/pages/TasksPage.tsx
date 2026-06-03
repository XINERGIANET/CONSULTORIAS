import { ListTodo } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { DateInput } from "../components/DateInput";
import { useAuth } from "../context/AuthContext";
import { SmartSelect } from "../components/SmartSelect";
import { FormModal } from "../xpande/FormModal";
import { apiErrorMessage } from "../xpande/apiError";
import type { LaravelPaginated } from "../xpande/http";
import { deleteJson, getJson, postJson, putJson } from "../xpande/http";
import {
  LabCircleIconAction,
  LabDataPager,
  LabNoticeModal,
  LabSortableTh,
} from "../xpande/LabTableKit";
import {
  LabBreadcrumbs,
  LabField,
  LabPageHeader,
  labCrudMainClass,
  labGhostBtn,
  labInputClass,
  labPanelClass,
  labPrimaryBtn,
} from "../xpande/XpandeUi";
import { useApexTheme } from "../context/ThemeContext";

type ProjectOpt = { id: number; name: string };
type UserOpt = { id: number; name: string };
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
type TaskSortCol = "id" | "title" | "due_date" | "start_date" | "status" | "priority" | "created_at";
type StatusFilter = "all" | "pending" | "in_progress" | "finished" | "overdue";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En proceso" },
  { value: "finished", label: "Finalizado" },
  { value: "overdue", label: "Vencido" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En proceso" },
  { value: "finished", label: "Finalizado" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

function statusBadge(row: TaskRow, isLight: boolean) {
  const key = row.is_overdue ? "overdue" : row.status;
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Pendiente",
      cls: isLight
        ? "bg-amber-50 text-amber-700 border border-amber-200"
        : "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    },
    in_progress: {
      label: "En proceso",
      cls: isLight
        ? "bg-blue-50 text-blue-700 border border-blue-200"
        : "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    },
    finished: {
      label: "Finalizado",
      cls: isLight
        ? "bg-green-50 text-green-700 border border-green-200"
        : "bg-green-500/15 text-green-400 border border-green-500/20",
    },
    overdue: {
      label: "Vencido",
      cls: isLight
        ? "bg-red-50 text-red-700 border border-red-200"
        : "bg-red-500/15 text-red-400 border border-red-500/20",
    },
  };
  const { label, cls } = map[key] ?? { label: key, cls: "bg-zinc-500/15 text-zinc-400" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function priorityBadge(priority: string, isLight: boolean) {
  const map: Record<string, { label: string; cls: string }> = {
    low: {
      label: "Baja",
      cls: isLight
        ? "bg-zinc-100 text-zinc-600 border border-zinc-300"
        : "bg-zinc-700/40 text-zinc-400 border border-zinc-600/30",
    },
    medium: {
      label: "Media",
      cls: isLight
        ? "bg-sky-50 text-sky-700 border border-sky-200"
        : "bg-sky-500/15 text-sky-400 border border-sky-500/20",
    },
    high: {
      label: "Alta",
      cls: isLight
        ? "bg-orange-50 text-orange-700 border border-orange-200"
        : "bg-orange-500/15 text-orange-400 border border-orange-500/20",
    },
    critical: {
      label: "Crítica",
      cls: isLight
        ? "bg-red-50 text-red-700 border border-red-200"
        : "bg-red-500/15 text-red-400 border border-red-500/20",
    },
  };
  const { label, cls } = map[priority] ?? { label: priority, cls: "bg-zinc-500/15 text-zinc-400" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

const blankForm = {
  title: "",
  description: "",
  project_id: "" as "" | number,
  assigned_user_id: "" as "" | number,
  start_date: "",
  due_date: "",
  estimated_hours: "",
  status: "pending",
  priority: "medium",
  // Read-only — solo para mostrar en el modal, no se envían al guardar
  started_at: null as string | null,
  finished_at: null as string | null,
};

function fmtDt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function calcDuration(start: string, end: string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs <= 0) return "—";
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function InfoCard({ label, value, isLight, wide }: { label: string; value: string; isLight: boolean; wide?: boolean }) {
  return (
    <div className={["rounded-lg border px-3 py-2", wide ? "col-span-2 sm:col-span-4" : "", isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-white/[0.03]"].join(" ")}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={["mt-0.5 text-xs font-medium", isLight ? "text-[#111827]" : "text-zinc-200"].join(" ")}>{value}</p>
    </div>
  );
}

export function TasksPage() {
  const { isLight } = useApexTheme();
  const [data, setData] = useState<LaravelPaginated<TaskRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);

  const [q, setQ] = useState("");
  const { user, isSuperadmin, hasPermission } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortCol, setSortCol] = useState<TaskSortCol>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [perPage, setPerPage] = useState(30);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(blankForm);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaskRow | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; title: string; message: string } | null>(null);

  const fetchTasks = useCallback(
    async (targetPage: number, nextPer?: number) => {
      const pp = nextPer ?? perPage;
      setRefreshing(true);
      try {
        const res = await getJson<LaravelPaginated<TaskRow>>("/api/tasks", {
          page: targetPage,
          q: q.trim() || undefined,
          sort: sortCol,
          dir: sortDir,
          per_page: pp,
          status: statusFilter !== "all" ? statusFilter : undefined,
          assigned_user_id: !isSuperadmin && user ? user.id : undefined,
        });
        setData(res);
      } finally {
        setRefreshing(false);
      }
    },
    [q, sortCol, sortDir, perPage, statusFilter, user, isSuperadmin],
  );

  useEffect(() => {
    void getJson<LaravelPaginated<ProjectOpt>>("/api/projects", { per_page: 150 }).then((r) => setProjects(r.data));
    void getJson<UserOpt[]>("/api/collaborators").then(setUsers);
  }, []);

  useEffect(() => {
    const delay = q.trim() === "" ? 0 : 260;
    const id = window.setTimeout(() => {
      void fetchTasks(1).catch((e: unknown) => {
        setNotice({ variant: "error", title: "Tareas", message: apiErrorMessage(e, "No se pudo cargar el listado.") });
      });
    }, delay);
    return () => window.clearTimeout(id);
  }, [fetchTasks, q, sortCol, sortDir, perPage, statusFilter]);

  const onSort = (col: TaskSortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "title" || col === "due_date" || col === "start_date" ? "asc" : "desc");
    }
  };
  const sortState = (col: TaskSortCol): "asc" | "desc" | null => (sortCol === col ? sortDir : null);

  const openCreate = () => {
    setEditId(null);
    setForm(blankForm);
    setModalErr(null);
    setOpen(true);
  };

  const openEdit = async (id: number) => {
    setModalErr(null);
    try {
      const t = await getJson<TaskRow>(`/api/tasks/${id}`);
      setEditId(id);
      setForm({
        title: t.title,
        description: t.description ?? "",
        project_id: typeof t.project_id === "number" ? t.project_id : "",
        assigned_user_id: typeof t.assigned_user_id === "number" ? t.assigned_user_id : "",
        start_date: t.start_date ? String(t.start_date).slice(0, 10) : "",
        due_date: t.due_date ? String(t.due_date).slice(0, 10) : "",
        estimated_hours: t.estimated_hours != null ? String(parseFloat(t.estimated_hours)) : "",
        status: t.status,
        priority: t.priority,
        started_at: t.started_at ? String(t.started_at) : null,
        finished_at: t.finished_at ? String(t.finished_at) : null,
      });
      setOpen(true);
    } catch (e: unknown) {
      setNotice({ variant: "error", title: "Tarea", message: apiErrorMessage(e, "No se pudo cargar la tarea.") });
    }
  };

  const close = () => {
    setOpen(false);
    setEditId(null);
    setForm(blankForm);
    setModalErr(null);
  };

  const save = async () => {
    setModalErr(null);
    if (!form.title.trim()) {
      setModalErr("El título es obligatorio.");
      return;
    }
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      project_id: form.project_id === "" ? null : form.project_id,
      assigned_user_id: form.assigned_user_id === "" ? null : form.assigned_user_id,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      status: form.status,
      priority: form.priority,
    };
    try {
      if (editId) await putJson(`/api/tasks/${editId}`, body);
      else await postJson("/api/tasks", body);
      close();
      await fetchTasks(data?.current_page ?? 1);
      setNotice({
        variant: "success",
        title: editId ? "Tarea actualizada" : "Tarea creada",
        message: editId ? "Los cambios se guardaron." : "La tarea quedó registrada.",
      });
    } catch (e: unknown) {
      setModalErr(apiErrorMessage(e, "No se pudo guardar la tarea."));
    }
  };

  const execDelete = async () => {
    if (!pendingDelete) return;
    const row = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteJson(`/api/tasks/${row.id}`);
      await fetchTasks(data?.current_page ?? 1);
      setNotice({ variant: "success", title: "Tarea eliminada", message: `«${row.title}» fue eliminada.` });
    } catch (e: unknown) {
      setNotice({ variant: "error", title: "Error", message: apiErrorMessage(e, "No se pudo eliminar la tarea.") });
    }

  };

  const startTask = async (t: TaskRow) => {
    try {
      await postJson(`/api/tasks/${t.id}/start`, {});
      await fetchTasks(data?.current_page ?? 1);
      setNotice({ variant: "success", title: "Tarea iniciada", message: `«${t.title}» está en proceso.` });
    } catch (e: unknown) {
      setNotice({ variant: "error", title: "Error", message: apiErrorMessage(e, "No se pudo iniciar la tarea.") });
    }
  };

  const finishTask = async (t: TaskRow) => {
    try {
      await postJson(`/api/tasks/${t.id}/finish`, {});
      await fetchTasks(data?.current_page ?? 1);
      setNotice({ variant: "success", title: "Tarea finalizada", message: `«${t.title}» fue marcada como finalizada.` });
    } catch (e: unknown) {
      setNotice({ variant: "error", title: "Error", message: apiErrorMessage(e, "No se pudo finalizar la tarea.") });
    }
  };

  const total = data?.total ?? 0;
  const lastPg = Math.max(1, data?.last_page ?? 1);

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: isSuperadmin ? "Gestión de tareas" : "Mis tareas" }]} isLight={isLight} />
      <LabPageHeader
        title={isSuperadmin ? "Gestión de tareas" : "Mis tareas"}
        subtitle={isSuperadmin ? "Todas las tareas del sistema: asigna, prioriza y da seguimiento por proyecto y encargado." : "Tus tareas asignadas: pendientes, en proceso y finalizadas con fechas límite y proyecto relacionado."}
        isLight={isLight}
        action={
            (isSuperadmin || hasPermission('create_tasks')) ? (
              <button type="button" className={labPrimaryBtn(isLight)} onClick={openCreate}>
                <ListTodo className="h-4 w-4" /> Nueva tarea
              </button>
            ) : null
          }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título, descripción, proyecto o encargado…"
          className={["w-full sm:max-w-md", labInputClass(isLight)].join(" ")}
        />
        <div className={["flex overflow-hidden rounded-lg border text-xs font-medium", isLight ? "border-[#E5E7EB]" : "border-white/[0.08]"].join(" ")}>
          {STATUS_TABS.map(({ value, label }) => {
            const sel = statusFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={["px-3 py-1.5 transition-colors", sel ? "bg-[#007BFF] text-white" : isLight ? "bg-white text-[#6B7280] hover:bg-[#F3F4F6]" : "bg-transparent text-zinc-400 hover:bg-white/[0.05]"].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={labPanelClass(isLight)}>
        {!data ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
        ) : (
          <div className={["overflow-x-auto transition-opacity duration-150", refreshing ? "pointer-events-none opacity-40" : "opacity-100", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table
              className={[
                "w-full min-w-[900px] text-left text-sm",
                isLight ? "[&_tbody_tr:nth-child(even)]:bg-[#F9FAFB]/90" : "[&_tbody_tr:nth-child(even)]:bg-white/[0.02]",
              ].join(" ")}
            >
              <thead>
                <tr className={["align-middle", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                  <LabSortableTh label="Título" sorted={sortState("title")} isLight={isLight} onToggle={() => onSort("title")} />
                  <th className="pr-3 text-left text-xs font-semibold uppercase tracking-wide">Proyecto</th>
                  <th className="pr-3 text-left text-xs font-semibold uppercase tracking-wide">Encargado</th>
                  <LabSortableTh label="Prioridad" sorted={sortState("priority")} isLight={isLight} onToggle={() => onSort("priority")} />
                  <LabSortableTh label="Estado" sorted={sortState("status")} isLight={isLight} onToggle={() => onSort("status")} />
                  <LabSortableTh label="Inicio" sorted={sortState("start_date")} isLight={isLight} onToggle={() => onSort("start_date")} className="w-24 whitespace-nowrap" />
                  <LabSortableTh label="Vence" sorted={sortState("due_date")} isLight={isLight} onToggle={() => onSort("due_date")} className="w-24 whitespace-nowrap" />
                  <th className="pr-3 text-right text-xs font-semibold uppercase tracking-wide w-20">Horas est.</th>
                  <th className="w-[9rem] text-right text-xs font-semibold uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((t) => (
                  <Fragment key={t.id}>
                    <tr className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                      <td className={"py-2.5 pr-4 font-semibold " + (isLight ? "text-[#111827]" : "text-white")}>
                        <span className="line-clamp-1 max-w-[220px]">{t.title}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs">{t.project?.name ?? <span className="text-zinc-500">Sin proyecto</span>}</td>
                      <td className="py-2.5 pr-4 text-xs">{t.assigned_user?.name ?? <span className="text-zinc-500">Sin asignar</span>}</td>
                      <td className="py-2.5 pr-4">{priorityBadge(t.priority, isLight)}</td>
                      <td className="py-2.5 pr-4">{statusBadge(t, isLight)}</td>
                      <td className="py-2.5 pr-4 text-xs whitespace-nowrap">{t.start_date ? String(t.start_date).slice(0, 10) : "—"}</td>
                      <td className={"py-2.5 pr-4 text-xs whitespace-nowrap " + (t.is_overdue ? (isLight ? "font-semibold text-red-600" : "font-semibold text-red-400") : "")}>
                        {t.due_date ? String(t.due_date).slice(0, 10) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-xs tabular-nums">
                        {t.estimated_hours != null ? `${parseFloat(t.estimated_hours)}h` : "—"}
                      </td>
                      <td className="py-2.5 text-right align-middle">
                        <div className="flex justify-end gap-1.5">
                          {t.status === "pending" && (isSuperadmin || hasPermission('edit_tasks') || t.assigned_user_id === user?.id) ? (
                            <LabCircleIconAction variant="start" tooltip="Iniciar tarea" ariaLabel={`Iniciar ${t.title}`} onClick={() => void startTask(t)} />
                          ) : null}
                          {t.status === "in_progress" && (isSuperadmin || hasPermission('edit_tasks') || t.assigned_user_id === user?.id) ? (
                            <LabCircleIconAction variant="finish" tooltip="Finalizar tarea" ariaLabel={`Finalizar ${t.title}`} onClick={() => void finishTask(t)} />
                          ) : null}
                          <LabCircleIconAction variant="details" tooltip={expandedRow === t.id ? "Cerrar historial" : "Ver historial"} ariaLabel={`Historial ${t.title}`} onClick={() => setExpandedRow(expandedRow === t.id ? null : t.id)} />
                          <LabCircleIconAction variant="edit" tooltip="Editar" ariaLabel={`Editar ${t.title}`} onClick={() => void openEdit(t.id)} disabled={!isSuperadmin && !hasPermission('edit_tasks') && t.assigned_user_id !== user?.id} />
                          <LabCircleIconAction variant="cancel" tooltip="Eliminar" ariaLabel={`Eliminar ${t.title}`} onClick={() => setPendingDelete(t)} disabled={!isSuperadmin && !hasPermission('delete_tasks')} />
                        </div>
                      </td>
                    </tr>

                    {expandedRow === t.id ? (
                      <tr className={isLight ? "bg-[#F3F4F6]/60" : "bg-white/[0.015]"}>
                        <td colSpan={9} className="px-5 pb-4 pt-3">

                          {/* Línea de tiempo */}
                          <div className="mb-4 flex items-start">
                            <div className="flex min-w-[90px] flex-col items-center text-center">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-500/20">
                                <div className="h-2 w-2 rounded-full bg-amber-500" />
                              </div>
                              <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-500">Pendiente</span>
                              <span className="text-[10px] text-zinc-500">Creada</span>
                            </div>
                            <div className={["mt-3 h-px flex-1 transition-colors", t.started_at ? "bg-blue-500" : (isLight ? "bg-zinc-300" : "bg-zinc-700")].join(" ")} />
                            <div className="flex min-w-[110px] flex-col items-center text-center">
                              <div className={["flex h-6 w-6 items-center justify-center rounded-full border-2", t.started_at ? "border-blue-500 bg-blue-500/20" : (isLight ? "border-zinc-300 bg-zinc-100" : "border-zinc-700 bg-zinc-800")].join(" ")}>
                                {t.started_at ? <div className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                              </div>
                              <span className={["mt-1 text-[10px] font-bold uppercase tracking-wide", t.started_at ? "text-blue-400" : "text-zinc-500"].join(" ")}>En proceso</span>
                              <span className="text-[10px] text-zinc-500">{t.started_at ? fmtDt(t.started_at) : "—"}</span>
                            </div>
                            <div className={["mt-3 h-px flex-1 transition-colors", t.finished_at ? "bg-emerald-500" : (isLight ? "bg-zinc-300" : "bg-zinc-700")].join(" ")} />
                            <div className="flex min-w-[110px] flex-col items-center text-center">
                              <div className={["flex h-6 w-6 items-center justify-center rounded-full border-2", t.finished_at ? "border-emerald-500 bg-emerald-500/20" : (isLight ? "border-zinc-300 bg-zinc-100" : "border-zinc-700 bg-zinc-800")].join(" ")}>
                                {t.finished_at ? <div className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
                              </div>
                              <span className={["mt-1 text-[10px] font-bold uppercase tracking-wide", t.finished_at ? "text-emerald-400" : "text-zinc-500"].join(" ")}>Finalizado</span>
                              <span className="text-[10px] text-zinc-500">{t.finished_at ? fmtDt(t.finished_at) : "—"}</span>
                            </div>
                          </div>

                          {/* Tarjetas de datos */}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <InfoCard label="Duración real" value={t.started_at && t.finished_at ? calcDuration(t.started_at, t.finished_at) : "—"} isLight={isLight} />
                            <InfoCard label="Horas estimadas" value={t.estimated_hours != null ? `${parseFloat(t.estimated_hours)}h` : "—"} isLight={isLight} />
                            <InfoCard label="Inicio planificado" value={t.start_date ? String(t.start_date).slice(0, 10) : "—"} isLight={isLight} />
                            <InfoCard label="Fecha límite" value={t.due_date ? String(t.due_date).slice(0, 10) : (t.is_overdue ? "Vencida" : "—")} isLight={isLight} />
                            {t.description ? <InfoCard label="Descripción" value={t.description} isLight={isLight} wide /> : null}
                          </div>

                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
                {!data.data.length ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-zinc-500">Sin tareas para este filtro.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        {data ? (
          <LabDataPager
            page={data.current_page}
            lastPage={lastPg}
            total={total}
            perPage={data.per_page}
            isLight={isLight}
            onPerPageChange={(pp) => setPerPage(pp)}
            onPageChange={(pn) =>
              void fetchTasks(pn).catch((e: unknown) => {
                setNotice({ variant: "error", title: "Paginación", message: apiErrorMessage(e, "No se pudieron cargar más filas.") });
              })
            }
          />
        ) : null}
      </div>

      <LabNoticeModal
        open={notice !== null}
        variant={notice?.variant ?? "success"}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        isLight={isLight}
        onClose={() => setNotice(null)}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminar tarea"
        message={pendingDelete ? `¿Confirma eliminar «${pendingDelete.title}»? Esta acción no puede deshacerse.` : ""}
        confirmText="Eliminar"
        danger
        isLight={isLight}
        onConfirm={() => void execDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <FormModal
        open={open}
        title={editId ? "Editar tarea" : "Nueva tarea"}
        isLight={isLight}
        wide
        onClose={close}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={close}>Cerrar</button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void save()}>Guardar</button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Título *" isLight={isLight} className="sm:col-span-2">
            <input
              className={labInputClass(isLight)}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Nombre de la tarea…"
            />
          </LabField>

          <LabField label="Proyecto" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={form.project_id === "" ? "" : String(form.project_id)}
              onChange={(v) => setForm({ ...form, project_id: v ? Number(v) : "" })}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              emptyLabel="Sin proyecto"
            />
          </LabField>

          <LabField label="Encargado" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={form.assigned_user_id === "" ? "" : String(form.assigned_user_id)}
              onChange={(v) => setForm({ ...form, assigned_user_id: v ? Number(v) : "" })}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              emptyLabel="Sin asignar"
            />
          </LabField>

          <LabField label="Prioridad" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={form.priority}
              onChange={(v) => setForm({ ...form, priority: v })}
              options={PRIORITY_OPTIONS}
            />
          </LabField>

          <LabField label="Estado" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={STATUS_OPTIONS}
            />
          </LabField>

          <LabField label="Fecha de inicio" isLight={isLight}>
            <DateInput
              value={form.start_date}
              onChange={(v) => {
                const updates: { start_date: string; due_date?: string } = { start_date: v };
                if (v && form.due_date && form.due_date < v) updates.due_date = "";
                setForm({ ...form, ...updates });
              }}
              className={labInputClass(isLight)}
              isLight={isLight}
            />
          </LabField>

          <LabField label="Fecha límite" isLight={isLight}>
            <DateInput
              value={form.due_date}
              onChange={(v) => setForm({ ...form, due_date: v })}
              className={labInputClass(isLight)}
              isLight={isLight}
              minDate={form.start_date || undefined}
            />
          </LabField>

          <LabField label="Horas estimadas" isLight={isLight} className="sm:col-span-2">
            <input
              type="number"
              min="0"
              step="0.5"
              className={labInputClass(isLight)}
              value={form.estimated_hours}
              onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
              placeholder="Ej: 4.5"
            />
          </LabField>

          {editId ? (
            <LabField label="Registro real de tiempos" isLight={isLight} className="sm:col-span-2">
              <div className={["grid grid-cols-3 gap-3 rounded-lg border p-3 text-xs", isLight ? "border-[#E5E7EB] bg-[#F9FAFB]" : "border-white/[0.06] bg-white/[0.02]"].join(" ")}>
                <div>
                  <div className="mb-1 font-semibold text-zinc-400 uppercase tracking-wide text-[10px]">Iniciada</div>
                  <div className={isLight ? "text-[#111827]" : "text-zinc-200"}>{form.started_at ? fmtDt(form.started_at) : "—"}</div>
                </div>
                <div>
                  <div className="mb-1 font-semibold text-zinc-400 uppercase tracking-wide text-[10px]">Finalizada</div>
                  <div className={isLight ? "text-[#111827]" : "text-zinc-200"}>{form.finished_at ? fmtDt(form.finished_at) : "—"}</div>
                </div>
                <div>
                  <div className="mb-1 font-semibold text-zinc-400 uppercase tracking-wide text-[10px]">Duración real</div>
                  <div className={isLight ? "text-[#111827]" : "text-zinc-200"}>
                    {form.started_at && form.finished_at ? calcDuration(form.started_at, form.finished_at) : "—"}
                  </div>
                </div>
              </div>
            </LabField>
          ) : null}

          <LabField label="Descripción" isLight={isLight} className="sm:col-span-2">
            <textarea
              rows={3}
              className={labInputClass(isLight)}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalle de la tarea…"
            />
          </LabField>

          {modalErr ? <p className="sm:col-span-2 text-sm text-red-600">{modalErr}</p> : null}
        </div>
      </FormModal>
    </main>
  );
}
