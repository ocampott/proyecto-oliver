import { useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { Segmented } from "../../components/ui/segmented";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { PersonCell } from "../../components/ui/avatar";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { CON_DESVIO, ESTADO_INFO } from "./calculos";
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

type VistaCumplimiento = "todos" | "con_desvio";

export default function CumplimientoTab() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [sucursalId, setSucursalId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [vista, setVista] = useState<VistaCumplimiento>("todos");
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

  const filasFiltradas = vista === "con_desvio" ? filas.filter((f) => CON_DESVIO.includes(f.estado)) : filas;

  return (
    <>
      <Card className="mt-4">
        <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-text">Tolerancia general</h2>
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

      <Toolbar>
        <Segmented
          value={vista}
          onChange={setVista}
          options={[
            { value: "todos", label: "Todos", count: filas.length },
            { value: "con_desvio", label: "Con desvío", count: filas.filter((f) => CON_DESVIO.includes(f.estado)).length },
          ]}
        />
        <div className="flex items-center gap-1.5">
          <Field label="Desde" compact type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-[136px]" />
          <span className="text-xs text-text-tertiary">→</span>
          <Field label="Hasta" compact type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-[136px]" />
        </div>
        <Select
          label="Sucursal"
          compact
          value={sucursalId}
          onChange={(e) => setSucursalId(e.target.value)}
          options={[{ value: "", label: "Todas las sucursales" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-44"
        />
        <Select
          label="Empleado"
          compact
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
          options={[{ value: "", label: "Todos" }, ...empleados.map((e) => ({ value: e.id, label: e.nombre }))]}
          containerClassName="w-44"
        />
        {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} className="ml-0" />}
        <div className="ml-auto">
          <span className="font-mono text-xs text-text-tertiary">{filasFiltradas.length} resultados</span>
        </div>
      </Toolbar>

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
            filasFiltradas.map((f, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Link to={`/empleados/${f.empleado_id}`} className="inline-flex items-center gap-2 hover:underline">
                    <PersonCell nombre={f.nombre} />
                  </Link>
                </TableCell>
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
          {!isLoading && filasFiltradas.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text-tertiary">Sin turnos en este rango.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
