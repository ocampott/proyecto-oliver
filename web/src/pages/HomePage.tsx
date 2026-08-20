import { Link } from "react-router-dom";
import { CalendarClock, Clock, Users, MapPin, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useOrgActual } from "../lib/hooks";
import { ApiError } from "../lib/api";

const ACCESOS = [
  {
    href: "/asistencia",
    label: "Asistencia",
    detalle: "Registros de entrada/salida e intentos rechazados",
    icon: CalendarClock,
  },
  {
    href: "/horas",
    label: "Horas",
    detalle: "Turnos y horas trabajadas por empleado",
    icon: Clock,
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
];

export default function HomePage() {
  const { data: org, isLoading, isFetching, isError, error, refetch } = useOrgActual();

  if (isLoading || (isFetching && !org)) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-text/10" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACCESOS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} to={a.href} className="block h-full">
              <Card className="relative h-full transition-colors hover:bg-text/5">
                <ChevronRight className="absolute right-4 top-4 h-4 w-4 text-text/40" />
                <Icon className="mb-1 h-[22px] w-[22px] text-accent-700" />
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
