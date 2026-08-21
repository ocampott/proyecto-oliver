import { useState } from "react";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Status, type StatusProps } from "../../components/ui/status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { CumplimientoRow } from "../../lib/api";
import { useSucursales } from "../sucursales/hooks";
import { useEmpleados } from "../empleados/hooks";
import { useCumplimiento, useTolerancia, useGuardarTolerancia } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: AR_TZ, hour: "2-digit", minute: "2-digit" });
}

function diffLabel(min: number | null): string {
  if (min === null) return "—";
  if (min <= 0) return "a tiempo";
  return `+${min} min`;
}

const ESTADO_INFO: Record<CumplimientoRow["estado"], { label: string; tone: StatusProps["tone"] }> = {
  a_horario: { label: "A horario", tone: "success" },
  tarde: { label: "Tarde", tone: "warning" },
  salida_anticipada: { label: "Salida anticipada", tone: "warning" },
  tarde_y_anticipada: { label: "Tarde y salida anticipada", tone: "warning" },
  sin_horario: { label: "Sin horario definido", tone: "neutral" },
};

export default function CumplimientoTab() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [sucursalId, setSucursalId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [toleranciaInput, setToleranciaInput] = useState("");
  const [guardadoOk, setGuardadoOk] = useState(false);

  const { data: sucursales = [] } = useSucursales();
  const { data: empleados = [] } = useEmpleados();
  const { data: filas = [], isLoading } = useCumplimiento({
    desde,
    hasta,
    sucursalId: sucursalId || undefined,
    empleadoId: empleadoId || undefined,
  });
  const { data: toleranciaData } = useTolerancia();
  const guardarTolerancia = useGuardarTolerancia();

  const toleranciaActual = toleranciaInput || toleranciaData?.tolerancia_min?.toString() || "";

  async function handleGuardarTolerancia() {
    setGuardadoOk(false);
    await guardarTolerancia.mutateAsync(Number(toleranciaActual));
    setGuardadoOk(true);
  }

  return (
    <>
      <Card className="mt-4">
        <h2 className="text-[16px] font-extrabold text-text">Tolerancia general</h2>
        <p className="mt-1 text-[13.5px] text-text/60">
          Minutos de margen antes de marcar un turno como "tarde" o "salida anticipada" — aplica salvo que la franja tenga su propia tolerancia.
        </p>
        <div className="mt-3 flex items-end gap-3">
          <Field label="Minutos" type="number" value={toleranciaActual} onChange={(e) => { setToleranciaInput(e.target.value); setGuardadoOk(false); }} containerClassName="w-32" />
          <Button variant="secondary" onClick={handleGuardarTolerancia} disabled={guardarTolerancia.isPending}>
            Guardar
          </Button>
          {guardadoOk && <span className="text-[13.5px] text-text/60">Guardado.</span>}
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Field label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-40" />
        <Field label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-40" />
        <Select
          label="Sucursal"
          value={sucursalId}
          onChange={(e) => setSucursalId(e.target.value)}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-48"
        />
        <Select
          label="Empleado"
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
          options={[{ value: "", label: "Todos" }, ...empleados.map((e) => ({ value: e.id, label: e.nombre }))]}
          containerClassName="w-48"
        />
      </div>

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Salida</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            filas.map((f, i) => (
              <TableRow key={i}>
                <TableCell>{f.nombre}</TableCell>
                <TableCell>{f.sucursal_nombre}</TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell>
                  {horaLocal(f.entrada_real)}
                  {f.entrada_esperada && <span className="text-text/55"> (esperado {f.entrada_esperada}, {diffLabel(f.diff_entrada_min)})</span>}
                </TableCell>
                <TableCell>
                  {f.en_curso ? "En curso" : f.salida_real ? horaLocal(f.salida_real) : "—"}
                  {f.salida_esperada && f.salida_real && <span className="text-text/55"> (esperado {f.salida_esperada}, {diffLabel(f.diff_salida_min)})</span>}
                </TableCell>
                <TableCell>
                  <Status tone={ESTADO_INFO[f.estado].tone}>{ESTADO_INFO[f.estado].label}</Status>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && filas.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">Sin turnos en este rango.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
