import { FolderKanban } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FormModal } from "../xpande/FormModal";
import { deleteJson, getJson, postJson, putJson, type LaravelPaginated } from "../xpande/http";
import { LabBreadcrumbs, LabField, LabPageHeader, labCrudMainClass, labGhostBtn, labInputClass, labPanelClass, labPrimaryBtn } from "../xpande/XpandeUi";
import { useApexTheme } from "../context/ThemeContext";

type AreaOpt = { id: number; name: string };
type ClientOpt = { id: number; legal_name: string };
type UserOpt = { id: number; name: string };
type ProjRow = {
  id: number;
  name: string;
  status: string;
  client_id?: number;
  budget?: string | null;
  lead_user_id?: number | null;
  service_type?: string | null;
  start_date?: string | null;
  end_estimated?: string | null;
  description?: string | null;
  objectives?: string | null;
  deliverables?: string | null;
  client?: { legal_name?: string };
  areas?: { id: number; name: string }[];
  users?: { id: number }[];
};

export function ProjectsPage() {
  const { isLight } = useApexTheme();
  const loc = useLocation();
  const navigate = useNavigate();

  const [data, setData] = useState<LaravelPaginated<ProjRow> | null>(null);
  const [page, setPage] = useState(1);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "" as "" | number,
    name: "",
    service_type: "",
    start_date: "",
    end_estimated: "",
    status: "pending",
    budget: "",
    lead_user_id: "" as "" | number,
    description: "",
    objectives: "",
    deliverables: "",
    area_ids: [] as number[],
    user_ids: [] as number[],
  });

  const load = (p = page) =>
    void getJson<LaravelPaginated<ProjRow>>("/api/projects", { page: p }).then((r) => {
      setData(r);
      setPage(r.current_page);
    });

  useEffect(() => {
    load(1);
    void getJson<LaravelPaginated<ClientOpt>>("/api/clients", { per_page: 150 }).then((r) => setClients(r.data));
    void getJson<AreaOpt[]>("/api/areas", { active_only: false }).then(setAreas);
    void getJson<UserOpt[]>("/api/collaborators").then(setUsers);
  }, []);

  useEffect(() => {
    const st = loc.state as { openProjectCreate?: boolean } | undefined;
    if (st?.openProjectCreate) {
      setEditId(null);
      setForm({
        client_id: "",
        name: "",
        service_type: "",
        start_date: "",
        end_estimated: "",
        status: "pending",
        budget: "",
        lead_user_id: "",
        description: "",
        objectives: "",
        deliverables: "",
        area_ids: [],
        user_ids: [],
      });
      setOpen(true);
      navigate(loc.pathname, { replace: true, state: {} });
    }
  }, [loc.pathname, loc.state, navigate]);

  const openEdit = async (id: number) => {
    setErr(null);
    try {
      const p = await getJson<ProjRow>(`/api/projects/${id}`);
      setEditId(id);
      const aid = (p.areas ?? []).map((a) => a.id);
      setForm({
        client_id: typeof p.client_id === "number" ? p.client_id : "",
        name: p.name,
        service_type: p.service_type ?? "",
        start_date: p.start_date ?? "",
        end_estimated: p.end_estimated ?? "",
        status: p.status,
        budget: p.budget ?? "",
        lead_user_id: p.lead_user_id ?? "",
        description: p.description ?? "",
        objectives: p.objectives ?? "",
        deliverables: p.deliverables ?? "",
        area_ids: aid.length ? aid : [],
        user_ids: (p.users ?? []).map((u) => u.id),
      });
      setOpen(true);
    } catch {
      setErr("No se pudo cargar el proyecto.");
    }
  };

  const toggleArea = (id: number) =>
    void setForm((f) => ({ ...f, area_ids: f.area_ids.includes(id) ? f.area_ids.filter((x) => x !== id) : [...f.area_ids, id] }));
  const toggleUser = (id: number) =>
    void setForm((f) => ({ ...f, user_ids: f.user_ids.includes(id) ? f.user_ids.filter((x) => x !== id) : [...f.user_ids, id] }));

  const save = async () => {
    setErr(null);
    if (!form.name.trim() || form.client_id === "" || form.area_ids.length === 0) {
      setErr("Nombre, cliente y al menos un área son obligatorios.");
      return;
    }
    try {
      const body: Record<string, unknown> = {
        client_id: form.client_id,
        name: form.name,
        service_type: form.service_type || null,
        start_date: form.start_date || null,
        end_estimated: form.end_estimated || null,
        status: form.status,
        budget: form.budget ? Number(form.budget) : null,
        lead_user_id: form.lead_user_id === "" ? null : form.lead_user_id,
        description: form.description || null,
        objectives: form.objectives || null,
        deliverables: form.deliverables || null,
        area_ids: form.area_ids,
        user_ids: form.user_ids,
      };
      if (editId) await putJson(`/api/projects/${editId}`, body);
      else await postJson("/api/projects", body);
      setOpen(false);
      load(page);
      setEditId(null);
    } catch {
      setErr("No se pudo guardar (verifique permisos por área).");
    }
  };

  const cancelProj = async (id: number) => {
    if (!confirm("¿Marcar proyecto como cancelado?")) return;
    try {
      await deleteJson(`/api/projects/${id}`);
      load(page);
    } catch {
      setErr("No se pudo actualizar estado.");
    }
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Proyectos" }]} isLight={isLight} />
      <LabPageHeader
        title="Portafolio de proyectos"
        subtitle="Creación por cliente, vínculos con áreas y equipo asignado."
        isLight={isLight}
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={() => {setEditId(null); setErr(null); setOpen(true);}}>
            <FolderKanban className="h-4 w-4" /> Nuevo proyecto
          </button>
        }
      />
      {err ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}

      <div className={labPanelClass(isLight)}>
        {!data ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
        ) : (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>
                  <th className="pb-3 uppercase text-[10px] font-semibold">Proyecto</th>
                  <th className="pb-3 uppercase text-[10px] font-semibold">Cliente</th>
                  <th className="pb-3 uppercase text-[10px] font-semibold">Áreas</th>
                  <th className="pb-3 uppercase text-[10px] font-semibold">Estado</th>
                  <th className="pb-3 text-right uppercase text-[10px] font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                    <td className={"py-2 pr-4 font-semibold " + (isLight ? "text-[#111827]" : "text-white")}>{p.name}</td>
                    <td className="py-2 pr-4 text-xs">{p.client?.legal_name ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs">{(p.areas ?? []).map((x) => x.name).join(", ")}</td>
                    <td className={"py-2 pr-4 text-xs uppercase"}>{p.status}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button type="button" className={labGhostBtn(isLight)} onClick={() => void openEdit(p.id)}>
                        Editar
                      </button>{" "}
                      {typeof p.client_id === "number" ? (
                        <Link to={`/clientes/${p.client_id}`} className={"inline-flex " + labGhostBtn(isLight)}>
                          CRM
                        </Link>
                      ) : null}{" "}
                      <button type="button" className={labGhostBtn(isLight)} onClick={() => void cancelProj(p.id)}>
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.last_page > 1 ? (
          <div className="mt-3 flex gap-2 text-xs">
            <button type="button" className={labGhostBtn(isLight)} disabled={page <= 1} onClick={() => load(page - 1)}>
              Anterior
            </button>
            <span className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>{page}</span>
            <button type="button" className={labGhostBtn(isLight)} disabled={page >= data.last_page} onClick={() => load(page + 1)}>
              Siguiente
            </button>
          </div>
        ) : null}
      </div>

      <FormModal
        open={open}
        title={editId ? "Editar proyecto" : "Nuevo proyecto"}
        isLight={isLight}
        wide
        onClose={() => {setOpen(false); setErr(null);}}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setOpen(false)}>
              Cerrar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void save()}>
              Guardar
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabField label="Cliente *" isLight={isLight} className="sm:col-span-2">
            <select
              className={labInputClass(isLight)}
              value={form.client_id === "" ? "" : String(form.client_id)}
              onChange={(e) => setForm({ ...form, client_id: e.target.value ? Number(e.target.value) : "" })}
            >
              <option value="">Seleccionar…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legal_name}
                </option>
              ))}
            </select>
          </LabField>
          <LabField label="Nombre *" isLight={isLight} className="sm:col-span-2">
            <input className={labInputClass(isLight)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </LabField>
          <LabField label="Tipo de servicio" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} />
          </LabField>
          <LabField label="Estado" isLight={isLight}>
            <select className={labInputClass(isLight)} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pending">Pendiente</option>
              <option value="in_progress">En proceso</option>
              <option value="paused">Pausado</option>
              <option value="finished">Finalizado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </LabField>
          <LabField label="Inicio" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </LabField>
          <LabField label="Fin estimado" isLight={isLight}>
            <input type="date" className={labInputClass(isLight)} value={form.end_estimated} onChange={(e) => setForm({ ...form, end_estimated: e.target.value })} />
          </LabField>
          <LabField label="Presupuesto" isLight={isLight}>
            <input type="number" step="0.01" className={labInputClass(isLight)} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </LabField>
          <LabField label="Responsable" isLight={isLight}>
            <select className={labInputClass(isLight)} value={form.lead_user_id === "" ? "" : String(form.lead_user_id)} onChange={(e) => setForm({ ...form, lead_user_id: e.target.value ? Number(e.target.value) : "" })}>
              <option value="">Sin asignar</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
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
                  <input type="checkbox" checked={form.area_ids.includes(a.id)} onChange={() => toggleArea(a.id)} /> {a.name}
                </label>
              ))}
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
          {err ? <p className="sm:col-span-2 text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>
    </main>
  );
}
