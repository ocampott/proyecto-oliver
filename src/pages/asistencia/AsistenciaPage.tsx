import { MobileRecords } from "../../components/ui/mobile-records";
import { EmptyState } from "../../components/ui/empty-state";
import { MoreFilters } from "../../components/ui/more-filters";
import { useState, Fragment, type FormEvent } from "react";
import { Download, Loader2, Plus } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
import { SidePanel } from "../../components/ui/side-panel";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { PersonCell } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import type { AsistenciaRegistro, TipoMarca } from "../../lib/api";
import {
  useAsistenciaPaginada,
  useRechazadas,
  useBorrarAsistencia,
  useResolverRechazada,
  useCrearAsistenciaManual,
  useEditarAsistencia,
  useHuerfanas,
} from "./hooks";
import { horaLocal, fechaLocal, MOTIVOS_RECHAZO } from "../../lib/format";
import { Pagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/PageHeader";
import { exportarAsistencia } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { useEntitlements, useOrgActual, tieneModulo, puedeGestionar } from "../../lib/hooks";
import { PorTurnoTab } from "./PorTurnoTab";
import { huerfanaAEditable, huerfanaABorrable, type RegistroEditable, type RegistroBorrable } from "./shared";

type TipoFiltro = "todos" | TipoMarca;
type Vista = "turnos" | "registros" | "rechazadas" | "huerfanas";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function horaAhoraAR(): string {
  return new Date().toLocaleTimeString("sv", { timeZone: AR_TZ, hour: "2-digit", minute: "2-digit" });
}

function fechaISOaAR(iso: string): string {
  return new Date(iso).toLocaleDateString("sv", { timeZone: AR_TZ });
}

function horaISOaAR(iso: string): string {
  return new Date(iso).toLocaleTimeString("sv", { timeZone: AR_TZ, hour: "2-digit", minute: "2-digit" });
}

/** Combina fecha (YYYY-MM-DD) + hora (HH:MM) locales AR en un timestamp
 * enviable al backend — Argentina no tiene DST, offset fijo -03:00. */
function fechaHoraAaIso(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00-03:00`;
}

type MarcaModal = { modo: "crear" } | { modo: "editar"; registro: RegistroEditable };

function agruparPorFecha(registros: AsistenciaRegistro[]): { fecha: string; registros: AsistenciaRegistro[] }[] {
  const grupos: { fecha: string; registros: AsistenciaRegistro[] }[] = [];
  for (const r of registros) {
    const fecha = fechaLocal(r.created_at);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.fecha === fecha) {
      ultimo.registros.push(r);
    } else {
      grupos.push({ fecha, registros: [r] });
    }
  }
  return grupos;
}

export default function AsistenciaPage() {
  const location = useLocation();
  const [vista, setVista] = useState<Vista>(() => {
    const state = location.state as { vista?: Vista } | null;
    const vistasValidas: Vista[] = ["turnos", "registros", "rechazadas", "huerfanas"];
    return state?.vista && vistasValidas.includes(state.vista) ? state.vista : "turnos";
  });
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [empleadoFiltro, setEmpleadoFiltro] = useState("todos");
  const [sucursalFiltro, setSucursalFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [rechazadasPage, setRechazadasPage] = useState(1);
  const [rechazadasPageSize, setRechazadasPageSize] = useState(20);
  const [detalle, setDetalle] = useState<AsistenciaRegistro | null>(null);

  const { data, isLoading, isError } = useAsistenciaPaginada(desde, hasta, {
    page,
    pageSize,
    empleadoId: empleadoFiltro === "todos" ? undefined : empleadoFiltro,
    sucursalId: sucursalFiltro === "todos" ? undefined : sucursalFiltro,
    tipo: tipoFiltro === "todos" ? undefined : tipoFiltro,
  });
  const registros = data?.data ?? [];
  const grupos = agruparPorFecha(registros);
  const { data: rechazadasData, isError: rechazadasError } = useRechazadas({ page: rechazadasPage, pageSize: rechazadasPageSize });
  const rechazadas = rechazadasData?.data ?? [];
  const { data: huerfanas = [], isLoading: huerfanasLoading, isError: huerfanasError } = useHuerfanas(desde, hasta);
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const borrar = useBorrarAsistencia();
  const resolver = useResolverRechazada();
  const toast = useToast();
  const ent = useEntitlements();
  const sinReportes = !tieneModulo(ent, "reportes");
  const { data: org } = useOrgActual();
  const gestionable = puedeGestionar(org ?? null);
  const [descargando, setDescargando] = useState(false);
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<RegistroBorrable | null>(null);

  const [marcaModal, setMarcaModal] = useState<MarcaModal | null>(null);
  const [formEmpleadoId, setFormEmpleadoId] = useState("");
  const [formSucursalId, setFormSucursalId] = useState("");
  const [formTipo, setFormTipo] = useState<TipoMarca>("entrada");
  const [formFecha, setFormFecha] = useState(hoyAR());
  const [formHora, setFormHora] = useState(horaAhoraAR());
  const [formError, setFormError] = useState<string | null>(null);
  const crearManual = useCrearAsistenciaManual();
  const editarMarca = useEditarAsistencia();

  function abrirCrear() {
    setFormEmpleadoId(empleados[0]?.id ?? "");
    setFormSucursalId(sucursales[0]?.id ?? "");
    setFormTipo("entrada");
    setFormFecha(hoyAR());
    setFormHora(horaAhoraAR());
    setFormError(null);
    setMarcaModal({ modo: "crear" });
  }

  function abrirCrearConPrefill(opts: { empleadoId: string; sucursalNombre?: string | null; fecha: string; hora?: string; tipo: TipoMarca }) {
    const sucursal = opts.sucursalNombre ? sucursales.find((s) => s.nombre === opts.sucursalNombre) : undefined;
    setFormEmpleadoId(opts.empleadoId);
    setFormSucursalId(sucursal?.id ?? sucursales[0]?.id ?? "");
    setFormTipo(opts.tipo);
    setFormFecha(opts.fecha);
    setFormHora(opts.hora ?? horaAhoraAR());
    setFormError(null);
    setMarcaModal({ modo: "crear" });
  }

  function abrirEditar(r: RegistroEditable) {
    setFormEmpleadoId(r.empleado_id);
    setFormSucursalId(r.sucursal_id);
    setFormTipo(r.tipo);
    setFormFecha(fechaISOaAR(r.created_at));
    setFormHora(horaISOaAR(r.created_at));
    setFormError(null);
    setMarcaModal({ modo: "editar", registro: r });
  }

  async function handleGuardarMarca(e: FormEvent) {
    e.preventDefault();
    if (!marcaModal) return;
    setFormError(null);
    const fechaHora = fechaHoraAaIso(formFecha, formHora);
    try {
      if (marcaModal.modo === "crear") {
        await crearManual.mutateAsync({ empleadoId: formEmpleadoId, sucursalId: formSucursalId, tipo: formTipo, fechaHora });
        toast.success("Marca cargada.");
      } else {
        await editarMarca.mutateAsync({
          id: marcaModal.registro.id,
          input: { empleadoId: formEmpleadoId, sucursalId: formSucursalId, tipo: formTipo, fechaHora },
        });
        toast.success("Marca actualizada.");
      }
      setMarcaModal(null);
      setDetalle(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la marca.");
    }
  }

  const filtrosActivos = empleadoFiltro !== "todos" || sucursalFiltro !== "todos" || tipoFiltro !== "todos";

  function limpiarFiltros() {
    setEmpleadoFiltro("todos");
    setSucursalFiltro("todos");
    setTipoFiltro("todos");
    setPage(1);
  }

  async function handleDescargarExcel() {
    setDescargando(true);
    try {
      await exportarAsistencia(desde, hasta);
      toast.success("Excel descargado.");
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  async function handleBorrar() {
    if (!borrarTarget) return;
    try {
      await borrar.mutateAsync(borrarTarget.id);
      toast.success("Registro borrado.");
      setBorrarTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el registro.");
    }
  }

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    setResolviendoId(id);
    try {
      await resolver.mutateAsync({ id, accion });
      toast.success(accion === "aprobar" ? "Intento aprobado." : "Intento descartado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo resolver el intento.");
    } finally {
      setResolviendoId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Asistencia"
        actions={
          <>
            {gestionable && (
              <Button variant="secondary" onClick={abrirCrear}>
                <Plus className="h-4 w-4" />
                Marcar manualmente
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleDescargarExcel}
              disabled={descargando || sinReportes || !gestionable}
              title={
                !gestionable
                  ? "Tu rol no tiene acceso a exportar."
                  : sinReportes
                    ? "Exportar es una función del plan Básico. Pasate a un plan superior para usarla."
                    : undefined
              }
            >
              <Download className="h-4 w-4" />
              {descargando ? "Generando…" : "Descargar Excel"}
            </Button>
          </>
        }
      />

      <div>
        <Tabs
          value={vista}
          onChange={setVista}
          items={[
            { value: "turnos", label: "Por turno" },
            { value: "registros", label: "Registros", count: data?.pagination.total },
            { value: "rechazadas", label: "Rechazadas", count: rechazadasData?.pagination.total },
            { value: "huerfanas", label: "Huérfanas", count: huerfanas.length },
          ]}
        />
      </div>

      {vista === "turnos" && (
        <section {...tabPanelProps("turnos")}>
          <Toolbar>
            <Select
              label="Empleado"
              compact
              value={empleadoFiltro}
              onChange={(e) => setEmpleadoFiltro(e.target.value)}
              options={[{ value: "todos", label: "Todos" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
              containerClassName="w-40"
            />
            <div className="flex items-center gap-1.5">
              <Field label="Desde" compact type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-[136px]" />
              <span className="text-xs text-text-tertiary">→</span>
              <Field label="Hasta" compact type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-[136px]" />
            </div>
          </Toolbar>
          <PorTurnoTab
            desde={desde}
            hasta={hasta}
            empleadoId={empleadoFiltro === "todos" ? undefined : empleadoFiltro}
            empleados={empleados}
            sucursales={sucursales}
            huerfanas={huerfanas}
            huerfanasLoading={huerfanasLoading}
            gestionable={gestionable}
            abrirEditar={abrirEditar}
            setBorrarTarget={setBorrarTarget}
            abrirCrearConPrefill={abrirCrearConPrefill}
          />
        </section>
      )}

      {vista === "registros" && (
        <section {...tabPanelProps("registros")}>
          <Toolbar>
            <Select
              label="Empleado"
              compact
              value={empleadoFiltro}
              onChange={(e) => { setEmpleadoFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
              containerClassName="w-40"
            />
            <div className="flex items-center gap-1.5">
              <Field
                label="Desde"
                compact
                type="date"
                value={desde}
                onChange={(e) => { setDesde(e.target.value); setPage(1); }}
                containerClassName="w-[136px]"
              />
              <span className="text-xs text-text-tertiary">→</span>
              <Field
                label="Hasta"
                compact
                type="date"
                value={hasta}
                onChange={(e) => { setHasta(e.target.value); setPage(1); }}
                containerClassName="w-[136px]"
              />
            </div>
            <MoreFilters activeCount={[sucursalFiltro !== "todos", tipoFiltro !== "todos"].filter(Boolean).length}>
              <Select
                label="Sucursal"
                compact
                value={sucursalFiltro}
                onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1); }}
                options={[{ value: "todos", label: "Todos" }, ...sucursales.map((suc) => ({ value: suc.id, label: suc.nombre }))]}
                containerClassName="w-40"
              />
              <Select
                label="Tipo"
                compact
                value={tipoFiltro}
                onChange={(e) => { setTipoFiltro(e.target.value as TipoFiltro); setPage(1); }}
                options={[
                  { value: "todos", label: "Entradas y salidas" },
                  { value: "entrada", label: "Solo entradas" },
                  { value: "salida", label: "Solo salidas" },
                ]}
                containerClassName="w-36"
              />
            </MoreFilters>
            {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} className="ml-0" />}
            <div className="ml-auto">
              <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
            </div>
          </Toolbar>

          {isError && <p className="mt-2 text-[15px] text-alert">No se pudieron cargar los registros. Probá de nuevo.</p>}

          {(isLoading || registros.length > 0) && <MobileRecords loading={isLoading} items={registros.map(r => ({
            id: r.id, title: r.empleado_nombre ?? "Empleado", description: `${r.tipo === "entrada" ? "Entrada" : "Salida"} · ${r.sucursal_nombre ?? "Sin sucursal"}${r.origen === "manual" ? " · Manual" : ""}`,
            meta: horaLocal(r.created_at), actionLabel: `Ver detalle de la marca de ${r.empleado_nombre ?? "—"}`, onOpen: () => setDetalle(r),
          }))} />}
          {!isLoading && !isError && registros.length === 0 && <EmptyState title="No hay marcas en este período" description="Elegí otras fechas o quitá los filtros para consultar más registros." action={filtrosActivos ? <Button variant="secondary" onClick={limpiarFiltros}>Limpiar filtros</Button> : <Button variant="secondary" onClick={() => {
            const inicio = new Date(`${hoyAR()}T12:00:00Z`);
            inicio.setUTCDate(inicio.getUTCDate() - 6);
            setDesde(inicio.toISOString().slice(0, 10)); setHasta(hoyAR()); setPage(1);
          }}>Ver últimos 7 días</Button>} />}
          <Table containerClassName={isLoading || registros.length > 0 ? "mt-4 hidden md:block" : "hidden"}>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Hora</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableSkeleton cols={6} />}
              {!isLoading &&
                grupos.map((grupo) => (
                  <Fragment key={grupo.fecha}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={6}
                        className="border-b-0 bg-surface py-2 text-[12px] font-semibold uppercase tracking-wide text-text-tertiary"
                      >
                        {grupo.fecha}
                      </TableCell>
                    </TableRow>
                    {grupo.registros.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => setDetalle(r)}
                      >
                        <TableCell className="relative">
                          <PersonCell nombre={r.empleado_nombre ?? "—"} />
                          {/* Sin onClick: el click nativo del botón (mouse,
                              Enter o Espacio) burbujea al onClick de la fila. */}
                          <button
                            type="button"
                            className="absolute inset-0"
                            aria-label={`Ver detalle de la marca de ${r.empleado_nombre ?? "—"}`}
                          />
                        </TableCell>
                        <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                        <TableCell>
                          <Badge tone={r.tipo === "entrada" ? "success" : "neutral"}>
                            {r.tipo === "entrada" ? "Entrada" : "Salida"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge tone={r.origen === "manual" ? "warning" : "neutral"}>
                            {r.origen === "manual" ? "Manual" : "Empleado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{horaLocal(r.created_at)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2 row-actions transition-opacity">
                            {gestionable && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="default"
                                  onClick={() => abrirEditar(r)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="default"
                                  onClick={() => setBorrarTarget(r)}
                                >
                                  Borrar
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              {!isLoading && registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-text-tertiary">
                    No hay registros en este rango.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
        </section>
      )}

      {vista === "rechazadas" && (
        <section {...tabPanelProps("rechazadas")}>
          <Table>
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
                    {MOTIVOS_RECHAZO[r.motivo] ?? r.motivo}
                    {r.motivo === "fuera_de_rango" && r.distancia_metros != null && (
                      <span className="text-text-tertiary"> (a {r.distancia_metros} m)</span>
                    )}
                    {r.tipo && <span className="text-text-tertiary"> — {r.tipo}</span>}
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
              {rechazadasError && (
                <TableRow>
                  <TableCell colSpan={5} className="text-alert">
                    No pudimos cargar las marcas rechazadas. Probá de nuevo.
                  </TableCell>
                </TableRow>
              )}
              {!rechazadasError && rechazadas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-text-tertiary">
                    No hay marcas rechazadas pendientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rechazadasData && (
            <Pagination
              pagination={rechazadasData.pagination}
              onPageChange={setRechazadasPage}
              onPageSizeChange={(s) => { setRechazadasPageSize(s); setRechazadasPage(1); }}
            />
          )}
        </section>
      )}

      {vista === "huerfanas" && (
        <section {...tabPanelProps("huerfanas")}>
          <p className="mb-3 text-[13px] text-text-tertiary">
            Salidas registradas sin una entrada previa (ej. se tocó "Marcar salida" dos veces, o se borró la
            entrada por error). No se cuentan como horas trabajadas hasta que las resuelvas: editalas si en
            realidad era una entrada, o borralas si fue un error.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {huerfanasLoading && <TableSkeleton cols={4} />}
              {!huerfanasLoading &&
                huerfanas.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono text-xs">{horaLocal(h.created_at)}</TableCell>
                    <TableCell>{h.empleado_nombre}</TableCell>
                    <TableCell>{h.sucursal_nombre}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {gestionable && (
                          <>
                            <Button variant="secondary" size="default" onClick={() => abrirEditar(huerfanaAEditable(h))}>
                              Editar
                            </Button>
                            <Button variant="secondary" size="default" onClick={() => setBorrarTarget(huerfanaABorrable(h))}>
                              Borrar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {huerfanasError && (
                <TableRow>
                  <TableCell colSpan={4} className="text-alert">
                    No pudimos cargar las salidas huérfanas. Probá de nuevo.
                  </TableCell>
                </TableRow>
              )}
              {!huerfanasLoading && !huerfanasError && huerfanas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-text-tertiary">
                    No hay salidas huérfanas en este rango.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      )}

      <SidePanel
        open={detalle != null}
        onClose={() => setDetalle(null)}
        title="Detalle de marca"
        footer={
          gestionable && detalle ? (
            <div className="flex gap-2">
              <Button variant="secondary" block onClick={() => abrirEditar(detalle)}>
                Editar
              </Button>
              <Button
                variant="secondary"
                block
                onClick={() => {
                  setBorrarTarget(detalle);
                  setDetalle(null);
                }}
              >
                Borrar registro
              </Button>
            </div>
          ) : undefined
        }
      >
        {detalle && (
          <dl className="flex flex-col gap-4 text-[14px]">
            <div>
              <dt className="text-text-tertiary">Empleado</dt>
              <dd className="font-medium text-text">{detalle.empleado_nombre ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Sucursal</dt>
              <dd className="font-medium text-text">{detalle.sucursal_nombre ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Tipo</dt>
              <dd className="font-medium text-text">{detalle.tipo === "entrada" ? "Entrada" : "Salida"}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Origen</dt>
              <dd className="font-medium text-text">
                <Badge tone={detalle.origen === "manual" ? "warning" : "neutral"}>
                  {detalle.origen === "manual" ? "Cargada manualmente" : "Marcada por el empleado"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Fecha y hora</dt>
              <dd className="font-medium text-text">{horaLocal(detalle.created_at)}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Ubicación registrada</dt>
              <dd className="font-mono text-text-secondary">
                {detalle.lat != null && detalle.lon != null ? `${detalle.lat.toFixed(5)}, ${detalle.lon.toFixed(5)}` : "Sin ubicación (marca manual)"}
              </dd>
            </div>
          </dl>
        )}
      </SidePanel>

      <Dialog
        open={marcaModal !== null}
        onClose={() => setMarcaModal(null)}
        title={marcaModal?.modo === "editar" ? "Editar marca" : "Marcar manualmente"}
      >
        <form onSubmit={handleGuardarMarca} className="flex flex-col gap-3">
          <Select
            label="Empleado"
            required
            value={formEmpleadoId}
            onChange={(e) => setFormEmpleadoId(e.target.value)}
            options={empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))}
            containerClassName="w-full"
          />
          <Select
            label="Sucursal"
            required
            value={formSucursalId}
            onChange={(e) => setFormSucursalId(e.target.value)}
            options={sucursales.map((suc) => ({ value: suc.id, label: suc.nombre }))}
            containerClassName="w-full"
          />
          <Select
            label="Tipo"
            required
            value={formTipo}
            onChange={(e) => setFormTipo(e.target.value as TipoMarca)}
            options={[
              { value: "entrada", label: "Entrada" },
              { value: "salida", label: "Salida" },
            ]}
            containerClassName="w-full"
          />
          <div className="flex gap-2">
            <Field
              label="Fecha"
              required
              type="date"
              value={formFecha}
              onChange={(e) => setFormFecha(e.target.value)}
              containerClassName="w-full"
            />
            <Field
              label="Hora"
              required
              type="time"
              value={formHora}
              onChange={(e) => setFormHora(e.target.value)}
              containerClassName="w-full"
            />
          </div>
          {formError && <p className="text-[15px] text-alert">{formError}</p>}
          <Button
            type="submit"
            variant="primary"
            block
            disabled={crearManual.isPending || editarMarca.isPending || !formEmpleadoId || !formSucursalId}
          >
            {(crearManual.isPending || editarMarca.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {marcaModal?.modo === "editar" ? "Guardar cambios" : "Cargar marca"}
          </Button>
        </form>
      </Dialog>

      <Dialog open={borrarTarget != null} onClose={() => setBorrarTarget(null)} title="Borrar registro">
        <p className="text-[15px] text-text-secondary">
          ¿Borrar el registro de {borrarTarget?.tipo === "entrada" ? "entrada" : "salida"} de{" "}
          <strong>{borrarTarget?.empleado_nombre ?? "este empleado"}</strong> del{" "}
          {borrarTarget ? horaLocal(borrarTarget.created_at) : ""}? Esta acción no se puede deshacer.
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
