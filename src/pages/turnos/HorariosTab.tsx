import { useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { MultiSelect } from "../../components/ui/multi-select";
import { IconButton } from "../../components/ui/icon-button";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { type HorarioEmpleado, type TurnoTemplate, type Empleado, type Sucursal } from "../../lib/api";
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
  useEditarPlantilla,
  useBorrarPlantilla,
  useHorariosDeVarios,
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
          aria-pressed={dias.includes(d)}
          onClick={() => onToggle(d)}
          className={`rounded-md border px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] transition-colors ${
            dias.includes(d) ? "border-accent bg-accent-100 text-accent-800" : "border-border text-text-secondary hover:bg-text/[.04]"
          }`}
        >
          {DIAS[d].slice(0, 3)}
        </button>
      ))}
    </div>
  );
}

function HorariosOverview({
  empleados,
  sucursales,
  onSelectEmpleado,
}: {
  empleados: Empleado[];
  sucursales: Sucursal[];
  onSelectEmpleado: (id: string) => void;
}) {
  const horariosQueries = useHorariosDeVarios(empleados.map((e) => e.id));
  const cargando = horariosQueries.some((q) => q.isLoading);
  const sucursalNombre = new Map(sucursales.map((s) => [s.id, s.nombre]));

  const filas = empleados.map((e, i) => {
    const horarios = horariosQueries[i]?.data ?? [];
    return {
      empleado: e,
      horarios,
      diasConBloque: new Set(horarios.map((h) => h.dia_semana)),
      sucursal: e.sucursal_id ? (sucursalNombre.get(e.sucursal_id) ?? "—") : "—",
    };
  });

  const activosSinHorario = filas.filter((f) => f.empleado.estado === "activo" && f.horarios.length === 0);

  return (
    <Card className="mb-6">
      <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-text">Horarios por empleado</h2>
      {activosSinHorario.length > 0 && (
        <p className="mt-1 text-[13px] text-warning">
          {activosSinHorario.length} empleado{activosSinHorario.length === 1 ? "" : "s"} activo
          {activosSinHorario.length === 1 ? "" : "s"} sin horario cargado.
        </p>
      )}
      <Table containerClassName="mt-3">
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Semana</TableHead>
            <TableHead>Días</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando && <TableSkeleton cols={4} />}
          {!cargando &&
            filas.map((f) => (
              <TableRow
                key={f.empleado.id}
                className="cursor-pointer"
                onClick={() => onSelectEmpleado(f.empleado.id)}
              >
                <TableCell className="relative">
                  {f.empleado.nombre}
                  {/* Sin onClick: el click nativo del botón (mouse, Enter o
                      Espacio) burbujea al onClick de la fila. */}
                  <button
                    type="button"
                    className="absolute inset-0"
                    aria-label={`Ver horario de ${f.empleado.nombre}`}
                  />
                </TableCell>
                <TableCell>{f.sucursal}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {ORDEN_DIAS.map((d) => (
                      <span
                        key={d}
                        title={DIAS[d]}
                        className={`flex h-5 w-5 items-center justify-center rounded-[4px] font-mono text-[9px] uppercase ${
                          f.diasConBloque.has(d) ? "bg-accent-100 text-accent-800" : "bg-text/[.04] text-text-tertiary"
                        }`}
                      >
                        {DIAS[d].slice(0, 1)}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{f.diasConBloque.size}</TableCell>
              </TableRow>
            ))}
          {!cargando && filas.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-text-tertiary">Sin empleados cargados.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function HorariosTab() {
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const { data: templates = [] } = useTurnoTemplates();
  const toast = useToast();

  const [empleadoIdManual, setEmpleadoIdManual] = useState("");
  const empleadoId = empleadoIdManual || empleados[0]?.id || "";

  const { data: horarios = [], isLoading } = useHorarios(empleadoId);
  const crearHorario = useCrearHorario();
  const editarHorario = useEditarHorario();
  const borrarHorario = useBorrarHorario();
  const asignar = useAsignarHorarios();
  const crearPlantilla = useCrearPlantilla();
  const editarPlantilla = useEditarPlantilla();
  const borrarPlantilla = useBorrarPlantilla();

  const [altaOpen, setAltaOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<HorarioEmpleado | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<HorarioEmpleado | null>(null);

  const [plantillaOpen, setPlantillaOpen] = useState(false);
  const [plantillaForm, setPlantillaForm] = useState(emptyPlantillaForm);
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null);

  const [editandoPlantilla, setEditandoPlantilla] = useState<TurnoTemplate | null>(null);
  const [editPlantillaForm, setEditPlantillaForm] = useState(emptyPlantillaForm);
  const [errorEditPlantilla, setErrorEditPlantilla] = useState<string | null>(null);
  const [borrarPlantillaTarget, setBorrarPlantillaTarget] = useState<TurnoTemplate | null>(null);

  const [asignOpen, setAsignOpen] = useState(false);
  const [asignTodos, setAsignTodos] = useState(false);
  const [asignEmpleados, setAsignEmpleados] = useState<string[]>([]);
  const [asignDias, setAsignDias] = useState<number[]>([]);
  const [asignHoraInicio, setAsignHoraInicio] = useState("08:00");
  const [asignHoraFin, setAsignHoraFin] = useState("14:00");
  const [asignTolerancia, setAsignTolerancia] = useState("");
  const [errorAsign, setErrorAsign] = useState<string | null>(null);

  function resetAsignForm() {
    setAsignTodos(false);
    setAsignEmpleados([]);
    setAsignDias([]);
    setAsignHoraInicio("08:00");
    setAsignHoraFin("14:00");
    setAsignTolerancia("");
    setErrorAsign(null);
  }

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
      toast.success("Franja horaria agregada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  function abrirEdicion(h: HorarioEmpleado) {
    setErrorEdit(null);
    setEditando(h);
    setEditForm({
      dia_semana: h.dia_semana,
      sucursal_id: h.sucursal_id ?? "",
      hora_inicio: h.hora_inicio,
      hora_fin: h.hora_fin,
      tolerancia_min: h.tolerancia_min?.toString() ?? "",
    });
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setErrorEdit(null);
    try {
      await editarHorario.mutateAsync({
        id: editando.id,
        patch: {
          sucursal_id: editForm.sucursal_id || null,
          dia_semana: editForm.dia_semana,
          hora_inicio: editForm.hora_inicio,
          hora_fin: editForm.hora_fin,
          tolerancia_min: editForm.tolerancia_min ? Number(editForm.tolerancia_min) : null,
        },
      });
      setEditando(null);
      toast.success("Franja horaria actualizada.");
    } catch (err) {
      setErrorEdit(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleBorrar() {
    if (!borrarTarget) return;
    try {
      await borrarHorario.mutateAsync(borrarTarget.id);
      toast.success("Franja horaria borrada.");
      setBorrarTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar la franja.");
    }
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
      toast.success("Plantilla creada.");
    } catch (err) {
      setErrorPlantilla(err instanceof Error ? err.message : "No se pudo crear la plantilla.");
    }
  }

  function abrirEdicionPlantilla(t: TurnoTemplate) {
    setErrorEditPlantilla(null);
    setEditandoPlantilla(t);
    setEditPlantillaForm({
      nombre: t.nombre,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      dias_semana: t.dias_semana,
      tolerancia_min: t.tolerancia_min?.toString() ?? "",
    });
  }

  async function handleGuardarPlantilla(e: FormEvent) {
    e.preventDefault();
    if (!editandoPlantilla) return;
    setErrorEditPlantilla(null);
    try {
      await editarPlantilla.mutateAsync({
        id: editandoPlantilla.id,
        patch: {
          nombre: editPlantillaForm.nombre,
          hora_inicio: editPlantillaForm.hora_inicio,
          hora_fin: editPlantillaForm.hora_fin,
          dias_semana: editPlantillaForm.dias_semana,
          tolerancia_min: editPlantillaForm.tolerancia_min ? Number(editPlantillaForm.tolerancia_min) : null,
        },
      });
      setEditandoPlantilla(null);
      toast.success("Plantilla actualizada.");
    } catch (err) {
      setErrorEditPlantilla(err instanceof Error ? err.message : "No se pudo editar la plantilla.");
    }
  }

  async function handleBorrarPlantilla() {
    if (!borrarPlantillaTarget) return;
    try {
      await borrarPlantilla.mutateAsync(borrarPlantillaTarget.id);
      toast.success("Plantilla borrada.");
      setBorrarPlantillaTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar la plantilla.");
    }
  }

  function elegirTemplate(templateId: string) {
    const t = templates.find((t) => t.id === templateId);
    if (!t) return;
    setAsignHoraInicio(t.hora_inicio);
    setAsignHoraFin(t.hora_fin);
    if (t.dias_semana.length > 0) setAsignDias(t.dias_semana);
    if (t.tolerancia_min !== null) setAsignTolerancia(t.tolerancia_min.toString());
  }

  async function handleAsignar(e: FormEvent) {
    e.preventDefault();
    setErrorAsign(null);
    const empleadoIds = asignTodos ? empleados.map((emp) => emp.id) : asignEmpleados;
    if (empleadoIds.length === 0 || asignDias.length === 0) {
      setErrorAsign("Elegí al menos un empleado y un día.");
      return;
    }
    try {
      await asignar.mutateAsync({
        empleado_ids: empleadoIds,
        dias_semana: asignDias,
        hora_inicio: asignHoraInicio,
        hora_fin: asignHoraFin,
        tolerancia_min: asignTolerancia ? Number(asignTolerancia) : null,
      });
      toast.success(
        empleadoIds.length === 1 ? "Turno asignado." : `Turno asignado a ${empleadoIds.length} empleados.`
      );
      resetAsignForm();
      setAsignOpen(false);
    } catch (err) {
      setErrorAsign(err instanceof Error ? err.message : "No se pudo asignar el turno.");
    }
  }

  return (
    <>
      <HorariosOverview empleados={empleados} sucursales={sucursales} onSelectEmpleado={setEmpleadoIdManual} />

      <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-text">Detalle por empleado</h2>

      <div className="page-filters">
        <Select
          label="Empleado"
          compact
          value={empleadoId}
          onChange={(e) => setEmpleadoIdManual(e.target.value)}
          options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
          containerClassName="w-64"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setAsignOpen(true)}>
            <Users className="h-4 w-4" />
            Asignar a varios empleados
          </Button>
          <Button variant="primary" onClick={() => setAltaOpen(true)} disabled={!empleadoId}>
            <Plus className="h-4 w-4" />
            Franja individual
          </Button>
        </div>
      </div>

      {error && <p className="mt-2 text-[15px] text-alert">{error}</p>}

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
            ordenarHorarios(horarios).map((h) => (
              <TableRow key={h.id}>
                <TableCell>{DIAS[h.dia_semana]}</TableCell>
                <TableCell>{h.hora_inicio}–{h.hora_fin}</TableCell>
                <TableCell>{h.sucursal_nombre ?? "—"}</TableCell>
                <TableCell>{h.tolerancia_min ?? "General"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <IconButton onClick={() => abrirEdicion(h)} icon={<Pencil className="h-3.5 w-3.5" />} label="Editar" />
                    <IconButton onClick={() => setBorrarTarget(h)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Borrar" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && horarios.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text-tertiary">Sin franjas cargadas para este empleado.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-text">Plantillas</h2>
            <p className="mt-0.5 text-[13px] text-text-secondary">
              Horarios guardados para no tipearlos de nuevo al asignar un turno a varios empleados.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setPlantillaOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </Button>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-[4px] border border-border-soft px-3 py-2 text-[14px]">
              <span>
                <strong className="font-semibold">{t.nombre}</strong> — {t.hora_inicio}–{t.hora_fin}
                {t.dias_semana.length > 0 && ` (${t.dias_semana.map((d) => DIAS[d].slice(0, 3)).join(", ")})`}
              </span>
              <div className="flex gap-1">
                <IconButton onClick={() => abrirEdicionPlantilla(t)} icon={<Pencil className="h-3.5 w-3.5" />} label="Editar plantilla" />
                <IconButton onClick={() => setBorrarPlantillaTarget(t)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Borrar plantilla" />
              </div>
            </li>
          ))}
          {templates.length === 0 && <p className="text-[14px] text-text-tertiary">Todavía no hay plantillas.</p>}
        </ul>
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
          {error && <p className="text-[15px] text-alert">{error}</p>}
          <Button type="submit" variant="primary" block disabled={crearHorario.isPending}>
            Agregar
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={editando != null}
        onClose={() => { setEditando(null); setErrorEdit(null); }}
        title="Editar franja horaria"
      >
        <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-3">
          <Select
            label="Día"
            value={editForm.dia_semana.toString()}
            onChange={(e) => setEditForm({ ...editForm, dia_semana: Number(e.target.value) })}
            options={ORDEN_DIAS.map((d) => ({ value: d.toString(), label: DIAS[d] }))}
          />
          <div className="flex gap-3">
            <Field label="Hora inicio" type="time" value={editForm.hora_inicio} onChange={(e) => setEditForm({ ...editForm, hora_inicio: e.target.value })} containerClassName="w-full" />
            <Field label="Hora fin" type="time" value={editForm.hora_fin} onChange={(e) => setEditForm({ ...editForm, hora_fin: e.target.value })} containerClassName="w-full" />
          </div>
          <Select
            label="Sucursal (opcional)"
            value={editForm.sucursal_id}
            onChange={(e) => setEditForm({ ...editForm, sucursal_id: e.target.value })}
            options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          />
          <Field label="Tolerancia en minutos (opcional)" type="number" value={editForm.tolerancia_min} onChange={(e) => setEditForm({ ...editForm, tolerancia_min: e.target.value })} containerClassName="w-full" />
          {errorEdit && <p className="text-[15px] text-alert">{errorEdit}</p>}
          <Button type="submit" variant="primary" block disabled={editarHorario.isPending}>
            Guardar
          </Button>
        </form>
      </Dialog>

      <Dialog open={borrarTarget != null} onClose={() => setBorrarTarget(null)} title="Borrar franja horaria">
        <p className="text-[15px] text-text-secondary">
          ¿Borrar la franja de <strong>{borrarTarget ? DIAS[borrarTarget.dia_semana] : ""}</strong>{" "}
          {borrarTarget?.hora_inicio}–{borrarTarget?.hora_fin}?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBorrarTarget(null)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleBorrar} disabled={borrarHorario.isPending}>
            {borrarHorario.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Borrar
          </Button>
        </div>
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
          {errorPlantilla && <p className="text-[15px] text-alert">{errorPlantilla}</p>}
          <Button type="submit" variant="primary" block disabled={crearPlantilla.isPending}>
            Crear plantilla
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={editandoPlantilla != null}
        onClose={() => { setEditandoPlantilla(null); setErrorEditPlantilla(null); }}
        title="Editar plantilla"
      >
        <form onSubmit={handleGuardarPlantilla} className="flex flex-col gap-3">
          <Field label="Nombre" required value={editPlantillaForm.nombre} onChange={(e) => setEditPlantillaForm({ ...editPlantillaForm, nombre: e.target.value })} containerClassName="w-full" />
          <div className="flex gap-3">
            <Field label="Hora inicio" type="time" value={editPlantillaForm.hora_inicio} onChange={(e) => setEditPlantillaForm({ ...editPlantillaForm, hora_inicio: e.target.value })} containerClassName="w-full" />
            <Field label="Hora fin" type="time" value={editPlantillaForm.hora_fin} onChange={(e) => setEditPlantillaForm({ ...editPlantillaForm, hora_fin: e.target.value })} containerClassName="w-full" />
          </div>
          <DiaToggle
            dias={editPlantillaForm.dias_semana}
            onToggle={(d) =>
              setEditPlantillaForm((prev) => ({
                ...prev,
                dias_semana: prev.dias_semana.includes(d) ? prev.dias_semana.filter((x) => x !== d) : [...prev.dias_semana, d],
              }))
            }
          />
          <Field label="Tolerancia en minutos (opcional)" type="number" value={editPlantillaForm.tolerancia_min} onChange={(e) => setEditPlantillaForm({ ...editPlantillaForm, tolerancia_min: e.target.value })} containerClassName="w-full" />
          {errorEditPlantilla && <p className="text-[15px] text-alert">{errorEditPlantilla}</p>}
          <Button type="submit" variant="primary" block disabled={editarPlantilla.isPending}>
            Guardar
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={borrarPlantillaTarget != null}
        onClose={() => setBorrarPlantillaTarget(null)}
        title="Borrar plantilla"
      >
        <p className="text-[15px] text-text-secondary">
          ¿Borrar la plantilla <strong>{borrarPlantillaTarget?.nombre}</strong>? Los turnos ya asignados con
          esta plantilla no se modifican.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBorrarPlantillaTarget(null)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleBorrarPlantilla} disabled={borrarPlantilla.isPending}>
            {borrarPlantilla.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Borrar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={asignOpen}
        onClose={() => { setAsignOpen(false); resetAsignForm(); }}
        title="Asignar turno a varios empleados"
        className="max-w-[500px]"
      >
        <p className="-mt-1 text-[13.5px] text-text-secondary">
          Carga el mismo horario para todos los días y empleados que elijas de una sola vez — la forma
          recomendada de armar franjas generales (por ejemplo, el horario de apertura para todo el equipo).
        </p>
        <form onSubmit={handleAsignar} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-[14px] text-text">
            <input
              type="checkbox"
              checked={asignTodos}
              onChange={(e) => setAsignTodos(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            Aplicar a todos los empleados ({empleados.length})
          </label>
          {!asignTodos && (
            <MultiSelect
              label="Empleados"
              value={asignEmpleados}
              onChange={setAsignEmpleados}
              options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
              placeholder="Elegí empleados"
            />
          )}
          <Select
            label="Plantilla (opcional)"
            value=""
            onChange={(e) => elegirTemplate(e.target.value)}
            options={[{ value: "", label: "Sin plantilla" }, ...templates.map((t) => ({ value: t.id, label: t.nombre }))]}
          />
          <div className="flex flex-col gap-[5px]">
            <span className="text-[12px] text-text-secondary">Días</span>
            <DiaToggle dias={asignDias} onToggle={(d) => setAsignDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))} />
          </div>
          <div className="flex gap-3">
            <Field label="Hora inicio" type="time" value={asignHoraInicio} onChange={(e) => setAsignHoraInicio(e.target.value)} containerClassName="w-full" />
            <Field label="Hora fin" type="time" value={asignHoraFin} onChange={(e) => setAsignHoraFin(e.target.value)} containerClassName="w-full" />
          </div>
          <Field label="Tolerancia en minutos (opcional)" type="number" value={asignTolerancia} onChange={(e) => setAsignTolerancia(e.target.value)} containerClassName="w-full" />
          {errorAsign && <p className="text-[15px] text-alert">{errorAsign}</p>}
          <Button type="submit" variant="primary" block disabled={asignar.isPending}>
            Asignar
          </Button>
        </form>
      </Dialog>
    </>
  );
}
