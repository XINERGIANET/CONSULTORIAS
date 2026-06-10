import { HandCoins } from "lucide-react";
import { useEffect, useState } from "react";
import { FormModal } from "../xpande/FormModal";
import { getJson, postJson, type LaravelPaginated } from "../xpande/http";
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

type AccountRow = {
  id: number;
  client?: { legal_name?: string };
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
};

type PayAccOpt = { id: number; name: string };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  partial: "Pago parcial",
  paid: "Pagado",
  overdue: "Vencido",
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
  };
  const v = variants[status] ?? variants.pending;
  return isLight ? v.light : v.dark;
}

export function CuentasPorCobrarPage() {
  const { isLight } = useApexTheme();
  const [rows, setRows] = useState<LaravelPaginated<AccountRow> | null>(null);
  const [payAccs, setPayAccs] = useState<PayAccOpt[]>([]);
  const [payModal, setPayModal] = useState(false);
  const [payAccount, setPayAccount] = useState<AccountRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    paid_on: new Date().toISOString().slice(0, 10),
    method: "",
    reference: "",
    notes: "",
  });

  const load = () =>
    void getJson<LaravelPaginated<AccountRow>>("/api/accounts-receivable").then(setRows);

  useEffect(() => { 
    load(); 
    void getJson<PayAccOpt[]>("/api/catalog/payment-accounts?active_only=1").then(setPayAccs);
  }, []);

  const openPayment = (r: AccountRow) => {
    setPayAccount(r);
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

  const savePayment = async () => {
    if (!payAccount || !payForm.amount) {
      setErr("Monto requerido.");
      return;
    }
    try {
      await postJson(`/api/accounts-receivable/${payAccount.id}/payments`, {
        amount: Number(payForm.amount),
        paid_on: payForm.paid_on,
        method: payForm.method || null,
        reference: payForm.reference || null,
        notes: payForm.notes || null,
      });
      setPayModal(false);
      setPayAccount(null);
      load();
    } catch {
      setErr("No se pudo registrar el pago.");
    }
  };

  const th = "pb-2 pr-3 text-[10px] font-semibold uppercase " + (isLight ? "text-[#6B7280]" : "text-zinc-500");
  const td = "py-2.5 pr-3 text-xs " + (isLight ? "text-[#374151]" : "text-zinc-300");

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs
        items={[{ label: "Dashboard", to: "/" }, { label: "Cuentas por cobrar" }]}
        isLight={isLight}
      />
      <LabPageHeader
        title="Cuentas por cobrar"
        subtitle="Seguimiento de contratos, saldos pendientes y registro de pagos."
        isLight={isLight}
      />

      {err && !payModal ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}

      <div className={labPanelClass(isLight)}>
        {!rows ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
        ) : rows.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No hay cuentas por cobrar registradas.</p>
        ) : (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr>
                  <th className={th}>Cliente</th>
                  <th className={th}>Proyecto / Contrato</th>
                  <th className={th}>Cuota</th>
                  <th className={th + " text-right"}>Total</th>
                  <th className={th + " text-right"}>Pagado</th>
                  <th className={th + " text-right"}>Saldo</th>
                  <th className={th}>Venc. proyectado</th>
                  <th className={th}>Cobro real</th>
                  <th className={th}>Estado</th>
                  <th className={th + " text-right"} />
                </tr>
              </thead>
              <tbody>
                {rows.data.map((r) => (
                  <tr key={r.id} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                    <td className={td}>{r.client?.legal_name ?? "—"}</td>
                    <td className={td}>{r.project?.name ?? r.document?.title ?? "—"}</td>
                    <td className={td}>
                      {r.installment_number
                        ? `Cuota ${r.installment_number}${r.client_contract?.installments_count ? ` / ${r.client_contract.installments_count}` : ""}`
                        : "—"}
                    </td>
                    <td className={td + " text-right"}>S/. {String(r.total_amount)}</td>
                    <td className={td + " text-right"}>S/. {String(r.paid_amount)}</td>
                    <td className={
                      td + " text-right font-semibold" +
                      (Number(r.balance_amount) > 0 ? (isLight ? " text-red-600" : " text-red-400") : "")
                    }>
                      S/. {String(r.balance_amount)}
                    </td>
                    <td className={td}>{(r.projected_due_on ?? r.due_on) ? String(r.projected_due_on ?? r.due_on).slice(0, 10) : "—"}</td>
                    <td className={td}>{r.collected_on ? String(r.collected_on).slice(0, 10) : "—"}</td>
                    <td className="py-2.5 pr-3">
                      <span className={statusPill(r.status, isLight)}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {r.status !== "paid" ? (
                        <span className="group relative inline-flex">
                          <button
                            type="button"
                            className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-110",
                              "bg-[#16A34A] shadow-[0_2px_10px_rgba(22,163,74,0.40)] hover:bg-[#15803D]"].join(" ")}
                            onClick={() => openPayment(r)}
                            aria-label="Registrar pago"
                          >
                            <HandCoins className="h-3.5 w-3.5" strokeWidth={2.25} />
                          </button>
                          <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-40 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium leading-tight text-white shadow-lg ring-1 ring-black/40 group-hover:block">
                            Registrar pago
                          </span>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormModal
        open={payModal}
        title="Registrar pago"
        isLight={isLight}
        wide
        onClose={() => { setPayModal(false); setPayAccount(null); }}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => { setPayModal(false); setPayAccount(null); }}>
              Cerrar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void savePayment()}>
              Guardar pago
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {payAccount ? (
            <div className={"sm:col-span-2 rounded-lg px-3 py-2 text-xs " + (isLight ? "bg-zinc-50 text-zinc-600" : "bg-white/5 text-zinc-400")}>
              <strong>{payAccount.client?.legal_name}</strong> — Saldo pendiente:{" "}
              <strong>S/. {String(payAccount.balance_amount)}</strong>
            </div>
          ) : null}
          <LabField label="Monto *" isLight={isLight}>
            <input
              type="number"
              step="0.01"
              className={labInputClass(isLight)}
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            />
          </LabField>
          <LabField label="Fecha de pago *" isLight={isLight}>
            <input
              type="date"
              className={labInputClass(isLight)}
              value={payForm.paid_on}
              onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })}
            />
          </LabField>
          <LabField label="Método de pago" isLight={isLight}>
            <select
              className={labInputClass(isLight)}
              value={payForm.method}
              onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
            >
              <option value="">Seleccionar método…</option>
              {payAccs.map((pa) => (
                <option key={pa.id} value={pa.name}>{pa.name}</option>
              ))}
            </select>
          </LabField>
          <LabField label="Referencia / Nro. operación" isLight={isLight}>
            <input
              className={labInputClass(isLight)}
              value={payForm.reference}
              onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
            />
          </LabField>
          <LabField label="Notas" isLight={isLight} className="sm:col-span-2">
            <textarea
              rows={2}
              className={labInputClass(isLight)}
              value={payForm.notes}
              onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
            />
          </LabField>
          {err ? <p className="sm:col-span-2 text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>
    </main>
  );
}
