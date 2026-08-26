import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock, Clock, Users, MapPin, CalendarDays, Briefcase } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/PageHeader";
import { PulsoOperativo } from "../components/dashboard/PulsoOperativo";
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
        <div className="h-10 w-64 bg-text/10" />
        <div className="mt-10 grid gap-6 md:grid-cols-4">
          <div className="h-28 bg-text/5 md:col-span-2" />
          <div className="h-28 bg-text/5" />
          <div className="h-28 bg-text/5" />
        </div>
      </div>
    );
  }

  const sinOrg = isError && error instanceof ApiError && error.status === 404;

  if (sinOrg) {
    return (
      <Card>
        <p className="text-text">
          Tu cuenta todavía no está asociada a ninguna organización. Contactá a soporte.
        </p>
      </Card>
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

  const admin = tieneRol(org, ["owner", "admin"]);

  return (
    <div className="animate-appear">
      <PageHeader
        kicker="Panel de control"
        title={org.name}
        meta={new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
      />

      {admin && (
        <section className="mt-8" aria-labelledby="pulso-title">
          <div className="mb-4 flex items-center gap-3">
            <span className="size-2 rounded-full bg-accent" />
            <h2 id="pulso-title" className="text-sm font-semibold uppercase tracking-[0.16em] text-text">
              Pulso operativo
            </h2>
            <span className="font-mono text-xs text-text-tertiary">en vivo</span>
          </div>
          <PulsoOperativo orgId={org.id} />
        </section>
      )}

      <section className="mt-12" aria-labelledby="accesos-title">
        <div className="flex items-baseline justify-between border-b border-border pb-3">
          <h2 id="accesos-title" className="text-sm font-semibold uppercase tracking-[0.16em] text-text">
            Accesos rápidos
          </h2>
          <span className="font-mono text-xs text-text-tertiary">{ACCESOS.length.toString().padStart(2, "0")} módulos</span>
        </div>
        <div className="grid gap-x-8 md:grid-cols-2 lg:grid-cols-3">
          {ACCESOS.map((a, index) => {
            const Icon = a.icon;
            const sinPermiso = a.soloGestion ? !admin : false;
            const bloqueado = a.modulo ? !tieneModulo(ent, a.modulo) : false;
            const destino = bloqueado ? "/plan" : a.href;
            const indice = String(index + 1).padStart(2, "0");

            if (sinPermiso) {
              return (
                <div
                  key={a.href}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-4 border-b border-border py-5 opacity-40"
                >
                  <span className="font-mono text-xs text-text-muted">{indice}</span>
                  <Icon className="size-5 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold tracking-[-0.02em]">
                      {a.label}
                      <Badge variant="neutral">Sin acceso</Badge>
                    </span>
                    <span className="block text-sm text-text-secondary">{a.detalle}</span>
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={a.href}
                to={destino}
                className="group flex items-center gap-4 border-b border-border py-5 hover:text-accent"
              >
                <span className="font-mono text-xs text-text-muted">{indice}</span>
                <Icon className="size-5 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold tracking-[-0.02em]">
                    {a.label}
                    {bloqueado && a.planRequerido && (
                      <Badge variant="outline" className="ml-2">
                        {PLAN_NOMBRE[a.planRequerido]}
                      </Badge>
                    )}
                  </span>
                  <span className="block text-sm text-text-secondary">{a.detalle}</span>
                </span>
                <ArrowUpRight className="size-4 text-text-tertiary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
