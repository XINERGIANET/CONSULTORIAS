import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/ConfirmModal";
import { SmartSelect } from "../components/SmartSelect";
import { useApexTheme } from "../context/ThemeContext";
import { FormModal } from "../xpande/FormModal";
import { LabNoticeModal } from "../xpande/LabTableKit";
import { deleteJson, getJson, postJson, type LaravelPaginated } from "../xpande/http";
import { apiErrorMessage } from "../xpande/apiError";

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

type ContractRow = {
  id: number;
  client_id: number;
  project_id?: number | null;
  area_id: number;
  title: string;
  total_amount: number | string;
  installment_amount?: number | string;
  installments_count?: number;
  billing_frequency?: string;
  start_date?: string;
  end_date?: string;
  first_due_on?: string;
  status: string;
  notes?: string | null;
  dias_restantes?: number | null;
  client?: { legal_name?: string };
  project?: { name?: string };
  area?: { name?: string };
  receivables?: Array<{
    id: number;
    installment_number: number;
    due_on?: string | null;
    projected_due_on?: string | null;
    total_amount: number | string;
    paid_amount: number | string;
    status: string;
    notes?: string | null;
  }>;
};

type ClientOpt = { id: number; legal_name: string };
type ProjectOpt = { id: number; name: string };
type AreaOpt = { id: number; name: string };

type ScheduleRow = {
  installment_number: number;
  due_on: string;
  amount: number | string;
  notes: string;
};

function fmtSoles(val: number | string): string {
  const n = Number(val) || 0;
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusPill(status: string, diasRestantes?: number | null) {
  if (status === "active" && typeof diasRestantes === "number" && diasRestantes <= 15 && diasRestantes >= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30">
        <Clock className="h-3 w-3" /> Por vencer ({diasRestantes}d)
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="h-3 w-3" /> Activo
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400 ring-1 ring-red-500/30">
        <AlertCircle className="h-3 w-3" /> Vencido
      </span>
    );
  }
  if (status === "renewed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30">
        <RotateCcw className="h-3 w-3" /> Renovado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-semibold text-zinc-500 ring-1 ring-zinc-500/30">
      {status}
    </span>
  );
}

export function ContratosPage() {
  const { isLight } = useApexTheme();
  const loc = useLocation();
  const navigate = useNavigate();

  const queryParams = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const initialProjectId = queryParams.get("project_id") ?? "";

  const [data, setData] = useState<LaravelPaginated<ContractRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; title: string; message: string } | null>(null);

  const [filters, setFilters] = useState({
    project_id: initialProjectId,
    client_id: "",
    status: "all",
    q: "",
  });

  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null);
  const [renewForm, setRenewForm] = useState({
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    first_due_on: new Date().toISOString().slice(0, 10),
    total_amount: "",
    notes: "",
  });
  const [renewSchedule, setRenewSchedule] = useState<ScheduleRow[]>([]);
  const [submittingRenew, setSubmittingRenew] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeDetail, setActiveDetail] = useState<ContractRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContractRow | null>(null);

  const execDeleteContract = async () => {
    if (!pendingDelete) return;
    const contract = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteJson(`/api/contracts/${contract.id}`);
      await fetchContracts();
      setNotice({
        variant: "success",
        title: "Contrato eliminado",
        message: `El contrato #${contract.id} «${contract.title}» fue eliminado correctamente.`,
      });
    } catch (e) {
      setNotice({
        variant: "error",
        title: "Error",
        message: apiErrorMessage(e, "No se pudo eliminar el contrato."),
      });
    }
  };


  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJson<LaravelPaginated<ContractRow>>("/api/contracts", {
        project_id: filters.project_id || undefined,
        client_id: filters.client_id || undefined,
        status: filters.status !== "all" ? filters.status : undefined,
        q: filters.q.trim() || undefined,
      });
      setData(res);
    } catch (e) {
      setNotice({ variant: "error", title: "Error", message: apiErrorMessage(e, "No se pudieron cargar los contratos.") });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void getJson<LaravelPaginated<ClientOpt>>("/api/clients", { per_page: 200 }).then((r) => setClients(r.data));
    void getJson<LaravelPaginated<ProjectOpt>>("/api/projects", { per_page: 200 }).then((r) => setProjects(r.data));
    void getJson<AreaOpt[]>("/api/areas", { active_only: true });
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Sync state if URL search query changes
  useEffect(() => {
    const projId = queryParams.get("project_id") ?? "";
    if (projId !== filters.project_id) {
      setFilters((f) => ({ ...f, project_id: projId }));
    }
  }, [queryParams]);

  const kpis = useMemo(() => {
    if (!data || !data.data) return { active: 0, expiring: 0, expired: 0, totalAmount: 0 };
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let totalAmount = 0;

    for (const c of data.data) {
      const amt = Number(c.total_amount) || 0;
      totalAmount += amt;
      if (c.status === "active") {
        active++;
        if (typeof c.dias_restantes === "number" && c.dias_restantes <= 15) {
          expiring++;
        }
      } else if (c.status === "expired") {
        expired++;
      }
    }
    return { active, expiring, expired, totalAmount };
  }, [data]);

  const openRenewModal = (c: ContractRow) => {
    setSelectedContract(c);
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    const totalAmt = String(c.total_amount ?? "");

    setRenewForm({
      start_date: startDate,
      end_date: endDate,
      first_due_on: startDate,
      total_amount: totalAmt,
      notes: `Renovación de contrato #${c.id}`,
    });

    // Default 2 parts schedule
    const baseAmt = Math.round((Number(totalAmt) / 2) * 100) / 100;
    setRenewSchedule([
      { installment_number: 1, due_on: startDate, amount: baseAmt, notes: "Cuota 1/2 (Renovación)" },
      { installment_number: 2, due_on: endDate, amount: Math.max(0, Math.round((Number(totalAmt) - baseAmt) * 100) / 100), notes: "Cuota 2/2 (Renovación)" },
    ]);
    setRenewModalOpen(true);
  };

  const handleRenewSubmit = async () => {
    if (!selectedContract) return;
    if (submittingRenew) return;

    if (!renewForm.start_date || !renewForm.end_date || !renewForm.total_amount || Number(renewForm.total_amount) <= 0) {
      setNotice({ variant: "error", title: "Formulario", message: "Ingrese las fechas de inicio, fin y monto de renovación." });
      return;
    }

    setSubmittingRenew(true);
    try {
      await postJson(`/api/contracts/${selectedContract.id}/renew`, {
        start_date: renewForm.start_date,
        end_date: renewForm.end_date,
        first_due_on: renewForm.first_due_on,
        total_amount: Number(renewForm.total_amount),
        notes: renewForm.notes,
        custom_schedule: renewSchedule.map((r, i) => ({
          installment_number: i + 1,
          due_on: r.due_on,
          amount: Number(r.amount) || 0,
          notes: r.notes || null,
        })),
      });

      setRenewModalOpen(false);
      setNotice({ variant: "success", title: "Contrato Renovado", message: `Se generó el nuevo contrato de renovación e instalaron sus cuentas por cobrar.` });
      fetchContracts();
    } catch (e) {
      setNotice({ variant: "error", title: "Error al renovar", message: apiErrorMessage(e, "No se pudo procesar la renovación del contrato.") });
    } finally {
      setSubmittingRenew(false);
    }
  };

  const downloadPdf = (contractId: number) => {
    window.open(`/api/contracts/${contractId}/pdf`, "_blank");
  };

  const selectedProjectObj = useMemo(() => {
    return projects.find((p) => String(p.id) === filters.project_id);
  }, [projects, filters.project_id]);

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Contratos Comerciales" }]} isLight={isLight} />

      <LabPageHeader
        title="Contratos Comerciales & Convenios"
        subtitle="Gestión integral de contratos por proyecto, seguimiento de vigencia, emisión de PDF y renovaciones."
        isLight={isLight}
      />

      {/* Filtered Banner notification if pre-filtered by Project */}
      {filters.project_id && selectedProjectObj ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/30 p-3.5 text-xs text-indigo-900 dark:text-indigo-200 shadow-sm">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-indigo-500" />
            <span>
              Filtrando contratos del proyecto: <strong>{selectedProjectObj.name}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilters((f) => ({ ...f, project_id: "" }));
              navigate("/contratos", { replace: true });
            }}
            className="font-semibold text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-400"
          >
            Ver todos los proyectos
          </button>
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className={["rounded-xl border p-4 shadow-sm", isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-[#121212]"].join(" ")}>
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>Contratos Activos</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className={["mt-2 text-2xl font-extrabold", isLight ? "text-slate-900" : "text-white"].join(" ")}>{kpis.active}</p>
          <span className="text-[11px] text-zinc-400">En ejecución de servicios</span>
        </div>

        <div className={["rounded-xl border p-4 shadow-sm", isLight ? "border-amber-200 bg-amber-50/40" : "border-amber-900/30 bg-amber-950/20"].join(" ")}>
          <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span>Por Vencer (≤ 15d)</span>
            <Clock className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">{kpis.expiring}</p>
          <span className="text-[11px] text-amber-500/80">Requieren propuesta o renovación</span>
        </div>

        <div className={["rounded-xl border p-4 shadow-sm", isLight ? "border-red-200 bg-red-50/40" : "border-red-900/30 bg-red-950/20"].join(" ")}>
          <div className="flex items-center justify-between text-xs font-semibold text-red-600 dark:text-red-400">
            <span>Contratos Vencidos</span>
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-red-600 dark:text-red-400">{kpis.expired}</p>
          <span className="text-[11px] text-red-500/80">Vigencia expirada</span>
        </div>

        <div className={["rounded-xl border p-4 shadow-sm", isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-[#121212]"].join(" ")}>
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>Monto Total Contratado</span>
            <FileText className="h-4 w-4 text-indigo-500" />
          </div>
          <p className={["mt-2 text-xl font-extrabold", isLight ? "text-slate-900" : "text-white"].join(" ")}>S/ {fmtSoles(kpis.totalAmount)}</p>
          <span className="text-[11px] text-zinc-400">Suma total de convenios</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className={["mb-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-4", isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-[#121212]"].join(" ")}>
        <LabField label="Buscar" isLight={isLight}>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Título, cliente o proyecto…"
            className={labInputClass(isLight)}
          />
        </LabField>

        <LabField label="Proyecto" isLight={isLight}>
          <SmartSelect
            isLight={isLight}
            value={filters.project_id}
            onChange={(v) => setFilters({ ...filters, project_id: v })}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            emptyLabel="Todos los proyectos"
          />
        </LabField>

        <LabField label="Cliente" isLight={isLight}>
          <SmartSelect
            isLight={isLight}
            value={filters.client_id}
            onChange={(v) => setFilters({ ...filters, client_id: v })}
            options={clients.map((c) => ({ value: c.id, label: c.legal_name }))}
            emptyLabel="Todos los clientes"
          />
        </LabField>

        <LabField label="Estado" isLight={isLight}>
          <SmartSelect
            isLight={isLight}
            value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v })}
            options={[
              { value: "all", label: "Todos los estados" },
              { value: "active", label: "Activos" },
              { value: "expired", label: "Vencidos" },
              { value: "renewed", label: "Renovados" },
              { value: "cancelled", label: "Cancelados" },
            ]}
          />
        </LabField>
      </div>

      {/* Main Table */}
      <div className={labPanelClass(isLight)}>
        {loading && !data ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando contratos…</p>
        ) : !data || data.data.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            <FileText className="mx-auto h-8 w-8 opacity-40 mb-2" />
            <p>No se encontraron contratos registrados.</p>
          </div>
        ) : (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className={["border-b uppercase font-semibold text-[10px] tracking-wider", isLight ? "border-zinc-200 text-zinc-500" : "border-white/10 text-zinc-400"].join(" ")}>
                  <th className="py-3 px-3">N° / Contrato</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Proyecto</th>
                  <th className="py-3 px-3 text-right">Monto Total</th>
                  <th className="py-3 px-3">Vigencia</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-white/5">
                {data.data.map((c) => (
                  <tr key={c.id} className={isLight ? "hover:bg-zinc-50" : "hover:bg-white/[0.02]"}>
                    <td className="py-3 px-3 font-semibold">
                      <div>#{c.id}</div>
                      <div className="text-[11px] font-normal text-zinc-500">{c.title}</div>
                    </td>
                    <td className="py-3 px-3 font-medium">{c.client?.legal_name ?? "—"}</td>
                    <td className="py-3 px-3">
                      {c.project?.name ? (
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{c.project.name}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">S/ {fmtSoles(c.total_amount)}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div>
                        {c.start_date ? String(c.start_date).slice(0, 10) : "—"} al {c.end_date ? String(c.end_date).slice(0, 10) : "—"}
                      </div>
                      {typeof c.dias_restantes === "number" ? (
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {c.dias_restantes > 0 ? `${c.dias_restantes} días restantes` : c.dias_restantes === 0 ? "Vence hoy" : `Vencido hace ${Math.abs(c.dias_restantes)} días`}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-3">{statusPill(c.status, c.dias_restantes)}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => downloadPdf(c.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors"
                          title="Descargar PDF del contrato"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveDetail(c);
                            setDetailModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20 transition-colors"
                          title="Ver cuotas y cuentas por cobrar"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Cuotas</span>
                        </button>

                        {(c.status === "active" || c.status === "expired") ? (
                          <button
                            type="button"
                            onClick={() => openRenewModal(c)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
                            title="Renovar contrato"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Renovar</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => setPendingDelete(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60 transition-colors"
                          title="Eliminar contrato"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LabNoticeModal
        open={notice !== null}
        variant={notice?.variant ?? "success"}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        isLight={isLight}
        onClose={() => setNotice(null)}
      />

      {/* Modal de Renovación */}
      <FormModal
        open={renewModalOpen}
        title={`Renovar Contrato #${selectedContract?.id ?? ""}`}
        isLight={isLight}
        wide
        onClose={() => setRenewModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setRenewModalOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={submittingRenew}
              className={[labPrimaryBtn(isLight), submittingRenew ? "opacity-50 cursor-not-allowed" : ""].join(" ")}
              onClick={() => void handleRenewSubmit()}
            >
              {submittingRenew ? "Procesando..." : "Confirmar Renovación"}
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-lg border p-3 text-xs bg-indigo-50/30 border-indigo-500/20 text-indigo-900 dark:text-indigo-200">
            <p className="font-semibold">Renovando contrato para: {selectedContract?.client?.legal_name}</p>
            <p className="text-[11px] opacity-80">Proyecto: {selectedContract?.project?.name ?? "General"}</p>
          </div>

          <LabField label="Nueva Fecha Inicio *" isLight={isLight}>
            <input
              type="date"
              className={labInputClass(isLight)}
              value={renewForm.start_date}
              onChange={(e) => setRenewForm({ ...renewForm, start_date: e.target.value })}
            />
          </LabField>

          <LabField label="Nueva Fecha Fin *" isLight={isLight}>
            <input
              type="date"
              className={labInputClass(isLight)}
              value={renewForm.end_date}
              onChange={(e) => setRenewForm({ ...renewForm, end_date: e.target.value })}
            />
          </LabField>

          <LabField label="Monto Total Renovación (S/) *" isLight={isLight}>
            <input
              type="number"
              step="0.01"
              className={labInputClass(isLight)}
              value={renewForm.total_amount}
              onChange={(e) => setRenewForm({ ...renewForm, total_amount: e.target.value })}
            />
          </LabField>

          <LabField label="Primera Fecha de Cobro *" isLight={isLight}>
            <input
              type="date"
              className={labInputClass(isLight)}
              value={renewForm.first_due_on}
              onChange={(e) => setRenewForm({ ...renewForm, first_due_on: e.target.value })}
            />
          </LabField>

          <LabField label="Notas de Renovación" isLight={isLight} className="sm:col-span-2">
            <textarea
              rows={2}
              className={labInputClass(isLight)}
              value={renewForm.notes}
              onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
            />
          </LabField>
        </div>
      </FormModal>

      {/* Modal de Detalle / Cuotas del Contrato */}
      <FormModal
        open={detailModalOpen}
        title={`Cuotas del Contrato #${activeDetail?.id ?? ""}`}
        isLight={isLight}
        wide
        onClose={() => setDetailModalOpen(false)}
        footer={
          <div className="flex justify-end">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setDetailModalOpen(false)}>
              Cerrar
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid gap-2 sm:grid-cols-2 rounded-lg border p-3 bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10">
            <div>
              <span className="text-zinc-500">Cliente:</span> <strong>{activeDetail?.client?.legal_name}</strong>
            </div>
            <div>
              <span className="text-zinc-500">Proyecto:</span> <strong>{activeDetail?.project?.name ?? "—"}</strong>
            </div>
            <div>
              <span className="text-zinc-500">Monto Total:</span> <strong className="font-mono">S/ {fmtSoles(activeDetail?.total_amount ?? 0)}</strong>
            </div>
            <div>
              <span className="text-zinc-500">Vigencia:</span> <strong>{activeDetail?.start_date ? String(activeDetail.start_date).slice(0, 10) : "—"} al {activeDetail?.end_date ? String(activeDetail.end_date).slice(0, 10) : "—"}</strong>
            </div>
          </div>

          <h4 className="font-bold uppercase tracking-wider text-[11px] text-zinc-500">Cuentas por cobrar asociadas</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-[10px] uppercase font-semibold text-zinc-500">
                  <th className="py-1.5 px-2">Cuota</th>
                  <th className="py-1.5 px-2">Vencimiento</th>
                  <th className="py-1.5 px-2 text-right">Monto Total</th>
                  <th className="py-1.5 px-2 text-right">Pagado</th>
                  <th className="py-1.5 px-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-white/5">
                {(activeDetail?.receivables ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 px-2 font-semibold">Cuota {r.installment_number}</td>
                    <td className="py-2 px-2">{r.due_on ? String(r.due_on).slice(0, 10) : (r.projected_due_on ? String(r.projected_due_on).slice(0, 10) : "—")}</td>
                    <td className="py-2 px-2 text-right font-mono">S/ {fmtSoles(r.total_amount)}</td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">S/ {fmtSoles(r.paid_amount)}</td>
                    <td className="py-2 px-2 capitalize">{r.status}</td>
                  </tr>
                ))}
                {(!activeDetail?.receivables || activeDetail.receivables.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-zinc-500 italic">No hay cuotas asociadas.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminar Contrato"
        message={`¿Estás seguro de que deseas eliminar el contrato #${pendingDelete?.id ?? ""} «${pendingDelete?.title ?? ""}»? Esta acción eliminará el contrato y limpiará o cancelará sus cuotas pendientes.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        isLight={isLight}
        onConfirm={() => void execDeleteContract()}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
