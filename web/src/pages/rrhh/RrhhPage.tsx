import { useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { IconButton } from "../../components/ui/icon-button";
import { Status } from "../../components/ui/status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { Ausencia } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { useAusencias, useCrearAusencia, useEditarAusencia, useBorrarAusencia, useRrhhCategorias, useGuardarCategorias } from "./hooks";
import { exportarAusencias } from "../../lib/api";

const AR_TZ = "America/Argentina/Buenos_Aires";
const OTRO = "__otro__";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

const emptyForm = {
  empleado_id: "",
  sucursal_id: "",
  fecha_desde: hoyAR(),
  fecha_hasta: hoyAR(),
  motivoSeleccionado: "",
  motivoLibre: "",
  detalle: "",
  contacto: "",
  certificado_pendiente: false,
};

type FormState = typeof emptyForm;

function motivoFinal(f: FormState): string {
  return f.motivoSeleccionado === OTRO ? f.motivoLibre.trim() : f.motivoSeleccionado;
}

export default function RrhhPage() {
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursales = [] } = useSucursales();
  const { data: categoriasData } = useRrhhCategorias();
  const categorias = categoriasData?.categorias ?? [];
  const opcionesMotivo = [...categorias.map((c) => ({ value: c, label: c })), { value: OTRO, label: "Otro" }];

  const guardarCategorias = useGuardarCategorias();
  const [categoriasInput, setCategoriasInput] = useState("");
  const [categoriasGuardadoOk, setCategoriasGuardadoOk] = useState(false);
  const categoriasActuales = categoriasInput || categorias.join(", ");

  async function handleGuardarCategorias() {
    setCategoriasGuardadoOk(false);
    const nuevas = categoriasActuales
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    await guardarCategorias.mutateAsync(nuevas);
    setCategoriasInput("");
    setCategoriasGuardadoOk(true);
  }

  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [motivoFiltro, setMotivoFiltro] = useState("");
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  async function handleDescargarExcel() {
    setErrorDescarga(null);
    setDescargando(true);
    try {
      await exportarAusencias({
        desde,
        hasta,
        sucursalId: sucursalFiltro || undefined,
        motivo: motivoFiltro || undefined,
      });
    } catch {
      setErrorDescarga("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  const { data, isLoading } = useAusencias({
    desde,
    hasta,
    sucursalId: sucursalFiltro || undefined,
    motivo: motivoFiltro || undefined,
  });
  const ausencias = data?.ausencias ?? [];
  const resumen = data?.resumen;

  const crear = useCrearAusencia();
  const editar = useEditarAusencia();
  const borrar = useBorrarAusencia();

  const [altaOpen, setAltaOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({
        empleado_id: form.empleado_id,
        sucursal_id: form.sucursal_id || null,
        fecha_desde: form.fecha_desde,
        fecha_hasta: form.fecha_hasta,
        motivo: motivoFinal(form),
        detalle: form.detalle || null,
        contacto: form.contacto || null,
        certificado_pendiente: form.certificado_pendiente,
      });
      setForm(emptyForm);
      setAltaOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  function startEdit(a: Ausencia) {
    setEditandoId(a.id);
    setEditForm({
      empleado_id: a.empleado_id,
      sucursal_id: a.sucursal_id ?? "",
      fecha_desde: a.fecha_desde,
      fecha_hasta: a.fecha_hasta,
      motivoSeleccionado: categorias.includes(a.motivo) ? a.motivo : OTRO,
      motivoLibre: categorias.includes(a.motivo) ? "" : a.motivo,
      detalle: a.detalle ?? "",
      contacto: a.contacto ?? "",
      certificado_pendiente: a.certificado_pendiente,
    });
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editar.mutateAsync({
        id,
        patch: {
          sucursal_id: editForm.sucursal_id || null,
          fecha_desde: editForm.fecha_desde,
          fecha_hasta: editForm.fecha_hasta,
          motivo: motivoFinal(editForm),
          detalle: editForm.detalle || null,
          contacto: editForm.contacto || null,
          certificado_pendiente: editForm.certificado_pendiente,
        },
      });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleBorrar(id: string) {
    if (!confirm("¿Borrar esta ausencia?")) return;
    await borrar.mutateAsync(id);
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">RRHH</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <p className="text-[12px] text-text/60">Total</p>
          <p className="text-[24px] font-extrabold text-text">{resumen?.total ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-[12px] text-text/60">Certificados pendientes</p>
          <p className="text-[24px] font-extrabold text-text">{resumen?.certificadosPendientes ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-[12px] text-text/60">Por sucursal</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-text-secondary">
            {resumen &&
              Object.entries(resumen.porSucursal).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
          </ul>
        </Card>
        <Card>
          <p className="text-[12px] text-text/60">Por motivo</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-text-secondary">
            {resumen &&
              Object.entries(resumen.porMotivo).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-[16px] font-extrabold text-text">Categorías de motivo</h2>
        <p className="mt-1 text-[13.5px] text-text/60">
          Lista de motivos disponibles al cargar una ausencia, separados por coma.
        </p>
        <div className="mt-3 flex items-end gap-3">
          <Field
            label="Categorías"
            value={categoriasActuales}
            onChange={(e) => {
              setCategoriasInput(e.target.value);
              setCategoriasGuardadoOk(false);
            }}
            containerClassName="w-full max-w-[520px]"
          />
          <Button variant="secondary" onClick={handleGuardarCategorias} disabled={guardarCategorias.isPending}>
            Guardar
          </Button>
          {categoriasGuardadoOk && <span className="text-[13.5px] text-text/60">Guardado.</span>}
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Field label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-40" />
        <Field label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-40" />
        <Select
          label="Sucursal"
          value={sucursalFiltro}
          onChange={(e) => setSucursalFiltro(e.target.value)}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-48"
        />
        <Select
          label="Motivo"
          value={motivoFiltro}
          onChange={(e) => setMotivoFiltro(e.target.value)}
          options={[{ value: "", label: "Todos" }, ...categorias.map((c) => ({ value: c, label: c }))]}
          containerClassName="w-48"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={handleDescargarExcel} disabled={descargando}>
            <Download className="h-4 w-4" />
            {descargando ? "Generando…" : "Descargar Excel"}
          </Button>
          <Button variant="primary" onClick={() => setAltaOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva ausencia
          </Button>
        </div>
      </div>

      {errorDescarga && <p className="mt-2 text-[15px] text-accent-700">{errorDescarga}</p>}

      {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Certificado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            ausencias.map((a) =>
              editandoId === a.id ? (
                <TableRow key={a.id}>
                  <TableCell colSpan={6}>
                    <div className="flex flex-wrap items-end gap-3 py-2">
                      <Select
                        label="Sucursal"
                        value={editForm.sucursal_id}
                        onChange={(e) => setEditForm({ ...editForm, sucursal_id: e.target.value })}
                        options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
                        containerClassName="w-40"
                      />
                      <Field label="Desde" type="date" value={editForm.fecha_desde} onChange={(e) => setEditForm({ ...editForm, fecha_desde: e.target.value })} containerClassName="w-36" />
                      <Field label="Hasta" type="date" value={editForm.fecha_hasta} onChange={(e) => setEditForm({ ...editForm, fecha_hasta: e.target.value })} containerClassName="w-36" />
                      <Select
                        label="Motivo"
                        value={editForm.motivoSeleccionado}
                        onChange={(e) => setEditForm({ ...editForm, motivoSeleccionado: e.target.value })}
                        options={opcionesMotivo}
                        containerClassName="w-40"
                      />
                      {editForm.motivoSeleccionado === OTRO && (
                        <Field label="Motivo (otro)" value={editForm.motivoLibre} onChange={(e) => setEditForm({ ...editForm, motivoLibre: e.target.value })} containerClassName="w-40" />
                      )}
                      <Field label="Detalle" value={editForm.detalle} onChange={(e) => setEditForm({ ...editForm, detalle: e.target.value })} containerClassName="w-40" />
                      <Field label="Contacto" value={editForm.contacto} onChange={(e) => setEditForm({ ...editForm, contacto: e.target.value })} containerClassName="w-40" />
                      <label className="flex items-center gap-2 text-[14px] text-text">
                        <input
                          type="checkbox"
                          checked={editForm.certificado_pendiente}
                          onChange={(e) => setEditForm({ ...editForm, certificado_pendiente: e.target.checked })}
                          className="h-4 w-4 rounded border-border accent-accent"
                        />
                        Certificado pendiente
                      </label>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => handleGuardarEdicion(a.id)}>Guardar</Button>
                        <Button variant="ghost" onClick={() => setEditandoId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={a.id}>
                  <TableCell>{a.empleado_nombre}</TableCell>
                  <TableCell>{a.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>{a.fecha_desde === a.fecha_hasta ? a.fecha_desde : `${a.fecha_desde} – ${a.fecha_hasta}`}</TableCell>
                  <TableCell>{a.motivo}</TableCell>
                  <TableCell>{a.certificado_pendiente ? <Status tone="warning">Pendiente</Status> : "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <IconButton onClick={() => startEdit(a)} icon={<Pencil className="h-3.5 w-3.5" />} label="Editar" />
                      <IconButton onClick={() => handleBorrar(a.id)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Borrar" />
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          {!isLoading && ausencias.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">Sin ausencias en este rango.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={altaOpen} onClose={() => { setAltaOpen(false); setError(null); }} title="Nueva ausencia">
        <form onSubmit={handleAlta} className="flex flex-col gap-3">
          <Select
            label="Empleado"
            value={form.empleado_id}
            onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}
            options={[{ value: "", label: "Elegí un empleado" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
            required
          />
          <Select
            label="Sucursal (opcional)"
            value={form.sucursal_id}
            onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
            options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          />
          <div className="flex gap-3">
            <Field label="Desde" type="date" value={form.fecha_desde} onChange={(e) => setForm({ ...form, fecha_desde: e.target.value })} containerClassName="w-full" required />
            <Field label="Hasta" type="date" value={form.fecha_hasta} onChange={(e) => setForm({ ...form, fecha_hasta: e.target.value })} containerClassName="w-full" required />
          </div>
          <Select
            label="Motivo"
            value={form.motivoSeleccionado}
            onChange={(e) => setForm({ ...form, motivoSeleccionado: e.target.value })}
            options={[{ value: "", label: "Elegí un motivo" }, ...opcionesMotivo]}
            required
          />
          {form.motivoSeleccionado === OTRO && (
            <Field label="Motivo (otro)" value={form.motivoLibre} onChange={(e) => setForm({ ...form, motivoLibre: e.target.value })} containerClassName="w-full" required />
          )}
          <Field label="Detalle (opcional)" value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} containerClassName="w-full" />
          <Field label="Contacto (opcional)" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} containerClassName="w-full" />
          <label className="flex items-center gap-2 text-[14px] text-text">
            <input
              type="checkbox"
              checked={form.certificado_pendiente}
              onChange={(e) => setForm({ ...form, certificado_pendiente: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            Certificado pendiente
          </label>
          {error && <p className="text-[15px] text-accent-700">{error}</p>}
          <Button type="submit" variant="primary" block disabled={crear.isPending}>
            Agregar
          </Button>
        </form>
      </Dialog>
    </>
  );
}
