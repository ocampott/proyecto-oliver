import { useEffect, useState } from "react";
import { Card } from "../components/ui/card";
import { getOrgActual, type Organization } from "../lib/api";
import { TOOLTIP_DESHABILITADO } from "../components/PanelNav";

const ACCESOS = [
  { href: "/asistencia", label: "Asistencia", detalle: "Registros de entrada/salida e intentos rechazados" },
  { href: "/horas", label: "Horas", detalle: "Turnos y horas trabajadas por empleado" },
  { href: "/empleados", label: "Empleados", detalle: "Nómina, vínculo de dispositivos y códigos" },
  { href: "/sucursales", label: "Sucursales", detalle: "Ubicaciones, geocercas y códigos QR" },
];

export default function HomePage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [sinOrg, setSinOrg] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrgActual()
      .then(setOrg)
      .catch(() => setSinOrg(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-text/60">Cargando...</p>
      </main>
    );
  }

  if (sinOrg || !org) {
    return (
      <main className="p-8">
        <p className="text-text">
          Tu cuenta todavía no está asociada a ninguna organización. Contactá a soporte.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-[32px] font-extrabold text-text">{org.name}</h1>
      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        {ACCESOS.map((a) => (
          <Card key={a.href} title={TOOLTIP_DESHABILITADO} className="cursor-not-allowed opacity-60">
            <h2 className="text-[15px] font-extrabold text-text">{a.label}</h2>
            <p className="mt-1 text-[15px] text-text/60">{a.detalle}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
