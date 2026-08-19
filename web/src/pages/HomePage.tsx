import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Clock, Users, MapPin, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { getOrgActual, ApiError, type Organization } from "../lib/api";

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
  const [org, setOrg] = useState<Organization | null>(null);
  const [sinOrg, setSinOrg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    setSinOrg(false);
    getOrgActual()
      .then(setOrg)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setSinOrg(true);
        } else {
          setError(
            err instanceof Error ? err.message : "No pudimos cargar tus datos. Probá de nuevo."
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-text/60">Cargando...</p>
      </main>
    );
  }

  if (sinOrg) {
    return (
      <main className="p-8">
        <p className="text-text">
          Tu cuenta todavía no está asociada a ninguna organización. Contactá a soporte.
        </p>
      </main>
    );
  }

  if (error || !org) {
    return (
      <main className="p-8">
        <p className="text-text">{error ?? "No pudimos cargar tus datos. Probá de nuevo."}</p>
        <Button onClick={cargar} variant="secondary" className="mt-4">
          Reintentar
        </Button>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-[32px] font-extrabold text-text">{org.name}</h1>
      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        {ACCESOS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} to={a.href}>
              <Card className="relative transition-colors hover:bg-text/5">
                <ChevronRight className="absolute right-4 top-4 h-4 w-4 text-text/40" />
                <Icon className="h-6 w-6 text-accent-700" />
                <h2 className="text-[15px] font-extrabold text-text">{a.label}</h2>
                <p className="mt-1 text-[15px] text-text/60">{a.detalle}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
