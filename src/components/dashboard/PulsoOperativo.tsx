import { Card } from "../ui/card";
import { Status } from "../ui/status";
import { useAsistenciaEnVivo } from "./useAsistenciaEnVivo";
import { useOlvidaronSalida } from "./useOlvidaronSalida";
import { useAusenciasHoy } from "./useAusenciasHoy";
import { useEmpleados } from "../../pages/empleados/hooks";
import { useSucursales } from "../../pages/sucursales/hooks";
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

function CardAdentroAhora({ orgId }: { orgId: string }) {
  const enVivo = useAsistenciaEnVivo(orgId);
  const totalAdentro = enVivo.porSucursal.reduce((acc, g) => acc + g.empleados.length, 0);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-text">Adentro ahora</h2>
        <Status tone={enVivo.conectado ? "success" : "neutral"}>
          {enVivo.conectado ? "En vivo" : "Actualizando…"}
        </Status>
      </div>
      {enVivo.isLoading && <p className="mt-3 text-[13px] text-text/60">Cargando…</p>}
      {enVivo.isError && <p className="mt-3 text-[13px] text-alert">No pudimos cargar asistencia.</p>}
      {!enVivo.isLoading && !enVivo.isError && (
        <>
          <p className="mt-2 text-[28px] font-extrabold text-text">{totalAdentro}</p>
          <ul className="mt-3 space-y-2">
            {enVivo.porSucursal.map((g) => (
              <li key={g.sucursalId} className="text-[13px] text-text/80">
                <span className="font-semibold text-text">{g.sucursalNombre}:</span>{" "}
                {g.empleados
                  .map((e) => `${e.empleadoNombre} (desde ${horaLocal(e.desde)})`)
                  .join(", ")}
              </li>
            ))}
            {enVivo.porSucursal.length === 0 && (
              <li className="text-[13px] text-text/60">Nadie marcado por ahora.</li>
            )}
          </ul>
        </>
      )}
    </Card>
  );
}

function CardOlvidaronSalida() {
  const olvidaron = useOlvidaronSalida();

  return (
    <Card>
      <h2 className="text-[15px] font-bold text-text">Olvidaron marcar salida</h2>
      {olvidaron.isLoading && <p className="mt-3 text-[13px] text-text/60">Cargando…</p>}
      {olvidaron.isError && <p className="mt-3 text-[13px] text-alert">No pudimos cargar horas.</p>}
      {!olvidaron.isLoading && !olvidaron.isError && (
        <ul className="mt-3 space-y-2">
          {olvidaron.turnos.map((t) => (
            <li key={`${t.empleadoId}-${t.entradaAt}`} className="text-[13px] text-text/80">
              <span className="font-semibold text-text">{t.nombre}</span> — {t.sucursalNombre}, entró{" "}
              {fechaLocal(t.entradaAt)} {horaLocal(t.entradaAt)}
            </li>
          ))}
          {olvidaron.turnos.length === 0 && (
            <li className="text-[13px] text-text/60">Ninguno pendiente.</li>
          )}
        </ul>
      )}
    </Card>
  );
}

function CardAusenciasHoy() {
  const ausenciasHoy = useAusenciasHoy();

  return (
    <Card>
      <h2 className="text-[15px] font-bold text-text">Ausencias hoy</h2>
      {ausenciasHoy.isLoading && <p className="mt-3 text-[13px] text-text/60">Cargando…</p>}
      {ausenciasHoy.isError && <p className="mt-3 text-[13px] text-alert">No pudimos cargar RRHH.</p>}
      {!ausenciasHoy.isLoading && !ausenciasHoy.isError && (
        <ul className="mt-3 space-y-2">
          {ausenciasHoy.ausencias.map((a) => (
            <li key={a.id} className="text-[13px] text-text/80">
              <span className="font-semibold text-text">{a.empleado_nombre}</span> — {a.motivo}
              {a.certificado_pendiente && (
                <Status tone="warning" className="ml-2 inline-flex">
                  Certificado pendiente
                </Status>
              )}
            </li>
          ))}
          {ausenciasHoy.ausencias.length === 0 && (
            <li className="text-[13px] text-text/60">Sin ausencias hoy.</li>
          )}
        </ul>
      )}
    </Card>
  );
}

function CardResumen() {
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursales = [] } = useSucursales();
  const empleadosActivos = empleados.filter((e) => e.activo).length;
  const sucursalesActivas = sucursales.filter((s) => s.activa).length;

  return (
    <Card>
      <h2 className="text-[15px] font-bold text-text">Resumen</h2>
      <div className="mt-3 space-y-2 text-[13px] text-text/80">
        <p>
          <span className="font-semibold text-text">{empleadosActivos}</span> / {empleados.length} empleados
          activos
        </p>
        <p>
          <span className="font-semibold text-text">{sucursalesActivas}</span> / {sucursales.length} sucursales
          activas
        </p>
      </div>
    </Card>
  );
}

export function PulsoOperativo({ orgId }: { orgId: string }) {
  const ent = useEntitlements();

  return (
    <div className="mt-6 mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CardAdentroAhora orgId={orgId} />
      {tieneModulo(ent, "horas") && <CardOlvidaronSalida />}
      {tieneModulo(ent, "rrhh") && <CardAusenciasHoy />}
      <CardResumen />
    </div>
  );
}
