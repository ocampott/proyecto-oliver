import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { decidirAusencia, getHistorialAusencia, getPendientesOperacion } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { Field } from "../../components/ui/field";
import { useToast } from "../../components/ui/toast";
import { horaLocal } from "../../lib/format";

export function RevisionSolicitud({ id, revision, estado }: { id: string; revision: number; estado: string }) {
  const [comentario, setComentario] = useState("");
  const [revisionDecision, setRevisionDecision] = useState(revision);
  const [decision, setDecision] = useState<"aprobada" | "rechazada" | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const historial = useQuery({
    queryKey: ["ausencia-historial", id],
    queryFn: ({ signal }) => getHistorialAusencia(id, signal),
  });
  const mutation = useMutation({
    mutationFn: () => decidirAusencia(id, { estado: decision!, revision: revisionDecision, comentario: comentario.trim() }),
    onSuccess: async () => {
      setDecision(null);
      setComentario("");
      await Promise.all(["ausencias", "pendientes", "vacaciones", "liquidacion", "ausencia-historial", "portal"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })));
      toast.success("Decisión guardada.");
    },
    onError: async (e) => {
      toast.error(e.message);
      await queryClient.invalidateQueries({ queryKey: ["pendientes"] });
    },
  });
  return (
    <div className="space-y-3">
      <p className="text-sm">Estado: <strong>{estado}</strong></p>
      {estado === "pendiente" && (
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => { setRevisionDecision(revision); setDecision("aprobada"); }}>Aprobar</Button>
          <Button variant="secondary" onClick={() => { setRevisionDecision(revision); setDecision("rechazada"); }}>Rechazar</Button>
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-sm text-accent">Historial de revisión</summary>
        {historial.isLoading && <p role="status">Cargando historial…</p>}
        {historial.isError && <p role="alert">No se pudo cargar el historial. <button className="underline" onClick={() => historial.refetch()}>Reintentar</button></p>}
        <ul className="mt-2 space-y-2 text-sm text-text-secondary">
          {historial.data?.map((h) => (
            <li key={h.id}>
              {horaLocal(h.created_at)} · {h.actor_email ?? "Sistema / edición de registro"} · {h.actual?.estado ?? "Eliminada"}
              {h.comentario && <p>{h.comentario}</p>}
            </li>
          ))}
          {historial.data?.length === 0 && <li>Sin eventos de revisión registrados.</li>}
        </ul>
      </details>
      {decision && <div className="space-y-3 rounded border border-border p-3">
        <h3 className="font-semibold">{decision === "aprobada" ? "Aprobar solicitud" : "Rechazar solicitud"}</h3>
        <p className="text-sm text-text-secondary">La decisión queda registrada con tu usuario. Solo las solicitudes aprobadas se consideran justificadas y afectan el saldo de vacaciones.</p>
        {revision !== revisionDecision && <p role="alert">La solicitud cambió. Cancelá esta decisión y revisá los datos nuevos.</p>}
        <Field label="Motivo de la decisión" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={1000} />
        <Button variant="primary" disabled={mutation.isPending || revision !== revisionDecision || comentario.trim().length < 3} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Guardando…" : "Confirmar decisión"}
        </Button>
        <Button variant="secondary" disabled={mutation.isPending} onClick={() => setDecision(null)}>Cancelar decisión</Button>
      </div>}
    </div>
  );
}

export function PendientesPanel() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["pendientes"], queryFn: ({ signal }) => getPendientesOperacion(signal),
    staleTime: 30_000, refetchInterval: 60_000,
  });
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const elegida = data?.solicitudes.find((s) => s.id === seleccion);
  if (isLoading) return <p role="status">Cargando pendientes…</p>;
  if (isError) return <p role="alert">No se pudieron cargar los pendientes. <button className="underline" onClick={() => refetch()}>Reintentar</button></p>;
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold">Solicitudes por revisar ({data?.totalSolicitudes ?? 0})</h2>
        <p className="text-sm text-text-secondary">Primero las más antiguas. Hasta 50 por vez; al resolverlas aparecen las siguientes.</p>
        {data?.solicitudes.length === 0 && <p className="mt-3 text-sm">No hay solicitudes pendientes.</p>}
        <ul className="divide-y divide-border">
          {data?.solicitudes.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><strong>{s.empleados?.nombre} {s.empleados?.apellido}</strong><p className="text-sm">{s.motivo} · {s.fecha_desde} al {s.fecha_hasta}</p></div>
              <Button variant="secondary" onClick={() => setSeleccion(s.id)}>Revisar</Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Certificados pendientes ({data?.totalCertificados ?? 0})</h2>
        <p className="text-sm text-text-secondary">El empleado puede entregarlos desde el chat. Para una entrega presencial, cargá el archivo y actualizá la ausencia en Registros.</p>
        {data?.certificados.length === 0 && <p className="mt-3 text-sm">No hay certificados pendientes.</p>}
        <ul className="divide-y divide-border">
          {data?.certificados.map((s) => <li key={s.id} className="flex justify-between gap-3 py-3 text-sm">
            <span>{s.empleados?.nombre} {s.empleados?.apellido} · {s.motivo} · {s.fecha_desde}</span>
            <Link className="text-accent underline" to={`/legajos/${s.empleado_id}`}>Abrir legajo</Link>
          </li>)}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Marcas rechazadas ({data?.marcasRechazadas ?? 0})</h2>
        <Link to="/asistencia" className="text-sm text-accent underline">Revisar en Asistencia → Rechazadas</Link>
        <p className="mt-2 text-sm text-text-secondary">Para entradas sin salida, revisá los turnos abiertos en Horas.</p>
        <Link to="/horas" className="text-sm text-accent underline">Revisar turnos abiertos</Link>
      </Card>
      <Dialog open={!!elegida} onClose={() => setSeleccion(null)} title="Revisar solicitud">
        {elegida && <div className="space-y-3">
          <p>{elegida.empleados?.nombre} {elegida.empleados?.apellido} · {elegida.motivo}</p>
          <p className="text-sm">{elegida.fecha_desde} al {elegida.fecha_hasta}</p>
          <p className="text-sm whitespace-pre-wrap">{elegida.detalle || "Sin detalle adicional."}</p>
          <p className="text-sm">{elegida.certificado_pendiente ? "Certificado pendiente" : "Sin certificado pendiente"}</p>
          <Link to={`/legajos/${elegida.empleado_id}`} className="text-sm text-accent underline">Consultar certificados en el legajo</Link>
          <RevisionSolicitud key={elegida.id} {...elegida} />
        </div>}
      </Dialog>
    </div>
  );
}
