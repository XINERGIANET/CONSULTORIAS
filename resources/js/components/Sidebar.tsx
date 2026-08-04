import {
  type LucideIcon,
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Layers,
  ListTodo,
  PackageOpen,
  Plug,
  Radar,
  Receipt,
  Settings2,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ColorPalette, useApexTheme } from "../context/ThemeContext";

type NavLink = { label: string; to: string; icon: LucideIcon };

function getActiveStyle(loc: ReturnType<typeof useLocation>, path: string, isLight: boolean, palette: ColorPalette): { className: string; style?: React.CSSProperties } {
  const active = loc.pathname === path || (path !== "/" && loc.pathname.startsWith(path + "/"));
  if (active) {
    return {
      className: "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      style: {
        backgroundColor: isLight ? palette.lightBg : palette.darkBgDim,
        color: isLight ? palette.textLight : palette.textDark,
        boxShadow: isLight ? undefined : `0 0 20px ${palette.ringColor}`,
      },
    };
  }
  return {
    className: [
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      isLight
        ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
    ].join(" "),
  };
}

function NavSection({ title, items, isLight, palette }: { title: string; items: NavLink[]; isLight: boolean; palette: ColorPalette }) {
  const loc = useLocation();

  return (
    <div className="mb-6">
      <p
        className={[
          "px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider",
          isLight ? "text-[#64748B]" : "text-zinc-500",
        ].join(" ")}
      >
        {title}
      </p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const { className, style } = getActiveStyle(loc, item.to, isLight, palette);

          return (
            <Link key={item.to} to={item.to} className={className} style={style}>
              <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar({ mobileMenuOpen, setMobileMenuOpen }: { mobileMenuOpen?: boolean; setMobileMenuOpen?: (v: boolean) => void }) {
  const { isLight, palette } = useApexTheme();
  const { user, isSuperadmin } = useAuth();
  const loc = useLocation();
  const can = (code: string) => isSuperadmin || Boolean(user?.permissions?.includes(code));

  const crm: NavLink[] = [
    can("view_clients") ? { label: "Clientes", to: "/clientes", icon: Briefcase } : null,
    can("view_quotations") ? { label: "Cotizaciones", to: "/cotizaciones", icon: ClipboardList } : null,
  ].filter(Boolean) as NavLink[];
  const ops: NavLink[] = [
    can("view_projects") ? { label: "Proyectos", to: "/proyectos", icon: FolderKanban } : null,
    { label: "Tareas", to: "/tareas", icon: ListTodo },
    { label: "Calendario", to: "/calendario", icon: CalendarDays },
    can("manage_productivity") ? { label: "Productividad", to: "/tiempos", icon: Radar } : null,
    { label: "Documentos", to: "/documentos", icon: FileText },
  ].filter(Boolean) as NavLink[];
  const finances: NavLink[] = can("view_finances")
    ? [
        { label: "Finanzas", to: "/finanzas", icon: Landmark },
        { label: "Cuentas por cobrar", to: "/cuentas-por-cobrar", icon: HandCoins },
        { label: "Cuentas por pagar", to: "/cuentas-por-pagar", icon: Wallet },
      ]
    : [];
  const analytic: NavLink[] = [
    { label: "Rentabilidad", to: "/rentabilidad", icon: Receipt },
    { label: "Reportes gerenciales", to: "/reportes", icon: BarChart3 },
  ];

  const admin: NavLink[] = [
    { label: "Áreas", to: "/areas", icon: Layers },
    { label: "Catálogos", to: "/admin/catalogos", icon: Settings2 },
    { label: "Productos SaaS", to: "/saas", icon: PackageOpen },
    { label: "Integraciones", to: "/integraciones", icon: Plug },
    { label: "Usuarios y permisos", to: "/usuarios", icon: Users },
  ];
  const areaAdminConfig: NavLink[] = !isSuperadmin && user?.role_slug === "admin"
    ? [{ label: "Categorías y pagos", to: "/admin/catalogos", icon: Settings2 }]
    : [];

  const dashActiveState = getActiveStyle(loc, "/", isLight, palette);

  return (
    <>
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={() => setMobileMenuOpen?.(false)}
        />
      )}
      <aside 
        className={[
          "flex h-full w-[260px] shrink-0 flex-col border-r",
          isLight ? "bg-white border-[#E5E7EB]" : "bg-[#000000] border-white/[0.04]",
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        ].join(" ")}
      >
      <div className={["flex h-16 items-center gap-2 border-b px-4", isLight ? "border-[#E5E7EB]" : "border-white/[0.04]"].join(" ")}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: isLight ? palette.lightBg : palette.darkBgDim,
            color: isLight ? palette.textLight : palette.textDark,
          }}
        >
          <Zap className="h-5 w-5" style={{ fill: isLight ? palette.textLight : palette.textDark }} />
        </div>
        <div className="leading-tight">
          <p className={["text-[10px] font-medium uppercase tracking-[0.2em]", isLight ? "text-[#64748B]" : "text-zinc-500"].join(" ")}>Xpande Corp</p>
          <p className={["text-sm font-bold tracking-wide", isLight ? "text-slate-800" : "text-zinc-100"].join(" ")}>Intranet</p>
        </div>
      </div>

      <div className={["min-h-0 flex-1 overflow-y-auto px-2 py-4", isLight ? "apex-sidebar-scroll--light" : "apex-sidebar-scroll--dark"].join(" ")}>
        <div className="mb-6">
          <p className={["px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider", isLight ? "text-[#64748B]" : "text-zinc-500"].join(" ")}>Corp</p>
          <nav className="space-y-0.5">
            <Link
              to="/"
              className={dashActiveState.className}
              style={dashActiveState.style}
            >
              <LayoutDashboard className="h-[18px] w-[18px] shrink-0 opacity-90" />
              <span className="flex-1">Panel general</span>
            </Link>
          </nav>
        </div>

        {crm.length ? <NavSection title="CRM" items={crm} isLight={isLight} palette={palette} /> : null}
        {ops.length ? <NavSection title="Operaciones" items={ops} isLight={isLight} palette={palette} /> : null}
        {finances.length ? <NavSection title="Finanzas" items={finances} isLight={isLight} palette={palette} /> : null}
        <NavSection title="Analítica" items={analytic} isLight={isLight} palette={palette} />
        {isSuperadmin ? <NavSection title="Administración" items={admin} isLight={isLight} palette={palette} /> : null}
        {areaAdminConfig.length ? <NavSection title="Configuración" items={areaAdminConfig} isLight={isLight} palette={palette} /> : null}
      </div>
    </aside>
    </>
  );
}

