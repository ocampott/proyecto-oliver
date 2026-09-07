import { ContextHelp } from "../../components/ui/context-help";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cerrarLiquidacion, getCierre, getCierres, type LiquidacionResponse } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { Field } from "../../components/ui/field";
import { useToast } from "../../components/ui/toast";
import { formatMoneda, horaLocal } from "../../lib/format";

export function CierresPanel({ actual, bloqueado }: { actual?: LiquidacionResponse; bloqueado: boolean }) {
  const [open, setOpen] = useState(false);
  const [paraCerrar, setParaCerrar] = useState<LiquidacionResponse | null>(null);
  const [nota, setNota] = useState("");
  const [revisado, setRevisado] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  const cierres = useQuery({ queryKey: ["cierres"], queryFn: ({ signal }) => getCierres(signal), staleTime: 0 });
  const detalle = useQuery({
    queryKey: ["cierre", seleccion], queryFn: ({ signal }) => getCierre(seleccion!, signal),
    enabled: !!seleccion, staleTime: 0, refetchInterval: 60_000,
  });
  const guardar = useMutation({
    mutationFn: () => cerrarLiquidacion({ desde: paraCerrar!.desde, hasta: paraCerrar!.hasta, revision: paraCerrar!.revision, nota: nota.trim() }),
    onSuccess: async ({ id }) => {
      setOpen(false); setNota(""); setRevisado(false); setSeleccion(id);
      await queryClient.invalidateQueries({ queryKey: ["cierres"] });
      toast.success("Cierre guardado. Los cambios futuros no alteran esta copia.");
    },
    onError: async (error) => {
      toast.error(error.message); setOpen(false); setRevisado(false);
      await queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
    },
  });
  const hoy = new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
  const puedeCerrar = !bloqueado && actual && actual.filas.length > 0 && actual.hasta < hoy && !actual.filas.some((f) => f.horas_en_curso);
  function descargar() {
    if (!detalle.data) return;
    const { cambios: _cambios, hayCambios: _hayCambios, ...copia } = detalle.data;
    const url = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `cierre_${copia.desde}_${copia.hasta}_${copia.id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">Cierres de período</h2><p className="text-sm text-text-secondary">Copias inmutables de toda la organización. Hasta 50 cierres recientes.</p></div>
        <Button variant="secondary" disabled={!puedeCerrar} onClick={() => { setRevisado(false); setParaCerrar(actual!); setOpen(true); }}>Cerrar período</Button>
      </div>
      {!puedeCerrar && <p className="mt-2 text-sm text-text-secondary">El cierre requiere un período completo anterior a hoy, sin filtro de empleados ni turnos abiertos.</p>}
      <ContextHelp label="¿Qué guarda un cierre y qué tengo que revisar?">Quitá el filtro de empleados y resolvé las marcas abiertas y solicitudes pendientes antes de cerrar. Se conserva una copia de los importes: podés seguir corrigiendo datos y generar otra versión. No es un recibo de sueldo.</ContextHelp>
      {cierres.isLoading && <p role="status">Cargando cierres…</p>}
      {cierres.isError && <p role="alert">No se pudieron cargar los cierres. <button className="underline" onClick={() => cierres.refetch()}>Reintentar</button></p>}
      <ul className="mt-3 divide-y divide-border">
        {cierres.data?.map((c) => <li key={c.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
          <span>{c.desde} al {c.hasta} · {horaLocal(c.created_at)} · {c.actor_email ?? "Administración"}</span>
          <button className="text-accent underline" onClick={() => setSeleccion(c.id)}>Ver copia e historial</button>
        </li>)}
        {cierres.data?.length === 0 && <li className="text-sm">Todavía no hay cierres.</li>}
      </ul>
      <Dialog open={open} onClose={() => { if (!guardar.isPending) setOpen(false); }} title="Confirmar cierre de período">
        <p className="text-sm">Se conservará la liquidación del {paraCerrar?.desde} al {paraCerrar?.hasta}. No es un recibo de sueldo ni bloquea cambios posteriores.</p>
        {actual?.revision !== paraCerrar?.revision && <p role="alert">Los datos cambiaron. Cerrá esta ventana y revisá la liquidación actualizada.</p>}
        <Field label="Nota de revisión" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} />
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={revisado} onChange={(e) => setRevisado(e.target.checked)} />Revisé los importes y las advertencias de todos los empleados.</label>
        <Button variant="primary" disabled={!puedeCerrar || actual?.revision !== paraCerrar?.revision || !revisado || nota.trim().length < 3 || guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending ? "Guardando…" : "Guardar cierre"}
        </Button>
      </Dialog>
      <Dialog open={!!seleccion} onClose={() => setSeleccion(null)} title="Copia del cierre">
        {detalle.isLoading && <p role="status">Cargando copia…</p>}
        {detalle.isError && <p role="alert">No se pudo cargar. <button onClick={() => detalle.refetch()} className="underline">Reintentar</button></p>}
        {detalle.data && <>
          <p className="text-sm">{detalle.data.desde} al {detalle.data.hasta} · {detalle.data.actor_email}</p>
          <p className="text-sm">{detalle.data.nota}</p>
          <p className="font-semibold">Total guardado: {formatMoneda(detalle.data.snapshot.filas.reduce((sum, f) => sum + f.total, 0))}</p>
          {detalle.data.hayCambios && <p role="status" className="text-sm text-warning">Hubo cambios en la organización desde este cierre. Esta copia no cambió; los cambios pueden corresponder a otros períodos.</p>}
          <ul className="max-h-64 overflow-auto divide-y divide-border text-sm">
            {detalle.data.snapshot.filas.map((f) => <li key={f.empleado_id} className="py-2">
              <span className="font-medium">{f.nombre} · {formatMoneda(f.total)}</span>
              {f.advertencias.map((a, i) => <p key={i} className="text-warning">{a}</p>)}
            </li>)}
          </ul>
          <details><summary className="cursor-pointer text-sm">Cambios posteriores (hasta 100)</summary>
            <ul className="max-h-40 overflow-auto text-xs">{detalle.data.cambios.map((c) => <li key={c.id}>{horaLocal(c.created_at)} · {c.tabla} · {c.accion} · {c.registro_id}</li>)}</ul>
          </details>
          <Button variant="secondary" onClick={descargar}>Descargar copia completa (JSON)</Button>
        </>}
      </Dialog>
    </Card>
  );
}
