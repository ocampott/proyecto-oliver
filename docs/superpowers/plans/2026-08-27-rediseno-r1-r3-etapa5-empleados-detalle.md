# Rediseño R1/R3 — Etapa 5: Empleados + Detalle de empleado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer Empleados con `Toolbar` (reemplaza `FilterChip`) y agregar
la página nueva de Detalle de empleado (`/empleados/:id`, funcionalidad
que no existía hasta ahora) con la estructura de 4 tabs de R3.

**Architecture:** Cuatro tasks. (1) Empleados: `FilterChip` → `Toolbar`+
`Select`, y las filas de la tabla pasan a navegar al detalle. (2) Extrae a
un archivo nuevo (`src/pages/turnos/calculos.ts`) dos piezas que la Etapa
4 dejó duplicadas/locales y que esta etapa necesita reusar desde una
tercera página: `calcularHorasEsperadas` (hoy vive dentro de
`HorasPage.tsx`) y `CON_DESVIO`/`ESTADO_INFO` (hoy viven dentro de
`CumplimientoTab.tsx`) — ambas páginas pasan a importarlas en vez de
redefinirlas. (3) Página nueva `EmpleadoDetallePage.tsx` + ruta
`/empleados/:id` en `App.tsx`: header con acciones (Vincular dispositivo/
Editar), `StatRow`, `Tabs` de 4, contenido real en Resumen y Asistencia.
(4) Completa la misma página con Horario y Ausencias — reemplaza el
archivo entero (superset estricto del Task 3).

**Tech Stack:** Sin dependencias nuevas. Reusa hooks/mutations ya
existentes de Empleados, Horas, Turnos, Asistencia y RRHH — cero
endpoints nuevos.

**Spec:** `docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md`

## Global Constraints

- **Sin cambios de backend** — no existe un endpoint `GET /empleados/:id`;
  el empleado se busca en la lista completa que ya trae `useEmpleados()`
  (`data.find(e => e.id === id)`). Si alguien entra directo por URL sin
  haber visitado antes `/empleados`, dispara un fetch normal de la lista
  completa — no es un problema, es el mismo patrón que ya usan otras
  páginas de este proyecto.
- **El diálogo de edición del Detalle es una versión recortada** del que
  ya existe en `EmpleadosPage.tsx` — solo nombre, apellido, celular,
  sucursal y estado. CUIL y fecha de ingreso quedan afuera (para editar
  esos dos campos, todavía hay que ir a la lista) — recorte de alcance
  deliberado, no un olvido; `EditarEmpleadoInput` tiene todos los campos
  opcionales así que no rompe nada.
- **El Detalle NO incluye "Desvincular dispositivo" ni "Eliminar"** —
  ambas acciones siguen existiendo, pero solo desde `EmpleadosPage.tsx`
  (eliminar en particular es destructivo e irreversible; mantenerlo en un
  solo lugar, el de contexto más deliberado, es la decisión correcta acá,
  no una limitación técnica).
- **"Suspender/dar de baja" del header (spec línea 179) se resuelve con
  dos afordancias, no tres**: un botón directo "Suspender" (visible solo
  si `estado === "activo"`, dispara `useEditarEmpleado` con
  `{estado: "suspendido"}` sin diálogo) que se convierte en "Reactivar"
  cuando el empleado está `suspendido`/`de_licencia`; y "Dar de baja" que
  queda dentro del diálogo de Editar (mismo Select de Estado que ya tiene
  esa opción) en vez de ser un botón de header aparte — mismo criterio
  que "Eliminar": una acción más deliberada no necesita un atajo de un
  solo click.
- **"Horas esperadas" en el Resumen usa el mismo cálculo aproximado que
  ya tiene Horas** (`calcularHorasEsperadas`, sección "Cómo se calcula" de
  `HorasPage.tsx`) — no descuenta ausencias ni feriados, ya documentado
  con `ponytail:` en la Etapa 4, no se repite el comentario acá porque el
  cálculo se importa, no se copia.
- **Se preserva toda la lógica de negocio existente**: alta/edición/baja/
  eliminación de empleados, vinculación por OTP, validación de CUIL,
  filtros/paginación de la lista, gating por plan (`maxEmpleados`) y rol.
- **Sin sincronizar nada a la URL** (salvo la ruta `/empleados/:id` en sí,
  que es la navegación misma, no un query param de estado de UI) — mismo
  criterio que las etapas anteriores.
- **Sin tests automatizados de UI** — verificación es `npm run build`, con
  `rm -f node_modules/.tmp/*.tsbuildinfo` antes de cada build.

---

## Task 1: Empleados — Toolbar + fila clickeable al detalle

**Files:**
- Modify: `src/pages/empleados/EmpleadosPage.tsx`

**Interfaces:**
- Consumes: `Toolbar` (Etapa 1). Deja de usar `FilterChip` y el botón de
  "Limpiar filtros" hecho a mano — pasa a usar el `ClearFiltersButton`
  compartido que ya usan Asistencia/Horas/Cumplimiento.
- Ninguna función de `./hooks` cambia — misma lógica de negocio exacta.
- La fila de la tabla navega a `/empleados/${emp.id}` (ruta que crea el
  Task 3 de este mismo plan) — hasta que ese task corra, la ruta no
  existe todavía y el click cae en el catch-all `*` → `NotFoundPage`; no
  es un problema porque las tasks corren en orden y se revisan al final
  de la etapa completa, no una por una contra el estado final.

- [ ] **Step 1: Ajustar el import de `lucide-react`**

Buscar:

```tsx
import { Search, Plus, Loader2, Copy, X } from "lucide-react";
```

Reemplazar por (se saca `X`, quedó sin uso al borrar el botón de limpiar filtros hecho a mano):

```tsx
import { Search, Plus, Loader2, Copy } from "lucide-react";
```

- [ ] **Step 2: Reemplazar `FilterChip` por `Toolbar`/`Select`/`ClearFiltersButton`, agregar `useNavigate`/`cn`**

Buscar:

```tsx
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { FilterChip } from "../../components/ui/filter-chip";
import { Status } from "../../components/ui/status";
```

Reemplazar por:

```tsx
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Status } from "../../components/ui/status";
import { cn } from "../../lib/utils";
```

- [ ] **Step 3: Agregar `navigate` al componente**

Buscar:

```tsx
export default function EmpleadosPage() {
  const { data: org } = useOrgActual();
```

Reemplazar por:

```tsx
export default function EmpleadosPage() {
  const navigate = useNavigate();
  const { data: org } = useOrgActual();
```

- [ ] **Step 4: Quitar el `kicker` del `PageHeader`**

Buscar:

```tsx
      <PageHeader kicker="Operación" title="Empleados" />
```

Reemplazar por:

```tsx
      <PageHeader title="Empleados" />
```

- [ ] **Step 5: Reemplazar el bloque de filtros completo**

Buscar:

```tsx
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterChip
          label="Estado"
          value={estadoFiltro}
          defaultValue="todos"
          onChange={(v) => { setEstadoFiltro(v as EstadoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activo", label: "Activo" },
            { value: "de_licencia", label: "De licencia" },
            { value: "suspendido", label: "Suspendido" },
            { value: "baja", label: "Baja" },
          ]}
        />
        <FilterChip
          label="Dispositivo"
          value={dispositivoFiltro}
          defaultValue="todos"
          onChange={(v) => { setDispositivoFiltro(v as DispositivoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "vinculado", label: "Vinculado" },
            { value: "no_vinculado", label: "No vinculado" },
          ]}
        />
        <FilterChip
          label="Sucursal"
          value={sucursalFiltro}
          defaultValue=""
          onChange={(v) => { setSucursalFiltro(v); setPage(1); }}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
        />
        <FilterChip
          label="CUIL"
          value={cuilFiltro}
          defaultValue="todos"
          onChange={(v) => { setCuilFiltro(v as CuilFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "con", label: "Con CUIL" },
            { value: "sin", label: "Sin CUIL" },
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
      <Toolbar>
        <Select
          label="Estado"
          value={estadoFiltro}
          onChange={(e) => { setEstadoFiltro(e.target.value as EstadoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activo", label: "Activo" },
            { value: "de_licencia", label: "De licencia" },
            { value: "suspendido", label: "Suspendido" },
            { value: "baja", label: "Baja" },
          ]}
          containerClassName="w-40"
        />
        <Select
          label="Dispositivo"
          value={dispositivoFiltro}
          onChange={(e) => { setDispositivoFiltro(e.target.value as DispositivoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "vinculado", label: "Vinculado" },
            { value: "no_vinculado", label: "No vinculado" },
          ]}
          containerClassName="w-40"
        />
        <Select
          label="Sucursal"
          value={sucursalFiltro}
          onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1); }}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-44"
        />
        <Select
          label="CUIL"
          value={cuilFiltro}
          onChange={(e) => { setCuilFiltro(e.target.value as CuilFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "con", label: "Con CUIL" },
            { value: "sin", label: "Sin CUIL" },
          ]}
          containerClassName="w-36"
        />
        <div className="ml-auto flex items-center gap-3">
          {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
          <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
        </div>
      </Toolbar>
```

- [ ] **Step 6: Hacer la fila clickeable (navega al detalle) y proteger la celda de acciones**

Buscar:

```tsx
              <TableRow key={emp.id} className={emp.estado === "baja" ? "text-text-muted" : ""}>
```

Reemplazar por:

```tsx
              <TableRow
                key={emp.id}
                role="button"
                tabIndex={0}
                className={cn("cursor-pointer", emp.estado === "baja" && "text-text-muted")}
                onClick={() => navigate(`/empleados/${emp.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/empleados/${emp.id}`);
                  }
                }}
              >
```

Buscar (la celda de acciones, justo antes de `<div className="flex justify-end gap-1.5">`):

```tsx
                <TableCell>
                  <div className="flex justify-end gap-1.5">
```

Reemplazar por (agrega `onClick` a la celda para que los botones de adentro no disparen también la navegación de la fila):

```tsx
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
```

- [ ] **Step 7: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores. El build no depende de que exista la ruta
`/empleados/:id` (eso es routing en runtime, no un import) — no hace
falta que el Task 3 haya corrido todavía.

- [ ] **Step 8: Commit**

```bash
git add src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat: Empleados con Toolbar de filtros y filas que navegan al detalle"
```

---

## Task 2: Extraer `calcularHorasEsperadas`/`CON_DESVIO`/`ESTADO_INFO` a `turnos/calculos.ts`

**Files:**
- Create: `src/pages/turnos/calculos.ts`
- Modify: `src/pages/horas/HorasPage.tsx`
- Modify: `src/pages/turnos/CumplimientoTab.tsx`

**Interfaces:**
- Produces: `calcularHorasEsperadas(horarios: HorarioEmpleado[], desde:
  string, hasta: string): number`, `CON_DESVIO: CumplimientoRow["estado"][]`,
  `ESTADO_INFO: Record<CumplimientoRow["estado"], { label: string; tone:
  StatusProps["tone"] }>` — mismas firmas exactas que ya tenían dentro de
  `HorasPage.tsx`/`CumplimientoTab.tsx`, solo cambia dónde viven. El Task 3
  de este mismo plan importa `calcularHorasEsperadas` desde acá para el
  Resumen del Detalle de empleado.

- [ ] **Step 1: Crear `src/pages/turnos/calculos.ts`**

```ts
import type { CumplimientoRow, HorarioEmpleado } from "../../lib/api";
import type { StatusProps } from "../../components/ui/status";

// ponytail: cálculo aproximado por día-de-semana × rango — no descuenta
// ausencias ni feriados. Cruzar contra Ausencias si hace falta precisión,
// evaluar en una etapa posterior.
export function calcularHorasEsperadas(horarios: HorarioEmpleado[], desde: string, hasta: string): number {
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

export const CON_DESVIO: CumplimientoRow["estado"][] = ["tarde", "salida_anticipada", "tarde_y_anticipada"];

export const ESTADO_INFO: Record<CumplimientoRow["estado"], { label: string; tone: StatusProps["tone"] }> = {
  a_horario: { label: "A horario", tone: "success" },
  tarde: { label: "Tarde", tone: "warning" },
  salida_anticipada: { label: "Salida anticipada", tone: "warning" },
  tarde_y_anticipada: { label: "Tarde y salida anticipada", tone: "warning" },
  sin_horario: { label: "Sin horario definido", tone: "neutral" },
};
```

- [ ] **Step 2: Quitar la definición local de `calcularHorasEsperadas` en `HorasPage.tsx` e importarla**

Buscar:

```tsx
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
```

Borrar ese bloque completo (la función y su comentario `ponytail:`) — no reemplaza por nada en ese lugar.

Buscar el import de `../../lib/api` en el mismo archivo:

```tsx
import { exportarHoras, type Turno, type HorarioEmpleado } from "../../lib/api";
```

Agregar justo debajo:

```tsx
import { calcularHorasEsperadas, ESTADO_INFO } from "../turnos/calculos";
```

(`type HorarioEmpleado` se mantiene en el import de `../../lib/api` — todavía se usa como tipo del parámetro `horarios` en otras partes del archivo si corresponde; si `HorarioEmpleado` quedara sin otro uso en este archivo tras el cambio, el build lo va a marcar como error de import sin usar — verificar en el Step 4.)

- [ ] **Step 3: Quitar `CON_DESVIO`/`ESTADO_INFO` de `CumplimientoTab.tsx` e importarlas**

Buscar:

```tsx
const ESTADO_INFO: Record<CumplimientoRow["estado"], { label: string; tone: StatusProps["tone"] }> = {
  a_horario: { label: "A horario", tone: "success" },
  tarde: { label: "Tarde", tone: "warning" },
  salida_anticipada: { label: "Salida anticipada", tone: "warning" },
  tarde_y_anticipada: { label: "Tarde y salida anticipada", tone: "warning" },
  sin_horario: { label: "Sin horario definido", tone: "neutral" },
};

const CON_DESVIO: CumplimientoRow["estado"][] = ["tarde", "salida_anticipada", "tarde_y_anticipada"];
```

Borrar ese bloque completo.

Buscar el import de `../../lib/api` en el mismo archivo:

```tsx
import type { CumplimientoRow } from "../../lib/api";
```

Agregar justo debajo:

```tsx
import { CON_DESVIO, ESTADO_INFO } from "./calculos";
```

(`type CumplimientoRow` se mantiene — sigue usándose como tipo en otras partes del archivo. Si tras este cambio `StatusProps` quedara sin otro uso en el archivo aparte de la definición borrada, el build lo va a marcar — verificar en el Step 4.)

- [ ] **Step 4: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores. Si aparece un import sin usar (`HorarioEmpleado` en
`HorasPage.tsx` o `StatusProps` en `CumplimientoTab.tsx`), sacarlo de su
línea de import correspondiente — no debería pasar porque ambos siguen
usándose en otras partes de esos archivos, pero si el build lo marca,
confiar en el compilador y corregirlo.

- [ ] **Step 5: Commit**

```bash
git add src/pages/turnos/calculos.ts src/pages/horas/HorasPage.tsx src/pages/turnos/CumplimientoTab.tsx
git commit -m "refactor: extraer calcularHorasEsperadas/CON_DESVIO/ESTADO_INFO a turnos/calculos.ts"
```

---

## Task 3: Detalle de empleado — página nueva (Resumen + Asistencia) + ruta

**Files:**
- Create: `src/pages/empleados/EmpleadoDetallePage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `calcularHorasEsperadas` (Task 2 de este mismo plan);
  `useEmpleados`, `useEditarEmpleado`, `useGenerarOtp` (`./hooks`, ya
  existentes); `useSucursales` (`../sucursales/hooks`); `useHoras`
  (`../horas/hooks`); `useHorarios`, `useCumplimiento`
  (`../turnos/hooks`); `useAsistenciaPaginada` (`../asistencia/hooks`);
  `horaLocal` (`../../lib/format`); `StatRow`, `Tabs` (Etapa 1).
- Produces: ruta `/empleados/:id` en `App.tsx` — el Task 1 de este plan ya
  asume que existe (las filas de `EmpleadosPage.tsx` navegan ahí).

- [ ] **Step 1: Crear `src/pages/empleados/EmpleadoDetallePage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { Pencil, KeyRound, Loader2, LogIn, LogOut } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Dialog } from "../../components/ui/dialog";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { Tabs } from "../../components/ui/tabs";
import { Status } from "../../components/ui/status";
import { Card } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import type { Empleado } from "../../lib/api";
import { horaLocal } from "../../lib/format";
import { useEmpleados, useEditarEmpleado, useGenerarOtp } from "./hooks";
import { useSucursales } from "../sucursales/hooks";
import { useHoras } from "../horas/hooks";
import { useHorarios, useCumplimiento } from "../turnos/hooks";
import { useAsistenciaPaginada } from "../asistencia/hooks";
import { calcularHorasEsperadas, ESTADO_INFO } from "../turnos/calculos";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function hace30Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toLocaleDateString("sv", { timeZone: AR_TZ });
}

function fechaLocal(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR");
}

function nombreCompleto(emp: Empleado): string {
  return emp.apellido ? `${emp.apellido}, ${emp.nombre}` : emp.nombre;
}

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function estadoLabel(estado: Empleado["estado"]): string {
  if (estado === "activo") return "Activo";
  if (estado === "de_licencia") return "De licencia";
  if (estado === "suspendido") return "Suspendido";
  return "Baja";
}

type Vista = "resumen" | "asistencia" | "horario" | "ausencias";

export default function EmpleadoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [vista, setVista] = useState<Vista>("resumen");

  const { data: empleados, isLoading: empleadosLoading } = useEmpleados();
  const empleado = empleados?.find((e) => e.id === id);
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];

  const desde = inicioDeMesAR();
  const hasta = hoyAR();
  const { data: horasData } = useHoras(desde, hasta);
  const { data: horarios = [] } = useHorarios(id ?? "");
  const { data: cumplimiento30 = [] } = useCumplimiento({ desde: hace30Dias(), hasta, empleadoId: id });
  const cumplimientoHoy = cumplimiento30.find((f) => f.fecha === hasta);

  const turnosEmpleado = (horasData?.turnos ?? []).filter((t) => t.empleado_id === id);
  const horasTrabajadas = turnosEmpleado.reduce((acc, t) => acc + (t.horas ?? 0), 0);
  const esperadas = calcularHorasEsperadas(horarios, desde, hasta);
  const extras = esperadas > 0 ? Math.max(0, horasTrabajadas - esperadas) : 0;
  const desviosCount = cumplimiento30.filter((f) => f.estado !== "a_horario" && f.estado !== "sin_horario").length;

  const [editOpen, setEditOpen] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editSucursalId, setEditSucursalId] = useState("");
  const [editEstado, setEditEstado] = useState<Empleado["estado"]>("activo");
  const [error, setError] = useState<string | null>(null);
  const editar = useEditarEmpleado();
  const generarCodigo = useGenerarOtp();
  const [codigoDialog, setCodigoDialog] = useState<{ code: string } | null>(null);
  const [generando, setGenerando] = useState(false);

  function abrirEdicion() {
    if (!empleado) return;
    setError(null);
    setEditNombre(empleado.nombre);
    setEditApellido(empleado.apellido ?? "");
    setEditCelular(empleado.celular ?? "");
    setEditSucursalId(empleado.sucursal_id ?? "");
    setEditEstado(empleado.estado);
    setEditOpen(true);
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!empleado) return;
    setError(null);
    try {
      await editar.mutateAsync({
        id: empleado.id,
        patch: {
          nombre: editNombre,
          apellido: editApellido || undefined,
          celular: editCelular || null,
          sucursal_id: editSucursalId || null,
          estado: editEstado,
        },
      });
      setEditOpen(false);
      toast.success("Empleado actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGenerarCodigo() {
    if (!empleado) return;
    setGenerando(true);
    try {
      const otp = await generarCodigo.mutateAsync(empleado.id);
      setCodigoDialog({ code: otp.code });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  async function handleToggleEstado(nuevoEstado: Empleado["estado"]) {
    if (!empleado) return;
    try {
      await editar.mutateAsync({ id: empleado.id, patch: { estado: nuevoEstado } });
      toast.success(nuevoEstado === "activo" ? "Empleado reactivado." : "Empleado suspendido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  if (empleadosLoading) {
    return <p className="text-text-tertiary">Cargando...</p>;
  }

  if (!empleado) {
    return (
      <>
        <PageHeader breadcrumb={[{ label: "Empleados", href: "/empleados" }]} title="Empleado no encontrado" />
        <p className="mt-4 text-text-secondary">
          No encontramos este empleado.{" "}
          <Link to="/empleados" className="text-accent-700 hover:underline">
            Volver a Empleados
          </Link>
          .
        </p>
      </>
    );
  }

  const sucursalNombre = sucursales.find((s) => s.id === empleado.sucursal_id)?.nombre;

  const stats: StatRowItem[] = [
    {
      label: "Horas del período",
      value: horasTrabajadas.toFixed(1),
      meta: esperadas > 0 ? `de ${esperadas.toFixed(1)} esperadas` : undefined,
    },
    { label: "Extras", value: extras.toFixed(1), tone: extras > 8 ? "warning" : "default" },
    {
      label: "Desvíos de turno",
      value: desviosCount,
      meta: "últimos 30 días",
      tone: desviosCount > 0 ? "warning" : "default",
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Empleados", href: "/empleados" }]}
        title={nombreCompleto(empleado)}
        meta={
          <Status tone={empleado.estado === "activo" ? "success" : empleado.estado === "baja" ? "neutral" : "warning"}>
            {estadoLabel(empleado.estado)}
          </Status>
        }
        actions={
          <div className="flex gap-2">
            {!empleado.device_token && (
              <Button variant="secondary" onClick={handleGenerarCodigo} disabled={generando}>
                {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Vincular dispositivo
              </Button>
            )}
            {empleado.estado === "activo" && (
              <Button variant="secondary" onClick={() => handleToggleEstado("suspendido")} disabled={editar.isPending}>
                Suspender
              </Button>
            )}
            {(empleado.estado === "suspendido" || empleado.estado === "de_licencia") && (
              <Button variant="secondary" onClick={() => handleToggleEstado("activo")} disabled={editar.isPending}>
                Reactivar
              </Button>
            )}
            <Button variant="secondary" onClick={abrirEdicion}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </div>
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
            { value: "resumen", label: "Resumen" },
            { value: "asistencia", label: "Asistencia" },
            { value: "horario", label: "Horario" },
            { value: "ausencias", label: "Ausencias" },
          ]}
        />
      </div>

      {vista === "resumen" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-[14px] font-semibold text-text">Datos personales</h3>
            <dl className="mt-3 flex flex-col gap-3 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">CUIL</dt>
                <dd className="text-text">{empleado.cuil ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Celular</dt>
                <dd className="text-text">{empleado.celular ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Fecha de ingreso</dt>
                <dd className="text-text">{empleado.fecha_ingreso ? fechaLocal(empleado.fecha_ingreso) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Sucursal</dt>
                <dd className="text-text">{sucursalNombre ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-tertiary">Dispositivo</dt>
                <dd>
                  {empleado.device_token ? (
                    <Status tone="success">Vinculado</Status>
                  ) : empleado.otp ? (
                    <Status tone="warning">Código pendiente</Status>
                  ) : (
                    <Status tone="neutral">Sin vincular</Status>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-tertiary">Cumplimiento de hoy</dt>
                <dd>
                  {cumplimientoHoy ? (
                    <Status tone={ESTADO_INFO[cumplimientoHoy.estado].tone}>{ESTADO_INFO[cumplimientoHoy.estado].label}</Status>
                  ) : (
                    <Status tone="neutral">Sin marcar</Status>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="text-[14px] font-semibold text-text">Últimas marcas</h3>
            <ul className="mt-3 flex flex-col gap-2.5 text-[13.5px]">
              {turnosEmpleado.slice(0, 6).map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-text-secondary">
                    {t.salida_at ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                    {t.salida_at ? "Salió" : "Entró"}
                  </span>
                  <span className="font-mono text-xs text-text-tertiary">{horaLocal(t.salida_at ?? t.entrada_at)}</span>
                </li>
              ))}
              {turnosEmpleado.length === 0 && <li className="text-text-tertiary">Sin marcas en el período.</li>}
            </ul>
          </Card>
        </div>
      )}

      {vista === "asistencia" && <AsistenciaTab empleadoId={empleado.id} />}

      <Dialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setError(null);
        }}
        title={`Editar ${nombreCompleto(empleado)}`}
      >
        <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-3">
          <Field label="Nombre" required value={editNombre} onChange={(e) => setEditNombre(e.target.value)} containerClassName="w-full" />
          <Field label="Apellido (opcional)" value={editApellido} onChange={(e) => setEditApellido(e.target.value)} containerClassName="w-full" />
          <Field label="Celular (opcional)" value={editCelular} onChange={(e) => setEditCelular(e.target.value)} containerClassName="w-full" />
          <Select
            label="Sucursal (opcional)"
            value={editSucursalId}
            onChange={(e) => setEditSucursalId(e.target.value)}
            options={[{ value: "", label: "Sin asignar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
            containerClassName="w-full"
          />
          <Select
            label="Estado"
            value={editEstado}
            onChange={(e) => setEditEstado(e.target.value as Empleado["estado"])}
            options={[
              { value: "activo", label: "Activo" },
              { value: "de_licencia", label: "De licencia" },
              { value: "suspendido", label: "Suspendido" },
              { value: "baja", label: "Baja" },
            ]}
            containerClassName="w-full"
          />
          {error && <p className="text-[15px] text-alert">{error}</p>}
          <Button type="submit" variant="primary" block disabled={editar.isPending}>
            Guardar
          </Button>
        </form>
      </Dialog>

      <Dialog open={codigoDialog != null} onClose={() => setCodigoDialog(null)} title="Código de vinculación">
        <div className="data-number text-center text-4xl font-medium tracking-[0.14em] text-text">
          {codigoDialog ? formatCode(codigoDialog.code) : ""}
        </div>
        <p className="text-center text-[13.5px] text-text-secondary">Vence en 10 minutos. Dictáselo a {empleado.nombre}.</p>
        <Button variant="ghost" block onClick={() => setCodigoDialog(null)}>
          Cerrar
        </Button>
      </Dialog>
    </>
  );
}

function AsistenciaTab({ empleadoId }: { empleadoId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const hoy = hoyAR();
  const desde = `${hoy.slice(0, 4)}-01-01`;
  const { data, isLoading } = useAsistenciaPaginada(desde, hoy, { page, pageSize, empleadoId });
  const registros = data?.data ?? [];

  return (
    <div className="mt-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Sucursal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={3} />}
          {!isLoading &&
            registros.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{horaLocal(r.created_at)}</TableCell>
                <TableCell>{r.tipo === "entrada" ? "Entrada" : "Salida"}</TableCell>
                <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
              </TableRow>
            ))}
          {!isLoading && registros.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-text-tertiary">
                Sin marcas este año.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
    </div>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `App.tsx`**

Buscar:

```tsx
const EmpleadosPage = lazy(() => import("./pages/empleados/EmpleadosPage"));
```

Agregar justo debajo:

```tsx
const EmpleadoDetallePage = lazy(() => import("./pages/empleados/EmpleadoDetallePage"));
```

Buscar el bloque de la ruta `/empleados`:

```tsx
            <Route
              path="/empleados"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <EmpleadosPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
```

Agregar justo debajo:

```tsx
            <Route
              path="/empleados/:id"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <EmpleadoDetallePage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 3: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/empleados/EmpleadoDetallePage.tsx src/App.tsx
git commit -m "feat: página de Detalle de empleado (Resumen + Asistencia) y ruta /empleados/:id"
```

---

## Task 4: Detalle de empleado — Horario + Ausencias

**Files:**
- Modify: `src/pages/empleados/EmpleadoDetallePage.tsx`

**Interfaces:**
- Consumes: `useAusencias` (`../rrhh/hooks`, ya existente) y `Meter`
  (`../../components/ui/meter`, Etapa 1) — ambos nuevos en este archivo.
- Este task reemplaza el archivo completo otra vez (superset estricto del
  Task 3) — agrega el tab Horario (usando `horarios`, ya traído por el
  Task 3 pero sin usar todavía en el render — la columna "Carga" satisface
  el requerimiento de spec de "barra visual por día" reusando `Meter`, sin
  componente nuevo), el tab Ausencias, un 4º stat en el `StatRow`
  ("Ausencias") que necesita el total de ausencias del año, y un indicador
  de "Cumplimiento de hoy" en el tab Resumen (derivado del mismo
  `cumplimiento30` que ya trae el Task 3, sin fetch nuevo) — nada del
  Task 3 se borra.

- [ ] **Step 1: Reemplazar `EmpleadoDetallePage.tsx` completo**

```tsx
import { useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { Pencil, KeyRound, Loader2, LogIn, LogOut } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Dialog } from "../../components/ui/dialog";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { Tabs } from "../../components/ui/tabs";
import { Status } from "../../components/ui/status";
import { Card } from "../../components/ui/card";
import { Meter } from "../../components/ui/meter";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import type { Empleado } from "../../lib/api";
import { horaLocal } from "../../lib/format";
import { useEmpleados, useEditarEmpleado, useGenerarOtp } from "./hooks";
import { useSucursales } from "../sucursales/hooks";
import { useHoras } from "../horas/hooks";
import { useHorarios, useCumplimiento } from "../turnos/hooks";
import { useAsistenciaPaginada } from "../asistencia/hooks";
import { useAusencias } from "../rrhh/hooks";
import { calcularHorasEsperadas, ESTADO_INFO } from "../turnos/calculos";

const AR_TZ = "America/Argentina/Buenos_Aires";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function inicioDeAnioAR(): string {
  return `${hoyAR().slice(0, 4)}-01-01`;
}

function hace30Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toLocaleDateString("sv", { timeZone: AR_TZ });
}

function fechaLocal(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR");
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000) + 1;
}

function nombreCompleto(emp: Empleado): string {
  return emp.apellido ? `${emp.apellido}, ${emp.nombre}` : emp.nombre;
}

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function estadoLabel(estado: Empleado["estado"]): string {
  if (estado === "activo") return "Activo";
  if (estado === "de_licencia") return "De licencia";
  if (estado === "suspendido") return "Suspendido";
  return "Baja";
}

type Vista = "resumen" | "asistencia" | "horario" | "ausencias";

export default function EmpleadoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [vista, setVista] = useState<Vista>("resumen");

  const { data: empleados, isLoading: empleadosLoading } = useEmpleados();
  const empleado = empleados?.find((e) => e.id === id);
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];

  const desde = inicioDeMesAR();
  const hasta = hoyAR();
  const { data: horasData } = useHoras(desde, hasta);
  const { data: horarios = [] } = useHorarios(id ?? "");
  const { data: cumplimiento30 = [] } = useCumplimiento({ desde: hace30Dias(), hasta, empleadoId: id });
  const cumplimientoHoy = cumplimiento30.find((f) => f.fecha === hasta);
  const { data: ausenciasAnioData } = useAusencias({ empleadoId: id, desde: inicioDeAnioAR(), hasta });
  const ausenciasAnio = ausenciasAnioData?.ausencias ?? [];
  const diasAusenciasAnio = ausenciasAnio.reduce((acc, a) => acc + diasEntre(a.fecha_desde, a.fecha_hasta), 0);

  const turnosEmpleado = (horasData?.turnos ?? []).filter((t) => t.empleado_id === id);
  const horasTrabajadas = turnosEmpleado.reduce((acc, t) => acc + (t.horas ?? 0), 0);
  const esperadas = calcularHorasEsperadas(horarios, desde, hasta);
  const extras = esperadas > 0 ? Math.max(0, horasTrabajadas - esperadas) : 0;
  const desviosCount = cumplimiento30.filter((f) => f.estado !== "a_horario" && f.estado !== "sin_horario").length;

  const [editOpen, setEditOpen] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editSucursalId, setEditSucursalId] = useState("");
  const [editEstado, setEditEstado] = useState<Empleado["estado"]>("activo");
  const [error, setError] = useState<string | null>(null);
  const editar = useEditarEmpleado();
  const generarCodigo = useGenerarOtp();
  const [codigoDialog, setCodigoDialog] = useState<{ code: string } | null>(null);
  const [generando, setGenerando] = useState(false);

  function abrirEdicion() {
    if (!empleado) return;
    setError(null);
    setEditNombre(empleado.nombre);
    setEditApellido(empleado.apellido ?? "");
    setEditCelular(empleado.celular ?? "");
    setEditSucursalId(empleado.sucursal_id ?? "");
    setEditEstado(empleado.estado);
    setEditOpen(true);
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!empleado) return;
    setError(null);
    try {
      await editar.mutateAsync({
        id: empleado.id,
        patch: {
          nombre: editNombre,
          apellido: editApellido || undefined,
          celular: editCelular || null,
          sucursal_id: editSucursalId || null,
          estado: editEstado,
        },
      });
      setEditOpen(false);
      toast.success("Empleado actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGenerarCodigo() {
    if (!empleado) return;
    setGenerando(true);
    try {
      const otp = await generarCodigo.mutateAsync(empleado.id);
      setCodigoDialog({ code: otp.code });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  async function handleToggleEstado(nuevoEstado: Empleado["estado"]) {
    if (!empleado) return;
    try {
      await editar.mutateAsync({ id: empleado.id, patch: { estado: nuevoEstado } });
      toast.success(nuevoEstado === "activo" ? "Empleado reactivado." : "Empleado suspendido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  if (empleadosLoading) {
    return <p className="text-text-tertiary">Cargando...</p>;
  }

  if (!empleado) {
    return (
      <>
        <PageHeader breadcrumb={[{ label: "Empleados", href: "/empleados" }]} title="Empleado no encontrado" />
        <p className="mt-4 text-text-secondary">
          No encontramos este empleado.{" "}
          <Link to="/empleados" className="text-accent-700 hover:underline">
            Volver a Empleados
          </Link>
          .
        </p>
      </>
    );
  }

  const sucursalNombre = sucursales.find((s) => s.id === empleado.sucursal_id)?.nombre;

  const stats: StatRowItem[] = [
    {
      label: "Horas del período",
      value: horasTrabajadas.toFixed(1),
      meta: esperadas > 0 ? `de ${esperadas.toFixed(1)} esperadas` : undefined,
    },
    { label: "Extras", value: extras.toFixed(1), tone: extras > 8 ? "warning" : "default" },
    {
      label: "Desvíos de turno",
      value: desviosCount,
      meta: "últimos 30 días",
      tone: desviosCount > 0 ? "warning" : "default",
    },
    { label: "Ausencias", value: ausenciasAnio.length, meta: `${diasAusenciasAnio} días en el año` },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Empleados", href: "/empleados" }]}
        title={nombreCompleto(empleado)}
        meta={
          <Status tone={empleado.estado === "activo" ? "success" : empleado.estado === "baja" ? "neutral" : "warning"}>
            {estadoLabel(empleado.estado)}
          </Status>
        }
        actions={
          <div className="flex gap-2">
            {!empleado.device_token && (
              <Button variant="secondary" onClick={handleGenerarCodigo} disabled={generando}>
                {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Vincular dispositivo
              </Button>
            )}
            {empleado.estado === "activo" && (
              <Button variant="secondary" onClick={() => handleToggleEstado("suspendido")} disabled={editar.isPending}>
                Suspender
              </Button>
            )}
            {(empleado.estado === "suspendido" || empleado.estado === "de_licencia") && (
              <Button variant="secondary" onClick={() => handleToggleEstado("activo")} disabled={editar.isPending}>
                Reactivar
              </Button>
            )}
            <Button variant="secondary" onClick={abrirEdicion}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </div>
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
            { value: "resumen", label: "Resumen" },
            { value: "asistencia", label: "Asistencia" },
            { value: "horario", label: "Horario" },
            { value: "ausencias", label: "Ausencias" },
          ]}
        />
      </div>

      {vista === "resumen" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-[14px] font-semibold text-text">Datos personales</h3>
            <dl className="mt-3 flex flex-col gap-3 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">CUIL</dt>
                <dd className="text-text">{empleado.cuil ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Celular</dt>
                <dd className="text-text">{empleado.celular ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Fecha de ingreso</dt>
                <dd className="text-text">{empleado.fecha_ingreso ? fechaLocal(empleado.fecha_ingreso) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Sucursal</dt>
                <dd className="text-text">{sucursalNombre ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-tertiary">Dispositivo</dt>
                <dd>
                  {empleado.device_token ? (
                    <Status tone="success">Vinculado</Status>
                  ) : empleado.otp ? (
                    <Status tone="warning">Código pendiente</Status>
                  ) : (
                    <Status tone="neutral">Sin vincular</Status>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-tertiary">Cumplimiento de hoy</dt>
                <dd>
                  {cumplimientoHoy ? (
                    <Status tone={ESTADO_INFO[cumplimientoHoy.estado].tone}>{ESTADO_INFO[cumplimientoHoy.estado].label}</Status>
                  ) : (
                    <Status tone="neutral">Sin marcar</Status>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="text-[14px] font-semibold text-text">Últimas marcas</h3>
            <ul className="mt-3 flex flex-col gap-2.5 text-[13.5px]">
              {turnosEmpleado.slice(0, 6).map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-text-secondary">
                    {t.salida_at ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                    {t.salida_at ? "Salió" : "Entró"}
                  </span>
                  <span className="font-mono text-xs text-text-tertiary">{horaLocal(t.salida_at ?? t.entrada_at)}</span>
                </li>
              ))}
              {turnosEmpleado.length === 0 && <li className="text-text-tertiary">Sin marcas en el período.</li>}
            </ul>
          </Card>
        </div>
      )}

      {vista === "asistencia" && <AsistenciaTab empleadoId={empleado.id} />}

      {vista === "horario" && (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead>Carga</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Tolerancia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ORDEN_DIAS.map((d) => {
                const bloques = horarios.filter((h) => h.dia_semana === d);
                if (bloques.length === 0) {
                  return (
                    <TableRow key={d}>
                      <TableCell>{DIAS[d]}</TableCell>
                      <TableCell colSpan={4} className="text-text-tertiary">
                        Franco
                      </TableCell>
                    </TableRow>
                  );
                }
                const horasDia =
                  bloques.reduce((acc, h) => {
                    const [hI, mI] = h.hora_inicio.split(":").map(Number);
                    const [hF, mF] = h.hora_fin.split(":").map(Number);
                    return acc + Math.max(0, hF * 60 + mF - (hI * 60 + mI));
                  }, 0) / 60;
                return bloques.map((h, i) => (
                  <TableRow key={h.id}>
                    {i === 0 ? <TableCell rowSpan={bloques.length}>{DIAS[d]}</TableCell> : null}
                    {i === 0 ? (
                      <TableCell rowSpan={bloques.length}>
                        <Meter value={horasDia} max={12} />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      {h.hora_inicio}–{h.hora_fin}
                    </TableCell>
                    <TableCell>{h.sucursal_nombre ?? "—"}</TableCell>
                    <TableCell>{h.tolerancia_min ?? "General"}</TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {vista === "ausencias" && <AusenciasTab empleadoId={empleado.id} />}

      <Dialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setError(null);
        }}
        title={`Editar ${nombreCompleto(empleado)}`}
      >
        <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-3">
          <Field label="Nombre" required value={editNombre} onChange={(e) => setEditNombre(e.target.value)} containerClassName="w-full" />
          <Field label="Apellido (opcional)" value={editApellido} onChange={(e) => setEditApellido(e.target.value)} containerClassName="w-full" />
          <Field label="Celular (opcional)" value={editCelular} onChange={(e) => setEditCelular(e.target.value)} containerClassName="w-full" />
          <Select
            label="Sucursal (opcional)"
            value={editSucursalId}
            onChange={(e) => setEditSucursalId(e.target.value)}
            options={[{ value: "", label: "Sin asignar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
            containerClassName="w-full"
          />
          <Select
            label="Estado"
            value={editEstado}
            onChange={(e) => setEditEstado(e.target.value as Empleado["estado"])}
            options={[
              { value: "activo", label: "Activo" },
              { value: "de_licencia", label: "De licencia" },
              { value: "suspendido", label: "Suspendido" },
              { value: "baja", label: "Baja" },
            ]}
            containerClassName="w-full"
          />
          {error && <p className="text-[15px] text-alert">{error}</p>}
          <Button type="submit" variant="primary" block disabled={editar.isPending}>
            Guardar
          </Button>
        </form>
      </Dialog>

      <Dialog open={codigoDialog != null} onClose={() => setCodigoDialog(null)} title="Código de vinculación">
        <div className="data-number text-center text-4xl font-medium tracking-[0.14em] text-text">
          {codigoDialog ? formatCode(codigoDialog.code) : ""}
        </div>
        <p className="text-center text-[13.5px] text-text-secondary">Vence en 10 minutos. Dictáselo a {empleado.nombre}.</p>
        <Button variant="ghost" block onClick={() => setCodigoDialog(null)}>
          Cerrar
        </Button>
      </Dialog>
    </>
  );
}

function AsistenciaTab({ empleadoId }: { empleadoId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const hoy = hoyAR();
  const desde = `${hoy.slice(0, 4)}-01-01`;
  const { data, isLoading } = useAsistenciaPaginada(desde, hoy, { page, pageSize, empleadoId });
  const registros = data?.data ?? [];

  return (
    <div className="mt-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Sucursal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={3} />}
          {!isLoading &&
            registros.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{horaLocal(r.created_at)}</TableCell>
                <TableCell>{r.tipo === "entrada" ? "Entrada" : "Salida"}</TableCell>
                <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
              </TableRow>
            ))}
          {!isLoading && registros.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-text-tertiary">
                Sin marcas este año.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
    </div>
  );
}

function AusenciasTab({ empleadoId }: { empleadoId: string }) {
  const { data, isLoading } = useAusencias({ empleadoId });
  const ausencias = data?.ausencias ?? [];

  return (
    <div className="mt-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Motivo</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead>Hasta</TableHead>
            <TableHead>Certificado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={4} />}
          {!isLoading &&
            ausencias.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.motivo}</TableCell>
                <TableCell>{fechaLocal(a.fecha_desde)}</TableCell>
                <TableCell>{fechaLocal(a.fecha_hasta)}</TableCell>
                <TableCell>{a.certificado_pendiente ? <Status tone="warning">Pendiente</Status> : "—"}</TableCell>
              </TableRow>
            ))}
          {!isLoading && ausencias.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-text-tertiary">
                Sin ausencias registradas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
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
git add src/pages/empleados/EmpleadoDetallePage.tsx
git commit -m "feat: tabs Horario y Ausencias en el Detalle de empleado"
```

---

## Al terminar esta etapa

Con esto queda cerrada la Etapa 5 (Empleados + Detalle de empleado). La
Etapa 6 (Ausencias con tab de Categorías + Sucursales) se planifica en su
propio documento una vez revisada esta, mismo patrón que las etapas
anteriores.
