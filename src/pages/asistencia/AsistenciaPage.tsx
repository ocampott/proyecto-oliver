import { useState } from "react";
import { LogIn, LogOut, Download, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Badge } from "../../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { MotivoRechazo } from "../../lib/api";
import { useAsistencia, useRechazadas, useBorrarAsistencia, useResolverRechazada } from "./hooks";
import { exportarAsistencia } from "../../lib/api";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

const MOTIVOS: Record<MotivoRechazo, string> = {
  fuera_de_rango: "Fuera de rango",
  sucursal_sin_gps: "Sucursal sin GPS configurado",
  nombre_no_encontrado: "Nombre no encontrado en la nómina",
  dispositivo_ya_vinculado: "Ya vinculado a otro dispositivo",
};

export default function AsistenciaPage() {
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());

  const { data: registros = [], isLoading, isError } = useAsistencia(desde, hasta);
  const { data: rechazadas = [] } = useRechazadas();
  const borrar = useBorrarAsistencia();
  const resolver = useResolverRechazada();
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);

  async function handleDescargarExcel() {
    setErrorDescarga(null);
    setDescargando(true);
    try {
      await exportarAsistencia(desde, hasta);
    } catch {
      setErrorDescarga("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  async function handleBorrar(id: string) {
    if (!confirm("¿Borrar este registro?")) return;
    setError(null);
    setBorrandoId(id);
    try {
      await borrar.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el registro.");
    } finally {
      setBorrandoId(null);
    }
  }

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    setError(null);
    setResolviendoId(id);
    try {
      await resolver.mutateAsync({ id, accion });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo resolver el intento.");
    } finally {
      setResolviendoId(null);
    }
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Asistencia</h1>

      {rechazadas.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-extrabold text-text">Intentos rechazados</h2>
            <Badge variant="alert">{rechazadas.length} pendientes</Badge>
          </div>
          <Table containerClassName="mt-2 border-[#f3ddc9]">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rechazadas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{horaLocal(r.created_at)}</TableCell>
                  <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                  <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>
                    {MOTIVOS[r.motivo] ?? r.motivo}
                    {r.motivo === "fuera_de_rango" && r.distancia_metros != null && (
                      <span className="text-text/55"> (a {r.distancia_metros} m)</span>
                    )}
                    {r.tipo && <span className="text-text/55"> — {r.tipo}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="default"
                        onClick={() => handleResolver(r.id, "aprobar")}
                        disabled={resolviendoId === r.id}
                      >
                        {resolviendoId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Aprobar
                      </Button>
                      <Button
                        variant="secondary"
                        size="default"
                        onClick={() => handleResolver(r.id, "descartar")}
                        disabled={resolviendoId === r.id}
                      >
                        Descartar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-end gap-4">
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
        {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}
        {isError && (
          <p className="mt-2 text-[15px] text-accent-700">
            No se pudieron cargar los registros. Probá de nuevo.
          </p>
        )}

        <Table containerClassName="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton cols={5} />}
            {registros.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{horaLocal(r.created_at)}</TableCell>
                <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                <TableCell>
                  {r.tipo === "entrada" ? (
                    <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-success-700">
                      <LogIn className="h-3 w-3" /> Entrada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-text-secondary">
                      <LogOut className="h-3 w-3" /> Salida
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="secondary" size="default" onClick={() => handleBorrar(r.id)} disabled={borrandoId === r.id}>
                      {borrandoId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Borrar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && registros.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  No hay registros en este rango.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
