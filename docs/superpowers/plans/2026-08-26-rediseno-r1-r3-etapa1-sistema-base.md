# Rediseño R1/R3 — Etapa 1: Sistema base (tokens + componentes UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la paleta de color, radius y tratamiento de sombras del
panel por el sistema visual de R1 (monocromo + único acento esmeralda, sin
sombras salvo overlays flotantes), y construir los componentes UI nuevos
(`Toolbar`, `SearchInput`, `Segmented`, `SidePanel`, `StatRow`, `Meter`,
`Sparkline`, `Tabs`) que las páginas van a consumir en las etapas
siguientes de este rediseño.

**Architecture:** Esta es la Etapa 1 de 8 del rediseño (ver spec, sección
"Plan de fases"). Es puramente aditiva y de tokens: se retintan las
variables `@theme` de `src/index.css` (cascada automática a casi todos los
componentes vía las clases Tailwind `bg-accent`, `text-text`, etc.), se
pareja el radius/sombras hardcodeados que quedaron sueltos como valores
arbitrarios (`rounded-[4px]`, `shadow-[...rgba(23,24,18,...)]`), y se
agregan componentes nuevos en `src/components/ui/` sin tocar ninguna
página todavía. `FilterChip` y la variante `chip` de `MultiSelect` **no**
se tocan ni se borran en esta etapa — siguen siendo el patrón de filtros
real de las páginas actuales hasta que cada una migre a `Toolbar` en su
propia etapa (3 a 6). Ningún componente nuevo tiene consumidor todavía;
es esperable, se verifica con `npm run build`.

**Tech Stack:** Sin dependencias nuevas — Tailwind v4 (`@theme` inline),
`class-variance-authority`, `clsx`/`tailwind-merge` (`cn()`), `lucide-react`,
todo ya instalado.

**Spec:** `docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md`

## Global Constraints

- **Sin cambios de comportamiento** — todo el trabajo de esta etapa es
  visual (tokens, radius, sombras) o componentes nuevos sin lógica de
  negocio. Ninguna página se modifica.
- **Sin dependencias nuevas.**
- **Sin tests automatizados de UI** (no existen en el proyecto) —
  verificación con `npm run build` (`tsc -b && vite build`) al final de
  cada task. El cache incremental de `tsc -b` puede reportar falsos "0
  errores" si quedó desincronizado de una corrida anterior — borrar
  `node_modules/.tmp/*.tsbuildinfo` antes de cada verificación de build en
  este plan.
- **No borrar `FilterChip` (`src/components/ui/filter-chip.tsx`) ni la
  variante `chip` de `MultiSelect`** — siguen en uso real en Asistencia,
  Horas, Turnos (Cumplimiento), RRHH, Sucursales y Empleados hasta que
  cada página migre a `Toolbar` en su propia etapa. Se retocan solo en
  radius/sombra (Task 2), no se eliminan.
- **Paleta objetivo (R1)**: monocromo negro/blanco/gris + único acento
  esmeralda `#059669`. Radius: **6-8px** en inputs/botones/badges/chips,
  **10px** en cards/dialogs/popovers/overlays flotantes. **Sin
  `box-shadow`** salvo en overlays flotantes (dropdown de filtro, menú,
  dialog, toast, side panel) — ver spec, sección "Sistema visual".

---

## Task 1: Design tokens — `src/index.css`

**Files:**
- Modify: `src/index.css`
- Delete: `public/icons.svg`

**Interfaces:** ninguna — son variables CSS consumidas por Tailwind v4
para generar utilidades (`bg-accent`, `text-text-secondary`, `border-border`,
etc.) ya usadas en todo el proyecto. Ningún componente cambia de nombre de
prop ni de clase por este task; solo cambian los valores que esas clases
resuelven.

- [ ] **Step 1: Reemplazar el bloque `@theme`**

Mapeo de valores: `--color-accent` pasa de verde oliva (`#4c5a31`) a
esmeralda R1 (`#059669`, = `emerald-600` de la escala estándar de
Tailwind). La escala 100-900 se arma con la escala `emerald` de Tailwind,
pero **desplazada una posición** respecto a sus nombres originales: el
valor exacto de R1 ocupa el slot `500` (para preservar el invariante ya
existente en este archivo de que `--color-accent` == `--color-accent-500`),
dejando `600`/`700` como pasos más oscuros reales para hover/active (si
`600` fuera igual a la base, `hover:bg-accent-600` en `button.tsx` no
oscurecería nada al hacer hover). `--color-border` pasa de gris plano a
negro semitransparente (`rgba(13,13,17,.08)`, valor exacto de R1) — mismo
patrón que ya usa `--color-divider` con `color-mix()`, así que no es una
técnica nueva en este archivo. `--color-surface` no tiene equivalente
exacto en R1 (que no distingue "fondo de página" de "fondo de sección
sutil") — se interpola un tono apenas más oscuro que `--color-bg` para
mantener la distinción de tres niveles (bg/surface/surface-raised) que ya
usan `bg-surface` y `bg-surface-raised` en varios componentes, sin tener
que auditar cada uso uno por uno.

Reemplazar:

```css
@theme {
  --color-bg: #f4f4ef;
  --color-surface: #fbfbf7;
  --color-surface-raised: #ffffff;
  --color-text: #171812;
  --color-text-secondary: #5e6057;
  --color-text-tertiary: #8e9086;
  --color-text-muted: #b8baaf;
  --color-accent: #4c5a31;
  --color-accent-100: #e4e9d8;
  --color-accent-200: #cad5b4;
  --color-accent-300: #a8ba88;
  --color-accent-400: #71834e;
  --color-accent-500: #4c5a31;
  --color-accent-600: #3a4625;
  --color-accent-700: #2b351c;
  --color-accent-800: #202817;
  --color-accent-900: #171c10;
  --color-border: #d8d9d0;
  --color-border-soft: #e7e8df;
  --color-success: #5c7a43;
  --color-success-700: #3d592c;
  --color-success-100: #e7ede0;
  --color-warning: #a87928;
  --color-alert: #a54d32;
  --color-alert-100: #f5e6df;
  --color-divider: color-mix(in srgb, var(--color-text) 22%, transparent);
  --font-sans: "Archivo", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
}
```

por:

```css
@theme {
  --color-bg: #f7f7fa;
  --color-surface: #f0f0f4;
  --color-surface-raised: #ffffff;
  --color-text: #0d0d11;
  --color-text-secondary: #3f3f47;
  --color-text-tertiary: #6c6c7a;
  --color-text-muted: #9797a3;
  --color-accent: #059669;
  --color-accent-100: #d1fae5;
  --color-accent-200: #a7f3d0;
  --color-accent-300: #6ee7b7;
  --color-accent-400: #34d399;
  --color-accent-500: #059669;
  --color-accent-600: #047857;
  --color-accent-700: #065f46;
  --color-accent-800: #064e3b;
  --color-accent-900: #022c22;
  --color-border: rgba(13, 13, 17, 0.08);
  --color-border-soft: rgba(13, 13, 17, 0.05);
  --color-success: #059669;
  --color-success-700: #047857;
  --color-success-100: #d1fae5;
  --color-warning: #b45309;
  --color-alert: #dc2626;
  --color-alert-100: #fee2e2;
  --color-divider: color-mix(in srgb, var(--color-text) 22%, transparent);
  --font-sans: "Archivo", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
}
```

- [ ] **Step 2: Subir el radius de `.card-editorial` de 6px a 10px**

En `@layer components`, dentro de `.card-editorial`:

```css
  .card-editorial {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface-raised);
    box-shadow: none;
  }
```

por:

```css
  .card-editorial {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-surface-raised);
    box-shadow: none;
  }
```

- [ ] **Step 3: Borrar el sprite de iconos sin uso**

`public/icons.svg` es un sprite de íconos de redes sociales (bluesky,
discord, github, x, etc.) que no tiene ningún consumidor en el código —
confirmado con `grep -rn "icons.svg" src public index.html` (sin
resultados). No es parte del sistema de iconos real (que es
`lucide-react`, usado en ~20 archivos).

```bash
rm public/icons.svg
```

- [ ] **Step 4: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores. El cambio es solo de valores de variables CSS y no
afecta tipos de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/index.css public/icons.svg
git commit -m "feat: tokens de color/radius R1 (monocromo + acento esmeralda) y limpieza de sprite sin uso"
```

---

## Task 2: Radius y sombras — sweep de componentes UI compartidos

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/icon-button.tsx`
- Modify: `src/components/ui/tooltip.tsx`
- Modify: `src/components/ui/pagination.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/toast.tsx`
- Modify: `src/components/ui/filter-chip.tsx`
- Modify: `src/components/ui/multi-select.tsx`
- Modify: `src/components/MapaUbicacion.tsx`

**Interfaces:** ninguna cambia — es un reemplazo mecánico de valores
arbitrarios de Tailwind (`rounded-[Npx]`, `rgba(23,24,18,X)`) por los
valores objetivo de R1. Ningún prop, nombre de export ni comportamiento se
toca.

Mapeo completo:
- `rounded-[4px]` (botones/inputs) → `rounded-[8px]` — en `button.tsx`,
  `icon-button.tsx`, `pagination.tsx` (4 apariciones), `dialog.tsx` (botón
  cerrar), `multi-select.tsx` (2 apariciones: trigger y botón de opción),
  `input.tsx`, `select.tsx`.
- `rounded-[4px]` (chip de tooltip, tratamiento de badge no de botón) →
  `rounded-[6px]` — solo en `tooltip.tsx`.
- `rounded-[3px]` (badge) → `rounded-[6px]` — solo en `badge.tsx`.
- `rounded-[6px]` (overlays flotantes: dialog, toast, dropdown de filtro,
  dropdown de multi-select, dropdown de autocompletar de mapa) →
  `rounded-[10px]` — en `dialog.tsx` (panel), `toast.tsx`,
  `filter-chip.tsx`, `multi-select.tsx`, `MapaUbicacion.tsx`.
- `rgba(23,24,18,` (sombra basada en el foreground viejo `#171812`) →
  `rgba(13,13,17,` (foreground nuevo `#0d0d11`) — en `dialog.tsx`,
  `toast.tsx`, `filter-chip.tsx`, `multi-select.tsx`, `MapaUbicacion.tsx`.

`NotificationBell.tsx` y `AccountMenu.tsx` también tienen sombras con el
mismo valor viejo, pero se eliminan por completo en la Etapa 2 de este
rediseño (remoción de la topbar) — no vale la pena tocarlos acá.

- [ ] **Step 1: Radius de botones/inputs (4px → 8px)**

```bash
sed -i '' 's/rounded-\[4px\]/rounded-[8px]/g' \
  src/components/ui/button.tsx \
  src/components/ui/icon-button.tsx \
  src/components/ui/pagination.tsx \
  src/components/ui/dialog.tsx \
  src/components/ui/multi-select.tsx \
  src/components/ui/input.tsx \
  src/components/ui/select.tsx
```

- [ ] **Step 2: Radius del chip de tooltip (4px → 6px)**

```bash
sed -i '' 's/rounded-\[4px\]/rounded-[6px]/g' src/components/ui/tooltip.tsx
```

- [ ] **Step 3: Radius de badge (3px → 6px)**

```bash
sed -i '' 's/rounded-\[3px\]/rounded-[6px]/g' src/components/ui/badge.tsx
```

- [ ] **Step 4: Radius de overlays flotantes (6px → 10px)**

```bash
sed -i '' 's/rounded-\[6px\]/rounded-[10px]/g' \
  src/components/ui/dialog.tsx \
  src/components/ui/toast.tsx \
  src/components/ui/filter-chip.tsx \
  src/components/ui/multi-select.tsx \
  src/components/MapaUbicacion.tsx
```

- [ ] **Step 5: Color de sombra (rgba del foreground viejo → nuevo)**

```bash
sed -i '' 's/rgba(23,24,18,/rgba(13,13,17,/g' \
  src/components/ui/dialog.tsx \
  src/components/ui/toast.tsx \
  src/components/ui/filter-chip.tsx \
  src/components/ui/multi-select.tsx \
  src/components/MapaUbicacion.tsx
```

- [ ] **Step 6: Verificar con grep que no quedó ningún valor viejo**

```bash
grep -n "rounded-\[4px\]\|rounded-\[3px\]" src/components/ui/button.tsx \
  src/components/ui/icon-button.tsx src/components/ui/pagination.tsx \
  src/components/ui/dialog.tsx src/components/ui/multi-select.tsx \
  src/components/ui/input.tsx src/components/ui/select.tsx \
  src/components/ui/tooltip.tsx src/components/ui/badge.tsx
grep -n "rgba(23,24,18," src/components/ui/dialog.tsx src/components/ui/toast.tsx \
  src/components/ui/filter-chip.tsx src/components/ui/multi-select.tsx \
  src/components/MapaUbicacion.tsx
```

Esperado: ambos comandos sin salida (sin matches). Ojo: `NotificationBell.tsx`
y `AccountMenu.tsx` **siguen** teniendo `rgba(23,24,18,` a propósito (no
están en la lista de arriba) — se eliminan enteros en la Etapa 2, no vale
la pena tocarlos acá.

- [ ] **Step 7: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/badge.tsx \
  src/components/ui/icon-button.tsx src/components/ui/tooltip.tsx \
  src/components/ui/pagination.tsx src/components/ui/input.tsx \
  src/components/ui/select.tsx src/components/ui/dialog.tsx \
  src/components/ui/toast.tsx src/components/ui/filter-chip.tsx \
  src/components/ui/multi-select.tsx src/components/MapaUbicacion.tsx
git commit -m "feat: radius y sombras de componentes UI al sistema R1 (6-8px chico, 10px overlays)"
```

---

## Task 3: `Segmented` (nuevo) — pill-group de 2-3 opciones

**Files:**
- Create: `src/components/ui/segmented.tsx`

**Interfaces:**
- Consumes: `cn` (`src/lib/utils.ts`).
- Produces: `Segmented<T extends string>` (`{ value: T; onChange: (value: T) => void; options: { value: T; label: string }[]; className?: string }`). Usado por Turnos (Cumplimiento: Todos/Con desvío) y Horas (Mes/Quincena/Semana) en etapas posteriores.

- [ ] **Step 1: Crear `segmented.tsx`**

```tsx
import { cn } from "../../lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
}

function Segmented<T extends string>({ value, onChange, options, className }: SegmentedProps<T>) {
  return (
    <div role="tablist" className={cn("inline-flex items-center gap-0.5 rounded-[8px] bg-surface p-0.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors",
            opt.value === value
              ? "bg-surface-raised text-text shadow-[0_1px_2px_rgba(13,13,17,.08)]"
              : "text-text-secondary hover:text-text"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export { Segmented };
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores. `Segmented` queda sin consumidores hasta la Etapa 4
(Turnos/Horas) — esperable.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/segmented.tsx
git commit -m "feat: componente Segmented (pill-group) para vistas de 2-3 opciones"
```

---

## Task 4: `Toolbar` + `SearchInput` (nuevos) — shell de filtros

**Files:**
- Create: `src/components/ui/toolbar.tsx`
- Create: `src/components/ui/search-input.tsx`

**Interfaces:**
- Consumes: `cn` (`src/lib/utils.ts`); `Input`/`InputProps`
  (`src/components/ui/input.tsx`, ya existente — `InputProps` es alias de
  `React.InputHTMLAttributes<HTMLInputElement>`).
- Produces: `Toolbar` (wrapper `React.HTMLAttributes<HTMLDivElement>`,
  aplica la clase `.page-filters` ya definida en `src/index.css` — fila
  flex con wrap, gap, borde inferior). `SearchInput`
  (`InputProps & { containerClassName?: string }`, forwardRef a
  `HTMLInputElement`) — input con ícono de lupa a la izquierda. Ambos
  reemplazan a `FilterChip` como patrón de filtros; consumidos recién en
  las Etapas 3 a 6 cuando cada página migre su Toolbar de filtros. El
  contador de resultados ("N resultados") y el botón "Limpiar filtros" no
  llevan componente nuevo: el primero es un `<span>` suelto dentro del
  `Toolbar` (`ml-auto`), el segundo ya existe
  (`src/components/ui/clear-filters-button.tsx`, sin cambios).

- [ ] **Step 1: Crear `toolbar.tsx`**

Reusa `.page-filters` (`src/index.css:90-97`: `display:flex;
flex-wrap:wrap; align-items:flex-end; gap:.75rem; border-bottom:1px solid
var(--color-border); padding:1rem 0`) en vez de redefinir el mismo layout
en Tailwind.

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export type ToolbarProps = React.HTMLAttributes<HTMLDivElement>;

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("page-filters", className)} {...props} />
);
Toolbar.displayName = "Toolbar";

export { Toolbar };
```

- [ ] **Step 2: Crear `search-input.tsx`**

```tsx
import * as React from "react";
import { Search } from "lucide-react";
import { Input, type InputProps } from "./input";
import { cn } from "../../lib/utils";

export interface SearchInputProps extends InputProps {
  containerClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn("relative", containerClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
      <Input ref={ref} type="search" className={cn("pl-9", className)} {...props} />
    </div>
  )
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
```

- [ ] **Step 3: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/toolbar.tsx src/components/ui/search-input.tsx
git commit -m "feat: componentes Toolbar y SearchInput (shell de filtros, reemplazan a FilterChip)"
```

---

## Task 5: `SidePanel` (nuevo) — panel lateral de detalle/edición

**Files:**
- Create: `src/components/ui/side-panel.tsx`

**Interfaces:**
- Consumes: `cn` (`src/lib/utils.ts`), ícono `X` de `lucide-react`.
- Produces: `SidePanel` (`{ open: boolean; onClose: () => void; title:
  string; children: ReactNode; footer?: ReactNode; className?: string }`).
  Mismo shape de props que `Dialog` (`src/components/ui/dialog.tsx`) más
  `footer` opcional, para que migrar de uno a otro en una página futura
  sea directo. Sin animación de entrada/salida — mismo criterio que
  `Dialog`, que tampoco anima. Consumido en las Etapas 3 (detalle de
  Asistencia), 4 (horario de Turnos) y 6 (detalle de Ausencia).

- [ ] **Step 1: Crear `side-panel.tsx`**

```tsx
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

function SidePanel({ open, onClose, title, children, footer, className }: SidePanelProps) {
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-text/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex h-full w-full max-w-[420px] flex-col border-l border-border bg-surface-raised",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-text">{title}</span>
          <button
            onClick={onClose}
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-text/5 text-text-secondary hover:bg-text/10"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export { SidePanel };
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/side-panel.tsx
git commit -m "feat: componente SidePanel (detalle/edición lateral)"
```

---

## Task 6: `StatRow`, `Meter`, `Sparkline` (nuevos) — KPIs de dashboard y Horas

**Files:**
- Create: `src/components/ui/stat-row.tsx`
- Create: `src/components/ui/meter.tsx`
- Create: `src/components/ui/sparkline.tsx`

**Interfaces:**
- Consumes: `cn` (`src/lib/utils.ts`); clase `.data-number` de
  `src/index.css:106-109` (mono, tracking negativo) para los números
  grandes.
- Produces: `StatRow` (`{ stats: { label: string; value: ReactNode; meta?:
  ReactNode; tone?: "default" | "warning" | "alert" }[] } &
  HTMLAttributes<HTMLDivElement>`) — fila de KPIs en grid con divisores.
  `Meter` (`{ value: number; max: number; warnBelow?: number } &
  HTMLAttributes<HTMLDivElement>`, `warnBelow` es una fracción 0-1: si
  `value/max` cae por debajo, la barra y el texto pasan a tono warning) —
  usado en la columna "Avance" de Horas. `Sparkline` (`{ data: number[];
  width?: number; height?: number; className?: string }`, SVG puro sin
  librería — el color de la línea sale de `currentColor`, el consumidor
  lo fija con una clase de texto como `text-accent`). Los tres quedan sin
  consumidores hasta la Etapa 3 (Dashboard) y Etapa 4 (Horas).

- [ ] **Step 1: Crear `stat-row.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface Stat {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  tone?: "default" | "warning" | "alert";
}

export interface StatRowProps extends React.HTMLAttributes<HTMLDivElement> {
  stats: Stat[];
}

const TONE_CLASS = {
  default: "text-text",
  warning: "text-warning",
  alert: "text-alert",
} as const;

function StatRow({ stats, className, ...props }: StatRowProps) {
  return (
    <div
      className={cn("grid divide-x divide-border overflow-hidden rounded-[10px] border border-border bg-surface-raised", className)}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      {...props}
    >
      {stats.map((s, i) => (
        <div key={i} className="px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-text-tertiary">{s.label}</p>
          <p className={cn("data-number mt-1 text-[26px] font-medium", TONE_CLASS[s.tone ?? "default"])}>
            {s.value}
          </p>
          {s.meta && <p className="mt-0.5 text-[12.5px] text-text-secondary">{s.meta}</p>}
        </div>
      ))}
    </div>
  );
}

export { StatRow };
```

- [ ] **Step 2: Crear `meter.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
  warnBelow?: number;
}

function Meter({ value, max, warnBelow, className, ...props }: MeterProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const warn = warnBelow != null && max > 0 && value / max < warnBelow;
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border-soft">
        <div className={cn("h-full rounded-full", warn ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("data-number text-[12.5px]", warn ? "text-warning" : "text-text-secondary")}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export { Meter };
```

- [ ] **Step 3: Crear `sparkline.tsx`**

```tsx
export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

function Sparkline({ data, width = 96, height = 28, className }: SparklineProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} className={className} role="img" aria-label="Tendencia">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export { Sparkline };
```

- [ ] **Step 4: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/stat-row.tsx src/components/ui/meter.tsx src/components/ui/sparkline.tsx
git commit -m "feat: componentes StatRow, Meter y Sparkline para KPIs de Dashboard y Horas"
```

---

## Task 7: `Tabs` (nuevo) — subrayado con badge de contador

**Files:**
- Create: `src/components/ui/tabs.tsx`

**Interfaces:**
- Consumes: `cn` (`src/lib/utils.ts`).
- Produces: `Tabs<T extends string>` (`{ value: T; onChange: (value: T) =>
  void; items: { value: T; label: string; count?: number }[]; className?:
  string }`). Reemplaza el patrón de botones toggle usado hoy en
  `src/pages/turnos/TurnosPage.tsx` (Horarios/Cumplimiento) y se usa para
  los tabs Registros/Rechazadas de Asistencia (Etapa 3) y
  Resumen/Asistencia/Horario/Ausencias del detalle de empleado (Etapa 5).

- [ ] **Step 1: Crear `tabs.tsx`**

```tsx
import { cn } from "../../lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  className?: string;
}

function Tabs<T extends string>({ value, onChange, items, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn("flex items-center gap-5 border-b border-border", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 pb-3 text-[13.5px] font-medium transition-colors",
              active ? "border-accent text-text" : "border-transparent text-text-tertiary hover:text-text-secondary"
            )}
          >
            {item.label}
            {item.count != null && item.count > 0 && (
              <span className="rounded-[6px] bg-accent-100 px-1.5 py-0.5 text-[11px] font-mono text-accent-800">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { Tabs };
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/tabs.tsx
git commit -m "feat: componente Tabs (subrayado + badge de contador)"
```

---

## Al terminar esta etapa

El sistema base queda listo para consumir. La Etapa 2 (Layout global:
Sidebar reskineada + Command Palette, remoción de TopBar) se planifica en
un documento aparte una vez revisada esta etapa — mismo patrón que
`vite-migracion-etapa1..5` en este proyecto.
