import { Briefcase, ExternalLink, Layers, Radar, Search, Target, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SmartSelect } from "../components/SmartSelect";
import { FormModal } from "../xpande/FormModal";
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
  labStatusPill,
} from "../xpande/XpandeUi";
import { LabCircleIconAction, circleRowActionClass } from "../xpande/LabTableKit";
import { useApexTheme } from "../context/ThemeContext";

type AreaRow = { id: number; name: string; slug: string; is_active?: boolean };

const PIPELINE_LABELS: Record<string, string> = {
  lead: "Contacto",
  prospect: "Prospecto",
  client: "Cliente",
  active_client: "Cliente activo",
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "Llamada",
  meeting: "Reunión",
  email: "Correo",
  visit: "Visita",
  note: "Nota",
};

const PROJECT_ITEM_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  active: "Activo",
  on_hold: "En espera",
  completed: "Completado",
  cancelled: "Cancelado",
};

export function AreasPage() {
  const { isLight } = useApexTheme();
  const [rows, setRows] = useState<AreaRow[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<AreaRow | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", is_active: true });
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    void getJson<AreaRow[]>("/api/areas", { active_only: false }).then(setRows).catch(() => setErr("Error al cargar áreas."));

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setErr(null);
    try {
      if (edit) await putJson(`/api/areas/${edit.id}`, form);
      else await postJson("/api/areas", form);
      setOpen(false);
      setEdit(null);
      load();
    } catch {
      setErr("Sin permiso o datos inválidos.");
    }
  };

  const disable = async (a: AreaRow) => {
    if (!confirm("¿Desactivar área " + a.name + "?")) return;
    await deleteJson(`/api/areas/${a.id}`);
    load();
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs isLight={isLight} items={[{ label: "Dashboard", to: "/" }, { label: "Áreas" }]} />
      <LabPageHeader
        title="Áreas de negocio"
        subtitle="Xingeria, Xpande y Xango — control centralizado desde administración."
        isLight={isLight}
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => {setEdit(null); setForm({ name: "", slug: "", description: "", is_active: true }); setOpen(true);}}>
            <Layers className="h-4 w-4" />
            Nueva área
          </button>
        }
      />
      {err ? <p className="mb-4 text-sm text-red-500">{err}</p> : null}
      <div className={labPanelClass(isLight)}>
        <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>
                <th className="pb-3 pr-3 uppercase text-[10px] font-semibold">Nombre</th>
                <th className="pb-3 pr-3 uppercase text-[10px] font-semibold">Slug</th>
                <th className="pb-3 text-right uppercase text-[10px] font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={isLight ? "border-t border-[#F3F4F6]" : "border-t border-white/[0.06]"}>
                  <td className={"py-2 pr-3 font-medium " + (isLight ? "text-[#111827]" : "text-zinc-100")}>{r.name}</td>
                  <td className="py-2 pr-3">{r.slug}</td>
                  <td className="py-2 text-right align-middle">
                    <div className="flex justify-end gap-2">
                      <LabCircleIconAction
                        variant="edit"
                        tooltip="Editar"
                        ariaLabel={`Editar ${r.name}`}
                        onClick={() => {
                          setEdit(r);
                          setForm({
                            name: r.name,
                            slug: r.slug,
                            description: typeof (r as { description?: unknown }).description === "string" ? String((r as { description?: string }).description) : "",
                            is_active: r.is_active ?? true,
                          });
                          setOpen(true);
                        }}
                      />
                      <LabCircleIconAction
                        variant="cancel"
                        tooltip="Desactivar"
                        ariaLabel={`Desactivar ${r.name}`}
                        onClick={() => void disable(r)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormModal
        open={open}
        title={edit ? "Editar área" : "Nueva área"}
        isLight={isLight}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void save()}>
              Guardar
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <LabField label="Nombre" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </LabField>
          <LabField label="Slug" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </LabField>
          <LabField label="Descripción" isLight={isLight}>
            <textarea className={labInputClass(isLight)} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </LabField>
        </div>
      </FormModal>
    </main>
  );
}

type ClientLite = {
  id: number;
  legal_name: string;
  trade_name?: string | null;
  pipeline_stage: string;
  areas?: AreaRow[];
};

type CrmContact = { id: number; name: string; position?: string | null; phone?: string | null; email?: string | null; observations?: string | null };

const emptyClientForm = () => ({
  legal_name: "",
  trade_name: "",
  ruc: "",
  address: "",
  rubro: "",
  pipeline_stage: "lead",
  representative_contact_id: null as number | null,
  representative_name: "",
  representative_phone: "",
  representative_position: "",
  representative_email: "",
  representative_observations: "",
  billing_activate: false,
  billing_total: "",
  billing_installments: "12",
  billing_start: new Date().toISOString().slice(0, 10),
  billing_first_due: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
  billing_area_id: "" as "" | number,
  billing_title: "",
});

export function ClientsPage() {
  const { isLight } = useApexTheme();
  const [data, setData] = useState<LaravelPaginated<ClientLite> | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [searchingRuc, setSearchingRuc] = useState(false);
  const [form, setForm] = useState(emptyClientForm());
  const [err, setErr] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ClientLite | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");
  const [deactivating, setDeactivating] = useState(false);

  const load = async (page = 1) => {
    const r = await getJson<LaravelPaginated<ClientLite>>("/api/clients", { page });
    setData(r);
  };

  useEffect(() => {
    void load();
    void getJson<AreaRow[]>("/api/areas", { active_only: false }).then(setAreas);
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyClientForm());
    setErr(null);
    setModal(true);
  };

  const openEditClient = async (c: ClientLite) => {
    setErr(null);
    try {
      const full = await getJson<{ legal_name?: string; trade_name?: string | null; ruc?: string | null; address?: string | null; rubro?: string | null; pipeline_stage?: string; contacts?: CrmContact[] }>(`/api/clients/${c.id}`);
      const representative = full.contacts?.[0] ?? null;
      setForm({
        legal_name: full.legal_name ?? c.legal_name,
        trade_name: full.trade_name ?? "",
        ruc: full.ruc ?? "",
        address: full.address ?? "",
        rubro: full.rubro ?? "",
        pipeline_stage: full.pipeline_stage ?? c.pipeline_stage,
        representative_contact_id: representative?.id ?? null,
        representative_name: representative?.name ?? "",
        representative_phone: representative?.phone ?? "",
        representative_position: representative?.position ?? "",
        representative_email: representative?.email ?? "",
        representative_observations: representative?.observations ?? "",
        billing_activate: false,
        billing_total: "",
        billing_installments: "12",
        billing_start: new Date().toISOString().slice(0, 10),
        billing_first_due: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
        billing_area_id: "",
        billing_title: "",
      });
      setEditId(c.id);
      setModal(true);
    } catch {
      setErr("No se pudo cargar cliente.");
    }
  };

  const openDeactivateClient = (c: ClientLite) => {
    setDeactivateTarget(c);
    setDeactivationReason("");
    setErr(null);
  };

  const closeDeactivateClient = () => {
    if (deactivating) return;
    setDeactivateTarget(null);
    setDeactivationReason("");
    setErr(null);
  };

  const deactivateClient = async () => {
    if (!deactivateTarget) return;
    const reason = deactivationReason.trim();
    if (!reason) {
      setErr("Debe indicar el motivo de la baja.");
      return;
    }
    setDeactivating(true);
    setErr(null);
    try {
      await deleteJson(`/api/clients/${deactivateTarget.id}`, { reason });
      setDeactivateTarget(null);
      setDeactivationReason("");
      await load(data?.current_page ?? 1);
    } catch {
      setErr("No se pudo desactivar.");
    } finally {
      setDeactivating(false);
    }
  };

  const save = async () => {
    setErr(null);
    if (form.representative_name.trim() && (!form.representative_position.trim() || !form.representative_phone.trim())) {
      setErr("El cargo y el teléfono del representante son obligatorios.");
      return;
    }
    try {
      const clientBody: Record<string, unknown> = {
        legal_name: form.legal_name,
        trade_name: form.trade_name,
        ruc: form.ruc,
        address: form.address,
        rubro: form.rubro,
        pipeline_stage: form.pipeline_stage,
        is_active: form.pipeline_stage === "active_client",
      };
      if (form.billing_activate && form.pipeline_stage === "active_client" && form.billing_area_id !== "" && form.billing_total) {
        clientBody.billing = {
          activate: true,
          total_amount: Number(form.billing_total),
          installments_count: Number(form.billing_installments) || 12,
          start_date: form.billing_start,
          first_due_on: form.billing_first_due,
          area_id: form.billing_area_id,
          title: form.billing_title.trim() || undefined,
        };
      }
      let clientId = editId;
      if (editId) {
        await putJson(`/api/clients/${editId}`, clientBody);
      } else {
        const saved = await postJson<{ id: number }>("/api/clients", clientBody);
        clientId = saved.id;
      }

      if (clientId && form.representative_name.trim()) {
        const representativeBody = {
          name: form.representative_name.trim(),
          position: form.representative_position.trim() || null,
          phone: form.representative_phone.trim() || null,
          email: form.representative_email.trim() || null,
          observations: form.representative_observations.trim() || null,
        };
        if (form.representative_contact_id) {
          await putJson(`/api/clients/${clientId}/contacts/${form.representative_contact_id}`, representativeBody);
        } else {
          await postJson(`/api/clients/${clientId}/contacts`, representativeBody);
        }
      }

      setModal(false);
      setEditId(null);
      await load(data?.current_page ?? 1);
      setForm(emptyClientForm());
    } catch {
      setErr("No se pudo guardar.");
    }
  };

  const performRucSearch = async () => {
    if (!form.ruc || form.ruc.length !== 11) {
      setErr("Ingrese un RUC válido de 11 dígitos.");
      return;
    }
    setSearchingRuc(true);
    setErr(null);
    try {
      const res = await getJson<any>(`/api/clients/search-ruc/${form.ruc}`);
      const info = res?.resultado ?? res?.data ?? res;
      if (info && info.razon_social) {
        setForm((f) => ({
          ...f,
          legal_name: info.razon_social,
          trade_name: info.nombre_comercial && info.nombre_comercial !== "-" ? info.nombre_comercial : info.razon_social,
          address: info.direccion || f.address,
        }));
      } else {
        setErr("No se encontraron datos para ese RUC.");
      }
    } catch {
      setErr("Error al consultar el RUC.");
    } finally {
      setSearchingRuc(false);
    }
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs isLight={isLight} items={[{ label: "Dashboard", to: "/" }, { label: "Clientes CRM" }]} />
      <LabPageHeader
        title="Clientes"
        subtitle="Segmentación por pipeline, industrias y vínculos con Xingeria, Xpande y Xango."
        isLight={isLight}
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={openCreate}>
            <Briefcase className="h-4 w-4" /> Nuevo cliente
          </button>
        }
      />
      {err ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}
      <div className={labPanelClass(isLight)}>
        {!data ? (
          <p className="py-10 text-center text-sm text-zinc-500">Cargando…</p>
        ) : (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>
                  <th className="pb-3 pr-3 uppercase text-[10px] font-semibold">Razón social</th>
                  <th className="pb-3 pr-3 uppercase text-[10px] font-semibold">Pipeline</th>
                  <th className="pb-3 pr-3 uppercase text-[10px] font-semibold">Áreas</th>
                  <th className="pb-3 text-right uppercase text-[10px] font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((c) => (
                  <tr key={c.id} className={isLight ? "border-t border-[#F3F4F6]" : "border-t border-white/[0.06]"}>
                    <td className={"py-2 pr-3 font-medium " + (isLight ? "text-[#111827]" : "text-white")}>{c.legal_name}</td>
                    <td className="py-2 pr-3">{PIPELINE_LABELS[c.pipeline_stage] ?? c.pipeline_stage}</td>
                    <td className="py-2 pr-3 text-xs">{(c.areas ?? []).map((a) => a.name).join(", ")}</td>
                    <td className="py-2 text-right align-middle">
                      <div className="flex justify-end gap-2">
                        <LabCircleIconAction variant="edit" tooltip="Editar" ariaLabel={`Editar ${c.legal_name}`} onClick={() => void openEditClient(c)} />
                        <span className="group relative inline-flex">
                          <Link
                            to={`/clientes/${c.id}/oportunidades`}
                            className={[circleRowActionClass("link"), "inline-flex items-center justify-center"].join(" ")}
                            title="Oportunidades"
                            aria-label={`Oportunidades de ${c.legal_name}`}
                          >
                            <Target className="h-3.5 w-3.5 text-white" strokeWidth={2.25} aria-hidden />
                          </Link>
                          <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-40 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium leading-tight text-white shadow-lg ring-1 ring-black/40 group-hover:block">
                            Oportunidades
                          </span>
                        </span>
                        <span className="group relative inline-flex">
                          <Link
                            to={`/clientes/${c.id}`}
                            className={[circleRowActionClass("link"), "inline-flex items-center justify-center"].join(" ")}
                            title="Ver CRM"
                            aria-label={`CRM ${c.legal_name}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-white" strokeWidth={2.25} aria-hidden />
                          </Link>
                          <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-40 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium leading-tight text-white shadow-lg ring-1 ring-black/40 group-hover:block">
                            CRM
                          </span>
                        </span>
                        <LabCircleIconAction variant="cancel" tooltip="Dar de baja" ariaLabel={`Dar de baja ${c.legal_name}`} onClick={() => openDeactivateClient(c)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormModal
        open={deactivateTarget !== null}
        title="Dar de baja al cliente"
        subtitle={deactivateTarget ? deactivateTarget.legal_name : undefined}
        isLight={isLight}
        onClose={closeDeactivateClient}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} disabled={deactivating} onClick={closeDeactivateClient}>
              Cancelar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} disabled={deactivating} onClick={() => void deactivateClient()}>
              {deactivating ? "Procesando…" : "Confirmar baja"}
            </button>
          </div>
        }
      >
        <LabField label="Motivo de la baja *" isLight={isLight}>
          <textarea
            required
            autoFocus
            rows={4}
            maxLength={1000}
            className={labInputClass(isLight)}
            value={deactivationReason}
            onChange={(e) => setDeactivationReason(e.target.value)}
            placeholder="Explique por qué se dará de baja a este cliente"
          />
        </LabField>
        {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      </FormModal>

      <FormModal
        open={modal}
        title={editId ? "Editar cliente" : "Registrar cliente"}
        isLight={isLight}
        onClose={() => {setModal(false); setEditId(null); setErr(null);}}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => {setModal(false); setEditId(null);}}>
              Cerrar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void save()}>
              Guardar
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Razón social" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
          </LabField>
          <LabField label="Nombre comercial" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
          </LabField>
          <LabField label="RUC" isLight={isLight}>
            <div className="flex gap-2">
              <input className={labInputClass(isLight) + " flex-1"} value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
              <button
                type="button"
                onClick={performRucSearch}
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
          <LabField label="Dirección" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </LabField>
          <LabField label="Etapa CRM" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={form.pipeline_stage}
              onChange={(v) => setForm({ ...form, pipeline_stage: v })}
              options={[
                { value: "lead", label: "Contacto" },
                { value: "prospect", label: "Prospecto" },
                { value: "active_client", label: "Cliente activo" },
              ]}
            />
          </LabField>
          <LabField label="Rubro" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.rubro} onChange={(e) => setForm({ ...form, rubro: e.target.value })} />
          </LabField>
          {form.pipeline_stage === "active_client" ? (
            <div className={"sm:col-span-2 rounded-xl border p-4 " + (isLight ? "border-[#E5E7EB] bg-[#F9FAFB]" : "border-white/[0.06] bg-[#0a0a0a]/50")}>
              <label className={["mb-3 flex items-center gap-2 text-sm font-semibold", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
                <input type="checkbox" checked={form.billing_activate} onChange={(e) => setForm({ ...form, billing_activate: e.target.checked })} />
                Generar contrato y cuotas mensuales (cuentas por cobrar)
              </label>
              {form.billing_activate ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <LabField label="Monto total del contrato (S/.)" isLight={isLight}>
                    <input type="number" step="0.01" className={labInputClass(isLight)} value={form.billing_total} onChange={(e) => setForm({ ...form, billing_total: e.target.value })} placeholder="Ej. 1200" />
                  </LabField>
                  <LabField label="Número de cuotas (meses)" isLight={isLight}>
                    <input type="number" min={1} className={labInputClass(isLight)} value={form.billing_installments} onChange={(e) => setForm({ ...form, billing_installments: e.target.value })} />
                  </LabField>
                  <LabField label="Inicio contrato" isLight={isLight}>
                    <input type="date" className={labInputClass(isLight)} value={form.billing_start} onChange={(e) => setForm({ ...form, billing_start: e.target.value })} />
                  </LabField>
                  <LabField label="Primer vencimiento" isLight={isLight}>
                    <input type="date" className={labInputClass(isLight)} value={form.billing_first_due} onChange={(e) => setForm({ ...form, billing_first_due: e.target.value })} />
                  </LabField>
                  <LabField label="Área facturación" isLight={isLight}>
                    <select className={labInputClass(isLight)} value={form.billing_area_id === "" ? "" : String(form.billing_area_id)} onChange={(e) => setForm({ ...form, billing_area_id: e.target.value ? Number(e.target.value) : "" })}>
                      <option value="">Seleccionar…</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </LabField>
                  <LabField label="Título contrato (opcional)" isLight={isLight}>
                    <input className={labInputClass(isLight)} value={form.billing_title} onChange={(e) => setForm({ ...form, billing_title: e.target.value })} />
                  </LabField>
                  {form.billing_total && form.billing_installments ? (
                    <p className={"sm:col-span-2 text-xs " + (isLight ? "text-[#6B7280]" : "text-zinc-400")}>
                      Cuota estimada: S/. {(Number(form.billing_total) / Math.max(1, Number(form.billing_installments))).toFixed(2)} mensual · se crearán {form.billing_installments} cuentas por cobrar con fechas proyectadas.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <h3 className={"mb-2 text-sm font-semibold " + (isLight ? "text-[#111827]" : "text-zinc-100")}>Representante del cliente</h3>
          </div>
          <LabField label="Nombre completo" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.representative_name} onChange={(e) => setForm({ ...form, representative_name: e.target.value })} />
          </LabField>
          <LabField label="Número telefónico" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.representative_phone} onChange={(e) => setForm({ ...form, representative_phone: e.target.value })} />
          </LabField>
          <LabField label="Cargo o puesto" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.representative_position} onChange={(e) => setForm({ ...form, representative_position: e.target.value })} />
          </LabField>
          <LabField label="Correo electrónico" isLight={isLight}>
            <input type="email" className={labInputClass(isLight)} value={form.representative_email} onChange={(e) => setForm({ ...form, representative_email: e.target.value })} />
          </LabField>
          <LabField label="Observaciones" isLight={isLight} className="sm:col-span-2">
            <textarea className={labInputClass(isLight)} rows={2} value={form.representative_observations} onChange={(e) => setForm({ ...form, representative_observations: e.target.value })} />
          </LabField>
        </div>
      </FormModal>
    </main>
  );
}

type CrmActivity = { id: number; type: string; subject?: string | null };
type ClientPortfolioItem = {
  id: number;
  name?: string;
  engagement_type?: string | null;
  status?: string | null;
  renewal_date?: string | null;
  services?: { id: number; name: string; kind?: string | null }[];
  areas?: { id: number; name: string }[];
};
type ClientLocation = { id: number; name: string; address?: string | null; phone?: string | null; responsible_person?: string | null; is_active: boolean };

export function ClientDetailPage() {
  const { id } = useParams();
  const cid = Number(id);
  const { isLight } = useApexTheme();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [contactModal, setContactModal] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cf, setCf] = useState({ name: "", position: "", phone: "", email: "", observations: "" });
  const [af, setAf] = useState({ type: "call", subject: "", body: "", occurred_at: "", next_followup_at: "" });
  const [locModal, setLocModal] = useState(false);
  const [locEditId, setLocEditId] = useState<number | null>(null);
  const [lf, setLf] = useState({ name: "", address: "", phone: "", responsible_person: "", is_active: true });

  const reload = () => void getJson<Record<string, unknown>>(`/api/clients/${cid}`).then(setRow);

  useEffect(() => {
    reload();
  }, [cid]);

  if (!row) return <main className={labCrudMainClass(isLight)}><p className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>Cargando ficha CRM…</p></main>;

  const asRec = row as Record<string, unknown>;
  const contacts = Array.isArray(asRec.contacts) ? (asRec.contacts as CrmContact[]) : [];
  const portfolio = Array.isArray(asRec.projects) ? (asRec.projects as ClientPortfolioItem[]) : [];
  const locations = Array.isArray(asRec.locations) ? (asRec.locations as ClientLocation[]) : [];
  const activities =
    ((asRec.crm_activities as CrmActivity[]) ?? (asRec.crmActivities as CrmActivity[]) ?? []);

  const saveContact = async () => {
    setErr(null);
    if (!cf.name.trim() || !cf.position.trim() || !cf.phone.trim()) {
      setErr("Nombre, cargo y teléfono son obligatorios.");
      return;
    }
    try {
      await postJson(`/api/clients/${cid}/contacts`, {
        name: cf.name.trim(),
        position: cf.position.trim(),
        phone: cf.phone.trim(),
        email: cf.email.trim() || null,
        observations: cf.observations.trim() || null,
      });
      setContactModal(false);
      setCf({ name: "", position: "", phone: "", email: "", observations: "" });
      reload();
    } catch {
      setErr("No se pudo guardar contacto.");
    }
  };

  const saveActivity = async () => {
    setErr(null);
    if (!af.type.trim()) {
      setErr("Tipo requerido.");
      return;
    }
    try {
      await postJson(`/api/clients/${cid}/crm-activities`, {
        type: af.type.trim(),
        subject: af.subject.trim() || null,
        body: af.body.trim() || null,
        occurred_at: af.occurred_at || null,
        next_followup_at: af.next_followup_at || null,
      });
      setActivityModal(false);
      setAf({ type: "call", subject: "", body: "", occurred_at: "", next_followup_at: "" });
      reload();
    } catch {
      setErr("No se pudo registrar actividad.");
    }
  };

  const delContact = async (contactId: number) => {
    if (!confirm("¿Eliminar contacto?")) return;
    try {
      await deleteJson(`/api/clients/${cid}/contacts/${contactId}`);
      reload();
    } catch {
      setErr("No se pudo eliminar.");
    }
  };

  const delActivity = async (activityId: number) => {
    if (!confirm("¿Eliminar actividad?")) return;
    try {
      await deleteJson(`/api/clients/${cid}/crm-activities/${activityId}`);
      reload();
    } catch {
      setErr("No se pudo eliminar.");
    }
  };

  const resetLocationForm = () => {
    setLocEditId(null);
    setLf({ name: "", address: "", phone: "", responsible_person: "", is_active: true });
    setErr(null);
  };

  const openLocationCreate = () => {
    resetLocationForm();
    setLocModal(true);
  };

  const openLocationEdit = (loc: ClientLocation) => {
    setLocEditId(loc.id);
    setLf({
      name: loc.name,
      address: loc.address ?? "",
      phone: loc.phone ?? "",
      responsible_person: loc.responsible_person ?? "",
      is_active: loc.is_active,
    });
    setErr(null);
    setLocModal(true);
  };

  const saveLocation = async () => {
    setErr(null);
    if (!lf.name.trim()) {
      setErr("Nombre de la sede requerido.");
      return;
    }
    try {
      const body = {
        name: lf.name.trim(),
        address: lf.address.trim() || null,
        phone: lf.phone.trim() || null,
        responsible_person: lf.responsible_person.trim() || null,
        is_active: lf.is_active,
      };
      if (locEditId) await putJson(`/api/clients/${cid}/locations/${locEditId}`, body);
      else await postJson(`/api/clients/${cid}/locations`, body);
      setLocModal(false);
      resetLocationForm();
      reload();
    } catch {
      setErr("No se pudo guardar sede.");
    }
  };

  const delLocation = async (locId: number) => {
    if (!confirm("¿Eliminar sede?")) return;
    try {
      await deleteJson(`/api/clients/${cid}/locations/${locId}`);
      reload();
    } catch {
      setErr("No se pudo eliminar.");
    }
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs isLight={isLight} items={[{ label: "Dashboard", to: "/" }, { label: "Clientes", to: "/clientes" }, { label: String(row.legal_name) }]} />
      <LabPageHeader
        title={String(row.legal_name)}
        subtitle="Comercial CRM · Contactos · Actividades"
        isLight={isLight}
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => {setErr(null); setContactModal(true);}}>
              + Contacto
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={openLocationCreate}>
              + Sede
            </button>
            <button type="button" className={labGhostBtn(isLight)} onClick={() => {setErr(null); setActivityModal(true);}}>
              + Actividad
            </button>
          </div>
        }
      />
      {err ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={labPanelClass(isLight)}>
          <h3 className={"mb-2 text-sm font-semibold " + (isLight ? "text-[#111827]" : "text-zinc-100")}>Productos y proyectos adquiridos</h3>
          <ul className="space-y-3 text-sm">
            {portfolio.map((item) => (
              <li key={item.id} className={isLight ? "text-[#374151]" : "text-zinc-300"}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.name ?? "Registro"}</span>
                  <span className={labStatusPill("neutral", isLight)}>{item.engagement_type === "saas" ? "SaaS" : "Proyecto"}</span>
                  <span className="text-[11px] text-zinc-500">{PROJECT_ITEM_STATUS_LABELS[item.status ?? ""] ?? item.status ?? ""}</span>
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {(item.services ?? []).map((s) => s.name).join(", ") || "Sin productos seleccionados"}
                  {item.renewal_date ? " · Renueva " + String(item.renewal_date).slice(0, 10) : ""}
                </div>
              </li>
            ))}
            {!portfolio.length ? <li className="text-zinc-500">Sin productos o proyectos activos.</li> : null}
          </ul>
        </section>
        <section className={labPanelClass(isLight)}>
          <h3 className={"mb-2 text-sm font-semibold " + (isLight ? "text-[#111827]" : "text-zinc-100")}>Contactos y Representantes</h3>
          <ul className="space-y-3 text-sm">
            {contacts.map((co) => (
              <li key={co.id} className={isLight ? "text-[#374151]" : "text-zinc-300"}>
                <div className="font-medium">{co.name}</div>
                <div className="text-[11px] text-zinc-500">{co.position ?? ""} {co.phone ? "· " + co.phone : ""} {co.email ? "· " + co.email : ""}</div>
                {co.observations && <div className="text-[11px] mt-1 text-zinc-600 italic border-l-2 pl-2">Obs: {co.observations}</div>}
                <button type="button" className={"mt-1 " + labGhostBtn(isLight)} onClick={() => void delContact(co.id)}>
                  Eliminar
                </button>
              </li>
            ))}
            {!contacts.length ? <li className="text-zinc-500">Sin contactos cargados.</li> : null}
          </ul>
        </section>
        <section className={labPanelClass(isLight)}>
          <h3 className={"mb-2 text-sm font-semibold " + (isLight ? "text-[#111827]" : "text-zinc-100")}>Últimos movimientos</h3>
          <ul className="space-y-2 text-xs">
            {activities.slice(0, 20).map((a) => (
              <li key={a.id} className={(isLight ? "text-[#374151]" : "text-zinc-300") + " flex flex-wrap items-center justify-between gap-2"}>
                <span>
                  <span className={labStatusPill("neutral", isLight)}>{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span> {a.subject ?? ""}
                </span>
                <button type="button" className={labGhostBtn(isLight)} onClick={() => void delActivity(a.id)}>
                  Eliminar
                </button>
              </li>
            ))}
            {!activities.length ? <li className="text-zinc-500">Registre actividades de seguimiento.</li> : null}
          </ul>
        </section>
        <section className={labPanelClass(isLight)}>
          <h3 className={"mb-2 text-sm font-semibold " + (isLight ? "text-[#111827]" : "text-zinc-100")}>Sedes</h3>
          <ul className="space-y-3 text-sm">
            {locations.map((loc) => (
              <li key={loc.id} className={isLight ? "text-[#374151]" : "text-zinc-300"}>
                <div className="font-medium">{loc.name}</div>
                <div className="text-[11px] text-zinc-500">
                  {loc.address ? loc.address : "Sin dirección"} 
                  {loc.phone ? " · " + loc.phone : ""} 
                  {loc.responsible_person ? " · " + loc.responsible_person : ""}
                  {!loc.is_active ? " · Inactiva" : ""}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button type="button" className={labGhostBtn(isLight)} onClick={() => openLocationEdit(loc)}>
                    Editar
                  </button>
                  <button type="button" className={labGhostBtn(isLight)} onClick={() => void delLocation(loc.id)}>
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
            {!locations.length ? <li className="text-zinc-500">Sin sedes registradas.</li> : null}
          </ul>
        </section>
      </div>

      <FormModal
        open={contactModal}
        title="Nuevo contacto"
        isLight={isLight}
        onClose={() => {setContactModal(false); setErr(null);}}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setContactModal(false)}>Cerrar</button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveContact()}>Guardar</button>
          </div>
        }
      >
        <div className="grid gap-3">
          <LabField label="Nombre *" isLight={isLight}><input required className={labInputClass(isLight)} value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} /></LabField>
          <LabField label="Cargo *" isLight={isLight}><input required className={labInputClass(isLight)} value={cf.position} onChange={(e) => setCf({ ...cf, position: e.target.value })} /></LabField>
          <LabField label="Teléfono *" isLight={isLight}><input required type="tel" className={labInputClass(isLight)} value={cf.phone} onChange={(e) => setCf({ ...cf, phone: e.target.value })} /></LabField>
          <LabField label="Email" isLight={isLight}><input className={labInputClass(isLight)} value={cf.email} onChange={(e) => setCf({ ...cf, email: e.target.value })} /></LabField>
          <LabField label="Observaciones" isLight={isLight}><textarea className={labInputClass(isLight)} rows={2} value={cf.observations} onChange={(e) => setCf({ ...cf, observations: e.target.value })} /></LabField>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>

      <FormModal
        open={activityModal}
        title="Registrar actividad CRM"
        isLight={isLight}
        wide
        onClose={() => {setActivityModal(false); setErr(null);}}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setActivityModal(false)}>Cerrar</button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveActivity()}>Registrar</button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Tipo *" isLight={isLight}>
            <SmartSelect
              isLight={isLight}
              value={af.type}
              onChange={(v) => setAf({ ...af, type: v })}
              options={[
                { value: "call", label: "Llamada" },
                { value: "meeting", label: "Reunión" },
                { value: "email", label: "Email" },
                { value: "visit", label: "Visita" },
                { value: "note", label: "Nota" },
              ]}
            />
          </LabField>
          <LabField label="Asunto" isLight={isLight}>
            <input className={labInputClass(isLight)} value={af.subject} onChange={(e) => setAf({ ...af, subject: e.target.value })} />
          </LabField>
          <LabField label="Fecha ocurrida" isLight={isLight}>
            <input type="datetime-local" className={labInputClass(isLight)} value={af.occurred_at} onChange={(e) => setAf({ ...af, occurred_at: e.target.value })} />
          </LabField>
          <LabField label="Próximo seguimiento" isLight={isLight}>
            <input type="datetime-local" className={labInputClass(isLight)} value={af.next_followup_at} onChange={(e) => setAf({ ...af, next_followup_at: e.target.value })} />
          </LabField>
          <LabField label="Detalle" isLight={isLight} className="sm:col-span-2">
            <textarea className={labInputClass(isLight)} rows={3} value={af.body} onChange={(e) => setAf({ ...af, body: e.target.value })} />
          </LabField>
          {err ? <p className="sm:col-span-2 text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>

      <FormModal
        open={locModal}
        title={locEditId ? "Editar sede" : "Nueva sede"}
        isLight={isLight}
        onClose={() => {setLocModal(false); resetLocationForm();}}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => {setLocModal(false); resetLocationForm();}}>Cerrar</button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void saveLocation()}>Guardar</button>
          </div>
        }
      >
        <div className="grid gap-3">
          <LabField label="Nombre de la sede *" isLight={isLight}><input className={labInputClass(isLight)} value={lf.name} onChange={(e) => setLf({ ...lf, name: e.target.value })} placeholder="Ej: Sede principal" /></LabField>
          <LabField label="Dirección" isLight={isLight}><input className={labInputClass(isLight)} value={lf.address} onChange={(e) => setLf({ ...lf, address: e.target.value })} /></LabField>
          <LabField label="Teléfono" isLight={isLight}><input className={labInputClass(isLight)} value={lf.phone} onChange={(e) => setLf({ ...lf, phone: e.target.value })} /></LabField>
          <LabField label="Responsable" isLight={isLight}><input className={labInputClass(isLight)} value={lf.responsible_person} onChange={(e) => setLf({ ...lf, responsible_person: e.target.value })} /></LabField>
          <LabField label="Estado" isLight={isLight}>
            <label className={(isLight ? "text-[#374151]" : "text-zinc-200") + " flex gap-2 text-sm"}>
              <input type="checkbox" checked={lf.is_active} onChange={(e) => setLf({ ...lf, is_active: e.target.checked })} /> Sede activa
            </label>
          </LabField>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>
    </main>
  );
}

function fmtSolReport(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return "—";
  return (
    "S/. " +
    n.toLocaleString("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function RentabilidadPage() {
  const { isLight } = useApexTheme();
  const [scope, setScope] = useState<"p" | "c" | "a" | "work">("p");
  const [json, setJson] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const path =
      scope === "p"
        ? "/api/reports/profitability-projects"
        : scope === "c"
          ? "/api/reports/profitability-clients"
          : scope === "a"
            ? "/api/reports/profitability-areas"
            : "/api/reports/consultant-workload";
    void getJson<Record<string, unknown>>(path).then(setJson);
  }, [scope]);

  const th = "pb-2 pr-2 text-[10px] font-semibold uppercase " + (isLight ? "text-[#6B7280]" : "text-zinc-500");
  const td = "py-2 pr-2 text-xs align-top " + (isLight ? "text-[#111827]" : "text-zinc-200");

  const formula = typeof json?.formula === "string" ? json.formula : null;

  const renderProjects = () => {
    const data = Array.isArray(json?.data) ? (json!.data as Record<string, unknown>[]) : [];
    return (
      <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr>
              <th className={th}>ID</th>
              <th className={th}>Proyecto</th>
              <th className={th}>Cliente</th>
              <th className={th + " text-right"}>Ingresos</th>
              <th className={th + " text-right"}>Gastos dir.</th>
              <th className={th + " text-right"}>Costo hh</th>
              <th className={th + " text-right"}>Utilidad</th>
              <th className={th + " text-right"}>% margen</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={Number(r.project_id)} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                <td className={td}>{String(r.project_id)}</td>
                <td className={td + " font-medium"}>
                  <Link to={`/proyectos`} className={isLight ? "text-[#007BFF] hover:underline" : "text-[#7AB8FF] hover:underline"}>
                    {String(r.name)}
                  </Link>
                </td>
                <td className={td}>{String(r.client ?? "")}</td>
                <td className={td + " text-right tabular-nums"}>{fmtSolReport(r.ingresos)}</td>
                <td className={td + " text-right tabular-nums"}>{fmtSolReport(r.gastos_directos)}</td>
                <td className={td + " text-right tabular-nums"}>{fmtSolReport(r.costo_horas_estimado)}</td>
                <td className={td + " text-right tabular-nums font-medium"}>{fmtSolReport(r.utilidad_neta_estimada)}</td>
                <td className={td + " text-right"}>{typeof r.margen_pct === "number" ? `${r.margen_pct}%` : String(r.margen_pct ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length ? <p className="py-8 text-center text-sm text-zinc-500">No hay proyectos que mostrar para su alcance.</p> : null}
      </div>
    );
  };

  const renderClients = () => {
    const data = Array.isArray(json?.data) ? (json!.data as Record<string, unknown>[]) : [];
    return (
      <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr>
              <th className={th}>Cliente</th>
              <th className={th}>Áreas</th>
              <th className={th + " text-right"}>Ingresos</th>
              <th className={th + " text-right"}>Gastos decl.</th>
              <th className={th + " text-right"}>Utilidad</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const areas = Array.isArray(r.areas) ? (r.areas as string[]) : [];
              return (
                <tr key={Number(r.client_id)} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                  <td className={td + " font-medium"}>
                    <Link to={`/clientes/${String(r.client_id)}`} className={isLight ? "text-[#007BFF] hover:underline" : "text-[#7AB8FF] hover:underline"}>
                      {String(r.legal_name)}
                    </Link>
                  </td>
                  <td className={td + " text-[11px]"}>{areas.join(", ") || "—"}</td>
                  <td className={td + " text-right tabular-nums"}>{fmtSolReport(r.ingresos)}</td>
                  <td className={td + " text-right tabular-nums"}>{fmtSolReport(r.gastos_declarados)}</td>
                  <td className={td + " text-right tabular-nums font-medium"}>{fmtSolReport(r.utilidad)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.length ? <p className="py-8 text-center text-sm text-zinc-500">Sin datos por cliente.</p> : null}
      </div>
    );
  };

  const renderAreas = () => {
    const data = Array.isArray(json?.data) ? (json!.data as Record<string, unknown>[]) : [];
    return (
      <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
        <table className="w-full min-w-[480px] text-left">
          <thead>
            <tr>
              <th className={th}>Área</th>
              <th className={th + " text-right"}>Ingresos</th>
              <th className={th + " text-right"}>Gastos</th>
              <th className={th + " text-right"}>Utilidad</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={Number(r.area_id)} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                <td className={td + " font-medium"}>{String(r.area_name ?? r.area_id)}</td>
                <td className={td + " text-right tabular-nums"}>{fmtSolReport(r.ingresos)}</td>
                <td className={td + " text-right tabular-nums"}>{fmtSolReport(r.gastos)}</td>
                <td className={td + " text-right tabular-nums font-medium"}>{fmtSolReport(r.utilidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length ? <p className="py-8 text-center text-sm text-zinc-500">Sin áreas disponibles para su usuario.</p> : null}
      </div>
    );
  };

  const renderWorkload = () => {
    const data = Array.isArray(json?.data) ? (json!.data as Record<string, unknown>[]) : [];
    return (
      <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
        <table className="w-full min-w-[360px] text-left">
          <thead>
            <tr>
              <th className={th}>Consultor</th>
              <th className={th + " text-right"}>Horas acumuladas</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={Number(r.user_id)} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                <td className={td + " font-medium"}>{String(r.nombre ?? r.user_id)}</td>
                <td className={td + " text-right tabular-nums"}>{typeof r.total_horas === "number" ? r.total_horas.toFixed(2) : String(r.total_horas)} h</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length ? <p className="py-8 text-center text-sm text-zinc-500">Sin registros de tiempo en alcance.</p> : null}
      </div>
    );
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Rentabilidad & reportes avanzados" }]} isLight={isLight} />
      <LabPageHeader title="Rentabilidad" subtitle="ROI, márgenes, costo de horas y productividad de consultores calculados desde datos reales." isLight={isLight} />
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={scope === "p" ? labPrimaryBtn(isLight) : labGhostBtn(isLight)} onClick={() => setScope("p")}>
          <TrendingUp className="h-4 w-4" /> Por proyecto
        </button>
        <button type="button" className={scope === "c" ? labPrimaryBtn(isLight) : labGhostBtn(isLight)} onClick={() => setScope("c")}>
          Por cliente
        </button>
        <button type="button" className={scope === "a" ? labPrimaryBtn(isLight) : labGhostBtn(isLight)} onClick={() => setScope("a")}>
          Por área
        </button>
        <button type="button" className={scope === "work" ? labPrimaryBtn(isLight) : labGhostBtn(isLight)} onClick={() => setScope("work")}>
          <Radar className="h-4 w-4" /> Carga consultores
        </button>
      </div>
      <div className={labPanelClass(isLight)}>
        {formula ? <p className={"mb-4 text-[11px] leading-relaxed " + (isLight ? "text-[#6B7280]" : "text-zinc-500")}>{formula}</p> : null}
        {!json ? <p className="text-sm text-zinc-500">Cargando…</p> : null}
        {json && scope === "p" ? renderProjects() : null}
        {json && scope === "c" ? renderClients() : null}
        {json && scope === "a" ? renderAreas() : null}
        {json && scope === "work" ? renderWorkload() : null}
      </div>
    </main>
  );
}

const INTEGRATION_LABELS: Record<string, string> = {
  sunat_electronic_billing: "Facturación electrónica SUNAT",
  excel_export: "Exportación Excel / CSV",
  pdf_export: "Exportación PDF",
  power_bi: "Power BI / analítica",
  email: "Correo transaccional",
  whatsapp: "WhatsApp Business",
  crm_externo: "CRM externo",
  google_drive: "Google Drive – copia documental",
};

export function IntegracionesPage() {
  const { isLight } = useApexTheme();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => void getJson<Record<string, unknown>>("/api/integrations").then(setData), []);

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Integraciones" }]} isLight={isLight} />
      <LabPageHeader title="Roadmap de integraciones" subtitle="Estado de cada conector corporativo según configuración backend." isLight={isLight} />
      {!data ? (
        <p className="text-sm text-zinc-500">Consultando configuración…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(data).map(([key, raw]) => {
            const meta = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
            const estado = String(meta.estado ?? "—");
            const nota = String(meta.nota ?? "");
            const ok = estado === "disponible";
            return (
              <div key={key} className={labPanelClass(isLight)}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className={"text-sm font-semibold " + (isLight ? "text-[#111827]" : "text-zinc-100")}>{INTEGRATION_LABELS[key] ?? key}</h3>
                  <span className={labStatusPill(ok ? "ok" : "warn", isLight)}>
                    {ok ? "Disponible" : estado === "planificado" ? "Planificado" : estado}
                  </span>
                </div>
                <p className={"text-xs leading-relaxed " + (isLight ? "text-[#6B7280]" : "text-zinc-500")}>{nota}</p>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export function ReportesGerenciaPage() {
  const { isLight } = useApexTheme();
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  useEffect(() => void getJson<Record<string, unknown>>("/api/reports/insights").then(setPayload), []);

  const period = payload && Array.isArray(payload.period) ? (payload.period as string[]) : null;
  const topClients =
    payload && Array.isArray(payload.top_clients)
      ? (payload.top_clients as { client_id: number; legal_name?: string; total?: number }[])
      : [];
  const cotPendientes = typeof payload?.cotizaciones_pendientes === "number" ? payload.cotizaciones_pendientes : 0;
  const th = "pb-2 pr-2 text-[10px] font-semibold uppercase " + (isLight ? "text-[#6B7280]" : "text-zinc-500");
  const td = "py-2 pr-2 text-xs " + (isLight ? "text-[#111827]" : "text-zinc-200");

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Reportes ejecutivos" }]} isLight={isLight} />
      <LabPageHeader title="Indicadores de gerencia" subtitle="Mes en curso: top ingresos por cliente y trabajo comercial pendiente." isLight={isLight} />
      {!payload ? (
        <p className="text-sm text-zinc-500">Cargando métricas…</p>
      ) : (
        <div className="space-y-4">
          {period && period.length >= 2 ? (
            <p className={"text-xs " + (isLight ? "text-[#6B7280]" : "text-zinc-500")}>
              Periodo analizado: {period[0]} — {period[1]}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className={labPanelClass(isLight)}>
              <p className={"text-[10px] font-semibold uppercase " + (isLight ? "text-[#6B7280]" : "text-zinc-500")}>Cotizaciones pendientes</p>
              <p className={"mt-1 text-2xl font-bold " + (isLight ? "text-[#111827]" : "text-white")}>{cotPendientes}</p>
              <p className={"mt-2 text-[11px] " + (isLight ? "text-[#6B7280]" : "text-zinc-500")}>Borrador + enviada (su alcance de áreas).</p>
              <Link to="/cotizaciones" className={"mt-3 inline-flex text-xs font-semibold " + (isLight ? "text-[#007BFF] hover:underline" : "text-[#7AB8FF] hover:underline")}>
                Ir a cotizaciones
              </Link>
            </div>
          </div>

          <div className={labPanelClass(isLight)}>
            <h3 className={"mb-3 text-sm font-semibold " + (isLight ? "text-[#111827]" : "text-zinc-100")}>Top clientes por ingresos (mes actual)</h3>
            <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
              <table className="w-full min-w-[400px] text-left">
                <thead>
                  <tr>
                    <th className={th}>Cliente</th>
                    <th className={th + " text-right"}>Ingreso acumulado</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((row) => (
                    <tr key={row.client_id} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                      <td className={td + " font-medium"}>{String(row.legal_name ?? "—")}</td>
                      <td className={td + " text-right tabular-nums"}>{fmtSolReport(row.total)}</td>
                      <td className={td}>
                        <Link to={`/clientes/${row.client_id}`} className={labGhostBtn(isLight)}>
                          CRM
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!topClients.length ? <p className="py-6 text-center text-sm text-zinc-500">Sin ingresos con cliente informado este mes.</p> : null}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
