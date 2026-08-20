import { useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { IconButton } from "../../components/ui/icon-button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { HorarioEmpleado } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import {
  useHorarios,
  useCrearHorario,
  useEditarHorario,
  useBorrarHorario,
  useAsignarHorarios,
  useTurnoTemplates,
  useCrearPlantilla,
  useBorrarPlantilla,
} from "./hooks";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

const emptyForm = { dia_semana: 1, sucursal_id: "", hora_inicio: "08:00", hora_fin: "14:00", tolerancia_min: "" };
const emptyPlantillaForm = { nombre: "", hora_inicio: "08:00", hora_fin: "14:00", dias_semana: [] as number[], tolerancia_min: "" };

function ordenarHorarios(horarios: HorarioEmpleado[]): HorarioEmpleado[] {
  return [...horarios].sort(
    (a, b) => ORDEN_DIAS.indexOf(a.dia_semana) - ORDEN_DIAS.indexOf(b.dia_semana) || a.hora_inicio.localeCompare(b.hora_inicio)
  );
}

function DiaToggle({ dias, onToggle }: { dias: number[]; onToggle: (d: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ORDEN_DIAS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onToggle(d)}
          className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
            dias.includes(d) ? "border-accent bg-accent-100 text-accent-800" : "border-border text-text-secondary hover:bg-black/[.03]"
          }`}
        >
          {DIAS[d].slice(0, 3)}
        </button>
      ))}
    </div>
  );
}

export default function HorariosTab() {
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursales = [] } = useSucursales();
  const { data: templates = [] } = useTurnoTemplates();

  const [empleadoIdManual, setEmpleadoIdManual] = useState("");
  const empleadoId = empleadoIdManual || empleados[0]?.id || "";

  const { data: horarios = [], isLoading } = useHorarios(empleadoId);
  const crearHorario = useCrearHorario();
  const editarHorario = useEditarHorario();
  const borrarHorario = useBorrarHorario();
  const asignar = useAsignarHorarios();
  const crearPlantilla = useCrearPlantilla();
  const borrarPlantilla = useBorrarPlantilla();

  const [altaOpen, setAltaOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const [plantillaOpen, setPlantillaOpen] = useState(false);
  const [plantillaForm, setPlantillaForm] = useState(emptyPlantillaForm);
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null);

  const [asignEmpleados, setAsignEmpleados] = useState<string[]>([]);
  const [asignDias, setAsignDias] = useState<number[]>([]);
  const [asignHoraInicio, setAsignHoraInicio] = useState("08:00");
  const [asignHoraFin, setAsignHoraFin] = useState("14:00");
  const [asignTolerancia, setAsignTolerancia] = useState("");
  const [asignOk, setAsignOk] = useState<string | null>(null);
  const [errorAsign, setErrorAsign] = useState<string | null>(null);

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crearHorario.mutateAsync({
        empleado_id: empleadoId,
        sucursal_id: form.sucursal_id || null,
        dia_semana: form.dia_semana,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        tolerancia_min: form.tolerancia_min ? Number(form.tolerancia_min) : null,
      });
      setForm(emptyForm);
      setAltaOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  function startEdit(h: HorarioEmpleado) {
    setEditandoId(h.id);
    setEditForm({
      dia_semana: h.dia_semana,
      sucursal_id: h.sucursal_id ?? "",
      hora_inicio: h.hora_inicio,
      hora_fin: h.hora_fin,
      tolerancia_min: h.tolerancia_min?.toString() ?? "",
    });
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editarHorario.mutateAsync({
        id,
        patch: {
          sucursal_id: editForm.sucursal_id || null,
          dia_semana: editForm.dia_semana,
          hora_inicio: editForm.hora_inicio,
          hora_fin: editForm.hora_fin,
          tolerancia_min: editForm.tolerancia_min ? Number(editForm.tolerancia_min) : null,
        },
      });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleBorrar(id: string) {
    if (!confirm("¿Borrar esta franja horaria?")) return;
    await borrarHorario.mutateAsync(id);
  }

  async function handleCrearPlantilla(e: FormEvent) {
    e.preventDefault();
    setErrorPlantilla(null);
    try {
      await crearPlantilla.mutateAsync({
        nombre: plantillaForm.nombre,
        hora_inicio: plantillaForm.hora_inicio,
        hora_fin: plantillaForm.hora_fin,
        dias_semana: plantillaForm.dias_semana,
        tolerancia_min: plantillaForm.tolerancia_min ? Number(plantillaForm.tolerancia_min) : null,
      });
      setPlantillaForm(emptyPlantillaForm);
      setPlantillaOpen(false);
    } catch (err) {
      setErrorPlantilla(err instanceof Error ? err.message : "No se pudo crear la plantilla.");
    }
  }

  async function handleBorrarPlantilla(id: string) {
    if (!confirm("¿Borrar esta plantilla?")) return;
    await borrarPlantilla.mutateAsync(id);
  }

  function elegirTemplate(templateId: string) {
    const t = templates.find((t) => t.id === templateId);
    if (!t) return;
    setAsignHoraInicio(t.hora_inicio);
    setAsignHoraFin(t.hora_fin);
    if (t.dias_semana.length > 0) setAsignDias(t.dias_semana);
    if (t.tolerancia_min !== null) setAsignTolerancia(t.tolerancia_min.toString());
  }

  function toggleAsignEmpleado(id: string) {
    setAsignEmpleados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleAsignar() {
    setErrorAsign(null);
    setAsignOk(null);
    if (asignEmpleados.length === 0 || asignDias.length === 0) {
      setErrorAsign("Elegí al menos un empleado y un día.");
      return;
    }
    try {
      await asignar.mutateAsync({
        empleado_ids: asignEmpleados,
        dias_semana: asignDias,
        hora_inicio: asignHoraInicio,
        hora_fin: asignHoraFin,
        tolerancia_min: asignTolerancia ? Number(asignTolerancia) : null,
      });
      setAsignOk(`Turno asignado a ${asignEmpleados.length} empleado(s).`);
      setAsignEmpleados([]);
      setAsignDias([]);
    } catch (err) {
      setErrorAsign(err instanceof Error ? err.message : "No se pudo asignar el turno.");
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Select
          label="Empleado"
          value={empleadoId}
          onChange={(e) => setEmpleadoIdManual(e.target.value)}
          options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
          containerClassName="w-64"
        />
        <Button variant="primary" className="ml-auto" onClick={() => setAltaOpen(true)} disabled={!empleadoId}>
          <Plus className="h-4 w-4" />
          Nueva franja
        </Button>
      </div>

      {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Día</TableHead>
            <TableHead>Horario</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Tolerancia</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={5} />}
          {!isLoading &&
            ordenarHorarios(horarios).map((h) =>
              editandoId === h.id ? (
                <TableRow key={h.id}>
                  <TableCell>
                    <Select
                      label="Día"
                      value={editForm.dia_semana.toString()}
                      onChange={(e) => setEditForm({ ...editForm, dia_semana: Number(e.target.value) })}
                      options={ORDEN_DIAS.map((d) => ({ value: d.toString(), label: DIAS[d] }))}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Field label="Inicio" type="time" value={editForm.hora_inicio} onChange={(e) => setEditForm({ ...editForm, hora_inicio: e.target.value })} containerClassName="w-24" />
                      <Field label="Fin" type="time" value={editForm.hora_fin} onChange={(e) => setEditForm({ ...editForm, hora_fin: e.target.value })} containerClassName="w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      label="Sucursal"
                      value={editForm.sucursal_id}
                      onChange={(e) => setEditForm({ ...editForm, sucursal_id: e.target.value })}
                      options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
                    />
                  </TableCell>
                  <TableCell>
                    <Field label="Min." type="number" value={editForm.tolerancia_min} onChange={(e) => setEditForm({ ...editForm, tolerancia_min: e.target.value })} containerClassName="w-20" />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" onClick={() => handleGuardarEdicion(h.id)}>Guardar</Button>
                      <Button variant="ghost" onClick={() => setEditandoId(null)}>Cancelar</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={h.id}>
                  <TableCell>{DIAS[h.dia_semana]}</TableCell>
                  <TableCell>{h.hora_inicio}–{h.hora_fin}</TableCell>
                  <TableCell>{h.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>{h.tolerancia_min ?? "General"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <IconButton onClick={() => startEdit(h)} icon={<Pencil className="h-3.5 w-3.5" />} label="Editar" />
                      <IconButton onClick={() => handleBorrar(h.id)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Borrar" />
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          {!isLoading && horarios.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">Sin franjas cargadas para este empleado.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-extrabold text-text">Plantillas</h2>
          <Button variant="secondary" onClick={() => setPlantillaOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </Button>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg border border-border-soft px-3 py-2 text-[14px]">
              <span>
                <strong className="font-semibold">{t.nombre}</strong> — {t.hora_inicio}–{t.hora_fin}
                {t.dias_semana.length > 0 && ` (${t.dias_semana.map((d) => DIAS[d].slice(0, 3)).join(", ")})`}
              </span>
              <IconButton onClick={() => handleBorrarPlantilla(t.id)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Borrar plantilla" />
            </li>
          ))}
          {templates.length === 0 && <p className="text-[14px] text-text/60">Todavía no hay plantillas.</p>}
        </ul>
      </Card>

      <Card className="mt-6">
        <h2 className="text-[18px] font-extrabold text-text">Asignar turno</h2>
        <p className="mt-1 text-[13.5px] text-text/60">Asigná el mismo horario a varios empleados y días de una vez.</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {empleados.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => toggleAsignEmpleado(e.id)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                asignEmpleados.includes(e.id) ? "border-accent bg-accent-100 text-accent-800" : "border-border text-text-secondary hover:bg-black/[.03]"
              }`}
            >
              {e.nombre}
            </button>
          ))}
        </div>

        <Select
          label="Plantilla (opcional)"
          value=""
          onChange={(e) => elegirTemplate(e.target.value)}
          options={[{ value: "", label: "Sin plantilla" }, ...templates.map((t) => ({ value: t.id, label: t.nombre }))]}
          containerClassName="mt-3 w-64"
        />

        <div className="mt-3">
          <DiaToggle dias={asignDias} onToggle={(d) => setAsignDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))} />
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Hora inicio" type="time" value={asignHoraInicio} onChange={(e) => setAsignHoraInicio(e.target.value)} containerClassName="w-32" />
          <Field label="Hora fin" type="time" value={asignHoraFin} onChange={(e) => setAsignHoraFin(e.target.value)} containerClassName="w-32" />
          <Field label="Tolerancia (min, opcional)" type="number" value={asignTolerancia} onChange={(e) => setAsignTolerancia(e.target.value)} containerClassName="w-44" />
          <Button variant="primary" onClick={handleAsignar} disabled={asignar.isPending}>
            Asignar
          </Button>
        </div>

        {errorAsign && <p className="mt-2 text-[15px] text-accent-700">{errorAsign}</p>}
        {asignOk && <p className="mt-2 text-[15px] text-text">{asignOk}</p>}
      </Card>

      <Dialog open={altaOpen} onClose={() => { setAltaOpen(false); setError(null); }} title="Nueva franja horaria">
        <form onSubmit={handleAlta} className="flex flex-col gap-3">
          <Select
            label="Día"
            value={form.dia_semana.toString()}
            onChange={(e) => setForm({ ...form, dia_semana: Number(e.target.value) })}
            options={ORDEN_DIAS.map((d) => ({ value: d.toString(), label: DIAS[d] }))}
          />
          <div className="flex gap-3">
            <Field label="Hora inicio" type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} containerClassName="w-full" />
            <Field label="Hora fin" type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} containerClassName="w-full" />
          </div>
          <Select
            label="Sucursal (opcional)"
            value={form.sucursal_id}
            onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
            options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          />
          <Field label="Tolerancia en minutos (opcional)" type="number" value={form.tolerancia_min} onChange={(e) => setForm({ ...form, tolerancia_min: e.target.value })} containerClassName="w-full" />
          {error && <p className="text-[15px] text-accent-700">{error}</p>}
          <Button type="submit" variant="primary" block disabled={crearHorario.isPending}>
            Agregar
          </Button>
        </form>
      </Dialog>

      <Dialog open={plantillaOpen} onClose={() => { setPlantillaOpen(false); setErrorPlantilla(null); }} title="Nueva plantilla">
        <form onSubmit={handleCrearPlantilla} className="flex flex-col gap-3">
          <Field label="Nombre" required value={plantillaForm.nombre} onChange={(e) => setPlantillaForm({ ...plantillaForm, nombre: e.target.value })} containerClassName="w-full" />
          <div className="flex gap-3">
            <Field label="Hora inicio" type="time" value={plantillaForm.hora_inicio} onChange={(e) => setPlantillaForm({ ...plantillaForm, hora_inicio: e.target.value })} containerClassName="w-full" />
            <Field label="Hora fin" type="time" value={plantillaForm.hora_fin} onChange={(e) => setPlantillaForm({ ...plantillaForm, hora_fin: e.target.value })} containerClassName="w-full" />
          </div>
          <DiaToggle
            dias={plantillaForm.dias_semana}
            onToggle={(d) =>
              setPlantillaForm((prev) => ({
                ...prev,
                dias_semana: prev.dias_semana.includes(d) ? prev.dias_semana.filter((x) => x !== d) : [...prev.dias_semana, d],
              }))
            }
          />
          <Field label="Tolerancia en minutos (opcional)" type="number" value={plantillaForm.tolerancia_min} onChange={(e) => setPlantillaForm({ ...plantillaForm, tolerancia_min: e.target.value })} containerClassName="w-full" />
          {errorPlantilla && <p className="text-[15px] text-accent-700">{errorPlantilla}</p>}
          <Button type="submit" variant="primary" block disabled={crearPlantilla.isPending}>
            Crear plantilla
          </Button>
        </form>
      </Dialog>
    </>
  );
}
