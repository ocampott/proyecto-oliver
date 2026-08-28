import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Meter } from "../../components/ui/meter";
import { PageHeader } from "../../components/PageHeader";
import { useOrgActual } from "../../lib/hooks";
import { getPlanes, getOrgResumenActual, type PlanDef } from "../../lib/api";

// Solo módulos que existen hoy en el producto. Cuando se agregue uno
// nuevo, hay que preguntar a qué plan(es) pertenece antes de sumarlo acá
// (ver Modulo en lib/api.ts).
const MODULOS_LABEL: Record<string, string> = {
  asistencia: "Asistencia QR + geocerca",
  horas: "Horas trabajadas",
  turnos: "Turnos y cumplimiento",
  rrhh: "RRHH (ausencias)",
  reportes: "Reportes / exportación",
};

const MODULOS_ORDEN = ["asistencia", "horas", "turnos", "rrhh", "reportes"];

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

function limiteTexto(actual: number, max: number | null): string {
  if (max === null) return `${actual} de ilimitados`;
  return `${actual} de ${max}`;
}

export default function PlanPage() {
  const { data: org, isLoading: orgLoading } = useOrgActual();
  const { data: resumen, isLoading: resumenLoading } = useQuery({
    queryKey: ["org-resumen-actual"],
    queryFn: getOrgResumenActual,
  });
  const { data: catalogo, isLoading: catLoading } = useQuery({
    queryKey: ["planes"],
    queryFn: getPlanes,
  });

  const ent = org?.entitlements;
  const planes = catalogo?.planes ?? [];

  if (orgLoading || !ent) {
    return (
      <>
        <div className="h-8 w-48 animate-pulse rounded-[6px] bg-text/10" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[320px] animate-pulse rounded-[6px] bg-text/10" />
          ))}
        </div>
      </>
    );
  }

  const empleadosActivos = resumen?.empleadosActivos ?? 0;
  const sucursalesActivas = resumen?.sucursalesActivas ?? 0;

  return (
    <>
      <PageHeader title="Tu plan" />

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wide text-text-secondary">Plan actual</p>
            <p className="text-[16px] font-semibold tracking-[-0.02em] text-text">{ent.plan.nombre}</p>
            {ent.suscripcion ? (
              <p className="text-[15px] text-text-secondary">
                Vence el {fechaLocal(ent.suscripcion.venceAt)} · período de {ent.suscripcion.periodoMeses}{" "}
                {ent.suscripcion.periodoMeses === 1 ? "mes" : "meses"}
              </p>
            ) : (
              <p className="text-[15px] text-text-secondary">Plan gratuito, sin vencimiento.</p>
            )}
          </div>
          <Button variant="primary" asChild>
            <a href="mailto:soporte@oliver.app?subject=Cambio%20de%20plan">Contactanos para cambiar de plan</a>
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <UsoCard
            label="Empleados"
            actual={empleadosActivos}
            max={ent.maxEmpleados}
            loading={resumenLoading}
          />
          <UsoCard
            label="Sucursales"
            actual={sucursalesActivas}
            max={ent.maxSucursales}
            loading={resumenLoading}
          />
        </div>
      </Card>

      <section className="page-section">
        <h2 className="text-text">Comparativa de planes</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {catLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[320px] animate-pulse rounded-[6px] bg-text/10" />
            ))}
          {!catLoading &&
            planes.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} actual={ent.plan.slug === plan.slug} />
            ))}
        </div>
      </section>
    </>
  );
}

function UsoCard({
  label,
  actual,
  max,
  loading,
}: {
  label: string;
  actual: number;
  max: number | null;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-medium text-text">{label}</span>
        {loading ? (
          <span className="h-5 w-16 animate-pulse rounded-[6px] bg-text/10" />
        ) : (
          <span className="text-[15px] font-semibold text-text">{limiteTexto(actual, max)}</span>
        )}
      </div>
      {max !== null && (
        <Meter value={loading ? 0 : actual} max={max} block className="mt-2" />
      )}
    </Card>
  );
}

function PlanCard({ plan, actual }: { plan: PlanDef & { precios: { meses: number; descuento: number; precioTotal: number }[] }; actual: boolean }) {
  return (
    <Card className={actual ? "border-accent-700 ring-1 ring-accent-700" : undefined}>
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-text">{plan.nombre}</h3>
        {actual && <Badge variant="accent">Actual</Badge>}
      </div>

      <div className="mt-4">
        {plan.precioMensual ? (
          <>
            <p className="data-number text-4xl font-medium text-text">
              ${plan.precioMensual.toLocaleString("es-AR")}
              <span className="font-sans text-[15px] font-medium text-text-secondary">/mes</span>
            </p>
            <div className="mt-2 space-y-1">
              {plan.precios.map((p) => (
                <p key={p.meses} className="text-[14px] text-text-secondary">
                  {p.meses} {p.meses === 1 ? "mes" : "meses"}:{" "}
                  <span className="font-semibold text-text">${p.precioTotal.toLocaleString("es-AR")}</span>
                  {p.descuento > 0 && (
                    <span className="ml-1.5 text-[12px] text-accent-700">ahorrás {Math.round(p.descuento * 100)}%</span>
                  )}
                </p>
              ))}
            </div>
          </>
        ) : (
          <p className="text-4xl font-medium tracking-[-0.02em] text-text">Gratis</p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[14px] text-text-secondary">
          {plan.maxSucursales === null ? "Sucursales ilimitadas" : `Hasta ${plan.maxSucursales} sucursales`}
        </p>
        <p className="text-[14px] text-text-secondary">
          {plan.maxEmpleados === null ? "Empleados ilimitados" : `Hasta ${plan.maxEmpleados} empleados`}
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {MODULOS_ORDEN.map((key) => {
          const incluido = plan.modulos.includes(key as never);
          return (
            <li key={key} className="flex items-center gap-2 text-[14px]">
              {incluido ? (
                <Check className="h-4 w-4 text-accent-700" />
              ) : (
                <X className="h-4 w-4 text-text-tertiary" />
              )}
              <span className={incluido ? "text-text" : "text-text-tertiary line-through"}>
                {MODULOS_LABEL[key]}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
