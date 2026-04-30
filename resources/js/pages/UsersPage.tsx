import { MoreHorizontal, Shield, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createUser, deleteUser, fetchUser, fetchUsersPage, updateUser, type ManagedUser } from "../users/api";
import { FormModal } from "../xpande/FormModal";
import {
  LabBreadcrumbs,
  LabField,
  LabPageHeader,
  LabToolbar,
  labCrudMainClass,
  labGhostBtn,
  labInputClass,
  labPanelClass,
  labPrimaryBtn,
  labStatusPill,
  initialsFrom,
} from "../xpande/XpandeUi";
import { getJson } from "../xpande/http";
import { useApexTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

function downloadUsersCsv(rows: ManagedUser[]) {
  const head = ["id", "name", "email", "role", "areas", "created_at"];
  const esc = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    head.join(","),
    ...rows.map((u) =>
      [
        u.id,
        u.name,
        u.email,
        u.role?.slug ?? "",
        (u.areas ?? []).map((a) => a.name).join(";"),
        (u as { created_at?: string }).created_at ?? "",
      ]
        .map(esc)
        .join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type RoleOpt = { id: number; name: string; slug: string };
type AreaOpt = { id: number; name: string };

export function UsersPage() {
  const { isLight } = useApexTheme();
  const { user } = useAuth();
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "admins" | "users">("all");
  const [menuId, setMenuId] = useState<number | null>(null);

  const [roles, setRoles] = useState<RoleOpt[]>([]);
  const [areasList, setAreasList] = useState<AreaOpt[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    is_superadmin: false,
    role_id: "" as "" | number,
    phone: "",
    is_active: true,
    contract_type: "",
    salary: "",
    cost_per_hour: "",
    availability: "",
    specialty: "",
    area_ids: [] as number[],
  });

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetchUsersPage(p, q);
      setRows(res.data);
      setPage(res.current_page);
      setTotalPages(res.last_page);
    } catch {
      setErr("No se pudo cargar la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1).catch(() => undefined);
    getJson<RoleOpt[]>("/api/roles").then(setRoles).catch(() => setRoles([]));
    getJson<AreaOpt[]>("/api/areas", { active_only: false }).then(setAreasList).catch(() => setAreasList([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(1), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab === "admins") list = list.filter((u) => u.is_superadmin);
    else if (tab === "users") list = list.filter((u) => !u.is_superadmin);
    return list;
  }, [rows, tab]);

  const toggleArea = (id: number) => {
    setForm((f) => ({
      ...f,
      area_ids: f.area_ids.includes(id) ? f.area_ids.filter((x) => x !== id) : [...f.area_ids, id],
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      email: "",
      password: "",
      is_superadmin: false,
      role_id: "",
      phone: "",
      is_active: true,
      contract_type: "",
      salary: "",
      cost_per_hour: "",
      availability: "",
      specialty: "",
      area_ids: [],
    });
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    setErr(null);
    try {
      const u = await fetchUser(id);
      setEditingId(u.id);
      setForm({
        name: u.name,
        email: u.email,
        password: "",
        is_superadmin: u.is_superadmin,
        role_id: u.role_id ?? "",
        phone: u.phone ?? "",
        is_active: Boolean(u.is_active ?? true),
        contract_type: u.contract_type ?? "",
        salary: u.salary ?? "",
        cost_per_hour: u.cost_per_hour ?? "",
        availability: u.availability ?? "",
        specialty: u.specialty ?? "",
        area_ids: (u.areas ?? []).map((a) => a.id),
      });
      setModalOpen(true);
      setMenuId(null);
    } catch {
      setErr("No se pudo cargar el usuario.");
    }
  };

  const submit = async () => {
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        is_superadmin: form.is_superadmin,
        phone: form.phone || null,
        is_active: form.is_active,
        contract_type: form.contract_type || null,
        salary: form.salary ? Number(form.salary) : null,
        cost_per_hour: form.cost_per_hour ? Number(form.cost_per_hour) : null,
        availability: form.availability || null,
        specialty: form.specialty || null,
        area_ids: form.area_ids,
      };
      if (form.role_id !== "") payload.role_id = form.role_id;
      if (form.password.trim()) payload.password = form.password;
      if (editingId) {
        if (!payload.password) delete payload.password;
        await updateUser(editingId, payload);
      } else {
        if (!form.password.trim()) {
          setErr("La contraseña es obligatoria para nuevos usuarios.");
          return;
        }
        await createUser(payload);
      }
      setModalOpen(false);
      await load(page);
    } catch {
      setErr("No se pudo guardar el usuario.");
    }
  };

  const remove = async (target: ManagedUser) => {
    if (!confirm(`¿Eliminar al usuario ${target.name}?`)) return;
    try {
      await deleteUser(target.id);
      await load(page);
    } catch {
      setErr("No se pudo eliminar. Recuerde: no se puede borrar al superadmin.");
    } finally {
      setMenuId(null);
    }
  };

  return (
    <main className={labCrudMainClass(isLight)} onClick={() => setMenuId(null)}>
      <LabBreadcrumbs isLight={isLight} items={[{ label: "Dashboard", to: "/" }, { label: "Usuarios internos" }]} />
      <LabPageHeader
        isLight={isLight}
        title="Consultores / usuarios internos"
        subtitle="Gestión del personal, cargos y áreas asignadas. Los formularios se abren en modal."
        action={
          <button type="button" className={labPrimaryBtn(isLight)} onClick={openCreate}>
            <UserPlus className="h-4 w-4" />
            Nuevo usuario
          </button>
        }
      />

      {err ? <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">{err}</p> : null}

      <LabToolbar
        isLight={isLight}
        tabs={[
          { id: "all", label: "Todos" },
          { id: "admins", label: "Superadmins" },
          { id: "users", label: "Equipo" },
        ]}
        activeTab={tab}
        onTab={(id) => setTab(id as typeof tab)}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Buscar por nombre o correo…"
        right={
          <button type="button" className={labGhostBtn(isLight)} onClick={() => downloadUsersCsv(filtered)}>
            Exportar página
          </button>
        }
      />

      <div className={labPanelClass(isLight)}>
        {loading ? (
          <p className={isLight ? "py-8 text-center text-[#6B7280]" : "py-8 text-center text-zinc-500"}>Cargando…</p>
        ) : (
          <div className={["overflow-x-auto", isLight ? "apex-table-scroll--light" : "apex-table-scroll--dark"].join(" ")}>
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>
                  <th className="w-10 pb-3 pr-2" />
                  <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wide">Usuario</th>
                  <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wide">Correo</th>
                  <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wide">Rol</th>
                  <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wide">Áreas</th>
                  <th className="w-12 pb-3 text-right text-xs font-semibold uppercase tracking-wide" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className={isLight ? "border-t border-[#F3F4F6]" : "border-t border-white/[0.06]"}>
                    <td className="py-3 pr-2">
                      <span
                        className={[
                          "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",
                          isLight ? "bg-[#E6F3FF] text-[#005BBF]" : "bg-[#0a2744] text-[#7AB8FF]",
                        ].join(" ")}
                      >
                        {initialsFrom(u.name)}
                      </span>
                    </td>
                    <td className={["py-3 pr-3 font-medium", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>{u.name}</td>
                    <td className={["py-3 pr-3", isLight ? "text-[#4B5563]" : "text-zinc-300"].join(" ")}>{u.email}</td>
                    <td className="py-3 pr-3">
                      <span className={labStatusPill(u.is_superadmin ? "ok" : "neutral", isLight)}>
                        {u.role?.name ?? (u.is_superadmin ? "Superadmin" : "—")}
                      </span>
                    </td>
                    <td className={["py-3 pr-3 text-xs", isLight ? "text-[#6B7280]" : "text-zinc-400"].join(" ")}>
                      {(u.areas ?? []).map((a) => a.name).join(", ") || "—"}
                    </td>
                    <td className="relative py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId(menuId === u.id ? null : u.id);
                        }}
                        className={[
                          "rounded-lg p-2 transition-colors",
                          isLight ? "text-[#6B7280] hover:bg-[#F3F4F6]" : "text-zinc-400 hover:bg-white/[0.06]",
                        ].join(" ")}
                        aria-label="Acciones"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                      {menuId === u.id ? (
                        <div
                          className={[
                            "absolute right-0 z-20 mt-1 min-w-[170px] rounded-lg py-1 shadow-lg ring-1",
                            isLight ? "border border-[#E5E7EB] bg-white ring-black/5" : "border border-white/10 bg-[#161616] ring-white/10",
                          ].join(" ")}
                        >
                          <button
                            type="button"
                            onClick={() => void openEdit(u.id)}
                            className={["block w-full px-3 py-2 text-left text-sm", isLight ? "text-[#111827] hover:bg-[#F9FAFB]" : "text-zinc-200 hover:bg-white/[0.05]"].join(
                              " ",
                            )}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={u.is_superadmin || user?.id === u.id}
                            onClick={() => remove(u)}
                            className="block w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Eliminar
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <button type="button" className={labGhostBtn(isLight)} disabled={page <= 1} onClick={() => void load(page - 1)}>
            Anterior
          </button>
          <span className={isLight ? "text-[#6B7280]" : "text-zinc-500"}>
            Página {page} / {totalPages}
          </span>
          <button type="button" className={labGhostBtn(isLight)} disabled={page >= totalPages} onClick={() => void load(page + 1)}>
            Siguiente
          </button>
        </div>
      ) : null}

      <p className={["mt-3 inline-flex items-center gap-2 text-xs", isLight ? "text-[#6B7280]" : "text-zinc-500"].join(" ")}>
        <Shield className="h-4 w-4" />
        Solo administradores pueden gestionar usuarios. El primer superadmin queda protegido frente a eliminaciones peligrosas.
      </p>

      <FormModal
        open={modalOpen}
        title={editingId ? "Editar usuario" : "Nuevo usuario"}
        subtitle="Asigne rol y áreas para aplicar las reglas de visibilidad del sistema."
        isLight={isLight}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" className={labPrimaryBtn(isLight)} onClick={() => void submit()}>
              Guardar
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <LabField label="Nombre completo" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </LabField>
          <LabField label="Correo" isLight={isLight}>
            <input className={labInputClass(isLight)} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </LabField>
          <LabField label={editingId ? "Nueva contraseña (opcional)" : "Contraseña"} isLight={isLight}>
            <input className={labInputClass(isLight)} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </LabField>
          <LabField label="Teléfono" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </LabField>
          <LabField label="Rol" isLight={isLight}>
            <select className={labInputClass(isLight)} value={form.role_id === "" ? "" : String(form.role_id)} onChange={(e) => setForm({ ...form, role_id: e.target.value ? Number(e.target.value) : "" })}>
              <option value="">Seleccionar…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </LabField>
          <LabField label="Contrato / tipo" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })} />
          </LabField>
          <LabField label="Sueldo" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
          </LabField>
          <LabField label="Costo por hora" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.cost_per_hour} onChange={(e) => setForm({ ...form, cost_per_hour: e.target.value })} />
          </LabField>
          <LabField label="Disponibilidad" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} />
          </LabField>
          <LabField label="Especialidad" isLight={isLight}>
            <input className={labInputClass(isLight)} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          </LabField>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-2">
            <label className={["flex items-center gap-2 text-sm font-medium", isLight ? "text-[#374151]" : "text-zinc-200"].join(" ")}>
              <input type="checkbox" checked={form.is_superadmin} onChange={(e) => setForm({ ...form, is_superadmin: e.target.checked })} />
              Superadmin
            </label>
            <label className={["flex items-center gap-2 text-sm font-medium", isLight ? "text-[#374151]" : "text-zinc-200"].join(" ")}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Activo
            </label>
          </div>
          <LabField label="Áreas asignadas" isLight={isLight} className="sm:col-span-2">
            <div
              className={[
                "flex flex-wrap gap-2 rounded-lg border p-3",
                isLight ? "border-[#E5E7EB] bg-[#F9FAFB]" : "border-white/[0.06] bg-[#0a0a0a]/60",
              ].join(" ")}
            >
              {areasList.map((a) => (
                <label key={a.id} className={["flex items-center gap-1.5 text-xs font-medium", isLight ? "text-[#374151]" : "text-zinc-200"].join(" ")}>
                  <input type="checkbox" checked={form.area_ids.includes(a.id)} onChange={() => toggleArea(a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
          </LabField>
        </div>
      </FormModal>
    </main>
  );
}
