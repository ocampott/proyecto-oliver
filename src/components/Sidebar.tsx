// src/components/Sidebar.tsx
import * as React from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Home,
  ClipboardCheck,
  Users,
  Building2,
  Clock,
  CalendarDays,
  HeartHandshake,
  Settings,
  LifeBuoy,
  Lock,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useOrgActual, tieneModulo, tieneRol } from "../lib/hooks";
import { useHoverTooltip } from "./ui/tooltip";
import type { Modulo, PlanSlug, Entitlements, Organization } from "../lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  modulo?: Modulo;
  /** true si solo owner/admin pueden acceder (agent queda afuera). */
  soloGestion?: boolean;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/asistencia", label: "Asistencia", icon: ClipboardCheck, modulo: "asistencia" },
  { href: "/empleados", label: "Empleados", icon: Users },
  { href: "/sucursales", label: "Sucursales", icon: Building2 },
  { href: "/horas", label: "Horas", icon: Clock, modulo: "horas", soloGestion: true },
  { href: "/turnos", label: "Turnos", icon: CalendarDays, modulo: "turnos", soloGestion: true },
  { href: "/rrhh", label: "RRHH", icon: HeartHandshake, modulo: "rrhh", soloGestion: true },
];

const PLAN_REQUERIDO: Record<Modulo, PlanSlug> = {
  asistencia: "gratis",
  horas: "basico",
  turnos: "basico",
  rrhh: "basico",
  reportes: "basico",
};

const PLAN_NOMBRE: Record<PlanSlug, string> = {
  gratis: "Gratis",
  basico: "Básico",
  pro: "Pro",
};

const EXTRA_TITULOS: Record<string, string> = {
  "/configuracion": "Configuración",
  "/plan": "Mi plan",
  "/admin": "Administración",
};

/** Título de sección para el topbar, a partir de la ruta actual. */
export function tituloDeRuta(pathname: string): string {
  if (EXTRA_TITULOS[pathname]) return EXTRA_TITULOS[pathname];
  const item = [...LINKS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((l) => pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`)));
  return item?.label ?? "oliver";
}

const STORAGE_KEY = "oliver:sidebar-collapsed";

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const { data: org, isLoading } = useOrgActual();
  const ent = org?.entitlements ?? null;
  const orgOrNull = org ?? null;

  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onMobileClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileOpen, onMobileClose]);

  const asideRef = React.useRef<HTMLElement>(null);
  const [togglePos, setTogglePos] = React.useState<{ left: number; top: number } | null>(null);

  React.useLayoutEffect(() => {
    function medir() {
      const el = asideRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTogglePos({ left: rect.right, top: rect.top + 72 });
    }
    medir();
    window.addEventListener("resize", medir);

    // El <aside> anima su ancho con transition-[width] (200ms) al
    // colapsar/expandir. Medir una sola vez acá (al toggle) deja al botón
    // con una posición vieja mientras el borde real sigue animando —
    // queda "flotando" separado del sidebar durante la transición. Se
    // sigue el borde cuadro a cuadro con rAF mientras dura la animación,
    // en vez de dejar que el botón interpole su `left` por su cuenta.
    let rafId: number;
    function seguirTransicion() {
      medir();
      rafId = requestAnimationFrame(seguirTransicion);
    }
    rafId = requestAnimationFrame(seguirTransicion);
    const timeoutId = window.setTimeout(() => cancelAnimationFrame(rafId), 250);

    return () => {
      window.removeEventListener("resize", medir);
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [collapsed]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}
      {/* Portaleado a document.body: escapa del stacking/overflow del layout
          (sidebar/main) por completo, en vez de pelear con sus z-index —
          el mismo problema que resuelve useHoverTooltip. */}
      {togglePos &&
        createPortal(
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            style={{ left: togglePos.left, top: togglePos.top }}
            className="fixed z-30 hidden h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-none hover:bg-text/[.04] md:flex"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>,
          document.body
        )}
      <aside
        ref={asideRef}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[220px] shrink-0 flex-col border-r border-border-soft bg-bg transition-transform duration-200 md:relative md:z-auto md:translate-x-0 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-16" : "md:w-[220px]"
        )}
      >
        <div className="flex items-center justify-end px-3 py-3 md:hidden">
          <button
            onClick={onMobileClose}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-text-secondary hover:bg-text/[.04]"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className={cn("flex items-center gap-2.5 px-4 pb-4 pt-2", collapsed && "md:justify-center md:px-0")}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-accent">
            <Activity className="h-3.5 w-3.5 text-white" />
          </span>
          <div className={cn("min-w-0", collapsed && "md:hidden")}>
            <p className="truncate text-[14px] font-semibold leading-tight text-text">oliver</p>
            <p className="truncate text-[11.5px] leading-tight text-text-tertiary">
              {isLoading ? "Cargando…" : (org?.name ?? "")}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1">
          {isLoading
            ? LINKS.map((item) => (
                <span
                  key={item.href}
                  className={cn("flex items-center gap-2.5 px-3 py-2.5", collapsed && "md:justify-center md:px-0")}
                >
                  <span className={cn("h-[13px] animate-pulse rounded-full bg-text/10", collapsed ? "w-6" : "w-24")} />
                </span>
              ))
            : LINKS.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  ent={ent}
                  org={orgOrNull}
                  collapsed={collapsed}
                  onClick={onMobileClose}
                />
              ))}
        </nav>

        <div className="border-t border-border-soft p-2">
          <SidebarFooterLink
            href="/configuracion"
            label="Configuración"
            icon={Settings}
            collapsed={collapsed}
            onClick={onMobileClose}
          />
          <SidebarFooterAnchor href="mailto:soporte@oliver.app" label="Soporte" icon={LifeBuoy} collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

function SidebarFooterLink({
  href,
  label,
  icon: Icon,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  onClick: () => void;
}) {
  const { triggerProps, tooltipNode } = useHoverTooltip<HTMLAnchorElement>(label, "right");
  return (
    <>
      <NavLink
        {...triggerProps}
        to={href}
        onClick={onClick}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
            collapsed && "md:justify-center md:px-0",
            isActive ? "bg-accent-100 text-accent-800" : "text-text-secondary hover:bg-text/[.04] hover:text-text"
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-accent")} />
            <span className={cn("flex-1", collapsed && "md:hidden")}>{label}</span>
          </>
        )}
      </NavLink>
      {collapsed && tooltipNode}
    </>
  );
}

function SidebarFooterAnchor({
  href,
  label,
  icon: Icon,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
}) {
  const { triggerProps, tooltipNode } = useHoverTooltip<HTMLAnchorElement>(label, "right");
  return (
    <>
      <a
        {...triggerProps}
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-text/[.04] hover:text-text",
          collapsed && "md:justify-center md:px-0"
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className={cn(collapsed && "md:hidden")}>{label}</span>
      </a>
      {collapsed && tooltipNode}
    </>
  );
}

function SidebarNavLink({
  item,
  ent,
  org,
  collapsed,
  onClick,
}: {
  item: NavItem;
  ent: Entitlements | null;
  org: Organization | null;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const sinPermiso = item.soloGestion ? !tieneRol(org, ["owner", "admin"]) : false;
  const bloqueado = item.modulo ? !tieneModulo(ent, item.modulo) : false;
  const planReq = item.modulo ? PLAN_REQUERIDO[item.modulo] : null;
  const aviso =
    bloqueado && planReq ? `Disponible con el plan ${PLAN_NOMBRE[planReq]}. Hacé click para ver los planes.` : undefined;

  const disabledTooltip = useHoverTooltip<HTMLSpanElement>("Tu rol no tiene acceso a esta sección.", "right");
  const lockedTooltip = useHoverTooltip<HTMLAnchorElement>(aviso ?? item.label, "right");
  const normalTooltip = useHoverTooltip<HTMLAnchorElement>(item.label, "right");

  if (sinPermiso) {
    return (
      <>
        <span
          {...disabledTooltip.triggerProps}
          title={collapsed ? undefined : "Tu rol no tiene acceso a esta sección."}
          aria-disabled="true"
          className={cn(
            "flex cursor-not-allowed select-none items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-text-muted",
            collapsed && "md:justify-center md:px-0"
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
        </span>
        {collapsed && disabledTooltip.tooltipNode}
      </>
    );
  }

  if (bloqueado && planReq) {
    return (
      <>
        <NavLink
          {...lockedTooltip.triggerProps}
          to="/plan"
          onClick={onClick}
          title={collapsed ? undefined : aviso}
          className={cn(
            "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-text/[.04] hover:text-text",
            collapsed && "md:justify-center md:px-0"
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className={cn("flex flex-1 items-center gap-1.5", collapsed && "md:hidden")}>
            {item.label}
            <span className="flex items-center gap-1 rounded-[6px] bg-text/[.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary">
              <Lock className="h-2.5 w-2.5" />
              {PLAN_NOMBRE[planReq]}
            </span>
          </span>
        </NavLink>
        {collapsed && lockedTooltip.tooltipNode}
      </>
    );
  }

  return (
    <>
      <NavLink
        {...normalTooltip.triggerProps}
        to={item.href}
        end
        onClick={onClick}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
            collapsed && "md:justify-center md:px-0",
            isActive ? "bg-accent-100 text-accent-800" : "text-text-secondary hover:bg-text/[.04] hover:text-text"
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-accent")} />
            <span className={cn("flex-1", collapsed && "md:hidden")}>{item.label}</span>
          </>
        )}
      </NavLink>
      {collapsed && normalTooltip.tooltipNode}
    </>
  );
}
