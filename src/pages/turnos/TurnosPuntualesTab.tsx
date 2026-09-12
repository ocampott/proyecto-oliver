import { useState, type FormEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { TurnoPuntual } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { useTurnosPuntuales, useCrearTurnoPuntual, useBorrarTurnoPuntual } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

export default function TurnosPuntualesTab() {
  const toast = useToast();
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];

  const [empleadoFiltro, setEmpleadoFiltro] = useState("");
  const { data: turnos = [], isLoading, isError } = useTurnosPuntuales({ empleadoId: empleadoFiltro || undefined });

  const [modalOpen, setModalOpen] = useState(false);
  const [formEmpleadoId, setFormEmpleadoId] = useState("");
  const [formSucursalId, setFormSucursalId] = useState("");
  const [formFecha, setFormFecha] = useState(hoyAR());
  const [formHoraInicio, setFormHoraInicio] = useState("09:00");
  const [formHoraFin, setFormHoraFin] = useState("17:00");
  const [formTolerancia, setFormTolerancia] = useState("");
  const [formNota, setFormNota] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<TurnoPuntual | null>(null);

  const crear = useCrearTurnoPuntual();
  const borrar = useBorrarTurnoPuntual();

  function abrirCrear() {
    setFormEmpleadoId(empleados[0]?.id ?? "");
    setFormSucursalId("");
    setFormFecha(hoyAR());
    setFormHoraInicio("09:00");
    setFormHoraFin("17:00");
    setFormTolerancia("");
    setFormNota("");
    setFormError(null);
    setModalOpen(true);
  }

  async function handleCrear(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await crear.mutateAsync({
        empleado_id: formEmpleadoId,
        sucursal_id: formSucursalId || null,
        fecha: formFecha,
        hora_inicio: formHoraInicio,
        hora_fin: formHoraFin,
        tolerancia_min: formTolerancia ? Number(formTolerancia) : null,
        nota: formNota.trim() || null,
      });
      toast.success("Turno puntual cargado.");
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el turno puntual.");
    }
  }

  async function handleBorrar() {
    if (!borrarTarget) return;
    try {
      await borrar.mutateAsync(borrarTarget.id);
      toast.success("Turno puntual borrado.");
      setBorrarTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el turno puntual.");
    }
  }

  return (
    <>
      <p className="text-[14px] text-text-secondary">
        Turno de una fecha exacta (ej. "domingo por medio") que se suma al horario semanal del empleado sin
        reemplazarlo — cuenta para cumplimiento, inasistencias y liquidación igual que un horario recurrente.
      </p>

      <Toolbar className="mt-3">
        <Select
          label="Empleado"
          compact
          value={empleadoFiltro}
          onChange={(e) => setEmpleadoFiltro(e.target.value)}
          options={[{ value: "", label: "Todos" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
          containerClassName="w-44"
        />
        <Button variant="primary" onClick={abrirCrear} className="ml-auto">
          <Plus className="h-4 w-4" />
          Nuevo turno puntual
        </Button>
      </Toolbar>

      {isError && <p className="mt-2 text-[15px] text-alert">No se pudieron cargar los turnos puntuales. Probá de nuevo.</p>}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Horario</TableHead>
            <TableHead>Nota</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            turnos.map((t) => {
              const empleado = empleados.find((e) => e.id === t.empleado_id);
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.fecha}</TableCell>
                  <TableCell>{empleado?.nombre ?? "—"}</TableCell>
                  <TableCell>{t.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell className="font-mono text-[13px] text-text-secondary">
                    {t.hora_inicio} – {t.hora_fin}
                    {t.tolerancia_min !== null && <span className="text-text-tertiary"> (tolerancia {t.tolerancia_min}min)</span>}
                  </TableCell>
                  <TableCell className="text-text-secondary">{t.nota ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="default" onClick={() => setBorrarTarget(t)}>
                      Borrar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          {!isLoading && !isError && turnos.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-text-tertiary">
                No hay turnos puntuales cargados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo turno puntual">
        <form onSubmit={handleCrear} className="flex flex-col gap-3">
          <Select
            label="Empleado"
            required
            value={formEmpleadoId}
            onChange={(e) => setFormEmpleadoId(e.target.value)}
            options={empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))}
            containerClassName="w-full"
          />
          <Select
            label="Sucursal (opcional)"
            value={formSucursalId}
            onChange={(e) => setFormSucursalId(e.target.value)}
            options={[{ value: "", label: "Sin asignar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
            containerClassName="w-full"
          />
          <Field
            label="Fecha"
            required
            type="date"
            value={formFecha}
            onChange={(e) => setFormFecha(e.target.value)}
            containerClassName="w-full"
          />
          <div className="flex gap-2">
            <Field
              label="Hora inicio"
              required
              type="time"
              value={formHoraInicio}
              onChange={(e) => setFormHoraInicio(e.target.value)}
              containerClassName="w-full"
            />
            <Field
              label="Hora fin"
              required
              type="time"
              value={formHoraFin}
              onChange={(e) => setFormHoraFin(e.target.value)}
              containerClassName="w-full"
            />
          </div>
          <Field
            label="Tolerancia en minutos (opcional)"
            type="number"
            min="0"
            value={formTolerancia}
            onChange={(e) => setFormTolerancia(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Nota (opcional)"
            value={formNota}
            onChange={(e) => setFormNota(e.target.value)}
            containerClassName="w-full"
          />
          {formError && <p className="text-[15px] text-alert">{formError}</p>}
          <Button type="submit" variant="primary" block disabled={crear.isPending || !formEmpleadoId}>
            {crear.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Cargar turno
          </Button>
        </form>
      </Dialog>

      <Dialog open={borrarTarget != null} onClose={() => setBorrarTarget(null)} title="Borrar turno puntual">
        <p className="text-[15px] text-text-secondary">
          ¿Borrar el turno puntual del <strong>{borrarTarget?.fecha}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBorrarTarget(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleBorrar} disabled={borrar.isPending}>
            {borrar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Borrar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
