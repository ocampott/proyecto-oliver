import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Toolbar } from "../../components/ui/toolbar";
import { MultiSelect } from "../../components/ui/multi-select";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../components/ui/toast";
import { exportarLiquidacion, type LiquidacionEmpleado } from "../../lib/api";
import { formatMoneda } from "../../lib/format";
import { useEmpleados } from "../empleados/hooks";
import { useLiquidacion } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function formatHoras(h: number): string {
  const horas = Math.floor(h);
  const minutos = Math.round((h - horas) * 60);
  return `${horas}h ${minutos.toString().padStart(2, "0")}m`;
}

export default function LiquidacionPage() {
  const toast = useToast();
  const { data: empleados = [] } = useEmpleados();
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [empleadoIds, setEmpleadoIds] = useState<string[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  const { data, isLoading, refetch } = useLiquidacion({ desde, hasta, empleadoIds });
  const filas = data?.filas ?? [];
  const totalPeriodo = filas.reduce((acc, f) => acc + f.total, 0);
  const conAlertas = filas.filter((f) => f.advertencias.length > 0).length;

  const stats: StatRowItem[] = [
    { label: "Total del período", value: formatMoneda(totalPeriodo) },
    { label: "Empleados", value: filas.length },
    { label: "Con alertas", value: conAlertas, tone: conAlertas > 0 ? "warning" : "default" },
  ];

  async function handleDescargar() {
    setDescargando(true);
    try {
      await exportarLiquidacion({ desde, hasta, empleadoIds });
      toast.success("Excel descargado.");
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Liquidación"
        description="Cálculo interno aproximado a partir de asistencia y horarios — no reemplaza el recibo de sueldo."
        actions={
          <Button variant="secondary" onClick={handleDescargar} disabled={descargando || filas.length === 0}>
            <Download className="h-4 w-4" />
            {descargando ? "Generando…" : "Exportar Excel"}
          </Button>
        }
      />

      <div>
        <StatRow stats={stats} />
      </div>

      <Toolbar>
        <Field label="Desde" compact type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-[136px]" />
        <Field label="Hasta" compact type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-[136px]" />
        <MultiSelect
          label="Empleados"
          variant="compact"
          value={empleadoIds}
          onChange={setEmpleadoIds}
          options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
          placeholder="Todos los empleados"
          containerClassName="w-52"
        />
        <Button variant="secondary" onClick={() => refetch()} className="ml-auto">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </Toolbar>

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Base</TableHead>
            <TableHead>Descuentos</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            filas.map((f) => (
              <FilaLiquidacion
                key={f.empleado_id}
                fila={f}
                abierto={expandido === f.empleado_id}
                onToggle={() => setExpandido(expandido === f.empleado_id ? null : f.empleado_id)}
              />
            ))}
          {!isLoading && filas.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-text-tertiary">
                Ningún empleado activo en el rango seleccionado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}

function FilaLiquidacion({ fila: f, abierto, onToggle }: { fila: LiquidacionEmpleado; abierto: boolean; onToggle: () => void }) {
  const descuentos = f.descuento_tardanza + f.descuento_ausencia;
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="font-medium text-text">
          {f.nombre}
          {f.advertencias.length > 0 && (
            <span className="ml-2 rounded-[6px] border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">
              ⚠ {f.advertencias.length}
            </span>
          )}
          {f.horas_en_curso && (
            <span className="ml-2 rounded-[6px] border border-accent/30 bg-accent-100 px-1.5 py-0.5 text-[11px] font-medium text-accent-800">
              ⏱ en curso
            </span>
          )}
        </TableCell>
        <TableCell>
          {f.tipo_pago === "mensual" ? "Mensual" : f.tipo_pago === "hora" ? "Por hora" : f.tipo_pago === "dia" ? "Por día" : "—"}
        </TableCell>
        <TableCell className="font-mono text-[12.5px] text-text-secondary">
          {f.tipo_pago === "mensual"
            ? f.sueldo_mensual !== null
              ? formatMoneda(f.sueldo_mensual)
              : "—"
            : f.tipo_pago === "hora"
              ? f.horas_trabajadas !== null
                ? `${formatHoras(f.horas_trabajadas)} × ${f.valor_hora ? formatMoneda(f.valor_hora) : "—"}`
                : "—"
              : f.tipo_pago === "dia"
                ? f.dias_trabajados !== null
                  ? `${f.dias_trabajados} día${f.dias_trabajados === 1 ? "" : "s"} × ${f.valor_dia ? formatMoneda(f.valor_dia) : "—"}`
                  : f.horas_trabajadas !== null
                    ? `${formatHoras(f.horas_trabajadas)} × ${f.valor_hora ? formatMoneda(f.valor_hora) : "—"}`
                    : "—"
                : "—"}
        </TableCell>
        <TableCell className="font-mono text-[12.5px] text-alert">{descuentos > 0 ? `- ${formatMoneda(descuentos)}` : "—"}</TableCell>
        <TableCell className="text-right font-mono font-semibold text-text">{formatMoneda(f.total)}</TableCell>
        <TableCell className="text-[12px] text-text-tertiary">{abierto ? "▲" : "▼"}</TableCell>
      </TableRow>
      {abierto && (
        <TableRow>
          <TableCell colSpan={6} className="bg-surface">
            <div className="space-y-1 py-1 text-[13px] text-text-secondary">
              {f.advertencias.map((a, i) => (
                <p key={i} className="text-warning">
                  ⚠ {a}
                </p>
              ))}
              {f.tipo_pago === "hora" && (
                <p>Horas trabajadas en el período: {f.horas_trabajadas !== null ? formatHoras(f.horas_trabajadas) : "—"}</p>
              )}
              {f.tipo_pago === "dia" && (
                <>
                  <p>Horas trabajadas en el período: {f.horas_trabajadas !== null ? formatHoras(f.horas_trabajadas) : "—"}</p>
                  {f.dias_trabajados !== null ? (
                    <>
                      <p>
                        Días trabajados (con jornal): {f.dias_trabajados} × {f.valor_dia ? formatMoneda(f.valor_dia) : "—"}
                      </p>
                      {f.horas_extra !== null && f.horas_extra > 0 && (
                        <p>
                          Horas extra: {formatHoras(f.horas_extra)}
                          {f.valor_hora && ` (+ ${formatMoneda(f.horas_extra * f.valor_hora)})`}
                        </p>
                      )}
                      <p>
                        Ausencias sin aviso: {f.dias_ausencia} día{f.dias_ausencia === 1 ? "" : "s"}
                      </p>
                      {f.dias_ausencia_justificada > 0 && (
                        <p className="text-success">
                          ✓ Ausencias justificadas: {f.dias_ausencia_justificada} día{f.dias_ausencia_justificada === 1 ? "" : "s"}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-warning">⚠ Sin horario cargado — se pagó directo por hora trabajada.</p>
                  )}
                </>
              )}
              {f.tipo_pago === "mensual" && (
                <>
                  <p>Horas pactadas en el período: {f.horas_pactadas !== null ? formatHoras(f.horas_pactadas) : "—"}</p>
                  <p>Horas trabajadas (fichadas): {f.horas_trabajadas !== null ? formatHoras(f.horas_trabajadas) : "—"}</p>
                  <p>Valor hora equivalente: {f.valor_hora_equivalente !== null ? formatMoneda(f.valor_hora_equivalente) : "—"}</p>
                  <p>
                    Tardanzas/salidas anticipadas: {f.minutos_perdidos} min
                    {f.descuento_tardanza > 0 && ` (- ${formatMoneda(f.descuento_tardanza)})`}
                  </p>
                  <p>
                    Ausencias sin aviso: {f.dias_ausencia} día{f.dias_ausencia === 1 ? "" : "s"}
                    {f.descuento_ausencia > 0 && ` (- ${formatMoneda(f.descuento_ausencia)})`}
                  </p>
                  {f.dias_ausencia_justificada > 0 && (
                    <p className="text-success">
                      ✓ Ausencias justificadas: {f.dias_ausencia_justificada} día{f.dias_ausencia_justificada === 1 ? "" : "s"} — no se descuentan
                    </p>
                  )}
                </>
              )}
              {f.total_por_horas !== null && (
                <p className={Math.abs(f.total - f.total_por_horas) <= 1 ? "" : f.total > f.total_por_horas ? "text-alert" : "text-accent"}>
                  Según horas trabajadas × valor hora: {formatMoneda(f.total_por_horas)}
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
