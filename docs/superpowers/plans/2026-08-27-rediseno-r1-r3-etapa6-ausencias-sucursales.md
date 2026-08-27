# Rediseño R1/R3 — Etapa 6: Ausencias + Sucursales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer Ausencias (`RrhhPage.tsx`) y Sucursales
(`SucursalesPage.tsx` + detalle nuevo) siguiendo la spec original —
StatRow, Toolbar compacto, tab explícito de Categorías en Ausencias, y en
Sucursales las columnas "Empleados"/"Activos ahora" (aporte de R1) más
una página de detalle nueva con plantel, QR y geocerca.

**Architecture:** Cuatro tasks. (1) Extiende el hook ya existente
`useAsistenciaEnVivo` (usado hoy por el dashboard) para exponer también
los registros crudos de hoy — lo necesita el detalle de sucursal para
"Marcas de hoy". (2) `RrhhPage.tsx` — reemplazo completo: StatRow, Tabs
Registros/Categorías, Toolbar compacto, fila clickeable a un SidePanel de
detalle+edición (en vez del Dialog actual), tabla con `PersonCell`/
densidad ya heredada de la etapa de fidelidad. (3) `SucursalesPage.tsx` —
ediciones puntuales: Toolbar compacto, columnas "Empleados"/"Activos
ahora" nuevas (client-side, sin endpoints nuevos), fila clickeable a la
ruta nueva. (4) `SucursalDetallePage.tsx` nueva + ruta `/sucursales/:id`
+ se saca el link a Categorías de motivo desde `ConfiguracionPage.tsx`.

Los componentes compartidos que usan estas 4 tasks (`Toolbar`+`compact`,
`Table` denso, `Avatar`/`PersonCell`, `Badge` con `tone`) ya están en su
forma final desde la etapa de fidelidad anterior — a diferencia de la
Etapa 5, acá no hace falta una pasada de retoque posterior.

**Tech Stack:** Sin dependencias nuevas. Reusa `useAsistenciaEnVivo`
(`src/components/dashboard/useAsistenciaEnVivo.ts`, ya construido para el
dashboard — realtime de Supabase, sin pedir nada nuevo al backend),
`useQrBlob`, `MapaUbicacion`.

**Spec:** `docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md`
(sección Ausencias/Sucursales). Referencia visual real:
`~/Desktop/R3/src/pages/{Ausencias,Sucursales,SucursalDetalle}.tsx`.

## Global Constraints

- **Sin cambios de backend.** De acá nacen varias decisiones de alcance:
  - El filtro de empleado en Ausencias **no** pasa a búsqueda de texto
    libre (mismo motivo que en Asistencia — `getAusencias` no tiene un
    parámetro de búsqueda por nombre, solo `empleadoId` exacto). Se
    mantienen los filtros existentes (Sucursal, Motivo) más el rango de
    fechas ya existente (Período/Desde/Hasta).
  - **"Injustificadas" (del stat de R3) se reemplaza por "Certificados
    pendientes"** — R3 tiene una categoría de motivo fija
    `"Falta injustificada"` en sus mocks; acá las categorías son libres
    (el usuario las crea desde la pestaña Categorías), no hay ninguna
    categoría con nombre garantizado. "Certificados pendientes" ya está
    calculado server-side (`resumen.certificadosPendientes`) y tiene el
    mismo espíritu de "requiere atención".
  - **"Empleados"/"Activos ahora" de Sucursales se derivan 100% en el
    cliente**: "Empleados" cuenta `useEmpleados()` filtrado por
    `sucursal_id`; "Activos ahora" reusa `useAsistenciaEnVivo` (mismo
    hook que ya alimenta el Pulso Operativo del dashboard, con su propia
    suscripción realtime — no hace falta un endpoint nuevo).
  - **`SucursalDetallePage` no tiene `GET /sucursales/:id`** — se busca
    la sucursal en la lista completa ya cacheada (`useSucursales({page:1,
    pageSize:500})`), mismo patrón que `EmpleadoDetallePage`.
  - **El mapa de "Ubicación y geocerca" del detalle es una vista de solo
    lectura decorativa** (grilla + pin + círculo de radio, sin mapa real
    ni interactividad) — **no** el componente `MapaUbicacion` existente,
    que es un *picker* editable (buscador de direcciones, pin
    arrastrable, siempre dispara `onChange`). Reusarlo tal cual en una
    vista de solo-lectura implicaría que el usuario puede "editar" la
    ubicación desde el detalle sin que eso se guarde en ningún lado — un
    bug de UX, no una simplificación válida. La edición real de ubicación
    sigue viviendo exclusivamente en el diálogo "Editar" (que sí reusa
    `MapaUbicacion`, igual que ya hace la lista).
- **Se preserva toda la lógica de negocio existente**: alta/edición/
  borrado de ausencias, gestión de categorías, alta/edición/activar-
  desactivar/eliminar de sucursales, generación y descarga de QR,
  exportación a Excel, gating por plan (`maxSucursales`) y rol.
- **Sin sincronizar nada a la URL** (salvo la ruta `/sucursales/:id` en
  sí misma).
- **Sin tests automatizados de UI** — verificación es `npm run build`.

---

## Task 1: `useAsistenciaEnVivo` expone los registros crudos de hoy

**Files:**
- Modify: `src/components/dashboard/useAsistenciaEnVivo.ts`

**Interfaces:**
- Produces: el hook ahora devuelve también `registrosHoy:
  AsistenciaRegistro[]` (los mismos datos crudos que ya trae internamente
  vía `useAsistencia(hoy, hoy)`, hoy descartados fuera de los derivados
  `porSucursal`/`ultimosMarcados`). El Task 4 de este plan lo consume
  para contar "Marcas de hoy" de una sucursal específica
  (`registrosHoy.filter(r => r.sucursal_id === id).length`).
- El único consumidor actual (`PulsoOperativo.tsx`) no desestructura
  `registrosHoy` — agregar un campo al objeto devuelto no le afecta.

- [ ] **Step 1: Agregar `registrosHoy` al valor devuelto**

Buscar:

```ts
  const porSucursal = useMemo(() => derivarAdentro(data ?? []), [data]);
  const ultimosMarcados = useMemo(() => derivarUltimosMarcados(data ?? []), [data]);

  return { isLoading, isError, porSucursal, conectado, ultimosMarcados };
}
```

Reemplazar por:

```ts
  const porSucursal = useMemo(() => derivarAdentro(data ?? []), [data]);
  const ultimosMarcados = useMemo(() => derivarUltimosMarcados(data ?? []), [data]);

  return { isLoading, isError, porSucursal, conectado, ultimosMarcados, registrosHoy: data ?? [] };
}
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/useAsistenciaEnVivo.ts
git commit -m "feat: useAsistenciaEnVivo expone tambien los registros crudos de hoy"
```

---

## Task 2: `RrhhPage.tsx` (Ausencias) — StatRow, Tabs, SidePanel, Toolbar compacto

**Files:**
- Modify: `src/pages/rrhh/RrhhPage.tsx` (reemplazo completo del archivo)

**Interfaces:**
- Consumes: `Toolbar`/`compact` (`Field`/`Select`), `StatRow`, `Tabs`,
  `SidePanel`, `PersonCell` (`../../components/ui/avatar`) — todos ya
  construidos en etapas anteriores, ningún componente nuevo.
- Ningún hook de `./hooks` cambia de firma — se consumen exactamente
  igual que hoy.

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
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
import { Tabs } from "../../components/ui/tabs";
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

  // ponytail: un segundo pedido (sin paginar, tope 500) sobre el mismo
  // rango/filtros solo para los 3 stats que "resumen" no trae del
  // servidor (en curso/programadas/días) — a escala PyME alcanza; si una
  // organización acumula más de 500 ausencias en un rango, evaluar que
  // el backend calcule estos 3 campos junto con el resto de "resumen".
  const { data: statsData } = useAusencias({
    desde,
    hasta,
    sucursalId: sucursalFiltro || undefined,
    motivo: motivoFiltro || undefined,
    page: 1,
    pageSize: 500,
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
            { value: "registros", label: "Registros" },
            { value: "categorias", label: "Categorías", count: categorias.length },
          ]}
        />
      </div>

      {vista === "registros" && (
        <section className="page-section">
          <div className="mt-4 flex flex-wrap items-end gap-2">
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
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => abrirDetalle(a)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        abrirDetalle(a);
                      }
                    }}
                  >
                    <TableCell>
                      <PersonCell nombre={a.empleado_nombre} />
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
        <Card className="mt-6">
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised py-1 pl-3 pr-1.5 text-[13px] text-text"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => handleQuitarCategoria(c)}
                    disabled={quitando}
                    aria-label={`Quitar categoría ${c}`}
                    className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-text-muted hover:bg-text/[.05] hover:text-accent-700 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/rrhh/RrhhPage.tsx
git commit -m "feat: Ausencias con StatRow, tabs Registros/Categorias, SidePanel de detalle y toolbar compacto"
```

---

## Task 3: `SucursalesPage.tsx` — Toolbar compacto, columnas Empleados/Activos ahora, fila clickeable

**Files:**
- Modify: `src/pages/sucursales/SucursalesPage.tsx`

**Interfaces:**
- Consumes: `useEmpleados` (`../empleados/hooks`, ya existente, sin
  cambios), `useAsistenciaEnVivo` (`../../components/dashboard/
  useAsistenciaEnVivo`, ya existente — extendido en el Task 1 de este
  mismo plan con `registrosHoy`, no usado en esta task pero sí
  `porSucursal`), `Badge` (`../../components/ui/badge`, con `tone`).
- Las filas navegan a `/sucursales/${suc.id}` — ruta creada en el Task 4
  de este mismo plan; hasta que ese task corra cae en el catch-all `*`,
  esperado (mismo patrón que Etapa 5).

- [ ] **Step 1: Imports**

Buscar:

```tsx
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Loader2, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { FilterChip } from "../../components/ui/filter-chip";
import { Status } from "../../components/ui/status";
import { IconButton } from "../../components/ui/icon-button";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/PageHeader";
import { MapaUbicacion, type Coordenadas } from "../../components/MapaUbicacion";
import type { Sucursal } from "../../lib/api";
import { getOrgResumenActual } from "../../lib/api";
import { useSucursales, useOrgActual, useCrearSucursal, useEditarSucursal, useEliminarSucursal } from "./hooks";
import { useQrBlob } from "./useQrBlob";
import { ErrorPlan } from "../../components/ErrorPlan";
import { puedeGestionar } from "../../lib/hooks";
```

Reemplazar por:

```tsx
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Badge } from "../../components/ui/badge";
import { IconButton } from "../../components/ui/icon-button";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/PageHeader";
import { MapaUbicacion, type Coordenadas } from "../../components/MapaUbicacion";
import type { Sucursal } from "../../lib/api";
import { getOrgResumenActual } from "../../lib/api";
import { useSucursales, useOrgActual, useCrearSucursal, useEditarSucursal, useEliminarSucursal } from "./hooks";
import { useQrBlob } from "./useQrBlob";
import { useEmpleados } from "../empleados/hooks";
import { useAsistenciaEnVivo } from "../../components/dashboard/useAsistenciaEnVivo";
import { ErrorPlan } from "../../components/ErrorPlan";
import { puedeGestionar } from "../../lib/hooks";
import { cn } from "../../lib/utils";
```

(`X` y `FilterChip` se sacan del import — quedan sin uso tras el Step 3.
`Status` se saca porque el Step 4 reemplaza su único uso por `Badge`.)

- [ ] **Step 2: Agregar `navigate`, `empleados` y `live` al componente**

Buscar:

```tsx
export default function SucursalesPage() {
  const { data: org } = useOrgActual();
  const crear = useCrearSucursal();
```

Reemplazar por:

```tsx
export default function SucursalesPage() {
  const navigate = useNavigate();
  const { data: org } = useOrgActual();
  const { data: empleados = [] } = useEmpleados();
  const live = useAsistenciaEnVivo(org?.id ?? "");
  const crear = useCrearSucursal();
```

- [ ] **Step 3: Reemplazar el bloque de búsqueda + filtros por un Toolbar compacto**

Buscar:

```tsx
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Buscar"
          placeholder="Nombre de la sucursal"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
        <Button
          variant="primary"
          className="ml-auto"
          disabled={alTope || !gestionable}
          title={
            !gestionable
              ? "Tu rol no tiene acceso a crear sucursales."
              : alTope
                ? `Llegaste al máximo de ${ent!.maxSucursales} sucursales de tu plan. Pasate a un plan superior para sumar más.`
                : undefined
          }
          onClick={() => {
            setError(null);
            setAltaOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva sucursal
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterChip
          label="Estado"
          value={estadoFiltro}
          defaultValue="todos"
          onChange={(v) => { setEstadoFiltro(v as EstadoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activos", label: "Activos" },
            { value: "inactivos", label: "Inactivos" },
          ]}
        />
        {filtrosActivos && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-text-secondary hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>
```

Reemplazar por:

```tsx
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Button
          variant="primary"
          className="ml-auto"
          disabled={alTope || !gestionable}
          title={
            !gestionable
              ? "Tu rol no tiene acceso a crear sucursales."
              : alTope
                ? `Llegaste al máximo de ${ent!.maxSucursales} sucursales de tu plan. Pasate a un plan superior para sumar más.`
                : undefined
          }
          onClick={() => {
            setError(null);
            setAltaOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva sucursal
        </Button>
      </div>

      <Toolbar>
        <Field
          label="Buscar por nombre"
          compact
          placeholder="Buscar por nombre"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-56"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
        <Select
          label="Estado"
          compact
          value={estadoFiltro}
          onChange={(e) => { setEstadoFiltro(e.target.value as EstadoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todas" },
            { value: "activos", label: "Activas" },
            { value: "inactivos", label: "Inactivas" },
          ]}
          containerClassName="w-36"
        />
        {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} className="ml-0" />}
        <div className="ml-auto">
          <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
        </div>
      </Toolbar>
```

- [ ] **Step 4: Tabla — columnas nuevas, fila clickeable, `Badge` de tono, acciones en hover**

Buscar:

```tsx
      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead>Coordenadas</TableHead>
            <TableHead>Radio</TableHead>
            <TableHead>Activa</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            sucursales.map((suc) => (
              <TableRow key={suc.id} className={suc.activa ? "" : "text-text-muted"}>
                <TableCell>{suc.nombre}</TableCell>
                <TableCell>{suc.direccion ?? "—"}</TableCell>
                <TableCell>
                  {suc.lat != null && suc.lon != null ? `${suc.lat}, ${suc.lon}` : "Sin configurar"}
                </TableCell>
                <TableCell>{`${suc.radio_metros} m`}</TableCell>
                <TableCell>
                  <Status tone={suc.activa ? "success" : "neutral"}>{suc.activa ? "Activa" : "Inactiva"}</Status>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
```

Reemplazar por:

```tsx
      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead className="text-right">Radio</TableHead>
            <TableHead className="text-right">Empleados</TableHead>
            <TableHead className="text-right">Activos ahora</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={7} />}
          {!isLoading &&
            sucursales.map((suc) => {
              const plantelCount = empleados.filter((e) => e.sucursal_id === suc.id).length;
              const activosAhora = live.porSucursal.find((g) => g.sucursalId === suc.id)?.empleados.length ?? 0;
              return (
              <TableRow
                key={suc.id}
                role="button"
                tabIndex={0}
                className={cn("cursor-pointer", !suc.activa && "text-text-muted")}
                onClick={() => navigate(`/sucursales/${suc.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/sucursales/${suc.id}`);
                  }
                }}
              >
                <TableCell>{suc.nombre}</TableCell>
                <TableCell>{suc.direccion ?? "—"}</TableCell>
                <TableCell className="text-right font-mono text-xs text-text-tertiary">{`${suc.radio_metros} m`}</TableCell>
                <TableCell className="text-right font-mono text-xs">{plantelCount}</TableCell>
                <TableCell className="text-right font-mono text-xs">{activosAhora}</TableCell>
                <TableCell>
                  <Badge tone={suc.activa ? "success" : "neutral"}>{suc.activa ? "Activa" : "Inactiva"}</Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
```

Nota: se abrió una llave `{` extra antes del `return (` implícito del
`.map()` (con la variable `plantelCount`/`activosAhora` calculada antes
del `return`) — el cierre de esa función de map (`);\n})}`) también
cambia. Buscar el cierre original:

```tsx
                    {gestionable && !suc.activa && !suc.tiene_asistencia && (
                      <IconButton
                        onClick={() => setEliminarTarget(suc)}
                        disabled={loading}
                        icon={
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        }
                        label="Eliminar"
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
```

Reemplazar por:

```tsx
                    {gestionable && !suc.activa && !suc.tiene_asistencia && (
                      <IconButton
                        onClick={() => setEliminarTarget(suc)}
                        disabled={loading}
                        icon={
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        }
                        label="Eliminar"
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
```

Los dos IconButton del medio (Editar, Activar/Desactivar, Ver QR) que
quedan entre el Step 4's `<div className="flex justify-end gap-1.5 ...">`
y el cierre de arriba **no cambian** — son exactamente los mismos que ya
existen hoy, no hace falta tocarlos.

Los `TableCell` de `colSpan` de los dos estados vacíos ("Todavía no hay
sucursales cargadas" / "Ninguna sucursal coincide con el filtro", más
abajo en el archivo) pasan de `colSpan={6}` a `colSpan={7}` — buscar
ambas ocurrencias de `colSpan={6}` en esos dos bloques y cambiarlas a
`colSpan={7}` (la tabla ahora tiene 7 columnas, no 6).

- [ ] **Step 5: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores. El build no depende de que exista la ruta
`/sucursales/:id` todavía (eso es routing en runtime).

- [ ] **Step 6: Commit**

```bash
git add src/pages/sucursales/SucursalesPage.tsx
git commit -m "feat: Sucursales con toolbar compacto, columnas Empleados/Activos ahora y filas que navegan al detalle"
```

---

## Task 4: `SucursalDetallePage.tsx` nueva + ruta + se saca el link de Categorías desde Configuración

**Files:**
- Create: `src/pages/sucursales/SucursalDetallePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/configuracion/ConfiguracionPage.tsx`

**Interfaces:**
- Consumes: `useSucursales`, `useOrgActual`, `useEditarSucursal` (`./hooks`,
  ya existentes), `useQrBlob` (`./useQrBlob`), `useEmpleados`
  (`../empleados/hooks`), `useAsistenciaEnVivo` (con `registrosHoy` del
  Task 1 de este mismo plan), `MapaUbicacion` (solo dentro del diálogo
  "Editar" — ver Global Constraints sobre por qué no se usa en la vista
  de solo-lectura).
- Produces: ruta `/sucursales/:id` en `App.tsx` — el Task 3 de este plan
  ya asume que existe.

- [ ] **Step 1: Crear `src/pages/sucursales/SucursalDetallePage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { Pencil, Download, MapPin, Loader2 } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Dialog } from "../../components/ui/dialog";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { Status } from "../../components/ui/status";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { PersonCell } from "../../components/ui/avatar";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import { MapaUbicacion, type Coordenadas } from "../../components/MapaUbicacion";
import { ErrorPlan } from "../../components/ErrorPlan";
import type { Sucursal } from "../../lib/api";
import { useSucursales, useOrgActual, useEditarSucursal } from "./hooks";
import { useQrBlob } from "./useQrBlob";
import { useEmpleados } from "../empleados/hooks";
import { useAsistenciaEnVivo } from "../../components/dashboard/useAsistenciaEnVivo";
import { puedeGestionar } from "../../lib/hooks";

function parseNumero(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

function coordsDe(suc: Sucursal): Coordenadas | null {
  return suc.lat != null && suc.lon != null ? { lat: suc.lat, lon: suc.lon } : null;
}

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

function estadoLabel(estado: "activo" | "de_licencia" | "suspendido" | "baja"): string {
  if (estado === "activo") return "Activo";
  if (estado === "de_licencia") return "De licencia";
  if (estado === "suspendido") return "Suspendido";
  return "Baja";
}

export default function SucursalDetallePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: org } = useOrgActual();
  const gestionable = puedeGestionar(org ?? null);

  // ponytail: trae hasta 500 sucursales y busca la que corresponde — sin
  // endpoint GET /sucursales/:id dedicado, mismo patrón que Detalle de
  // empleado. A escala PyME alcanza de sobra.
  const { data: sucursalesData, isLoading } = useSucursales({ page: 1, pageSize: 500 });
  const sucursal = sucursalesData?.data.find((s) => s.id === id);

  const { data: empleados = [] } = useEmpleados();
  const plantel = empleados.filter((e) => e.sucursal_id === id);

  const live = useAsistenciaEnVivo(org?.id ?? "");
  const grupoAdentro = live.porSucursal.find((g) => g.sucursalId === id);
  const idsAdentro = new Set((grupoAdentro?.empleados ?? []).map((e) => e.empleadoId));
  const marcasHoy = live.registrosHoy.filter((r) => r.sucursal_id === id).length;

  const qrUrl = useQrBlob(id ?? null);

  const editar = useEditarSucursal();
  const [editOpen, setEditOpen] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editRadio, setEditRadio] = useState("100");
  const [editCoords, setEditCoords] = useState<Coordenadas | null>(null);
  const [editDireccion, setEditDireccion] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  function abrirEdicion() {
    if (!sucursal) return;
    setError(null);
    setEditNombre(sucursal.nombre);
    setEditRadio(sucursal.radio_metros.toString());
    setEditCoords(coordsDe(sucursal));
    setEditDireccion(sucursal.direccion);
    setEditOpen(true);
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!sucursal) return;
    setError(null);
    try {
      await editar.mutateAsync({
        id: sucursal.id,
        patch: {
          nombre: editNombre,
          lat: editCoords?.lat ?? null,
          lon: editCoords?.lon ?? null,
          radio_metros: parseNumero(editRadio),
          direccion: editDireccion,
        },
      });
      setEditOpen(false);
      toast.success("Sucursal actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  if (isLoading) {
    return <p className="text-text-tertiary">Cargando...</p>;
  }

  if (!sucursal) {
    return (
      <>
        <PageHeader breadcrumb={[{ label: "Sucursales", href: "/sucursales" }]} title="Sucursal no encontrada" />
        <p className="mt-4 text-text-secondary">
          No encontramos esta sucursal.{" "}
          <Link to="/sucursales" className="text-accent-700 hover:underline">
            Volver a Sucursales
          </Link>
          .
        </p>
      </>
    );
  }

  const stats: StatRowItem[] = [
    { label: "Adentro ahora", value: idsAdentro.size, meta: `${plantel.length} asignados` },
    { label: "Marcas de hoy", value: marcasHoy, meta: "entradas y salidas" },
    { label: "Radio de geocerca", value: `${sucursal.radio_metros} m`, meta: "tolerancia de fichaje" },
    { label: "Alta", value: fechaLocal(sucursal.created_at) },
  ];

  const urlMarcado = org ? `${window.location.origin}/marcar/${org.slug}/${sucursal.id}` : "";

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Sucursales", href: "/sucursales" }]}
        title={sucursal.nombre}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={sucursal.activa ? "success" : "neutral"}>{sucursal.activa ? "Activa" : "Inactiva"}</Badge>
            <span className="text-text-tertiary">{sucursal.direccion ?? "Sin dirección cargada"}</span>
          </span>
        }
        actions={
          <div className="flex gap-2">
            {qrUrl && (
              <Button variant="secondary" asChild>
                <a href={qrUrl} download={`qr-${sucursal.nombre}.png`}>
                  <Download className="h-4 w-4" />
                  Descargar QR
                </a>
              </Button>
            )}
            <Button
              variant="primary"
              onClick={abrirEdicion}
              disabled={!gestionable}
              title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </div>
        }
      />

      <div className="mt-6">
        <StatRow stats={stats} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[14px] font-semibold text-text">Plantel asignado</h3>
              <span className="text-[12px] text-text-tertiary">{plantel.length} personas</span>
            </div>
            <Table containerClassName="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead className="text-right">Hoy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plantel.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <Link to={`/empleados/${emp.id}`} className="hover:underline">
                        <PersonCell nombre={emp.apellido ? `${emp.apellido}, ${emp.nombre}` : emp.nombre} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Status tone={emp.estado === "activo" ? "success" : emp.estado === "baja" ? "neutral" : "warning"}>
                        {estadoLabel(emp.estado)}
                      </Status>
                    </TableCell>
                    <TableCell>
                      {emp.device_token ? <Status tone="success">Vinculado</Status> : <Status tone="neutral">Sin vincular</Status>}
                    </TableCell>
                    <TableCell className="text-right">
                      {idsAdentro.has(emp.id) ? (
                        <Status tone="success">Adentro</Status>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {plantel.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-text-tertiary">Todavía no hay empleados asignados a esta sucursal.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <h3 className="text-[14px] font-semibold text-text">Marcado por QR</h3>
            <div className="mt-3 flex h-32 w-32 items-center justify-center rounded-[8px] border border-border bg-surface">
              {qrUrl ? (
                <img src={qrUrl} alt={`QR de ${sucursal.nombre}`} className="h-full w-full object-contain p-2" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
              )}
            </div>
            {org && <p className="mt-3 break-all font-mono text-[11px] text-text-tertiary">{urlMarcado}</p>}
            <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">
              Imprimí el QR y pegalo en la entrada. El empleado escanea, se identifica y marca desde su propio teléfono.
            </p>
          </Card>

          <Card>
            <h3 className="text-[14px] font-semibold text-text">Ubicación y geocerca</h3>
            {sucursal.lat != null && sucursal.lon != null ? (
              <>
                <div className="relative mt-3 h-32 overflow-hidden rounded-[8px] border border-border bg-surface">
                  <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:16px_16px]" />
                  <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent-300 bg-accent-100/50" />
                  <MapPin className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-accent-700" />
                </div>
                <dl className="mt-3 flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-tertiary">Coordenadas</dt>
                    <dd className="font-mono text-text">{sucursal.lat.toFixed(4)}, {sucursal.lon.toFixed(4)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-tertiary">Radio</dt>
                    <dd className="text-text">{sucursal.radio_metros} m</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-3 text-[13px] text-warning">
                Sin ubicación cargada: las marcas de esta sucursal no se pueden validar por geocerca.
              </p>
            )}
          </Card>
        </div>
      </div>

      <Dialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setError(null); }}
        title={`Editar ${sucursal.nombre}`}
        className="max-w-[560px]"
      >
        <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-3">
          <Field label="Nombre" required value={editNombre} onChange={(e) => setEditNombre(e.target.value)} containerClassName="w-full" />
          <Field label="Radio (m)" value={editRadio} onChange={(e) => setEditRadio(e.target.value)} containerClassName="w-full" />
          <MapaUbicacion
            value={editCoords}
            onChange={(c, d) => { setEditCoords(c); setEditDireccion(d); }}
            radioMetros={parseNumero(editRadio)}
            direccionInicial={sucursal.direccion}
          />
          {error && (
            <ErrorPlan error={error}>
              <p className="text-[15px] text-alert">{error.message}</p>
            </ErrorPlan>
          )}
          <Button type="submit" variant="primary" block disabled={editar.isPending}>
            Guardar
          </Button>
        </form>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `App.tsx`**

Buscar:

```tsx
const SucursalesPage = lazy(() => import("./pages/sucursales/SucursalesPage"));
```

Agregar justo debajo:

```tsx
const SucursalDetallePage = lazy(() => import("./pages/sucursales/SucursalDetallePage"));
```

Buscar el bloque de la ruta `/sucursales`:

```tsx
            <Route
              path="/sucursales"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <SucursalesPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
```

Agregar justo debajo:

```tsx
            <Route
              path="/sucursales/:id"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <SucursalDetallePage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 3: Sacar el link a "Categorías de motivo" de `ConfiguracionPage.tsx`**

La gestión de categorías ya vive en la pestaña "Categorías" de Ausencias
(Task 2 de este plan) — se saca el link que hoy apunta genéricamente a
`/rrhh`, quedando solo el link a "Tolerancia de horarios" en esa sección.

Buscar:

```tsx
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link
            to="/rrhh"
            className="flex items-center gap-3 rounded-[6px] border border-border px-4 py-3 transition-colors hover:bg-text/[.04]"
          >
            <Briefcase className="h-[18px] w-[18px] text-accent-700" />
            <span className="flex-1">
              <span className="block text-[14px] font-semibold text-text">Categorías de motivo</span>
              <span className="block text-[12.5px] text-text-secondary">Se administran desde RRHH</span>
            </span>
            <ChevronRight className="h-4 w-4 text-text-tertiary" />
          </Link>
          <Link
            to="/turnos"
```

Reemplazar por:

```tsx
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link
            to="/turnos"
```

Si `Briefcase` (de `lucide-react`) queda sin otro uso en el archivo tras
este cambio, sacalo de su línea de import — verificalo con el build del
Step 4, no a ciegas.

- [ ] **Step 4: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/sucursales/SucursalDetallePage.tsx src/App.tsx src/pages/configuracion/ConfiguracionPage.tsx
git commit -m "feat: Detalle de sucursal (plantel, QR, geocerca) y ruta /sucursales/:id, saca el link de categorias de Configuracion"
```

---

## Al terminar

Con esto quedan Ausencias y Sucursales (listado + detalle nuevo)
alineadas con la spec y con la densidad visual ya establecida en la
etapa de fidelidad. Quedan la Etapa 7 (Configuración + Plan + Admin,
re-skin sin cambios de UX) y la Etapa 8 (revisión visual completa
cruzada contra R1/R3 y polish final) del plan original de 8 fases.
