import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Status } from "../../components/ui/status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { useHoras } from "./hooks";
import { exportarHoras } from "../../lib/api";

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

export default function HorasPage() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());

  const { data, isLoading, isError } = useHoras(desde, hasta);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  async function handleDescargarExcel() {
    setErrorDescarga(null);
    setDescargando(true);
    try {
      await exportarHoras(desde, hasta);
    } catch {
      setErrorDescarga("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  const turnos = data?.turnos ?? [];
  const resumen = data?.resumen ?? [];

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

      {errorDescarga && <p className="mt-2 text-[15px] text-accent-700">{errorDescarga}</p>}

      {isError && (
        <p className="mt-2 text-[15px] text-accent-700">
          No se pudieron cargar los datos. Probá de nuevo.
        </p>
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
                <TableCell colSpan={5} className="text-text/60">
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
