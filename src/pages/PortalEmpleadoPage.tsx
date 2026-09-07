import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { descargarDocumentoPortal, getPortalEmpleado } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export default function PortalEmpleadoPage() {
  const { orgSlug = "" } = useParams();
  const [errorDescarga, setErrorDescarga] = useState("");
  const [descargando, setDescargando] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["portal", orgSlug], queryFn: ({ signal }) => getPortalEmpleado(orgSlug, signal),
    enabled: !!orgSlug, staleTime: 0, gcTime: 0, retry: false,
  });
  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-bg p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Mi información{data ? ` · ${data.nombre}` : ""}</h1>
        <Link className="text-sm text-accent underline" to={`/chat/${encodeURIComponent(orgSlug)}`}>Volver al chat</Link>
      </header>
      {isLoading && <p role="status">Cargando tu información…</p>}
      {isError && <Card><p role="alert">{error.message}</p><Button onClick={() => refetch()}>Reintentar</Button></Card>}
      {data && !isError && <>
        <Card><h2 className="font-semibold">Mis horarios</h2>
          <ul className="mt-2 space-y-2 text-sm">{data.horarios.map((h) => <li key={h.id}>{DIAS[h.dia_semana]} · {h.hora_inicio} a {h.hora_fin}{h.sucursal_nombre ? ` · ${h.sucursal_nombre}` : ""}</li>)}</ul>
          {data.horarios.length === 0 && <p className="text-sm">Todavía no te asignaron horarios.</p>}
        </Card>
        <Card><h2 className="font-semibold">Vacaciones · {data.anio}</h2>
          <p className="mt-2">Saldo estimado: <strong>{data.vacaciones?.saldo ?? "Sin datos"} días</strong></p>
          <p className="text-sm text-text-secondary">Solo contempla solicitudes aprobadas. Es una referencia; confirmá tu saldo con RRHH.</p>
          {data.vacaciones?.advertencia && <p className="text-sm text-warning">{data.vacaciones.advertencia}</p>}
        </Card>
        <Card><h2 className="font-semibold">Mis solicitudes (últimas 50)</h2>
          <ul className="divide-y divide-border">{data.solicitudes.map((s) => <li key={s.id} className="py-3 text-sm">
            <strong>{s.motivo} · {s.estado}</strong><p>{s.fecha_desde} al {s.fecha_hasta}</p>
            {s.certificado_pendiente && <Link className="text-accent underline" to={`/chat/${encodeURIComponent(orgSlug)}`}>Certificado pendiente: entregalo desde el chat</Link>}
          </li>)}</ul>
          {data.solicitudes.length === 0 && <p className="text-sm">Todavía no hay solicitudes.</p>}
        </Card>
        <Card><h2 className="font-semibold">Mis documentos (últimos 50)</h2>
          <p className="text-sm text-text-secondary">Archivos que RRHH compartió con vos y certificados que enviaste.</p>
          {errorDescarga && <p role="alert" className="text-alert">{errorDescarga}</p>}
          <ul className="mt-2 space-y-2">{data.archivos.map((a) => <li key={a.id}><button className="text-sm text-accent underline disabled:opacity-50" disabled={descargando} onClick={async () => {
            setDescargando(true); setErrorDescarga("");
            try { await descargarDocumentoPortal(orgSlug, a); }
            catch { setErrorDescarga("No se pudo descargar el documento. Probá de nuevo."); }
            finally { setDescargando(false); }
          }}>{a.nombre_original}</button></li>)}</ul>
          {data.archivos.length === 0 && <p className="text-sm">Todavía no hay documentos compartidos.</p>}
        </Card>
      </>}
    </main>
  );
}
