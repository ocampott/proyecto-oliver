import { useQuery } from "@tanstack/react-query";
import { getPendientesOperacion } from "../../lib/api";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../ui/card";
import { Status } from "../ui/status";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { StatRow, type StatRowItem } from "../ui/stat-row";
import { useToast } from "../ui/toast";
import { useAsistenciaEnVivo } from "./useAsistenciaEnVivo";
import { useOlvidaronSalida } from "./useOlvidaronSalida";
import { useAusenciasHoy } from "./useAusenciasHoy";
import { useRechazadas, useResolverRechazada } from "../../pages/asistencia/hooks";
import { horaLocal, horaCorta, MOTIVOS_RECHAZO } from "../../lib/format";
import { useEntitlements, tieneModulo } from "../../lib/hooks";
import type { Ausencia } from "../../lib/api";

type EnVivo = ReturnType<typeof useAsistenciaEnVivo>;

function diasAusencia(a: Pick<Ausencia, "fecha_desde" | "fecha_hasta">): number {
  const desde = new Date(a.fecha_desde).getTime();
  const hasta = new Date(a.fecha_hasta).getTime();
  return Math.round((hasta - desde) / 86400000) + 1;
}

function AhoraMismo({ enVivo }: { enVivo: EnVivo }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">Ahora mismo</h3>
        <Status tone={enVivo.conectado ? "success" : "neutral"}>
          {enVivo.conectado ? "En vivo" : "Actualizando"}
        </Status>
      </div>
      {enVivo.isError && <p className="mt-4 text-sm text-alert">No pudimos cargar asistencia.</p>}
      {!enVivo.isError && enVivo.isLoading && <p className="mt-4 text-sm text-text-tertiary">Cargando...</p>}
      {!enVivo.isError && !enVivo.isLoading && (
        <div className="mt-4 flex max-h-[280px] flex-col gap-4 overflow-y-auto">
          {enVivo.porSucursal.length === 0 && (
            <div><p className="text-sm text-text-tertiary">Nadie marcó entrada todavía.</p><Link to="/asistencia" className="mt-2 inline-block text-sm font-medium text-accent-700 hover:underline">Consultar registros</Link></div>
          )}
          {enVivo.porSucursal.map((g) => (
            <div key={g.sucursalId}>
              <p className="flex items-center justify-between text-[13px] font-semibold text-text">
                {g.sucursalNombre}
                <span className="data-number font-mono text-text-tertiary">{g.empleados.length}</span>
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {g.empleados.map((e) => (
                  <li key={e.empleadoId} className="flex items-baseline justify-between text-[13px] text-text-secondary">
                    <span className="truncate">{e.empleadoNombre}</span>
                    <span className="shrink-0 font-mono text-xs text-text-tertiary">desde {horaCorta(e.desde)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function UltimosMovimientos({ enVivo }: { enVivo: EnVivo }) {
  if (!enVivo.isLoading && !enVivo.isError && enVivo.ultimosMarcados.length === 0) return null;
  return (
    <Card>
      <h3 className="text-[14px] font-semibold">Últimos movimientos</h3>
      {enVivo.isLoading && <p className="mt-5 text-sm text-text-tertiary">Cargando actividad...</p>}
      {enVivo.isError && <p className="mt-5 text-sm text-alert">No pudimos cargar asistencia.</p>}
      {!enVivo.isLoading && !enVivo.isError && (
        <ul className="mt-4 flex max-h-[280px] flex-col gap-3 overflow-y-auto">
          {enVivo.ultimosMarcados.map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{m.empleadoNombre}</span>
              <span className="shrink-0 font-mono text-xs text-text-tertiary">
                {m.tipo === "entrada" ? "Entró" : "Salió"} {horaCorta(m.hora)}
              </span>
            </li>
          ))}
          {enVivo.ultimosMarcados.length === 0 && <li className="text-sm text-text-tertiary">Sin marcas hoy todavía.</li>}
        </ul>
      )}
    </Card>
  );
}

function PendientesRevision() {
  const { data, isLoading, isError } = useRechazadas({ page: 1, pageSize: 5 });
  const resolver = useResolverRechazada();
  const toast = useToast();
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const rechazadas = data?.data ?? [];
  const total = data?.pagination.total ?? 0;

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    setResolviendoId(id);
    try {
      await resolver.mutateAsync({ id, accion });
      toast.success(accion === "aprobar" ? "Intento aprobado." : "Intento descartado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo resolver el intento.");
    } finally {
      setResolviendoId(null);
    }
  }

  if (!isLoading && !isError && total === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold">Pendientes de revisión</h3>
        <span className="flex shrink-0 items-center gap-2">
          {total > 0 && (
            <Badge tone="warning" className="font-mono">
              {total}
            </Badge>
          )}
          {!isError && total > rechazadas.length && (
            <Link
              to="/asistencia"
              state={{ vista: "rechazadas" }}
              className="text-xs font-medium text-accent-700 hover:underline"
            >
              Ver todas
            </Link>
          )}
        </span>
      </div>
      {isLoading && <p className="mt-4 text-sm text-text-tertiary">Revisando marcas...</p>}
      {isError && <p className="mt-4 text-sm text-alert">No pudimos cargar las marcas rechazadas.</p>}
      {!isLoading && !isError && (
        <ul className="mt-4 flex max-h-[280px] flex-col gap-3 overflow-y-auto">
          {rechazadas.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.empleado_nombre ?? "—"}</span>
                <span className="block truncate text-xs text-text-tertiary">
                  {r.sucursal_nombre ?? "—"} · {MOTIVOS_RECHAZO[r.motivo] ?? r.motivo}
                </span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleResolver(r.id, "aprobar")}
                  disabled={resolviendoId === r.id}
                >
                  Aprobar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResolver(r.id, "descartar")}
                  disabled={resolviendoId === r.id}
                >
                  Descartar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AusenciasHoy() {
  const query = useAusenciasHoy();
  if (!query.isLoading && !query.isError && query.ausencias.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">Ausencias de hoy</h3>
        <Link to="/rrhh" className="text-xs font-medium text-accent-700 hover:underline">
          Ver todas
        </Link>
      </div>
      {query.isLoading && <p className="mt-4 text-sm text-text-tertiary">Revisando RRHH...</p>}
      {query.isError && <p className="mt-4 text-sm text-alert">No pudimos cargar RRHH.</p>}
      {!query.isLoading && !query.isError && (
        <ul className="mt-4 flex max-h-[280px] flex-col gap-3 overflow-y-auto">
          {query.ausencias.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.empleado_nombre}</span>
                <span className="block truncate text-xs text-text-tertiary">{a.sucursal_nombre ?? "—"}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {a.certificado_pendiente ? (
                  <Status tone="warning">Certificado pendiente</Status>
                ) : (
                  <span className="text-xs text-text-tertiary">{a.motivo}</span>
                )}
                <span className="font-mono text-xs text-text-tertiary">{diasAusencia(a)}d</span>
              </span>
            </li>
          ))}
          {query.ausencias.length === 0 && <li className="text-sm text-text-tertiary">Sin ausencias hoy.</li>}
        </ul>
      )}
    </Card>
  );
}

function PendingHours() {
  const query = useOlvidaronSalida();
  if (!query.isLoading && !query.isError && query.turnos.length === 0) return null;
  return (
    <Card>
      <h3 className="text-[14px] font-semibold">Olvidaron salida</h3>
      {query.isLoading && <p className="mt-5 text-sm text-text-tertiary">Revisando turnos...</p>}
      {query.isError && <p className="mt-5 text-sm text-alert">No pudimos cargar horas.</p>}
      {!query.isLoading && !query.isError && (
        <ul className="mt-4 flex max-h-[280px] flex-col gap-3 overflow-y-auto">
          {query.turnos.slice(0, 4).map((t) => (
            <li key={`${t.empleadoId}-${t.entradaAt}`} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{t.nombre}</span>
              <span className="shrink-0 font-mono text-xs text-alert">{horaLocal(t.entradaAt)}</span>
            </li>
          ))}
          {query.turnos.length === 0 && <li className="text-sm text-text-tertiary">Todo en orden.</li>}
        </ul>
      )}
    </Card>
  );
}

export function PulsoOperativo({ orgId }: { orgId: string }) {
  const ent = useEntitlements();
  const live = useAsistenciaEnVivo(orgId);
  const ausenciasQuery = useAusenciasHoy();
  const olvidaronQuery = useOlvidaronSalida();
  const { data: rechazadasData, isLoading: rechazadasLoading, isError: rechazadasError } = useRechazadas({ page: 1, pageSize: 5 });

  const rrhhHabilitado = tieneModulo(ent, "rrhh");
  const horasHabilitado = tieneModulo(ent, "horas");
  const pendientes = useQuery({
    queryKey: ["pendientes"], queryFn: ({ signal }) => getPendientesOperacion(signal),
    enabled: rrhhHabilitado, staleTime: 30_000, refetchInterval: 60_000,
  });
  const revisando = rechazadasLoading || (rrhhHabilitado && pendientes.isLoading) || (horasHabilitado && olvidaronQuery.isLoading);
  const errorPrioridades = rechazadasError || (rrhhHabilitado && pendientes.isError) || (horasHabilitado && olvidaronQuery.isError);
  const prioridades = [
    ...(rrhhHabilitado && !pendientes.isError ? [
      { label: "Solicitudes por revisar", count: pendientes.data?.totalSolicitudes ?? 0, href: "/rrhh", state: undefined },
      { label: "Certificados pendientes", count: pendientes.data?.totalCertificados ?? 0, href: "/rrhh", state: undefined },
    ] : []),
    { label: "Marcas rechazadas", count: rechazadasError ? 0 : rechazadasData?.pagination.total ?? 0, href: "/asistencia", state: { vista: "rechazadas" } },
    ...(horasHabilitado ? [{ label: "Turnos sin salida de días anteriores", count: olvidaronQuery.isError ? 0 : olvidaronQuery.turnos.length, href: "/horas", state: undefined }] : []),
  ].filter(p => p.count > 0);

  const totalAdentro = live.porSucursal.reduce((acc, g) => acc + g.empleados.length, 0);

  const stats: StatRowItem[] = [{ label: "Adentro ahora", value: live.isLoading || live.isError ? "—" : totalAdentro }];
  if (rrhhHabilitado) stats.push({ label: "Ausencias hoy", value: ausenciasQuery.isLoading || ausenciasQuery.isError ? "—" : ausenciasQuery.ausencias.length });

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="prioridades-title" className="rounded-xl border border-border bg-surface-raised p-4 sm:p-5">
        <h3 id="prioridades-title" className="text-base font-semibold">Tu próximo paso</h3>
        {revisando && <p role="status" className="mt-2 text-text-secondary">Revisando pendientes…</p>}
        {errorPrioridades && <p role="alert" className="mt-2 text-alert">No pudimos verificar todas las categorías. Revisá los módulos antes de dar todo por resuelto.</p>}
        {!revisando && !errorPrioridades && prioridades.length === 0 && <p className="mt-2 text-text-secondary">No hay pendientes en las categorías consultadas.</p>}
        <ul className="mt-2 divide-y divide-border">
          {prioridades.map(p => <li key={p.label}><Link to={p.href} state={p.state} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-accent-700"><span>{p.label}</span><span className="shrink-0 font-semibold text-accent-700">{p.count} · Revisar →</span></Link></li>)}
        </ul>
      </section>
      <StatRow stats={stats} />
      <div className="grid gap-4 md:grid-cols-2">
        <AhoraMismo enVivo={live} />
        {tieneModulo(ent, "rrhh") && <AusenciasHoy />}
        <PendientesRevision />
        {tieneModulo(ent, "horas") && <PendingHours />}
        <UltimosMovimientos enVivo={live} />
      </div>
    </div>
  );
}
