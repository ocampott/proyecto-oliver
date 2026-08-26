import { Link } from "react-router-dom";
import { CalendarClock, Clock, Users, MapPin, ChevronRight, CalendarDays, Briefcase, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PulsoOperativo } from "../components/dashboard/PulsoOperativo";
import { useOrgActual, useEntitlements, tieneModulo, tieneRol } from "../lib/hooks";
import { ApiError } from "../lib/api";
import type { Modulo, PlanSlug } from "../lib/api";

interface Acceso { href: string; label: string; detalle: string; icon: React.ComponentType<{ className?: string }>; modulo?: Modulo; planRequerido?: PlanSlug; soloGestion?: boolean; }
const ACCESOS: Acceso[] = [
  { href: "/asistencia", label: "Asistencia", detalle: "Entradas, salidas y alertas del equipo", icon: CalendarClock, modulo: "asistencia" },
  { href: "/empleados", label: "Empleados", detalle: "Nómina, dispositivos y códigos", icon: Users },
  { href: "/sucursales", label: "Sucursales", detalle: "Ubicaciones, geocercas y QR", icon: MapPin },
  { href: "/horas", label: "Horas", detalle: "Turnos y horas trabajadas", icon: Clock, modulo: "horas", planRequerido: "basico", soloGestion: true },
  { href: "/turnos", label: "Turnos", detalle: "Horarios y cumplimiento", icon: CalendarDays, modulo: "turnos", planRequerido: "basico", soloGestion: true },
  { href: "/rrhh", label: "RRHH", detalle: "Ausencias, licencias y certificados", icon: Briefcase, modulo: "rrhh", planRequerido: "basico", soloGestion: true },
];
const PLAN_NOMBRE: Record<PlanSlug, string> = { gratis: "Gratis", basico: "Básico", pro: "Pro" };

export default function HomePage() {
  const { data: org, isLoading, isFetching, isError, error, refetch } = useOrgActual();
  const ent = useEntitlements();
  if (isLoading || (isFetching && !org)) return <div className="animate-pulse"><div className="h-8 w-56 rounded-lg bg-text/10" /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[140px] rounded-2xl border border-border bg-surface" />)}</div></div>;
  const sinOrg = isError && error instanceof ApiError && error.status === 404;
  if (sinOrg) return <Card><p className="text-text">Tu cuenta todavía no está asociada a ninguna organización. Contactá a soporte.</p></Card>;
  if (isError || !org) return <><p className="text-text">{error instanceof Error ? error.message : "No pudimos cargar tus datos. Probá de nuevo."}</p><Button onClick={() => refetch()} variant="secondary" className="mt-4">Reintentar</Button></>;
  const gestion = tieneRol(org, ["owner", "admin"]);
  return <div className="pb-10">
    <div className="flex flex-col gap-5 border-b border-border-soft pb-7 md:flex-row md:items-end md:justify-between">
      <div><p className="mb-2 text-[13px] font-semibold uppercase tracking-[.14em] text-accent-700">Resumen de hoy</p><h1 className="text-balance text-[32px] font-extrabold tracking-[-0.04em] text-text md:text-[40px]">Buen día, {org.name}</h1><p className="mt-2 text-[15px] text-text-secondary">Esto es lo que está pasando con tu equipo.</p></div>
      <Button asChild><Link to="/asistencia">Ver asistencia <ArrowUpRight className="h-4 w-4" /></Link></Button>
    </div>
    {gestion && <PulsoOperativo orgId={org.id} />}
    {gestion && <Card className="mb-8 border-accent-200 bg-accent-100/40 shadow-none"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-surface p-2 text-accent-700"><AlertTriangle className="h-4 w-4" /></div><div><h2 className="text-[15px] font-bold text-text">Atención rápida</h2><p className="mt-1 text-[13px] leading-6 text-text-secondary">Revisá la asistencia del equipo y resolvé cualquier marca pendiente antes del cierre del día.</p></div><Link to="/asistencia" className="ml-auto hidden shrink-0 text-[13px] font-bold text-accent-700 hover:underline sm:block">Revisar <ChevronRight className="inline h-4 w-4" /></Link></div></Card>}
    <div className="mb-4 flex items-center justify-between"><div><p className="text-[13px] font-semibold uppercase tracking-[.12em] text-text-tertiary">Módulos</p><h2 className="mt-1 text-xl font-bold text-text">Gestioná tu operación</h2></div></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{ACCESOS.map((a) => { const Icon = a.icon; const sinPermiso = a.soloGestion && !gestion; const bloqueado = a.modulo ? !tieneModulo(ent, a.modulo) : false; const aviso = sinPermiso ? "Tu rol no tiene acceso a esta sección." : bloqueado && a.planRequerido ? `Disponible con el plan ${PLAN_NOMBRE[a.planRequerido]}. Hacé click para ver los planes.` : undefined; if (sinPermiso) return <div key={a.href} aria-disabled="true" className="cursor-not-allowed opacity-40"><Card className="h-full"><Icon className="h-5 w-5 text-accent-700" /><h3 className="mt-5 text-[17px] font-bold text-text">{a.label}</h3><p className="mt-1 text-[13px] text-text-secondary">{a.detalle}</p></Card></div>; return <Link key={a.href} to={bloqueado ? "/plan" : a.href} title={aviso} className="group block h-full"><Card className="relative h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent-300"><ChevronRight className="absolute right-5 top-5 h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-1 group-hover:text-accent" /><Icon className="h-5 w-5 text-accent-700" /><h3 className="mt-5 text-[17px] font-bold text-text">{a.label}</h3><p className="mt-1 max-w-[240px] text-[13px] leading-5 text-text-secondary">{a.detalle}</p>{bloqueado && a.planRequerido && <Badge variant="outline" className="mt-3">{PLAN_NOMBRE[a.planRequerido]}</Badge>}</Card></Link>; })}</div>
  </div>;
}
