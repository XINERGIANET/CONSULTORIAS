import { AlertTriangle, CheckCircle2, History, Plus, RotateCcw, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { SmartSelect } from "../components/SmartSelect";
import { useAuth } from "../context/AuthContext";
import { useApexTheme } from "../context/ThemeContext";
import { FormModal } from "../xpande/FormModal";
import { LabCircleIconAction, LabNoticeModal, LabTooltip } from "../xpande/LabTableKit";
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

type PayableRow = {
  id: number;
  payable_type: string;
  vendor_name?: string | null;
  user?: { name?: string };
  area_id?: number;
  financial_category_id?: number | null;
  financial_category?: { name?: string } | null;
  description: string;
  notes?: string | null;
  total_amount: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
  projected_due_on?: string;
  paid_on?: string | null;
  invoiced_on?: string | null;
  requires_invoice?: boolean;
  status: string;
  payments?: PaymentRow[];
};

type AreaOpt = { id: number; name: string };
type PaymentMethodOpt = { id: number; code: string; name: string };
type FinCat = { id: number; name: string; type: string };

const TYPE_LABELS: Record<string, string> = {
  supplier: "Proveedor",
  payroll: "Planilla",
  other: "Otro",
};

const PAYABLE_STATUS_LABELS: Record<string, string> = {
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

export function CuentasPorPagarPage() {
  const { isLight } = useApexTheme();
  const { user, isSuperadmin } = useAuth();
  const [rows, setRows] = useState<LaravelPaginated<PayableRow> | null>(null);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOpt[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<FinCat[]>([]);
  const [payModal, setPayModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [activeRow, setActiveRow] = useState<PayableRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<PayableRow | null>(null);
  const [revertPaymentTarget, setRevertPaymentTarget] = useState<PaymentRow | null>(null);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; title: string; message: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [payForm, setPayForm] = useState({
    amount: "",
    paid_on: new Date().toISOString().slice(0, 10),
    method: "",
    reference: "",
    notes: "",
  });

  const [newForm, setNewForm] = useState({
    payable_type: "supplier",
    vendor_name: "",
    area_id: "" as "" | number,
    financial_category_id: "" as "" | number,
    total_amount: "",
    projected_due_on: new Date().toISOString().slice(0, 10),
    requires_invoice: true,
    description: "",
    notes: "",
  });

  const [editForm, setEditForm] = useState({
    vendor_name: "",
    financial_category_id: "" as "" | number,
    total_amount: "",
    projected_due_on: "",
    description: "",
    notes: "",
    requires_invoice: false,
  });

  const [payrollForm, setPayrollForm] = useState({
    area_id: "" as "" | number,
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
  });

  const [filters, setFilters] = useState({ from: "", to: "", status: "" });

  const primaryAreaId = user?.area_ids?.[0] ?? user?.areas?.[0]?.id ?? "";
  const primaryAreaName = areas.find((a) => a.id === primaryAreaId)?.name ?? "Tu empresa asignada";

  const load = () => {
    const params: Record<string, unknown> = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.status) params.status = filters.status;
    void getJson<LaravelPaginated<PayableRow>>("/api/accounts-payable", params).then(setRows);
  };

  useEffect(() => {
    void getJson<AreaOpt[]>("/api/areas", { active_only: false }).then(setAreas);
    void getJson<PaymentMethodOpt[]>("/api/catalog/payment-methods", { active_only: true }).then(setPaymentMethods);
  }, []);

  useEffect(() => {
    const targetAreaId = isSuperadmin ? (newForm.area_id || primaryAreaId) : primaryAreaId;
    if (!targetAreaId) return;
    void getJson<FinCat[]>("/api/catalog/financial-categories", { type: "expense", area_id: targetAreaId }).then(setExpenseCategories);
  }, [isSuperadmin, newForm.area_id, primaryAreaId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const resetFilters = () => setFilters({ from: "", to: "", status: "" });

  const kpis = useMemo(() => {
    if (!rows || !rows.data) return { totalPending: 0, totalOverdue: 0, totalPaid: 0 };
    let totalPending = 0;
    let totalOverdue = 0;
    let totalPaid = 0;

    for (const r of rows.data) {
      const bal = Number(r.balance_amount) || 0;
      const paid = Number(r.paid_amount) || 0;
      totalPaid += paid;
      if (r.status === "overdue") {
        totalOverdue += bal;
      } else if (r.status === "pending" || r.status === "partial") {
        totalPending += bal;
      }
    }

    return { totalPending, totalOverdue, totalPaid };
  }, [rows]);

  const openPay = (r: PayableRow) => {
    setActiveRow(r);
    setPayForm({
      amount: String(r.balance_amount ?? ""),
      paid_on: new Date().toISOString().slice(0, 10),
      method: "",
      reference: "",
      notes: "",
    });
    setErr(null);
    setPayModal(true);
  };

  const openHistory = (r: PayableRow) => {
    setActiveRow(r);
    setHistoryModal(true);
  };

  const openEdit = (r: PayableRow) => {
    setActiveRow(r);
    setEditForm({
      vendor_name: r.vendor_name ?? "",
      financial_category_id: r.financial_category_id ?? "",
      total_amount: String(r.total_amount ?? ""),
      projected_due_on: r.projected_due_on ? String(r.projected_due_on).slice(0, 10) : "",
      description: r.description ?? "",
      notes: r.notes ?? "",
      requires_invoice: Boolean(r.requires_invoice),
    });
    setErr(null);
    setEditModal(true);
  };

  const savePay = async () => {
    if (!activeRow || !payForm.amount) {
      setErr("Monto de pago requerido.");
      return;
    }
    try {
      await postJson(`/api/accounts-payable/${activeRow.id}/payments`, {
        amount: Number(payForm.amount),
        paid_on: payForm.paid_on,
        method: payForm.method || null,
        reference: payForm.reference || null,
        notes: payForm.notes || null,
      });
      setPayModal(false);
      setActiveRow(null);
      load();
      setNotice({ variant: "success", title: "Pago registrado", message: "Se generó el egreso en finanzas y se actualizó el saldo de la obligación." });
    } catch {
      setErr("No se pudo registrar el pago.");
    }
  };

  const saveNew = async () => {
    const areaId = isSuperadmin ? newForm.area_id : primaryAreaId;
    if (!newForm.description.trim() || areaId === "" || !newForm.total_amount) {
      setErr("Complete empresa, monto total y descripción de la obligación.");
      return;
    }
    try {
      await postJson("/api/accounts-payable", {
        payable_type: newForm.payable_type,
        vendor_name: newForm.vendor_name || null,
        area_id: areaId,
        financial_category_id: newForm.financial_category_id === "" ? null : newForm.financial_category_id,
        total_amount: Number(newForm.total_amount),
        projected_due_on: newForm.projected_due_on,
        requires_invoice: newForm.requires_invoice,
        description: newForm.description,
        notes: newForm.notes || null,
      });
      setCreateModal(false);
      load();
      setNotice({ variant: "success", title: "Cuenta por pagar", message: "Obligación registrada correctamente con vencimiento proyectado." });
    } catch {
      setErr("No se pudo crear la cuenta por pagar.");
    }
  };

  const saveEdit = async () => {
    if (!activeRow) return;
    try {
      await putJson(`/api/accounts-payable/${activeRow.id}`, {
        vendor_name: editForm.vendor_name || null,
        financial_category_id: editForm.financial_category_id === "" ? null : editForm.financial_category_id,
        projected_due_on: editForm.projected_due_on,
        description: editForm.description,
        notes: editForm.notes || null,
        total_amount: editForm.total_amount ? Number(editForm.total_amount) : undefined,
        requires_invoice: editForm.requires_invoice,
      });
      setEditModal(false);
      setActiveRow(null);
      load();
      setNotice({ variant: "success", title: "Obligación actualizada", message: "Los datos de la cuenta por pagar fueron guardados." });
    } catch {
      setNotice({ variant: "error", title: "Error", message: "No se pudo actualizar la obligación." });
    }
  };

  const confirmRevertPayment = async () => {
    if (!activeRow || !revertPaymentTarget) return;
    try {
      await deleteJson(`/api/accounts-payable/${activeRow.id}/payments/${revertPaymentTarget.id}`);
      setRevertPaymentTarget(null);
      setHistoryModal(false);
      setActiveRow(null);
      load();
      setNotice({ variant: "success", title: "Pago revertido", message: "Se eliminó el gasto registrado en finanzas y se restauró el saldo pendiente." });
    } catch {
      setNotice({ variant: "error", title: "Error", message: "No se pudo revertir el pago." });
    }
  };

  const generatePayroll = async () => {
    const areaId = isSuperadmin ? payrollForm.area_id : primaryAreaId;
    if (areaId === "") {
      setNotice({ variant: "error", title: "Empresa requerida", message: "Seleccione una empresa para la planilla." });
      return;
    }
    try {
      const res = await postJson<{ created: number }>("/api/accounts-payable/generate-payroll", {
        ...payrollForm,
        area_id: areaId,
      });
      load();
      setNotice({
        variant: "success",
        title: "Planilla generada",
        message: `Se crearon ${res.created} cuentas por pagar de planilla para colaboradores con sueldo configurado.`,
      });
    } catch {
      setNotice({ variant: "error", title: "Error", message: "No se pudo generar la planilla." });
    }
  };

  const removePayable = async () => {
    if (!deleteRow) return;
    try {
      await deleteJson(`/api/accounts-payable/${deleteRow.id}`);
      setDeleteRow(null);
      load();
      setNotice({ variant: "success", title: "Cuenta eliminada", message: "La cuenta por pagar fue eliminada." });
    } catch {
      setNotice({ variant: "error", title: "No se pudo eliminar", message: "Solo se pueden eliminar cuentas por pagar sin abonos registrados. Revierta los pagos primero." });
    }
  };

  const th = "pb-2 pr-3 text-[10px] font-semibold uppercase " + (isLight ? "text-[#6B7280]" : "text-zinc-500");
  const td = "py-2.5 pr-3 text-xs " + (isLight ? "text-[#374151]" : "text-zinc-300");

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Cuentas por pagar" }]} isLight={isLight} />
      <LabPageHeader
        title="Cuentas por pagar"
        subtitle="Proveedores, planilla y obligaciones con vencimiento proyectado vs. pago real."
        isLight={isLight}
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => { setErr(null); setCreateModal(true); }}>
            <Plus className="h-4 w-4" /> Nueva obligación
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className={`rounded-xl border p-4 shadow-sm ${isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-[#121212]"}`}>
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>Pendiente por Pagar</span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <p className={`mt-2 text-xl font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>S/. {fmt(kpis.totalPending)}</p>
          <span className="text-[11px] text-zinc-400">Obligaciones por liquidar</span>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${isLight ? "border-red-200 bg-red-50/40" : "border-red-900/30 bg-red-950/20"}`}>
          <div className="flex items-center justify-between text-xs font-semibold text-red-600 dark:text-red-400">
            <span>Obligaciones Vencidas</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-red-600 dark:text-red-400">S/. {fmt(kpis.totalOverdue)}</p>
          <span className="text-[11px] text-red-500/80">Pagos retrasados</span>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${isLight ? "border-emerald-200 bg-emerald-50/40" : "border-emerald-900/30 bg-emerald-950/20"}`}>
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span>Total Pagado</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">S/. {fmt(kpis.totalPaid)}</p>
          <span className="text-[11px] text-emerald-500/80">Egresos liquidados</span>
        </div>
      </div>

      {/* Control Panel: Generar Planilla & Filtros */}
      <div className={`mb-4 rounded-xl border ${isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-[#121212]"}`}>
        <div className="p-4">
          <p className={["mb-3 text-[10px] font-semibold uppercase tracking-wide", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
            Generar planilla automatizada
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {isSuperadmin ? (
              <LabField label="Empresa planilla" isLight={isLight}>
                <SmartSelect
                  isLight={isLight}
                  value={payrollForm.area_id === "" ? "" : String(payrollForm.area_id)}
                  onChange={(v) => setPayrollForm({ ...payrollForm, area_id: v ? Number(v) : "" })}
                  options={areas.map((a) => ({ value: a.id, label: a.name }))}
                  emptyLabel="Seleccionar empresa..."
                />
              </LabField>
            ) : (
              <div className="flex flex-col justify-end">
                <p className={["mb-1 text-[10px] font-semibold uppercase", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>Empresa planilla</p>
                <p className={["rounded-lg border px-3 py-2 text-sm", isLight ? "border-[#E5E7EB] bg-slate-50 text-[#374151]" : "border-white/[0.08] bg-black/20 text-zinc-300"].join(" ")}>
                  {primaryAreaName}
                </p>
              </div>
            )}
            <LabField label="Año" isLight={isLight}>
              <input type="number" className={labInputClass(isLight)} value={payrollForm.period_year} onChange={(e) => setPayrollForm({ ...payrollForm, period_year: Number(e.target.value) })} />
            </LabField>
            <LabField label="Mes" isLight={isLight}>
              <input type="number" min={1} max={12} className={labInputClass(isLight)} value={payrollForm.period_month} onChange={(e) => setPayrollForm({ ...payrollForm, period_month: Number(e.target.value) })} />
            </LabField>
            <div className="flex items-end">
              <button type="button" className={labGhostBtn(isLight)} onClick={() => void generatePayroll()}>
                Generar planilla mensual
              </button>
            </div>
          </div>
        </div>

        <div className={`border-t p-4 ${isLight ? "border-[#F3F4F6]" : "border-white/[0.06]"}`}>
          <p className={["mb-3 text-[10px] font-semibold uppercase tracking-wide", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
            Filtrar obligaciones
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
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
            {filters.from || filters.to || filters.status ? (
              <div className="flex items-end">
                <button type="button" className={labGhostBtn(isLight)} onClick={resetFilters}>Limpiar filtros</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className={labPanelClass(isLight)}>
        {!rows ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando cuentas por pagar…</p>
        ) : (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead>
                <tr>
                  <th className={th}>Tipo</th>
                  <th className={th}>Descripción / Categoría</th>
                  <th className={th}>Beneficiario / Proveedor</th>
                  <th className={th}>Venc. proyectado</th>
                  <th className={th}>Pago real</th>
                  <th className={th}>Factura</th>
                  <th className={th + " text-right"}>Total</th>
                  <th className={th + " text-right"}>Pagado</th>
                  <th className={th + " text-right"}>Saldo</th>
                  <th className={th}>Estado</th>
                  <th className={th + " text-right"} />
                </tr>
              </thead>
              <tbody>
                {rows.data.map((r) => (
                  <tr key={r.id} className={isLight ? "border-t border-[#F3F4F6]" : "border-t border-white/[0.06]"}>
                    <td className={td + " font-medium"}>{TYPE_LABELS[r.payable_type] ?? r.payable_type}</td>
                    <td className={td}>
                      <span className="font-semibold">{r.description}</span>
                      {r.financial_category?.name ? (
                        <span className="block text-[11px] text-zinc-400">{r.financial_category.name}</span>
                      ) : null}
                    </td>
                    <td className={td}>{r.vendor_name ?? r.user?.name ?? "—"}</td>
                    <td className={td}>{r.projected_due_on ? String(r.projected_due_on).slice(0, 10) : "—"}</td>
                    <td className={td}>{r.paid_on ? String(r.paid_on).slice(0, 10) : "—"}</td>
                    <td className={td}>{r.invoiced_on ? String(r.invoiced_on).slice(0, 10) : r.requires_invoice ? "Pendiente" : "N/A"}</td>
                    <td className={td + " text-right font-medium"}>S/. {fmt(r.total_amount)}</td>
                    <td className={td + " text-right text-emerald-600 dark:text-emerald-400 font-medium"}>S/. {fmt(r.paid_amount)}</td>
                    <td className={
                      td + " text-right font-bold " +
                      (Number(r.balance_amount) > 0 ? (isLight ? "text-amber-700" : "text-amber-400") : "text-zinc-500")
                    }>
                      S/. {fmt(r.balance_amount)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={statusPill(r.status, isLight)}>
                        {PAYABLE_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right align-middle">
                      <div className="flex justify-end gap-1.5">
                        {Number(r.balance_amount) > 0 && r.status !== "cancelled" ? (
                          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => openPay(r)}>
                            Pagar
                          </button>
                        ) : null}

                        {r.payments && r.payments.length > 0 ? (
                          <LabTooltip text="Ver historial de pagos">
                            <button
                              type="button"
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold border ${
                                isLight ? "border-slate-300 bg-slate-100 text-[#374151] hover:bg-slate-200" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                              }`}
                              onClick={() => openHistory(r)}
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                          </LabTooltip>
                        ) : null}

                        <LabCircleIconAction variant="edit" tooltip="Editar obligación" ariaLabel="Editar cuenta por pagar" onClick={() => openEdit(r)} />

                        {Number(r.paid_amount) <= 0 ? (
                          <LabCircleIconAction
                            variant="delete"
                            tooltip="Eliminar"
                            ariaLabel={`Eliminar ${r.description}`}
                            onClick={() => setDeleteRow(r)}
                          />
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

      <LabNoticeModal open={notice !== null} variant={notice?.variant ?? "success"} title={notice?.title ?? ""} message={notice?.message ?? ""} isLight={isLight} onClose={() => setNotice(null)} />
      
      <ConfirmModal
        open={deleteRow !== null}
        title="Eliminar cuenta por pagar"
        message={deleteRow ? `¿Confirma eliminar "${deleteRow.description}" por S/. ${fmt(deleteRow.total_amount)}? Esta acción no se puede deshacer.` : ""}
        confirmText="Eliminar"
        danger
        isLight={isLight}
        onConfirm={() => void removePayable()}
        onCancel={() => setDeleteRow(null)}
      />

      <ConfirmModal
        open={revertPaymentTarget !== null}
        title="Revertir y eliminar pago"
        message={revertPaymentTarget ? `¿Confirma revertir el pago de S/. ${fmt(revertPaymentTarget.amount)} del ${revertPaymentTarget.paid_on}? Se eliminará el egreso registrado en finanzas y se devolverá el saldo a la obligación.` : ""}
        confirmText="Revertir pago"
        danger
        isLight={isLight}
        onConfirm={() => void confirmRevertPayment()}
        onCancel={() => setRevertPaymentTarget(null)}
      />

      {/* Modal: Registrar Pago */}
      <FormModal open={payModal} title="Registrar pago a proveedor / obligación" isLight={isLight} onClose={() => setPayModal(false)} footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={labGhostBtn(isLight)} onClick={() => setPayModal(false)}>Cancelar</button>
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void savePay()}>Confirmar pago</button>
        </div>
      }>
        <div className="grid gap-3">
          {activeRow ? (
            <div className={`rounded-lg p-3 text-xs border ${isLight ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-zinc-300"}`}>
              <p><strong>Beneficiario:</strong> {activeRow.vendor_name ?? activeRow.user?.name ?? activeRow.description}</p>
              <p className="mt-1 font-semibold text-amber-600 dark:text-amber-400">Saldo pendiente: S/. {fmt(activeRow.balance_amount)}</p>
            </div>
          ) : null}

          <LabField label="Monto a pagar (S/.) *" isLight={isLight}>
            <input type="number" step="0.01" className={labInputClass(isLight)} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </LabField>
          
          <LabField label="Fecha real de pago *" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={payForm.paid_on} onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} />
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
            <input className={labInputClass(isLight)} placeholder="Ej: Transferencia BCP Nro..." value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
          </LabField>

          {err ? <p className="text-sm font-semibold text-red-600">{err}</p> : null}
        </div>
      </FormModal>

      {/* Modal: Historial y Reversión de Pagos */}
      <FormModal
        open={historyModal}
        title="Historial de pagos efectuados"
        isLight={isLight}
        wide
        onClose={() => { setHistoryModal(false); setActiveRow(null); }}
        footer={
          <div className="flex justify-end">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => { setHistoryModal(false); setActiveRow(null); }}>
              Cerrar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {activeRow ? (
            <div className={`rounded-xl border p-3.5 text-xs shadow-sm ${
              isLight
                ? "bg-slate-50 border-slate-200 text-slate-800"
                : "bg-white/5 border-white/10 text-zinc-200"
            }`}>
              <p className={`font-bold text-sm mb-1.5 ${isLight ? "text-slate-900" : "text-white"}`}>
                Obligación: {activeRow.description ?? "—"}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium">
                <span>Total: <strong className={isLight ? "text-slate-900 font-semibold" : "text-white font-semibold"}>S/. {fmt(activeRow.total_amount)}</strong></span>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <span>Pagado: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">S/. {fmt(activeRow.paid_amount)}</strong></span>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <span>Saldo pendiente: <strong className={Number(activeRow.balance_amount) > 0 ? "text-red-600 dark:text-red-400 font-bold" : "text-zinc-500 font-semibold"}>S/. {fmt(activeRow.balance_amount)}</strong></span>
              </div>
            </div>
          ) : null}

          {!activeRow?.payments || activeRow.payments.length === 0 ? (
            <p className={`py-6 text-center text-sm ${isLight ? "text-slate-500" : "text-zinc-400"}`}>No hay pagos registrados para esta obligación.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={isLight ? "text-slate-700 border-b border-slate-200 font-bold" : "text-zinc-300 border-b border-white/10 font-bold"}>
                    <th className="pb-2">Fecha</th>
                    <th className="pb-2 text-right">Monto</th>
                    <th className="pb-2">Método</th>
                    <th className="pb-2">Referencia</th>
                    <th className="pb-2">Registrado por</th>
                    <th className="pb-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRow.payments.map((p) => (
                    <tr key={p.id} className={isLight ? "border-b border-slate-100 text-slate-800 hover:bg-slate-50/80" : "border-b border-white/5 text-zinc-200 hover:bg-white/[0.02]"}>
                      <td className={`py-2.5 font-medium ${isLight ? "text-slate-900" : "text-zinc-100"}`}>{p.paid_on ? String(p.paid_on).slice(0, 10) : "—"}</td>
                      <td className="py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">S/. {fmt(p.amount)}</td>
                      <td className={`py-2.5 ${isLight ? "text-slate-800" : "text-zinc-200"}`}>{p.method ?? "—"}</td>
                      <td className={`py-2.5 ${isLight ? "text-slate-800" : "text-zinc-200"}`}>{p.reference ?? "—"}</td>
                      <td className={`py-2.5 ${isLight ? "text-slate-700" : "text-zinc-300"}`}>{p.registered_by?.name ?? "Sistema"}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60 transition-colors"
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

      {/* Modal: Nueva Cuenta por Pagar */}
      <FormModal open={createModal} title="Nueva cuenta por pagar" isLight={isLight} wide onClose={() => { setCreateModal(false); setErr(null); }} footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={labGhostBtn(isLight)} onClick={() => { setCreateModal(false); setErr(null); }}>Cancelar</button>
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveNew()}>Guardar obligación</button>
        </div>
      }>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Tipo *" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={newForm.payable_type}
              onChange={(v) => setNewForm({ ...newForm, payable_type: v })}
              options={[
                { value: "supplier", label: "Proveedor" },
                { value: "payroll", label: "Planilla / practicante" },
                { value: "other", label: "Otro" },
              ]}
            />
          </LabField>

          <LabField label="Beneficiario / Proveedor" isLight={isLight}>
            <input className={labInputClass(isLight)} placeholder="Ej: Amazon Web Services / Razón social" value={newForm.vendor_name} onChange={(e) => setNewForm({ ...newForm, vendor_name: e.target.value })} />
          </LabField>

          {isSuperadmin ? (
            <LabField label="Empresa *" isLight={isLight}>
              <SmartSelect
                isLight={isLight}
                value={newForm.area_id === "" ? "" : String(newForm.area_id)}
                onChange={(v) => setNewForm({ ...newForm, area_id: v ? Number(v) : "" })}
                options={areas.map((a) => ({ value: a.id, label: a.name }))}
                emptyLabel="Seleccionar..."
              />
            </LabField>
          ) : (
            <LabField label="Empresa *" isLight={isLight}>
              <input className={labInputClass(isLight)} value={primaryAreaName} disabled />
            </LabField>
          )}

          <LabField label="Categoría de costo/gasto" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={newForm.financial_category_id === "" ? "" : String(newForm.financial_category_id)}
              onChange={(v) => setNewForm({ ...newForm, financial_category_id: v ? Number(v) : "" })}
              options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
              emptyLabel="Seleccionar categoría…"
            />
          </LabField>

          <LabField label="Monto Total (S/.) *" isLight={isLight}>
            <input type="number" step="0.01" className={labInputClass(isLight)} value={newForm.total_amount} onChange={(e) => setNewForm({ ...newForm, total_amount: e.target.value })} />
          </LabField>

          <LabField label="Vencimiento proyectado *" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={newForm.projected_due_on} onChange={(e) => setNewForm({ ...newForm, projected_due_on: e.target.value })} />
          </LabField>

          <LabField label="Descripción / Concepto *" isLight={isLight} className="sm:col-span-2">
            <input className={labInputClass(isLight)} placeholder="Ej: Servicio de Servidores Cloud Julio 2026" value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} />
          </LabField>

          <label className={["flex items-center gap-2 text-sm sm:col-span-2", isLight ? "text-[#374151]" : "text-zinc-200"].join(" ")}>
            <input type="checkbox" checked={newForm.requires_invoice} onChange={(e) => setNewForm({ ...newForm, requires_invoice: e.target.checked })} />
            Requiere factura del proveedor para la liquidación
          </label>

          {err ? <p className="sm:col-span-2 text-sm font-semibold text-red-600">{err}</p> : null}
        </div>
      </FormModal>

      {/* Modal: Editar Cuenta por Pagar */}
      <FormModal open={editModal} title="Editar cuenta por pagar" isLight={isLight} wide onClose={() => { setEditModal(false); setActiveRow(null); }} footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={labGhostBtn(isLight)} onClick={() => { setEditModal(false); setActiveRow(null); }}>Cancelar</button>
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveEdit()}>Guardar cambios</button>
        </div>
      }>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Beneficiario / Proveedor" isLight={isLight}>
            <input className={labInputClass(isLight)} value={editForm.vendor_name} onChange={(e) => setEditForm({ ...editForm, vendor_name: e.target.value })} />
          </LabField>

          <LabField label="Categoría de costo/gasto" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={editForm.financial_category_id === "" ? "" : String(editForm.financial_category_id)}
              onChange={(v) => setEditForm({ ...editForm, financial_category_id: v ? Number(v) : "" })}
              options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
              emptyLabel="Seleccionar categoría…"
            />
          </LabField>

          <LabField label="Monto Total (S/.)" isLight={isLight}>
            <input
              type="number"
              step="0.01"
              className={labInputClass(isLight)}
              value={editForm.total_amount}
              disabled={Number(activeRow?.paid_amount ?? 0) > 0}
              onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })}
            />
            {Number(activeRow?.paid_amount ?? 0) > 0 ? (
              <span className="text-[11px] text-amber-600">Monto bloqueado porque la cuenta ya tiene abonos.</span>
            ) : null}
          </LabField>

          <LabField label="Vencimiento proyectado" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={editForm.projected_due_on} onChange={(e) => setEditForm({ ...editForm, projected_due_on: e.target.value })} />
          </LabField>

          <LabField label="Descripción" isLight={isLight} className="sm:col-span-2">
            <input className={labInputClass(isLight)} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </LabField>

          <label className={["flex items-center gap-2 text-sm sm:col-span-2", isLight ? "text-[#374151]" : "text-zinc-200"].join(" ")}>
            <input type="checkbox" checked={editForm.requires_invoice} onChange={(e) => setEditForm({ ...editForm, requires_invoice: e.target.checked })} />
            Requiere factura del proveedor
          </label>
        </div>
      </FormModal>
    </main>
  );
}
