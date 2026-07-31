import { AlertTriangle, CheckCircle2, Clock, HandCoins, History, Plus, RotateCcw, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { SmartSelect } from "../components/SmartSelect";
import { useAuth } from "../context/AuthContext";
import { useApexTheme } from "../context/ThemeContext";
import { FormModal } from "../xpande/FormModal";
import { LabCircleIconAction, LabNoticeModal } from "../xpande/LabTableKit";
import { deleteJson, getJson, postJson, putJson, type LaravelPaginated } from "../xpande/http";
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

type PaymentRow = {
  id: number;
  amount: string | number;
  paid_on: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  registered_by?: { name?: string } | null;
};

type AccountRow = {
  id: number;
  client_id?: number;
  client?: { legal_name?: string };
  project_id?: number | null;
  project?: { name?: string };
  document?: { title?: string };
  installment_number?: number | null;
  client_contract?: { title?: string; installments_count?: number };
  total_amount: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
  issued_on?: string;
  due_on?: string | null;
  projected_due_on?: string | null;
  collected_on?: string | null;
  status: string;
  notes?: string | null;
  area_id?: number | null;
  mora_dias?: number;
  payments?: PaymentRow[];
};

type AreaOpt = { id: number; name: string };
type PaymentMethodOpt = { id: number; code: string; name: string };
type ClientOpt = { id: number; legal_name: string };
type ProjectOpt = { id: number; name: string };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  partial: "Pago parcial",
  paid: "Pagado",
  overdue: "Vencido",
  cancelled: "Anulado",
};

function statusPill(status: string, isLight: boolean): string {
  const variants: Record<string, { light: string; dark: string }> = {
    pending: {
      light: "inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200",
      dark:  "inline-flex rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30",
    },
    partial: {
      light: "inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200",
      dark:  "inline-flex rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-500/30",
    },
    paid: {
      light: "inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200",
      dark:  "inline-flex rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30",
    },
    overdue: {
      light: "inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200",
      dark:  "inline-flex rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/30",
    },
    cancelled: {
      light: "inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200",
      dark:  "inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-zinc-400 ring-1 ring-white/10",
    },
  };
  const v = variants[status] ?? variants.pending;
  return isLight ? v.light : v.dark;
}

function fmt(val: number | string): string {
  const n = Number(val) || 0;
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CuentasPorCobrarPage() {
  const { isLight } = useApexTheme();
  const { user, isSuperadmin } = useAuth();
  const [rows, setRows] = useState<LaravelPaginated<AccountRow> | null>(null);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOpt[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [payModal, setPayModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [activeAccount, setActiveAccount] = useState<AccountRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountRow | null>(null);
  const [revertPaymentTarget, setRevertPaymentTarget] = useState<PaymentRow | null>(null);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; title: string; message: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filters, setFilters] = useState({ client_id: "", project_id: "", status: "", from: "", to: "" });

  const [payForm, setPayForm] = useState({
    amount: "",
    paid_on: new Date().toISOString().slice(0, 10),
    method: "",
    reference: "",
    notes: "",
  });

  const [newForm, setNewForm] = useState({
    client_id: "" as "" | number,
    project_id: "" as "" | number,
    area_id: "" as "" | number,
    total_amount: "",
    issued_on: new Date().toISOString().slice(0, 10),
    due_on: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const [editForm, setEditForm] = useState({
    due_on: "",
    projected_due_on: "",
    collected_on: "",
    total_amount: "",
    notes: "",
  });

  const primaryAreaId = user?.area_ids?.[0] ?? user?.areas?.[0]?.id ?? "";

  const load = () => {
    const params: Record<string, unknown> = {};
    if (filters.client_id) params.client_id = filters.client_id;
    if (filters.project_id) params.project_id = filters.project_id;
    if (filters.status) params.status = filters.status;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    void getJson<LaravelPaginated<AccountRow>>("/api/accounts-receivable", params).then(setRows);
  };

  useEffect(() => {
    void getJson<AreaOpt[]>("/api/areas", { active_only: true }).then(setAreas);
    void getJson<LaravelPaginated<ClientOpt>>("/api/clients", { per_page: 200 }).then((r) => setClients(r.data));
    void getJson<LaravelPaginated<ProjectOpt>>("/api/projects", { per_page: 200 }).then((r) => setProjects(r.data));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const resetFilters = () => setFilters({ client_id: "", project_id: "", status: "", from: "", to: "" });

  const kpis = useMemo(() => {
    if (!rows || !rows.data) return { totalPending: 0, totalOverdue: 0, totalPaid: 0, avgMora: 0 };
    let totalPending = 0;
    let totalOverdue = 0;
    let totalPaid = 0;
    let sumMora = 0;
    let countMora = 0;

    for (const r of rows.data) {
      const bal = Number(r.balance_amount) || 0;
      const paid = Number(r.paid_amount) || 0;
      totalPaid += paid;
      if (r.status === "overdue") {
        totalOverdue += bal;
      } else if (r.status === "pending" || r.status === "partial") {
        totalPending += bal;
      }
      if ((r.mora_dias ?? 0) > 0) {
        sumMora += r.mora_dias ?? 0;
        countMora++;
      }
    }

    return {
      totalPending,
      totalOverdue,
      totalPaid,
      avgMora: countMora > 0 ? Math.round(sumMora / countMora) : 0,
    };
  }, [rows]);

  const openPayment = (r: AccountRow) => {
    setActiveAccount(r);
    setPayForm({
      amount: String(r.balance_amount ?? ""),
      paid_on: new Date().toISOString().slice(0, 10),
      method: "",
      reference: "",
      notes: "",
    });
    setErr(null);
    setPayModal(true);
    void getJson<PaymentMethodOpt[]>("/api/catalog/payment-methods", {
      active_only: true,
      ...(r.area_id ? { area_id: r.area_id } : {}),
    }).then(setPaymentMethods);
  };

  const openHistory = (r: AccountRow) => {
    setActiveAccount(r);
    setHistoryModal(true);
  };

  const openEdit = (r: AccountRow) => {
    setActiveAccount(r);
    setEditForm({
      due_on: r.due_on ? String(r.due_on).slice(0, 10) : "",
      projected_due_on: r.projected_due_on ? String(r.projected_due_on).slice(0, 10) : "",
      collected_on: r.collected_on ? String(r.collected_on).slice(0, 10) : "",
      total_amount: String(r.total_amount ?? ""),
      notes: r.notes ?? "",
    });
    setEditModal(true);
  };

  const updateCollectedOn = async (r: AccountRow, value: string) => {
    try {
      await putJson(`/api/accounts-receivable/${r.id}`, { collected_on: value || null });
      load();
    } catch {
      setNotice({ variant: "error", title: "Error", message: "No se pudo actualizar la fecha de cobro." });
    }
  };

  const savePayment = async () => {
    if (!activeAccount || !payForm.amount) {
      setErr("El monto de pago es requerido.");
      return;
    }
    try {
      await postJson(`/api/accounts-receivable/${activeAccount.id}/payments`, {
        amount: Number(payForm.amount),
        paid_on: payForm.paid_on,
        method: payForm.method || null,
        reference: payForm.reference || null,
        notes: payForm.notes || null,
      });
      setPayModal(false);
      setActiveAccount(null);
      load();
      setNotice({ variant: "success", title: "Cobro registrado", message: "Se actualizó el saldo y se generó el ingreso en finanzas." });
    } catch {
      setErr("No se pudo registrar el pago. Verifique el saldo pendiente.");
    }
  };

  const saveCreate = async () => {
    const areaId = isSuperadmin ? newForm.area_id : primaryAreaId;
    if (!newForm.client_id || areaId === "" || !newForm.total_amount) {
      setErr("Cliente, empresa y monto total son obligatorios.");
      return;
    }
    try {
      await postJson("/api/accounts-receivable", {
        client_id: newForm.client_id,
        project_id: newForm.project_id || null,
        area_id: areaId,
        total_amount: Number(newForm.total_amount),
        issued_on: newForm.issued_on,
        due_on: newForm.due_on,
        projected_due_on: newForm.due_on,
        notes: newForm.notes || null,
      });
      setCreateModal(false);
      load();
      setNotice({ variant: "success", title: "Cuenta creada", message: "La cuenta por cobrar fue registrada con éxito." });
    } catch {
      setErr("No se pudo crear la cuenta por cobrar.");
    }
  };

  const saveEdit = async () => {
    if (!activeAccount) return;
    try {
      await putJson(`/api/accounts-receivable/${activeAccount.id}`, {
        due_on: editForm.due_on || null,
        projected_due_on: editForm.projected_due_on || null,
        collected_on: editForm.collected_on || null,
        total_amount: editForm.total_amount ? Number(editForm.total_amount) : undefined,
        notes: editForm.notes || null,
      });
      setEditModal(false);
      setActiveAccount(null);
      load();
      setNotice({ variant: "success", title: "Cuenta actualizada", message: "Los cambios fueron guardados correctamente." });
    } catch {
      setNotice({ variant: "error", title: "Error", message: "No se pudo actualizar la cuenta." });
    }
  };

  const confirmRevertPayment = async () => {
    if (!activeAccount || !revertPaymentTarget) return;
    try {
      await deleteJson(`/api/accounts-receivable/${activeAccount.id}/payments/${revertPaymentTarget.id}`);
      setRevertPaymentTarget(null);
      setHistoryModal(false);
      setActiveAccount(null);
      load();
      setNotice({ variant: "success", title: "Abono revertido", message: "El pago fue eliminado y el saldo devuelto a la cuenta por cobrar." });
    } catch {
      setNotice({ variant: "error", title: "Error", message: "No se pudo revertir el abono." });
    }
  };

  const confirmDeleteAccount = async () => {
    if (!deleteTarget) return;
    try {
      await deleteJson(`/api/accounts-receivable/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
      setNotice({ variant: "success", title: "Cuenta eliminada", message: "La cuenta por cobrar fue eliminada." });
    } catch {
      setNotice({ variant: "error", title: "No se pudo eliminar", message: "Solo se pueden eliminar cuentas por cobrar sin abonos registrados." });
    }
  };

  const th = "pb-2 pr-3 text-[10px] font-semibold uppercase " + (isLight ? "text-[#6B7280]" : "text-zinc-500");
  const td = "py-2.5 pr-3 text-xs " + (isLight ? "text-[#374151]" : "text-zinc-300");

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Cuentas por cobrar" }]} isLight={isLight} />
      <LabPageHeader
        title="Cuentas por cobrar"
        subtitle="Seguimiento de cuotas, cobranza proyectada vs. real y reversión de abonos."
        isLight={isLight}
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => { setErr(null); setCreateModal(true); }}>
            <Plus className="h-4 w-4" /> Nueva cuenta por cobrar
          </button>
        }
      />

      {/* KPI Header Cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className={`rounded-xl border p-4 shadow-sm ${isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-[#121212]"}`}>
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>Saldo por cobrar</span>
            <Wallet className="h-4 w-4 text-blue-500" />
          </div>
          <p className={`mt-2 text-xl font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>S/. {fmt(kpis.totalPending)}</p>
          <span className="text-[11px] text-zinc-400">Vigentes y cuotas pendientes</span>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${isLight ? "border-red-200 bg-red-50/40" : "border-red-900/30 bg-red-950/20"}`}>
          <div className="flex items-center justify-between text-xs font-semibold text-red-600 dark:text-red-400">
            <span>Monto Vencido</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-red-600 dark:text-red-400">S/. {fmt(kpis.totalOverdue)}</p>
          <span className="text-[11px] text-red-500/80">Cobros excedidos de fecha</span>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${isLight ? "border-emerald-200 bg-emerald-50/40" : "border-emerald-900/30 bg-emerald-950/20"}`}>
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span>Total Recaudado</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">S/. {fmt(kpis.totalPaid)}</p>
          <span className="text-[11px] text-emerald-500/80">Abonos cobrados efectivamente</span>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-[#121212]"}`}>
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>Mora Promedio</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className={`mt-2 text-xl font-extrabold ${isLight ? "text-amber-700" : "text-amber-400"}`}>{kpis.avgMora} días</p>
          <span className="text-[11px] text-zinc-400">Retraso medio en cobranzas</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className={`mb-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-5 ${isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-[#121212]"}`}>
        <LabField label="Cliente" isLight={isLight}>
          <SmartSelect
            isLight={isLight}
            value={filters.client_id}
            onChange={(v) => setFilters({ ...filters, client_id: v })}
            options={clients.map((c) => ({ value: c.id, label: c.legal_name }))}
            emptyLabel="Todos los clientes"
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
        <LabField label="Estado" isLight={isLight}>
          <SmartSelect
            isLight={isLight}
            value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v })}
            options={[
              { value: "pending", label: "Pendiente" },
              { value: "partial", label: "Pago parcial" },
              { value: "paid", label: "Pagado" },
              { value: "overdue", label: "Vencido" },
              { value: "cancelled", label: "Anulado" },
            ]}
            emptyLabel="Todas (excluye anuladas)"
          />
        </LabField>
        <LabField label="Desde" isLight={isLight}>
          <input type="date" className={labInputClass(isLight)} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </LabField>
        <LabField label="Hasta" isLight={isLight}>
          <input type="date" className={labInputClass(isLight)} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </LabField>
        {filters.client_id || filters.project_id || filters.status || filters.from || filters.to ? (
          <div className="sm:col-span-5">
            <button type="button" className={labGhostBtn(isLight)} onClick={resetFilters}>Limpiar filtros</button>
          </div>
        ) : null}
      </div>

      {/* Main Table */}
      <div className={labPanelClass(isLight)}>
        {!rows ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando cuentas por cobrar…</p>
        ) : rows.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No hay cuentas por cobrar registradas.</p>
        ) : (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead>
                <tr>
                  <th className={th}>Cliente</th>
                  <th className={th}>Proyecto / Referencia</th>
                  <th className={th}>Cuota</th>
                  <th className={th + " text-right"}>Total</th>
                  <th className={th + " text-right"}>Pagado</th>
                  <th className={th + " text-right"}>Saldo</th>
                  <th className={th}>Venc. proyectado</th>
                  <th className={th}>Cobro real</th>
                  <th className={th + " text-right"}>Mora</th>
                  <th className={th}>Estado</th>
                  <th className={th + " text-right"} />
                </tr>
              </thead>
              <tbody>
                {rows.data.map((r) => (
                  <tr key={r.id} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                    <td className={td + " font-medium"}>{r.client?.legal_name ?? "—"}</td>
                    <td className={td}>{r.project?.name ?? r.document?.title ?? r.notes ?? "Cobro directo"}</td>
                    <td className={td}>
                      {r.installment_number
                        ? `Cuota ${r.installment_number}${r.client_contract?.installments_count ? ` / ${r.client_contract.installments_count}` : ""}`
                        : "—"}
                    </td>
                    <td className={td + " text-right font-medium"}>S/. {fmt(r.total_amount)}</td>
                    <td className={td + " text-right text-emerald-600 dark:text-emerald-400 font-medium"}>S/. {fmt(r.paid_amount)}</td>
                    <td className={
                      td + " text-right font-bold " +
                      (Number(r.balance_amount) > 0 ? (isLight ? "text-red-600" : "text-red-400") : "text-zinc-500")
                    }>
                      S/. {fmt(r.balance_amount)}
                    </td>
                    <td className={td}>{(r.projected_due_on ?? r.due_on) ? String(r.projected_due_on ?? r.due_on).slice(0, 10) : "—"}</td>
                    <td className={td}>
                      <input
                        type="date"
                        className={labInputClass(isLight) + " !w-auto !py-1 text-xs"}
                        value={r.collected_on ? String(r.collected_on).slice(0, 10) : ""}
                        onChange={(e) => void updateCollectedOn(r, e.target.value)}
                      />
                    </td>
                    <td className={
                      td + " text-right font-bold " +
                      ((r.mora_dias ?? 0) > 0 ? (isLight ? "text-red-600" : "text-red-400") : "text-zinc-400")
                    }>
                      {(r.mora_dias ?? 0) > 0 ? `${r.mora_dias} d` : "0 d"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={statusPill(r.status, isLight)}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right align-middle">
                      <div className="flex justify-end gap-1.5">
                        {r.status !== "paid" && r.status !== "cancelled" ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-md transition hover:bg-[#15803D]"
                            onClick={() => openPayment(r)}
                            title="Registrar cobro"
                          >
                            <HandCoins className="h-3.5 w-3.5" strokeWidth={2.25} />
                          </button>
                        ) : null}

                        {r.payments && r.payments.length > 0 ? (
                          <button
                            type="button"
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold border ${
                              isLight ? "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                            }`}
                            onClick={() => openHistory(r)}
                            title="Ver historial de abonos"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        ) : null}

                        <LabCircleIconAction variant="edit" tooltip="Editar fechas / notas" ariaLabel="Editar cuenta" onClick={() => openEdit(r)} />

                        {Number(r.paid_amount) <= 0 ? (
                          <LabCircleIconAction variant="delete" tooltip="Eliminar" ariaLabel="Eliminar cuenta" onClick={() => setDeleteTarget(r)} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notice & Confirm Modals */}
      <LabNoticeModal open={notice !== null} variant={notice?.variant ?? "success"} title={notice?.title ?? ""} message={notice?.message ?? ""} isLight={isLight} onClose={() => setNotice(null)} />
      
      <ConfirmModal
        open={deleteTarget !== null}
        title="Eliminar cuenta por cobrar"
        message={deleteTarget ? `¿Confirma eliminar la cuenta por cobrar de "${deleteTarget.client?.legal_name}" por S/. ${fmt(deleteTarget.total_amount)}?` : ""}
        confirmText="Eliminar"
        danger
        isLight={isLight}
        onConfirm={() => void confirmDeleteAccount()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={revertPaymentTarget !== null}
        title="Revertir y eliminar abono"
        message={revertPaymentTarget ? `¿Confirma revertir el abono de S/. ${fmt(revertPaymentTarget.amount)} del ${revertPaymentTarget.paid_on}? Se eliminará el ingreso en finanzas y se devolverá el saldo pendiente.` : ""}
        confirmText="Revertir pago"
        danger
        isLight={isLight}
        onConfirm={() => void confirmRevertPayment()}
        onCancel={() => setRevertPaymentTarget(null)}
      />

      {/* Modal: Registrar Pago / Abono */}
      <FormModal
        open={payModal}
        title="Registrar cobro de cuota"
        isLight={isLight}
        wide
        onClose={() => { setPayModal(false); setActiveAccount(null); }}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => { setPayModal(false); setActiveAccount(null); }}>
              Cancelar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void savePayment()}>
              Guardar cobro
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {activeAccount ? (
            <div className={`sm:col-span-2 rounded-lg p-3 text-xs border ${isLight ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-zinc-300"}`}>
              <p><strong>Cliente:</strong> {activeAccount.client?.legal_name}</p>
              <p><strong>Proyecto/Ref:</strong> {activeAccount.project?.name ?? activeAccount.notes ?? "—"}</p>
              <p className="mt-1 font-semibold text-red-600 dark:text-red-400">Saldo pendiente: S/. {fmt(activeAccount.balance_amount)}</p>
            </div>
          ) : null}

          <LabField label="Monto a cobrar (S/.) *" isLight={isLight}>
            <input
              type="number"
              step="0.01"
              className={labInputClass(isLight)}
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            />
          </LabField>

          <LabField label="Fecha de cobro real *" isLight={isLight}>
            <input
              type="date"
              className={labInputClass(isLight)}
              value={payForm.paid_on}
              onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })}
            />
          </LabField>

          <LabField label="Método de pago" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={payForm.method}
              onChange={(v) => setPayForm({ ...payForm, method: v })}
              options={paymentMethods.map((pm) => ({ value: pm.name, label: pm.name }))}
              emptyLabel="Seleccionar método…"
            />
          </LabField>

          <LabField label="Nro. operación / Referencia" isLight={isLight}>
            <input
              className={labInputClass(isLight)}
              placeholder="Ej: Transferencia BCP 193-..."
              value={payForm.reference}
              onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
            />
          </LabField>

          <LabField label="Notas de cobro" isLight={isLight} className="sm:col-span-2">
            <textarea
              rows={2}
              className={labInputClass(isLight)}
              placeholder="Comentarios adicionales sobre el cobro…"
              value={payForm.notes}
              onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
            />
          </LabField>

          {err ? <p className="sm:col-span-2 text-sm font-semibold text-red-600">{err}</p> : null}
        </div>
      </FormModal>

      {/* Modal: Historial y Reversión de Pagos */}
      <FormModal
        open={historyModal}
        title="Historial de abonos registrados"
        isLight={isLight}
        wide
        onClose={() => { setHistoryModal(false); setActiveAccount(null); }}
        footer={
          <div className="flex justify-end">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => { setHistoryModal(false); setActiveAccount(null); }}>
              Cerrar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {activeAccount ? (
            <div className="text-xs text-zinc-500">
              <p><strong>Cliente:</strong> {activeAccount.client?.legal_name}</p>
              <p>Total facturado: S/. {fmt(activeAccount.total_amount)} | Pagado: S/. {fmt(activeAccount.paid_amount)} | Saldo: S/. {fmt(activeAccount.balance_amount)}</p>
            </div>
          ) : null}

          {!activeAccount?.payments || activeAccount.payments.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">No hay abonos registrados para esta cuenta.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={isLight ? "text-slate-500 border-b" : "text-zinc-400 border-b border-white/10"}>
                    <th className="pb-2">Fecha</th>
                    <th className="pb-2 text-right">Monto</th>
                    <th className="pb-2">Método</th>
                    <th className="pb-2">Referencia</th>
                    <th className="pb-2">Registrado por</th>
                    <th className="pb-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAccount.payments.map((p) => (
                    <tr key={p.id} className={isLight ? "border-b border-slate-100" : "border-b border-white/5"}>
                      <td className="py-2.5">{p.paid_on ? String(p.paid_on).slice(0, 10) : "—"}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">S/. {fmt(p.amount)}</td>
                      <td className="py-2.5">{p.method ?? "—"}</td>
                      <td className="py-2.5">{p.reference ?? "—"}</td>
                      <td className="py-2.5">{p.registered_by?.name ?? "Sistema"}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400"
                          onClick={() => setRevertPaymentTarget(p)}
                        >
                          <RotateCcw className="h-3 w-3" /> Revertir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FormModal>

      {/* Modal: Nueva Cuenta por Cobrar Manual */}
      <FormModal
        open={createModal}
        title="Nueva cuenta por cobrar"
        isLight={isLight}
        wide
        onClose={() => { setCreateModal(false); setErr(null); }}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => { setCreateModal(false); setErr(null); }}>
              Cancelar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveCreate()}>
              Guardar obligación
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Cliente *" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={newForm.client_id === "" ? "" : String(newForm.client_id)}
              onChange={(v) => setNewForm({ ...newForm, client_id: v ? Number(v) : "" })}
              options={clients.map((c) => ({ value: c.id, label: c.legal_name }))}
              emptyLabel="Seleccionar cliente…"
            />
          </LabField>

          <LabField label="Proyecto (opcional)" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={newForm.project_id === "" ? "" : String(newForm.project_id)}
              onChange={(v) => setNewForm({ ...newForm, project_id: v ? Number(v) : "" })}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              emptyLabel="Ninguno / Venta directa"
            />
          </LabField>

          {isSuperadmin ? (
            <LabField label="Empresa *" isLight={isLight} className="sm:col-span-2">
              <SmartSelect
                isLight={isLight}
                value={newForm.area_id === "" ? "" : String(newForm.area_id)}
                onChange={(v) => setNewForm({ ...newForm, area_id: v ? Number(v) : "" })}
                options={areas.map((a) => ({ value: a.id, label: a.name }))}
                emptyLabel="Seleccionar empresa…"
              />
            </LabField>
          ) : null}

          <LabField label="Monto Total (S/.) *" isLight={isLight}>
            <input
              type="number"
              step="0.01"
              className={labInputClass(isLight)}
              value={newForm.total_amount}
              onChange={(e) => setNewForm({ ...newForm, total_amount: e.target.value })}
            />
          </LabField>

          <LabField label="Fecha de emisión *" isLight={isLight}>
            <input
              type="date"
              className={labInputClass(isLight)}
              value={newForm.issued_on}
              onChange={(e) => setNewForm({ ...newForm, issued_on: e.target.value })}
            />
          </LabField>

          <LabField label="Fecha de vencimiento *" isLight={isLight} className="sm:col-span-2">
            <input
              type="date"
              className={labInputClass(isLight)}
              value={newForm.due_on}
              onChange={(e) => setNewForm({ ...newForm, due_on: e.target.value })}
            />
          </LabField>

          <LabField label="Notas / Referencia" isLight={isLight} className="sm:col-span-2">
            <textarea
              rows={2}
              className={labInputClass(isLight)}
              placeholder="Descripción del concepto o número de factura..."
              value={newForm.notes}
              onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
            />
          </LabField>

          {err ? <p className="sm:col-span-2 text-sm font-semibold text-red-600">{err}</p> : null}
        </div>
      </FormModal>

      {/* Modal: Editar Cuenta por Cobrar */}
      <FormModal
        open={editModal}
        title="Editar cuenta por cobrar"
        isLight={isLight}
        onClose={() => { setEditModal(false); setActiveAccount(null); }}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => { setEditModal(false); setActiveAccount(null); }}>
              Cancelar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveEdit()}>
              Guardar cambios
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          {activeAccount ? (
            <div className="text-xs text-zinc-500">
              <p><strong>Cliente:</strong> {activeAccount.client?.legal_name}</p>
            </div>
          ) : null}

          <LabField label="Monto total (S/.)" isLight={isLight}>
            <input
              type="number"
              step="0.01"
              className={labInputClass(isLight)}
              value={editForm.total_amount}
              disabled={Number(activeAccount?.paid_amount ?? 0) > 0}
              onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })}
            />
            {Number(activeAccount?.paid_amount ?? 0) > 0 ? (
              <span className="text-[11px] text-amber-600">No se puede modificar el monto total porque la cuenta ya tiene abonos.</span>
            ) : null}
          </LabField>

          <LabField label="Vencimiento proyectado" isLight={isLight}>
            <input
              type="date"
              className={labInputClass(isLight)}
              value={editForm.projected_due_on}
              onChange={(e) => setEditForm({ ...editForm, projected_due_on: e.target.value, due_on: e.target.value })}
            />
          </LabField>

          <LabField label="Fecha de cobro real" isLight={isLight}>
            <input
              type="date"
              className={labInputClass(isLight)}
              value={editForm.collected_on}
              onChange={(e) => setEditForm({ ...editForm, collected_on: e.target.value })}
            />
          </LabField>

          <LabField label="Notas" isLight={isLight}>
            <textarea
              rows={2}
              className={labInputClass(isLight)}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </LabField>
        </div>
      </FormModal>
    </main>
  );
}
