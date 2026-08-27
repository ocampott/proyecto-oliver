# Rediseño R1/R3 — Etapa 4: Turnos + Horas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer Turnos (Horarios + Cumplimiento) y Horas con la estructura
de R3 (tabs compartidos, toolbar de filtros, Segmented, StatRow, Meter,
Sparkline) sobre la lógica de negocio ya existente, sin tocar backend.

**Architecture:** Cinco tasks. (0) Mueve `src/pages/asistencia/format.ts` a
`src/lib/format.ts` — pendiente de la revisión final de la Etapa 3, antes de
que más páginas importen del lugar viejo. (1) Cumplimiento: `FilterChip` →
`Toolbar`+`Select`, agrega `Segmented` Todos/Con desvío. (2) Horarios: sin
tocar el flujo existente (seleccionar empleado → franjas, plantillas,
asignación masiva), agrega ARRIBA una vista nueva de resumen — tabla de
todos los empleados con su semana como 7 chips y aviso de "activos sin
horario" — usando `useQueries` para traer los horarios de cada empleado en
paralelo (sin endpoint nuevo, el backend ya soporta `getHorarios(empleadoId)`
uno por uno). (3) `TurnosPage.tsx`: reemplaza el toggle de botones por
`Tabs`. (4) Horas: la más grande — agrega "esperadas"/"avance"/"extras" por
empleado (dato que hoy no expone el backend) calculándolo en el cliente a
partir del horario semanal de cada empleado (mismo patrón `useQueries` de
la Task 2) cruzado contra los días del rango elegido; StatRow, Sparkline,
Segmented de período (Mes/Quincena/Semana, atajo de fechas), Meter de
avance, y Toolbar reemplazando `FilterChip`+`MultiSelect` chip.

**Tech Stack:** Sin dependencias nuevas — `useQueries` es parte de
`@tanstack/react-query`, ya instalado. Componentes de la Etapa 1
(`Toolbar`, `Tabs`, `Segmented`, `StatRow`, `Meter`, `Sparkline`) ya
mergeados en la rama base de esta etapa.

**Spec:** `docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md`

## Global Constraints

- **Sin cambios de backend** — todo sale de endpoints ya existentes.
  `getHorarios(empleadoId)` solo acepta un empleado a la vez; para la
  vista de "todos los empleados" (Task 2) y para "horas esperadas" (Task
  4) se llama una vez por empleado con `useQueries` (fetch en paralelo,
  ya cacheado por React Query bajo la misma `queryKey: ["horarios", id]`
  que usa el resto de la página de Turnos — no duplica pedidos si el
  usuario ya visitó ambas vistas).
- **`ResumenEmpleado` (backend) no tiene `empleado_id`, solo `nombre`** —
  no es seguro usarlo para cruzar contra horarios (dos empleados podrían
  compartir nombre). La Task 4 arma su propio resumen a partir de
  `turnos` (que sí trae `empleado_id`), sin usar el `resumen` que ya
  devuelve `getHoras`.
- **"Horas esperadas" es un cálculo aproximado, no oficial**: suma, por
  cada día del rango elegido, los minutos de las franjas cargadas para
  ese día de la semana — no descuenta ausencias ni feriados
  (`ponytail: cálculo simple por día-de-semana × rango; si hace falta
  descontar ausencias/feriados, cruzar contra el módulo de Ausencias en
  una etapa posterior`). Se documenta esto en la sección "Cómo se
  calcula" de la página, igual que ya hacía R3.
- **Se preserva toda la lógica de negocio existente**: alta/edición/
  borrado de franjas horarias, plantillas, asignación masiva a varios
  empleados, tolerancia general y su guardado, cálculo de cumplimiento,
  exportar Horas a Excel, gating por plan/rol (`ErrorPlan`), timezone
  `America/Argentina/Buenos_Aires`.
- **Sin sincronizar nada a la URL** — mismo criterio que la Etapa 3.
- **Sin tests automatizados de UI** — verificación es `npm run build`,
  con `rm -f node_modules/.tmp/*.tsbuildinfo` antes de cada build.

---

## Task 0: Mover `format.ts` de `pages/asistencia` a `lib`

**Files:**
- Create: `src/lib/format.ts`
- Delete: `src/pages/asistencia/format.ts`
- Modify: `src/components/dashboard/PulsoOperativo.tsx`
- Modify: `src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:**
- `src/lib/format.ts` exporta exactamente lo mismo que el archivo viejo:
  `horaLocal`, `horaCorta`, `fechaLocal`, `MOTIVOS_RECHAZO` — mismas
  firmas, mismo comportamiento, solo cambia la ruta de import del tipo
  `MotivoRechazo` (de `../../lib/api` a `./api`, porque ahora vive al
  lado).

- [ ] **Step 1: Crear `src/lib/format.ts`**

```ts
import type { MotivoRechazo } from "./api";

const AR_TZ = "America/Argentina/Buenos_Aires";

export function horaLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

export function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: AR_TZ,
  });
}

export const MOTIVOS_RECHAZO: Record<MotivoRechazo, string> = {
  fuera_de_rango: "Fuera de rango",
  sucursal_sin_gps: "Sucursal sin GPS configurado",
  nombre_no_encontrado: "Nombre no encontrado en la nómina",
  dispositivo_ya_vinculado: "Ya vinculado a otro dispositivo",
};
```

- [ ] **Step 2: Borrar el archivo viejo**

```bash
rm src/pages/asistencia/format.ts
```

- [ ] **Step 3: Actualizar el import en `PulsoOperativo.tsx`**

Buscar:

```tsx
import { horaLocal, horaCorta, MOTIVOS_RECHAZO } from "../../pages/asistencia/format";
```

Reemplazar por:

```tsx
import { horaLocal, horaCorta, MOTIVOS_RECHAZO } from "../../lib/format";
```

- [ ] **Step 4: Actualizar el import en `AsistenciaPage.tsx`**

Buscar:

```tsx
import { horaLocal, fechaLocal, MOTIVOS_RECHAZO } from "./format";
```

Reemplazar por:

```tsx
import { horaLocal, fechaLocal, MOTIVOS_RECHAZO } from "../../lib/format";
```

- [ ] **Step 5: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/format.ts src/pages/asistencia/format.ts src/components/dashboard/PulsoOperativo.tsx src/pages/asistencia/AsistenciaPage.tsx
git commit -m "refactor: mover format.ts de pages/asistencia a lib (pendiente de la Etapa 3)"
```

---

## Task 1: Turnos — Cumplimiento con Toolbar + Segmented

**Files:**
- Modify: `src/pages/turnos/CumplimientoTab.tsx`

**Interfaces:**
- Consumes: `Toolbar`, `Segmented` (Etapa 1). Deja de usar `FilterChip`.
- Sin cambios a `./hooks` — misma lógica de negocio.

- [ ] **Step 1: Reemplazar `CumplimientoTab.tsx` completo**

```tsx
import { useState } from "react";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { Segmented } from "../../components/ui/segmented";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Status, type StatusProps } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { CumplimientoRow } from "../../lib/api";
import { useSucursales } from "../sucursales/hooks";
import { useEmpleados } from "../empleados/hooks";
import { useCumplimiento, useTolerancia, useGuardarTolerancia } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: AR_TZ, hour: "2-digit", minute: "2-digit" });
}

function diffLabel(min: number | null): string {
  if (min === null) return "—";
  if (min <= 0) return "a tiempo";
  return `+${min} min`;
}

const ESTADO_INFO: Record<CumplimientoRow["estado"], { label: string; tone: StatusProps["tone"] }> = {
  a_horario: { label: "A horario", tone: "success" },
  tarde: { label: "Tarde", tone: "warning" },
  salida_anticipada: { label: "Salida anticipada", tone: "warning" },
  tarde_y_anticipada: { label: "Tarde y salida anticipada", tone: "warning" },
  sin_horario: { label: "Sin horario definido", tone: "neutral" },
};

const CON_DESVIO: CumplimientoRow["estado"][] = ["tarde", "salida_anticipada", "tarde_y_anticipada"];

type VistaCumplimiento = "todos" | "con_desvio";

export default function CumplimientoTab() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [sucursalId, setSucursalId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [vista, setVista] = useState<VistaCumplimiento>("todos");
  const [toleranciaInput, setToleranciaInput] = useState("");
  const toast = useToast();

  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const { data: empleados = [] } = useEmpleados();
  const { data: filas = [], isLoading, isError } = useCumplimiento({
    desde,
    hasta,
    sucursalId: sucursalId || undefined,
    empleadoId: empleadoId || undefined,
  });
  const { data: toleranciaData } = useTolerancia();
  const guardarTolerancia = useGuardarTolerancia();

  const toleranciaActual = toleranciaInput || toleranciaData?.tolerancia_min?.toString() || "";
  const filtrosActivos = sucursalId !== "" || empleadoId !== "";

  function limpiarFiltros() {
    setSucursalId("");
    setEmpleadoId("");
  }

  async function handleGuardarTolerancia() {
    try {
      await guardarTolerancia.mutateAsync(Number(toleranciaActual));
      toast.success("Tolerancia actualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la tolerancia.");
    }
  }

  const filasFiltradas = vista === "con_desvio" ? filas.filter((f) => CON_DESVIO.includes(f.estado)) : filas;

  return (
    <>
      <Card className="mt-4">
        <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-text">Tolerancia general</h2>
        <p className="mt-1 text-[13.5px] text-text-secondary">
          Minutos de margen antes de marcar un turno como "tarde" o "salida anticipada" — aplica salvo que la franja tenga su propia tolerancia.
        </p>
        <div className="mt-3 flex items-end gap-3">
          <Field label="Minutos" type="number" value={toleranciaActual} onChange={(e) => setToleranciaInput(e.target.value)} containerClassName="w-32" />
          <Button variant="secondary" onClick={handleGuardarTolerancia} disabled={guardarTolerancia.isPending}>
            Guardar
          </Button>
        </div>
      </Card>

      <Toolbar>
        <Field label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-40" />
        <Field label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-40" />
        <Select
          label="Sucursal"
          value={sucursalId}
          onChange={(e) => setSucursalId(e.target.value)}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-44"
        />
        <Select
          label="Empleado"
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
          options={[{ value: "", label: "Todos" }, ...empleados.map((e) => ({ value: e.id, label: e.nombre }))]}
          containerClassName="w-44"
        />
        <Segmented
          value={vista}
          onChange={setVista}
          options={[
            { value: "todos", label: "Todos" },
            { value: "con_desvio", label: "Con desvío" },
          ]}
        />
        <div className="ml-auto flex items-center gap-3">
          {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
          <span className="font-mono text-xs text-text-tertiary">{filasFiltradas.length} resultados</span>
        </div>
      </Toolbar>

      {isError && (
        <p className="mt-2 text-[15px] text-alert">No se pudo cargar el cumplimiento. Probá de nuevo.</p>
      )}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Salida</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            filasFiltradas.map((f, i) => (
              <TableRow key={i}>
                <TableCell>{f.nombre}</TableCell>
                <TableCell>{f.sucursal_nombre}</TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell>
                  {horaLocal(f.entrada_real)}
                  {f.entrada_esperada && <span className="text-text-tertiary"> (esperado {f.entrada_esperada}, {diffLabel(f.diff_entrada_min)})</span>}
                </TableCell>
                <TableCell>
                  {f.en_curso ? "En curso" : f.salida_real ? horaLocal(f.salida_real) : "—"}
                  {f.salida_esperada && f.salida_real && <span className="text-text-tertiary"> (esperado {f.salida_esperada}, {diffLabel(f.diff_salida_min)})</span>}
                </TableCell>
                <TableCell>
                  <Status tone={ESTADO_INFO[f.estado].tone}>{ESTADO_INFO[f.estado].label}</Status>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && filasFiltradas.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text-tertiary">Sin turnos en este rango.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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
git add src/pages/turnos/CumplimientoTab.tsx
git commit -m "feat: Cumplimiento con Toolbar de filtros y Segmented Todos/Con desvío"
```

---

## Task 2: Turnos — resumen de Horarios por empleado

**Files:**
- Modify: `src/pages/turnos/HorariosTab.tsx`

**Interfaces:**
- Consumes: `useQueries` (`@tanstack/react-query`, ya instalado);
  `getHorarios` (`src/lib/api.ts`, ya existente, se importa directo acá
  además de a través de `./hooks`).
- No cambia ninguna función de `./hooks` ni ningún flujo existente
  (alta/edición/borrado de franjas, plantillas, asignación masiva) — el
  resumen nuevo es puramente aditivo, arriba del contenido actual.
  `onSelectEmpleado` del resumen nuevo reusa el `setEmpleadoIdManual` que
  ya existe en el componente — clickear una fila del resumen mueve la
  sección de detalle (debajo) a ese empleado, sin duplicar estado.

- [ ] **Step 1: Ampliar los imports**

Buscar:

```tsx
import type { HorarioEmpleado, TurnoTemplate } from "../../lib/api";
```

Reemplazar por:

```tsx
import { getHorarios, type HorarioEmpleado, type TurnoTemplate, type Empleado, type Sucursal } from "../../lib/api";
import { useQueries } from "@tanstack/react-query";
```

- [ ] **Step 2: Agregar el componente `HorariosOverview`**

Buscar el final de `DiaToggle` (justo antes de `export default function HorariosTab() {`):

```tsx
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

export default function HorariosTab() {
```

Insertar el nuevo componente entre ambos, quedando:

```tsx
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
  const horariosQueries = useQueries({
    queries: empleados.map((e) => ({ queryKey: ["horarios", e.id], queryFn: () => getHorarios(e.id) })),
  });
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
              <TableRow key={f.empleado.id} className="cursor-pointer" onClick={() => onSelectEmpleado(f.empleado.id)}>
                <TableCell>{f.empleado.nombre}</TableCell>
                <TableCell>{f.sucursal}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {ORDEN_DIAS.map((d) => (
                      <span
                        key={d}
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
```

- [ ] **Step 3: Montar `HorariosOverview` arriba del detalle por empleado**

Buscar:

```tsx
  return (
    <>
      <div className="page-filters">
        <Select
          label="Empleado"
```

Reemplazar por:

```tsx
  return (
    <>
      <HorariosOverview empleados={empleados} sucursales={sucursales} onSelectEmpleado={setEmpleadoIdManual} />

      <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-text">Detalle por empleado</h2>

      <div className="page-filters">
        <Select
          label="Empleado"
```

- [ ] **Step 4: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/turnos/HorariosTab.tsx
git commit -m "feat: resumen de Horarios por empleado (semana en 7 chips + aviso de activos sin horario)"
```

---

## Task 3: `TurnosPage.tsx` con `Tabs`

**Files:**
- Modify: `src/pages/turnos/TurnosPage.tsx`

**Interfaces:**
- Consumes: `Tabs` (Etapa 1). `HorariosTab`/`CumplimientoTab` sin cambios
  de firma (siguen sin props).

- [ ] **Step 1: Reemplazar `TurnosPage.tsx` completo**

```tsx
import { useState } from "react";
import { Tabs } from "../../components/ui/tabs";
import { PageHeader } from "../../components/PageHeader";
import HorariosTab from "./HorariosTab";
import CumplimientoTab from "./CumplimientoTab";

type Tab = "horarios" | "cumplimiento";

export default function TurnosPage() {
  const [tab, setTab] = useState<Tab>("horarios");

  return (
    <>
      <PageHeader title="Turnos" />

      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "horarios", label: "Horarios" },
            { value: "cumplimiento", label: "Cumplimiento" },
          ]}
        />
      </div>

      {tab === "horarios" ? <HorariosTab /> : <CumplimientoTab />}
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
git add src/pages/turnos/TurnosPage.tsx
git commit -m "feat: TurnosPage con Tabs compartido en vez del toggle de botones"
```

---

## Task 4: Horas — StatRow, Sparkline, Segmented, Meter y horas esperadas

**Files:**
- Modify: `src/pages/horas/HorasPage.tsx`

**Interfaces:**
- Consumes: `useQueries` (`@tanstack/react-query`); `getHorarios` (`src/lib/api.ts`,
  reusa la misma `queryKey: ["horarios", id]` que ya usa Turnos — cache
  compartido); `StatRow`/`StatRowItem`, `Sparkline`, `Segmented`, `Meter`,
  `Toolbar` (Etapa 1).
- Ya no usa el `resumen` que devuelve `getHoras` (`ResumenEmpleado`, sin
  `empleado_id`) — arma su propio resumen (`ResumenFila`, con
  `empleadoId`) a partir de `turnos`, que sí lo trae.
- Sin cambios a `./hooks` (`useHoras`) ni a `exportarHoras`.

- [ ] **Step 1: Reemplazar `HorasPage.tsx` completo**

```tsx
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { MultiSelect } from "../../components/ui/multi-select";
import { Toolbar } from "../../components/ui/toolbar";
import { Segmented } from "../../components/ui/segmented";
import { Meter } from "../../components/ui/meter";
import { Sparkline } from "../../components/ui/sparkline";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Card } from "../../components/ui/card";
import { Status } from "../../components/ui/status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { PageHeader } from "../../components/PageHeader";
import { ErrorPlan } from "../../components/ErrorPlan";
import { useToast } from "../../components/ui/toast";
import { useHoras } from "./hooks";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { exportarHoras, getHorarios, type Turno, type HorarioEmpleado } from "../../lib/api";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function fechaHoraLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

type Periodo = "semana" | "quincena" | "mes";

function rangoPara(periodo: Periodo): { desde: string; hasta: string } {
  const hasta = hoyAR();
  if (periodo === "mes") return { desde: inicioDeMesAR(), hasta };
  const dias = periodo === "quincena" ? 15 : 7;
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return { desde: d.toLocaleDateString("sv", { timeZone: AR_TZ }), hasta };
}

// ponytail: cálculo aproximado por día-de-semana × rango — no descuenta
// ausencias ni feriados. Cruzar contra Ausencias si hace falta precisión,
// evaluar en una etapa posterior.
function calcularHorasEsperadas(horarios: HorarioEmpleado[], desde: string, hasta: string): number {
  const minutosPorDia = new Map<number, number>();
  for (const h of horarios) {
    const [hI, mI] = h.hora_inicio.split(":").map(Number);
    const [hF, mF] = h.hora_fin.split(":").map(Number);
    const minutos = Math.max(0, hF * 60 + mF - (hI * 60 + mI));
    minutosPorDia.set(h.dia_semana, (minutosPorDia.get(h.dia_semana) ?? 0) + minutos);
  }
  let totalMinutos = 0;
  const cursor = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  while (cursor <= fin) {
    totalMinutos += minutosPorDia.get(cursor.getDay()) ?? 0;
    cursor.setDate(cursor.getDate() + 1);
  }
  return totalMinutos / 60;
}

interface ResumenFila {
  empleadoId: string;
  nombre: string;
  sucursalId: string | null;
  dias: number;
  horas: number;
  esperadas: number;
  extras: number;
  enCurso: boolean;
}

function construirResumen(turnos: Turno[], esperadasPorEmpleado: Map<string, number>): ResumenFila[] {
  const horasPorEmpleado = new Map<string, number>();
  const diasPorEmpleado = new Map<string, Set<string>>();
  const enCursoPorEmpleado = new Map<string, boolean>();
  const nombrePorEmpleado = new Map<string, string>();
  const sucursalPorEmpleado = new Map<string, string | null>();

  for (const t of turnos) {
    horasPorEmpleado.set(t.empleado_id, (horasPorEmpleado.get(t.empleado_id) ?? 0) + (t.horas ?? 0));
    const dias = diasPorEmpleado.get(t.empleado_id) ?? new Set<string>();
    dias.add(t.entrada_at.slice(0, 10));
    diasPorEmpleado.set(t.empleado_id, dias);
    if (t.salida_at === null) enCursoPorEmpleado.set(t.empleado_id, true);
    nombrePorEmpleado.set(t.empleado_id, t.nombre);
    sucursalPorEmpleado.set(t.empleado_id, t.sucursal_id);
  }

  return Array.from(horasPorEmpleado.keys()).map((empleadoId) => {
    const horas = horasPorEmpleado.get(empleadoId) ?? 0;
    const esperadas = esperadasPorEmpleado.get(empleadoId) ?? 0;
    return {
      empleadoId,
      nombre: nombrePorEmpleado.get(empleadoId) ?? "—",
      sucursalId: sucursalPorEmpleado.get(empleadoId) ?? null,
      dias: diasPorEmpleado.get(empleadoId)?.size ?? 0,
      horas,
      esperadas,
      extras: Math.max(0, horas - esperadas),
      enCurso: enCursoPorEmpleado.get(empleadoId) ?? false,
    };
  });
}

function serieDiaria(turnos: Turno[]): number[] {
  const porDia = new Map<string, number>();
  for (const t of turnos) {
    const dia = t.entrada_at.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + (t.horas ?? 0));
  }
  return Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, h]) => h);
}

type Orden = "horas" | "extras" | "nombre";

export default function HorasPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [empleadosSel, setEmpleadosSel] = useState<string[]>([]);
  const [sucursalSel, setSucursalSel] = useState("");
  const [orden, setOrden] = useState<Orden>("horas");

  const { data, isLoading, isError, error } = useHoras(desde, hasta);
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const toast = useToast();
  const [descargando, setDescargando] = useState(false);

  async function handleDescargarExcel() {
    setDescargando(true);
    try {
      await exportarHoras(desde, hasta);
      toast.success("Excel descargado.");
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  const turnosTodos = data?.turnos ?? [];

  const hayFiltroEmpleados = empleadosSel.length > 0;
  const hayFiltroSucursal = sucursalSel !== "";
  const filtrosActivos = hayFiltroEmpleados || hayFiltroSucursal;

  function limpiarFiltros() {
    setEmpleadosSel([]);
    setSucursalSel("");
  }

  const turnos = turnosTodos.filter(
    (t) =>
      (!hayFiltroEmpleados || empleadosSel.includes(t.empleado_id)) &&
      (!hayFiltroSucursal || t.sucursal_id === sucursalSel)
  );

  const empleadoIdsConTurnos = [...new Set(turnos.map((t) => t.empleado_id))];
  const horariosQueries = useQueries({
    queries: empleadoIdsConTurnos.map((id) => ({ queryKey: ["horarios", id], queryFn: () => getHorarios(id) })),
  });
  const esperadasPorEmpleado = new Map<string, number>();
  empleadoIdsConTurnos.forEach((id, i) => {
    esperadasPorEmpleado.set(id, calcularHorasEsperadas(horariosQueries[i]?.data ?? [], desde, hasta));
  });

  const resumen = construirResumen(turnos, esperadasPorEmpleado);
  const resumenOrdenado = [...resumen].sort((a, b) => {
    if (orden === "horas") return b.horas - a.horas;
    if (orden === "extras") return b.extras - a.extras;
    return a.nombre.localeCompare(b.nombre);
  });

  const totalHoras = resumen.reduce((acc, r) => acc + r.horas, 0);
  const totalExtras = resumen.reduce((acc, r) => acc + r.extras, 0);
  const porDebajo = resumen.filter((r) => r.esperadas > 0 && r.horas / r.esperadas < 0.9).length;

  const sucursalNombre = new Map(sucursales.map((s) => [s.id, s.nombre]));

  const stats: StatRowItem[] = [
    { label: "Horas totales", value: totalHoras.toFixed(1), meta: `${resumen.length} empleados` },
    { label: "Horas extra", value: totalExtras.toFixed(1), tone: totalExtras > 20 ? "warning" : "default" },
    { label: "Por debajo de lo esperado", value: porDebajo, tone: porDebajo > 0 ? "warning" : "default" },
    { label: "Tendencia", value: <Sparkline data={serieDiaria(turnos)} className="text-accent" /> },
  ];

  return (
    <>
      <PageHeader
        title="Horas trabajadas"
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

      <Toolbar>
        <Field label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-40" />
        <Field label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-40" />
        <Segmented
          value={periodo}
          onChange={(p) => {
            setPeriodo(p);
            const rango = rangoPara(p);
            setDesde(rango.desde);
            setHasta(rango.hasta);
          }}
          options={[
            { value: "semana", label: "Semana" },
            { value: "quincena", label: "Quincena" },
            { value: "mes", label: "Mes" },
          ]}
        />
        <MultiSelect
          label="Empleados"
          value={empleadosSel}
          onChange={setEmpleadosSel}
          options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
          placeholder="Todos"
          containerClassName="w-52"
        />
        <Select
          label="Sucursal"
          value={sucursalSel}
          onChange={(e) => setSucursalSel(e.target.value)}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-44"
        />
        <Select
          label="Orden"
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          options={[
            { value: "horas", label: "Más horas" },
            { value: "extras", label: "Más extras" },
            { value: "nombre", label: "Por nombre" },
          ]}
          containerClassName="w-40"
        />
        <div className="ml-auto flex items-center gap-3">
          {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
          <span className="font-mono text-xs text-text-tertiary">{resumen.length} resultados</span>
        </div>
      </Toolbar>

      {isError && (
        <div className="mt-2">
          <ErrorPlan error={error instanceof Error ? error : null}>
            <p className="text-[15px] text-alert">No se pudieron cargar los datos. Probá de nuevo.</p>
          </ErrorPlan>
        </div>
      )}

      <section className="page-section">
        <h2>Resumen por empleado</h2>
        <Table containerClassName="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Horas</TableHead>
              <TableHead>Esperadas</TableHead>
              <TableHead>Avance</TableHead>
              <TableHead>Extras</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton cols={7} />}
            {!isLoading &&
              resumenOrdenado.map((r) => (
                <TableRow key={r.empleadoId}>
                  <TableCell>
                    {r.nombre}
                    {r.enCurso && (
                      <Status tone="accent" className="ml-2">
                        En curso
                      </Status>
                    )}
                  </TableCell>
                  <TableCell>{r.sucursalId ? (sucursalNombre.get(r.sucursalId) ?? "—") : "—"}</TableCell>
                  <TableCell>{r.dias}</TableCell>
                  <TableCell className="data-number">{r.horas.toFixed(2)}</TableCell>
                  <TableCell className="data-number">{r.esperadas > 0 ? r.esperadas.toFixed(2) : "—"}</TableCell>
                  <TableCell>{r.esperadas > 0 ? <Meter value={r.horas} max={r.esperadas} warnBelow={0.9} /> : "—"}</TableCell>
                  <TableCell className="data-number">{r.extras > 0 ? r.extras.toFixed(2) : "—"}</TableCell>
                </TableRow>
              ))}
            {!isLoading && resumenOrdenado.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-text-tertiary">
                  No hay datos en este rango.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="page-section">
        <h2>Turnos</h2>
        <Table containerClassName="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead>Horas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton cols={5} />}
            {turnos.map((t, i) => (
              <TableRow key={`${t.empleado_id}-${t.entrada_at}-${i}`}>
                <TableCell>{t.nombre}</TableCell>
                <TableCell>{t.sucursal_nombre}</TableCell>
                <TableCell>{fechaHoraLocal(t.entrada_at)}</TableCell>
                <TableCell>
                  {t.salida_at ? fechaHoraLocal(t.salida_at) : <Status tone="accent">En curso</Status>}
                </TableCell>
                <TableCell>{t.horas !== null ? t.horas.toFixed(2) : "—"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && turnos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text-tertiary">
                  No hay turnos en este rango.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <Card className="mt-6">
        <h3 className="text-[14px] font-semibold text-text">Cómo se calcula</h3>
        <p className="mt-1.5 text-[13px] text-text-secondary">
          Las horas trabajadas salen de los pares de entrada y salida marcados en Asistencia. Las horas
          esperadas salen del horario semanal cargado en Turnos, multiplicado por los días del período
          elegido — no descuenta ausencias ni feriados. El avance compara ambas; las extras son las horas
          por encima de lo esperado. Las marcas todavía no aprobadas en Asistencia no se contabilizan hasta
          que se resuelven.
        </p>
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores. `ResumenEmpleado` deja de importarse en este
archivo (ya no se usa); si algún otro archivo del proyecto todavía lo
importa, no es afectado por este cambio (el tipo sigue existiendo en
`src/lib/api.ts`, solo se dejó de consumir acá).

- [ ] **Step 3: Commit**

```bash
git add src/pages/horas/HorasPage.tsx
git commit -m "feat: Horas con StatRow, Sparkline, Segmented de período, Meter de avance y horas esperadas calculadas"
```

---

## Al terminar esta etapa

Con esto queda cerrada la Etapa 4 (Turnos + Horas). La Etapa 5 (Empleados
+ Detalle de empleado nuevo) se planifica en su propio documento una vez
revisada esta, mismo patrón que las etapas anteriores.
