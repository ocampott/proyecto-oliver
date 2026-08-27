import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { MultiSelect } from "../../components/ui/multi-select";
import { Toolbar } from "../../components/ui/toolbar";
import { Segmented } from "../../components/ui/segmented";
import { Meter } from "../../components/ui/meter";
import { Sparkline } from "../../components/ui/sparkline";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Card } from "../../components/ui/card";
import { Status } from "../../components/ui/status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { PageHeader } from "../../components/PageHeader";
import { ErrorPlan } from "../../components/ErrorPlan";
import { useToast } from "../../components/ui/toast";
import { useHoras } from "./hooks";
import { useHorariosDeVarios } from "../turnos/hooks";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { exportarHoras, type Turno } from "../../lib/api";
import { calcularHorasEsperadas } from "../turnos/calculos";

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

type Periodo = "semana" | "quincena" | "mes";

function rangoPara(periodo: Periodo): { desde: string; hasta: string } {
  const hasta = hoyAR();
  if (periodo === "mes") return { desde: inicioDeMesAR(), hasta };
  const dias = periodo === "quincena" ? 15 : 7;
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return { desde: d.toLocaleDateString("sv", { timeZone: AR_TZ }), hasta };
}

interface ResumenFila {
  empleadoId: string;
  nombre: string;
  sucursalId: string | null;
  dias: number;
  horas: number;
  esperadas: number;
  extras: number;
  enCurso: boolean;
}

function construirResumen(turnos: Turno[], esperadasPorEmpleado: Map<string, number>): ResumenFila[] {
  const horasPorEmpleado = new Map<string, number>();
  const diasPorEmpleado = new Map<string, Set<string>>();
  const enCursoPorEmpleado = new Map<string, boolean>();
  const nombrePorEmpleado = new Map<string, string>();
  const sucursalPorEmpleado = new Map<string, string | null>();

  for (const t of turnos) {
    horasPorEmpleado.set(t.empleado_id, (horasPorEmpleado.get(t.empleado_id) ?? 0) + (t.horas ?? 0));
    const dias = diasPorEmpleado.get(t.empleado_id) ?? new Set<string>();
    dias.add(t.entrada_at.slice(0, 10));
    diasPorEmpleado.set(t.empleado_id, dias);
    if (t.salida_at === null) enCursoPorEmpleado.set(t.empleado_id, true);
    nombrePorEmpleado.set(t.empleado_id, t.nombre);
    sucursalPorEmpleado.set(t.empleado_id, t.sucursal_id);
  }

  return Array.from(horasPorEmpleado.keys()).map((empleadoId) => {
    const horas = horasPorEmpleado.get(empleadoId) ?? 0;
    const esperadas = esperadasPorEmpleado.get(empleadoId) ?? 0;
    return {
      empleadoId,
      nombre: nombrePorEmpleado.get(empleadoId) ?? "—",
      sucursalId: sucursalPorEmpleado.get(empleadoId) ?? null,
      dias: diasPorEmpleado.get(empleadoId)?.size ?? 0,
      horas,
      esperadas,
      extras: esperadas > 0 ? Math.max(0, horas - esperadas) : 0,
      enCurso: enCursoPorEmpleado.get(empleadoId) ?? false,
    };
  });
}

function serieDiaria(turnos: Turno[]): number[] {
  const porDia = new Map<string, number>();
  for (const t of turnos) {
    const dia = t.entrada_at.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + (t.horas ?? 0));
  }
  return Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, h]) => h);
}

type Orden = "horas" | "extras" | "nombre";

export default function HorasPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [empleadosSel, setEmpleadosSel] = useState<string[]>([]);
  const [sucursalSel, setSucursalSel] = useState("");
  const [orden, setOrden] = useState<Orden>("horas");

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

  const hayFiltroEmpleados = empleadosSel.length > 0;
  const hayFiltroSucursal = sucursalSel !== "";
  const filtrosActivos = hayFiltroEmpleados || hayFiltroSucursal;

  function limpiarFiltros() {
    setEmpleadosSel([]);
    setSucursalSel("");
  }

  const turnos = turnosTodos.filter(
    (t) =>
      (!hayFiltroEmpleados || empleadosSel.includes(t.empleado_id)) &&
      (!hayFiltroSucursal || t.sucursal_id === sucursalSel)
  );

  const empleadoIdsConTurnos = [...new Set(turnos.map((t) => t.empleado_id))];
  const horariosQueries = useHorariosDeVarios(empleadoIdsConTurnos);
  const esperadasCargando = horariosQueries.some((q) => q.isLoading);
  const esperadasPorEmpleado = new Map<string, number>();
  empleadoIdsConTurnos.forEach((id, i) => {
    esperadasPorEmpleado.set(id, calcularHorasEsperadas(horariosQueries[i]?.data ?? [], desde, hasta));
  });

  const resumen = construirResumen(turnos, esperadasPorEmpleado);
  const resumenOrdenado = [...resumen].sort((a, b) => {
    if (orden === "horas") return b.horas - a.horas;
    if (orden === "extras") return b.extras - a.extras;
    return a.nombre.localeCompare(b.nombre);
  });

  const totalHoras = resumen.reduce((acc, r) => acc + r.horas, 0);
  const totalExtras = resumen.reduce((acc, r) => acc + r.extras, 0);
  const porDebajo = resumen.filter((r) => r.esperadas > 0 && r.horas / r.esperadas < 0.9).length;

  const sucursalNombre = new Map(sucursales.map((s) => [s.id, s.nombre]));

  const serie = serieDiaria(turnos);
  const stats: StatRowItem[] = [
    { label: "Horas totales", value: totalHoras.toFixed(1), meta: `${resumen.length} empleados` },
    { label: "Horas extra", value: totalExtras.toFixed(1), tone: totalExtras > 20 ? "warning" : "default" },
    { label: "Por debajo de lo esperado", value: porDebajo, tone: porDebajo > 0 ? "warning" : "default" },
    { label: "Tendencia", value: serie.length > 1 ? <Sparkline data={serie} className="text-accent" /> : "—" },
  ];

  return (
    <>
      <PageHeader
        title="Horas trabajadas"
        actions={
          <Button variant="secondary" onClick={handleDescargarExcel} disabled={descargando}>
            <Download className="h-4 w-4" />
            {descargando ? "Generando…" : "Descargar Excel"}
          </Button>
        }
      />

      <div className="mt-6">
        <StatRow stats={stats} />
      </div>

      <Toolbar>
        <Field label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-40" />
        <Field label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-40" />
        <Segmented
          value={periodo}
          onChange={(p) => {
            setPeriodo(p);
            const rango = rangoPara(p);
            setDesde(rango.desde);
            setHasta(rango.hasta);
          }}
          options={[
            { value: "semana", label: "Semana" },
            { value: "quincena", label: "Quincena" },
            { value: "mes", label: "Mes" },
          ]}
        />
        <MultiSelect
          label="Empleados"
          value={empleadosSel}
          onChange={setEmpleadosSel}
          options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
          placeholder="Todos"
          containerClassName="w-52"
        />
        <Select
          label="Sucursal"
          value={sucursalSel}
          onChange={(e) => setSucursalSel(e.target.value)}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-44"
        />
        <Select
          label="Orden"
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          options={[
            { value: "horas", label: "Más horas" },
            { value: "extras", label: "Más extras" },
            { value: "nombre", label: "Por nombre" },
          ]}
          containerClassName="w-40"
        />
        <div className="ml-auto flex items-center gap-3">
          {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
          <span className="font-mono text-xs text-text-tertiary">{resumen.length} resultados</span>
        </div>
      </Toolbar>

      {isError && (
        <div className="mt-2">
          <ErrorPlan error={error instanceof Error ? error : null}>
            <p className="text-[15px] text-alert">No se pudieron cargar los datos. Probá de nuevo.</p>
          </ErrorPlan>
        </div>
      )}

      <section className="page-section">
        <h2>Resumen por empleado</h2>
        <Table containerClassName="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Horas</TableHead>
              <TableHead>Esperadas</TableHead>
              <TableHead>Avance</TableHead>
              <TableHead>Extras</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isLoading || esperadasCargando) && <TableSkeleton cols={7} />}
            {!isLoading && !esperadasCargando &&
              resumenOrdenado.map((r) => (
                <TableRow key={r.empleadoId}>
                  <TableCell>
                    {r.nombre}
                    {r.enCurso && (
                      <Status tone="accent" className="ml-2">
                        En curso
                      </Status>
                    )}
                  </TableCell>
                  <TableCell>{r.sucursalId ? (sucursalNombre.get(r.sucursalId) ?? "—") : "—"}</TableCell>
                  <TableCell>{r.dias}</TableCell>
                  <TableCell className="data-number">{r.horas.toFixed(2)}</TableCell>
                  <TableCell className="data-number">{r.esperadas > 0 ? r.esperadas.toFixed(2) : "—"}</TableCell>
                  <TableCell>{r.esperadas > 0 ? <Meter value={r.horas} max={r.esperadas} warnBelow={0.9} /> : "—"}</TableCell>
                  <TableCell className="data-number">{r.extras > 0 ? r.extras.toFixed(2) : "—"}</TableCell>
                </TableRow>
              ))}
            {!isLoading && resumenOrdenado.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-text-tertiary">
                  No hay datos en este rango.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="page-section">
        <h2>Turnos</h2>
        <Table containerClassName="mt-4">
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

      <Card className="mt-6">
        <h3 className="text-[14px] font-semibold text-text">Cómo se calcula</h3>
        <p className="mt-1.5 text-[13px] text-text-secondary">
          Las horas trabajadas salen de los pares de entrada y salida marcados en Asistencia. Las horas
          esperadas salen del horario semanal cargado en Turnos, multiplicado por los días del período
          elegido — no descuenta ausencias ni feriados. El avance compara ambas; las extras son las horas
          por encima de lo esperado. Las marcas todavía no aprobadas en Asistencia no se contabilizan hasta
          que se resuelven.
        </p>
      </Card>
    </>
  );
}
