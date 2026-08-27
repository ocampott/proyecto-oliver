# Rediseño R1/R3 — Etapa de fidelidad: componentes compartidos + re-verificación de páginas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la brecha de densidad/tratamiento visual entre lo que ya
shippeamos (Etapas 1-5 + shell) y R3 real — no la estructura (esa ya está
bien), sino el pixel: controles de Toolbar demasiado grandes/con label
visible, tablas con casi el doble del padding de R3, falta un componente
Avatar/PersonCell, badges de estado con lenguaje visual distinto al de
R3. Se retocan 6 componentes compartidos (una sola vez, benefician a
todas las páginas que ya los usan) y después se re-verifican 4 páginas
puntuales contra el código fuente real de R3 en el Desktop
(`~/Desktop/R3/src/pages/*.tsx`).

**Architecture:** Diez tasks. Tasks 1-6: retoque de componentes
compartidos (`Field`/`Select` ganan un modo `compact`, `Table` baja de
densidad y pierde el tratamiento de "card" bordeada, `Avatar`/`PersonCell`
nuevo, `Badge` gana un modo `tone` tipo pastilla, `Segmented` gana
contador opcional + el título del Topbar baja de jerarquía). Tasks 7-10:
cada página consume esos componentes retocados y corrige sus propios
gaps puntuales encontrados al comparar contra el archivo real de R3.

**Tech Stack:** Sin dependencias nuevas. Reusa `cva`, `tailwind-merge`
(`cn`), los tokens de color ya definidos en `src/index.css`.

**Spec:** No hay spec previa de esto — nace de una comparación directa
usuario-a-usuario entre una captura de nuestra Asistencia y una de R3
real, más lectura directa del código fuente de R3
(`~/Desktop/R3/src/pages/Asistencia.tsx`, `Empleados.tsx`,
`EmpleadoDetalle.tsx`, `Horas.tsx`, `Turnos.tsx` y
`~/Desktop/R3/src/components/ui/{Toolbar,Table,Avatar,Badge}.tsx`), leído
en profundidad durante el diseño de este plan. La spec original
(`docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md`) sigue
vigente en todo lo estructural (qué tabs, qué filtros, qué columnas) —
este plan solo corrige el tratamiento visual.

## Global Constraints

- **Sin cambios de backend.** Dos decisiones de alcance nacen directo de
  esto: (1) el filtro "Empleado" de Asistencia **se queda como `Select`**
  (ahora compacto) en vez de pasar a búsqueda de texto libre como en R3 —
  `ListAsistenciaParams` (`src/lib/api.ts`) no tiene un parámetro de
  búsqueda por nombre, solo `empleadoId` exacto; convertirlo a texto
  libre requeriría un endpoint nuevo o filtrar mal (solo dentro de la
  página actual de resultados paginados). (2) `PersonCell` se monta
  **sin** el subtítulo de puesto/cargo que tiene en R3 — nuestro modelo
  `Empleado` (`src/lib/api.ts`) no tiene un campo `puesto`; los mocks de
  R3 sí. Se usa `PersonCell` solo con `nombre`, sin `meta`.
- **Se preserva toda la lógica de negocio, filtros, paginación, gating
  por plan/rol y mutaciones existentes en cada página tocada** — esto es
  retoque visual, no funcional.
- **Los componentes compartidos son 100% aditivos donde es posible**:
  `Field`/`Select` ganan un prop `compact` opcional (default `false`,
  cero cambio de comportamiento en los ~15 usos existentes que no lo
  pasan); `Badge` gana un prop `tone` opcional que es mutuamente
  excluyente con `variant` (los usos existentes de `variant` no cambian);
  `Segmented` gana un campo `count` opcional en cada opción. La única
  excepción es `Table`/`TableHead`/`TableCell` (Task 3), que sí cambia el
  padding/tratamiento por defecto de **todas** las tablas existentes a
  propósito — es exactamente el punto de este plan.
- **Paleta de `Avatar` monocromática** (`bg-accent-100`/`text-accent-800`
  fijo), no el hash-a-5-colores de R3 — nuestro sistema de diseño es
  deliberadamente monocromo + un acento desde Etapa 1; portar la paleta
  multicolor de R3 sería inconsistente con eso, no un olvido.
- **Sin tests automatizados de UI** — verificación es `npm run build` +
  revisión visual manual de las páginas tocadas si hay forma de correr el
  dev server.

---

## Task 1: `Field`/`Select` ganan un modo `compact` para Toolbars

**Files:**
- Modify: `src/components/ui/field.tsx`
- Modify: `src/components/ui/select.tsx` (reemplazo completo)

**Interfaces:**
- Produces: `FieldProps.compact?: boolean` y `SelectProps.compact?: boolean`
  — cuando es `true`: el `<label>` visible desaparece y pasa a
  `aria-label`, la altura baja de `h-10` a `h-8`, el texto de `text-[15px]`
  a `text-[13px]`. Cuando es `false`/ausente, comportamiento 100%
  idéntico al actual (usado así en los diálogos de Alta/Editar de varias
  páginas — no tocar ese caso).

- [ ] **Step 1: `Field` — agregar el modo `compact`**

Buscar:

```tsx
export interface FieldProps extends InputProps {
  label: string;
  containerClassName?: string;
  icon?: React.ReactNode;
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, containerClassName, icon, id, className, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
```

Reemplazar por:

```tsx
export interface FieldProps extends InputProps {
  label: string;
  containerClassName?: string;
  icon?: React.ReactNode;
  /** Control compacto de Toolbar: sin label visible (pasa a aria-label), h-8. */
  compact?: boolean;
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, containerClassName, icon, compact, id, className, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;

    if (compact) {
      return (
        <div className={cn("relative", containerClassName)}>
          {icon && (
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary">
              {icon}
            </span>
          )}
          <Input
            id={inputId}
            ref={ref}
            aria-label={label}
            className={cn("h-8 text-[13px]", icon && "pl-8", className)}
            {...props}
          />
        </div>
      );
    }

    return (
```

Nota: el `return (` final que queda después del reemplazo es el que abre
el bloque JSX **ya existente** del modo no-compacto (el `<div
className={cn("flex flex-col gap-[5px]"...`) — no lo dupliques, el resto
del archivo (desde ese `<div>` hasta el cierre de la función) queda
exactamente como está hoy.

- [ ] **Step 2: `Select` — reemplazo completo del archivo**

```tsx
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  containerClassName?: string;
  /** Control compacto de Toolbar: sin label visible (pasa a aria-label), h-8. */
  compact?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, containerClassName, compact, className, id, ...props }, ref) => {
    const autoId = React.useId();
    const selectId = id ?? autoId;

    const selectEl = (
      <div className="relative">
        <select
          id={selectId}
          ref={ref}
          aria-label={compact ? label : undefined}
          className={cn(
            "flex w-full appearance-none rounded-[8px] border border-border bg-surface-raised text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
            compact ? "h-8 px-2.5 pr-8 text-[13px]" : "h-10 px-3 py-2 pr-9 text-[15px]",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-tertiary",
            compact ? "right-2.5 h-3.5 w-3.5" : "right-3 h-4 w-4"
          )}
        />
      </div>
    );

    if (compact) {
      return <div className={containerClassName}>{selectEl}</div>;
    }

    return (
      <div className={cn("flex flex-col gap-[5px]", containerClassName)}>
        <label htmlFor={selectId} className="text-[12px] text-text-secondary">
          {label}
        </label>
        {selectEl}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
```

- [ ] **Step 3: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores — nada consume `compact` todavía, pero ningún uso
existente de `Field`/`Select` pasa ese prop, así que el comportamiento
por defecto es idéntico al actual.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/field.tsx src/components/ui/select.tsx
git commit -m "feat: Field y Select ganan un modo compact para Toolbars"
```

---

## Task 2: `.page-filters` (Toolbar) más apretado

**Files:**
- Modify: `src/index.css`

**Interfaces:** Ninguna — es puramente CSS, afecta a todas las páginas
que usan `<Toolbar>` sin que ninguna tenga que cambiar código.

- [ ] **Step 1: Ajustar `.page-filters`**

Buscar:

```css
  .page-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem;
    border-bottom: 1px solid var(--color-border);
    padding: 1rem 0;
  }
```

Reemplazar por:

```css
  .page-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0;
  }
```

Cambios: `align-items: flex-end` → `center` (los controles compactos del
Task 1 no tienen label arriba, así que "el final" ya no es un punto de
referencia útil — centrarlos es lo correcto ahora que todos miden lo
mismo de alto); `gap` de `0.75rem`→`0.5rem` y `padding` de `1rem
0`→`0.75rem 0` (más apretado, más parecido a R3); se saca el
`border-bottom` — ya hay separación de sobra por el espaciado y por el
propio borde superior de la tabla que sigue debajo; un borde completo ahí
era el tipo de "línea pesada" que pidió sacar el usuario.

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: Toolbar (.page-filters) mas apretado, sin borde inferior"
```

---

## Task 3: `Table`/`TableHead`/`TableCell` bajan de densidad, sin tratamiento de card

**Files:**
- Modify: `src/components/ui/table.tsx`

**Interfaces:**
- `TableRow` gana la clase base `group` (sin cambiar su firma) — las
  tasks de re-verificación de página (7-10) la usan para mostrar botones
  de acción solo al hacer hover/foco de la fila, con
  `opacity-0 group-hover:opacity-100`.

- [ ] **Step 1: Sacar el tratamiento de "card" del contenedor y bajar el padding**

Buscar:

```tsx
const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn("overflow-x-auto border-y border-border bg-surface-raised", containerClassName)}>
      <table ref={ref} className={cn("w-full text-left text-[13.5px]", className)} {...props} />
    </div>
  )
);
```

Reemplazar por:

```tsx
const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn("overflow-x-auto", containerClassName)}>
      <table ref={ref} className={cn("w-full text-left text-[13px]", className)} {...props} />
    </div>
  )
);
```

Buscar:

```tsx
const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => <tr ref={ref} className={cn("transition-colors hover:bg-bg/70", className)} {...props} />
);
```

Reemplazar por:

```tsx
const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => <tr ref={ref} className={cn("group transition-colors hover:bg-bg/70", className)} {...props} />
);
```

Buscar:

```tsx
const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "border-b border-border px-[18px] py-[13px] text-[11.5px] font-semibold uppercase tracking-wide text-text-tertiary",
        className
      )}
      {...props}
    />
  )
);
```

Reemplazar por:

```tsx
const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary",
        className
      )}
      {...props}
    />
  )
);
```

Buscar:

```tsx
const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("border-b border-border-soft px-[18px] py-[15px]", className)}
      {...props}
    />
  )
);
```

Reemplazar por:

```tsx
const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("border-b border-border-soft px-3 py-2 align-middle", className)}
      {...props}
    />
  )
);
```

Este último cambio (sacar `border-y border-border bg-surface-raised` del
contenedor de `Table`) es el más grande de esta task: hoy **todas** las
tablas de la app se ven como una tarjeta blanca con borde arriba/abajo,
flotando sobre el fondo. R3 no hace eso — el header de la tabla tiene su
propio `border-b`, cada fila tiene su propio `border-b` más tenue, y el
conjunto se apoya directo sobre el fondo de la página, sin caja
contenedora. Es exactamente el tipo de "tarjeta pesada" que el usuario
pidió evitar en el rediseño de shell, aplicado ahora a tablas.

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores — son solo cambios de className, ninguna firma
cambió.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/table.tsx
git commit -m "feat: tablas mas densas y sin tratamiento de card, TableRow con group para hover-reveal"
```

---

## Task 4: `Avatar`/`PersonCell` nuevo

**Files:**
- Create: `src/components/ui/avatar.tsx`

**Interfaces:**
- Produces: `Avatar({ nombre, size?, className? })` y
  `PersonCell({ nombre, meta?, size? })` — `size` es `"sm" | "md"`,
  default `"md"`. Consumido por los Tasks 7-10 en toda columna de tabla
  que hoy solo muestra el nombre del empleado en texto plano.

- [ ] **Step 1: Crear `src/components/ui/avatar.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return `${partes[0]?.[0] ?? ""}${partes[1]?.[0] ?? ""}`.toUpperCase();
}

export interface AvatarProps {
  nombre: string;
  size?: "sm" | "md";
  className?: string;
}

function Avatar({ nombre, size = "md", className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[6px] bg-accent-100 font-semibold text-accent-800",
        size === "sm" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]",
        className
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}

export interface PersonCellProps {
  nombre: string;
  meta?: React.ReactNode;
  size?: "sm" | "md";
}

function PersonCell({ nombre, meta, size = "md" }: PersonCellProps) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar nombre={nombre} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-text">{nombre}</span>
        {meta && <span className="block truncate text-[11.5px] text-text-tertiary">{meta}</span>}
      </span>
    </span>
  );
}

export { Avatar, PersonCell };
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/avatar.tsx
git commit -m "feat: componente Avatar/PersonCell nuevo"
```

---

## Task 5: `Badge` gana un modo `tone` tipo pastilla

**Files:**
- Modify: `src/components/ui/badge.tsx`

**Interfaces:**
- Produces: `BadgeProps.tone?: "ok" | "warn" | "danger" | "info" |
  "neutral"` — mutuamente excluyente con `variant` (el `Badge` existente,
  mono/uppercase, sigue existiendo tal cual para sus usos actuales de
  plan/severidad). Cuando se pasa `tone`, `variant` se ignora.

- [ ] **Step 1: Agregar el modo `tone`**

Buscar:

```tsx
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

Reemplazar por:

```tsx
export type BadgeTone = "ok" | "warn" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: "bg-success-100 text-success-700",
  warn: "bg-warning/15 text-warning",
  danger: "bg-alert-100 text-alert",
  info: "bg-accent-100 text-accent-800",
  neutral: "bg-text/[.06] text-text-secondary",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Pastilla de tono (estilo R3) — mutuamente excluyente con `variant`. */
  tone?: BadgeTone;
}

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  if (tone) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium leading-4",
          TONE_CLASSES[tone],
          className
        )}
        {...props}
      />
    );
  }
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores — los usos existentes de `<Badge variant="...">`
siguen exactamente igual, `tone` es un prop nuevo que nadie pasa todavía.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat: Badge gana un modo tone tipo pastilla (estilo R3), mutuamente excluyente con variant"
```

---

## Task 6: `Segmented` gana contador opcional + título del Topbar baja de jerarquía + Tabs con tono según activo/inactivo

**Files:**
- Modify: `src/components/ui/segmented.tsx`
- Modify: `src/components/Topbar.tsx`
- Modify: `src/components/ui/tabs.tsx`

**Interfaces:**
- `SegmentedOption<T>` gana `count?: number` (opcional, no rompe los usos
  existentes en `HorasPage.tsx`/`CumplimientoTab.tsx` que no lo pasan).

- [ ] **Step 1: `Segmented` — contador opcional**

Buscar:

```tsx
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}
```

Reemplazar por:

```tsx
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}
```

Buscar:

```tsx
          className={cn(
            "rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors",
            opt.value === value
              ? "bg-surface-raised text-text"
              : "text-text-secondary hover:text-text"
          )}
        >
          {opt.label}
        </button>
```

Reemplazar por:

```tsx
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors",
            opt.value === value
              ? "bg-surface-raised text-text"
              : "text-text-secondary hover:text-text"
          )}
        >
          {opt.label}
          {opt.count != null && (
            <span className={cn("font-mono text-[10.5px]", opt.value === value ? "text-text-tertiary" : "text-text-muted")}>
              {opt.count}
            </span>
          )}
        </button>
```

- [ ] **Step 2: `Topbar` — el título baja de jerarquía visual**

El título del Topbar y el `<h1>` de `PageHeader` de cada página muestran
hoy el mismo texto uno debajo del otro (encontrado en la revisión final
de la etapa de shell, parqueado a propósito para acá). En vez de tocar
`PageHeader` página por página (fuera de alcance — algunas páginas tienen
títulos dinámicos que si difieren, como el nombre del empleado en
`EmpleadoDetallePage`), la solución más simple es bajarle la jerarquía
visual al título del Topbar: pasa de un texto que compite con el `<h1>`
a una referencia de contexto silenciosa, tipo "estás acá" — el `<h1>` de
`PageHeader` sigue siendo la única jerarquía visual fuerte de cada
página.

Buscar:

```tsx
        <p className="truncate text-[15px] font-semibold leading-tight text-text">{titulo}</p>
        <p className="hidden truncate text-[11.5px] leading-tight text-text-tertiary sm:block">{org?.name ?? ""}</p>
```

Reemplazar por:

```tsx
        <p className="truncate text-[13px] font-medium leading-tight text-text-secondary">{titulo}</p>
        <p className="hidden truncate text-[11px] leading-tight text-text-tertiary sm:block">{org?.name ?? ""}</p>
```

- [ ] **Step 3: `Tabs` — el contador de la pestaña inactiva se atenúa**

Buscar:

```tsx
            {item.count != null && item.count > 0 && (
              <span className="rounded-[6px] bg-accent-100 px-1.5 py-0.5 text-[11px] font-mono text-accent-800">
                {item.count}
              </span>
            )}
```

Reemplazar por:

```tsx
            {item.count != null && item.count > 0 && (
              <span
                className={cn(
                  "rounded-[6px] px-1.5 py-0.5 text-[11px] font-mono",
                  active ? "bg-accent-100 text-accent-800" : "bg-text/[.06] text-text-tertiary"
                )}
              >
                {item.count}
              </span>
            )}
```

- [ ] **Step 4: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/segmented.tsx src/components/Topbar.tsx src/components/ui/tabs.tsx
git commit -m "feat: contador opcional en Segmented, titulo del Topbar baja de jerarquia, tono de contador de Tabs segun activo"
```

---

## Task 7: Re-verificación de Asistencia contra R3

**Files:**
- Modify: `src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:** Ninguna nueva — consume `compact` (Task 1), `Avatar`/
`PersonCell` (Task 4), `Badge` con `tone` (Task 5). Ningún hook ni ruta
cambia.

Antes de aplicar, leé `~/Desktop/R3/src/pages/Asistencia.tsx` una vez —
el detalle exacto (nombres de props, orden de filtros) ya está reflejado
en los diffs de abajo, pero tenerlo al lado ayuda a confirmar que el
resultado se ve igual.

- [ ] **Step 1: Toolbar — todos los filtros pasan a `compact`, orden ajustado**

Buscar:

```tsx
          <Toolbar>
            <Field
              label="Desde"
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setPage(1); }}
              containerClassName="w-40"
            />
            <Field
              label="Hasta"
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setPage(1); }}
              containerClassName="w-40"
            />
            <Select
              label="Empleado"
              value={empleadoFiltro}
              onChange={(e) => { setEmpleadoFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
              containerClassName="w-44"
            />
            <Select
              label="Sucursal"
              value={sucursalFiltro}
              onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...sucursales.map((suc) => ({ value: suc.id, label: suc.nombre }))]}
              containerClassName="w-44"
            />
            <Select
              label="Tipo"
              value={tipoFiltro}
              onChange={(e) => { setTipoFiltro(e.target.value as TipoFiltro); setPage(1); }}
              options={[
                { value: "todos", label: "Todos" },
                { value: "entrada", label: "Entrada" },
                { value: "salida", label: "Salida" },
              ]}
              containerClassName="w-36"
            />
            <div className="ml-auto flex items-center gap-3">
              {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
              <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
            </div>
          </Toolbar>
```

Reemplazar por:

```tsx
          <Toolbar>
            <Select
              label="Empleado"
              compact
              value={empleadoFiltro}
              onChange={(e) => { setEmpleadoFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
              containerClassName="w-40"
            />
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
            {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
            <div className="ml-auto">
              <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
            </div>
          </Toolbar>
```

(El texto de las opciones de "Tipo" cambia de "Todos"/"Entrada"/"Salida"
a "Entradas y salidas"/"Solo entradas"/"Solo salidas" — así están en R3,
más explícito ahora que no hay un label "Tipo" visible arriba del
control.)

- [ ] **Step 2: Fila de tabla — `PersonCell` en vez de texto plano, `Badge tone` en vez de icono+texto, acciones solo al hover**

Buscar:

```tsx
                        <TableCell>{horaLocal(r.created_at)}</TableCell>
                        <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                        <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                        <TableCell>
                          {r.tipo === "entrada" ? (
                            <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-success-700">
                              <LogIn className="h-3 w-3" /> Entrada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-text-secondary">
                              <LogOut className="h-3 w-3" /> Salida
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            {gestionable && (
                              <Button
                                variant="secondary"
                                size="default"
                                onClick={(e) => { e.stopPropagation(); setBorrarTarget(r); }}
                              >
                                Borrar
                              </Button>
                            )}
                          </div>
                        </TableCell>
```

Reemplazar por:

```tsx
                        <TableCell>
                          <PersonCell nombre={r.empleado_nombre ?? "—"} />
                        </TableCell>
                        <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                        <TableCell>
                          <Badge tone={r.tipo === "entrada" ? "ok" : "neutral"}>
                            {r.tipo === "entrada" ? "Entrada" : "Salida"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{horaLocal(r.created_at)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            {gestionable && (
                              <Button
                                variant="secondary"
                                size="default"
                                onClick={() => setBorrarTarget(r)}
                              >
                                Borrar
                              </Button>
                            )}
                          </div>
                        </TableCell>
```

Ojo: el orden de columnas cambia — "Empleado" pasa a ser la primera
columna visual con el avatar (matching R3), "Fecha y hora" pasa al final,
justo antes de Acciones. Hay que reordenar también el `<TableHeader>` de
este mismo bloque para que coincida:

Buscar:

```tsx
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
```

Reemplazar por:

```tsx
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Hora</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
```

- [ ] **Step 3: "Registros" también muestra un contador en su Tab (ya lo tiene "Rechazadas")**

Buscar:

```tsx
          items={[
            { value: "registros", label: "Registros" },
            { value: "rechazadas", label: "Rechazadas", count: rechazadasData?.pagination.total },
          ]}
```

Reemplazar por:

```tsx
          items={[
            { value: "registros", label: "Registros", count: data?.pagination.total },
            { value: "rechazadas", label: "Rechazadas", count: rechazadasData?.pagination.total },
          ]}
```

- [ ] **Step 4: Agregar los imports nuevos**

Buscar:

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
```

Reemplazar por:

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { PersonCell } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
```

El import de `LogIn, LogOut` desde `lucide-react` queda sin uso tras el
Step 2 — sacalo de esa línea de import (dejando `Download, Loader2` si
siguen usándose en el resto del archivo, que sí).

- [ ] **Step 5: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/asistencia/AsistenciaPage.tsx
git commit -m "feat: Asistencia re-verificada contra R3 (toolbar compacta, PersonCell, Badge de tono, hover en acciones)"
```

---

## Task 8: Re-verificación de Empleados contra R3

**Files:**
- Modify: `src/pages/empleados/EmpleadosPage.tsx`

**Interfaces:** Ninguna nueva — consume `compact` (Task 1), `PersonCell`
(Task 4, sin `meta` — ver Global Constraints). El buscador de texto libre
ya existía y ya funciona server-side (`q` en `useEmpleadosPaginado`), no
se toca esa parte.

Antes de aplicar, leé `~/Desktop/R3/src/pages/Empleados.tsx` una vez.

- [ ] **Step 1: Toolbar — todos los filtros pasan a `compact`**

Buscar:

```tsx
      <Toolbar>
        <Field
          label="Buscar"
          placeholder="Nombre del empleado"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-56"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
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

Reemplazar por:

```tsx
      <Toolbar>
        <Field
          label="Buscar por nombre o CUIL"
          compact
          placeholder="Buscar por nombre o CUIL"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-60"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
        <Select
          label="Sucursal"
          compact
          value={sucursalFiltro}
          onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1); }}
          options={[{ value: "", label: "Todas las sucursales" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-44"
        />
        <Select
          label="Estado"
          compact
          value={estadoFiltro}
          onChange={(e) => { setEstadoFiltro(e.target.value as EstadoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos los estados" },
            { value: "activo", label: "Activo" },
            { value: "de_licencia", label: "De licencia" },
            { value: "suspendido", label: "Suspendido" },
            { value: "baja", label: "Baja" },
          ]}
          containerClassName="w-40"
        />
        <Select
          label="Dispositivo"
          compact
          value={dispositivoFiltro}
          onChange={(e) => { setDispositivoFiltro(e.target.value as DispositivoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Cualquier dispositivo" },
            { value: "vinculado", label: "Vinculado" },
            { value: "no_vinculado", label: "Sin vincular" },
          ]}
          containerClassName="w-40"
        />
        <Select
          label="CUIL"
          compact
          value={cuilFiltro}
          onChange={(e) => { setCuilFiltro(e.target.value as CuilFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "con", label: "Con CUIL" },
            { value: "sin", label: "Sin CUIL" },
          ]}
          containerClassName="w-36"
        />
        {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
        <div className="ml-auto">
          <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
        </div>
      </Toolbar>
```

(Se agregó "Sucursal" antes de "Estado" para matchear el orden de R3;
las opciones "Todos"/"Todas" de cada Select ahora describen el filtro
completo, ya que no hay un label arriba que dé ese contexto.)

- [ ] **Step 2: Columna "Nombre" pasa a `PersonCell`**

Buscar:

```tsx
                <TableCell>{nombreCompleto(emp)}</TableCell>
                <Celda value={emp.celular} />
```

Reemplazar por:

```tsx
                <TableCell>
                  <PersonCell nombre={nombreCompleto(emp)} />
                </TableCell>
                <Celda value={emp.celular} />
```

- [ ] **Step 3: Acciones de fila solo visibles al hover/foco**

Buscar:

```tsx
                <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
```

Reemplazar por:

```tsx
                <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
```

- [ ] **Step 4: Agregar el import de `PersonCell`**

Buscar:

```tsx
import { Status } from "../../components/ui/status";
```

Reemplazar por:

```tsx
import { Status } from "../../components/ui/status";
import { PersonCell } from "../../components/ui/avatar";
```

- [ ] **Step 5: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat: Empleados re-verificado contra R3 (toolbar compacta, PersonCell, hover en acciones)"
```

---

## Task 9: Re-verificación de Detalle de empleado contra R3

**Files:**
- Modify: `src/pages/empleados/EmpleadoDetallePage.tsx`

**Interfaces:** Ninguna nueva — consume `Avatar` (Task 4) junto al
nombre en el header. Las tablas internas (Horario/Asistencia/Ausencias)
ya heredan la densidad nueva del Task 3 sin cambios de código acá.

Antes de aplicar, leé `~/Desktop/R3/src/pages/EmpleadoDetalle.tsx` una
vez — la estructura (StatRow de 4, Tabs de 4) ya está prácticamente
igual a la de R3 desde que se construyó en la Etapa 5; este task es solo
el detalle visual del título.

- [ ] **Step 1: Avatar junto al nombre en el título**

Buscar:

```tsx
      <PageHeader
        breadcrumb={[{ label: "Empleados", href: "/empleados" }]}
        title={nombreCompleto(empleado)}
```

Reemplazar por:

```tsx
      <PageHeader
        breadcrumb={[{ label: "Empleados", href: "/empleados" }]}
        title={
          <span className="flex items-center gap-2.5">
            <Avatar nombre={nombreCompleto(empleado)} />
            {nombreCompleto(empleado)}
          </span>
        }
```

- [ ] **Step 2: Agregar el import de `Avatar`**

Buscar:

```tsx
import { Card } from "../../components/ui/card";
```

Reemplazar por:

```tsx
import { Card } from "../../components/ui/card";
import { Avatar } from "../../components/ui/avatar";
```

`PageHeader`'s `title` prop ya está tipado `ReactNode`
(`src/components/PageHeader.tsx:12`) — no hace falta tocar ese archivo,
el `<span>` del Step 1 ya es un `ReactNode` válido.

- [ ] **Step 3: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/empleados/EmpleadoDetallePage.tsx
git commit -m "feat: Detalle de empleado re-verificado contra R3 (avatar junto al nombre)"
```

(Nota de alcance: no se agregan contadores a los tabs "Asistencia"/
"Ausencias" de esta página como tiene R3 — requeriría levantar el fetch
de cada sub-tab al componente padre solo para leer un total, o pedirlo
dos veces; el costo no se justifica frente al beneficio puramente
cosmético. Decisión ponytail, no un olvido.)

---

## Task 10: Re-verificación de Horas + Cumplimiento (módulo Turnos) contra R3

**Files:**
- Modify: `src/pages/horas/HorasPage.tsx`
- Modify: `src/pages/turnos/CumplimientoTab.tsx`

**Interfaces:** Ninguna nueva — consume `compact` (Task 1), `PersonCell`
(Task 4, sin `meta`), contador de `Segmented` (Task 6, para
`CumplimientoTab`'s "Todos"/"Con desvío").

Antes de aplicar, leé `~/Desktop/R3/src/pages/Horas.tsx` y
`~/Desktop/R3/src/pages/Turnos.tsx` una vez.

- [ ] **Step 1: `HorasPage.tsx` — Toolbar compacta**

Buscar:

```tsx
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
```

Reemplazar por:

```tsx
      <Toolbar>
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
        <div className="flex items-center gap-1.5">
          <Field label="Desde" compact type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-[136px]" />
          <span className="text-xs text-text-tertiary">→</span>
          <Field label="Hasta" compact type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-[136px]" />
        </div>
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
          compact
          value={sucursalSel}
          onChange={(e) => setSucursalSel(e.target.value)}
          options={[{ value: "", label: "Todas las sucursales" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-44"
        />
        <Select
          label="Orden"
          compact
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          options={[
            { value: "horas", label: "Más horas primero" },
            { value: "extras", label: "Más extras primero" },
            { value: "nombre", label: "Por nombre" },
          ]}
          containerClassName="w-44"
        />
        {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
        <div className="ml-auto">
          <span className="font-mono text-xs text-text-tertiary">{resumen.length} resultados</span>
        </div>
      </Toolbar>
```

`MultiSelect` no tiene un modo `compact` (no lo pide el brief ni R3 tiene
un equivalente directo — su filtro de empleado en Horas es un `Select`
de uno solo, nosotros soportamos selección múltiple real; se deja
`MultiSelect` como está, con su propio label visible, matchea igual de
bien conceptualmente).

- [ ] **Step 2: `HorasPage.tsx` — "Resumen por empleado" con `PersonCell` enlazado al detalle**

Buscar:

```tsx
                <TableRow key={r.empleadoId}>
                  <TableCell>
                    {r.nombre}
                    {r.enCurso && (
                      <Status tone="accent" className="ml-2">
                        En curso
                      </Status>
                    )}
                  </TableCell>
```

Reemplazar por:

```tsx
                <TableRow key={r.empleadoId}>
                  <TableCell>
                    <Link to={`/empleados/${r.empleadoId}`} className="inline-flex items-center gap-2 hover:underline">
                      <PersonCell nombre={r.nombre} />
                    </Link>
                    {r.enCurso && (
                      <Status tone="accent" className="ml-2">
                        En curso
                      </Status>
                    )}
                  </TableCell>
```

- [ ] **Step 3: `HorasPage.tsx` — tabla "Turnos" también con `PersonCell`**

Buscar:

```tsx
              <TableRow key={`${t.empleado_id}-${t.entrada_at}-${i}`}>
                <TableCell>{t.nombre}</TableCell>
```

Reemplazar por:

```tsx
              <TableRow key={`${t.empleado_id}-${t.entrada_at}-${i}`}>
                <TableCell>
                  <PersonCell nombre={t.nombre} />
                </TableCell>
```

- [ ] **Step 4: `HorasPage.tsx` — imports nuevos**

Buscar:

```tsx
import { useState } from "react";
import { Download } from "lucide-react";
```

Reemplazar por:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
```

Buscar:

```tsx
import { Status } from "../../components/ui/status";
```

Reemplazar por:

```tsx
import { Status } from "../../components/ui/status";
import { PersonCell } from "../../components/ui/avatar";
```

- [ ] **Step 5: `CumplimientoTab.tsx` — Toolbar compacta + contador en el Segmented**

Buscar:

```tsx
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
```

Reemplazar por:

```tsx
      <Toolbar>
        <Segmented
          value={vista}
          onChange={setVista}
          options={[
            { value: "todos", label: "Todos", count: filas.length },
            { value: "con_desvio", label: "Con desvío", count: filas.filter((f) => CON_DESVIO.includes(f.estado)).length },
          ]}
        />
        <div className="flex items-center gap-1.5">
          <Field label="Desde" compact type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-[136px]" />
          <span className="text-xs text-text-tertiary">→</span>
          <Field label="Hasta" compact type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-[136px]" />
        </div>
        <Select
          label="Sucursal"
          compact
          value={sucursalId}
          onChange={(e) => setSucursalId(e.target.value)}
          options={[{ value: "", label: "Todas las sucursales" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-44"
        />
        <Select
          label="Empleado"
          compact
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
          options={[{ value: "", label: "Todos" }, ...empleados.map((e) => ({ value: e.id, label: e.nombre }))]}
          containerClassName="w-44"
        />
        {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
        <div className="ml-auto">
          <span className="font-mono text-xs text-text-tertiary">{filasFiltradas.length} resultados</span>
        </div>
      </Toolbar>
```

- [ ] **Step 6: `CumplimientoTab.tsx` — `PersonCell` en la tabla, enlazado al detalle**

Buscar:

```tsx
              <TableRow key={i}>
                <TableCell>{f.nombre}</TableCell>
```

Reemplazar por:

```tsx
              <TableRow key={i}>
                <TableCell>
                  <Link to={`/empleados/${f.empleado_id}`} className="inline-flex items-center gap-2 hover:underline">
                    <PersonCell nombre={f.nombre} />
                  </Link>
                </TableCell>
```

- [ ] **Step 7: `CumplimientoTab.tsx` — imports nuevos**

Buscar:

```tsx
import { useState } from "react";
import { Field } from "../../components/ui/field";
```

Reemplazar por:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../../components/ui/field";
```

Buscar:

```tsx
import { Status } from "../../components/ui/status";
```

Reemplazar por:

```tsx
import { Status } from "../../components/ui/status";
import { PersonCell } from "../../components/ui/avatar";
```

- [ ] **Step 8: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/pages/horas/HorasPage.tsx src/pages/turnos/CumplimientoTab.tsx
git commit -m "feat: Horas y Cumplimiento re-verificados contra R3 (toolbar compacta, PersonCell enlazado, contador en Segmented)"
```

---

## Al terminar

Con esto, las 5 páginas ya shippeadas (Asistencia, Cumplimiento/Horas,
Empleados, Detalle de empleado) y el shell comparten de verdad la
densidad y el lenguaje visual de R3, no solo su estructura. Las etapas
que faltan (6: Ausencias+Sucursales, 7: Configuración+Plan+Admin, 8:
revisión final cruzada) parten de una base de componentes ya retocada —
no van a arrastrar el mismo gap, porque `Toolbar`/`Table`/`Avatar`/
`Badge` ya están en su forma final.
