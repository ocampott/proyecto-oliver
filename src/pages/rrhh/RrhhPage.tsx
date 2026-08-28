import { useState, type FormEvent } from "react";
import { Plus, Trash2, Download, X, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { SidePanel } from "../../components/ui/side-panel";
import { IconButton } from "../../components/ui/icon-button";
import { useToast } from "../../components/ui/toast";
import { Status } from "../../components/ui/status";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
import { PersonCell } from "../../components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/PageHeader";
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

function finDeMesAR(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return `${periodo}-${String(ultimoDia).padStart(2, "0")}`;
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000) + 1;
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

type Vista = "registros" | "categorias";

export default function RrhhPage() {
  const toast = useToast();
  const [vista, setVista] = useState<Vista>("registros");
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const { data: categoriasData } = useRrhhCategorias();
  const categorias = categoriasData?.categorias ?? [];
  const opcionesMotivo = [...categorias.map((c) => ({ value: c, label: c })), { value: OTRO, label: "Otro" }];

  const guardarCategorias = useGuardarCategorias();
  const [categoriaModalOpen, setCategoriaModalOpen] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [errorCategoria, setErrorCategoria] = useState<string | null>(null);
  const [quitandoCategoria, setQuitandoCategoria] = useState<string | null>(null);

  async function handleAgregarCategoria(e: FormEvent) {
    e.preventDefault();
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    if (categorias.some((c) => c.toLowerCase() === nombre.toLowerCase())) {
      setErrorCategoria("Esa categoría ya existe.");
      return;
    }
    setErrorCategoria(null);
    try {
      await guardarCategorias.mutateAsync([...categorias, nombre]);
      setNuevaCategoria("");
      setCategoriaModalOpen(false);
      toast.success("Categoría agregada.");
    } catch (err) {
      setErrorCategoria(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleQuitarCategoria(nombre: string) {
    setQuitandoCategoria(nombre);
    try {
      await guardarCategorias.mutateAsync(categorias.filter((c) => c !== nombre));
      toast.success("Categoría quitada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo quitar la categoría.");
    } finally {
      setQuitandoCategoria(null);
    }
  }

  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [periodo, setPeriodo] = useState(hoyAR().slice(0, 7));
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [motivoFiltro, setMotivoFiltro] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [descargando, setDescargando] = useState(false);

  function handlePeriodoChange(nuevoPeriodo: string) {
    setPeriodo(nuevoPeriodo);
    if (nuevoPeriodo) {
      setDesde(`${nuevoPeriodo}-01`);
      setHasta(finDeMesAR(nuevoPeriodo));
    }
    setPage(1);
  }

  async function handleDescargarExcel() {
    setDescargando(true);
    try {
      await exportarAusencias({
        desde,
        hasta,
        sucursalId: sucursalFiltro || undefined,
        motivo: motivoFiltro || undefined,
      });
      toast.success("Excel descargado.");
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  const { data, isLoading } = useAusencias({
    desde,
    hasta,
    sucursalId: sucursalFiltro || undefined,
    motivo: motivoFiltro || undefined,
    page,
    pageSize,
  });
  const ausencias = data?.ausencias ?? [];
  const resumen = data?.resumen;

  // Sin page/pageSize: el backend devuelve el set completo sin paginar
  // cuando ninguno de los dos viene en la query (routes/rrhh.ts) — así
  // los 3 stats que "resumen" no trae del servidor (en curso/programadas/
  // días) salen bien sobre el total filtrado, no solo una página.
  const { data: statsData } = useAusencias({
    desde,
    hasta,
    sucursalId: sucursalFiltro || undefined,
    motivo: motivoFiltro || undefined,
  });
  const statsAusencias = statsData?.ausencias ?? [];
  const hoy = hoyAR();
  const enCursoCount = statsAusencias.filter((a) => a.fecha_desde <= hoy && a.fecha_hasta >= hoy).length;
  const programadasCount = statsAusencias.filter((a) => a.fecha_desde > hoy).length;
  const diasAcumulados = statsAusencias.reduce((acc, a) => acc + diasEntre(a.fecha_desde, a.fecha_hasta), 0);

  const stats: StatRowItem[] = [
    { label: "En curso hoy", value: enCursoCount },
    { label: "Programadas", value: programadasCount, meta: "próximas a comenzar" },
    {
      label: "Certificados pendientes",
      value: resumen?.certificadosPendientes ?? 0,
      tone: (resumen?.certificadosPendientes ?? 0) > 0 ? "warning" : "default",
    },
    { label: "Días acumulados", value: diasAcumulados, meta: "en el período filtrado" },
  ];

  const filtrosActivos = sucursalFiltro !== "" || motivoFiltro !== "";

  function limpiarFiltros() {
    setSucursalFiltro("");
    setMotivoFiltro("");
    setPage(1);
  }

  const crear = useCrearAusencia();
  const editar = useEditarAusencia();
  const borrar = useBorrarAusencia();

  const [altaOpen, setAltaOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<Ausencia | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<Ausencia | null>(null);

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
      toast.success("Ausencia cargada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  function abrirDetalle(a: Ausencia) {
    setErrorEdit(null);
    setEditando(a);
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

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setErrorEdit(null);
    try {
      await editar.mutateAsync({
        id: editando.id,
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
      setEditando(null);
      toast.success("Ausencia actualizada.");
    } catch (err) {
      setErrorEdit(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleBorrar() {
    if (!borrarTarget) return;
    try {
      await borrar.mutateAsync(borrarTarget.id);
      toast.success("Ausencia borrada.");
      setBorrarTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar la ausencia.");
    }
  }

  return (
    <>
      <PageHeader
        title="Ausencias"
        actions={
          <Button variant="secondary" onClick={handleDescargarExcel} disabled={descargando}>
            <Download className="h-4 w-4" />
            {descargando ? "Generando…" : "Descargar Excel"}
          </Button>
        }
      />

      <div className="mt-6">
        <StatRow stats={stats} />
      </div>

      <div className="mt-6">
        <Tabs
          value={vista}
          onChange={setVista}
          items={[
            { value: "registros", label: "Registros", count: resumen?.total },
            { value: "categorias", label: "Categorías", count: categorias.length },
          ]}
        />
      </div>

      {vista === "registros" && (
        // `page-section` acá se usa solo por su margen superior (2.5rem):
        // no lleva <h2> porque el título de la región lo da la pestaña
        // activa de Tabs. Mismo uso que en AsistenciaPage.
        <section {...tabPanelProps("registros")} className="page-section">
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="primary" className="ml-auto" onClick={() => setAltaOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva ausencia
            </Button>
          </div>

          <Toolbar>
            <Field label="Período" compact type="month" value={periodo} onChange={(e) => handlePeriodoChange(e.target.value)} containerClassName="w-32" />
            <div className="flex items-center gap-1.5">
              <Field label="Desde" compact type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(1); }} containerClassName="w-[136px]" />
              <span className="text-xs text-text-tertiary">→</span>
              <Field label="Hasta" compact type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(1); }} containerClassName="w-[136px]" />
            </div>
            <Select
              label="Motivo"
              compact
              value={motivoFiltro}
              onChange={(e) => { setMotivoFiltro(e.target.value); setPage(1); }}
              options={[{ value: "", label: "Todos los motivos" }, ...categorias.map((c) => ({ value: c, label: c }))]}
              containerClassName="w-40"
            />
            <Select
              label="Sucursal"
              compact
              value={sucursalFiltro}
              onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1); }}
              options={[{ value: "", label: "Todas las sucursales" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
              containerClassName="w-44"
            />
            {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} className="ml-0" />}
            <div className="ml-auto">
              <span className="font-mono text-xs text-text-tertiary">{resumen?.total ?? 0} resultados</span>
            </div>
          </Toolbar>

          <Table containerClassName="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead>Certificado</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableSkeleton cols={7} />}
              {!isLoading &&
                ausencias.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => abrirDetalle(a)}
                  >
                    <TableCell className="relative">
                      <PersonCell nombre={a.empleado_nombre} />
                      {/* Sin onClick: el click nativo del botón (mouse, Enter
                          o Espacio) burbujea al onClick de la fila. */}
                      <button
                        type="button"
                        className="absolute inset-0"
                        aria-label={`Ver detalle de la ausencia de ${a.empleado_nombre}`}
                      />
                    </TableCell>
                    <TableCell>{a.motivo}</TableCell>
                    <TableCell>{a.sucursal_nombre ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-text-tertiary">
                      {a.fecha_desde === a.fecha_hasta ? a.fecha_desde : `${a.fecha_desde} → ${a.fecha_hasta}`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{diasEntre(a.fecha_desde, a.fecha_hasta)}</TableCell>
                    <TableCell>{a.certificado_pendiente ? <Status tone="warning">Pendiente</Status> : "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <IconButton onClick={() => setBorrarTarget(a)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Borrar" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && ausencias.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-text-tertiary">Sin ausencias en este rango.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
        </section>
      )}

      {vista === "categorias" && (
        <Card {...tabPanelProps("categorias")} className="mt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-text">Categorías de motivo</h2>
              <p className="mt-1 text-[13.5px] text-text-secondary">
                Motivos disponibles al cargar una ausencia.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setCategoriaModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva categoría
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categorias.length === 0 && (
              <p className="text-[13.5px] text-text-tertiary">Todavía no cargaste ninguna categoría.</p>
            )}
            {categorias.map((c) => {
              const quitando = quitandoCategoria === c;
              return (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-surface-raised py-1 pl-3 pr-1.5 text-[13px] text-text"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => handleQuitarCategoria(c)}
                    disabled={quitando}
                    aria-label={`Quitar categoría ${c}`}
                    className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[6px] text-text-muted hover:bg-text/[.05] hover:text-accent-700 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    {quitando ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </button>
                </span>
              );
            })}
          </div>
        </Card>
      )}

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
          {error && <p className="text-[15px] text-alert">{error}</p>}
          <Button type="submit" variant="primary" block disabled={crear.isPending}>
            Agregar
          </Button>
        </form>
      </Dialog>

      <SidePanel
        open={editando != null}
        onClose={() => { setEditando(null); setErrorEdit(null); }}
        title={`Ausencia de ${editando?.empleado_nombre ?? ""}`}
      >
        <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-3">
          <Select
            label="Sucursal (opcional)"
            value={editForm.sucursal_id}
            onChange={(e) => setEditForm({ ...editForm, sucursal_id: e.target.value })}
            options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
            containerClassName="w-full"
          />
          <div className="flex gap-3">
            <Field label="Desde" type="date" value={editForm.fecha_desde} onChange={(e) => setEditForm({ ...editForm, fecha_desde: e.target.value })} containerClassName="w-full" required />
            <Field label="Hasta" type="date" value={editForm.fecha_hasta} onChange={(e) => setEditForm({ ...editForm, fecha_hasta: e.target.value })} containerClassName="w-full" required />
          </div>
          <Select
            label="Motivo"
            value={editForm.motivoSeleccionado}
            onChange={(e) => setEditForm({ ...editForm, motivoSeleccionado: e.target.value })}
            options={[{ value: "", label: "Elegí un motivo" }, ...opcionesMotivo]}
            containerClassName="w-full"
            required
          />
          {editForm.motivoSeleccionado === OTRO && (
            <Field label="Motivo (otro)" value={editForm.motivoLibre} onChange={(e) => setEditForm({ ...editForm, motivoLibre: e.target.value })} containerClassName="w-full" required />
          )}
          <Field label="Detalle (opcional)" value={editForm.detalle} onChange={(e) => setEditForm({ ...editForm, detalle: e.target.value })} containerClassName="w-full" />
          <Field label="Contacto (opcional)" value={editForm.contacto} onChange={(e) => setEditForm({ ...editForm, contacto: e.target.value })} containerClassName="w-full" />
          <label className="flex items-center gap-2 text-[14px] text-text">
            <input
              type="checkbox"
              checked={editForm.certificado_pendiente}
              onChange={(e) => setEditForm({ ...editForm, certificado_pendiente: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            Certificado pendiente
          </label>
          {errorEdit && <p className="text-[15px] text-alert">{errorEdit}</p>}
          <Button type="submit" variant="primary" block disabled={editar.isPending}>
            Guardar
          </Button>
        </form>
      </SidePanel>

      <Dialog open={borrarTarget != null} onClose={() => setBorrarTarget(null)} title="Borrar ausencia">
        <p className="text-[15px] text-text-secondary">
          ¿Borrar la ausencia de <strong>{borrarTarget?.empleado_nombre}</strong>{" "}
          ({borrarTarget?.fecha_desde === borrarTarget?.fecha_hasta
            ? borrarTarget?.fecha_desde
            : `${borrarTarget?.fecha_desde} – ${borrarTarget?.fecha_hasta}`})?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBorrarTarget(null)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleBorrar} disabled={borrar.isPending}>
            {borrar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Borrar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={categoriaModalOpen}
        onClose={() => {
          setCategoriaModalOpen(false);
          setNuevaCategoria("");
          setErrorCategoria(null);
        }}
        title="Nueva categoría"
      >
        <form onSubmit={handleAgregarCategoria} className="flex flex-col gap-3">
          <Field
            label="Nombre"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            containerClassName="w-full"
            autoFocus
            required
          />
          {errorCategoria && <p className="text-[15px] text-alert">{errorCategoria}</p>}
          <Button type="submit" variant="primary" block disabled={guardarCategorias.isPending}>
            Agregar
          </Button>
        </form>
      </Dialog>
    </>
  );
}
