import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { FormModal } from "../xpande/FormModal";
import { LabCircleIconAction, LabNoticeModal } from "../xpande/LabTableKit";
import { deleteJson, getJson, postJson, type LaravelPaginated } from "../xpande/http";
import { SmartSelect } from "../components/SmartSelect";
import { useAuth } from "../context/AuthContext";
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

type PayableRow = {
  id: number;
  payable_type: string;
  vendor_name?: string | null;
  user?: { name?: string };
  description: string;
  total_amount: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
  projected_due_on?: string;
  paid_on?: string | null;
  invoiced_on?: string | null;
  requires_invoice?: boolean;
  status: string;
};

type AreaOpt = { id: number; name: string };
type PaymentMethodOpt = { id: number; code: string; name: string };

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

export function CuentasPorPagarPage() {
  const { isLight } = useApexTheme();
  const { user, isSuperadmin } = useAuth();
  const [rows, setRows] = useState<LaravelPaginated<PayableRow> | null>(null);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOpt[]>([]);
  const [payModal, setPayModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [payRow, setPayRow] = useState<PayableRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<PayableRow | null>(null);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; title: string; message: string } | null>(null);
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
    total_amount: "",
    projected_due_on: new Date().toISOString().slice(0, 10),
    requires_invoice: true,
    description: "",
  });
  const [payrollForm, setPayrollForm] = useState({
    area_id: "" as "" | number,
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
  });

  const load = () => void getJson<LaravelPaginated<PayableRow>>("/api/accounts-payable").then(setRows);
  const primaryAreaId = user?.area_ids?.[0] ?? "";
  const primaryAreaName = areas.find((a) => a.id === primaryAreaId)?.name ?? "Tu empresa asignada";

  useEffect(() => {
    load();
    void getJson<AreaOpt[]>("/api/areas", { active_only: false }).then(setAreas);
    void getJson<PaymentMethodOpt[]>("/api/catalog/payment-methods", { active_only: true }).then(setPaymentMethods);
  }, []);

  const openPay = (r: PayableRow) => {
    setPayRow(r);
    setPayForm({
      amount: String(r.balance_amount ?? ""),
      paid_on: new Date().toISOString().slice(0, 10),
      method: "",
      reference: "",
      notes: "",
    });
    setPayModal(true);
  };

  const savePay = async () => {
    if (!payRow) return;
    try {
      await postJson(`/api/accounts-payable/${payRow.id}/payments`, {
        amount: Number(payForm.amount),
        paid_on: payForm.paid_on,
        method: payForm.method || null,
        reference: payForm.reference || null,
        notes: payForm.notes || null,
      });
      setPayModal(false);
      load();
      setNotice({ variant: "success", title: "Pago registrado", message: "Se generó el egreso en finanzas y se actualizó la obligación." });
    } catch {
      setNotice({ variant: "error", title: "Error", message: "No se pudo registrar el pago." });
    }
  };

  const saveNew = async () => {
    const areaId = isSuperadmin ? newForm.area_id : primaryAreaId;
    if (!newForm.description.trim() || areaId === "" || !newForm.total_amount) {
      setNotice({ variant: "error", title: "Datos incompletos", message: "Complete empresa, monto y descripción." });
      return;
    }
    try {
      await postJson("/api/accounts-payable", {
        payable_type: newForm.payable_type,
        vendor_name: newForm.vendor_name || null,
        area_id: areaId,
        total_amount: Number(newForm.total_amount),
        projected_due_on: newForm.projected_due_on,
        requires_invoice: newForm.requires_invoice,
        description: newForm.description,
      });
      setCreateModal(false);
      load();
      setNotice({ variant: "success", title: "Cuenta por pagar", message: "Obligación registrada con fecha proyectada de pago." });
    } catch {
      setNotice({ variant: "error", title: "Error", message: "No se pudo crear la cuenta por pagar." });
    }
  };

  const generatePayroll = async () => {
    const areaId = isSuperadmin ? payrollForm.area_id : primaryAreaId;
    if (areaId === "") {
      setNotice({ variant: "error", title: "Empresa requerida", message: "Tu usuario no tiene una empresa asignada." });
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
        message: `Se crearon ${res.created} cuentas por pagar (colaboradores con sueldo en la empresa).`,
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
      setNotice({ variant: "error", title: "No se pudo eliminar", message: "Solo se pueden eliminar cuentas por pagar sin pagos registrados." });
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
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => setCreateModal(true)}>
            <Wallet className="h-4 w-4" /> Nueva obligación
          </button>
        }
      />

      <div className={`mb-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-4 ${isLight ? "border-[#E5E7EB] bg-white" : "border-white/[0.06] bg-[#121212]"}`}>
        {isSuperadmin ? (
          <LabField label="Empresa planilla" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={payrollForm.area_id === "" ? "" : String(payrollForm.area_id)}
              onChange={(v) => setPayrollForm({ ...payrollForm, area_id: v ? Number(v) : "" })}
              options={areas.map((a) => ({ value: a.id, label: a.name }))}
              emptyLabel="Seleccionar..."
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

      <div className={labPanelClass(isLight)}>
        {!rows ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
        ) : (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr>
                  <th className={th}>Tipo</th>
                  <th className={th}>Descripción</th>
                  <th className={th}>Beneficiario</th>
                  <th className={th}>Venc. proyectado</th>
                  <th className={th}>Pago real</th>
                  <th className={th}>Factura</th>
                  <th className={th}>Saldo</th>
                  <th className={th}>Estado</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {rows.data.map((r) => (
                  <tr key={r.id} className={isLight ? "border-t border-[#F3F4F6]" : "border-t border-white/[0.06]"}>
                    <td className={td}>{TYPE_LABELS[r.payable_type] ?? r.payable_type}</td>
                    <td className={td}>{r.description}</td>
                    <td className={td}>{r.vendor_name ?? r.user?.name ?? "—"}</td>
                    <td className={td}>{r.projected_due_on ? String(r.projected_due_on).slice(0, 10) : "—"}</td>
                    <td className={td}>{r.paid_on ? String(r.paid_on).slice(0, 10) : "—"}</td>
                    <td className={td}>{r.invoiced_on ? String(r.invoiced_on).slice(0, 10) : r.requires_invoice ? "Pendiente" : "N/A"}</td>
                    <td className={td}>{r.balance_amount}</td>
                    <td className={td}>{PAYABLE_STATUS_LABELS[r.status] ?? r.status}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {Number(r.balance_amount) > 0 ? (
                          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => openPay(r)}>
                            Pagar
                          </button>
                        ) : null}
                        <LabCircleIconAction
                          variant="delete"
                          tooltip="Eliminar"
                          ariaLabel={`Eliminar ${r.description}`}
                          disabled={Number(r.paid_amount) > 0}
                          onClick={() => setDeleteRow(r)}
                        />
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
        message={deleteRow ? `Confirma eliminar "${deleteRow.description}"? Esta accion no puede deshacerse.` : ""}
        confirmText="Eliminar"
        danger
        isLight={isLight}
        onConfirm={() => void removePayable()}
        onCancel={() => setDeleteRow(null)}
      />

      <FormModal open={payModal} title="Registrar pago" isLight={isLight} onClose={() => setPayModal(false)} footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={labGhostBtn(isLight)} onClick={() => setPayModal(false)}>Cancelar</button>
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void savePay()}>Confirmar pago</button>
        </div>
      }>
        <div className="grid gap-3">
          <LabField label="Monto" isLight={isLight}><input className={labInputClass(isLight)} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></LabField>
          <LabField label="Fecha real de pago" isLight={isLight}><input type="date" className={labInputClass(isLight)} value={payForm.paid_on} onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} /></LabField>
          <LabField label="Método" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={payForm.method}
              onChange={(v) => setPayForm({ ...payForm, method: v })}
              options={paymentMethods.map((pm) => ({ value: pm.name, label: pm.name }))}
              emptyLabel="Seleccionar método…"
            />
          </LabField>
          <LabField label="Referencia" isLight={isLight}><input className={labInputClass(isLight)} value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></LabField>
        </div>
      </FormModal>

      <FormModal open={createModal} title="Nueva cuenta por pagar" isLight={isLight} wide onClose={() => setCreateModal(false)} footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={labGhostBtn(isLight)} onClick={() => setCreateModal(false)}>Cancelar</button>
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveNew()}>Guardar</button>
        </div>
      }>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Tipo" isLight={isLight}>
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
          <LabField label="Proveedor / referencia" isLight={isLight}><input className={labInputClass(isLight)} value={newForm.vendor_name} onChange={(e) => setNewForm({ ...newForm, vendor_name: e.target.value })} /></LabField>
          {isSuperadmin ? (
            <LabField label="Empresa" isLight={isLight}>
              <SmartSelect
                isLight={isLight}
                value={newForm.area_id === "" ? "" : String(newForm.area_id)}
                onChange={(v) => setNewForm({ ...newForm, area_id: v ? Number(v) : "" })}
                options={areas.map((a) => ({ value: a.id, label: a.name }))}
                emptyLabel="Seleccionar..."
              />
            </LabField>
          ) : (
            <LabField label="Empresa" isLight={isLight}>
              <input className={labInputClass(isLight)} value={primaryAreaName} disabled />
            </LabField>
          )}
          <LabField label="Monto" isLight={isLight}><input type="number" step="0.01" className={labInputClass(isLight)} value={newForm.total_amount} onChange={(e) => setNewForm({ ...newForm, total_amount: e.target.value })} /></LabField>
          <LabField label="Vencimiento proyectado" isLight={isLight}><input type="date" className={labInputClass(isLight)} value={newForm.projected_due_on} onChange={(e) => setNewForm({ ...newForm, projected_due_on: e.target.value })} /></LabField>
          <LabField label="Descripción" isLight={isLight} className="sm:col-span-2"><input className={labInputClass(isLight)} value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} /></LabField>
          <label className={["flex items-center gap-2 text-sm sm:col-span-2", isLight ? "text-[#374151]" : "text-zinc-200"].join(" ")}>
            <input type="checkbox" checked={newForm.requires_invoice} onChange={(e) => setNewForm({ ...newForm, requires_invoice: e.target.checked })} />
            Requiere factura del proveedor
          </label>
        </div>
      </FormModal>
    </main>
  );
}
