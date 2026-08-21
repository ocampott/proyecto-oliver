import { Link } from "react-router-dom";
import { CalendarClock, Clock, Users, MapPin, ChevronRight, CalendarDays, Briefcase } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useOrgActual, useEntitlements, tieneModulo, tieneRol } from "../lib/hooks";
import { ApiError } from "../lib/api";
import type { Modulo, PlanSlug } from "../lib/api";

interface Acceso {
  href: string;
  label: string;
  detalle: string;
  icon: React.ComponentType<{ className?: string }>;
  modulo?: Modulo;
  planRequerido?: PlanSlug;
  /** true si solo owner/admin pueden acceder (agent queda afuera). */
  soloGestion?: boolean;
}

const ACCESOS: Acceso[] = [
  {
    href: "/asistencia",
    label: "Asistencia",
    detalle: "Registros de entrada/salida e intentos rechazados",
    icon: CalendarClock,
    modulo: "asistencia",
  },
  {
    href: "/empleados",
    label: "Empleados",
    detalle: "Nómina, vínculo de dispositivos y códigos",
    icon: Users,
  },
  {
    href: "/sucursales",
    label: "Sucursales",
    detalle: "Ubicaciones, geocercas y códigos QR",
    icon: MapPin,
  },
  {
    href: "/horas",
    label: "Horas",
    detalle: "Turnos y horas trabajadas por empleado",
    icon: Clock,
    modulo: "horas",
    planRequerido: "basico",
    soloGestion: true,
  },
  {
    href: "/turnos",
    label: "Turnos",
    detalle: "Horarios, cumplimiento y plantillas",
    icon: CalendarDays,
    modulo: "turnos",
    planRequerido: "basico",
    soloGestion: true,
  },
  {
    href: "/rrhh",
    label: "RRHH",
    detalle: "Ausencias, licencias y certificados",
    icon: Briefcase,
    modulo: "rrhh",
    planRequerido: "basico",
    soloGestion: true,
  },
];

const PLAN_NOMBRE: Record<PlanSlug, string> = {
  gratis: "Gratis",
  basico: "Básico",
  pro: "Pro",
};

export default function HomePage() {
  const { data: org, isLoading, isFetching, isError, error, refetch } = useOrgActual();
  const ent = useEntitlements();

  if (isLoading || (isFetching && !org)) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-text/10" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[130px] rounded-[14px] border border-border bg-text/[.04]" />
          ))}
        </div>
      </div>
    );
  }

  const sinOrg = isError && error instanceof ApiError && error.status === 404;

  if (sinOrg) {
    return (
      <p className="text-text">
        Tu cuenta todavía no está asociada a ninguna organización. Contactá a soporte.
      </p>
    );
  }

  if (isError || !org) {
    return (
      <>
        <p className="text-text">
          {error instanceof Error ? error.message : "No pudimos cargar tus datos. Probá de nuevo."}
        </p>
        <Button onClick={() => refetch()} variant="secondary" className="mt-4">
          Reintentar
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">{org.name}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACCESOS.map((a) => {
          const Icon = a.icon;
          const sinPermiso = a.soloGestion ? !tieneRol(org, ["owner", "admin"]) : false;
          const bloqueado = a.modulo ? !tieneModulo(ent, a.modulo) : false;
          const planReq = a.planRequerido;
          const aviso = sinPermiso
            ? "Tu rol no tiene acceso a esta sección."
            : bloqueado && planReq
              ? `Disponible con el plan ${PLAN_NOMBRE[planReq]}. Hacé click para ver los planes.`
              : undefined;

          if (sinPermiso) {
            return (
              <div key={a.href} title={aviso} className="block h-full cursor-not-allowed opacity-40">
                <Card className="relative h-full">
                  <div className="flex items-start gap-2">
                    <Icon className="mb-1 h-[22px] w-[22px] text-accent-700" />
                  </div>
                  <h2 className="text-[17px] font-extrabold text-text">{a.label}</h2>
                  <p className="mt-1 text-[13px] text-text/80">{a.detalle}</p>
                </Card>
              </div>
            );
          }

          const destino = bloqueado ? "/plan" : a.href;

          return (
            <Link
              key={a.href}
              to={destino}
              title={aviso}
              className="group block h-full"
            >
              <Card className="relative h-full transition-colors hover:bg-text/5">
                <ChevronRight className="absolute right-4 top-4 h-4 w-4 text-text/40" />
                <div className="flex items-start gap-2">
                  <Icon className="mb-1 h-[22px] w-[22px] text-accent-700" />
                  {bloqueado && planReq && (
                    <Badge variant="outline" className="text-[10px]">
                      {PLAN_NOMBRE[planReq]}
                    </Badge>
                  )}
                </div>
                <h2 className="text-[17px] font-extrabold text-text">{a.label}</h2>
                <p className="mt-1 text-[13px] text-text/80">{a.detalle}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
