import { Boxes, Pencil, Plus, Power, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormModal } from "../xpande/FormModal";
import { apiErrorMessage } from "../xpande/apiError";
import { deleteJson, getJson, postJson, putJson } from "../xpande/http";
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
import { useApexTheme } from "../context/ThemeContext";

type AreaOpt = { id: number; name: string };
type SaasRow = {
  id: number;
  name: string;
  area_id?: number | null;
  description?: string | null;
  billing_cycle?: string | null;
  base_price?: string | null;
  is_active?: boolean;
  area?: { id?: number; name?: string } | null;
};

const blankForm = {
  name: "",
  area_id: "" as "" | number,
  billing_cycle: "monthly",
  base_price: "",
  description: "",
  is_active: true,
};

function cycleLabel(value?: string | null): string {
  if (value === "monthly") return "Mensual";
  if (value === "quarterly") return "Trimestral";
  if (value === "annual") return "Anual";
  if (value === "one_time") return "Unico";
  return "Sin ciclo";
}

export function SaasProductsPage() {
  const { isLight } = useApexTheme();
  const [rows, setRows] = useState<SaasRow[]>([]);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<SaasRow | null>(null);
  const [form, setForm] = useState(blankForm);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [saas, areaRows] = await Promise.all([
        getJson<SaasRow[]>("/api/catalog/services", { kind: "saas", active_only: false }),
        getJson<AreaOpt[]>("/api/areas", { active_only: false }),
      ]);
      setRows(saas);
      setAreas(areaRows);
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, "No se pudo cargar el catalogo SaaS."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((row) => `${row.name} ${row.area?.name ?? ""} ${row.description ?? ""}`.toLowerCase().includes(s));
  }, [query, rows]);

  const startCreate = () => {
    setEditRow(null);
    setForm(blankForm);
    setErr(null);
    setOpen(true);
  };

  const startEdit = (row: SaasRow) => {
    setEditRow(row);
    setForm({
      name: row.name ?? "",
      area_id: typeof row.area_id === "number" ? row.area_id : row.area?.id ?? "",
      billing_cycle: row.billing_cycle ?? "monthly",
      base_price: row.base_price != null ? String(row.base_price) : "",
      description: row.description ?? "",
      is_active: row.is_active !== false,
    });
    setErr(null);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditRow(null);
    setForm(blankForm);
    setErr(null);
  };

  const save = async () => {
    setErr(null);
    if (!form.name.trim()) {
      setErr("El nombre del SaaS es obligatorio.");
      return;
    }
    const body = {
      name: form.name.trim(),
      kind: "saas",
      area_id: form.area_id === "" ? null : form.area_id,
      billing_cycle: form.billing_cycle || null,
      base_price: form.base_price ? Number(form.base_price) : null,
      description: form.description.trim() || null,
      is_active: form.is_active,
    };

    try {
      if (editRow) await putJson(`/api/catalog/services/${editRow.id}`, body);
      else await postJson("/api/catalog/services", body);
      close();
      await load();
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, "No se pudo guardar el producto SaaS."));
    }
  };

  const deactivate = async (row: SaasRow) => {
    if (!confirm("Dar de baja este producto SaaS?")) return;
    setErr(null);
    try {
      await deleteJson(`/api/catalog/services/${row.id}`);
      await load();
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, "No se pudo dar de baja."));
    }
  };

  return (
    <main className={labCrudMainClass(isLight)}>
      <LabBreadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "SaaS" }]} isLight={isLight} />
      <LabPageHeader
        title="Productos SaaS"
        subtitle="Catalogo de productos propios para afiliarlos a clientes desde el portafolio."
        isLight={isLight}
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={startCreate}>
            <Plus className="h-4 w-4" /> Nuevo SaaS
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar SaaS, area o descripcion..."
          className={["w-full sm:max-w-md", labInputClass(isLight)].join(" ")}
        />
        <button type="button" className={labGhostBtn(isLight)} onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      {err && !open ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}

      <div className={labPanelClass(isLight)}>
        {loading ? (
          <p className="py-10 text-center text-sm text-zinc-500">Cargando...</p>
        ) : (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>
                  <th className="pb-3 pr-3 text-xs font-semibold uppercase">Producto</th>
                  <th className="pb-3 pr-3 text-xs font-semibold uppercase">Area</th>
                  <th className="pb-3 pr-3 text-xs font-semibold uppercase">Ciclo</th>
                  <th className="pb-3 pr-3 text-right text-xs font-semibold uppercase">Precio base</th>
                  <th className="pb-3 pr-3 text-xs font-semibold uppercase">Estado</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className={"border-t " + (isLight ? "border-[#F3F4F6]" : "border-white/[0.06]")}>
                    <td className={"py-3 pr-3 " + (isLight ? "text-[#111827]" : "text-zinc-100")}>
                      <div className="flex items-center gap-2 font-semibold">
                        <Boxes className="h-4 w-4 text-[#007BFF]" /> {row.name}
                      </div>
                      {row.description ? <p className="mt-1 max-w-md text-xs font-normal text-zinc-500">{row.description}</p> : null}
                    </td>
                    <td className="py-3 pr-3 text-xs">{row.area?.name ?? "Sin area"}</td>
                    <td className="py-3 pr-3 text-xs">{cycleLabel(row.billing_cycle)}</td>
                    <td className="py-3 pr-3 text-right text-xs tabular-nums">{row.base_price != null ? `S/. ${row.base_price}` : "-"}</td>
                    <td className="py-3 pr-3 text-xs">
                      <span className={labStatusPill(row.is_active === false ? "warn" : "ok", isLight)}>
                        {row.is_active === false ? "Inactivo" : "Activo"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" className={labGhostBtn(isLight)} onClick={() => startEdit(row)}>
                          <Pencil className="h-4 w-4" /> Editar
                        </button>
                        <button type="button" className={labGhostBtn(isLight)} onClick={() => void deactivate(row)}>
                          <Power className="h-4 w-4" /> Baja
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRows.length ? <p className="py-8 text-center text-sm text-zinc-500">Sin productos SaaS.</p> : null}
          </div>
        )}
      </div>

      <FormModal
        open={open}
        title={editRow ? "Editar SaaS" : "Nuevo SaaS"}
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
          <LabField label="Nombre *" isLight={isLight} className="sm:col-span-2">
            <input className={labInputClass(isLight)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </LabField>
          <LabField label="Area" isLight={isLight}>
            <select className={labInputClass(isLight)} value={form.area_id === "" ? "" : String(form.area_id)} onChange={(e) => setForm({ ...form, area_id: e.target.value ? Number(e.target.value) : "" })}>
              <option value="">Sin area</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
          </LabField>
          <LabField label="Ciclo de cobro" isLight={isLight}>
            <select className={labInputClass(isLight)} value={form.billing_cycle} onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}>
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="annual">Anual</option>
              <option value="one_time">Unico</option>
            </select>
          </LabField>
          <LabField label="Precio base" isLight={isLight}>
            <input type="number" min="0" step="0.01" className={labInputClass(isLight)} value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
          </LabField>
          <LabField label="Activo" isLight={isLight}>
            <label className={(isLight ? "text-[#374151]" : "text-zinc-200") + " flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm " + (isLight ? "border-[#E5E7EB]" : "border-white/[0.08]")}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Disponible para afiliaciones
            </label>
          </LabField>
          <LabField label="Descripcion" isLight={isLight} className="sm:col-span-2">
            <textarea rows={3} className={labInputClass(isLight)} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </LabField>
          {err ? <p className="sm:col-span-2 text-sm text-red-600">{err}</p> : null}
        </div>
      </FormModal>
    </main>
  );
}
