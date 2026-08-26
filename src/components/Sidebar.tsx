import * as React from "react";
import { NavLink } from "react-router-dom";
import { Home, ClipboardCheck, Users, Building2, Clock, CalendarDays, HeartHandshake, Settings, LifeBuoy, X } from "lucide-react";
import { cn } from "../lib/utils";
import { useOrgActual, tieneModulo, tieneRol } from "../lib/hooks";
import type { Modulo, PlanSlug, Entitlements, Organization } from "../lib/api";

interface NavItem { href: string; label: string; icon: React.ComponentType<{ className?: string }>; modulo?: Modulo; soloGestion?: boolean }
const LINKS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/asistencia", label: "Asistencia", icon: ClipboardCheck, modulo: "asistencia" },
  { href: "/empleados", label: "Empleados", icon: Users },
  { href: "/sucursales", label: "Sucursales", icon: Building2 },
  { href: "/horas", label: "Horas", icon: Clock, modulo: "horas", soloGestion: true },
  { href: "/turnos", label: "Turnos", icon: CalendarDays, modulo: "turnos", soloGestion: true },
  { href: "/rrhh", label: "RRHH", icon: HeartHandshake, modulo: "rrhh", soloGestion: true },
];
const PLAN: Record<Modulo, PlanSlug> = { asistencia: "gratis", horas: "basico", turnos: "basico", rrhh: "basico", reportes: "basico" };
const PLAN_LABEL: Record<PlanSlug, string> = { gratis: "Gratis", basico: "Básico", pro: "Pro" };

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const { data: org, isLoading } = useOrgActual();
  const ent = org?.entitlements ?? null;
  return <>
    {mobileOpen && <button aria-label="Cerrar menú" className="fixed inset-0 z-30 bg-text/10 md:hidden" onClick={onMobileClose} />}
    <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-border-soft bg-surface transition-transform md:relative md:inset-auto md:z-auto md:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex h-16 items-center justify-between border-b border-border-soft px-5 md:hidden"><span className="font-semibold">oliver</span><button onClick={onMobileClose} aria-label="Cerrar menú"><X className="size-4" /></button></div>
      <div className="flex items-center gap-3 px-5 py-5"><span className="flex size-8 items-center justify-center rounded-md bg-accent text-sm font-semibold text-surface">o</span><div><p className="text-sm font-semibold">oliver</p><p className="text-xs text-text-tertiary">Workspace</p></div></div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2" aria-label="Navegación principal">
        {isLoading ? LINKS.map((item) => <span key={item.href} className="h-9 rounded-md bg-text/5" />) : LINKS.map((item) => <SidebarNavLink key={item.href} item={item} ent={ent} org={org ?? null} onClick={onMobileClose} />)}
      </nav>
      <div className="border-t border-border-soft px-3 py-3"><NavLink to="/configuracion" onClick={onMobileClose} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", isActive ? "bg-accent-100 text-accent-700" : "text-text-secondary hover:bg-bg hover:text-text")}><Settings className="size-4" />Configuración</NavLink><a href="mailto:soporte@oliver.app" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg hover:text-text"><LifeBuoy className="size-4" />Soporte</a></div>
    </aside>
  </>;
}
function SidebarNavLink({ item, ent, org, onClick }: { item: NavItem; ent: Entitlements | null; org: Organization | null; onClick: () => void }) {
  const Icon = item.icon; const restricted = item.soloGestion && !tieneRol(org, ["owner", "admin"]); const locked = !!item.modulo && !tieneModulo(ent, item.modulo);
  if (restricted) return <span title="Tu rol no tiene acceso" className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-text-muted"><Icon className="size-4" />{item.label}</span>;
  return <NavLink to={locked ? "/plan" : item.href} end onClick={onClick} title={locked ? `Disponible con el plan ${PLAN_LABEL[PLAN[item.modulo!]]}` : undefined} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", isActive && !locked ? "bg-accent-100 font-medium text-accent-700" : "text-text-secondary hover:bg-bg hover:text-text", locked && "opacity-55")}><Icon className="size-4" /><span>{item.label}</span>{locked && <span className="ml-auto text-[10px] text-text-tertiary">{PLAN_LABEL[PLAN[item.modulo!]??"basico"]}</span>}</NavLink>;
}
export default Sidebar;
