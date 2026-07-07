import { AlertCircle, AlertTriangle, Bell, Clock, Info, KeyRound, LogOut, Menu, Moon, Palette, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApexTheme } from "../context/ThemeContext";
import { getJson, postJson } from "../xpande/http";
import { apiErrorMessage } from "../xpande/apiError";
import { FormModal } from "../xpande/FormModal";
import { LabNoticeModal } from "../xpande/LabTableKit";
import { LabField, labGhostBtn, labInputClass, labPrimaryBtn } from "../xpande/XpandeUi";

type NotifItem = {
  id: string;
  type: "cxc" | "cxp" | "tiempos";
  severity: "danger" | "warning" | "info";
  title: string;
  body: string;
  date: string | null;
  link: string;
};

type NotifResponse = { count: number; items: NotifItem[] };

function severityIcon(severity: NotifItem["severity"]) {
  if (severity === "danger")  return <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />;
  return <Info className="h-4 w-4 shrink-0 text-blue-400" />;
}

function typeLabel(type: NotifItem["type"]) {
  if (type === "cxc")    return "Cobro";
  if (type === "cxp")    return "Pago";
  return "Tiempo";
}

export function TopBar({ setMobileMenuOpen }: { setMobileMenuOpen?: (v: boolean) => void }) {
  const { isLight, setMode } = useApexTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen]   = useState(false);
  const [notifs, setNotifs]         = useState<NotifItem[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", new_password_confirmation: "" });
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; title: string; message: string } | null>(null);

  const closePwModal = () => {
    setPwOpen(false);
    setPwForm({ current_password: "", new_password: "", new_password_confirmation: "" });
    setPwErr(null);
  };

  const savePassword = async () => {
    setPwErr(null);
    if (pwForm.new_password !== pwForm.new_password_confirmation) {
      setPwErr("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    setPwSaving(true);
    try {
      await postJson("/api/auth/change-password", pwForm);
      closePwModal();
      setNotice({
        variant: "success",
        title: "Contraseña actualizada",
        message: "Tu contraseña se cambió correctamente.",
      });
    } catch (e: unknown) {
      setPwErr(apiErrorMessage(e, "No se pudo cambiar la contraseña."));
    } finally {
      setPwSaving(false);
    }
  };

  const fetchNotifs = () => {
    void getJson<NotifResponse>("/api/notifications").then((r) => {
      setNotifs(r.items);
      setNotifCount(r.count);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchNotifs();
    const id = window.setInterval(fetchNotifs, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // close on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  // close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  const handleNotifClick = (item: NotifItem) => {
    setNotifOpen(false);
    navigate(item.link);
  };

  return (
    <header
      className={[
        "flex h-16 shrink-0 items-center gap-4 px-4 lg:px-6",
        isLight
          ? "border-b border-[#E5E7EB] bg-white shadow-sm"
          : "border-b border-white/[0.04] bg-[#000000]",
      ].join(" ")}
    >
      <button
        className={["md:hidden p-2 -ml-2 rounded-lg transition-colors", isLight ? "text-zinc-500 hover:bg-zinc-100" : "text-zinc-500 hover:bg-white/5"].join(" ")}
        onClick={() => setMobileMenuOpen?.(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative min-w-0 max-w-md flex-1">
        <input
          type="search"
          placeholder="Buscar"
          className={[
            "h-10 w-full rounded-xl pl-4 pr-4 text-sm outline-none",
            isLight
              ? "border border-[#E5E7EB] bg-white text-[#111827] placeholder:text-[#9CA3AF] ring-[#007BFF]/22 focus:ring-2"
              : "border border-white/[0.06] bg-[#121212] text-zinc-200 placeholder:text-zinc-600 ring-[#007BFF]/35 focus:ring-2",
          ].join(" ")}
        />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Link
          to="/proyectos"
          state={{ openProjectCreate: true }}
          className={[
            "hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition sm:inline-flex",
            isLight
              ? "bg-[#007BFF] text-white shadow-sm hover:bg-[#0063D5]"
              : "bg-[#007BFF] text-white shadow-[0_0_28px_rgba(0,123,255,0.45)] hover:brightness-110",
          ].join(" ")}
        >
          <span>+</span> Nuevo Proyecto
        </Link>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
          className={[
            "rounded-lg p-2 transition-colors",
            isLight ? "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
          ].join(" ")}
          title="Tema"
        >
          {isLight ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        <button
          type="button"
          className={[
            "rounded-lg p-2 transition-colors",
            isLight ? "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
          ].join(" ")}
          title="Personalizar"
        >
          <Palette className="h-5 w-5" />
        </button>

        {/* ── Notification Bell ── */}
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className={[
              "relative rounded-lg p-2 transition-colors",
              isLight ? "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
            ].join(" ")}
            title="Notificaciones"
          >
            <Bell className="h-5 w-5" />
            {notifCount > 0 && (
              <span
                className={[
                  "absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white ring-2",
                  notifs.some((n) => n.severity === "danger") ? "bg-red-500 ring-red-500/30" : "bg-amber-500 ring-amber-500/30",
                  isLight ? "ring-white" : "ring-black",
                ].join(" ")}
              >
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className={[
                "absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl shadow-2xl ring-1 overflow-hidden",
                isLight ? "bg-white ring-black/[0.06]" : "bg-[#111111] ring-white/[0.08]",
              ].join(" ")}
            >
              {/* header */}
              <div className={["flex items-center justify-between px-4 py-3 border-b", isLight ? "border-[#F3F4F6]" : "border-white/[0.06]"].join(" ")}>
                <div className="flex items-center gap-2">
                  <Bell className={"h-4 w-4 " + (isLight ? "text-[#6B7280]" : "text-zinc-400")} />
                  <span className={"text-sm font-semibold " + (isLight ? "text-[#111827]" : "text-zinc-100")}>
                    Notificaciones
                  </span>
                  {notifCount > 0 && (
                    <span className={"rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white " + (notifs.some((n) => n.severity === "danger") ? "bg-red-500" : "bg-amber-500")}>
                      {notifCount}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setNotifOpen(false)} className={"rounded p-0.5 " + (isLight ? "text-zinc-400 hover:bg-zinc-100" : "text-zinc-500 hover:bg-white/5")}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* list */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <Clock className={"h-8 w-8 " + (isLight ? "text-zinc-300" : "text-zinc-600")} />
                    <p className={"text-xs " + (isLight ? "text-zinc-400" : "text-zinc-500")}>Sin alertas pendientes</p>
                  </div>
                ) : (
                  <ul>
                    {notifs.map((item, i) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleNotifClick(item)}
                          className={[
                            "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors",
                            i < notifs.length - 1 ? (isLight ? "border-b border-[#F3F4F6]" : "border-b border-white/[0.04]") : "",
                            isLight ? "hover:bg-[#F9FAFB]" : "hover:bg-white/[0.04]",
                          ].join(" ")}
                        >
                          <span className="mt-0.5">{severityIcon(item.severity)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1">
                              <span className={"text-xs font-semibold leading-snug " + (isLight ? "text-[#111827]" : "text-zinc-100")}>
                                {item.title}
                              </span>
                              {item.date && (
                                <span className={"shrink-0 text-[10px] tabular-nums " + (isLight ? "text-zinc-400" : "text-zinc-500")}>
                                  {item.date}
                                </span>
                              )}
                            </div>
                            <p className={"mt-0.5 truncate text-[11px] " + (isLight ? "text-[#6B7280]" : "text-zinc-400")}>
                              {item.body}
                            </p>
                            <span className={"mt-1 inline-block rounded-sm px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide " +
                              (item.type === "cxc" ? "bg-blue-500/10 text-blue-400" :
                               item.type === "cxp" ? "bg-orange-500/10 text-orange-400" :
                               "bg-purple-500/10 text-purple-400")
                            }>
                              {typeLabel(item.type)}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* footer */}
              {notifs.length > 0 && (
                <div className={["border-t px-4 py-2.5", isLight ? "border-[#F3F4F6] bg-[#F9FAFB]" : "border-white/[0.06] bg-white/[0.02]"].join(" ")}>
                  <div className="flex gap-3 text-xs">
                    <button type="button" onClick={() => { setNotifOpen(false); navigate("/cuentas-por-cobrar"); }} className={"font-medium " + (isLight ? "text-[#007BFF] hover:underline" : "text-[#7AB8FF] hover:underline")}>
                      Ver cobros
                    </button>
                    <span className={isLight ? "text-zinc-300" : "text-zinc-700"}>·</span>
                    <button type="button" onClick={() => { setNotifOpen(false); navigate("/cuentas-por-pagar"); }} className={"font-medium " + (isLight ? "text-[#007BFF] hover:underline" : "text-[#7AB8FF] hover:underline")}>
                      Ver pagos
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className={[
              "ml-1 flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-opacity hover:opacity-90",
              isLight
                ? "border border-[#B3D9FF] bg-[#007BFF] text-white"
                : "border border-white/[0.1] bg-zinc-800 text-zinc-200",
            ].join(" ")}
            title={user?.name ?? "Usuario"}
          >
            {(user?.name ?? "U")
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((x) => x[0]?.toUpperCase() ?? "")
              .join("")}
          </button>

          {userMenuOpen && (
            <div
              className={[
                "absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl shadow-2xl ring-1 overflow-hidden",
                isLight ? "bg-white ring-black/[0.06]" : "bg-[#111111] ring-white/[0.08]",
              ].join(" ")}
            >
              <div className={["px-4 py-3 border-b", isLight ? "border-[#F3F4F6]" : "border-white/[0.06]"].join(" ")}>
                <p className={["truncate text-sm font-medium", isLight ? "text-[#111827]" : "text-zinc-100"].join(" ")}>
                  {user?.name ?? "Usuario"}
                </p>
                <p className={["text-xs", isLight ? "text-[#94A3B8]" : "text-zinc-500"].join(" ")}>
                  {user?.role_name ?? (user?.is_superadmin ? "Superadmin" : "Colaborador")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); setPwOpen(true); }}
                className={[
                  "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors",
                  isLight ? "text-[#374151] hover:bg-[#F9FAFB]" : "text-zinc-300 hover:bg-white/[0.04]",
                ].join(" ")}
              >
                <KeyRound className="h-4 w-4" /> Cambiar contraseña
              </button>
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); void logout(); }}
                className={[
                  "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors",
                  isLight ? "text-red-600 hover:bg-red-50" : "text-red-400 hover:bg-red-500/10",
                ].join(" ")}
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      <FormModal
        open={pwOpen}
        title="Cambiar contraseña"
        isLight={isLight}
        onClose={closePwModal}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={labGhostBtn(isLight)} onClick={closePwModal}>Cancelar</button>
            <button type="button" className={labPrimaryBtn(isLight)} disabled={pwSaving} onClick={() => void savePassword()}>
              {pwSaving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <LabField label="Contraseña actual" isLight={isLight}>
            <input
              type="password"
              className={labInputClass(isLight)}
              value={pwForm.current_password}
              onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
            />
          </LabField>
          <LabField label="Nueva contraseña" isLight={isLight}>
            <input
              type="password"
              className={labInputClass(isLight)}
              value={pwForm.new_password}
              onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
            />
          </LabField>
          <LabField label="Confirmar nueva contraseña" isLight={isLight}>
            <input
              type="password"
              className={labInputClass(isLight)}
              value={pwForm.new_password_confirmation}
              onChange={(e) => setPwForm({ ...pwForm, new_password_confirmation: e.target.value })}
            />
          </LabField>
          {pwErr ? <p className="text-sm text-red-600">{pwErr}</p> : null}
        </div>
      </FormModal>

      <LabNoticeModal
        open={notice !== null}
        variant={notice?.variant ?? "success"}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        isLight={isLight}
        onClose={() => setNotice(null)}
      />
    </header>
  );
}
