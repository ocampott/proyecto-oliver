// src/components/dashboard/PulsoOperativo.tsx
import { Card } from "../ui/card";
import { Status } from "../ui/status";
import { useAsistenciaEnVivo } from "./useAsistenciaEnVivo";
import { useOlvidaronSalida } from "./useOlvidaronSalida";
import { useAusenciasHoy } from "./useAusenciasHoy";
import { useEmpleados } from "../../pages/empleados/hooks";
import { useSucursales } from "../../pages/sucursales/hooks";

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

export function PulsoOperativo({ orgId }: { orgId: string }) {
  const enVivo = useAsistenciaEnVivo(orgId);
  const olvidaron = useOlvidaronSalida();
  const ausenciasHoy = useAusenciasHoy();
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursales = [] } = useSucursales();

  const totalAdentro = enVivo.porSucursal.reduce((acc, g) => acc + g.empleados.length, 0);
  const empleadosActivos = empleados.filter((e) => e.activo).length;
  const sucursalesActivas = sucursales.filter((s) => s.activa).length;

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  {g.empleados.map((e) => e.empleadoNombre).join(", ")}
                </li>
              ))}
              {enVivo.porSucursal.length === 0 && (
                <li className="text-[13px] text-text/60">Nadie marcado por ahora.</li>
              )}
            </ul>
          </>
        )}
      </Card>

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
    </div>
  );
}
