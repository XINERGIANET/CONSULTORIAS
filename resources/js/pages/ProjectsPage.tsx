import { Calendar, ExternalLink, FolderKanban, Plus, RefreshCw, RotateCcw, ScrollText, Search, Trash2, UserPlus } from "lucide-react";


import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/ConfirmModal";
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
  LabTooltip,
  circleRowActionClass,
} from "../xpande/LabTableKit";
import {
  LabBreadcrumbs,
  LabField,
  LabPageHeader,
  StatusBadge,
  labCrudMainClass,
  labGhostBtn,
  labInputClass,
  labPanelClass,
  labPrimaryBtn,
} from "../xpande/XpandeUi";
import { useApexTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

type AreaOpt = { id: number; name: string };
type ClientOpt = { id: number; legal_name: string };
type UserOpt = { id: number; name: string };
type ServiceOpt = { id: number; name: string; kind?: string | null; billing_cycle?: string | null; base_price?: string | null };
type ScheduleRow = {
  installment_number: number;
  due_on: string;
  amount: number | string;
  notes: string;
  paid?: boolean;
};

type ProjRow = {
  id: number;
  name: string;
  engagement_type?: string | null;
  status: string;
  created_at?: string;
  client_id?: number;
  budget?: string | null;
  lead_user_id?: number | null;
  service_type?: string | null;
  start_date?: string | null;
  end_estimated?: string | null;
  renewal_date?: string | null;
  description?: string | null;
  objectives?: string | null;
  deliverables?: string | null;
  client?: { legal_name?: string };
  areas?: { id: number; name: string }[];
  users?: { id: number }[];
  services?: ServiceOpt[];
  receivables?: Array<{
    id: number;
    installment_number: number;
    due_on?: string | null;
    projected_due_on?: string | null;
    total_amount: number | string;
    paid_amount: number | string;
    notes?: string | null;
  }>;
};
type ProjSortCol = "id" | "name" | "client" | "status" | "start_date" | "created_at";

const PROJECT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  active: "Activo",
  on_hold: "En espera",
  completed: "Completado",
  cancelled: "Inactivo",
};


const normalizeDateInput = (value?: string | null) => (value ? String(value).slice(0, 10) : "");

const addMonthsToDate = (dateStr: string, months: number): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const addYearsToDate = (dateStr: string, years: number): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
};

const generateDefaultSchedule = (
  startDate: string,
  paymentStartDate: string,
  endDate: string,
  budgetVal: string | number,
  billingType: string,
  installmentsCountVal: string | number
): ScheduleRow[] => {
  const budget = Math.max(0, Number(budgetVal) || 0);
  const start = paymentStartDate || startDate || new Date().toISOString().slice(0, 10);
  const end = endDate || start;

  let count = 1;
  let frequency: "monthly" | "yearly" | "custom" = "monthly";

  if (billingType === "mensual") {
    frequency = "monthly";
    const d1 = new Date(start + "T00:00:00");
    const d2 = new Date(end + "T00:00:00");
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      count = Math.max(1, months + 1);
    } else {
      count = 1;
    }
  } else if (billingType === "anual") {
    frequency = "yearly";
    const d1 = new Date(start + "T00:00:00");
    const d2 = new Date(end + "T00:00:00");
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      count = Math.max(1, d2.getFullYear() - d1.getFullYear() + 1);
    } else {
      count = 1;
    }
  } else if (billingType === "único") {
    count = 1;
  } else if (billingType === "por partes") {
    count = Math.max(1, Number(installmentsCountVal) || 2);
  }

  const baseAmount = Math.round((budget / count) * 100) / 100;
  const rows: ScheduleRow[] = [];

  for (let i = 0; i < count; i++) {
    let due = start;
    if (billingType === "por partes" && count > 1) {
      const d1 = new Date(start + "T00:00:00").getTime();
      const d2 = new Date(end + "T00:00:00").getTime();
      if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
        const step = (d2 - d1) / (count - 1);
        const t = new Date(d1 + step * i);
        due = t.toISOString().slice(0, 10);
      } else {
        due = addMonthsToDate(start, i);
      }
    } else if (frequency === "yearly") {
      due = addYearsToDate(start, i);
    } else {
      due = addMonthsToDate(start, i);
    }

    const amt = i === count - 1 ? Math.round((budget - baseAmount * (count - 1)) * 100) / 100 : baseAmount;

    rows.push({
      installment_number: i + 1,
      due_on: due,
      amount: Math.max(0, amt),
      notes: count === 1 ? "Pago único" : `Cuota ${i + 1}/${count}`,
    });
  }

  return rows;
};


export function ProjectsPage() {
  const { isLight } = useApexTheme();
  const { user, isSuperadmin } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const primaryAreaId = user?.area_ids?.[0] ?? "";
  const defaultAreaIds = useMemo(() => (isSuperadmin ? [] : user?.area_ids?.slice(0, 1) ?? []), [isSuperadmin, user?.area_ids]);

  const [data, setData] = useState<LaravelPaginated<ProjRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const scopedAreas = isSuperadmin ? areas : areas.filter((a) => user?.area_ids?.includes(a.id));
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortCol, setSortCol] = useState<ProjSortCol>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [perPage, setPerPage] = useState(30);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; title: string; message: string } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<ProjRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjRow | null>(null);
  const [pendingRestore, setPendingRestore] = useState<ProjRow | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const [saving, setSaving] = useState(false);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [isScheduleCustomized, setIsScheduleCustomized] = useState(false);


  const [form, setForm] = useState({
    client_id: "" as "" | number,
    engagement_type: "project",
    name: "",
    service_type: "",
    start_date: "",
    payment_start_date: "",
    end_estimated: "",
    status: "pending",
    renewal_date: "",
    budget: "",
    billing_type: "mensual",
    installments_count: "2",
    lead_user_id: "" as "" | number,
    description: "",
    objectives: "",
    deliverables: "",
    area_ids: defaultAreaIds as number[],
    user_ids: [] as number[],
    service_ids: [] as number[],
  });

  const [clientHistory, setClientHistory] = useState<any[]>([]);

  useEffect(() => {
    if (form.client_id) {
      void getJson<{ projects?: any[] }>(`/api/clients/${form.client_id}`)
        .then((res) => {
          setClientHistory(res.projects ?? []);
        })
        .catch(() => setClientHistory([]));
    } else {
      setClientHistory([]);
    }
  }, [form.client_id]);

  useEffect(() => {
    if (open && !isScheduleCustomized) {
      const generated = generateDefaultSchedule(
        form.start_date,
        form.payment_start_date,
        form.end_estimated,
        form.budget,
        form.billing_type,
        form.installments_count
      );
      setScheduleRows(generated);
    }
  }, [
    open,
    isScheduleCustomized,
    form.start_date,
    form.payment_start_date,
    form.end_estimated,
    form.budget,
    form.billing_type,
    form.installments_count,
  ]);

  const handleRecalculateSchedule = () => {
    const generated = generateDefaultSchedule(
      form.start_date,
      form.payment_start_date,
      form.end_estimated,
      form.budget,
      form.billing_type,
      form.installments_count
    );
    setScheduleRows(generated);
    setIsScheduleCustomized(false);
  };

  const handleBalanceLastInstallment = () => {
    if (!scheduleRows.length) return;
    const budgetNum = Number(form.budget) || 0;
    const previousSum = scheduleRows.slice(0, -1).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const lastAmount = Math.max(0, Math.round((budgetNum - previousSum) * 100) / 100);
    setScheduleRows((rows) =>
      rows.map((r, i) => (i === rows.length - 1 ? { ...r, amount: lastAmount } : r))
    );
  };

  const handleAddScheduleRow = () => {
    setIsScheduleCustomized(true);
    setScheduleRows((rows) => {
      const lastRow = rows[rows.length - 1];
      const newDue = lastRow
        ? addMonthsToDate(lastRow.due_on, 1)
        : form.payment_start_date || form.start_date || new Date().toISOString().slice(0, 10);
      return [
        ...rows,
        {
          installment_number: rows.length + 1,
          due_on: newDue,
          amount: 0,
          notes: `Cuota ${rows.length + 1}`,
        },
      ];
    });
  };

  const handleRemoveScheduleRow = (index: number) => {
    if (scheduleRows.length <= 1) return;
    setIsScheduleCustomized(true);
    setScheduleRows((rows) =>
      rows
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, installment_number: i + 1 }))
    );
  };

  const handleUpdateScheduleRow = (index: number, field: keyof ScheduleRow, value: any) => {
    setIsScheduleCustomized(true);
    setScheduleRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const fetchProjects = useCallback(
    async (targetPage: number, nextPer?: number) => {
      const pp = nextPer ?? perPage;
      setRefreshing(true);
      try {
        const res = await getJson<LaravelPaginated<ProjRow>>("/api/projects", {
          page: targetPage,
          q: q.trim() || undefined,
          sort: sortCol,
          dir: sortDir,
          per_page: pp,
          status_group: statusFilter !== "all" ? statusFilter : undefined,
          show_deleted: showDeleted ? true : undefined,
        });
        setData(res);
        setPage(res.current_page);
      } finally {
        setRefreshing(false);
      }
    },
    [q, sortCol, sortDir, perPage, statusFilter, showDeleted],
  );


  useEffect(() => {
    void getJson<LaravelPaginated<ClientOpt>>("/api/clients", { per_page: 150 }).then((r) => setClients(r.data));
    void getJson<AreaOpt[]>("/api/areas", { active_only: false }).then(setAreas);
    void getJson<UserOpt[]>("/api/collaborators").then(setUsers);
    void getJson<ServiceOpt[]>("/api/catalog/services", { active_only: false }).then(setServices);
  }, []);

  useEffect(() => {
    const delay = q.trim() === "" ? 0 : 260;
    const id = window.setTimeout(() => {
      void fetchProjects(1).catch((e: unknown) => {
        setNotice({ variant: "error", title: "Proyectos", message: apiErrorMessage(e, "No se pudo cargar el listado.") });
      });
    }, delay);
    return () => window.clearTimeout(id);
  }, [fetchProjects, q, sortCol, sortDir, perPage]);

  useEffect(() => {
    const st = loc.state as { openProjectCreate?: boolean } | undefined;
    if (st?.openProjectCreate) {
      setEditId(null);
      setIsScheduleCustomized(false);
      setForm({
        client_id: "",
        engagement_type: "project",
        name: "",
        service_type: "",
        start_date: "",
        payment_start_date: "",
        end_estimated: "",
        status: "pending",
        renewal_date: "",
        budget: "",
        billing_type: "mensual",
        installments_count: "2",
        lead_user_id: "",
        description: "",
        objectives: "",
        deliverables: "",
        area_ids: defaultAreaIds,
        user_ids: [],
        service_ids: [],
      });
      setOpen(true);
      navigate(loc.pathname, { replace: true, state: {} });
    }
  }, [defaultAreaIds, loc.pathname, loc.state, navigate]);

  const toggleArea = (id: number) => {
    if (!isSuperadmin) return;
    void setForm((f) => ({ ...f, area_ids: f.area_ids.includes(id) ? f.area_ids.filter((x) => x !== id) : [...f.area_ids, id] }));
  };
  const toggleUser = (id: number) =>
    void setForm((f) => ({ ...f, user_ids: f.user_ids.includes(id) ? f.user_ids.filter((x) => x !== id) : [...f.user_ids, id] }));

  const toggleService = (id: number) =>
    void setForm((f) => ({ ...f, service_ids: f.service_ids.includes(id) ? f.service_ids.filter((x) => x !== id) : [...f.service_ids, id] }));

  const onSortHeader = (col: ProjSortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "name" || col === "client" || col === "start_date" ? "asc" : "desc");
    }
  };

  const sortState = (col: ProjSortCol): "asc" | "desc" | null => (sortCol === col ? sortDir : null);

  const openEdit = async (id: number) => {
    setModalErr(null);
    try {
      const p = await getJson<ProjRow>(`/api/projects/${id}`);
      setEditId(id);
      const aid = (p.areas ?? []).map((a) => a.id);
      setForm({
        client_id: typeof p.client_id === "number" ? p.client_id : "",
        engagement_type: p.engagement_type ?? "project",
        name: p.name,
        service_type: p.service_type ?? "",
        start_date: normalizeDateInput(p.start_date),
        payment_start_date: normalizeDateInput((p as any).payment_start_date),
        end_estimated: normalizeDateInput(p.end_estimated),
        status: p.status,
        renewal_date: normalizeDateInput(p.renewal_date),
        budget: p.budget ?? "",
        billing_type: (p as any).billing_type ?? "mensual",
        installments_count: "2",
        lead_user_id: p.lead_user_id ?? "",
        description: p.description ?? "",
        objectives: p.objectives ?? "",
        deliverables: p.deliverables ?? "",
        area_ids: aid.length ? aid : [],
        user_ids: (p.users ?? []).map((u) => u.id),
        service_ids: (p.services ?? []).map((s) => s.id),
      });

      if (p.receivables && p.receivables.length > 0) {
        const recRows: ScheduleRow[] = p.receivables.map((r, idx) => ({
          installment_number: r.installment_number ?? idx + 1,
          due_on: normalizeDateInput(r.due_on || r.projected_due_on),
          amount: Number(r.total_amount) || 0,
          notes: r.notes ?? `Cuota ${idx + 1}`,
          paid: (Number(r.paid_amount) || 0) > 0,
        }));
        setScheduleRows(recRows);
        setIsScheduleCustomized(true);
      } else {
        const generated = generateDefaultSchedule(
          normalizeDateInput(p.start_date),
          normalizeDateInput((p as any).payment_start_date),
          normalizeDateInput(p.end_estimated),
          p.budget ?? "",
          (p as any).billing_type ?? "mensual",
          "2"
        );
        setScheduleRows(generated);
        setIsScheduleCustomized(false);
      }

      setOpen(true);
    } catch (e: unknown) {
      setNotice({ variant: "error", title: "Proyecto", message: apiErrorMessage(e, "No se pudo cargar el proyecto.") });
    }
  };

  const save = async () => {
    if (saving) return;
    setModalErr(null);

    if (!form.name.trim() || form.client_id === "" || form.area_ids.length === 0) {
      setModalErr("Nombre, cliente y al menos un área son obligatorios.");
      return;
    }
    if (!editId && (!form.start_date || !form.end_estimated || !form.budget || Number(form.budget) <= 0)) {
      setModalErr("Inicio, fin estimado y presupuesto son obligatorios para generar las cuentas por cobrar.");
      return;
    }
    if (form.start_date && form.end_estimated && form.end_estimated < form.start_date) {
      setModalErr("La fecha de fin estimado no puede ser anterior a la fecha de inicio.");
      return;
    }

    const schedTotal = scheduleRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const budgetNum = Number(form.budget) || 0;
    if (Math.abs(schedTotal - budgetNum) > 0.05 && scheduleRows.length > 0) {
      setModalErr(
        `La suma de las cuotas del cronograma (S/ ${schedTotal.toFixed(2)}) no coincide con el presupuesto del proyecto (S/ ${budgetNum.toFixed(2)}). Presione "Ajustar al presupuesto" o corrija los montos.`
      );
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        client_id: form.client_id,
        engagement_type: form.engagement_type,
        name: form.name.trim(),
        service_type: form.service_type || null,
        start_date: form.start_date || null,
        payment_start_date: form.payment_start_date || null,
        end_estimated: form.end_estimated || null,
        status: form.status,
        renewal_date: form.engagement_type === "saas" ? form.renewal_date || null : null,
        budget: form.budget ? Number(form.budget) : null,
        billing_type: form.billing_type || null,
        installments_count: form.billing_type === "por partes" ? Number(form.installments_count) || 2 : null,
        lead_user_id: form.lead_user_id === "" ? null : form.lead_user_id,
        description: form.description || null,
        objectives: form.objectives || null,
        deliverables: form.deliverables || null,
        area_ids: form.area_ids,
        user_ids: form.user_ids,
        service_ids: form.service_ids,
        custom_schedule: scheduleRows.map((r, i) => ({
          installment_number: i + 1,
          due_on: r.due_on,
          amount: Number(r.amount) || 0,
          notes: r.notes || null,
        })),
      };
      if (editId) await putJson(`/api/projects/${editId}`, body);
      else await postJson("/api/projects", body);

      setOpen(false);
      await fetchProjects(page);
      setNotice({
        variant: "success",
        title: editId ? "Proyecto actualizado" : "Proyecto creado",
        message: editId ? "Los cambios se guardaron." : "El proyecto quedó registrado en el portafolio.",
      });
      setEditId(null);
    } catch (e: unknown) {
      const errMsg = apiErrorMessage(e, "No se pudo guardar el proyecto.");
      setModalErr(errMsg);
      setNotice({
        variant: "error",
        title: "No se guardó",
        message: errMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  const execCancelProj = async () => {
    if (!pendingCancel) return;
    const row = pendingCancel;
    const title = row.name;
    setPendingCancel(null);
    try {
      const res = await deleteJson<{ message?: string }>(`/api/projects/${row.id}`);
      await fetchProjects(page);
      setNotice({
        variant: "success",
        title: "Proyecto inactivado",
        message: res.message ?? `«${title}» se inactivó y sus cuentas por cobrar/pagar pendientes se anularon.`,
      });
    } catch (e: unknown) {
      setNotice({ variant: "error", title: "Error", message: apiErrorMessage(e, "No se pudo inactivar el proyecto.") });
    }
  };

  const execDeleteCancelledProj = async () => {
    if (!pendingDelete) return;
    const row = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteJson(`/api/projects/${row.id}`);
      await fetchProjects(page);
      setNotice({
        variant: "success",
        title: "Proyecto eliminado",
        message: `«${row.name}» fue eliminado correctamente del sistema.`,
      });
    } catch (e: unknown) {
      setNotice({ variant: "error", title: "Error", message: apiErrorMessage(e, "No se pudo eliminar el proyecto.") });
    }
  };

  const execRestoreProj = async () => {
    if (!pendingRestore) return;
    const row = pendingRestore;
    setPendingRestore(null);
    try {
      await postJson(`/api/projects/${row.id}/restore`, {});
      await fetchProjects(page);
      setNotice({
        variant: "success",
        title: "Proyecto restaurado",
        message: `«${row.name}» fue restaurado a estado Inactivo.`,
      });
    } catch (e: unknown) {
      setNotice({ variant: "error", title: "Error", message: apiErrorMessage(e, "No se pudo restaurar el proyecto.") });
    }
  };



  const total = data?.total ?? 0;
  const lastPg = Math.max(1, data?.last_page ?? 1);

  // --- Modal nuevo cliente ---
  const emptyClientForm = () => ({
    legal_name: "",
    trade_name: "",
    ruc: "",
    dni: "",
    address: "",
    rubro: "",
    pipeline_stage: "lead",
    area_id: isSuperadmin ? "" : primaryAreaId,
    presentation_date: "",
    tentative_response_date: "",
    representative_name: "",
    representative_phone: "",
    representative_position: "",
    representative_email: "",
    representative_observations: "",
  });

  const [clientModal, setClientModal] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClientForm());
  const [clientErr, setClientErr] = useState<string | null>(null);
  const [searchingRuc, setSearchingRuc] = useState(false);
  const [searchingDni, setSearchingDni] = useState(false);

  const openClientModal = () => {
    setClientForm(emptyClientForm());
    setClientErr(null);
    setClientModal(true);
  };

  const performRucSearch = async () => {
    if (!clientForm.ruc || clientForm.ruc.length !== 11) {
      setClientErr("Ingrese un RUC válido de 11 dígitos.");
      return;
    }
    setSearchingRuc(true);
    setClientErr(null);
    try {
      const res = await getJson<Record<string, unknown>>(`/api/clients/search-ruc/${clientForm.ruc}`);
      const info = (res?.resultado ?? res?.data ?? res) as Record<string, unknown>;
      if (info?.razon_social) {
        setClientForm((f) => ({
          ...f,
          legal_name: String(info.razon_social),
          trade_name: info.nombre_comercial && String(info.nombre_comercial) !== "-" ? String(info.nombre_comercial) : String(info.razon_social),
          address: info.direccion ? String(info.direccion) : f.address,
        }));
      } else {
        setClientErr("No se encontraron datos para ese RUC.");
      }
    } catch {
      setClientErr("Error al consultar el RUC.");
    } finally {
      setSearchingRuc(false);
    }
  };

  const performDniSearch = async () => {
    if (!clientForm.dni || clientForm.dni.length !== 8) {
      setClientErr("Ingrese un DNI válido de 8 dígitos.");
      return;
    }
    setSearchingDni(true);
    setClientErr(null);
    try {
      const res = await getJson<Record<string, unknown>>(`/api/clients/search-dni/${clientForm.dni}`);
      const info = (res?.resultado ?? res?.data ?? res) as Record<string, unknown>;
      if (info?.nombres || info?.apellido_paterno) {
        const nombres = [info.nombres, info.apellido_paterno, info.apellido_materno].filter(Boolean).join(" ");
        setClientForm((f) => ({
          ...f,
          legal_name: nombres,
          trade_name: f.trade_name || nombres,
        }));
      } else if (info?.nombre_completo) {
        setClientForm((f) => ({
          ...f,
          legal_name: String(info.nombre_completo),
          trade_name: f.trade_name || String(info.nombre_completo),
        }));
      } else {
        setClientErr("No se encontraron datos para ese DNI.");
      }
    } catch {
      setClientErr("Error al consultar el DNI.");
    } finally {
      setSearchingDni(false);
    }
  };

  const saveNewClient = async () => {
    setClientErr(null);
    if (!clientForm.legal_name.trim()) {
      setClientErr("La razón social es obligatoria.");
      return;
    }
    if (clientForm.representative_name.trim() && (!clientForm.representative_position.trim() || !clientForm.representative_phone.trim())) {
      setClientErr("El cargo y el teléfono del representante son obligatorios.");
      return;
    }
    try {
      const saved = await postJson<{ id: number; legal_name: string }>("/api/clients", {
        legal_name: clientForm.legal_name,
        trade_name: clientForm.trade_name || null,
        ruc: clientForm.ruc || null,
        address: clientForm.address || null,
        rubro: clientForm.rubro || null,
        area_id: isSuperadmin ? clientForm.area_id : primaryAreaId,
        pipeline_stage: clientForm.pipeline_stage,
        presentation_date: clientForm.pipeline_stage === "prospect" ? clientForm.presentation_date || null : null,
        tentative_response_date: clientForm.pipeline_stage === "prospect" ? clientForm.tentative_response_date || null : null,
      });
      if (clientForm.representative_name.trim()) {
        await postJson(`/api/clients/${saved.id}/contacts`, {
          name: clientForm.representative_name.trim(),
          position: clientForm.representative_position.trim() || null,
          phone: clientForm.representative_phone.trim() || null,
          email: clientForm.representative_email.trim() || null,
          observations: clientForm.representative_observations.trim() || null,
        });
      }
      setClients((prev) => [{ id: saved.id, legal_name: saved.legal_name }, ...prev]);
      setForm((f) => ({ ...f, client_id: saved.id }));
      setClientModal(false);
    } catch {
      setClientErr("No se pudo guardar el cliente.");
    }
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Proyectos" }]} isLight={isLight} />
      <LabPageHeader
        title="Portafolio de proyectos y SaaS"
        subtitle="Búsqueda, ordenamiento y paginación en servidor."
        isLight={isLight}
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => {
            setEditId(null);
            setModalErr(null);
            setForm({
              client_id: "",
              engagement_type: "project",
              name: "",
              service_type: "",
              start_date: "",
              payment_start_date: "",
              end_estimated: "",
              status: "pending",
              renewal_date: "",
              budget: "",
              billing_type: "mensual",
              installments_count: "2",
              lead_user_id: "",
              description: "",
              objectives: "",
              deliverables: "",
              area_ids: defaultAreaIds,
              user_ids: [],
              service_ids: [],
            });
            setOpen(true);
          }}>
            <FolderKanban className="h-4 w-4" /> Nuevo registro
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por proyecto, cliente o tipo de servicio…"
          className={["w-full sm:max-w-md", labInputClass(isLight)].join(" ")}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDeleted(!showDeleted)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              showDeleted
                ? "border-red-500 bg-red-600 text-white shadow-sm"
                : isLight
                ? "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]"
                : "border-white/[0.08] bg-transparent text-zinc-300 hover:bg-white/[0.05]"
            }`}
            title="Ver proyectos eliminados"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{showDeleted ? "Viendo Eliminados (Volver)" : "Ver eliminados"}</span>
          </button>

          <div className={["flex overflow-hidden rounded-lg border text-xs font-medium", isLight ? "border-[#E5E7EB]" : "border-white/[0.08]"].join(" ")}>
            {(["all", "active", "inactive"] as const).map((f) => {
              const label = { all: "Todos", active: "Activos", inactive: "Inactivos" }[f];
              const sel = statusFilter === f && !showDeleted;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setShowDeleted(false);
                    setStatusFilter(f);
                  }}
                  className={["px-3 py-1.5 transition-colors", sel ? "bg-primary-theme text-white" : isLight ? "bg-white text-[#6B7280] hover:bg-[#F3F4F6]" : "bg-transparent text-zinc-400 hover:bg-white/[0.05]"].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showDeleted ? (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-50/40 dark:bg-red-950/30 p-3 text-xs text-red-900 dark:text-red-200">
          <div className="flex items-center gap-2 font-semibold">
            <Trash2 className="h-4 w-4 text-red-500" />
            <span>Mostrando proyectos eliminados</span>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleted(false)}
            className="font-bold text-red-600 underline hover:text-red-800 dark:text-red-400"
          >
            Volver a lista principal
          </button>
        </div>
      ) : null}

      <div className={labPanelClass(isLight)}>
        {!data ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
        ) : (
          <div className={["overflow-x-auto transition-opacity duration-150", refreshing ? "pointer-events-none opacity-40" : "opacity-100", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table
              className={[
                "w-full min-w-[760px] text-left text-sm",
                isLight ? "[&_tbody_tr:nth-child(even)]:bg-[#F9FAFB]/90" : "[&_tbody_tr:nth-child(even)]:bg-white/[0.02]",
              ].join(" ")}
            >
              <thead>
                <tr className={["align-middle", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                  <LabSortableTh label="Proyecto" sorted={sortState("name")} isLight={isLight} onToggle={() => onSortHeader("name")} />
                  <LabSortableTh label="Cliente" sorted={sortState("client")} isLight={isLight} onToggle={() => onSortHeader("client")} />
                  <th className="pr-3 text-left text-xs font-semibold uppercase tracking-wide">Tipo</th>
                  <th className="pr-3 text-left text-xs font-semibold uppercase tracking-wide">Productos</th>
                  <th className="pr-3 text-left text-xs font-semibold uppercase tracking-wide">Áreas</th>
                  <LabSortableTh label="Estado" sorted={sortState("status")} isLight={isLight} onToggle={() => onSortHeader("status")} />
                  <LabSortableTh
                    label="Inicio"
                    sorted={sortState("start_date")}
                    isLight={isLight}
                    onToggle={() => onSortHeader("start_date")}
                    className="w-28 whitespace-nowrap"
                  />
                  <LabSortableTh
                    label="Alta"
                    sorted={sortState("created_at")}
                    isLight={isLight}
                    onToggle={() => onSortHeader("created_at")}
                    className="w-28 whitespace-nowrap"
                  />
                  <th className="w-[6.5rem] text-right text-xs font-semibold uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                    <td className={"py-2.5 pr-4 font-semibold " + (isLight ? "text-[#111827]" : "text-white")}>{p.name}</td>
                    <td className="py-2.5 pr-4 text-xs">{p.client?.legal_name ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-xs uppercase">{p.engagement_type === "saas" ? "SaaS" : "Proyecto"}</td>
                    <td className="py-2.5 pr-4 text-xs">{(p.services ?? []).map((x) => x.name).join(", ") || "Sin productos"}</td>
                    <td className="py-2.5 pr-4 text-xs">{(p.areas ?? []).map((x) => x.name).join(", ")}</td>
                    <td className="py-2.5 pr-4 text-xs"><StatusBadge status={p.status} /></td>
                    <td className="py-2.5 pr-4 text-xs whitespace-nowrap">{p.start_date ? String(p.start_date).slice(0, 10) : "—"}</td>
                    <td className="py-2.5 pr-4 text-xs whitespace-nowrap">{p.created_at ? String(p.created_at).slice(0, 10) : "—"}</td>
                    <td className="py-2.5 text-right align-middle">
                      <div className="flex justify-end gap-2">
                        <LabCircleIconAction variant="edit" tooltip="Editar" ariaLabel={`Editar ${p.name}`} onClick={() => void openEdit(p.id)} />
                        <span className="group relative inline-flex">
                          <Link
                            to={`/contratos?project_id=${p.id}`}
                            className={[circleRowActionClass("link"), "inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700"].join(" ")}
                          >
                            <ScrollText className="h-3.5 w-3.5 text-white" strokeWidth={2.25} aria-hidden />
                            <span className="sr-only">Contratos</span>
                          </Link>
                          <span className="pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-50 hidden whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium leading-tight text-white shadow-lg ring-1 ring-black/40 group-hover:block">
                            Contratos
                          </span>
                        </span>
                        {typeof p.client_id === "number" ? (
                          <span className="group relative inline-flex">
                            <Link
                              to={`/clientes/${p.client_id}`}
                              className={[circleRowActionClass("link"), "inline-flex items-center justify-center"].join(" ")}
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-white" strokeWidth={2.25} aria-hidden />
                              <span className="sr-only">Cliente CRM</span>
                            </Link>
                            <span className="pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-50 hidden whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium leading-tight text-white shadow-lg ring-1 ring-black/40 group-hover:block">
                              Cliente CRM
                            </span>
                          </span>
                        ) : null}

                        {p.status === "cancelled" ? (
                          <LabCircleIconAction
                            variant="delete"
                            tooltip="Eliminar proyecto inactivo"
                            ariaLabel={`Eliminar ${p.name}`}
                            onClick={() => setPendingDelete(p)}
                          />
                        ) : p.status === "deleted" ? (
                          <LabTooltip text="Restaurar proyecto">
                            <button
                              type="button"
                              onClick={() => setPendingRestore(p)}
                              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                            </button>
                          </LabTooltip>
                        ) : (
                          <LabCircleIconAction
                            variant="cancel"
                            tooltip="Inactivar proyecto"
                            ariaLabel={`Inactivar ${p.name}`}
                            onClick={() => setPendingCancel(p)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
            onPerPageChange={(pp) => {
              setPerPage(pp);
            }}
            onPageChange={(pn) =>
              void fetchProjects(pn).catch((e: unknown) => {
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
        open={pendingCancel !== null}
        title="Inactivar proyecto"
        message={
          pendingCancel
            ? `¿Confirma inactivar «${pendingCancel.name}»? El proyecto no se borra del sistema, queda marcado como "Inactivo" y sus cuentas por cobrar/pagar pendientes se anulan (lo ya cobrado/pagado se conserva).`
            : ""
        }
        confirmText="Inactivar proyecto"
        danger
        isLight={isLight}
        onConfirm={() => void execCancelProj()}
        onCancel={() => setPendingCancel(null)}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminar proyecto inactivo"
        message={
          pendingDelete
            ? `¿Confirma eliminar definitivamente el proyecto inactivo «${pendingDelete.name}»? Podrás volver a verlo o restaurarlo en la sección "Ver eliminados".`
            : ""
        }
        confirmText="Eliminar proyecto"
        danger
        isLight={isLight}
        onConfirm={() => void execDeleteCancelledProj()}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmModal
        open={pendingRestore !== null}
        title="Restaurar proyecto"
        message={
          pendingRestore
            ? `¿Confirma restaurar el proyecto «${pendingRestore.name}»? Volverá a la lista en estado Inactivo.`
            : ""
        }
        confirmText="Restaurar proyecto"
        isLight={isLight}
        onConfirm={() => void execRestoreProj()}
        onCancel={() => setPendingRestore(null)}
      />



      <FormModal
        open={open}
        title={editId ? "Editar registro" : "Nuevo registro"}
        isLight={isLight}
        wide
        onClose={() => {setOpen(false); setModalErr(null);}}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setOpen(false)}>
              Cerrar
            </button>
            <button
              type="button"
              disabled={saving}
              className={[labPrimaryBtn(isLight), saving ? "opacity-50 cursor-not-allowed" : ""].join(" ")}
              onClick={() => void save()}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Cliente *" isLight={isLight} className="sm:col-span-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <SmartSelect
                  isLight={isLight}
                  value={form.client_id === "" ? "" : String(form.client_id)}
                  onChange={(v) => setForm({ ...form, client_id: v ? Number(v) : "" })}
                  options={clients.map((c) => ({ value: c.id, label: c.legal_name }))}
                  emptyLabel="Seleccionar…"
                />
              </div>
              <button
                type="button"
                onClick={openClientModal}
                className={labPrimaryBtn(isLight) + " flex items-center gap-1 whitespace-nowrap px-3"}
                title="Buscar o agregar nuevo cliente"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>
            </div>
          </LabField>
          {form.client_id ? (
            <div className="sm:col-span-2">
              <span className={["block text-[11px] font-semibold uppercase tracking-wider mb-1", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
                Historial de Proyectos / Servicios del Cliente (Marcas autorizadas)
              </span>
              <div className={["max-h-36 overflow-y-auto rounded-lg border p-3 text-xs space-y-2", isLight ? "border-[#E5E7EB] bg-[#F9FAFB]/60" : "border-white/[0.06] bg-[#0a0a0a]/40"].join(" ")}>
                {clientHistory.map((h: any) => (
                  <div key={h.id} className={["flex justify-between items-center py-1.5 border-b last:border-b-0", isLight ? "border-[#E5E7EB]" : "border-white/[0.04]"].join(" ")}>
                    <div>
                      <span className={["font-semibold", isLight ? "text-[#374151]" : "text-zinc-300"].join(" ")}>{h.name}</span>
                      <span className="ml-2 text-[10px] uppercase text-zinc-500">({h.engagement_type === "saas" ? "SaaS" : "Proyecto"})</span>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        Marcas/Áreas: {(h.areas ?? []).map((a: any) => a.name).join(", ") || "Ninguna"}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={["font-semibold", isLight ? "text-[#111827]" : "text-zinc-200"].join(" ")}>S/. {h.budget ?? 0}</span>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {PROJECT_STATUS_LABELS[h.status] ?? h.status}
                      </div>
                    </div>
                  </div>
                ))}
                {!clientHistory.length ? (
                  <p className="text-zinc-500 italic text-center py-2">Sin historial de proyectos asignados.</p>
                ) : null}
              </div>
            </div>
          ) : null}
          <LabField label="Nombre *" isLight={isLight} className="sm:col-span-2">
            <input className={labInputClass(isLight)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </LabField>
          <LabField label="Tipo de registro" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={form.engagement_type}
              onChange={(v) => setForm({ ...form, engagement_type: v })}
              options={[
                { value: "project", label: "Proyecto / servicio" },
                { value: "saas", label: "Afiliacion SaaS" },
                { value: "retainer", label: "Bolsa recurrente" },
              ]}
            />
          </LabField>
          <LabField label="Estado" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={[
                { value: "pending", label: "Pendiente" },
                { value: "in_progress", label: "En proceso" },
                { value: "paused", label: "Pausado" },
                { value: "finished", label: "Finalizado" },
                { value: "cancelled", label: "Inactivo" },

              ]}
            />
          </LabField>
          <LabField label="Inicio *" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </LabField>
          <LabField label="Fin estimado *" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={form.end_estimated} onChange={(e) => setForm({ ...form, end_estimated: e.target.value })} />
          </LabField>
          {form.engagement_type === "saas" ? (
            <LabField label="Renovacion" isLight={isLight}>
              <input type="date" className={labInputClass(isLight)} value={form.renewal_date} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} />
            </LabField>
          ) : null}
          <LabField label="Monto del servicio *" isLight={isLight}>
            <input type="number" step="0.01" className={labInputClass(isLight)} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </LabField>
          <LabField label="Inicio de Pago" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={form.payment_start_date} onChange={(e) => setForm({ ...form, payment_start_date: e.target.value })} />
          </LabField>
          <LabField label="Tipo de cobranza" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={form.billing_type}
              onChange={(v) => setForm({ ...form, billing_type: v })}
              options={[
                { value: "mensual", label: "Mensual" },
                { value: "anual", label: "Anual" },
                { value: "único", label: "Único" },
                { value: "por partes", label: "Por partes" },
              ]}
            />
          </LabField>
          {form.billing_type === "por partes" ? (
            <LabField label="Número de partes (cuotas)" isLight={isLight}>
              <input type="number" min="1" className={labInputClass(isLight)} value={form.installments_count} onChange={(e) => setForm({ ...form, installments_count: e.target.value })} />
            </LabField>
          ) : null}

          {/* --- CRONOGRAMA DE PAGOS PERSONALIZABLE --- */}
          <div className="sm:col-span-2 mt-2 rounded-xl border p-4 shadow-sm bg-opacity-50 space-y-3 border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-500/20 pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <span className={["font-bold text-xs uppercase tracking-wide", isLight ? "text-indigo-900" : "text-indigo-200"].join(" ")}>
                  Cronograma de Pagos (Cuentas por Cobrar)
                </span>
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-500">
                  {scheduleRows.length} {scheduleRows.length === 1 ? "cuota" : "cuotas"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRecalculateSchedule}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                  title="Recalcular partes y fechas por igual según los datos del proyecto"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Recalcular partes iguales</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddScheduleRow}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus className="h-3 w-3" />
                  <span>Agregar Cuota</span>
                </button>
              </div>
            </div>

            {/* Tabla de cuotas */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={["border-b text-[10px] uppercase font-semibold tracking-wider", isLight ? "border-zinc-200 text-zinc-500" : "border-white/10 text-zinc-400"].join(" ")}>
                    <th className="py-1.5 pr-2 w-16"># Cuota</th>
                    <th className="py-1.5 pr-2 w-36">Vencimiento</th>
                    <th className="py-1.5 pr-2 w-36">Monto (S/)</th>
                    <th className="py-1.5 pr-2">Concepto / Notas</th>
                    <th className="py-1.5 text-right w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/50 dark:divide-white/5">
                  {scheduleRows.map((row, idx) => {
                    const isPaid = row.paid === true;
                    return (
                      <tr key={idx} className={isPaid ? "opacity-70 bg-emerald-500/5" : ""}>
                        <td className="py-2 pr-2 font-semibold">
                          Cuota {row.installment_number}
                          {isPaid ? <span className="ml-1 text-[9px] text-emerald-500 font-normal">(Pagada)</span> : null}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="date"
                            disabled={isPaid}
                            value={row.due_on}
                            onChange={(e) => handleUpdateScheduleRow(idx, "due_on", e.target.value)}
                            className={[labInputClass(isLight), "py-1 px-2 text-xs", isPaid ? "cursor-not-allowed opacity-60" : ""].join(" ")}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            disabled={isPaid}
                            value={row.amount}
                            onChange={(e) => handleUpdateScheduleRow(idx, "amount", e.target.value)}
                            className={[labInputClass(isLight), "py-1 px-2 text-xs font-mono", isPaid ? "cursor-not-allowed opacity-60" : ""].join(" ")}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            disabled={isPaid}
                            value={row.notes}
                            placeholder={`Concepto cuota ${idx + 1}`}
                            onChange={(e) => handleUpdateScheduleRow(idx, "notes", e.target.value)}
                            className={[labInputClass(isLight), "py-1 px-2 text-xs", isPaid ? "cursor-not-allowed opacity-60" : ""].join(" ")}
                          />
                        </td>
                        <td className="py-2 text-right">
                          {!isPaid && scheduleRows.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveScheduleRow(idx)}
                              className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1 transition-colors"
                              title="Eliminar esta cuota"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumen del Cronograma y Presupuesto */}
            {(() => {
              const schedTotal = Math.round(scheduleRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) * 100) / 100;
              const budgetNum = Math.round((Number(form.budget) || 0) * 100) / 100;
              const diff = Math.round((schedTotal - budgetNum) * 100) / 100;

              return (
                <div className={["flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs font-medium", isLight ? "border-indigo-100 text-zinc-700" : "border-white/10 text-zinc-300"].join(" ")}>
                  <div className="flex items-center gap-3">
                    <span>
                      Suma Cronograma: <strong className="font-mono text-indigo-600 dark:text-indigo-400">S/ {schedTotal.toFixed(2)}</strong>
                    </span>
                    <span>
                      Presupuesto: <strong className="font-mono">S/ {budgetNum.toFixed(2)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {Math.abs(diff) <= 0.05 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        ✓ Coincide 100%
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          ⚠ Diferencia: S/ {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={handleBalanceLastInstallment}
                          className="text-[11px] underline text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                        >
                          Ajustar a cuota final
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <LabField label="Responsable" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={form.lead_user_id === "" ? "" : String(form.lead_user_id)}
              onChange={(v) => setForm({ ...form, lead_user_id: v ? Number(v) : "" })}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              emptyLabel="Sin asignar"
            />
          </LabField>
          <LabField label="Descripción" isLight={isLight} className="sm:col-span-2">
            <textarea rows={3} className={labInputClass(isLight)} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </LabField>
          <LabField label="Objetivos" isLight={isLight} className="sm:col-span-2">
            <textarea rows={2} className={labInputClass(isLight)} value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} />
          </LabField>
          <LabField label="Entregables" isLight={isLight} className="sm:col-span-2">
            <textarea rows={2} className={labInputClass(isLight)} value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} />
          </LabField>
          <LabField label="Áreas *" isLight={isLight} className="sm:col-span-2">
            <div className={["flex flex-wrap gap-2 rounded-lg border p-3 text-xs", isLight ? "border-[#E5E7EB] bg-[#F9FAFB]" : "border-white/[0.06] bg-[#0a0a0a]/60"].join(" ")}>
              {areas.map((a) => (
                <label key={a.id} className={(isLight ? "text-[#374151]" : "text-zinc-200") + " flex gap-2"}>
                  <input type="checkbox" checked={form.area_ids.includes(a.id)} onChange={() => toggleArea(a.id)} disabled={!isSuperadmin} /> {a.name}
                </label>
              ))}
            </div>
          </LabField>
          <LabField label="Productos / SaaS adquiridos" isLight={isLight} className="sm:col-span-2">
            <div className={["max-h-40 flex flex-wrap gap-2 overflow-y-auto rounded-lg border p-3 text-xs", isLight ? "border-[#E5E7EB] bg-[#F9FAFB]" : "border-white/[0.08] bg-[#0a0a0a]/60"].join(" ")}>
              {services.map((s) => (
                <label key={s.id} className={(isLight ? "text-[#374151]" : "text-zinc-200") + " flex gap-2"}>
                  <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} /> {s.name}
                  <span className="text-[10px] uppercase text-zinc-500">{s.kind === "saas" ? "SaaS" : "Servicio"}</span>
                </label>
              ))}
              {!services.length ? <span className="text-zinc-500">Cargue productos en Catalogos &gt; Servicios.</span> : null}
            </div>
          </LabField>
          <LabField label="Equipo asignado" isLight={isLight} className="sm:col-span-2">
            <div className={["max-h-36 flex flex-wrap gap-2 overflow-y-auto rounded-lg border p-3 text-xs", isLight ? "border-[#E5E7EB]" : "border-white/[0.08]"].join(" ")}>
              {users.map((u) => (
                <label key={u.id} className={(isLight ? "text-[#374151]" : "text-zinc-200") + " flex gap-2"}>
                  <input type="checkbox" checked={form.user_ids.includes(u.id)} onChange={() => toggleUser(u.id)} /> {u.name}
                </label>
              ))}
            </div>
          </LabField>
          {modalErr ? <p className="sm:col-span-2 text-sm text-red-600">{modalErr}</p> : null}
        </div>
      </FormModal>

      <FormModal
        open={clientModal}
        title="Registrar cliente"
        isLight={isLight}
        wide
        onClose={() => { setClientModal(false); setClientErr(null); }}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setClientModal(false)}>
              Cerrar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveNewClient()}>
              Guardar cliente
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="RUC" isLight={isLight}>
            <div className="flex gap-2">
              <input
                className={labInputClass(isLight) + " flex-1"}
                value={clientForm.ruc}
                placeholder="11 dígitos"
                onChange={(e) => setClientForm({ ...clientForm, ruc: e.target.value })}
              />
              <button
                type="button"
                onClick={() => void performRucSearch()}
                disabled={searchingRuc}
                className={labPrimaryBtn(isLight) + " flex items-center justify-center px-3"}
                title="Buscar RUC"
              >
                {searchingRuc ? (
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </div>
          </LabField>
          <LabField label="DNI" isLight={isLight}>
            <div className="flex gap-2">
              <input
                className={labInputClass(isLight) + " flex-1"}
                value={clientForm.dni}
                placeholder="8 dígitos"
                onChange={(e) => setClientForm({ ...clientForm, dni: e.target.value })}
              />
              <button
                type="button"
                onClick={() => void performDniSearch()}
                disabled={searchingDni}
                className={labPrimaryBtn(isLight) + " flex items-center justify-center px-3"}
                title="Buscar DNI"
              >
                {searchingDni ? (
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </div>
          </LabField>
          <LabField label="Razón social *" isLight={isLight}>
            <input className={labInputClass(isLight)} value={clientForm.legal_name} onChange={(e) => setClientForm({ ...clientForm, legal_name: e.target.value })} />
          </LabField>
          <LabField label="Nombre comercial" isLight={isLight}>
            <input className={labInputClass(isLight)} value={clientForm.trade_name} onChange={(e) => setClientForm({ ...clientForm, trade_name: e.target.value })} />
          </LabField>
          <LabField label="Dirección" isLight={isLight}>
            <input className={labInputClass(isLight)} value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} />
          </LabField>
          <LabField label="Rubro" isLight={isLight}>
            <input className={labInputClass(isLight)} value={clientForm.rubro} onChange={(e) => setClientForm({ ...clientForm, rubro: e.target.value })} />
          </LabField>
          <LabField label="Empresa *" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={clientForm.area_id === "" ? "" : String(clientForm.area_id)}
              onChange={(v) => setClientForm({ ...clientForm, area_id: v ? Number(v) : "" })}
              options={scopedAreas.map((a) => ({ value: a.id, label: a.name }))}
              emptyLabel="Seleccionar..."
              disabled={!isSuperadmin}
            />
          </LabField>
          <LabField label="Etapa CRM" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={clientForm.pipeline_stage}
              onChange={(v) => setClientForm({ ...clientForm, pipeline_stage: v })}
              options={[
                { value: "lead", label: "Contacto" },
                { value: "prospect", label: "Prospecto" },
                { value: "active_client", label: "Cliente activo" },
              ]}
            />
          </LabField>
          {clientForm.pipeline_stage === "prospect" ? (
            <>
              <LabField label="Fecha de presentación" isLight={isLight}>
                <input type="date" className={labInputClass(isLight)} value={clientForm.presentation_date} onChange={(e) => setClientForm({ ...clientForm, presentation_date: e.target.value })} />
              </LabField>
              <LabField label="Fecha tentativa de respuesta" isLight={isLight}>
                <input type="date" className={labInputClass(isLight)} value={clientForm.tentative_response_date} onChange={(e) => setClientForm({ ...clientForm, tentative_response_date: e.target.value })} />
              </LabField>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <h3 className={"mb-1 text-sm font-semibold " + (isLight ? "text-[#111827]" : "text-zinc-100")}>Representante del cliente</h3>
          </div>
          <LabField label="Nombre completo" isLight={isLight}>
            <input className={labInputClass(isLight)} value={clientForm.representative_name} onChange={(e) => setClientForm({ ...clientForm, representative_name: e.target.value })} />
          </LabField>
          <LabField label="Número telefónico" isLight={isLight}>
            <input className={labInputClass(isLight)} value={clientForm.representative_phone} onChange={(e) => setClientForm({ ...clientForm, representative_phone: e.target.value })} />
          </LabField>
          <LabField label="Cargo o puesto" isLight={isLight}>
            <input className={labInputClass(isLight)} value={clientForm.representative_position} onChange={(e) => setClientForm({ ...clientForm, representative_position: e.target.value })} />
          </LabField>
          <LabField label="Correo electrónico" isLight={isLight}>
            <input type="email" className={labInputClass(isLight)} value={clientForm.representative_email} onChange={(e) => setClientForm({ ...clientForm, representative_email: e.target.value })} />
          </LabField>
          <LabField label="Observaciones" isLight={isLight} className="sm:col-span-2">
            <textarea className={labInputClass(isLight)} rows={2} value={clientForm.representative_observations} onChange={(e) => setClientForm({ ...clientForm, representative_observations: e.target.value })} />
          </LabField>
          {clientErr ? <p className="sm:col-span-2 text-sm text-red-600">{clientErr}</p> : null}
        </div>
      </FormModal>
    </main>
  );
}
