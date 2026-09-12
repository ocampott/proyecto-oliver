import { useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { Badge } from "../../components/ui/badge";
import { PersonCell } from "../../components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { useEmpleados } from "../empleados/hooks";
import { useInasistencias } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

export default function InasistenciasTab() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [empleadoId, setEmpleadoId] = useState("");

  const { data: empleados = [] } = useEmpleados();
  const { data: filas = [], isLoading, isError } = useInasistencias({ desde, hasta, empleadoId: empleadoId || undefined });

  const empleadoNombre = new Map(empleados.map((e) => [e.id, e.nombre]));
  const sinAviso = filas.filter((f) => !f.justificada).length;

  return (
    <>
      <p className="text-[14px] text-text-secondary">
        Turnos pactados (horario semanal o turno puntual) sin ninguna marca de asistencia que los cubra —
        "Con aviso" quiere decir que la fecha cae dentro de un pedido de RRHH ya cargado (vacaciones, enfermedad,
        etc.); si no, nadie avisó que faltaba.
      </p>

      <Toolbar className="mt-3">
        <div className="flex items-center gap-1.5">
          <Field label="Desde" compact type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-[136px]" />
          <span className="text-xs text-text-tertiary">→</span>
          <Field label="Hasta" compact type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-[136px]" />
        </div>
        <Select
          label="Empleado"
          compact
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
          options={[{ value: "", label: "Todos" }, ...empleados.map((e) => ({ value: e.id, label: e.nombre }))]}
          containerClassName="w-44"
        />
        <div className="ml-auto flex items-center gap-3">
          {sinAviso > 0 && <span className="font-mono text-xs text-alert">{sinAviso} sin aviso</span>}
          <span className="font-mono text-xs text-text-tertiary">{filas.length} resultados</span>
        </div>
      </Toolbar>

      {isError && <p className="mt-2 text-[15px] text-alert">No se pudieron cargar las inasistencias. Probá de nuevo.</p>}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Horario pactado</TableHead>
            <TableHead>Aviso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={4} />}
          {!isLoading &&
            filas.map((f, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Link to={`/empleados/${f.empleado_id}`} className="inline-flex items-center gap-2 hover:underline">
                    <PersonCell nombre={empleadoNombre.get(f.empleado_id) ?? "—"} />
                  </Link>
                </TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell className="font-mono text-[13px] text-text-secondary">
                  {f.hora_inicio} – {f.hora_fin}
                </TableCell>
                <TableCell>
                  <Badge tone={f.justificada ? "success" : "danger"}>{f.justificada ? "Con aviso" : "Sin aviso"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && !isError && filas.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-text-tertiary">
                No hay inasistencias en este rango.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
