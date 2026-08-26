import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { MultiSelect } from "../../components/ui/multi-select";
import { FilterChip } from "../../components/ui/filter-chip";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Status } from "../../components/ui/status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { ErrorPlan } from "../../components/ErrorPlan";
import { useToast } from "../../components/ui/toast";
import { useHoras } from "./hooks";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { exportarHoras, type ResumenEmpleado, type Turno } from "../../lib/api";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function fechaHoraLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

function calcularResumen(turnos: Turno[]): ResumenEmpleado[] {
  const porEmpleado = new Map<string, ResumenEmpleado>();
  for (const t of turnos) {
    const actual = porEmpleado.get(t.empleado_id) ?? { nombre: t.nombre, totalHoras: 0, enCurso: false };
    actual.totalHoras += t.horas ?? 0;
    if (t.salida_at === null) actual.enCurso = true;
    porEmpleado.set(t.empleado_id, actual);
  }
  return Array.from(porEmpleado.values());
}

export default function HorasPage() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [empleadosSel, setEmpleadosSel] = useState<string[]>([]);
  const [sucursalSel, setSucursalSel] = useState("");

  const { data, isLoading, isError, error } = useHoras(desde, hasta);
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const toast = useToast();
  const [descargando, setDescargando] = useState(false);

  async function handleDescargarExcel() {
    setDescargando(true);
    try {
      await exportarHoras(desde, hasta);
      toast.success("Excel descargado.");
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  const turnosTodos = data?.turnos ?? [];
  const resumenTodos = data?.resumen ?? [];

  const hayFiltroEmpleados = empleadosSel.length > 0;
  const hayFiltroSucursal = sucursalSel !== "";
  const filtrosActivos = hayFiltroEmpleados || hayFiltroSucursal;

  function limpiarFiltros() {
    setEmpleadosSel([]);
    setSucursalSel("");
  }

  const turnos = useMemo(
    () =>
      turnosTodos.filter(
        (t) =>
          (!hayFiltroEmpleados || empleadosSel.includes(t.empleado_id)) &&
          (!hayFiltroSucursal || t.sucursal_id === sucursalSel)
      ),
    [turnosTodos, empleadosSel, sucursalSel, hayFiltroEmpleados, hayFiltroSucursal]
  );

  // El resumen que trae el backend es un agregado global (sin desglose por
  // sucursal ni empleado_id), así que si hay algún filtro activo lo
  // recalculamos en el cliente a partir de los turnos ya filtrados.
  const resumen = useMemo(() => {
    if (!hayFiltroEmpleados && !hayFiltroSucursal) return resumenTodos;
    return calcularResumen(turnos);
  }, [hayFiltroEmpleados, hayFiltroSucursal, resumenTodos, turnos]);

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Horas trabajadas</h1>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Field
          label="Desde"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          containerClassName="w-40"
        />
        <Field
          label="Hasta"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          containerClassName="w-40"
        />
        <Button variant="secondary" className="ml-auto" onClick={handleDescargarExcel} disabled={descargando}>
          <Download className="h-4 w-4" />
          {descargando ? "Generando…" : "Descargar Excel"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <MultiSelect
          variant="chip"
          label="Empleados"
          value={empleadosSel}
          onChange={setEmpleadosSel}
          options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
          placeholder="Empleados"
        />
        <FilterChip
          label="Sucursal"
          value={sucursalSel}
          defaultValue=""
          onChange={setSucursalSel}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
        />
        {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
      </div>

      {isError && (
        <div className="mt-2">
          <ErrorPlan error={error instanceof Error ? error : null}>
            <p className="text-[15px] text-alert">No se pudieron cargar los datos. Probá de nuevo.</p>
          </ErrorPlan>
        </div>
      )}

      {resumen.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[20px] font-extrabold text-text">Resumen por empleado</h2>
          <Table containerClassName="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Total horas</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumen.map((r) => (
                <TableRow key={r.nombre}>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell>{r.totalHoras.toFixed(2)}</TableCell>
                  <TableCell>{r.enCurso ? <Status tone="accent">Turno en curso</Status> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-[20px] font-extrabold text-text">Turnos</h2>
        <Table containerClassName="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead>Horas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton cols={5} />}
            {turnos.map((t, i) => (
              <TableRow key={`${t.empleado_id}-${t.entrada_at}-${i}`}>
                <TableCell>{t.nombre}</TableCell>
                <TableCell>{t.sucursal_nombre}</TableCell>
                <TableCell>{fechaHoraLocal(t.entrada_at)}</TableCell>
                <TableCell>
                  {t.salida_at ? fechaHoraLocal(t.salida_at) : <Status tone="accent">En curso</Status>}
                </TableCell>
                <TableCell>{t.horas !== null ? t.horas.toFixed(2) : "—"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && turnos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text-tertiary">
                  No hay turnos en este rango.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
