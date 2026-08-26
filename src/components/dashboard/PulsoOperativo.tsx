import { Card } from "../ui/card";
import { Status } from "../ui/status";
import { useAsistenciaEnVivo } from "./useAsistenciaEnVivo";
import { useOlvidaronSalida } from "./useOlvidaronSalida";
import { useAusenciasHoy } from "./useAusenciasHoy";
import { useEntitlements, tieneModulo } from "../../lib/hooks";

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

type EnVivo = ReturnType<typeof useAsistenciaEnVivo>;

function LiveCount({ enVivo }: { enVivo: EnVivo }) {
  const total = enVivo.porSucursal.reduce((acc, group) => acc + group.empleados.length, 0);
  return (
    <Card className="border-accent bg-accent text-surface-raised">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Adentro ahora</span>
        <Status tone={enVivo.conectado ? "success" : "neutral"} className="bg-surface-raised/15 text-surface-raised">
          {enVivo.conectado ? "En vivo" : "Actualizando"}
        </Status>
      </div>
      {enVivo.isError ? (
        <p className="mt-4 text-sm text-surface-raised/70">No pudimos cargar asistencia.</p>
      ) : (
        <>
          <p className="data-number mt-4 text-6xl font-medium">{enVivo.isLoading ? "—" : total}</p>
          <p className="mt-2 text-sm text-surface-raised/70">personas fichadas</p>
        </>
      )}
    </Card>
  );
}

function Recent({ enVivo }: { enVivo: EnVivo }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold">Últimos en marcar</h3>
      {enVivo.isLoading && <p className="mt-5 text-sm text-text-tertiary">Cargando actividad...</p>}
      {enVivo.isError && <p className="mt-5 text-sm text-alert">No pudimos cargar asistencia.</p>}
      {!enVivo.isLoading && !enVivo.isError && (
        <ul className="mt-4 flex flex-col gap-3">
          {enVivo.ultimosMarcados.slice(0, 4).map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{m.empleadoNombre}</span>
              <span className="shrink-0 font-mono text-xs text-text-tertiary">
                {m.tipo === "entrada" ? "Entró" : "Salió"} {horaLocal(m.hora)}
              </span>
            </li>
          ))}
          {enVivo.ultimosMarcados.length === 0 && <li className="text-sm text-text-tertiary">Sin marcas hoy todavía.</li>}
        </ul>
      )}
    </Card>
  );
}

function PendingHours() {
  const query = useOlvidaronSalida();
  return (
    <Card>
      <h3 className="text-sm font-semibold">Olvidaron salida</h3>
      {query.isLoading && <p className="mt-5 text-sm text-text-tertiary">Revisando turnos...</p>}
      {query.isError && <p className="mt-5 text-sm text-alert">No pudimos cargar horas.</p>}
      {!query.isLoading && !query.isError && (
        <ul className="mt-4 flex flex-col gap-3">
          {query.turnos.slice(0, 4).map((t) => (
            <li key={`${t.empleadoId}-${t.entradaAt}`} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{t.nombre}</span>
              <span className="shrink-0 font-mono text-xs text-alert">
                {fechaLocal(t.entradaAt)} {horaLocal(t.entradaAt)}
              </span>
            </li>
          ))}
          {query.turnos.length === 0 && <li className="text-sm text-text-tertiary">Todo en orden.</li>}
        </ul>
      )}
    </Card>
  );
}

function Absences() {
  const query = useAusenciasHoy();
  return (
    <Card>
      <h3 className="text-sm font-semibold">Ausencias hoy</h3>
      {query.isLoading && <p className="mt-5 text-sm text-text-tertiary">Revisando RRHH...</p>}
      {query.isError && <p className="mt-5 text-sm text-alert">No pudimos cargar RRHH.</p>}
      {!query.isLoading && !query.isError && (
        <ul className="mt-4 flex flex-col gap-3">
          {query.ausencias.slice(0, 4).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{a.empleado_nombre}</span>
              {a.certificado_pendiente ? (
                <Status tone="warning">Pendiente</Status>
              ) : (
                <span className="text-text-tertiary">{a.motivo}</span>
              )}
            </li>
          ))}
          {query.ausencias.length === 0 && <li className="text-sm text-text-tertiary">Sin ausencias hoy.</li>}
        </ul>
      )}
    </Card>
  );
}

export function PulsoOperativo({ orgId }: { orgId: string }) {
  const ent = useEntitlements();
  const live = useAsistenciaEnVivo(orgId);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <LiveCount enVivo={live} />
      <Recent enVivo={live} />
      {tieneModulo(ent, "horas") && <PendingHours />}
      {tieneModulo(ent, "rrhh") && <Absences />}
    </div>
  );
}
