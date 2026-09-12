import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Segmented } from "../../components/ui/segmented";
import { Status } from "../../components/ui/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { PersonCell } from "../../components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { CumplimientoRow, AusenciaInferida, SalidaHuerfana, Empleado, Sucursal, TipoMarca } from "../../lib/api";
import { useCumplimiento, useInasistencias } from "../turnos/hooks";
import { ESTADO_INFO } from "../turnos/calculos";
import { horaLocal, fechaLocal } from "../../lib/format";
import { huerfanaAEditable, huerfanaABorrable, type RegistroEditable, type RegistroBorrable } from "./shared";

const AR_TZ = "America/Argentina/Buenos_Aires";

function horaAhoraAR(): string {
  return new Date().toLocaleTimeString("sv", { timeZone: AR_TZ, hour: "2-digit", minute: "2-digit" });
}

function diffLabel(min: number | null): string {
  if (min === null) return "—";
  if (min <= 0) return "a tiempo";
  return `+${min} min`;
}

type VistaFiltro = "todos" | "asistencias" | "inasistencias";

type UnifiedRow =
  | { key: string; kind: "turno"; empleado_id: string; nombre: string; sucursal_nombre: string | null; fecha: string; row: CumplimientoRow }
  | { key: string; kind: "ausencia"; empleado_id: string; nombre: string; sucursal_nombre: string | null; fecha: string; row: AusenciaInferida }
  | { key: string; kind: "huerfana"; empleado_id: string; nombre: string; sucursal_nombre: string | null; fecha: string; row: SalidaHuerfana };

function timestampDe(f: UnifiedRow): string {
  if (f.kind === "turno") return f.row.entrada_real;
  if (f.kind === "huerfana") return f.row.created_at;
  return `${f.row.fecha}T${f.row.hora_inicio}:00-03:00`;
}

export interface PrefillOpts {
  empleadoId: string;
  sucursalNombre?: string | null;
  fecha: string;
  hora?: string;
  tipo: TipoMarca;
}

export function PorTurnoTab({
  desde,
  hasta,
  empleadoId,
  empleados,
  sucursales,
  huerfanas,
  huerfanasLoading,
  gestionable,
  abrirEditar,
  setBorrarTarget,
  abrirCrearConPrefill,
}: {
  desde: string;
  hasta: string;
  empleadoId?: string;
  empleados: Empleado[];
  sucursales: Sucursal[];
  huerfanas: SalidaHuerfana[];
  huerfanasLoading: boolean;
  gestionable: boolean;
  abrirEditar: (r: RegistroEditable) => void;
  setBorrarTarget: (r: RegistroBorrable) => void;
  abrirCrearConPrefill: (opts: PrefillOpts) => void;
}) {
  const [vistaFiltro, setVistaFiltro] = useState<VistaFiltro>("todos");
  const [expandido, setExpandido] = useState<string | null>(null);

  const { data: cumplimiento = [], isLoading: cumplimientoLoading, isError: cumplimientoError } = useCumplimiento({ desde, hasta, empleadoId });
  const { data: inasistencias = [], isLoading: inasistenciasLoading, isError: inasistenciasError } = useInasistencias({ desde, hasta, empleadoId });

  const empleadoNombre = useMemo(() => new Map(empleados.map((e) => [e.id, e.nombre])), [empleados]);
  const sucursalIdPorNombre = useMemo(() => new Map(sucursales.map((s) => [s.nombre, s.id])), [sucursales]);

  const mostrarAsistencias = vistaFiltro !== "inasistencias";
  const mostrarInasistencias = vistaFiltro !== "asistencias";

  const filas: UnifiedRow[] = useMemo(() => {
    const resultado: UnifiedRow[] = [];
    if (mostrarAsistencias) {
      for (const c of cumplimiento) {
        resultado.push({ key: `turno-${c.entrada_id}`, kind: "turno", empleado_id: c.empleado_id, nombre: c.nombre, sucursal_nombre: c.sucursal_nombre, fecha: c.fecha, row: c });
      }
      for (const h of huerfanas) {
        resultado.push({ key: `huerfana-${h.id}`, kind: "huerfana", empleado_id: h.empleado_id, nombre: h.empleado_nombre, sucursal_nombre: h.sucursal_nombre, fecha: fechaLocal(h.created_at), row: h });
      }
    }
    if (mostrarInasistencias) {
      for (const a of inasistencias) {
        resultado.push({ key: `ausencia-${a.empleado_id}-${a.fecha}-${a.hora_inicio}`, kind: "ausencia", empleado_id: a.empleado_id, nombre: empleadoNombre.get(a.empleado_id) ?? "—", sucursal_nombre: null, fecha: a.fecha, row: a });
      }
    }
    resultado.sort((x, y) => timestampDe(y).localeCompare(timestampDe(x)));
    return resultado;
  }, [cumplimiento, huerfanas, inasistencias, mostrarAsistencias, mostrarInasistencias, empleadoNombre]);

  const isLoading = cumplimientoLoading || inasistenciasLoading || huerfanasLoading;
  const isError = cumplimientoError || inasistenciasError;

  return (
    <>
      <Segmented
        value={vistaFiltro}
        onChange={setVistaFiltro}
        options={[
          { value: "todos", label: "Todos", count: filas.length },
          { value: "asistencias", label: "Asistencias", count: cumplimiento.length + huerfanas.length },
          { value: "inasistencias", label: "Inasistencias", count: inasistencias.length },
        ]}
      />

      {isError && <p className="mt-2 text-[15px] text-alert">No se pudo cargar la vista por turno. Probá de nuevo.</p>}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Salida</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={7} />}
          {!isLoading &&
            filas.map((f) => {
              const isExpanded = expandido === f.key;
              return (
                <Fragment key={f.key}>
                  <TableRow className="cursor-pointer" onClick={() => setExpandido(isExpanded ? null : f.key)}>
                    <TableCell>
                      <Link to={`/empleados/${f.empleado_id}`} className="inline-flex items-center gap-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                        <PersonCell nombre={f.nombre} />
                      </Link>
                    </TableCell>
                    <TableCell>{f.sucursal_nombre ?? "—"}</TableCell>
                    <TableCell>{f.fecha}</TableCell>
                    {f.kind === "turno" ? (
                      <>
                        <TableCell>
                          {horaLocal(f.row.entrada_real)}
                          {f.row.entrada_esperada && (
                            <span className="text-text-tertiary"> (esperado {f.row.entrada_esperada}, {diffLabel(f.row.diff_entrada_min)})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {f.row.en_curso ? "En curso" : f.row.salida_real ? horaLocal(f.row.salida_real) : "—"}
                          {f.row.salida_esperada && f.row.salida_real && (
                            <span className="text-text-tertiary"> (esperado {f.row.salida_esperada}, {diffLabel(f.row.diff_salida_min)})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Status tone={ESTADO_INFO[f.row.estado].tone}>{ESTADO_INFO[f.row.estado].label}</Status>
                        </TableCell>
                      </>
                    ) : f.kind === "ausencia" ? (
                      <>
                        <TableCell colSpan={2} className="italic text-text-tertiary">
                          Horario esperado {f.row.hora_inicio}–{f.row.hora_fin}
                        </TableCell>
                        <TableCell>
                          <Badge tone={f.row.justificada ? "success" : "danger"}>{f.row.justificada ? "Con aviso" : "Sin aviso"}</Badge>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell colSpan={2}>
                          <span className="italic text-text-tertiary">Falta la entrada</span>
                          <span className="ml-2 font-mono text-text">salida {horaLocal(f.row.created_at)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge tone="warning">Salida sin entrada</Badge>
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-right text-[12px] text-text-tertiary">{isExpanded ? "▲" : "▼"}</TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-surface">
                        <div className="flex flex-col gap-2 py-1 text-[13px] text-text-secondary">
                          {f.kind === "turno" && (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="w-16 font-medium text-text">Entrada</span>
                                <span className="font-mono text-text">{horaLocal(f.row.entrada_real)}</span>
                                {gestionable && (
                                  <>
                                    <button
                                      className="text-xs text-accent-700 underline hover:text-text"
                                      onClick={() => abrirEditar({ id: f.row.entrada_id, empleado_id: f.empleado_id, sucursal_id: sucursalIdPorNombre.get(f.row.sucursal_nombre) ?? "", tipo: "entrada", created_at: f.row.entrada_real })}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      className="text-xs text-alert underline hover:text-text"
                                      onClick={() => setBorrarTarget({ id: f.row.entrada_id, tipo: "entrada", empleado_nombre: f.nombre, created_at: f.row.entrada_real })}
                                    >
                                      Borrar
                                    </button>
                                  </>
                                )}
                              </div>
                              {f.row.salida_real !== null && f.row.salida_id !== null ? (
                                <div className="flex items-center gap-3">
                                  <span className="w-16 font-medium text-text">Salida</span>
                                  <span className="font-mono text-text">{horaLocal(f.row.salida_real)}</span>
                                  {gestionable && (
                                    <>
                                      <button
                                        className="text-xs text-accent-700 underline hover:text-text"
                                        onClick={() => abrirEditar({ id: f.row.salida_id!, empleado_id: f.empleado_id, sucursal_id: sucursalIdPorNombre.get(f.row.sucursal_nombre) ?? "", tipo: "salida", created_at: f.row.salida_real! })}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        className="text-xs text-alert underline hover:text-text"
                                        onClick={() => setBorrarTarget({ id: f.row.salida_id!, tipo: "salida", empleado_nombre: f.nombre, created_at: f.row.salida_real! })}
                                      >
                                        Borrar
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                gestionable && (
                                  <Button
                                    variant="secondary"
                                    size="default"
                                    className="w-fit"
                                    onClick={() =>
                                      abrirCrearConPrefill({ empleadoId: f.empleado_id, sucursalNombre: f.sucursal_nombre, fecha: f.fecha, hora: horaAhoraAR(), tipo: "salida" })
                                    }
                                  >
                                    + Cargar salida
                                  </Button>
                                )
                              )}
                            </>
                          )}
                          {f.kind === "ausencia" && (
                            <>
                              <p>
                                Horario esperado: <span className="font-mono text-text">{f.row.hora_inicio}–{f.row.hora_fin}</span>
                              </p>
                              {gestionable && (
                                <Button
                                  variant="secondary"
                                  size="default"
                                  className="w-fit"
                                  onClick={() => abrirCrearConPrefill({ empleadoId: f.empleado_id, fecha: f.fecha, hora: f.row.hora_inicio, tipo: "entrada" })}
                                >
                                  + Cargar marcación
                                </Button>
                              )}
                            </>
                          )}
                          {f.kind === "huerfana" && (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="w-16 font-medium text-text">Salida</span>
                                <span className="font-mono text-text">{horaLocal(f.row.created_at)}</span>
                                {gestionable && (
                                  <>
                                    <button className="text-xs text-accent-700 underline hover:text-text" onClick={() => abrirEditar(huerfanaAEditable(f.row))}>
                                      Editar
                                    </button>
                                    <button className="text-xs text-alert underline hover:text-text" onClick={() => setBorrarTarget(huerfanaABorrable(f.row))}>
                                      Borrar
                                    </button>
                                  </>
                                )}
                              </div>
                              {gestionable && (
                                <Button
                                  variant="secondary"
                                  size="default"
                                  className="w-fit"
                                  onClick={() =>
                                    abrirCrearConPrefill({ empleadoId: f.empleado_id, sucursalNombre: f.sucursal_nombre, fecha: f.fecha, hora: horaAhoraAR(), tipo: "entrada" })
                                  }
                                >
                                  + Cargar entrada
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          {!isLoading && !isError && filas.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-text-tertiary">
                Ningún turno en el rango seleccionado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
