// src/components/Sidebar.tsx
import * as React from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  ClipboardCheck,
  Users,
  Building2,
  Clock,
  CalendarDays,
  HeartHandshake,
  Settings,
  LifeBuoy,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Badge } from "./ui/badge";
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

const STORAGE_KEY = "oliver:sidebar-collapsed";

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
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

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-border-soft bg-white transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-16" : "md:w-[220px]"
        )}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className={cn("hidden rounded-lg p-1.5 text-text-secondary hover:bg-black/[.03] md:flex", collapsed && "mx-auto")}
          >
            {collapsed ? <ChevronRight className="h-[18px] w-[18px]" /> : <ChevronLeft className="h-[18px] w-[18px]" />}
          </button>
          <button onClick={onMobileClose} aria-label="Cerrar menú" className="ml-auto rounded-lg p-1.5 hover:bg-black/[.03] md:hidden">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
          {isLoading
            ? LINKS.map((item) => (
                <span key={item.href} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="h-[13px] w-24 animate-pulse rounded-full bg-text/10" />
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
          <SidebarFooterLink href="/configuracion" label="Configuración" icon={Settings} collapsed={collapsed} onClick={onMobileClose} />
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
            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
            isActive ? "bg-accent-100 font-semibold text-accent-700" : "text-text-secondary hover:bg-black/[.03] hover:text-text"
          )
        }
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className={cn(collapsed && "md:hidden")}>{label}</span>
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
        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-black/[.03] hover:text-text"
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
          className="flex cursor-not-allowed select-none items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary opacity-40"
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
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-black/[.03] hover:text-text"
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className={cn("flex items-center gap-1.5", collapsed && "md:hidden")}>
            {item.label}
            <Badge variant="outline" className="text-[10px]">
              {PLAN_NOMBRE[planReq]}
            </Badge>
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
            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
            isActive ? "bg-accent-100 font-semibold text-accent-700" : "text-text-secondary hover:bg-black/[.03] hover:text-text"
          )
        }
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
      </NavLink>
      {collapsed && normalTooltip.tooltipNode}
    </>
  );
}
