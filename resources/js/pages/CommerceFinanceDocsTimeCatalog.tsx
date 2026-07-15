import { Clock, Database, FileText, Landmark, Receipt, Trash2, Wallet } from "lucide-react";
import { LabCircleIconAction } from "../xpande/LabTableKit";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SmartSelect } from "../components/SmartSelect";
import { useAuth } from "../context/AuthContext";
import { FormModal } from "../xpande/FormModal";
import { deleteJson, getJson, postJson, postFormData, putJson, type LaravelPaginated } from "../xpande/http";
import { LabBreadcrumbs, LabField, LabPageHeader, labCrudMainClass, labGhostBtn, labInputClass, labPanelClass, labPrimaryBtn, labStatusPill } from "../xpande/XpandeUi";
import { useApexTheme } from "../context/ThemeContext";

type AreaOpt = { id: number; name: string };
type ClientOpt = { id: number; legal_name: string };
type ProjOpt = { id: number; name: string; areas?: { id: number; name: string }[] };
type FinCat = { id: number; name: string; type: string; area_id?: number | null; area?: { name?: string } | null };
type CurrOpt = { id: number; code: string };
type PaymentMethodOpt = { id: number; code: string; name: string };

const TIME_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  contract: "Contrato",
  quotation: "Cotización",
  voucher: "Comprobante",
  other: "Otro",
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  annual: "Anual",
  one_time: "Único",
};

const PAYMENT_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Cuenta bancaria",
  digital_wallet: "Billetera digital",
  cash: "Efectivo",
  other: "Otro",
};

function canApproveTimes(user: { is_superadmin?: boolean; role_slug?: string | null } | null): boolean {
  if (!user) return false;
  if (user.is_superadmin) return true;
  const s = user.role_slug;
  return s === "admin";
}

function financeActionBtn(kind: "income" | "cost", isLight: boolean): string {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors";
  if (kind === "income") {
    return base + (isLight ? " bg-emerald-600 text-white hover:bg-emerald-700" : " bg-emerald-500 text-black hover:bg-emerald-400");
  }

  return base + (isLight ? " bg-amber-600 text-white hover:bg-amber-700" : " bg-amber-400 text-black hover:bg-amber-300");
}

export function FinanzasHubPage() {
  const { isLight } = useApexTheme();
  const { user, isSuperadmin } = useAuth();
  const [tab, setTab] = useState<"in" | "out" | "flow">("in");
  const [incomes, setIncomes] = useState<LaravelPaginated<Record<string, unknown>> | null>(null);
  const [expenses, setExpenses] = useState<LaravelPaginated<Record<string, unknown>> | null>(null);
  const [cash, setCash] = useState<Record<string, unknown> | null>(null);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [projects, setProjects] = useState<ProjOpt[]>([]);
  const [catsIncome, setCatsIncome] = useState<FinCat[]>([]);
  const [catsExpense, setCatsExpense] = useState<FinCat[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOpt[]>([]);
  const [editingCategory, setEditingCategory] = useState<FinCat | null>(null);
  const [inModal, setInModal] = useState(false);
  const [outModal, setOutModal] = useState(false);
  const [editInId, setEditInId] = useState<number | null>(null);
  const [editOutId, setEditOutId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [inForm, setInForm] = useState({
    financial_category_id: "" as "" | number,
    amount: "",
    recorded_on: new Date().toISOString().slice(0, 10),
    payment_status: "pending",
    area_id: "" as "" | number,
    client_id: "" as "" | number,
    project_id: "" as "" | number,
    description: "",
  });
  const [outForm, setOutForm] = useState({
    financial_category_id: "" as "" | number,
    amount: "",
    recorded_on: new Date().toISOString().slice(0, 10),
    area_id: "" as "" | number,
    client_id: "" as "" | number,
    project_id: "" as "" | number,
    responsible_user_id: "" as "" | number,
    observation: "",
    payment_method: "",
    schedule_payable: false,
    payable_type: "supplier",
    payable_frequency: "monthly",
    vendor_name: "",
    projected_due_on: new Date().toISOString().slice(0, 10),
    requires_invoice: true,
    payable_description: "",
  });

  useEffect(() => {
    void getJson<AreaOpt[]>("/api/areas", { active_only: true }).then(setAreas);
    void getJson<LaravelPaginated<ClientOpt>>("/api/clients", { per_page: 100 }).then((r) => setClients(r.data));
    void getJson<LaravelPaginated<ProjOpt>>("/api/projects", { per_page: 100 }).then((r) => setProjects(r.data));
    void getJson<PaymentMethodOpt[]>("/api/catalog/payment-methods", { active_only: true }).then(setPaymentMethods);
  }, []);

  useEffect(() => {
    const areaId = isSuperadmin ? inForm.area_id : user?.area_ids?.[0];
    if (!areaId) {
      setCatsIncome([]);
      return;
    }

    void getJson<FinCat[]>("/api/catalog/financial-categories", { type: "income", area_id: areaId }).then(setCatsIncome);
  }, [isSuperadmin, inForm.area_id, user?.area_ids]);

  useEffect(() => {
    const areaId = isSuperadmin ? outForm.area_id : user?.area_ids?.[0];
    if (!areaId) {
      setCatsExpense([]);
      return;
    }

    void getJson<FinCat[]>("/api/catalog/financial-categories", { type: "expense", area_id: areaId }).then((list) => {
      if (editingCategory && !list.some((c) => c.id === editingCategory.id)) {
        setCatsExpense([...list, editingCategory]);
      } else {
        setCatsExpense(list);
      }
    });
  }, [isSuperadmin, outForm.area_id, user?.area_ids, editingCategory]);

  useEffect(() => {
    if (tab === "in") void getJson<LaravelPaginated<Record<string, unknown>>>("/api/incomes").then(setIncomes);
    if (tab === "out") void getJson<LaravelPaginated<Record<string, unknown>>>("/api/expenses").then(setExpenses);
    if (tab === "flow") void getJson<Record<string, unknown>>("/api/reports/cash-flow").then(setCash);
  }, [tab]);

  const resetIn = () => {
    setEditInId(null);
    setInForm({
      financial_category_id: "",
      amount: "",
      recorded_on: new Date().toISOString().slice(0, 10),
      payment_status: "pending",
      area_id: "",
      client_id: "",
      project_id: "",
      description: "",
    });
    setErr(null);
  };

  const resetOut = () => {
    setEditOutId(null);
    setEditingCategory(null);
    setOutForm({
      financial_category_id: "",
      amount: "",
      recorded_on: new Date().toISOString().slice(0, 10),
      area_id: "",
      client_id: "",
      project_id: "",
      responsible_user_id: "",
      observation: "",
      payment_method: "",
      schedule_payable: false,
      payable_type: "supplier",
      payable_frequency: "monthly",
      vendor_name: "",
      projected_due_on: new Date().toISOString().slice(0, 10),
      requires_invoice: true,
      payable_description: "",
    });
    setErr(null);
  };

  const fillInEdit = async (id: number) => {
    setErr(null);
    try {
      const r = await getJson<Record<string, unknown>>(`/api/incomes/${id}`);
      setEditInId(id);
      setInForm({
        financial_category_id: typeof r.financial_category_id === "number" ? r.financial_category_id : "",
        amount: String(r.amount ?? ""),
        recorded_on: typeof r.recorded_on === "string" ? r.recorded_on.slice(0, 10) : "",
        payment_status: String(r.payment_status ?? "pending"),
        area_id: typeof r.area_id === "number" ? r.area_id : "",
        client_id: typeof r.client_id === "number" ? r.client_id : "",
        project_id: typeof r.project_id === "number" ? r.project_id : "",
        description: String(r.description ?? ""),
      });
      setInModal(true);
    } catch {
      setErr("No se pudo cargar el ingreso.");
    }
  };

  const saveIn = async () => {
    setErr(null);
    if (inForm.financial_category_id === "" || !inForm.amount) {
      setErr("Categoría y monto son obligatorios.");
      return;
    }
    if (isSuperadmin && inForm.area_id === "") {
      setErr("Seleccione la empresa del ingreso.");
      return;
    }
    const body: Record<string, unknown> = {
      financial_category_id: inForm.financial_category_id,
      area_id: isSuperadmin ? inForm.area_id : undefined,
      amount: Number(inForm.amount),
      recorded_on: inForm.recorded_on,
      payment_status: inForm.payment_status || null,
      client_id: inForm.client_id === "" ? null : inForm.client_id,
      project_id: inForm.project_id === "" ? null : inForm.project_id,
      description: inForm.description || null,
    };
    try {
      if (editInId) await putJson(`/api/incomes/${editInId}`, body);
      else await postJson("/api/incomes", body);
      setInModal(false);
      resetIn();
      void getJson<LaravelPaginated<Record<string, unknown>>>("/api/incomes").then(setIncomes);
    } catch {
      setErr("Error al guardar ingreso.");
    }
  };

  const annulIn = async (id: number) => {
    if (!confirm("¿Anular este ingreso?")) return;
    try {
      await deleteJson(`/api/incomes/${id}`);
      void getJson<LaravelPaginated<Record<string, unknown>>>("/api/incomes").then(setIncomes);
    } catch {
      setErr("No se pudo anular.");
    }
  };

  const fillOutEdit = async (id: number) => {
    setErr(null);
    try {
      const r = await getJson<Record<string, unknown>>(`/api/expenses/${id}`);
      setEditOutId(id);
      setEditingCategory((r.financial_category as FinCat | undefined) ?? null);
      setOutForm({
        financial_category_id: typeof r.financial_category_id === "number" ? r.financial_category_id : "",
        amount: String(r.amount ?? ""),
        recorded_on: typeof r.recorded_on === "string" ? r.recorded_on.slice(0, 10) : "",
        area_id: typeof r.area_id === "number" ? r.area_id : "",
        client_id: typeof r.client_id === "number" ? r.client_id : "",
        project_id: typeof r.project_id === "number" ? r.project_id : "",
        responsible_user_id: typeof r.responsible_user_id === "number" ? r.responsible_user_id : "",
        observation: String(r.observation ?? ""),
        payment_method: String(r.payment_method ?? ""),
        schedule_payable: false,
        payable_type: "supplier",
        payable_frequency: "monthly",
        vendor_name: "",
        projected_due_on: new Date().toISOString().slice(0, 10),
        requires_invoice: true,
        payable_description: "",
      });
      setOutModal(true);
    } catch {
      setErr("No se pudo cargar el costo.");
    }
  };

  const saveOut = async () => {
    setErr(null);
    if (outForm.financial_category_id === "" || !outForm.amount) {
      setErr("Categoría y monto son obligatorios.");
      return;
    }
    if (isSuperadmin && outForm.area_id === "") {
      setErr("Seleccione la empresa del costo.");
      return;
    }
    const body: Record<string, unknown> = {
      financial_category_id: outForm.financial_category_id,
      area_id: isSuperadmin ? outForm.area_id : undefined,
      amount: Number(outForm.amount),
      recorded_on: outForm.recorded_on,
      client_id: outForm.client_id === "" ? null : outForm.client_id,
      project_id: outForm.project_id === "" ? null : outForm.project_id,
      responsible_user_id: outForm.responsible_user_id === "" ? null : outForm.responsible_user_id,
      observation: outForm.observation || null,
      payment_method: outForm.payment_method || null,
    };
    if (!editOutId && outForm.schedule_payable) {
      const categoryName = catsExpense.find((c) => c.id === outForm.financial_category_id)?.name;
      body.schedule_payable = true;
      body.payable_type = outForm.payable_type;
      body.payable_frequency = outForm.payable_frequency;
      body.vendor_name = outForm.vendor_name || null;
      body.projected_due_on = outForm.projected_due_on;
      body.requires_invoice = outForm.requires_invoice;
      body.payable_description = outForm.payable_description || outForm.observation || outForm.vendor_name || categoryName || "Cuenta por pagar";
    }
    try {
      if (editOutId) await putJson(`/api/expenses/${editOutId}`, body);
      else await postJson("/api/expenses", body);
      setOutModal(false);
      resetOut();
      void getJson<LaravelPaginated<Record<string, unknown>>>("/api/expenses").then(setExpenses);
    } catch {
      setErr("Error al guardar costo.");
    }
  };

  const delOut = async (id: number) => {
    if (!confirm("¿Eliminar costo permanentemente?")) return;
    try {
      await deleteJson(`/api/expenses/${id}`);
      void getJson<LaravelPaginated<Record<string, unknown>>>("/api/expenses").then(setExpenses);
    } catch {
      setErr("No se pudo eliminar.");
    }
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Finanzas" }]} isLight={isLight} />
      <LabPageHeader
        title="Finanzas corporativas"
        subtitle="Alta de ingresos/costos, categorías parametrizadas y flujo financiero."
        isLight={isLight}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={tab === "in" ? labPrimaryBtn(isLight) : labGhostBtn(isLight)} onClick={() => setTab("in")}>
            <Wallet className="h-4 w-4" /> Ingresos
          </button>
          <button type="button" className={tab === "out" ? labPrimaryBtn(isLight) : labGhostBtn(isLight)} onClick={() => setTab("out")}>
            <Receipt className="h-4 w-4" /> Costos
          </button>
          <button type="button" className={tab === "flow" ? labPrimaryBtn(isLight) : labGhostBtn(isLight)} onClick={() => setTab("flow")}>
            <Landmark className="h-4 w-4" /> Flujo
          </button>
        </div>
        {tab === "in" ? (
          <button type="button" className={financeActionBtn("income", isLight)} onClick={() => {resetIn(); setInModal(true);}}>
            Nuevo ingreso
          </button>
        ) : null}
        {tab === "out" ? (
          <button type="button" className={financeActionBtn("cost", isLight)} onClick={() => {resetOut(); setOutModal(true);}}>
            Nuevo costo
          </button>
        ) : null}
      </div>
      {err && !(inModal || outModal) ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}

      <div className={labPanelClass(isLight)}>
        {tab === "flow" && cash ? (
          <div className={"text-sm " + (isLight ? "text-[#374151]" : "text-zinc-300")}>
            <p>
              Ingresos totales: <strong>{String((cash.totales as Record<string, unknown>)?.ingresos ?? "")}</strong>
            </p>
            <p>
              Costos totales: <strong>{String((cash.totales as Record<string, unknown>)?.gastos ?? "")}</strong>
            </p>
            <p>
              Balance: <strong>{String((cash.totales as Record<string, unknown>)?.balance ?? "")}</strong>
            </p>
          </div>
        ) : null}
        {tab === "in" && incomes ? (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>
                  <th className="pb-2 uppercase">Fecha</th>
                  <th className="pb-2 uppercase">Detalle</th>
                  <th className="pb-2 text-right uppercase">Monto</th>
                  <th className="pb-2 text-right uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {incomes.data.map((r) => (
                  <tr key={Number(r.id)} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                    <td className="py-2">{String(r.recorded_on ?? "")}</td>
                    <td className="py-2">{String(r.description ?? "—")}</td>
                    <td className="py-2 text-right">S/. {String(r.amount ?? "")}</td>
                    <td className="py-2 text-right align-middle">
                      <div className="flex justify-end gap-2">
                        <LabCircleIconAction variant="edit" tooltip="Editar" ariaLabel="Editar ingreso" onClick={() => void fillInEdit(Number(r.id))} />
                        <LabCircleIconAction variant="cancel" tooltip="Anular" ariaLabel="Anular ingreso" onClick={() => void annulIn(Number(r.id))} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {tab === "out" && expenses ? (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>
                  <th className="pb-2 uppercase">Fecha</th>
                  <th className="pb-2 uppercase">Obs.</th>
                  <th className="pb-2 text-right uppercase">Monto</th>
                  <th className="pb-2 text-right uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.data.map((r) => (
                  <tr key={Number(r.id)} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                    <td className="py-2">{String(r.recorded_on ?? "")}</td>
                    <td className="py-2">{String(r.observation ?? "—")}</td>
                    <td className="py-2 text-right">S/. {String(r.amount ?? "")}</td>
                    <td className="py-2 text-right align-middle">
                      <div className="flex justify-end gap-2">
                        <LabCircleIconAction variant="edit" tooltip="Editar" ariaLabel="Editar costo" onClick={() => void fillOutEdit(Number(r.id))} />
                        <LabCircleIconAction variant="delete" tooltip="Eliminar" ariaLabel="Eliminar costo" onClick={() => void delOut(Number(r.id))} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {(tab === "in" && !incomes) || (tab === "out" && !expenses) ? <p className="text-sm text-zinc-500">Cargando...</p> : null}
      </div>

      <FormModal
        open={inModal}
        title={editInId ? "Editar ingreso" : "Nuevo ingreso"}
        isLight={isLight}
        wide
        onClose={() => {setInModal(false); resetIn();}}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => {setInModal(false); resetIn();}}>Cerrar</button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveIn()}>Guardar</button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {isSuperadmin ? (
            <LabField label="Empresa *" isLight={isLight} className="sm:col-span-2">
              <SmartSelect
                isLight={isLight}
                value={inForm.area_id === "" ? "" : String(inForm.area_id)}
                onChange={(v) => setInForm({ ...inForm, area_id: v ? Number(v) : "", financial_category_id: "" })}
                options={areas.map((a) => ({ value: a.id, label: a.name }))}
                emptyLabel="Seleccionar empresa..."
              />
            </LabField>
          ) : null}
          <LabField label="Categoría (ingreso) *" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              disabled={isSuperadmin && inForm.area_id === ""}
              value={inForm.financial_category_id === "" ? "" : String(inForm.financial_category_id)}
              onChange={(v) => setInForm({ ...inForm, financial_category_id: v ? Number(v) : "" })}
              options={catsIncome.map((c) => ({ value: c.id, label: c.name }))}
              emptyLabel="—"
            />
          </LabField>
          <LabField label="Monto *" isLight={isLight}>
            <input type="number" step="0.01" className={labInputClass(isLight)} value={inForm.amount} onChange={(e) => setInForm({ ...inForm, amount: e.target.value })} />
          </LabField>
          <LabField label="Fecha *" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={inForm.recorded_on} onChange={(e) => setInForm({ ...inForm, recorded_on: e.target.value })} />
          </LabField>
          <LabField label="Estado pago" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={inForm.payment_status}
              onChange={(v) => setInForm({ ...inForm, payment_status: v })}
              options={[
                { value: "pending", label: "Pendiente" },
                { value: "paid", label: "Pagado" },
                { value: "overdue", label: "Vencido" },
                { value: "partial", label: "Parcial" },
                { value: "annulled", label: "Anulado" },
              ]}
            />
          </LabField>
          <LabField label="Cliente (opc.)" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={inForm.client_id === "" ? "" : String(inForm.client_id)}
              onChange={(v) => setInForm({ ...inForm, client_id: v ? Number(v) : "" })}
              options={clients.map((c) => ({ value: c.id, label: c.legal_name }))}
              emptyLabel="—"
            />
          </LabField>
          <LabField label="Proyecto (opc.)" isLight={isLight} className="sm:col-span-2">
            <SmartSelect
              isLight={isLight}
              value={inForm.project_id === "" ? "" : String(inForm.project_id)}
              onChange={(v) => setInForm({ ...inForm, project_id: v ? Number(v) : "" })}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              emptyLabel="—"
            />
          </LabField>
          <LabField label="Descripción" isLight={isLight} className="sm:col-span-2">
            <textarea className={labInputClass(isLight)} rows={2} value={inForm.description} onChange={(e) => setInForm({ ...inForm, description: e.target.value })} />
          </LabField>
          {err ? <p className="sm:col-span-2 text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>

      <FormModal
        open={outModal}
        title={editOutId ? "Editar costo" : "Nuevo costo"}
        isLight={isLight}
        wide
        onClose={() => {setOutModal(false); resetOut();}}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => {setOutModal(false); resetOut();}}>Cerrar</button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveOut()}>Guardar</button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {isSuperadmin ? (
            <LabField label="Empresa *" isLight={isLight} className="sm:col-span-2">
              <SmartSelect
                isLight={isLight}
                value={outForm.area_id === "" ? "" : String(outForm.area_id)}
                onChange={(v) => setOutForm({ ...outForm, area_id: v ? Number(v) : "", financial_category_id: "" })}
                options={areas.map((a) => ({ value: a.id, label: a.name }))}
                emptyLabel="Seleccionar empresa..."
              />
            </LabField>
          ) : null}
          <LabField label="Categoría (costo) *" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              disabled={isSuperadmin && outForm.area_id === ""}
              value={outForm.financial_category_id === "" ? "" : String(outForm.financial_category_id)}
              onChange={(v) => setOutForm({ ...outForm, financial_category_id: v ? Number(v) : "" })}
              options={catsExpense.map((c) => ({ value: c.id, label: c.name }))}
              emptyLabel="—"
            />
          </LabField>
          <LabField label="Monto *" isLight={isLight}>
            <input type="number" step="0.01" className={labInputClass(isLight)} value={outForm.amount} onChange={(e) => setOutForm({ ...outForm, amount: e.target.value })} />
          </LabField>
          <LabField label="Fecha *" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={outForm.recorded_on} onChange={(e) => setOutForm({ ...outForm, recorded_on: e.target.value })} />
          </LabField>
          <LabField label="Cliente (opc.)" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={outForm.client_id === "" ? "" : String(outForm.client_id)}
              onChange={(v) => setOutForm({ ...outForm, client_id: v ? Number(v) : "" })}
              options={clients.map((c) => ({ value: c.id, label: c.legal_name }))}
              emptyLabel="—"
            />
          </LabField>
          <LabField label="Proyecto (opc.)" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={outForm.project_id === "" ? "" : String(outForm.project_id)}
              onChange={(v) => setOutForm({ ...outForm, project_id: v ? Number(v) : "" })}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              emptyLabel="—"
            />
          </LabField>
          <LabField label="Método de pago (opc.)" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={outForm.payment_method}
              onChange={(v) => setOutForm({ ...outForm, payment_method: v })}
              options={paymentMethods.map((pm) => ({ value: pm.name, label: pm.name }))}
              emptyLabel="—"
            />
          </LabField>
          <LabField label="Observación" isLight={isLight} className="sm:col-span-2">
            <textarea className={labInputClass(isLight)} rows={2} value={outForm.observation} onChange={(e) => setOutForm({ ...outForm, observation: e.target.value })} />
          </LabField>
          {!editOutId ? (
            <div className={"sm:col-span-2 rounded-lg border p-3 " + (isLight ? "border-[#E5E7EB] bg-[#F9FAFB]" : "border-white/[0.06] bg-[#0a0a0a]/40")}>
              <label className={["mb-2 flex items-center gap-2 text-sm font-medium", isLight ? "text-[#374151]" : "text-zinc-200"].join(" ")}>
                <input type="checkbox" checked={outForm.schedule_payable} onChange={(e) => setOutForm({ ...outForm, schedule_payable: e.target.checked })} />
                Programar como cuenta por pagar (sin egreso inmediato)
              </label>
              {outForm.schedule_payable ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <LabField label="Tipo" isLight={isLight}>
                    <SmartSelect
                      isLight={isLight}
                      value={outForm.payable_type}
                      onChange={(v) => setOutForm({ ...outForm, payable_type: v })}
                      options={[
                        { value: "supplier", label: "Proveedor" },
                        { value: "payroll", label: "Planilla" },
                        { value: "other", label: "Otro" },
                      ]}
                    />
                  </LabField>
                  <LabField label="Frecuencia" isLight={isLight}>
                    <SmartSelect
                      isLight={isLight}
                      value={outForm.payable_frequency}
                      onChange={(v) => setOutForm({ ...outForm, payable_frequency: v })}
                      options={[
                        { value: "monthly", label: "Mensual" },
                        { value: "one_time", label: "Unico" },
                      ]}
                    />
                  </LabField>
                  <LabField label="Proveedor / referencia" isLight={isLight}>
                    <input className={labInputClass(isLight)} value={outForm.vendor_name} onChange={(e) => setOutForm({ ...outForm, vendor_name: e.target.value })} />
                  </LabField>
                  <LabField label="Vencimiento proyectado" isLight={isLight}>
                    <input type="date" className={labInputClass(isLight)} value={outForm.projected_due_on} onChange={(e) => setOutForm({ ...outForm, projected_due_on: e.target.value })} />
                  </LabField>
                  <LabField label="Descripción CxP" isLight={isLight}>
                    <input className={labInputClass(isLight)} value={outForm.payable_description} onChange={(e) => setOutForm({ ...outForm, payable_description: e.target.value })} />
                  </LabField>
                  <label className={["flex items-center gap-2 text-xs sm:col-span-2", isLight ? "text-[#6B7280]" : "text-zinc-400"].join(" ")}>
                    <input type="checkbox" checked={outForm.requires_invoice} onChange={(e) => setOutForm({ ...outForm, requires_invoice: e.target.checked })} />
                    Esperar factura del proveedor
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
          {err ? <p className="sm:col-span-2 text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>

    </main>
  );
}

export function TimeEntriesPage() {
  const { isLight } = useApexTheme();
  const { user, isSuperadmin } = useAuth();
  const [rows, setRows] = useState<LaravelPaginated<Record<string, unknown>> | null>(null);
  const [projects, setProjects] = useState<ProjOpt[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "" as "" | number,
    work_date: new Date().toISOString().slice(0, 10),
    hours: "1",
    description: "",
    user_id: "" as "" | number,
    area_id: "" as "" | number,
  });
  const canReview = useMemo(() => canApproveTimes(user), [user]);
  const selectedProject = projects.find((p) => p.id === form.project_id);
  const candidateAreas = (selectedProject?.areas ?? []).filter((a) => isSuperadmin || user?.area_ids?.includes(a.id));
  const needsAreaChoice = !editId && candidateAreas.length > 1;

  const load = () => void getJson<LaravelPaginated<Record<string, unknown>>>("/api/time-entries").then(setRows);

  useEffect(() => {
    load();
    void getJson<LaravelPaginated<ProjOpt>>("/api/projects", { per_page: 150 }).then((r) => setProjects(r.data));
    void getJson<{ id: number; name: string }[]>("/api/collaborators").then(setUsers);
  }, []);

  const reset = () => {
    setEditId(null);
    setForm({
      project_id: "",
      work_date: new Date().toISOString().slice(0, 10),
      hours: "1",
      description: "",
      user_id: "",
      area_id: "",
    });
    setErr(null);
  };

  const startEdit = (r: Record<string, unknown>) => {
    reset();
    setEditId(Number(r.id));
    setForm({
      project_id: typeof r.project_id === "number" ? r.project_id : "",
      work_date: typeof r.work_date === "string" ? r.work_date.slice(0, 10) : "",
      hours: String(r.hours ?? "1"),
      description: String(r.description ?? ""),
      user_id: "",
      area_id: "",
    });
    setOpen(true);
  };

  const save = async () => {
    setErr(null);
    if (!editId && form.project_id === "") {
      setErr("Proyecto es obligatorio.");
      return;
    }
    if (needsAreaChoice && form.area_id === "") {
      setErr("Este proyecto pertenece a varias empresas: seleccione a cuál asignar el registro.");
      return;
    }
    try {
      if (editId) {
        await putJson(`/api/time-entries/${editId}`, {
          work_date: form.work_date,
          hours: Number(form.hours),
          description: form.description || null,
        });
      } else {
        const body: Record<string, unknown> = {
          project_id: form.project_id,
          work_date: form.work_date,
          hours: Number(form.hours),
          description: form.description || null,
        };
        if (canReview && form.user_id !== "") body.user_id = form.user_id;
        if (form.area_id !== "") body.area_id = form.area_id;
        await postJson("/api/time-entries", body);
      }
      setOpen(false);
      reset();
      load();
    } catch {
      setErr("No se pudo guardar.");
    }
  };

  const review = async (id: number, status: "approved" | "rejected") => {
    try {
      await postJson(`/api/time-entries/${id}/review`, { status });
      load();
    } catch {
      setErr("Sin permiso o error al revisar.");
    }
  };

  const del = async (id: number) => {
    if (!confirm("¿Eliminar registro horario?")) return;
    try {
      await deleteJson(`/api/time-entries/${id}`);
      load();
    } catch {
      setErr("No se pudo eliminar.");
    }
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Tiempos" }]} isLight={isLight} />
      <LabPageHeader
        title="Registro horario"
        subtitle="Carga manual con validación para gerentes de área."
        isLight={isLight}
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => {reset(); setOpen(true);}}>
            <Clock className="h-4 w-4" /> Nuevo registro
          </button>
        }
      />
      {err && !open ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}

      <div className={labPanelClass(isLight)}>
        {!rows ? (
          <p className="py-10 text-center text-sm text-zinc-500">Cargando…</p>
        ) : (
          <div className="space-y-2">
            {rows.data.map((r: Record<string, unknown>) => {
              const pj = r.project as { name?: string } | undefined;
              const st = String(r.status ?? "");
              return (
                <div key={Number(r.id)} className={"flex flex-wrap items-center justify-between gap-2 border-b py-3 text-xs " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                  <div className={"font-medium " + (isLight ? "text-[#111827]" : "text-white")}>{pj?.name ?? "Proyecto"}</div>
                  <div>{String(r.work_date ?? "")}</div>
                  <div>{String(r.hours ?? "")} h</div>
                  <span className={labStatusPill(st === "approved" ? "ok" : "neutral", isLight)}>{TIME_STATUS_LABELS[st] ?? st}</span>
                  <div className="flex flex-wrap gap-2">
                    <LabCircleIconAction variant="edit" tooltip="Editar" ariaLabel="Editar registro" onClick={() => startEdit(r)} />
                    {canReview && st === "pending" ? (
                      <>
                        <LabCircleIconAction variant="finish" tooltip="Aprobar" ariaLabel="Aprobar registro" onClick={() => void review(Number(r.id), "approved")} />
                        <LabCircleIconAction variant="cancel" tooltip="Rechazar" ariaLabel="Rechazar registro" onClick={() => void review(Number(r.id), "rejected")} />
                      </>
                    ) : null}
                    <LabCircleIconAction variant="delete" tooltip="Borrar" ariaLabel="Borrar registro" onClick={() => void del(Number(r.id))} />
                  </div>
                </div>
              );
            })}
            {!rows.data.length ? <p className="text-sm text-zinc-500">Sin registros.</p> : null}
          </div>
        )}
      </div>

      <FormModal
        open={open}
        title={editId ? "Editar tiempo" : "Registrar tiempo"}
        isLight={isLight}
        wide
        onClose={() => {setOpen(false); reset();}}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => {setOpen(false); reset();}}>Cerrar</button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void save()}>Guardar</button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {!editId && canReview ? (
            <LabField label="Usuario (solo gestores)" isLight={isLight} className="sm:col-span-2">
              <SmartSelect
                isLight={isLight}
                value={form.user_id === "" ? "" : String(form.user_id)}
                onChange={(v) => setForm({ ...form, user_id: v ? Number(v) : "" })}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                emptyLabel="Yo mismo"
              />
            </LabField>
          ) : null}
          {!editId ? (
            <LabField label="Proyecto *" isLight={isLight} className="sm:col-span-2">
              <SmartSelect
                isLight={isLight}
                value={form.project_id === "" ? "" : String(form.project_id)}
                onChange={(v) => setForm({ ...form, project_id: v ? Number(v) : "" })}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                emptyLabel="—"
              />
            </LabField>
          ) : (
            <p className={"sm:col-span-2 text-xs " + (isLight ? "text-[#6B7280]" : "text-zinc-500")}>El proyecto no se altera desde esta edición.</p>
          )}
          {needsAreaChoice ? (
            <LabField label="Empresa *" isLight={isLight} className="sm:col-span-2">
              <SmartSelect
                isLight={isLight}
                value={form.area_id === "" ? "" : String(form.area_id)}
                onChange={(v) => setForm({ ...form, area_id: v ? Number(v) : "" })}
                options={candidateAreas.map((a) => ({ value: a.id, label: a.name }))}
                emptyLabel="Seleccionar empresa..."
              />
            </LabField>
          ) : null}
          <LabField label="Fecha labor" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} />
          </LabField>
          <LabField label="Horas *" isLight={isLight}>
            <input type="number" step="0.25" min="0.01" className={labInputClass(isLight)} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          </LabField>
          <LabField label="Descripción" isLight={isLight} className="sm:col-span-2">
            <textarea className={labInputClass(isLight)} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </LabField>
          {err ? <p className="sm:col-span-2 text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>
    </main>
  );
}

export function DocumentsPage() {
  const { isLight } = useApexTheme();
  const { user, isSuperadmin } = useAuth();
  const primaryAreaId = user?.area_ids?.[0] ?? "";
  const [rows, setRows] = useState<LaravelPaginated<Record<string, unknown>> | null>(null);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [projects, setProjects] = useState<ProjOpt[]>([]);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const scopedAreas = isSuperadmin ? areas : areas.filter((a) => user?.area_ids?.includes(a.id));
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({
    title: "",
    doc_type: "contract",
    client_id: "" as "" | number,
    project_id: "" as "" | number,
    area_id: "" as "" | number,
    contract_total: "",
    contract_due_on: "",
    register_payment: false,
    payment_amount: "",
    payment_paid_on: new Date().toISOString().slice(0, 10),
    payment_method: "",
    payment_reference: "",
  });

  const load = () => void getJson<LaravelPaginated<Record<string, unknown>>>("/api/documents").then(setRows);

  useEffect(() => {
    load();
    void getJson<LaravelPaginated<ClientOpt>>("/api/clients", { per_page: 100 }).then((r) => setClients(r.data));
    void getJson<LaravelPaginated<ProjOpt>>("/api/projects", { per_page: 120 }).then((r) => setProjects(r.data));
    void getJson<AreaOpt[]>("/api/areas", { active_only: false }).then(setAreas);
    void getJson<PaymentMethodOpt[]>("/api/catalog/payment-methods", { active_only: true }).then(setPaymentMethods);
  }, []);

  const upload = async () => {
    setErr(null);
    if (!file || !meta.title.trim()) {
      setErr("Archivo y título obligatorios.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", meta.title.trim());
      fd.append("doc_type", meta.doc_type);
      if (meta.client_id !== "") fd.append("client_id", String(meta.client_id));
      if (meta.project_id !== "") fd.append("project_id", String(meta.project_id));
      if (meta.area_id !== "") fd.append("area_id", String(meta.area_id));
      if (meta.doc_type === "contract" && meta.contract_total) {
        fd.append("contract_total", meta.contract_total);
        if (meta.contract_due_on) fd.append("contract_due_on", meta.contract_due_on);
        if (meta.register_payment) {
          fd.append("register_payment", "1");
          if (meta.payment_amount) fd.append("payment_amount", meta.payment_amount);
          fd.append("payment_paid_on", meta.payment_paid_on);
          if (meta.payment_method) fd.append("payment_method", meta.payment_method);
          if (meta.payment_reference) fd.append("payment_reference", meta.payment_reference);
        }
      }
      await postFormData<unknown>("/api/documents", fd);
      setOpen(false);
      setFile(null);
      setMeta({ title: "", doc_type: "contract", client_id: "", project_id: "", area_id: isSuperadmin ? "" : primaryAreaId, contract_total: "", contract_due_on: "", register_payment: false, payment_amount: "", payment_paid_on: new Date().toISOString().slice(0, 10), payment_method: "", payment_reference: "" });
      load();
    } catch {
      setErr("Error al subir (tamaño máx. 15MB).");
    }
  };

  const remove = async (id: number) => {
    if (!confirm("¿Eliminar documento?")) return;
    try {
      await deleteJson(`/api/documents/${id}`);
      load();
    } catch {
      setErr("No se pudo eliminar.");
    }
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Documentos" }]} isLight={isLight} />
      <LabPageHeader
        title="Gestión documental"
        subtitle="Carga mediante formulario multipart hacia la API."
        isLight={isLight}
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => {setErr(null); setMeta((m) => ({ ...m, area_id: isSuperadmin ? m.area_id : primaryAreaId })); setOpen(true);}}>
            <FileText className="h-4 w-4" /> Subir
          </button>
        }
      />
      {err && !open ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}

      <div className={labPanelClass(isLight)}>
        {!rows ? (
          <p className="py-10 text-center text-xs text-zinc-500">Cargando…</p>
        ) : (
          <div className="space-y-2">
            {rows.data.map((d: Record<string, unknown>) => (
              <div key={Number(d.id)} className={"flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">{String(d.title)}</p>
                    <p className={isLight ? "text-[10px] text-[#6B7280]" : "text-[10px] text-zinc-500"}>{DOC_TYPE_LABELS[String(d.doc_type)] ?? String(d.doc_type)} · v{String(d.version ?? 1)}</p>
                  </div>
                </div>
                <button type="button" className={labGhostBtn(isLight)} onClick={() => void remove(Number(d.id))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!rows.data.length ? <p className="text-sm text-zinc-500">Sin documentos.</p> : null}
          </div>
        )}
      </div>

      <FormModal
        open={open}
        title="Nuevo documento"
        isLight={isLight}
        wide
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setOpen(false)}>Cerrar</button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void upload()}>Subir</button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Archivo *" isLight={isLight} className="sm:col-span-2">
            <input type="file" className={labInputClass(isLight)} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </LabField>
          <LabField label="Título *" isLight={isLight} className="sm:col-span-2">
            <input className={labInputClass(isLight)} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          </LabField>
          <LabField label="Tipo" isLight={isLight} className="sm:col-span-2">
            <SmartSelect
              isLight={isLight}
              value={meta.doc_type}
              onChange={(v) => setMeta({ ...meta, doc_type: v })}
              options={[
                { value: "contract", label: "Contrato" },
                { value: "quotation", label: "Cotización" },
                { value: "voucher", label: "Comprobante" },
                { value: "other", label: "Otro" },
              ]}
            />
          </LabField>
          <LabField label="Cliente" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={meta.client_id === "" ? "" : String(meta.client_id)}
              onChange={(v) => setMeta({ ...meta, client_id: v ? Number(v) : "" })}
              options={clients.map((c) => ({ value: c.id, label: c.legal_name }))}
              emptyLabel="—"
            />
          </LabField>
          <LabField label="Proyecto" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={meta.project_id === "" ? "" : String(meta.project_id)}
              onChange={(v) => setMeta({ ...meta, project_id: v ? Number(v) : "" })}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              emptyLabel="—"
            />
          </LabField>
          <LabField label="Área" isLight={isLight} className="sm:col-span-2">
            <SmartSelect
              isLight={isLight}
              value={meta.area_id === "" ? "" : String(meta.area_id)}
              onChange={(v) => setMeta({ ...meta, area_id: v ? Number(v) : "" })}
              options={scopedAreas.map((a) => ({ value: a.id, label: a.name }))}
              disabled={!isSuperadmin}
              emptyLabel="—"
            />
          </LabField>
          {meta.doc_type === "contract" ? (
            <>
              <LabField label="Monto total contrato" isLight={isLight}>
                <input type="number" step="0.01" className={labInputClass(isLight)} value={meta.contract_total} onChange={(e) => setMeta({ ...meta, contract_total: e.target.value })} />
              </LabField>
              <LabField label="Fecha vencimiento" isLight={isLight}>
                <input type="date" className={labInputClass(isLight)} value={meta.contract_due_on} onChange={(e) => setMeta({ ...meta, contract_due_on: e.target.value })} />
              </LabField>
              <LabField label="Pago inmediato" isLight={isLight} className="sm:col-span-2">
                <label className={(isLight ? "text-[#374151]" : "text-zinc-200") + " flex gap-2 text-sm"}>
                  <input type="checkbox" checked={meta.register_payment} onChange={(e) => setMeta({ ...meta, register_payment: e.target.checked, payment_amount: e.target.checked ? meta.contract_total : meta.payment_amount })} /> Registrar pago al crear contrato
                </label>
              </LabField>
              {meta.register_payment ? (
                <>
                  <LabField label="Monto pagado" isLight={isLight}>
                    <input type="number" step="0.01" className={labInputClass(isLight)} value={meta.payment_amount} onChange={(e) => setMeta({ ...meta, payment_amount: e.target.value })} />
                  </LabField>
                  <LabField label="Fecha de pago" isLight={isLight}>
                    <input type="date" className={labInputClass(isLight)} value={meta.payment_paid_on} onChange={(e) => setMeta({ ...meta, payment_paid_on: e.target.value })} />
                  </LabField>
                  <LabField label="Metodo" isLight={isLight}>
                    <SmartSelect
                      isLight={isLight}
                      value={meta.payment_method}
                      onChange={(v) => setMeta({ ...meta, payment_method: v })}
                      options={paymentMethods.map((method) => ({ value: method.name, label: method.name }))}
                      emptyLabel="Seleccionar..."
                    />
                  </LabField>
                  <LabField label="Referencia" isLight={isLight}>
                    <input className={labInputClass(isLight)} value={meta.payment_reference} onChange={(e) => setMeta({ ...meta, payment_reference: e.target.value })} />
                  </LabField>
                </>
              ) : null}
            </>
          ) : null}
          {err ? <p className="sm:col-span-2 text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>
    </main>
  );
}

type CatSlug = "financial-categories" | "currencies" | "services" | "tax-rates" | "cargos" | "tariffs" | "statuses" | "payment-accounts" | "payment-methods";

function catalogColumnTitles(cat: CatSlug): string[] {
  switch (cat) {
    case "financial-categories":
      return ["ID", "Nombre", "Tipo", "Empresa", "Activo"];
    case "currencies":
      return ["ID", "Código", "Nombre", "Símbolo"];
    case "services":
      return ["ID", "Servicio", "Área"];
    case "tax-rates":
      return ["ID", "Nombre", "% tasa"];
    case "cargos":
      return ["ID", "Nombre"];
    case "tariffs":
      return ["ID", "Nombre", "Tipo", "Monto", "Moneda", "Área"];
    case "statuses":
      return ["ID", "Categoría", "Código", "Etiqueta", "Orden"];
    case "payment-accounts":
      return ["ID", "Nombre", "Tipo", "Banco", "Nro. Cuenta", "CCI", "Icono"];
    case "payment-methods":
      return ["ID", "Codigo", "Nombre", "Activo"];
    default:
      return ["ID"];
  }
}

function catalogRowCells(cat: CatSlug, r: Record<string, unknown>, td: string, isLight: boolean): ReactNode[] {
  const id = String(r.id ?? "—");
  const mono = isLight ? "font-mono text-[11px] text-[#6B7280]" : "font-mono text-[11px] text-zinc-500";
  switch (cat) {
    case "financial-categories":
      const ar = r.area as { name?: string } | undefined;
      const areaText = ar?.name ?? (r.area_id != null ? `#${r.area_id}` : "General");
      return [
        <td key="i" className={td + " " + mono}>{id}</td>,
        <td key="n" className={td + " font-medium"}>{String(r.name ?? "")}</td>,
        <td key="t" className={td}>{r.type === "expense" ? "Costo" : "Ingreso"}</td>,
        <td key="ar" className={td}>{areaText}</td>,
        <td key="a" className={td}>{r.is_active === false ? "No" : "Sí"}</td>,
      ];
    case "currencies":
      return [
        <td key="i" className={td + " " + mono}>{id}</td>,
        <td key="c" className={td}>{String(r.code ?? "")}</td>,
        <td key="n" className={td + " font-medium"}>{String(r.name ?? "")}</td>,
        <td key="s" className={td}>{String(r.symbol ?? "—")}</td>,
      ];
    case "services": {
      const ar = r.area as { name?: string } | undefined;
      const arTxt = ar?.name ?? (r.area_id != null ? `#${r.area_id}` : "—");
      return [
        <td key="i" className={td + " " + mono}>{id}</td>,
        <td key="n" className={td + " font-medium"}>{String(r.name ?? "")}</td>,
        <td key="k" className={td}>{r.kind === "saas" ? "SaaS" : r.kind === "product" ? "Producto" : "Servicio"}</td>,
        <td key="bc" className={td}>{BILLING_CYCLE_LABELS[String(r.billing_cycle ?? "")] ?? String(r.billing_cycle ?? "Sin ciclo")}</td>,
        <td key="bp" className={td}>{String(r.base_price ?? "Sin precio")}</td>,
        <td key="a" className={td + " text-[11px]"}>{arTxt}</td>,
      ];
    }
    case "tax-rates":
      return [
        <td key="i" className={td + " " + mono}>{id}</td>,
        <td key="n" className={td + " font-medium"}>{String(r.name ?? "")}</td>,
        <td key="p" className={td}>{String(r.rate_percent ?? "")}</td>,
      ];
    case "cargos":
      return [
        <td key="i" className={td + " " + mono}>{id}</td>,
        <td key="n" className={td + " font-medium"}>{String(r.name ?? "")}</td>,
      ];
    case "tariffs": {
      const cur = r.currency as { code?: string } | undefined;
      const curTxt = cur?.code ?? (r.currency_id != null ? `#${r.currency_id}` : "—");
      const ar = r.area as { name?: string } | undefined;
      const arTxt = ar?.name ?? (r.area_id != null ? `#${r.area_id}` : "—");
      return [
        <td key="i" className={td + " " + mono}>{id}</td>,
        <td key="n" className={td + " font-medium"}>{String(r.name ?? "")}</td>,
        <td key="rt" className={td}>{String(r.rate_type ?? "")}</td>,
        <td key="am" className={td}>{String(r.amount ?? "")}</td>,
        <td key="cu" className={td}>{curTxt}</td>,
        <td key="ar" className={td + " text-[11px]"}>{arTxt}</td>,
      ];
    }
    case "statuses":
      return [
        <td key="i" className={td + " " + mono}>{id}</td>,
        <td key="c" className={td}>{String(r.category ?? "")}</td>,
        <td key="cd" className={td}>{String(r.code ?? "")}</td>,
        <td key="l" className={td + " font-medium"}>{String(r.label ?? "")}</td>,
        <td key="o" className={td}>{String(r.sort_order ?? "")}</td>,
      ];
    case "payment-accounts":
      return [
        <td key="i" className={td + " " + mono}>{id}</td>,
        <td key="n" className={td + " font-medium"}>{String(r.name ?? "")}</td>,
        <td key="t" className={td}>{PAYMENT_ACCOUNT_TYPE_LABELS[String(r.type ?? "")] ?? String(r.type ?? "")}</td>,
        <td key="b" className={td}>{String(r.bank_name ?? "—")}</td>,
        <td key="a" className={td}>{String(r.account_number ?? "—")}</td>,
        <td key="cci" className={td}>{String(r.cci ?? "—")}</td>,
        <td key="ic" className={td}>{String(r.icon ?? "—")}</td>,
      ];
    case "payment-methods":
      return [
        <td key="i" className={td + " " + mono}>{id}</td>,
        <td key="c" className={td}>{String(r.code ?? "")}</td>,
        <td key="n" className={td + " font-medium"}>{String(r.name ?? "")}</td>,
        <td key="a" className={td}>{r.is_active === false ? "No" : "Si"}</td>,
      ];
    default:
      return [<td key="x" className={td}>{id}</td>];
  }
}

export function CatalogosAdminPage() {
  const { isLight } = useApexTheme();
  const { user, isSuperadmin } = useAuth();
  const primaryAreaId = user?.area_ids?.[0] != null ? String(user.area_ids[0]) : "";
  const [cat, setCat] = useState<CatSlug>("financial-categories");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [curr, setCurr] = useState<CurrOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  interface CurRow { code: string; name: string; symbol: string }
  interface FiRow { name: string; type: "income" | "expense"; area_id: string }
  interface SvcRow { name: string; kind: string; area_id: string; billing_cycle: string; base_price: string; description: string }
  interface TxRow { name: string; rate_percent: string }
  interface CgRow { name: string }
  interface TfRow { name: string; rate_type: string; amount: string; currency_id: string; area_id: string }
  interface StRow { category: string; code: string; label: string; sort_order: string }
  interface PaRow { name: string; type: string; bank_name: string; account_number: string; cci: string; currency: string; holder_name: string; icon: string; is_active: boolean }
  interface PmRow { code: string; name: string; is_active: boolean }

  const [formFin, setFormFin] = useState<FiRow>({ name: "", type: "income", area_id: isSuperadmin ? "" : primaryAreaId });
  const [formCur, setFormCur] = useState<CurRow>({ code: "", name: "", symbol: "" });
  const [formSvc, setFormSvc] = useState<SvcRow>({ name: "", kind: "service", area_id: "", billing_cycle: "", base_price: "", description: "" });
  const [formTx, setFormTx] = useState<TxRow>({ name: "", rate_percent: "" });
  const [formCg, setFormCg] = useState<CgRow>({ name: "" });
  const [formTf, setFormTf] = useState<TfRow>({ name: "", rate_type: "hourly", amount: "", currency_id: "", area_id: "" });
  const [formSt, setFormSt] = useState<StRow>({ category: "pipeline", code: "", label: "", sort_order: "0" });
  const [formPa, setFormPa] = useState<PaRow>({ name: "", type: "bank", bank_name: "", account_number: "", cci: "", currency: "PEN", holder_name: "", icon: "", is_active: true });
  const [formPm, setFormPm] = useState<PmRow>({ code: "", name: "", is_active: true });

  const catalogUrl = (slug: CatSlug) => `/api/catalog/${slug === "statuses" ? "statuses" : slug}`;

  useEffect(() => {
    void getJson<AreaOpt[]>("/api/areas", { active_only: false }).then(setAreas);
    void getJson<CurrOpt[]>("/api/catalog/currencies").then(setCurr);
  }, []);

  const loadCatalog = () => {
    void getJson<unknown>(catalogUrl(cat)).then((raw) => {
      const arr = Array.isArray(raw) ? raw : [];
      setRows(arr as Record<string, unknown>[]);
    });
  };

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  const closeModal = () => {
    setOpen(false);
    setEditRow(null);
    setErr(null);
    setFormFin({ name: "", type: "income", area_id: isSuperadmin ? "" : primaryAreaId });
    setFormCur({ code: "", name: "", symbol: "" });
    setFormSvc({ name: "", kind: "service", area_id: isSuperadmin ? "" : primaryAreaId, billing_cycle: "", base_price: "", description: "" });
    setFormTx({ name: "", rate_percent: "" });
    setFormCg({ name: "" });
    setFormTf({ name: "", rate_type: "hourly", amount: "", currency_id: "", area_id: isSuperadmin ? "" : primaryAreaId });
    setFormSt({ category: "pipeline", code: "", label: "", sort_order: "0" });
    setFormPa({ name: "", type: "bank", bank_name: "", account_number: "", cci: "", currency: "PEN", holder_name: "", icon: "", is_active: true });
    setFormPm({ code: "", name: "", is_active: true });
  };

  const parseId = (r: Record<string, unknown>): number => Number(r.id);

  const startEdit = (r: Record<string, unknown>) => {
    setEditRow(r);
    if (cat === "financial-categories") setFormFin({ name: String(r.name ?? ""), type: (r.type === "expense" ? "expense" : "income"), area_id: r.area_id != null ? String(r.area_id) : "" });
    if (cat === "currencies") setFormCur({ code: String(r.code ?? ""), name: String(r.name ?? ""), symbol: String(r.symbol ?? "") });
    if (cat === "services") setFormSvc({ name: String(r.name ?? ""), kind: String(r.kind ?? "service"), area_id: r.area_id != null ? String(r.area_id) : "", billing_cycle: String(r.billing_cycle ?? ""), base_price: String(r.base_price ?? ""), description: String(r.description ?? "") });
    if (cat === "tax-rates") setFormTx({ name: String(r.name ?? ""), rate_percent: String(r.rate_percent ?? "") });
    if (cat === "cargos") setFormCg({ name: String(r.name ?? "") });
    if (cat === "tariffs") setFormTf({ name: String(r.name ?? ""), rate_type: String(r.rate_type ?? "hourly"), amount: String(r.amount ?? ""), currency_id: r.currency_id != null ? String(r.currency_id) : "", area_id: r.area_id != null ? String(r.area_id) : "" });
    if (cat === "statuses") setFormSt({ category: String(r.category ?? "pipeline"), code: String(r.code ?? ""), label: String(r.label ?? ""), sort_order: String(r.sort_order ?? "0") });
    if (cat === "payment-accounts") setFormPa({ name: String(r.name ?? ""), type: String(r.type ?? "bank"), bank_name: String(r.bank_name ?? ""), account_number: String(r.account_number ?? ""), cci: String(r.cci ?? ""), currency: String(r.currency ?? "PEN"), holder_name: String(r.holder_name ?? ""), icon: String(r.icon ?? ""), is_active: Boolean(r.is_active ?? true) });
    if (cat === "payment-methods") setFormPm({ code: String(r.code ?? ""), name: String(r.name ?? ""), is_active: Boolean(r.is_active ?? true) });
    setErr(null);
    setOpen(true);
  };

  const saveCatalog = async () => {
    setErr(null);
    try {
      if (cat === "financial-categories") {
        const finAreaId = isSuperadmin ? formFin.area_id : primaryAreaId;
        const body = { name: formFin.name.trim(), type: formFin.type, area_id: finAreaId ? Number(finAreaId) : null };
        if (!body.name) throw new Error("Nombre requerido");
        if (body.area_id === null) throw new Error("Empresa requerida");
        if (editRow) await putJson(`/api/catalog/financial-categories/${parseId(editRow)}`, body);
        else await postJson("/api/catalog/financial-categories", body);
      } else if (cat === "currencies") {
        const body = { code: formCur.code.trim(), name: formCur.name.trim(), symbol: formCur.symbol.trim() || null };
        if (!body.code || !body.name) throw new Error("Campos incompletos");
        if (editRow) await putJson(`/api/catalog/currencies/${parseId(editRow)}`, body);
        else await postJson("/api/catalog/currencies", body);
      } else if (cat === "services") {
        const body = {
          name: formSvc.name.trim(),
          kind: formSvc.kind,
          area_id: (isSuperadmin ? formSvc.area_id : primaryAreaId) ? Number(isSuperadmin ? formSvc.area_id : primaryAreaId) : null,
          billing_cycle: formSvc.billing_cycle.trim() || null,
          base_price: formSvc.base_price ? Number(formSvc.base_price) : null,
          description: formSvc.description.trim() || null,
        };
        if (!body.name) throw new Error("Nombre");
        if (editRow) await putJson(`/api/catalog/services/${parseId(editRow)}`, body);
        else await postJson("/api/catalog/services", body);
      } else if (cat === "tax-rates") {
        const body = { name: formTx.name.trim(), rate_percent: Number(formTx.rate_percent) };
        if (!body.name) throw new Error("Nombre");
        if (editRow) await putJson(`/api/catalog/tax-rates/${parseId(editRow)}`, body);
        else await postJson("/api/catalog/tax-rates", body);
      } else if (cat === "cargos") {
        const body = { name: formCg.name.trim() };
        if (!body.name) throw new Error("Nombre");
        if (editRow) await putJson(`/api/catalog/cargos/${parseId(editRow)}`, body);
        else await postJson("/api/catalog/cargos", body);
      } else if (cat === "tariffs") {
        const tariffAreaId = isSuperadmin ? formTf.area_id : primaryAreaId;
        const body = { name: formTf.name.trim(), rate_type: formTf.rate_type, amount: Number(formTf.amount), currency_id: formTf.currency_id ? Number(formTf.currency_id) : null, area_id: tariffAreaId ? Number(tariffAreaId) : null };
        if (!body.name) throw new Error("Nombre");
        if (editRow) await putJson(`/api/catalog/tariffs/${parseId(editRow)}`, body);
        else await postJson("/api/catalog/tariffs", body);
      } else if (cat === "statuses") {
        const body = { category: formSt.category.trim(), code: formSt.code.trim(), label: formSt.label.trim(), sort_order: Number(formSt.sort_order) || 0 };
        if (!body.code || !body.label) throw new Error("Campos incompletos");
        if (editRow) await putJson(`/api/catalog/statuses/${parseId(editRow)}`, body);
        else await postJson("/api/catalog/statuses", body);
      } else if (cat === "payment-accounts") {
        const body = { name: formPa.name.trim(), type: formPa.type, bank_name: formPa.bank_name.trim() || null, account_number: formPa.account_number.trim() || null, cci: formPa.cci.trim() || null, currency: formPa.currency || null, holder_name: formPa.holder_name.trim() || null, icon: formPa.icon.trim() || null, is_active: formPa.is_active };
        if (!body.name) throw new Error("Nombre");
        if (editRow) await putJson(`/api/catalog/payment-accounts/${parseId(editRow)}`, body);
        else await postJson("/api/catalog/payment-accounts", body);
      }
      if (cat === "payment-methods") {
        const body = { code: formPm.code.trim(), name: formPm.name.trim(), is_active: formPm.is_active };
        if (!body.code || !body.name) throw new Error("Campos incompletos");
        if (editRow) await putJson(`/api/catalog/payment-methods/${parseId(editRow)}`, body);
        else await postJson("/api/catalog/payment-methods", body);
      }
      closeModal();
      loadCatalog();
    } catch {
      setErr("Error al guardar (¿superadmin?).");
    }
  };

  const softDelete = async (r: Record<string, unknown>) => {
    if (!confirm("¿Desactivar / marcar baja?")) return;
    const id = parseId(r);
    try {
      if (cat === "financial-categories") await deleteJson(`/api/catalog/financial-categories/${id}`);
      else if (cat === "currencies") await deleteJson(`/api/catalog/currencies/${id}`);
      else if (cat === "services") await deleteJson(`/api/catalog/services/${id}`);
      else if (cat === "tax-rates") await deleteJson(`/api/catalog/tax-rates/${id}`);
      else if (cat === "cargos") await deleteJson(`/api/catalog/cargos/${id}`);
      else if (cat === "tariffs") await deleteJson(`/api/catalog/tariffs/${id}`);
      else if (cat === "statuses") await deleteJson(`/api/catalog/statuses/${id}`);
      else if (cat === "payment-accounts") await deleteJson(`/api/catalog/payment-accounts/${id}`);
      else if (cat === "payment-methods") await deleteJson(`/api/catalog/payment-methods/${id}`);
      loadCatalog();
    } catch {
      setErr("No se pudo actualizar.");
    }
  };

  const tabButtons: [CatSlug, string][] = [
    ["financial-categories", "Categorías"],
    ["currencies", "Monedas"],
    ["services", "Servicios"],
    ["tax-rates", "Impuestos"],
    ["cargos", "Cargos"],
    ["tariffs", "Tarifas"],
    ["statuses", "Estados"],
    ["payment-accounts", "Cuentas de pago"],
    ["payment-methods", "Metodos de pago"],
  ];

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Catálogos" }]} isLight={isLight} />
      <LabPageHeader
        title="Catálogo maestro"
        subtitle="ABM por tipo (requiere rol superadmin en API)."
        isLight={isLight}
        action={
          <button
            type="button"
            className={labPrimaryBtn(isLight)}
            onClick={() => {
              setEditRow(null);
              setErr(null);
              setFormFin({ name: "", type: "income", area_id: isSuperadmin ? "" : primaryAreaId });
              setFormCur({ code: "", name: "", symbol: "" });
              setFormSvc({ name: "", kind: "service", area_id: isSuperadmin ? "" : primaryAreaId, billing_cycle: "", base_price: "", description: "" });
              setFormTx({ name: "", rate_percent: "" });
              setFormCg({ name: "" });
              setFormTf({ name: "", rate_type: "hourly", amount: "", currency_id: "", area_id: isSuperadmin ? "" : primaryAreaId });
              setFormSt({ category: "pipeline", code: "", label: "", sort_order: "0" });
              setFormPa({ name: "", type: "bank", bank_name: "", account_number: "", cci: "", currency: "PEN", holder_name: "", icon: "", is_active: true });
              setFormPm({ code: "", name: "", is_active: true });
              setOpen(true);
            }}
          >
            <Database className="h-4 w-4" /> Nuevo
          </button>
        }
      />
      {err && !open ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        {tabButtons.map(([id, lab]) => (
          <button key={id} type="button" className={cat === id ? labPrimaryBtn(isLight) : labGhostBtn(isLight)} onClick={() => setCat(id)}>
            {lab}
          </button>
        ))}
      </div>

      <div className={labPanelClass(isLight)}>
        <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>
                {catalogColumnTitles(cat).map((tit) => (
                  <th key={tit} className={"pb-2 pr-2 text-[10px] font-semibold uppercase"}>
                    {tit}
                  </th>
                ))}
                <th className="pb-2 text-right text-[10px] font-semibold uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={parseId(r)} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                  {catalogRowCells(cat, r, "py-2 pr-2 align-middle " + (isLight ? "text-[#111827]" : "text-zinc-200"), isLight)}
                  <td className="py-2 text-right align-middle">
                    <div className="flex justify-end gap-2">
                      <LabCircleIconAction variant="edit" tooltip="Editar" ariaLabel="Editar ítem" onClick={() => startEdit(r)} />
                      <LabCircleIconAction variant="cancel" tooltip="Dar de baja" ariaLabel="Dar de baja ítem" onClick={() => void softDelete(r)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? <p className="mt-4 text-sm text-zinc-500">Sin filas.</p> : null}
      </div>

      <FormModal
        open={open}
        title={editRow ? "Editar ítem" : "Nuevo ítem"}
        isLight={isLight}
        wide
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={closeModal}>Cerrar</button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveCatalog()}>Guardar</button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {cat === "financial-categories" ? (
            <>
              <LabField label="Nombre" isLight={isLight} className="sm:col-span-2">
                <input className={labInputClass(isLight)} value={formFin.name} onChange={(e) => setFormFin({ ...formFin, name: e.target.value })} />
              </LabField>
              <LabField label="Tipo" isLight={isLight} className="sm:col-span-2">
                <SmartSelect
                  isLight={isLight}
                  value={formFin.type}
                  onChange={(v) => setFormFin({ ...formFin, type: v as "income" | "expense", area_id: isSuperadmin ? formFin.area_id : primaryAreaId })}
                  options={[
                    { value: "income", label: "Ingreso" },
                    { value: "expense", label: "Costo" },
                  ]}
                />
              </LabField>
              <LabField label="Empresa *" isLight={isLight} className="sm:col-span-2">
                <SmartSelect
                  isLight={isLight}
                  value={formFin.area_id}
                  onChange={(v) => setFormFin({ ...formFin, area_id: v })}
                  options={areas.map((a) => ({ value: a.id, label: a.name }))}
                  disabled={!isSuperadmin}
                  emptyLabel="Seleccionar empresa..."
                />
              </LabField>
            </>
          ) : null}
          {cat === "currencies" ? (
            <>
              <LabField label="Código" isLight={isLight}><input className={labInputClass(isLight)} value={formCur.code} onChange={(e) => setFormCur({ ...formCur, code: e.target.value })} /></LabField>
              <LabField label="Nombre" isLight={isLight}><input className={labInputClass(isLight)} value={formCur.name} onChange={(e) => setFormCur({ ...formCur, name: e.target.value })} /></LabField>
              <LabField label="Símbolo" isLight={isLight} className="sm:col-span-2"><input className={labInputClass(isLight)} value={formCur.symbol} onChange={(e) => setFormCur({ ...formCur, symbol: e.target.value })} /></LabField>
            </>
          ) : null}
          {cat === "services" ? (
            <>
              <LabField label="Nombre" isLight={isLight} className="sm:col-span-2"><input className={labInputClass(isLight)} value={formSvc.name} onChange={(e) => setFormSvc({ ...formSvc, name: e.target.value })} /></LabField>
              <LabField label="Tipo" isLight={isLight}>
                <SmartSelect
                  isLight={isLight}
                  value={formSvc.kind}
                  onChange={(v) => setFormSvc({ ...formSvc, kind: v })}
                  options={[
                    { value: "service", label: "Servicio" },
                    { value: "saas", label: "SaaS" },
                    { value: "product", label: "Producto" },
                  ]}
                />
              </LabField>
              <LabField label="Ciclo de cobro" isLight={isLight}>
                <SmartSelect
                  isLight={isLight}
                  value={formSvc.billing_cycle}
                  onChange={(v) => setFormSvc({ ...formSvc, billing_cycle: v })}
                  options={[
                    { value: "monthly", label: "Mensual" },
                    { value: "quarterly", label: "Trimestral" },
                    { value: "annual", label: "Anual" },
                    { value: "one_time", label: "Unico" },
                  ]}
                  emptyLabel="Sin ciclo"
                />
              </LabField>
              <LabField label="Precio base" isLight={isLight} className="sm:col-span-2">
                <input type="number" step="0.01" className={labInputClass(isLight)} value={formSvc.base_price} onChange={(e) => setFormSvc({ ...formSvc, base_price: e.target.value })} />
              </LabField>
              <LabField label="Área" isLight={isLight} className="sm:col-span-2">
                <SmartSelect
                  isLight={isLight}
                  value={formSvc.area_id}
                  onChange={(v) => setFormSvc({ ...formSvc, area_id: v })}
                  options={areas.map((a) => ({ value: a.id, label: a.name }))}
                  disabled={!isSuperadmin}
                  emptyLabel="—"
                />
              </LabField>
              <LabField label="Descripcion" isLight={isLight} className="sm:col-span-2">
                <textarea rows={2} className={labInputClass(isLight)} value={formSvc.description} onChange={(e) => setFormSvc({ ...formSvc, description: e.target.value })} />
              </LabField>
            </>
          ) : null}
          {cat === "tax-rates" ? (
            <>
              <LabField label="Nombre" isLight={isLight} className="sm:col-span-2"><input className={labInputClass(isLight)} value={formTx.name} onChange={(e) => setFormTx({ ...formTx, name: e.target.value })} /></LabField>
              <LabField label="% tasa" isLight={isLight} className="sm:col-span-2"><input type="number" step="0.01" className={labInputClass(isLight)} value={formTx.rate_percent} onChange={(e) => setFormTx({ ...formTx, rate_percent: e.target.value })} /></LabField>
            </>
          ) : null}
          {cat === "cargos" ? (
            <LabField label="Nombre" isLight={isLight} className="sm:col-span-2"><input className={labInputClass(isLight)} value={formCg.name} onChange={(e) => setFormCg({ ...formCg, name: e.target.value })} /></LabField>
          ) : null}
          {cat === "tariffs" ? (
            <>
              <LabField label="Nombre" isLight={isLight} className="sm:col-span-2"><input className={labInputClass(isLight)} value={formTf.name} onChange={(e) => setFormTf({ ...formTf, name: e.target.value })} /></LabField>
              <LabField label="Tipo tarifa" isLight={isLight}><input className={labInputClass(isLight)} value={formTf.rate_type} onChange={(e) => setFormTf({ ...formTf, rate_type: e.target.value })} /></LabField>
              <LabField label="Monto" isLight={isLight}><input type="number" step="0.01" className={labInputClass(isLight)} value={formTf.amount} onChange={(e) => setFormTf({ ...formTf, amount: e.target.value })} /></LabField>
              <LabField label="Moneda" isLight={isLight}>
                <SmartSelect
                  isLight={isLight}
                  value={formTf.currency_id}
                  onChange={(v) => setFormTf({ ...formTf, currency_id: v })}
                  options={curr.map((c) => ({ value: c.id, label: c.code }))}
                  emptyLabel="—"
                />
              </LabField>
              <LabField label="Área" isLight={isLight}>
                <SmartSelect
                  isLight={isLight}
                  value={formTf.area_id}
                  onChange={(v) => setFormTf({ ...formTf, area_id: v })}
                  options={areas.map((a) => ({ value: a.id, label: a.name }))}
                  disabled={!isSuperadmin}
                  emptyLabel="—"
                />
              </LabField>
            </>
          ) : null}
          {cat === "statuses" ? (
            <>
              <LabField label="Categoría" isLight={isLight}><input className={labInputClass(isLight)} value={formSt.category} onChange={(e) => setFormSt({ ...formSt, category: e.target.value })} /></LabField>
              <LabField label="Código" isLight={isLight}><input className={labInputClass(isLight)} value={formSt.code} onChange={(e) => setFormSt({ ...formSt, code: e.target.value })} disabled={editRow !== null} /></LabField>
              <LabField label="Etiqueta" isLight={isLight} className="sm:col-span-2"><input className={labInputClass(isLight)} value={formSt.label} onChange={(e) => setFormSt({ ...formSt, label: e.target.value })} /></LabField>
              <LabField label="Orden" isLight={isLight} className="sm:col-span-2"><input type="number" className={labInputClass(isLight)} value={formSt.sort_order} onChange={(e) => setFormSt({ ...formSt, sort_order: e.target.value })} /></LabField>
            </>
          ) : null}
          {cat === "payment-accounts" ? (
            <>
              <LabField label="Nombre descriptivo *" isLight={isLight} className="sm:col-span-2">
                <input className={labInputClass(isLight)} placeholder="Ej: BCP Soles Corp" value={formPa.name} onChange={(e) => setFormPa({ ...formPa, name: e.target.value })} />
              </LabField>
              <LabField label="Tipo *" isLight={isLight}>
                <SmartSelect
                  isLight={isLight}
                  value={formPa.type}
                  onChange={(v) => setFormPa({ ...formPa, type: v })}
                  options={[
                    { value: "bank", label: "Cuenta Bancaria" },
                    { value: "digital_wallet", label: "Billetera Digital (Yape/Plin)" },
                    { value: "cash", label: "Efectivo" },
                    { value: "other", label: "Otro" },
                  ]}
                />
              </LabField>
              <LabField label="Moneda" isLight={isLight}>
                <SmartSelect
                  isLight={isLight}
                  value={formPa.currency}
                  onChange={(v) => setFormPa({ ...formPa, currency: v })}
                  options={[
                    { value: "PEN", label: "Soles (PEN)" },
                    { value: "USD", label: "Dólares (USD)" },
                  ]}
                  emptyLabel="—"
                />
              </LabField>
              <LabField label="Banco / Billetera" isLight={isLight}>
                <input className={labInputClass(isLight)} placeholder="Ej: BCP, Interbank, Yape" value={formPa.bank_name} onChange={(e) => setFormPa({ ...formPa, bank_name: e.target.value })} />
              </LabField>
              <LabField label="Número de Cuenta" isLight={isLight}>
                <input className={labInputClass(isLight)} value={formPa.account_number} onChange={(e) => setFormPa({ ...formPa, account_number: e.target.value })} />
              </LabField>
              <LabField label="CCI" isLight={isLight}>
                <input className={labInputClass(isLight)} value={formPa.cci} onChange={(e) => setFormPa({ ...formPa, cci: e.target.value })} />
              </LabField>
              <LabField label="Titular" isLight={isLight}>
                <input className={labInputClass(isLight)} value={formPa.holder_name} onChange={(e) => setFormPa({ ...formPa, holder_name: e.target.value })} />
              </LabField>
              <LabField label="Icono (Lucide o texto)" isLight={isLight} className="sm:col-span-2">
                <input className={labInputClass(isLight)} placeholder="Ej: Wallet, Landmark, Smartphone, 💰" value={formPa.icon} onChange={(e) => setFormPa({ ...formPa, icon: e.target.value })} />
              </LabField>
              <label className={["flex items-center gap-2 text-sm sm:col-span-2", isLight ? "text-[#374151]" : "text-zinc-200"].join(" ")}>
                <input type="checkbox" checked={formPa.is_active} onChange={(e) => setFormPa({ ...formPa, is_active: e.target.checked })} />
                Cuenta activa
              </label>
            </>
          ) : null}
          {cat === "payment-methods" ? (
            <>
              <LabField label="Codigo *" isLight={isLight}>
                <input className={labInputClass(isLight)} placeholder="Ej: transferencia" value={formPm.code} onChange={(e) => setFormPm({ ...formPm, code: e.target.value })} disabled={editRow !== null} />
              </LabField>
              <LabField label="Nombre *" isLight={isLight}>
                <input className={labInputClass(isLight)} placeholder="Ej: Transferencia bancaria" value={formPm.name} onChange={(e) => setFormPm({ ...formPm, name: e.target.value })} />
              </LabField>
              <label className={["flex items-center gap-2 text-sm sm:col-span-2", isLight ? "text-[#374151]" : "text-zinc-200"].join(" ")}>
                <input type="checkbox" checked={formPm.is_active} onChange={(e) => setFormPm({ ...formPm, is_active: e.target.checked })} />
                Metodo activo
              </label>
            </>
          ) : null}
          {err ? <p className="sm:col-span-2 text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>
    </main>
  );
}
