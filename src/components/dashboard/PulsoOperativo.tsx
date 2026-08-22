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

function CardAdentroAhora({ enVivo }: { enVivo: EnVivo }) {
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
        <p className="mt-2 text-[28px] font-extrabold text-text">{totalAdentro}</p>
      )}
    </Card>
  );
}

function CardUltimosMarcados({ enVivo }: { enVivo: EnVivo }) {
  const marcas = enVivo.ultimosMarcados;

  return (
    <Card>
      <h2 className="text-[15px] font-bold text-text">Últimos en marcar</h2>
      {enVivo.isLoading && <p className="mt-3 text-[13px] text-text/60">Cargando…</p>}
      {enVivo.isError && <p className="mt-3 text-[13px] text-alert">No pudimos cargar asistencia.</p>}
      {!enVivo.isLoading && !enVivo.isError && (
        <ul className="mt-3 space-y-2">
          {marcas.map((m) => (
            <li key={m.id} className="text-[13px] text-text/80">
              <span className="font-semibold text-text">{m.empleadoNombre}</span> —{" "}
              {m.tipo === "entrada" ? "Entrada" : "Salida"} a las {horaLocal(m.hora)}, {m.sucursalNombre}
            </li>
          ))}
          {marcas.length === 0 && (
            <li className="text-[13px] text-text/60">Sin marcas hoy todavía.</li>
          )}
        </ul>
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

export function PulsoOperativo({ orgId }: { orgId: string }) {
  const ent = useEntitlements();
  const enVivo = useAsistenciaEnVivo(orgId);

  return (
    <div className="mt-6 mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CardAdentroAhora enVivo={enVivo} />
      <CardUltimosMarcados enVivo={enVivo} />
      {tieneModulo(ent, "horas") && <CardOlvidaronSalida />}
      {tieneModulo(ent, "rrhh") && <CardAusenciasHoy />}
    </div>
  );
}
