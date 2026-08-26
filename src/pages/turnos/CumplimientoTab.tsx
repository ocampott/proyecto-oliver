import { useState } from "react";
import { Field } from "../../components/ui/field";
import { FilterChip } from "../../components/ui/filter-chip";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Status, type StatusProps } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
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
  const toast = useToast();

  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const { data: empleados = [] } = useEmpleados();
  const { data: filas = [], isLoading, isError } = useCumplimiento({
    desde,
    hasta,
    sucursalId: sucursalId || undefined,
    empleadoId: empleadoId || undefined,
  });
  const { data: toleranciaData } = useTolerancia();
  const guardarTolerancia = useGuardarTolerancia();

  const toleranciaActual = toleranciaInput || toleranciaData?.tolerancia_min?.toString() || "";
  const filtrosActivos = sucursalId !== "" || empleadoId !== "";

  function limpiarFiltros() {
    setSucursalId("");
    setEmpleadoId("");
  }

  async function handleGuardarTolerancia() {
    try {
      await guardarTolerancia.mutateAsync(Number(toleranciaActual));
      toast.success("Tolerancia actualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la tolerancia.");
    }
  }

  return (
    <>
      <Card className="mt-4">
        <h2 className="text-[16px] font-extrabold text-text">Tolerancia general</h2>
        <p className="mt-1 text-[13.5px] text-text-secondary">
          Minutos de margen antes de marcar un turno como "tarde" o "salida anticipada" — aplica salvo que la franja tenga su propia tolerancia.
        </p>
        <div className="mt-3 flex items-end gap-3">
          <Field label="Minutos" type="number" value={toleranciaActual} onChange={(e) => setToleranciaInput(e.target.value)} containerClassName="w-32" />
          <Button variant="secondary" onClick={handleGuardarTolerancia} disabled={guardarTolerancia.isPending}>
            Guardar
          </Button>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Field label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-40" />
        <Field label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-40" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterChip
          label="Sucursal"
          value={sucursalId}
          defaultValue=""
          onChange={setSucursalId}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
        />
        <FilterChip
          label="Empleado"
          value={empleadoId}
          defaultValue=""
          onChange={setEmpleadoId}
          options={[{ value: "", label: "Todos" }, ...empleados.map((e) => ({ value: e.id, label: e.nombre }))]}
        />
        {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
      </div>

      {isError && (
        <p className="mt-2 text-[15px] text-alert">No se pudo cargar el cumplimiento. Probá de nuevo.</p>
      )}

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
                  {f.entrada_esperada && <span className="text-text-tertiary"> (esperado {f.entrada_esperada}, {diffLabel(f.diff_entrada_min)})</span>}
                </TableCell>
                <TableCell>
                  {f.en_curso ? "En curso" : f.salida_real ? horaLocal(f.salida_real) : "—"}
                  {f.salida_esperada && f.salida_real && <span className="text-text-tertiary"> (esperado {f.salida_esperada}, {diffLabel(f.diff_salida_min)})</span>}
                </TableCell>
                <TableCell>
                  <Status tone={ESTADO_INFO[f.estado].tone}>{ESTADO_INFO[f.estado].label}</Status>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && filas.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text-tertiary">Sin turnos en este rango.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
