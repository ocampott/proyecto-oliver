# Etapa 8 del rediseño R1/R3: polish visual final — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el rediseño R1/R3 resolviendo los hallazgos de la auditoría visual (`.superpowers/etapa8-audit.md`): consistencia entre páginas (iconografía, `kicker`, `Badge`/`Status`, radius, skeletons, escalas de heading) y el pase de accesibilidad de `Tabs` + filas clickeables, sin tocar backend, datos ni UX.

**Architecture:** Quince tasks. Las primeras seis son barridos transversales que tocan primitivos compartidos (`dialog.tsx`, `badge.tsx`, `tabs.tsx`, `meter.tsx`, `table.tsx`, `segmented.tsx`) y sus consumidores; las nueve siguientes son limpieza por página que se apoya en el estado ya barrido. Cada task modifica archivos concretos y termina en un commit propio. No se crea ningún componente nuevo salvo un helper exportado desde `tabs.tsx`.

**Tech Stack:** React 19 + TypeScript + Tailwind v4 (`@theme` en `src/index.css`), `lucide-react`, `@tanstack/react-query` v5, `react-router-dom` v7, `cva` + `cn()` (clsx + tailwind-merge). Mismo stack que las 7 etapas anteriores.

**Spec:** `docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md` — se usan sus **principios** (flat, sin sombra salvo overlays, dos tiers de radius, mono para datos numéricos, tokens `--color-*`), no sus valores hex literales.

**Auditoría (lista autoritativa de qué arreglar):** `.superpowers/etapa8-audit.md`, incluida su sección final "Triage — decisiones del usuario (2026-08-27)", que manda sobre cualquier pregunta abierta en los hallazgos.

### Correcciones de marco de referencia (leer antes de tocar código)

- La sección **"Layout global"** de la spec está **SUPERSEDED** para sidebar/topbar. La sidebar clara integrada que está en producción es la correcta por diseño. **No** planificar ni ejecutar ningún movimiento hacia la sidebar oscura de R1.
- Los tokens viven en `src/index.css` dentro de `@theme` como `--color-*` y **difieren a propósito** de los hex de la spec (el acento que se shipeó es `#047857`, no `#059669`). **Los tokens shipeados son la fuente de verdad.**
- Páginas que ya pasaron por el pase de fidelidad — `AsistenciaPage`, `EmpleadosPage`, `EmpleadoDetallePage`, `HorasPage`, `TurnosPage`, y los compartidos `Toolbar`/`Table`/`Badge`/`Segmented`/`Avatar`/`Field`/`Select` — **solo se tocan para los hallazgos concretos de la auditoría**. No re-trabajarlas.
- R3 (`~/Desktop/R3/src/`) es referencia de **solo lectura**. Mapeo: Oliver `HomePage`↔R3 `Pulso.tsx`, `RrhhPage`↔`Ausencias.tsx`, `SucursalesPage`↔`Sucursales.tsx`, etc.

## Global Constraints

- **Sin cambios de backend.** Ningún endpoint, query param, hook de datos ni schema nuevo. Re-skin/a11y puro.
- **Sin cambios de UX ni de lógica de negocio.** Mismos formularios, validaciones, mutaciones, filtros, paginación, gating por plan/rol.
- **Tokens:** solo `--color-*` / `--font-*` de `src/index.css`. Cero hex/rgb/clases de paleta Tailwind nuevos.
- **Radius:** ~10px cards/dialogs/paneles; ~6-8px inputs/botones/chips/badges. Sin valores fuera de tier.
- **Sombras:** solo en overlays (dialog, side-panel, tooltip, popover, command palette). Nunca sobre card/tabla/toolbar/input.
- **Tipografía global `Archivo` / `IBM Plex Mono` no se toca** (`--font-sans`/`--font-mono`).
- **`npx tsc -b --force` + `npm run build` limpios** antes de dar por buena cualquier task.
- **Regla Badge/Status (decidida en triaje):** `Badge tone=` → estados de un registro; `Status` → solo presencia en vivo; `Badge variant=` → etiquetas estructurales (rol, plan requerido).
- **`kicker` de `PageHeader`:** ninguna página índice del panel lo lleva tras esta etapa.

### Excepción única autorizada al "sin cambios de UX"

Diferido #1 de la auditoría (tab "Equipo" visible con contenido vacío para rol `agent` en Configuración) fue triado explícitamente como "en alcance para Etapa 8, fix chico y seguro, hacerlo". Se ejecuta en **Task 2, Step 6**. Es el único cambio de comportamiento de esta etapa.

### Cómo verificar (este repo no tiene suite de tests de UI)

Ninguna etapa anterior del rediseño agregó tests de UI y esta tampoco lo hace. La verificación de cada task es:

```bash
npx tsc -b --force
npm run build
```

`--force` es **obligatorio**: la caché incremental `.tsbuildinfo` ya reportó falsamente "0 errors" sobre archivos con errores reales en este repo. Ambos comandos tienen que salir con exit code 0.

Las tasks que tocan interacción por teclado (Task 2 y Task 3) suman además un paso de **chequeo manual de teclado** con las teclas exactas a apretar y el comportamiento esperado.

### Mapa de solapamiento de archivos

Cada task posterior hereda el estado que dejaron las anteriores. Los archivos tocados por más de una task:

| Archivo | Tasks |
|---|---|
| `src/components/ui/tabs.tsx` | T2 |
| `src/components/ui/meter.tsx` | T6 (define `block`), T12 (lo usa) |
| `src/components/ui/segmented.tsx` | T9 (agrega `aria-label`), T15 (lo usa) |
| `src/pages/admin/OrganizacionDetallePage.tsx` | T2, T4, T5, T11 |
| `src/pages/configuracion/ConfiguracionPage.tsx` | T2, T4, T5 |
| `src/pages/rrhh/RrhhPage.tsx` | T2, T3, T8 |
| `src/pages/admin/AdminPage.tsx` | T3, T4, T11 |
| `src/pages/sucursales/SucursalesPage.tsx` | T3, T4, T9 |
| `src/components/dashboard/PulsoOperativo.tsx` | T5, T7 |
| `src/pages/HomePage.tsx` | T6, T7 |
| `src/pages/plan/PlanPage.tsx` | T4, T6, T12 |
| `src/pages/sucursales/SucursalDetallePage.tsx` | T6, T9 |
| `src/pages/SetPasswordPage.tsx` | T6, T14 |
| `src/pages/MarcarPage.tsx` | T6, T13 |

---

### Task 1: Primitivos — `dialog.tsx` (X de lucide) + regla Badge/Status documentada

**Files:**
- Modify: `src/components/ui/dialog.tsx:1-2` (imports), `:43-46` (SVG inline del botón cerrar)
- Modify: `src/components/ui/badge.tsx:1-5` (bloque de comentario al tope, antes de `badgeVariants`)

**Interfaces:**
- Consumes: nada de tasks anteriores (es la primera).
- Produces: ningún cambio de API. `Dialog` y `Badge` mantienen exactamente las mismas props (`DialogProps`, `BadgeProps` con `variant?` y `tone?`). Todas las tasks siguientes que usan `<Badge tone=…>` / `<Badge variant=…>` se apoyan en el comentario de regla que agrega esta task, no en firmas nuevas.

**Contexto:** `side-panel.tsx:2` ya importa `{ X } from "lucide-react"` y renderiza `<X className="h-3.5 w-3.5" />` en su botón de cerrar; `dialog.tsx` dibuja su propia X en SVG inline con el mismo tamaño visual. La spec ("Iconografía (R3)") pide que no queden SVGs inline hardcodeados. `badge.tsx` expone dos vocabularios paralelos (`variant` y `tone`) sin ninguna nota que diga cuándo usar cuál — el triaje fijó la regla y este comentario es dónde vive.

- [ ] **Step 1: Importar `X` de lucide en `dialog.tsx`**

Reemplazar, en `src/components/ui/dialog.tsx`:

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";
```

por:

```tsx
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
```

- [ ] **Step 2: Reemplazar el SVG inline del botón cerrar**

Reemplazar:

```tsx
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
```

por:

```tsx
            <X className="h-3.5 w-3.5" />
```

- [ ] **Step 3: Documentar la regla Badge/Status al tope de `badge.tsx`**

Reemplazar, en `src/components/ui/badge.tsx`:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
```

por:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/*
 * Cuándo usar qué (regla del sistema, Etapa 8 del rediseño R1/R3):
 *
 *   <Badge tone="…">     → estado de un registro: activo/inactivo,
 *                          pendiente/suspendido, éxito/alerta de una fila.
 *   <Status tone="…">    → presencia en vivo / "ahora mismo" ÚNICAMENTE
 *                          (status.tsx, punto + label). No para estados
 *                          de datos ni para contadores.
 *   <Badge variant="…">  → etiqueta estructural: rol (owner/admin),
 *                          plan requerido, "Actual", "Sin acceso".
 *
 * `tone` y `variant` son mutuamente excluyentes: si viene `tone`, gana
 * `tone` y se ignora `variant`.
 */
const badgeVariants = cva(
```

- [ ] **Step 4: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. `dialog.tsx` importa `X` y lo usa; no queda ningún import sin usar (`React` y `cn` siguen en uso).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/ui/badge.tsx
git commit -m "refactor: Dialog cierra con el icono X de lucide y Badge documenta la regla tone/variant/Status (Etapa 8 rediseño R1/R3)"
```

---

### Task 2: `tabs.tsx` — a11y completa (ids, roving tabIndex, flechas) + cableado de los 6 consumidores

**Files:**
- Modify: `src/components/ui/tabs.tsx:1-52` (archivo completo)
- Modify: `src/pages/turnos/TurnosPage.tsx:1-30`
- Modify: `src/pages/asistencia/AsistenciaPage.tsx:168` y `:303` (las dos `<section className="page-section">`)
- Modify: `src/pages/rrhh/RrhhPage.tsx:309` y `:405`
- Modify: `src/pages/configuracion/ConfiguracionPage.tsx:100-108` (items de `Tabs`), `:110-161` (panel organización), `:163-225` (panel equipo)
- Modify: `src/pages/admin/OrganizacionDetallePage.tsx:90-93`
- Modify: `src/pages/empleados/EmpleadoDetallePage.tsx:300`, `:364`, `:366`, `:418`

**Interfaces:**
- Consumes: nada de T1 (T1 tocó `dialog.tsx` y `badge.tsx`; base incluye esos cambios pero no los usa acá).
- Produces — **esta es la firma que T7/T8/T11 y cualquier futuro consumidor tienen que usar**:

  ```tsx
  // src/components/ui/tabs.tsx
  export function tabPanelProps(value: string): {
    id: string;                  // `tabpanel-${value}`
    role: "tabpanel";
    "aria-labelledby": string;   // `tab-${value}`
    tabIndex: number;            // 0
  };
  ```

  Se **spreadea sobre el elemento raíz del panel**: `<section {...tabPanelProps("registros")} className="page-section">`. Si el panel es un componente y no un elemento DOM, se envuelve en un `<div>`: `<div {...tabPanelProps("miembros")}><MiembrosTab … /></div>`.
  `Tabs` sigue exportándose con la misma firma pública (`value`, `onChange`, `items`, `className`) y los mismos tipos `TabItem<T>` / `TabsProps<T>`. Los ids que emite son `tab-${item.value}` en cada botón y `aria-controls={`tabpanel-${item.value}`}` — por eso el `value` que se le pasa a `tabPanelProps` tiene que ser **exactamente** el mismo string que el `value` del `TabItem`.

**Contexto:** hoy `tabs.tsx` pone `role="tablist"` y `role="tab"` + `aria-selected` pero le falta todo el resto del patrón APG: `id`/`aria-controls` por tab, roving `tabIndex` (hoy los 4 tabs son tab-stops), navegación con flechas, y ninguna región de contenido declara `role="tabpanel"`. Los consumidores renderizan el panel como condicional pelado (`{tab === "x" && <…/>}`), así que no hay dónde colgar el `role`. El helper `tabPanelProps` resuelve eso sin agregar DOM en los paneles que ya tienen un elemento raíz.

- [ ] **Step 1: Reescribir `src/components/ui/tabs.tsx`**

Reemplazar el contenido completo del archivo por:

```tsx
import * as React from "react";
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

/**
 * Props para la región de contenido de la pestaña `value`. Se spreadean
 * sobre el elemento raíz del panel:
 *
 *   <section {...tabPanelProps("registros")} className="page-section">…</section>
 *
 * Si el panel es un componente (no un elemento DOM), envolverlo en un div:
 *
 *   <div {...tabPanelProps("miembros")}><MiembrosTab orgId={orgId} /></div>
 *
 * El string tiene que ser el mismo `value` del TabItem correspondiente:
 * de ahí salen los ids que `Tabs` referencia con aria-controls.
 */
export function tabPanelProps(value: string) {
  return {
    id: `tabpanel-${value}`,
    role: "tabpanel" as const,
    "aria-labelledby": `tab-${value}`,
    tabIndex: 0,
  };
}

function Tabs<T extends string>({ value, onChange, items, className }: TabsProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Navegación APG: flechas mueven entre tabs (con wrap), Home/End a los
  // extremos. El foco sigue a la selección, que es el modo "automatic
  // activation" — el panel se monta al instante, igual que con el click.
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    let next: number;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" className={cn("flex items-center gap-5 border-b border-border", className)}>
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-controls={`tabpanel-${item.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 pb-3 text-[13.5px] font-medium transition-colors",
              active ? "border-accent text-text" : "border-transparent text-text-tertiary hover:text-text-secondary"
            )}
          >
            {item.label}
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
          </button>
        );
      })}
    </div>
  );
}

export { Tabs };
```

Nota: el callback de `ref` usa cuerpo de bloque (`{ refs.current[index] = el; }`) a propósito — React 19 interpreta un valor devuelto por un ref callback como función de limpieza, y `refs.current[index] = el` como expresión devolvería el elemento.

- [ ] **Step 2: Cablear `TurnosPage.tsx`**

Reemplazar, en `src/pages/turnos/TurnosPage.tsx`:

```tsx
import { Tabs } from "../../components/ui/tabs";
```

por:

```tsx
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
```

Y reemplazar:

```tsx
      {tab === "horarios" ? <HorariosTab /> : <CumplimientoTab />}
```

por:

```tsx
      {tab === "horarios" ? (
        <div {...tabPanelProps("horarios")}>
          <HorariosTab />
        </div>
      ) : (
        <div {...tabPanelProps("cumplimiento")}>
          <CumplimientoTab />
        </div>
      )}
```

- [ ] **Step 3: Cablear `asistencia/AsistenciaPage.tsx`**

Reemplazar el import:

```tsx
import { Tabs } from "../../components/ui/tabs";
```

por:

```tsx
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
```

Reemplazar (línea 167-168):

```tsx
      {vista === "registros" && (
        <section className="page-section">
```

por:

```tsx
      {vista === "registros" && (
        <section {...tabPanelProps("registros")} className="page-section">
```

Reemplazar (línea 302-303):

```tsx
      {vista === "rechazadas" && (
        <section className="page-section">
```

por:

```tsx
      {vista === "rechazadas" && (
        <section {...tabPanelProps("rechazadas")} className="page-section">
```

- [ ] **Step 4: Cablear `rrhh/RrhhPage.tsx`**

Reemplazar el import:

```tsx
import { Tabs } from "../../components/ui/tabs";
```

por:

```tsx
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
```

Reemplazar (línea 308-309):

```tsx
      {vista === "registros" && (
        <section className="page-section">
```

por:

```tsx
      {vista === "registros" && (
        <section {...tabPanelProps("registros")} className="page-section">
```

Reemplazar (línea 404-405):

```tsx
      {vista === "categorias" && (
        <Card className="mt-6">
```

por:

```tsx
      {vista === "categorias" && (
        <Card {...tabPanelProps("categorias")} className="mt-6">
```

(`Card` es un `forwardRef` sobre `<div>` que extiende `React.HTMLAttributes<HTMLDivElement>`, así que acepta `id`/`role`/`aria-labelledby`/`tabIndex` sin cambios.)

- [ ] **Step 5: Cablear `configuracion/ConfiguracionPage.tsx`**

Reemplazar el import:

```tsx
import { Tabs } from "../../components/ui/tabs";
```

por:

```tsx
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
```

Reemplazar la apertura del panel "organización" (líneas 110-111):

```tsx
      {tab === "organizacion" && (
        <>
```

por:

```tsx
      {tab === "organizacion" && (
        <div {...tabPanelProps("organizacion")}>
```

Y su cierre (líneas 160-161):

```tsx
        </>
      )}
```

por:

```tsx
        </div>
      )}
```

Reemplazar la apertura del panel "equipo" (líneas 163-164):

```tsx
      {tab === "equipo" && puedeVerEquipo && (
        <Card className="mt-4">
```

por:

```tsx
      {tab === "equipo" && puedeVerEquipo && (
        <Card {...tabPanelProps("equipo")} className="mt-4">
```

- [ ] **Step 6: Ocultar el tab "Equipo" cuando el rol no puede verlo (Diferido #1)**

Este es el único cambio de comportamiento de la etapa, autorizado explícitamente por el triaje. Hoy un usuario con rol `agent` ve el tab "Equipo", lo clickea, y la región de abajo queda vacía porque el contenido está gateado aparte con `puedeVerEquipo`.

En `src/pages/configuracion/ConfiguracionPage.tsx`, reemplazar:

```tsx
          items={[
            { value: "organizacion", label: "Organización" },
            { value: "equipo", label: "Equipo", count: puedeVerEquipo ? miembros.length : undefined },
          ]}
```

por:

```tsx
          items={[
            { value: "organizacion", label: "Organización" },
            // El contenido de "Equipo" está gateado por rol más abajo; si el
            // rol no puede verlo, tampoco tiene que ver la pestaña (quedaba
            // una región vacía para rol `agent`).
            ...(puedeVerEquipo
              ? [{ value: "equipo" as const, label: "Equipo", count: miembros.length }]
              : []),
          ]}
```

- [ ] **Step 7: Cablear `admin/OrganizacionDetallePage.tsx`**

Reemplazar el import:

```tsx
import { Tabs } from "../../components/ui/tabs";
```

por:

```tsx
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
```

Reemplazar:

```tsx
      {tab === "miembros" && <MiembrosTab orgId={orgId} />}
      {tab === "empleados" && <EmpleadosTab orgId={orgId} />}
      {tab === "sucursales" && <SucursalesTab orgId={orgId} />}
      {tab === "suscripcion" && org && <SuscripcionTab orgId={orgId} orgName={org.name} />}
```

por:

```tsx
      {tab === "miembros" && (
        <div {...tabPanelProps("miembros")}>
          <MiembrosTab orgId={orgId} />
        </div>
      )}
      {tab === "empleados" && (
        <div {...tabPanelProps("empleados")}>
          <EmpleadosTab orgId={orgId} />
        </div>
      )}
      {tab === "sucursales" && (
        <div {...tabPanelProps("sucursales")}>
          <SucursalesTab orgId={orgId} />
        </div>
      )}
      {tab === "suscripcion" && org && (
        <div {...tabPanelProps("suscripcion")}>
          <SuscripcionTab orgId={orgId} orgName={org.name} />
        </div>
      )}
```

- [ ] **Step 8: Cablear `empleados/EmpleadoDetallePage.tsx`**

Reemplazar el import:

```tsx
import { Tabs } from "../../components/ui/tabs";
```

por:

```tsx
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
```

Reemplazar (líneas 300-301):

```tsx
      {vista === "resumen" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
```

por:

```tsx
      {vista === "resumen" && (
        <div {...tabPanelProps("resumen")} className="mt-6 grid gap-4 md:grid-cols-2">
```

Reemplazar (línea 364):

```tsx
      {vista === "asistencia" && <AsistenciaTab empleadoId={empleado.id} />}
```

por:

```tsx
      {vista === "asistencia" && (
        <div {...tabPanelProps("asistencia")}>
          <AsistenciaTab empleadoId={empleado.id} />
        </div>
      )}
```

Reemplazar (líneas 366-367):

```tsx
      {vista === "horario" && (
        <div className="mt-6">
```

por:

```tsx
      {vista === "horario" && (
        <div {...tabPanelProps("horario")} className="mt-6">
```

Reemplazar (línea 418):

```tsx
      {vista === "ausencias" && <AusenciasTab empleadoId={empleado.id} />}
```

por:

```tsx
      {vista === "ausencias" && (
        <div {...tabPanelProps("ausencias")}>
          <AusenciasTab empleadoId={empleado.id} />
        </div>
      )}
```

- [ ] **Step 9: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. Si `tsc` se queja en `ConfiguracionPage` sobre el tipo de `items`, revisar que el `as const` del Step 6 esté puesto sobre `"equipo"`.

- [ ] **Step 10: Chequeo manual de teclado**

```bash
npm run dev
```

Ir a `/turnos` (2 tabs) y a `/configuracion` como owner (2 tabs). Con el navegador, verificar:

| Tecla | Dónde | Esperado |
|---|---|---|
| `Tab` repetido hasta llegar al tablist | cualquier página con tabs | El foco entra **una sola vez** al grupo de tabs, y cae sobre el tab **activo** (no sobre el primero si el activo es otro). Antes entraba una vez por cada tab. |
| `→` (flecha derecha) | foco en un tab | Se selecciona el tab siguiente, el panel de abajo cambia, y el foco se mueve al tab nuevo. En el último tab, vuelve al primero. |
| `←` (flecha izquierda) | foco en un tab | Igual pero hacia atrás; desde el primero salta al último. |
| `Home` | foco en un tab | Salta al primer tab y lo selecciona. |
| `End` | foco en un tab | Salta al último tab y lo selecciona. |
| `Tab` (una vez desde el tab activo) | foco en un tab | El foco pasa a la región de contenido (el panel), que ahora es un tab-stop propio (`tabIndex={0}`) y muestra el outline de foco. El siguiente `Tab` entra al primer control dentro del panel. |
| `Enter` / `Espacio` | foco en un tab | Selecciona ese tab (comportamiento nativo de `<button>`, sin cambios). |

Repetir en `/empleados/:id` (4 tabs) para confirmar el wrap-around con más de dos tabs.

- [ ] **Step 11: Commit**

```bash
git add src/components/ui/tabs.tsx src/pages/turnos/TurnosPage.tsx src/pages/asistencia/AsistenciaPage.tsx src/pages/rrhh/RrhhPage.tsx src/pages/configuracion/ConfiguracionPage.tsx src/pages/admin/OrganizacionDetallePage.tsx src/pages/empleados/EmpleadoDetallePage.tsx
git commit -m "feat: Tabs con patrón ARIA completo (ids, roving tabIndex, flechas) y tabpanel en los 6 consumidores (Etapa 8 rediseño R1/R3)"
```

---

### Task 3: Patrón de fila clickeable — un solo enfoque en las 3 páginas

**Files:**
- Modify: `src/pages/admin/AdminPage.tsx:148-161` (fila + primera celda)
- Modify: `src/pages/sucursales/SucursalesPage.tsx:259-272`
- Modify: `src/pages/rrhh/RrhhPage.tsx:362-377`

**Interfaces:**
- Consumes: nada de T1/T2. **T2 ya modificó `RrhhPage.tsx`** (import de `tabPanelProps` y las dos aperturas de panel) — tu base incluye ese cambio; no lo deshagas.
- Produces: ningún tipo ni helper nuevo. El patrón que fija esta task y que T9/T11 tienen que respetar cuando toquen esas filas:

  ```tsx
  <TableRow className="cursor-pointer" onClick={…}>            // sin role/tabIndex/onKeyDown
    <TableCell className="relative">
      {contenidoVisible}
      <button type="button" className="absolute inset-0" aria-label="…" />   // sin onClick
    </TableCell>
    …
    <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
  ```

**Contexto:** las 3 páginas usan hoy `<tr role="button" tabIndex={0} onKeyDown>` con una celda de acciones que contiene `<button>`s. Eso es anidamiento ARIA inválido (un `button` no puede contener botones) y además le saca a la fila la semántica de fila de tabla para las tecnologías asistivas.

**Por qué el overlay y no un link/botón visible en la primera celda:** un `<button className="absolute inset-0">` sin handler propio deja el contenido visible **exactamente igual** (cero cambio visual, que es el requisito de la auditoría), sirve igual para las dos páginas que navegan por ruta y para `RrhhPage` que abre un `SidePanel` con un handler JS, y aprovecha que un `<button>` nativo convierte `Enter` y `Espacio` en un `click` que **burbujea hasta el `<tr>`** — así el handler de fila que ya existe sigue siendo el único punto de navegación y no hay doble disparo. Un `<Link>` en la primera celda, en cambio, no serviría en `RrhhPage` y obligaría a dos enfoques distintos.

`position: relative` sobre `<tr>` no es confiable entre navegadores, así que el overlay cubre la **primera celda**, no la fila entera. Es un solo tab-stop por fila, que es lo que se busca.

- [ ] **Step 1: `AdminPage.tsx` — fila sin `role="button"` + overlay en la celda del nombre**

Reemplazar:

```tsx
              <TableRow
                key={org.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => navigate(`/admin/organizaciones/${org.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/admin/organizaciones/${org.id}`);
                  }
                }}
              >
                <TableCell>{org.name}</TableCell>
```

por:

```tsx
              <TableRow
                key={org.id}
                className="cursor-pointer"
                onClick={() => navigate(`/admin/organizaciones/${org.id}`)}
              >
                <TableCell className="relative">
                  {org.name}
                  {/* Sin onClick: el click nativo del botón (mouse, Enter o
                      Espacio) burbujea al onClick de la fila. Un solo punto
                      de navegación, un solo tab-stop, cero cambio visual. */}
                  <button
                    type="button"
                    className="absolute inset-0"
                    aria-label={`Ver detalle de ${org.name}`}
                  />
                </TableCell>
```

- [ ] **Step 2: `SucursalesPage.tsx` — mismo patrón**

Reemplazar:

```tsx
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
```

por:

```tsx
              <TableRow
                key={suc.id}
                className={cn("cursor-pointer", !suc.activa && "text-text-muted")}
                onClick={() => navigate(`/sucursales/${suc.id}`)}
              >
                <TableCell className="relative">
                  {suc.nombre}
                  {/* Sin onClick: el click nativo del botón (mouse, Enter o
                      Espacio) burbujea al onClick de la fila. */}
                  <button
                    type="button"
                    className="absolute inset-0"
                    aria-label={`Ver detalle de ${suc.nombre}`}
                  />
                </TableCell>
```

- [ ] **Step 3: `RrhhPage.tsx` — mismo patrón sobre la celda de `PersonCell`**

Reemplazar:

```tsx
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
```

por:

```tsx
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
```

- [ ] **Step 4: Verificar que las celdas de acciones siguen parando la propagación**

No hay que cambiar nada: las tres ya tienen el `stopPropagation` en click y en keydown y **se mantienen tal cual**. Confirmar con:

```bash
rg -n "stopPropagation" src/pages/admin/AdminPage.tsx src/pages/sucursales/SucursalesPage.tsx src/pages/rrhh/RrhhPage.tsx
```

Expected: dos líneas por archivo (`onClick={(e) => e.stopPropagation()}` y `onKeyDown={(e) => e.stopPropagation()}`), es decir 6 coincidencias en total.

- [ ] **Step 5: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. En `SucursalesPage.tsx`, `cn` sigue en uso (la fila mantiene el `className` condicional); en `AdminPage.tsx` y `RrhhPage.tsx` no quedaron imports huérfanos porque no se sacó ningún import.

- [ ] **Step 6: Chequeo manual de teclado**

```bash
npm run dev
```

Probar en `/admin` (superadmin), `/sucursales` y `/rrhh`:

| Tecla | Esperado |
|---|---|
| `Tab` hasta entrar a la tabla | El foco cae sobre el overlay de la primera celda de la primera fila. El outline de foco rodea esa celda. El contenido de la fila **se ve idéntico** a antes cuando no hay foco. |
| `Enter` con el foco en el overlay | Navega al detalle (`/admin/organizaciones/:id`, `/sucursales/:id`) o abre el `SidePanel` de la ausencia en `/rrhh`. **Una sola vez** — no doble navegación. |
| `Espacio` con el foco en el overlay | Mismo resultado que `Enter`. |
| `Tab` desde el overlay | Pasa a los `IconButton` de la celda de acciones de esa misma fila (los botones aparecen porque la fila tiene `group-focus-within:opacity-100`). |
| `Enter` sobre un `IconButton` de acciones | Ejecuta **solo** esa acción (editar / activar / QR / borrar). **No** navega ni abre el panel de detalle. |
| `Tab` desde el último `IconButton` de la fila | Pasa al overlay de la fila siguiente. |
| Click con el mouse en cualquier celda que no sea la de acciones | Navega / abre el panel, igual que antes. |

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/AdminPage.tsx src/pages/sucursales/SucursalesPage.tsx src/pages/rrhh/RrhhPage.tsx
git commit -m "fix: filas clickeables recuperan semántica de fila y se vuelven alcanzables por teclado con un overlay accesible (Etapa 8 rediseño R1/R3)"
```

---

### Task 4: Barrido de `kicker` — ninguna página del panel lo lleva

**Files:**
- Modify: `src/pages/sucursales/SucursalesPage.tsx:182`
- Modify: `src/pages/configuracion/ConfiguracionPage.tsx:97`
- Modify: `src/pages/plan/PlanPage.tsx:69`
- Modify: `src/pages/admin/AdminPage.tsx:100`
- Modify: `src/pages/admin/OrganizacionDetallePage.tsx:71-75`

**Interfaces:**
- Consumes: nada. **T2 ya modificó `ConfiguracionPage.tsx` y `OrganizacionDetallePage.tsx`; T3 ya modificó `AdminPage.tsx` y `SucursalesPage.tsx`** — tu base incluye esos cambios.
- Produces: nada. `PageHeader` mantiene su prop `kicker?: string` en `src/components/PageHeader.tsx:11` (no se saca del componente: sigue siendo API válida, simplemente ninguna página del panel la usa después de esta task).

**Contexto:** el pase de fidelidad (2026-08-27, el grupo más grande y más reciente) sacó el `kicker` de todas las páginas índice que tocó — `HomePage`, `EmpleadosPage`, `AsistenciaPage`, `HorasPage`, `TurnosPage`, `RrhhPage`. Quedaron 5 páginas con la convención vieja. El triaje decidió alinear a las 5, incluida `OrganizacionDetallePage` (lo que además resuelve el Diferido #2: queda breadcrumb + título, igual que `EmpleadoDetallePage` y `SucursalDetallePage`).

- [ ] **Step 1: `SucursalesPage.tsx`**

Reemplazar:

```tsx
      <PageHeader kicker="Operación" title="Sucursales" />
```

por:

```tsx
      <PageHeader title="Sucursales" />
```

- [ ] **Step 2: `ConfiguracionPage.tsx`**

Reemplazar:

```tsx
      <PageHeader kicker="Espacio de trabajo" title="Configuración" description="Organización, equipo y permisos." />
```

por:

```tsx
      <PageHeader title="Configuración" description="Organización, equipo y permisos." />
```

- [ ] **Step 3: `PlanPage.tsx`**

Reemplazar:

```tsx
      <PageHeader kicker="Suscripción" title="Tu plan" />
```

por:

```tsx
      <PageHeader title="Tu plan" />
```

- [ ] **Step 4: `AdminPage.tsx`**

Reemplazar:

```tsx
      <PageHeader kicker="Superadmin" title="Organizaciones" />
```

por:

```tsx
      <PageHeader title="Organizaciones" />
```

- [ ] **Step 5: `OrganizacionDetallePage.tsx` — queda breadcrumb + título**

Reemplazar:

```tsx
      <PageHeader
        kicker="Superadmin"
        breadcrumb={[{ label: "Organizaciones", href: "/admin" }]}
        title={org?.name ?? "Organización"}
      />
```

por:

```tsx
      <PageHeader
        breadcrumb={[{ label: "Organizaciones", href: "/admin" }]}
        title={org?.name ?? "Organización"}
      />
```

- [ ] **Step 6: Confirmar que no queda ningún `kicker` en páginas del panel**

```bash
rg -n "kicker" src/pages src/components
```

Expected: solo las 3 líneas de definición en `src/components/PageHeader.tsx` (`kicker?: string` en la interface, el destructuring de props, y el render condicional `{kicker && …}` con el `cn(..., kicker && "mt-1")`). Cero coincidencias en `src/pages`.

- [ ] **Step 7: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/pages/sucursales/SucursalesPage.tsx src/pages/configuracion/ConfiguracionPage.tsx src/pages/plan/PlanPage.tsx src/pages/admin/AdminPage.tsx src/pages/admin/OrganizacionDetallePage.tsx
git commit -m "fix: saca el kicker de PageHeader en las 5 páginas que quedaban con la convención vieja (Etapa 8 rediseño R1/R3)"
```

---

### Task 5: Aplicar la regla Badge/Status donde hoy no se cumple

**Files:**
- Modify: `src/pages/admin/OrganizacionDetallePage.tsx:207-209` (`SucursalesTab`)
- Modify: `src/pages/configuracion/ConfiguracionPage.tsx:200-202` (estado del miembro)
- Modify: `src/components/dashboard/PulsoOperativo.tsx:111` (`Status` usado como contador)

**Interfaces:**
- Consumes: la regla documentada en `badge.tsx` por **T1**, y `Badge`/`BadgeTone` sin cambios de firma:
  ```tsx
  export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";
  <Badge tone={BadgeTone} className?={string}>…</Badge>
  ```
  **T2 y T4 ya modificaron `ConfiguracionPage.tsx` y `OrganizacionDetallePage.tsx`** — tu base incluye esos cambios.
- Produces: nada. `Status` sigue existiendo con la misma firma para los usos de presencia en vivo.

**Contexto y alcance exacto:** la regla del triaje es `Badge tone=` para estados de un registro, `Status` solo para presencia en vivo, `Badge variant=` para etiquetas estructurales. Se corrigen **los tres casos enumerados en el triaje**, que son los que producen una divergencia real entre páginas:

1. `OrganizacionDetallePage` `SucursalesTab` pinta activa/inactiva con `<Status>` mientras `SucursalesPage.tsx:278` y `SucursalDetallePage.tsx:143` ya usan `<Badge tone>` para lo mismo.
2. `ConfiguracionPage` pinta el estado activo/pendiente del miembro con `<Status>` en la misma fila donde el rol ya es `<Badge variant>`.
3. `PulsoOperativo:111` usa `<Status>` como contador, que no es un estado en absoluto.

**Lo que NO se toca, y por qué** (decisión de alcance de esta task):

- `OrganizacionDetallePage.tsx:166` (`Status` para el estado del empleado) y `RrhhPage.tsx:384` (`Status` para "certificado pendiente") **se dejan como están**. En ambos casos el mismo dato se pinta con `<Status>` de forma **consistente en todas las páginas** (`EmpleadosPage.tsx:423`, `EmpleadoDetallePage.tsx:225` y `:545`, `SucursalDetallePage.tsx:199`, `CumplimientoTab.tsx:168`, `PulsoOperativo.tsx:182`). Convertir solo el uso que está en un archivo que esta etapa toca crearía una **nueva** inconsistencia entre páginas, que es exactamente el problema que la auditoría pide cerrar. Una migración completa de estado-de-empleado a `Badge tone` cruza 6 archivos y páginas ya cerradas por el pase de fidelidad: es su propio cambio, no polish de Etapa 8.
- El **rol del miembro se queda en `Badge variant=`** (`ConfiguracionPage.tsx:198`, `OrganizacionDetallePage.tsx:121`): es una etiqueta estructural, que es justo lo que `variant` representa según la regla.

- [ ] **Step 1: `OrganizacionDetallePage` — `SucursalesTab` pasa a `Badge tone`**

Reemplazar:

```tsx
              <TableCell>
                <Status tone={s.activa ? "success" : "neutral"}>{s.activa ? "Activa" : "Inactiva"}</Status>
              </TableCell>
```

por:

```tsx
              <TableCell>
                <Badge tone={s.activa ? "success" : "neutral"}>{s.activa ? "Activa" : "Inactiva"}</Badge>
              </TableCell>
```

`Badge` ya está importado en el archivo (línea 6) y `Status` sigue en uso en `EmpleadosTab` (línea 166), así que ningún import cambia.

- [ ] **Step 2: `ConfiguracionPage` — estado del miembro pasa a `Badge tone`**

Reemplazar:

```tsx
                    <TableCell>
                      <Status tone={m.activo ? "success" : "warning"}>{m.activo ? "Activo" : "Pendiente"}</Status>
                    </TableCell>
```

por:

```tsx
                    <TableCell>
                      <Badge tone={m.activo ? "success" : "warning"}>{m.activo ? "Activo" : "Pendiente"}</Badge>
                    </TableCell>
```

- [ ] **Step 3: `ConfiguracionPage` — sacar el import de `Status` que queda huérfano**

Ese era el único uso de `Status` en el archivo. Reemplazar:

```tsx
import { Badge } from "../../components/ui/badge";
import { Status } from "../../components/ui/status";
import { IconButton } from "../../components/ui/icon-button";
```

por:

```tsx
import { Badge } from "../../components/ui/badge";
import { IconButton } from "../../components/ui/icon-button";
```

- [ ] **Step 4: `PulsoOperativo` — el contador pasa a pastilla de conteo**

En `src/components/dashboard/PulsoOperativo.tsx`, reemplazar:

```tsx
        {total > 0 && <Status tone="warning">{total}</Status>}
```

por:

```tsx
        {total > 0 && (
          <Badge tone="warning" className="font-mono">
            {total}
          </Badge>
        )}
```

`Badge tone="warning"` ya renderiza `rounded-[6px] px-1.5 py-0.5 text-[11px]` con `bg-warning/15 text-warning` — exactamente la pastilla de conteo que usa `Tabs`. El `font-mono` extra es porque es un dato numérico (principio de la spec: mono para números).

- [ ] **Step 5: `PulsoOperativo` — agregar el import de `Badge`**

Reemplazar:

```tsx
import { Card } from "../ui/card";
import { Status } from "../ui/status";
import { Button } from "../ui/button";
```

por:

```tsx
import { Card } from "../ui/card";
import { Status } from "../ui/status";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
```

`Status` se mantiene: sigue usándose en `AhoraMismo` (línea 29, presencia en vivo — uso correcto según la regla) y en `AusenciasHoy` (línea 182).

- [ ] **Step 6: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. En particular, `tsc` tiene que fallar si el Step 3 se olvidó (import de `Status` sin usar) — `noUnusedLocals` está activo en la config del proyecto; si no lo estuviera, verificar a mano con `rg -n "Status" src/pages/configuracion/ConfiguracionPage.tsx` (esperado: sin coincidencias).

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/OrganizacionDetallePage.tsx src/pages/configuracion/ConfiguracionPage.tsx src/components/dashboard/PulsoOperativo.tsx
git commit -m "fix: aplica la regla Badge tone / Status / Badge variant en Sucursales de admin, miembros de Configuración y el contador del Pulso (Etapa 8 rediseño R1/R3)"
```

---

### Task 6: `Meter` generalizado + normalización de skeletons y spinners

**Files:**
- Modify: `src/components/ui/meter.tsx:1-25` (archivo completo)
- Modify: `src/components/ui/table.tsx:66` (skeleton de celda)
- Modify: `src/pages/SetPasswordPage.tsx:1-7` (imports), `:38-48` (spinner CSS)
- Modify: `src/pages/sucursales/SucursalDetallePage.tsx:108-110` (estado de carga pelado)
- Modify: `src/pages/MarcarPage.tsx:132-140` (estado de carga pelado)
- Modify: `src/pages/plan/PlanPage.tsx:54`, `:57`, `:110`, `:137`
- Modify: `src/pages/HomePage.tsx:82-93` (bloque de skeleton)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces — **esta es la firma que T12 consume**:

  ```tsx
  // src/components/ui/meter.tsx
  export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
    value: number;
    max: number;
    warnBelow?: number;
    /** Barra de ancho completo, sin la lectura de porcentaje al costado. */
    block?: boolean;
  }
  ```

  Sin `block`, `Meter` se comporta **exactamente igual que hoy** (track fijo `w-20` + `NN%` al costado) — los dos consumidores actuales (`EmpleadoDetallePage.tsx:402` y `HorasPage.tsx:301`) no cambian de aspecto. Con `block`, el track pasa a `h-2 w-full` y **no** se renderiza el texto de porcentaje.

- Convención de skeleton que fija esta task y que el resto del plan sigue: **`rounded-[6px] bg-text/10`** para todo bloque de skeleton, sea una línea de texto o el placeholder de una card entera. Un solo radius, un solo tono. Y **un solo spinner**: `<Loader2 className="… animate-spin" />` de `lucide-react`.

**Contexto:** hoy conviven `rounded` (4px de Tailwind), `rounded-[4px]`, `rounded-[6px]`, bloques sin radius, `bg-text/10` y `bg-text/[.08]`, más un spinner CSS hecho a mano con borde en `SetPasswordPage` y dos `<p>Cargando…</p>` pelados. `Meter` tiene el track fijo en `w-20`, lo que impide reusarlo para la barra full-width de `UsoCard` en `PlanPage`.

- [ ] **Step 1: Generalizar `Meter` con la prop `block`**

Reemplazar el contenido completo de `src/components/ui/meter.tsx` por:

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
  warnBelow?: number;
  /** Barra de ancho completo, sin la lectura de porcentaje al costado. */
  block?: boolean;
}

function Meter({ value, max, warnBelow, block, className, ...props }: MeterProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const warn = warnBelow != null && max > 0 && value / max < warnBelow;
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div
        className={cn(
          "h-1.5 overflow-hidden rounded-full bg-border-soft",
          block ? "h-2 w-full" : "w-20"
        )}
      >
        <div className={cn("h-full rounded-full", warn ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      {!block && (
        <span className={cn("data-number text-[12.5px]", warn ? "text-warning" : "text-text-secondary")}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

export { Meter };
```

- [ ] **Step 2: Skeleton de celda de tabla al radius de tier**

En `src/components/ui/table.tsx`, reemplazar:

```tsx
              <div className="h-[14px] animate-pulse rounded bg-text/10" />
```

por:

```tsx
              <div className="h-[14px] animate-pulse rounded-[6px] bg-text/10" />
```

- [ ] **Step 3: `SetPasswordPage` — spinner CSS → `Loader2`**

Reemplazar:

```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
```

por:

```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
```

Y reemplazar:

```tsx
        <div
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-text/15 border-t-accent"
          role="status"
          aria-label="Cargando"
        />
```

por:

```tsx
        <Loader2 className="h-8 w-8 animate-spin text-accent" role="status" aria-label="Cargando" />
```

- [ ] **Step 4: `SucursalDetallePage` — skeleton estructurado en vez de `<p>Cargando…</p>`**

Reemplazar:

```tsx
  if (sucursalesLoading || empleadosLoading) {
    return <p className="text-text-tertiary">Cargando…</p>;
  }
```

por:

```tsx
  if (sucursalesLoading || empleadosLoading) {
    // Misma estructura que la página cargada: PageHeader (breadcrumb +
    // título) → StatRow → grid de dos columnas. Evita el salto de layout.
    return (
      <div className="animate-pulse">
        <div className="border-b border-border pb-5">
          <div className="h-4 w-32 rounded-[6px] bg-text/10" />
          <div className="mt-2 h-8 w-64 rounded-[6px] bg-text/10" />
        </div>
        <div className="mt-6 h-[92px] rounded-[6px] bg-text/10" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="h-64 rounded-[6px] bg-text/10" />
          <div className="h-64 rounded-[6px] bg-text/10" />
        </div>
      </div>
    );
  }
```

- [ ] **Step 5: `MarcarPage` — spinner en vez de `<p>Cargando...</p>`**

`MarcarPage` no es una página de detalle del panel: es una tarjeta pública única, así que le corresponde el spinner, no un skeleton estructurado.

Reemplazar:

```tsx
        <Card className="w-full max-w-sm rounded-[20px] text-center">
          <p className="text-text-tertiary">Cargando...</p>
        </Card>
```

por:

```tsx
        <Card className="w-full max-w-sm rounded-[20px] text-center">
          <Loader2
            className="mx-auto h-6 w-6 animate-spin text-text-tertiary"
            role="status"
            aria-label="Cargando"
          />
        </Card>
```

(El `rounded-[20px]` se corrige en Task 13, no acá.)

- [ ] **Step 6: `MarcarPage` — agregar `Loader2` al import de lucide**

Reemplazar:

```tsx
import { ArrowRight, CheckCircle, LogIn, LogOut, RotateCcw, TriangleAlert } from "lucide-react";
```

por:

```tsx
import { ArrowRight, CheckCircle, Loader2, LogIn, LogOut, RotateCcw, TriangleAlert } from "lucide-react";
```

- [ ] **Step 7: `PlanPage` — unificar los 4 skeletons a `rounded-[6px] bg-text/10`**

Reemplazar:

```tsx
        <div className="h-8 w-48 animate-pulse rounded-[4px] bg-text/10" />
```

por:

```tsx
        <div className="h-8 w-48 animate-pulse rounded-[6px] bg-text/10" />
```

Las dos ocurrencias de `<div key={i} className="h-[320px] animate-pulse rounded-[6px] bg-text/10" />` (líneas 57 y 110) ya están en la convención — **no tocarlas**.

Reemplazar:

```tsx
          <span className="h-5 w-16 animate-pulse rounded bg-text/10" />
```

por:

```tsx
          <span className="h-5 w-16 animate-pulse rounded-[6px] bg-text/10" />
```

(El `bg-text/[.08]` de la línea 143 es la pista de la barra de progreso, no un skeleton: desaparece en Task 12 al reemplazar la barra por `<Meter block>`.)

- [ ] **Step 8: `HomePage` — skeleton con radius y con la forma de la página real**

Reemplazar:

```tsx
  if (isLoading || (isFetching && !org)) {
    return (
      <div className="animate-pulse">
        <div className="h-10 w-64 bg-text/10" />
        <div className="mt-10 grid gap-6 md:grid-cols-4">
          <div className="h-28 bg-text/5 md:col-span-2" />
          <div className="h-28 bg-text/5" />
          <div className="h-28 bg-text/5" />
        </div>
      </div>
    );
  }
```

por:

```tsx
  if (isLoading || (isFetching && !org)) {
    // Misma silueta que la página cargada: PageHeader → StatRow de 4
    // columnas → grid de cards del Pulso operativo.
    return (
      <div className="animate-pulse">
        <div className="h-10 w-64 rounded-[6px] bg-text/10" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-[6px] bg-text/10" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-[6px] bg-text/10" />
          ))}
        </div>
      </div>
    );
  }
```

- [ ] **Step 9: Confirmar que no queda ningún spinner hecho a mano**

```bash
rg -n "animate-spin" src | rg -v "Loader2"
```

Expected: cero coincidencias.

- [ ] **Step 10: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. `Meter` sin `block` sigue tipando igual en `EmpleadoDetallePage.tsx:402` y `HorasPage.tsx:301`.

- [ ] **Step 11: Commit**

```bash
git add src/components/ui/meter.tsx src/components/ui/table.tsx src/pages/SetPasswordPage.tsx src/pages/sucursales/SucursalDetallePage.tsx src/pages/MarcarPage.tsx src/pages/plan/PlanPage.tsx src/pages/HomePage.tsx
git commit -m "refactor: Meter acepta barra full-width y unifica skeletons en rounded-[6px] bg-text/10 con Loader2 como único spinner (Etapa 8 rediseño R1/R3)"
```

---

### Task 7: HomePage + PulsoOperativo — convención `.page-section` y cards hermanas parejas

**Files:**
- Modify: `src/pages/HomePage.tsx:129-148` (los dos headers de sección), `:169` y `:189` (los dos `Badge`)
- Modify: `src/components/dashboard/PulsoOperativo.tsx:28`, `:65`, `:110`, `:165`, `:201` (títulos de card), `:69`, `:116`, `:205` (listas sin scroll), `:107-157` (posición del link "Ver todas" en `PendientesRevision`)

**Interfaces:**
- Consumes: `.page-section` y `.page-section > h2` de `src/index.css:76-88` (`margin-top: 2.5rem`; el `h2` hijo directo recibe `border-bottom`, `padding-bottom: 0.75rem`, `font-size: 0.75rem`, `font-weight: 600`, `letter-spacing: 0.16em`, `text-transform: uppercase`). **T5 ya modificó `PulsoOperativo.tsx`** (el contador de `PendientesRevision` es ahora `<Badge tone="warning" className="font-mono">`) y **T6 ya modificó `HomePage.tsx`** (el skeleton) — tu base incluye ambos.
- Produces: fija el tamaño de título de card del panel en **`text-[14px] font-semibold`**, que es el que T9 verifica en `SucursalDetallePage`.

**Contexto:** `HomePage` arma los headers de sección a mano (`text-sm font-semibold uppercase tracking-[0.16em]` + `border-b border-border pb-3`) con márgenes `mt-8`/`mt-12`, cuando `src/index.css` ya define `.page-section` justo para eso — y con `text-xs` (0.75rem), no `text-sm`. Además el header de "Pulso operativo" no tiene borde inferior y el de "Accesos rápidos" sí. En `PulsoOperativo`, dos de las cinco cards limitan la altura de su lista y tres no, y el link "Ver todas" está arriba en una card y abajo en otra.

**Cómo se pone el meta a la derecha del `h2`:** el `border-bottom` lo aplica el CSS al `h2`, así que si el meta viviera fuera del `h2` el borde quedaría cortado. Por eso el `h2` pasa a ser el contenedor flex de toda la fila, y el `<span>` del meta neutraliza la mayúscula y el tracking heredados con `normal-case tracking-normal`.

- [ ] **Step 1: `HomePage` — sección "Pulso operativo" a `.page-section`**

Reemplazar:

```tsx
      {admin && (
        <section className="mt-8" aria-labelledby="pulso-title">
          <div className="mb-4 flex items-center gap-3">
            <span className="size-2 rounded-full bg-accent" />
            <h2 id="pulso-title" className="text-sm font-semibold uppercase tracking-[0.16em] text-text">
              Pulso operativo
            </h2>
            <span className="font-mono text-xs text-text-tertiary">en vivo</span>
          </div>
          <PulsoOperativo orgId={org.id} />
        </section>
      )}
```

por:

```tsx
      {admin && (
        <section className="page-section" aria-labelledby="pulso-title">
          <h2 id="pulso-title" className="flex items-center gap-3 text-text">
            <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
            Pulso operativo
            <span className="ml-auto font-mono text-xs normal-case tracking-normal text-text-tertiary">
              en vivo
            </span>
          </h2>
          <div className="mt-4">
            <PulsoOperativo orgId={org.id} />
          </div>
        </section>
      )}
```

- [ ] **Step 2: `HomePage` — sección "Accesos rápidos" a `.page-section`**

Reemplazar:

```tsx
      <section className="mt-12" aria-labelledby="accesos-title">
        <div className="flex items-baseline justify-between border-b border-border pb-3">
          <h2 id="accesos-title" className="text-sm font-semibold uppercase tracking-[0.16em] text-text">
            Accesos rápidos
          </h2>
          <span className="font-mono text-xs text-text-tertiary">{ACCESOS.length.toString().padStart(2, "0")} módulos</span>
        </div>
```

por:

```tsx
      <section className="page-section" aria-labelledby="accesos-title">
        <h2 id="accesos-title" className="flex items-baseline gap-3 text-text">
          Accesos rápidos
          <span className="ml-auto font-mono text-xs normal-case tracking-normal text-text-tertiary">
            {ACCESOS.length.toString().padStart(2, "0")} módulos
          </span>
        </h2>
```

El `</section>` de cierre y el `<div className="grid gap-x-8 md:grid-cols-2 lg:grid-cols-3">` que sigue **no cambian**.

- [ ] **Step 3: `HomePage` — unificar los dos `Badge` de la lista de accesos**

Las dos son etiquetas estructurales (`Badge variant=`, según la regla de T1): "Sin acceso" por rol y el plan requerido. Se unifican en `neutral` — `outline` usa el borde de acento, y el acento es el único color de marca, reservado a acciones y estado activo; una etiqueta de "no podés entrar" no debería llevarlo.

Reemplazar:

```tsx
                      <Badge variant="outline" className="ml-2">
                        {PLAN_NOMBRE[a.planRequerido]}
                      </Badge>
```

por:

```tsx
                      <Badge variant="neutral" className="ml-2">
                        {PLAN_NOMBRE[a.planRequerido]}
                      </Badge>
```

`<Badge variant="neutral">Sin acceso</Badge>` (línea 169) ya está bien — no se toca.

- [ ] **Step 4: `PulsoOperativo` — títulos de card a `text-[14px] font-semibold`**

Hay cinco ocurrencias idénticas de `className="text-sm font-semibold"` sobre un `<h3>` (líneas 28, 65, 110, 165, 201). Reemplazar **todas** por `className="text-[14px] font-semibold"`. Los cinco `<h3>` quedan así:

```tsx
        <h3 className="text-[14px] font-semibold">Ahora mismo</h3>
```

```tsx
      <h3 className="text-[14px] font-semibold">Últimos movimientos</h3>
```

```tsx
        <h3 className="text-[14px] font-semibold">Pendientes de revisión</h3>
```

```tsx
        <h3 className="text-[14px] font-semibold">Ausencias de hoy</h3>
```

```tsx
      <h3 className="text-[14px] font-semibold">Olvidaron salida</h3>
```

Verificar después con:

```bash
rg -n "text-sm font-semibold" src/components/dashboard/PulsoOperativo.tsx
```

Expected: cero coincidencias.

- [ ] **Step 5: `PulsoOperativo` — `max-h` + scroll en las tres listas que no lo tienen**

En `UltimosMovimientos`, reemplazar:

```tsx
        <ul className="mt-4 flex flex-col gap-3">
          {enVivo.ultimosMarcados.map((m) => (
```

por:

```tsx
        <ul className="mt-4 flex max-h-[280px] flex-col gap-3 overflow-y-auto">
          {enVivo.ultimosMarcados.map((m) => (
```

En `PendientesRevision`, reemplazar:

```tsx
        <ul className="mt-4 flex flex-col gap-3">
          {rechazadas.map((r) => (
```

por:

```tsx
        <ul className="mt-4 flex max-h-[280px] flex-col gap-3 overflow-y-auto">
          {rechazadas.map((r) => (
```

En `PendingHours`, reemplazar:

```tsx
        <ul className="mt-4 flex flex-col gap-3">
          {query.turnos.slice(0, 4).map((t) => (
```

por:

```tsx
        <ul className="mt-4 flex max-h-[280px] flex-col gap-3 overflow-y-auto">
          {query.turnos.slice(0, 4).map((t) => (
```

`AhoraMismo` (línea 36) y `AusenciasHoy` (línea 173) ya tienen `max-h-[280px] overflow-y-auto` — no se tocan.

- [ ] **Step 6: `PulsoOperativo` — "Ver todas" arriba a la derecha, como en `AusenciasHoy`**

En `PendientesRevision`, reemplazar el header:

```tsx
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">Pendientes de revisión</h3>
        {total > 0 && (
          <Badge tone="warning" className="font-mono">
            {total}
          </Badge>
        )}
      </div>
```

por:

```tsx
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold">Pendientes de revisión</h3>
        <span className="flex shrink-0 items-center gap-2">
          {total > 0 && (
            <Badge tone="warning" className="font-mono">
              {total}
            </Badge>
          )}
          {!isError && total > rechazadas.length && (
            <Link
              to="/asistencia"
              state={{ vista: "rechazadas" }}
              className="text-xs font-medium text-accent-700 hover:underline"
            >
              Ver todas
            </Link>
          )}
        </span>
      </div>
```

Y borrar el bloque del link que estaba al pie de la card:

```tsx
      {!isError && total > rechazadas.length && (
        <Link
          to="/asistencia"
          state={{ vista: "rechazadas" }}
          className="mt-3 inline-block text-xs font-medium text-accent-700 hover:underline"
        >
          Ver todas ({total})
        </Link>
      )}
```

El `({total})` del texto se elimina porque el conteo ya está en la pastilla de al lado, y así el link dice exactamente lo mismo que el de `AusenciasHoy`.

- [ ] **Step 7: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. `Link` sigue importado y en uso en `PulsoOperativo.tsx` (`AusenciasHoy` y el nuevo header de `PendientesRevision`).

- [ ] **Step 8: Commit**

```bash
git add src/pages/HomePage.tsx src/components/dashboard/PulsoOperativo.tsx
git commit -m "fix: Home usa la convención .page-section y el Pulso empareja títulos, scroll y el link Ver todas entre cards hermanas (Etapa 8 rediseño R1/R3)"
```

---

### Task 8: RrhhPage — tags al tier de chips y un solo ritmo antes del Toolbar

**Files:**
- Modify: `src/pages/rrhh/RrhhPage.tsx:308-315` (spacers antes del Toolbar), `:425-439` (tags de categorías)

**Interfaces:**
- Consumes: nada nuevo. **T2 ya modificó este archivo** (import de `tabPanelProps`, `<section {...tabPanelProps("registros")} …>` y `<Card {...tabPanelProps("categorias")} …>`) y **T3 también** (la fila clickeable con overlay) — tu base incluye ambos. Los bloques que reemplazás abajo están escritos **con esos cambios ya aplicados**.
- Produces: nada.

**Contexto:** los tags de "Categorías" usan `rounded-full` (más el botón X interno también `rounded-full`), fuera del tier de chips/badges del sistema (~6-8px), que es lo que usan `Badge`, `Segmented` y las pastillas de conteo de `Tabs`. Y antes del `Toolbar` se apilan tres separadores: `mt-6` del `StatRow`, `mt-6` de los `Tabs`, `page-section` (2.5rem) y encima un `mt-4` interno — más denso arriba que `SucursalesPage`, que va `mt-4` → Toolbar directo.

- [ ] **Step 1: Colapsar el spacer interno**

`page-section` ya aporta 2.5rem de separación respecto de los `Tabs`; el `mt-4` de adentro suma un cuarto escalón. Reemplazar:

```tsx
      {vista === "registros" && (
        <section {...tabPanelProps("registros")} className="page-section">
          <div className="mt-4 flex flex-wrap items-end gap-2">
```

por:

```tsx
      {vista === "registros" && (
        // `page-section` acá se usa solo por su margen superior (2.5rem):
        // no lleva <h2> porque el título de la región lo da la pestaña
        // activa de Tabs. Mismo uso que en AsistenciaPage.
        <section {...tabPanelProps("registros")} className="page-section">
          <div className="flex flex-wrap items-end gap-2">
```

El comentario cierra el hallazgo "[Baja] `page-section` usado solo por su margen superior (sin `<h2>` hijo)": se **deja** el uso (es idéntico al de `AsistenciaPage`, cambiarlo desalinearía las dos páginas) y se documenta por qué.

- [ ] **Step 2: Tags de categorías al radius de chip**

Reemplazar:

```tsx
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
```

por:

```tsx
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
```

- [ ] **Step 3: Confirmar que no quedan `rounded-full` fuera de tier en el archivo**

```bash
rg -n "rounded-full" src/pages/rrhh/RrhhPage.tsx
```

Expected: cero coincidencias. (`rounded-full` sigue siendo válido en el sistema para puntos y barras de progreso — `status.tsx`, `meter.tsx` —, pero no para chips.)

- [ ] **Step 4: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/rrhh/RrhhPage.tsx
git commit -m "fix: tags de categorías al radius de chip y un solo ritmo vertical antes del Toolbar en Ausencias (Etapa 8 rediseño R1/R3)"
```

---

### Task 9: Sucursales — iconos lucide, filtro Segmented, y decisión sobre el mapa del detalle

**Files:**
- Modify: `src/components/ui/segmented.tsx:9-18` (agrega `aria-label`)
- Modify: `src/pages/sucursales/SucursalesPage.tsx:1-27` (imports), `:216-227` (filtro Estado), `:282-338` (SVGs inline de acciones de fila)
- Modify: `src/pages/sucursales/SucursalDetallePage.tsx:241-249` (mapa decorativo — solo se documenta)

**Interfaces:**
- Consumes: `Segmented` de `src/components/ui/segmented.tsx` con la firma actual más el `aria-label` que agrega el Step 1:
  ```tsx
  export interface SegmentedProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: SegmentedOption<T>[];   // { value: T; label: string; count?: number }
    className?: string;
    /** Nombre accesible del grupo (el radiogroup no tiene label visible). */
    "aria-label"?: string;
  }
  ```
  **T3 y T4 ya modificaron `SucursalesPage.tsx`** (fila clickeable + `kicker`) y **T6 ya modificó `SucursalDetallePage.tsx`** (skeleton de carga) — tu base incluye ambos.
- Produces: el `aria-label` de `Segmented`, que **T15 usa** para nombrar el `Segmented` de período en `HorasPage`.

**Contexto:** ésta es la mitad del único hallazgo [Alta] de la auditoría — la spec ("Iconografía (R3)") pidió textualmente reemplazar los SVG inline de acciones de fila de `EmpleadosPage.tsx` y `SucursalesPage.tsx` por sus equivalentes de `lucide-react`, y quedó sin hacer. El patrón correcto ya está en `RrhhPage.tsx:387` (`<Trash2 …>`), `AdminPage.tsx:177` (`<Pencil …>`) y `ConfiguracionPage.tsx:208` (`<Trash2 …>`).

El filtro de Estado son 3 opciones (Todas/Activas/Inactivas), que es justo el caso para el que la spec introdujo `Segmented` y el que ya usa `HorasPage` para el rango de período. R3 usa un `<select>` acá, pero el driver de este cambio es la consistencia interna con `HorasPage`, no la fidelidad literal a R3.

**Sobre el `Segmented` y el nombre accesible:** el `<Select compact>` que se reemplaza pasa su `label` a `aria-label` (ver `select.tsx:28`). `Segmented` renderiza un `role="radiogroup"` sin nombre accesible, así que migrar sin más sería una **regresión de accesibilidad** justo en la etapa que hace el pase de a11y. Por eso el Step 1 agrega la prop.

- [ ] **Step 1: `segmented.tsx` — aceptar `aria-label`**

Reemplazar:

```tsx
export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
}

function Segmented<T extends string>({ value, onChange, options, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" className={cn("inline-flex items-center gap-0.5 rounded-[8px] bg-surface p-0.5", className)}>
```

por:

```tsx
export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  /** Nombre accesible del grupo: el radiogroup no tiene label visible. */
  "aria-label"?: string;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-[8px] bg-surface p-0.5", className)}
    >
```

- [ ] **Step 2: `SucursalesPage` — cambiar los imports**

Reemplazar:

```tsx
import { Search, Plus, Loader2 } from "lucide-react";
```

por:

```tsx
import { Search, Plus, Loader2, Pencil, Power, QrCode, Trash2 } from "lucide-react";
```

Reemplazar:

```tsx
import { Select } from "../../components/ui/select";
```

por:

```tsx
import { Segmented } from "../../components/ui/segmented";
```

(`Select` queda sin uso en el archivo después del Step 3 — es el único lugar donde se usaba.)

- [ ] **Step 3: `SucursalesPage` — filtro Estado con `Segmented`**

Reemplazar:

```tsx
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
```

por:

```tsx
        <Segmented
          aria-label="Estado"
          value={estadoFiltro}
          onChange={(v) => { setEstadoFiltro(v); setPage(1); }}
          options={[
            { value: "todos", label: "Todas" },
            { value: "activos", label: "Activas" },
            { value: "inactivos", label: "Inactivas" },
          ]}
        />
```

`Segmented<T>` infiere `T = EstadoFiltro` desde `value={estadoFiltro}`, así que `v` llega tipado como `EstadoFiltro` y el `as EstadoFiltro` deja de hacer falta.

- [ ] **Step 4: `SucursalesPage` — los 4 SVG inline de acciones de fila a lucide**

Reemplazar el bloque completo de las cuatro acciones:

```tsx
                    <IconButton
                      onClick={() => abrirEdicion(suc)}
                      disabled={!gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a editar sucursales." : undefined}
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      }
                      label="Editar"
                    />
                    <IconButton
                      onClick={() => handleToggleActiva(suc)}
                      disabled={loading || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
                      icon={
                        accionandoId === suc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v6" />
                            <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
                          </svg>
                        )
                      }
                      label={suc.activa ? "Desactivar" : "Activar"}
                    />
                    <IconButton
                      onClick={() => setQrId(suc.id)}
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                          <path d="M14 14h3v3" />
                          <path d="M14 21h7v-4" />
                          <path d="M21 14v3" />
                        </svg>
                      }
                      label="Ver QR"
                    />
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
```

por:

```tsx
                    <IconButton
                      onClick={() => abrirEdicion(suc)}
                      disabled={!gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a editar sucursales." : undefined}
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      label="Editar"
                    />
                    <IconButton
                      onClick={() => handleToggleActiva(suc)}
                      disabled={loading || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
                      icon={
                        accionandoId === suc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )
                      }
                      label={suc.activa ? "Desactivar" : "Activar"}
                    />
                    <IconButton
                      onClick={() => setQrId(suc.id)}
                      icon={<QrCode className="h-3.5 w-3.5" />}
                      label="Ver QR"
                    />
                    {gestionable && !suc.activa && !suc.tiene_asistencia && (
                      <IconButton
                        onClick={() => setEliminarTarget(suc)}
                        disabled={loading}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label="Eliminar"
                      />
                    )}
```

- [ ] **Step 5: `SucursalDetallePage` — decisión sobre el mapa decorativo: se queda, documentado**

**Decisión: NO se monta `MapaUbicacion` en el detalle.** Razones concretas, leídas del código:

1. `MapaUbicacion` (`src/components/MapaUbicacion.tsx:10-18`) tiene `onChange` **requerido** y **no tiene modo lectura**: sus tres caminos de interacción llaman a `onChangeRef.current(...)` — click en el mapa (`:140-143`), arrastre del pin (`marker` con `draggable: true`, `:194-199`) y selección de dirección en el buscador (`:292`). Además renderiza siempre el `<input>` de búsqueda de direcciones (`:322`). Un "modo lectura" no es pasar props distintas: es una prop nueva más ramas en tres `useEffect` y en el render — rediseño del componente, no polish.
2. Montarlo dispara `loadGoogleMaps()` (`:32-38`) en **cada visita** al detalle de sucursal, con su carga de SDK y su map load facturable, para un bloque de 128px de alto que es puramente informativo.
3. La información que la spec quiere que se comunique — centro y radio de la geocerca — ya está: el placeholder dibuja el círculo y el pin, y justo debajo el `<dl>` (`:250-259`) muestra coordenadas exactas y radio en metros. El mapa real sigue estando a un click, en el diálogo de edición.

Reemplazar:

```tsx
            {sucursal.lat != null && sucursal.lon != null ? (
              <>
                <div className="relative mt-3 h-32 overflow-hidden rounded-[8px] border border-border bg-surface">
```

por:

```tsx
            {sucursal.lat != null && sucursal.lon != null ? (
              <>
                {/* Representación decorativa de la geocerca, a propósito.
                    MapaUbicacion es un selector: onChange es requerido y el
                    click en el mapa, el arrastre del pin y el buscador de
                    direcciones siempre mutan el valor — no tiene modo
                    lectura. Montarlo acá además cargaría el SDK de Google
                    Maps en cada visita al detalle. Las coordenadas y el
                    radio exactos están en el <dl> de abajo, y el mapa real
                    está en el diálogo de edición. */}
                <div className="relative mt-3 h-32 overflow-hidden rounded-[8px] border border-border bg-surface">
```

- [ ] **Step 6: `SucursalDetallePage` — confirmar los títulos de card**

El hallazgo cross-cutting de tamaño de título de card se resolvió en `text-[14px] font-semibold` (Task 7). `SucursalDetallePage` **ya** los tiene así en las tres cards. Confirmar:

```bash
rg -n "font-semibold text-text\">" src/pages/sucursales/SucursalDetallePage.tsx
```

Expected: tres líneas, todas con `text-[14px] font-semibold text-text` (Plantel asignado, Marcado por QR, Ubicación y geocerca). Si alguna no coincide, ponerla en `text-[14px] font-semibold`.

- [ ] **Step 7: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. En `SucursalesPage.tsx` no puede quedar ninguna referencia a `Select` (se removió su import). Confirmar con:

```bash
rg -n "Select" src/pages/sucursales/SucursalesPage.tsx
```

Expected: cero coincidencias.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/segmented.tsx src/pages/sucursales/SucursalesPage.tsx src/pages/sucursales/SucursalDetallePage.tsx
git commit -m "feat: Sucursales usa iconos de lucide en las acciones de fila y Segmented para el filtro de estado (Etapa 8 rediseño R1/R3)"
```

---

### Task 10: EmpleadosPage — los 6 SVG inline a `lucide-react`

**Files:**
- Modify: `src/pages/empleados/EmpleadosPage.tsx:3` (import de lucide), `:429-505` (5 acciones de fila), `:667-672` (ícono del diálogo de código)

**Interfaces:**
- Consumes: nada. Ninguna task anterior modificó este archivo — tu base es `main` + T1..T9 en otros archivos.
- Produces: nada.

**Contexto:** ésta es la otra mitad del único hallazgo [Alta]. `EmpleadosPage` pasó por el pase de fidelidad pero conservó 5 SVG hardcodeados en las acciones de fila más 1 en el diálogo de código. Es lo último que queda del ítem de iconografía de la spec.

Mapeo de iconos:

| Línea | Acción | Icono lucide |
|---|---|---|
| 434 | Editar | `Pencil` |
| 448 | Dar de baja / Activar | `Power` |
| 464 | Desvincular dispositivo | `Unlink` |
| 481 | Generar código / Código nuevo | `KeyRound` |
| 495 | Eliminar | `Trash2` |
| 668 | Ícono del diálogo "Código de vinculación" | `KeyRound` |

`Unlink` para desvincular: el SVG actual de esa acción es una variante del ícono de "power" que en contexto significa "desvincular el dispositivo", no "apagar". Usar `Power` en dos acciones distintas de la misma fila las volvería indistinguibles; `Unlink` dice literalmente lo que hace.

- [ ] **Step 1: Ampliar el import de lucide**

Reemplazar:

```tsx
import { Search, Plus, Loader2, Copy } from "lucide-react";
```

por:

```tsx
import { Search, Plus, Loader2, Copy, Pencil, Power, Unlink, KeyRound, Trash2 } from "lucide-react";
```

- [ ] **Step 2: Reemplazar las 5 acciones de fila**

Reemplazar el bloque completo:

```tsx
                    <IconButton
                      onClick={() => abrirEdicion(emp)}
                      disabled={accionandoId === emp.id || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a editar empleados." : undefined}
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      }
                      label="Editar"
                    />
                    <IconButton
                      onClick={() => handleCambiarEstado(emp, emp.estado === "baja" ? "activo" : "baja")}
                      disabled={accionandoId === emp.id || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
                      icon={
                        accionandoId === emp.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v6" />
                            <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
                          </svg>
                        )
                      }
                      label={emp.estado === "baja" ? "Activar" : "Dar de baja"}
                    />
                    {gestionable && emp.device_token && (
                      <IconButton
                        onClick={() => setDesvincularTarget(emp)}
                        disabled={accionandoId === emp.id}
                        icon={
                          accionandoId === emp.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                              <line x1="12" y1="2" x2="12" y2="12" />
                            </svg>
                          )
                        }
                        label="Desvincular"
                      />
                    )}
                    {gestionable && !emp.device_token && (
                      <IconButton
                        onClick={() => handleGenerarCodigo(emp)}
                        disabled={accionandoId === emp.id}
                        icon={
                          accionandoId === emp.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          )
                        }
                        label={emp.otp ? "Código nuevo" : "Generar código"}
                      />
                    )}
                    {gestionable && emp.estado === "baja" && !emp.tiene_asistencia && (
                      <IconButton
                        onClick={() => setEliminarTarget(emp)}
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
```

por:

```tsx
                    <IconButton
                      onClick={() => abrirEdicion(emp)}
                      disabled={accionandoId === emp.id || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a editar empleados." : undefined}
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      label="Editar"
                    />
                    <IconButton
                      onClick={() => handleCambiarEstado(emp, emp.estado === "baja" ? "activo" : "baja")}
                      disabled={accionandoId === emp.id || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
                      icon={
                        accionandoId === emp.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )
                      }
                      label={emp.estado === "baja" ? "Activar" : "Dar de baja"}
                    />
                    {gestionable && emp.device_token && (
                      <IconButton
                        onClick={() => setDesvincularTarget(emp)}
                        disabled={accionandoId === emp.id}
                        icon={
                          accionandoId === emp.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Unlink className="h-3.5 w-3.5" />
                          )
                        }
                        label="Desvincular"
                      />
                    )}
                    {gestionable && !emp.device_token && (
                      <IconButton
                        onClick={() => handleGenerarCodigo(emp)}
                        disabled={accionandoId === emp.id}
                        icon={
                          accionandoId === emp.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <KeyRound className="h-3.5 w-3.5" />
                          )
                        }
                        label={emp.otp ? "Código nuevo" : "Generar código"}
                      />
                    )}
                    {gestionable && emp.estado === "baja" && !emp.tiene_asistencia && (
                      <IconButton
                        onClick={() => setEliminarTarget(emp)}
                        disabled={loading}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label="Eliminar"
                      />
                    )}
```

- [ ] **Step 3: Reemplazar el ícono del diálogo de código**

Reemplazar:

```tsx
        <div className="mx-auto -mt-1 flex h-[52px] w-[52px] items-center justify-center rounded-[6px] bg-accent-100">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
```

por:

```tsx
        <div className="mx-auto -mt-1 flex h-[52px] w-[52px] items-center justify-center rounded-[6px] bg-accent-100">
          <KeyRound className="h-[26px] w-[26px] text-accent" strokeWidth={1.8} />
        </div>
```

- [ ] **Step 4: Confirmar que no queda ningún SVG inline en el archivo**

```bash
rg -n "<svg" src/pages/empleados/EmpleadosPage.tsx src/pages/sucursales/SucursalesPage.tsx src/components/ui/dialog.tsx
```

Expected: cero coincidencias en los tres archivos (Task 1 cerró `dialog.tsx`, Task 9 cerró `SucursalesPage.tsx`, ésta cierra `EmpleadosPage.tsx`).

- [ ] **Step 5: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. Los 5 símbolos nuevos de lucide (`Pencil`, `Power`, `Unlink`, `KeyRound`, `Trash2`) están todos en uso.

- [ ] **Step 6: Commit**

```bash
git add src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat: Empleados usa iconos de lucide en las acciones de fila y en el diálogo de código (Etapa 8 rediseño R1/R3)"
```

---

### Task 11: Admin — estructura de fila de acción/Toolbar y estado vacío filtrado

**Files:**
- Modify: `src/pages/admin/AdminPage.tsx:102-115` (fila de acción + Toolbar), `:182-188` (estado vacío)
- Modify: `src/pages/admin/OrganizacionDetallePage.tsx:275-281` (fila de acción de `SuscripcionTab`)

**Interfaces:**
- Consumes: nada nuevo. **T3 y T4 ya modificaron `AdminPage.tsx`** (fila clickeable con overlay + `kicker` fuera) y **T2, T4 y T5 ya modificaron `OrganizacionDetallePage.tsx`** — tu base incluye los cuatro. Los bloques de abajo están escritos con esos cambios ya aplicados.
- Produces: nada.

**Contexto:** `AdminPage` arma la fila del botón primario con `<div className="mt-4 flex justify-end">` y separa el `Toolbar` con `className="mt-4"`, mientras `EmpleadosPage`, `SucursalesPage` y `RrhhPage` usan `flex flex-wrap items-end gap-2` con el botón en `ml-auto` y un `<Toolbar>` pelado (el `padding: 0.75rem 0` de `.page-filters` ya maneja el espaciado). Y su estado vacío tiene un solo mensaje, sin distinguir "no hay datos" de "el filtro no matchea" — `SucursalesPage.tsx:344-357` sí los distingue.

- [ ] **Step 1: `AdminPage` — alinear la fila de acción y el Toolbar**

Reemplazar:

```tsx
      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            setFormError(null);
            setAltaOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva organización
        </Button>
      </div>

      <Toolbar className="mt-4">
```

por:

```tsx
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Button
          variant="primary"
          className="ml-auto"
          onClick={() => {
            setFormError(null);
            setAltaOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva organización
        </Button>
      </div>

      <Toolbar>
```

- [ ] **Step 2: `AdminPage` — rama "sin coincidencias" en el estado vacío**

Reemplazar:

```tsx
          {!isLoading && organizaciones.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-text-tertiary">
                Todavía no hay organizaciones.
              </TableCell>
            </TableRow>
          )}
```

por:

```tsx
          {!isLoading && organizaciones.length === 0 && busqueda === "" && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-text-tertiary">
                Todavía no hay organizaciones.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && organizaciones.length === 0 && busqueda !== "" && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-text-tertiary">
                Ninguna organización coincide con el filtro.
              </TableCell>
            </TableRow>
          )}
```

El `py-8 text-center` replica exactamente el tratamiento de los dos estados vacíos de `SucursalesPage.tsx:344-357`. `busqueda` es el único filtro de esta página (`AdminPage.tsx:28`), así que no hace falta una variable `filtrosActivos` como en Sucursales.

- [ ] **Step 3: `OrganizacionDetallePage` — alinear la fila de acción de `SuscripcionTab`**

Reemplazar:

```tsx
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => { setFormError(null); setRegistrarOpen(true); }}>
          <Plus className="h-4 w-4" />
          Registrar suscripción
        </Button>
      </div>
```

por:

```tsx
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="primary" className="ml-auto" onClick={() => { setFormError(null); setRegistrarOpen(true); }}>
          <Plus className="h-4 w-4" />
          Registrar suscripción
        </Button>
      </div>
```

- [ ] **Step 4: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminPage.tsx src/pages/admin/OrganizacionDetallePage.tsx
git commit -m "fix: Admin alinea la fila de acción y el Toolbar al patrón de los otros listados y distingue el vacío filtrado (Etapa 8 rediseño R1/R3)"
```

---

### Task 12: PlanPage — escala de headings del panel, peso de precio parejo y `Meter` en `UsoCard`

**Files:**
- Modify: `src/pages/plan/PlanPage.tsx:1-8` (imports), `:75` (nombre del plan), `:106-116` (sección "Comparativa"), `:142-149` (barra de `UsoCard`), `:158` (título de `PlanCard`), `:165` y `:182` (peso del precio)

**Interfaces:**
- Consumes — **la prop `block` de `Meter`, definida en T6**:
  ```tsx
  <Meter value={number} max={number} block />   // track h-2 w-full, sin lectura de %
  ```
  **T4 ya modificó este archivo** (sacó el `kicker`) y **T6 también** (radius de dos skeletons) — tu base incluye ambos.
- Produces: nada.

**Contexto:** `PlanPage` usa una escala de headings mucho más grande que el resto del panel: `text-2xl` para el `<h2>` de sección y para el nombre del plan actual, `text-xl` para el título de las cards. En el resto del panel un header de sección es `.page-section > h2` (0.75rem, uppercase, con borde inferior) y un heading dentro de una `Card` es `text-[16px] font-semibold tracking-[-0.02em]` (`ConfiguracionPage.tsx:127` y `:145`, `RrhhPage.tsx:408`). El precio grande **se mantiene grande**: es la excepción de dato numérico y ya usa `data-number`.

- [ ] **Step 1: Importar `Meter`**

Reemplazar:

```tsx
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
```

por:

```tsx
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Meter } from "../../components/ui/meter";
```

- [ ] **Step 2: Nombre del plan actual a la escala de heading dentro de card**

Reemplazar:

```tsx
            <p className="text-2xl font-semibold tracking-[-0.02em] text-text">{ent.plan.nombre}</p>
```

por:

```tsx
            <p className="text-[16px] font-semibold tracking-[-0.02em] text-text">{ent.plan.nombre}</p>
```

- [ ] **Step 3: "Comparativa de planes" pasa a `.page-section > h2`**

Reemplazar:

```tsx
      <h2 className="mt-8 text-2xl font-semibold tracking-[-0.02em] text-text">Comparativa de planes</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {catLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[320px] animate-pulse rounded-[6px] bg-text/10" />
          ))}
        {!catLoading &&
          planes.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} actual={ent.plan.slug === plan.slug} />
          ))}
      </div>
    </>
```

por:

```tsx
      <section className="page-section">
        <h2 className="text-text">Comparativa de planes</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {catLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[320px] animate-pulse rounded-[6px] bg-text/10" />
            ))}
          {!catLoading &&
            planes.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} actual={ent.plan.slug === plan.slug} />
            ))}
        </div>
      </section>
    </>
```

`.page-section > h2` (definido en `src/index.css:80-88`) aplica solo el tamaño, peso, tracking, uppercase y el borde inferior — el `text-text` explícito es lo único que hace falta agregar.

- [ ] **Step 4: `UsoCard` usa `<Meter block>` en vez de la barra hecha a mano**

Reemplazar:

```tsx
      {max !== null && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-text/[.08]">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${loading ? 0 : porcentajeUso(actual, max)}%` }}
          />
        </div>
      )}
```

por:

```tsx
      {max !== null && (
        <Meter value={loading ? 0 : actual} max={max} block className="mt-2" />
      )}
```

`Meter` calcula internamente el porcentaje con el mismo clamp `Math.min(100, Math.max(0, (value / max) * 100))` que `porcentajeUso`, y `block` le da `h-2 w-full` sin lectura de porcentaje — misma barra que hoy, ahora reusando el primitivo. No se pasa `warnBelow`: la barra actual no tiene estado de advertencia y agregarlo sería un cambio de UX.

- [ ] **Step 5: Borrar `porcentajeUso`, que queda sin uso**

Era su único llamador. Reemplazar:

```tsx
function porcentajeUso(actual: number, max: number | null): number {
  if (max === null || max === 0) return 0;
  return Math.min((actual / max) * 100, 100);
}

export default function PlanPage() {
```

por:

```tsx
export default function PlanPage() {
```

- [ ] **Step 6: Título de `PlanCard` a la escala de heading dentro de card**

Reemplazar:

```tsx
        <h3 className="text-xl font-semibold tracking-[-0.02em] text-text">{plan.nombre}</h3>
```

por:

```tsx
        <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-text">{plan.nombre}</h3>
```

- [ ] **Step 7: Igualar el peso de los dos precios**

El mismo slot visual usa `font-medium` con precio y `font-semibold` con "Gratis". Se unifican en `font-medium`, que es el peso del precio numérico (el caso principal).

Reemplazar:

```tsx
          <p className="text-4xl font-semibold tracking-[-0.02em] text-text">Gratis</p>
```

por:

```tsx
          <p className="text-4xl font-medium tracking-[-0.02em] text-text">Gratis</p>
```

La línea 165 (`<p className="data-number text-4xl font-medium text-text">`) ya está en `font-medium` — no se toca.

- [ ] **Step 8: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. `tsc` tiene que estar contento con `porcentajeUso` eliminado (no queda ninguna referencia) y con `Meter` importado y usado. Confirmar:

```bash
rg -n "porcentajeUso" src/pages/plan/PlanPage.tsx
```

Expected: cero coincidencias.

- [ ] **Step 9: Commit**

```bash
git add src/pages/plan/PlanPage.tsx
git commit -m "fix: Plan baja los headings a la escala del panel, empareja el peso del precio y reusa Meter en las tarjetas de uso (Etapa 8 rediseño R1/R3)"
```

---

### Task 13: MarcarPage — radius dentro de tier e `IconCircle` parametrizado

**Files:**
- Modify: `src/pages/MarcarPage.tsx:18-28` (`IconCircle`), `:135`, `:145`, `:156` (cards), `:174`, `:222`, `:237`, `:246` (botones), `:256` y `:271` (llamadas a `IconCircle`), `:270` (caja de éxito)

**Interfaces:**
- Consumes: nada nuevo. **T6 ya modificó este archivo** (el `<p>Cargando...</p>` es ahora un `<Loader2>` y el import de lucide incluye `Loader2`) — tu base incluye ese cambio.
- Produces: nada. `IconCircle` es local al archivo.

**Contexto:** `MarcarPage` es la única pantalla con radius fuera de los dos tiers: `rounded-[20px]` en las tres `Card`, `rounded-[12px]` en cuatro botones, `rounded-xl` (12px de Tailwind) en la caja de éxito. `card-editorial` (`src/index.css:98-103`) ya define `border-radius: 10px` para toda `Card`, y `buttonVariants` (`src/components/ui/button.tsx:7`) ya define `rounded-[8px]` para todo `Button` — o sea que en ambos casos el fix es **borrar el override**, no reemplazarlo por otro valor. Además `IconCircle` renderiza un círculo de 52px para el tono `alert` y de 26px para `success`, con la diferencia hardcodeada dentro del componente.

- [ ] **Step 1: Parametrizar el tamaño de `IconCircle`**

Los dos tamaños son intencionales (52px es el ícono principal de un estado de error a página completa; 26px es un adorno inline dentro de una línea de texto de éxito), pero hoy están escondidos dentro del componente atados al tono. Se saca el tamaño a una prop, así el componente deja de mezclar tono con escala.

Reemplazar:

```tsx
function IconCircle({ tone, icon }: { tone: "success" | "alert"; icon: ReactNode }) {
  return tone === "alert" ? (
    <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-alert-100">
      {icon}
    </span>
  ) : (
    <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-success-700">
      {icon}
    </span>
  );
}
```

por:

```tsx
function IconCircle({
  tone,
  size,
  icon,
}: {
  tone: "success" | "alert";
  /** Lado del círculo en px. 52 = ícono principal de estado; 26 = adorno inline. */
  size: 26 | 52;
  icon: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex flex-none items-center justify-center rounded-full",
        tone === "alert" ? "bg-alert-100" : "bg-success-700"
      )}
      style={{ height: size, width: size }}
    >
      {icon}
    </span>
  );
}
```

- [ ] **Step 2: Importar `cn`**

Reemplazar:

```tsx
import { Card } from "../components/ui/card";
import { getEstadoMarcado, identificar, verificar, registrarMarca } from "../lib/api";
```

por:

```tsx
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { getEstadoMarcado, identificar, verificar, registrarMarca } from "../lib/api";
```

- [ ] **Step 3: Pasar `size` en las dos llamadas a `IconCircle`**

Reemplazar:

```tsx
            <IconCircle tone="alert" icon={<TriangleAlert className="h-[26px] w-[26px] text-alert" />} />
```

por:

```tsx
            <IconCircle tone="alert" size={52} icon={<TriangleAlert className="h-[26px] w-[26px] text-alert" />} />
```

Reemplazar:

```tsx
            <IconCircle tone="success" icon={<CheckCircle className="h-3.5 w-3.5 text-white" />} />
```

por:

```tsx
            <IconCircle tone="success" size={26} icon={<CheckCircle className="h-3.5 w-3.5 text-white" />} />
```

- [ ] **Step 4: Sacar `rounded-[20px]` de las tres `Card`**

Reemplazar (estado "cargando", ya con el `Loader2` que puso T6):

```tsx
        <Card className="w-full max-w-sm rounded-[20px] text-center">
          <Loader2
```

por:

```tsx
        <Card className="w-full max-w-sm text-center">
          <Loader2
```

Reemplazar (estado "inválido"):

```tsx
        <Card className="w-full max-w-sm rounded-[20px] text-center">
          <p className="text-text">
```

por:

```tsx
        <Card className="w-full max-w-sm text-center">
          <p className="text-text">
```

Reemplazar (card principal):

```tsx
      <Card className="w-full max-w-sm rounded-[20px]">
```

por:

```tsx
      <Card className="w-full max-w-sm">
```

- [ ] **Step 5: Sacar `rounded-[12px]` de los cuatro botones**

Reemplazar:

```tsx
            <Button type="submit" variant="primary" size="lg" className="h-12 justify-between rounded-[12px] text-[15px]" disabled={loading}>
```

por:

```tsx
            <Button type="submit" variant="primary" size="lg" className="h-12 justify-between text-[15px]" disabled={loading}>
```

Reemplazar:

```tsx
            <Button type="submit" variant="primary" size="lg" className="h-12 rounded-[12px] text-[15px]" disabled={loading}>
              Vincular
            </Button>
```

por:

```tsx
            <Button type="submit" variant="primary" size="lg" className="h-12 text-[15px]" disabled={loading}>
              Vincular
            </Button>
```

Reemplazar:

```tsx
            <Button
              onClick={() => handleMarcar("entrada")}
              variant="primary"
              size="lg"
              className="h-12 rounded-[12px] text-[15px]"
              disabled={loading}
            >
```

por:

```tsx
            <Button
              onClick={() => handleMarcar("entrada")}
              variant="primary"
              size="lg"
              className="h-12 text-[15px]"
              disabled={loading}
            >
```

Reemplazar:

```tsx
            <Button
              onClick={() => handleMarcar("salida")}
              variant="secondary"
              size="lg"
              className="h-12 rounded-[12px] text-[15px]"
              disabled={loading}
            >
```

por:

```tsx
            <Button
              onClick={() => handleMarcar("salida")}
              variant="secondary"
              size="lg"
              className="h-12 text-[15px]"
              disabled={loading}
            >
```

(El override de altura `h-12` se mantiene: es densidad táctil de una pantalla móvil, no radius, y está fuera del alcance de esta etapa.)

- [ ] **Step 6: Caja de éxito a `rounded-[10px]`**

Es una superficie tipo panel, no un chip, así que le corresponde el tier de 10px.

Reemplazar:

```tsx
          <div className="mt-4 flex items-center gap-[10px] rounded-xl bg-success-100 px-[14px] py-[13px] text-[13.5px] font-semibold text-success-700">
```

por:

```tsx
          <div className="mt-4 flex items-center gap-[10px] rounded-[10px] bg-success-100 px-[14px] py-[13px] text-[13.5px] font-semibold text-success-700">
```

- [ ] **Step 7: Confirmar que no queda radius fuera de tier**

```bash
rg -n "rounded-\[20px\]|rounded-\[12px\]|rounded-xl|rounded-2xl|rounded-3xl" src
```

Expected: cero coincidencias en todo `src`.

- [ ] **Step 8: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. `tsc` tiene que fallar si alguna llamada a `IconCircle` quedó sin `size` (la prop es requerida) — eso es intencional, es la red de seguridad del Step 3.

- [ ] **Step 9: Commit**

```bash
git add src/pages/MarcarPage.tsx
git commit -m "fix: Marcar vuelve a los dos tiers de radius del sistema y IconCircle recibe el tamaño por prop (Etapa 8 rediseño R1/R3)"
```

---

### Task 14: Pantallas de auth — tracking de headings y un solo padding de card

**Files:**
- Modify: `src/pages/LoginPage.tsx:39`, `:44`, `:56`
- Modify: `src/pages/SetPasswordPage.tsx:53`, `:65`

**Interfaces:**
- Consumes: nada nuevo. **T6 ya modificó `SetPasswordPage.tsx`** (spinner `Loader2` + su import) — tu base incluye ese cambio.
- Produces: fija el padding de card de las pantallas de auth en el **default de `Card` (`p-6`)**.

**Contexto:** el tracking estándar de headings del panel es `-0.02em` (`PageHeader.tsx:41`, `dialog.tsx:37`, todos los `<h2>`/`<h3>` de las páginas) y `-0.03em` en los títulos grandes de auth (`SetPasswordPage.tsx:54` y `:67` ya usan `-0.03em`). `LoginPage` va mucho más apretado: `-0.08em` en el wordmark, `-0.06em` en el claim, `-0.07em` en el `<h1>`. Y el padding de card de auth está partido: `LoginPage` usa el default `p-6` (con `border-0 bg-transparent shadow-none`, así que ni se ve), `SetPasswordPage` fuerza `p-8` en dos lugares. Se elige el default `p-6` — es menos override y es lo que ya usa el resto de la app.

- [ ] **Step 1: `LoginPage` — wordmark**

Reemplazar:

```tsx
        <div className="text-[22px] font-bold tracking-[-0.08em]">
```

por:

```tsx
        <div className="text-[22px] font-bold tracking-[-0.03em]">
```

- [ ] **Step 2: `LoginPage` — claim**

Reemplazar:

```tsx
          <p className="mt-4 max-w-xs text-3xl font-semibold leading-tight tracking-[-0.06em]">
```

por:

```tsx
          <p className="mt-4 max-w-xs text-3xl font-semibold leading-tight tracking-[-0.03em]">
```

- [ ] **Step 3: `LoginPage` — `<h1>`**

Reemplazar:

```tsx
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.07em] text-text">Iniciar sesión</h1>
```

por:

```tsx
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.02em] text-text">Iniciar sesión</h1>
```

- [ ] **Step 4: `SetPasswordPage` — un solo padding de card (el default)**

Reemplazar:

```tsx
        <Card className="w-full max-w-sm p-8 text-center">
```

por:

```tsx
        <Card className="w-full max-w-sm text-center">
```

Reemplazar:

```tsx
      <Card className="w-full max-w-sm p-8">
```

por:

```tsx
      <Card className="w-full max-w-sm">
```

- [ ] **Step 5: Confirmar que no queda tracking fuera de escala en auth**

```bash
rg -n "tracking-\[-0\.0[4-9]" src
```

Expected: cero coincidencias en todo `src`.

- [ ] **Step 6: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/SetPasswordPage.tsx
git commit -m "fix: pantallas de auth vuelven al tracking de headings del panel y al padding de Card por defecto (Etapa 8 rediseño R1/R3)"
```

---

### Task 15: Cabos sueltos — geocerca en color de marca, Command Palette y el MultiSelect de Horas

**Files:**
- Modify: `src/components/MapaUbicacion.tsx:20-26` (constante de color), `:205-214` (opciones del `Circle`)
- Modify: `src/components/CommandPalette.tsx:66-79` (estado de carga), `:106-107`, `:158-171` (refs + scroll), `:199-202` (fila "Buscando…"), `:212-227` (ref del item activo)
- Modify: `src/components/ui/multi-select.tsx:18-19` (doc de `variant`), `:29`, `:68`, `:72-105`, `:110` (variante `chip` → `compact`)
- Modify: `src/pages/horas/HorasPage.tsx:206`, `:225-233`

**Interfaces:**
- Consumes: el `aria-label` de `Segmented` que agregó **T9**.
- Produces — la variante de `MultiSelect` cambia de nombre:
  ```tsx
  export interface MultiSelectProps {
    label: string;
    options: MultiSelectOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    containerClassName?: string;
    /** "field" (default): caja con label, igual que Field/Select.
     *  "compact": trigger h-8 de Toolbar, igual que <Select compact>. */
    variant?: "field" | "compact";
  }
  ```
  `"chip"` deja de existir. El único consumidor de `"chip"` era `HorasPage.tsx:227`; `HorariosTab.tsx:630` usa la variante `"field"` por default y **no cambia**.

**Contexto de cada cabo:**

1. **Geocerca azul.** `MapaUbicacion.tsx:208` y `:211` pasan `#2563eb` a `google.maps.Circle` — el único hex fuera de tokens en todo `src`. En cualquier otra representación de la geocerca el color es el acento esmeralda (`SucursalDetallePage.tsx:247` usa `border-accent-300 bg-accent-100/50`). El SDK de Google Maps recibe un hex plano y no puede leer una variable CSS, así que el token se materializa en una constante del módulo con el comentario que dice de dónde sale — no se usa `getComputedStyle`, que agregaría una lectura de layout y un punto de falla en un `useEffect` para ahorrar una constante.

2. **Command Palette.** Con una query escrita y `useEmpleados()`/`useSucursales()` todavía cargando, los grupos rinden vacío y el usuario ve "Sin resultados." como si no hubiera match. Y la lista tiene `max-h-[360px]` pero el item activo no se scrollea a la vista con las flechas.

3. **MultiSelect de Horas.** La selección **es** multi-empleado genuina: `empleadosSel` es `string[]`, `toggle()` agrega/saca del array y el trigger resume "N seleccionados". No se puede migrar a `<Select compact>` sin perder funcionalidad. Lo que se corrige es el aspecto: la variante `chip` es un pill con `font-mono uppercase` y borde de acento cuando está activa, que no se parece a ningún otro control del `Toolbar`. Se le da el aspecto de `<Select compact>` (`h-8 rounded-[8px] border-border bg-surface-raised text-[13px]`) y, ya que `HorasPage` era su único consumidor, se renombra la variante a `compact` para que el nombre diga lo que hace. La spec anticipaba borrar la variante chip; esto la borra.

- [ ] **Step 1: `MapaUbicacion` — constante de color de marca**

Reemplazar:

```tsx
// Centro por defecto cuando no hay geolocalización disponible (Buenos Aires).
const DEFAULT_CENTER: Coordenadas = { lat: -34.6037, lon: -58.3816 };
```

por:

```tsx
// Único color de marca del sistema: el token --color-accent de
// src/index.css. Va como hex plano porque las opciones de
// google.maps.Circle las consume el SDK, no el CSS — si el token cambia,
// esta constante cambia con él.
const ACCENT = "#047857";

// Centro por defecto cuando no hay geolocalización disponible (Buenos Aires).
const DEFAULT_CENTER: Coordenadas = { lat: -34.6037, lon: -58.3816 };
```

- [ ] **Step 2: `MapaUbicacion` — usar la constante en el `Circle`**

Reemplazar:

```tsx
      circleRef.current = new google.maps.Circle({
        map,
        center: pos,
        strokeColor: "#2563eb",
        strokeWeight: 1.5,
        strokeOpacity: 0.7,
        fillColor: "#2563eb",
        fillOpacity: 0.12,
        clickable: false,
      });
```

por:

```tsx
      circleRef.current = new google.maps.Circle({
        map,
        center: pos,
        strokeColor: ACCENT,
        strokeWeight: 1.5,
        strokeOpacity: 0.7,
        fillColor: ACCENT,
        fillOpacity: 0.12,
        clickable: false,
      });
```

- [ ] **Step 3: `CommandPalette` — exponer el `isLoading` de las dos queries**

Reemplazar:

```tsx
  const { data: empleados = [] } = useEmpleados();
  // ponytail: pageSize 30 fijo (default del hook) — orgs con más de 30
  // sucursales no van a tener cobertura completa acá; pasar a q server-side
  // si algún cliente real llega a ese tamaño.
  const { data: sucursalesPage } = useSucursales();
  const sucursales = sucursalesPage?.data ?? [];
```

por:

```tsx
  const { data: empleados = [], isLoading: empleadosLoading } = useEmpleados();
  // ponytail: pageSize 30 fijo (default del hook) — orgs con más de 30
  // sucursales no van a tener cobertura completa acá; pasar a q server-side
  // si algún cliente real llega a ese tamaño.
  const { data: sucursalesPage, isLoading: sucursalesLoading } = useSucursales();
  const sucursales = sucursalesPage?.data ?? [];
```

- [ ] **Step 4: `CommandPalette` — derivar el estado "buscando"**

Reemplazar:

```tsx
  const q = query.trim().toLowerCase();
  const puedeGestionar = tieneRol(org ?? null, ["owner", "admin"]);
```

por:

```tsx
  const q = query.trim().toLowerCase();
  // Con query escrita y las queries de empleados/sucursales todavía en
  // vuelo, los grupos rinden vacío: sin esto el usuario ve "Sin resultados."
  // como si de verdad no hubiera match.
  const buscando = q !== "" && (empleadosLoading || sucursalesLoading);
  const puedeGestionar = tieneRol(org ?? null, ["owner", "admin"]);
```

- [ ] **Step 5: `CommandPalette` — ref del item activo + `scrollIntoView`**

Reemplazar:

```tsx
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIndex]?.onSelect();
    }
  }

  if (!open) return null;
```

por:

```tsx
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIndex]?.onSelect();
    }
  }

  // La lista tiene max-h-[360px]: al moverse con flechas hay que arrastrar
  // el item activo a la vista.
  const activeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;
```

(El `useEffect` va antes del `if (!open) return null;` — nunca después: un hook detrás de un return temprano rompe el orden de hooks entre renders.)

- [ ] **Step 6: `CommandPalette` — fila "Buscando…"**

Reemplazar:

```tsx
          {flat.length === 0 && (
            <p className="px-3 py-6 text-center text-[13.5px] text-text-tertiary">Sin resultados.</p>
          )}
```

por:

```tsx
          {flat.length === 0 && (
            <p className="px-3 py-6 text-center text-[13.5px] text-text-tertiary">
              {buscando ? "Buscando…" : "Sin resultados."}
            </p>
          )}
```

- [ ] **Step 7: `CommandPalette` — colgar el ref en el botón activo**

Reemplazar:

```tsx
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setActiveIndex(renderedIndex)}
                    onClick={item.onSelect}
```

por:

```tsx
                  <button
                    key={item.key}
                    ref={isActive ? activeRef : undefined}
                    type="button"
                    onMouseEnter={() => setActiveIndex(renderedIndex)}
                    onClick={item.onSelect}
```

- [ ] **Step 8: `multi-select.tsx` — la variante `chip` pasa a `compact` con el aspecto de `<Select compact>`**

Reemplazar:

```tsx
  containerClassName?: string;
  /** "field" (default): labeled box, matches Field/Select. "chip": pill trigger for a filter row, matches FilterChip. */
  variant?: "field" | "chip";
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Elegí opciones",
  containerClassName,
  variant = "field",
}: MultiSelectProps) {
```

por:

```tsx
  containerClassName?: string;
  /**
   * "field" (default): caja con label arriba, igual que Field/Select.
   * "compact": trigger h-8 para la fila de filtros del Toolbar, con el
   * mismo aspecto que <Select compact> — el label pasa a aria-label.
   */
  variant?: "field" | "compact";
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Elegí opciones",
  containerClassName,
  variant = "field",
}: MultiSelectProps) {
```

Reemplazar:

```tsx
  const isChip = variant === "chip";
  const active = value.length > 0;

  return (
    <div ref={ref} className={cn(isChip ? "relative" : "relative flex flex-col gap-[5px]", containerClassName)}>
      {!isChip && (
        <label htmlFor={autoId} className="text-[12px] text-text-secondary">
          {label}
        </label>
      )}
      <button
        id={autoId}
        type="button"
        aria-label={isChip ? label : undefined}
        onClick={() => setOpen((v) => !v)}
        className={
          isChip
            ? cn(
                "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 font-mono text-[11px] font-medium uppercase tracking-[0.04em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                active
                  ? "border-accent bg-accent-100 text-accent-800 hover:bg-accent-200"
                  : "border-border bg-surface text-text-secondary hover:bg-text/[.04]"
              )
            : "flex h-10 w-full items-center justify-between rounded-[8px] border border-border bg-surface-raised px-3 py-2 text-left text-[15px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        }
      >
        {isChip ? (
          <>
            {active ? `${label}: ${summary}` : label}
            <ChevronDown className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            <span className={cn("truncate", value.length === 0 && "text-text-tertiary")}>{summary}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
          </>
        )}
      </button>
```

por:

```tsx
  const isCompact = variant === "compact";

  return (
    <div ref={ref} className={cn(isCompact ? "relative" : "relative flex flex-col gap-[5px]", containerClassName)}>
      {!isCompact && (
        <label htmlFor={autoId} className="text-[12px] text-text-secondary">
          {label}
        </label>
      )}
      <button
        id={autoId}
        type="button"
        aria-label={isCompact ? label : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-[8px] border border-border bg-surface-raised text-left text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          isCompact ? "h-8 px-2.5 text-[13px]" : "h-10 px-3 py-2 text-[15px]"
        )}
      >
        <span className={cn("truncate", value.length === 0 && "text-text-tertiary")}>
          {isCompact && value.length > 0 ? `${label}: ${summary}` : summary}
        </span>
        <ChevronDown
          className={cn("shrink-0 text-text-tertiary", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")}
        />
      </button>
```

Las clases del trigger compacto son literalmente las de `<Select compact>` (`select.tsx:30-31`): mismo alto, mismo radius, mismo borde, mismo fondo, mismo tamaño de texto y mismo tamaño de chevron. Cuando hay selección se antepone el label (`Empleados: 3 seleccionados`) porque en compacto no hay label visible.

Y reemplazar:

```tsx
          <div
            className={cn(
              "absolute left-0 top-[calc(100%+4px)] z-20 flex max-h-72 flex-col overflow-hidden rounded-[10px] border border-border bg-surface-raised shadow-[0_8px_24px_rgba(13,13,17,.1)]",
              isChip ? "w-[240px]" : "w-full"
            )}
          >
```

por:

```tsx
          <div
            className={cn(
              "absolute left-0 top-[calc(100%+4px)] z-20 flex max-h-72 flex-col overflow-hidden rounded-[10px] border border-border bg-surface-raised shadow-[0_8px_24px_rgba(13,13,17,.1)]",
              isCompact ? "w-[240px]" : "w-full"
            )}
          >
```

- [ ] **Step 9: `HorasPage` — usar la variante renombrada y documentar la divergencia**

Reemplazar:

```tsx
        <MultiSelect
          label="Empleados"
          variant="chip"
          value={empleadosSel}
          onChange={setEmpleadosSel}
          options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
          placeholder="Todos"
          containerClassName="w-52"
        />
```

por:

```tsx
        {/* Selección multi-empleado real (empleadosSel es string[]): no se
            puede reemplazar por <Select compact>, así que el trigger se
            estila igual que uno y la diferencia queda solo en el popover. */}
        <MultiSelect
          label="Empleados"
          variant="compact"
          value={empleadosSel}
          onChange={setEmpleadosSel}
          options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
          placeholder="Todos"
          containerClassName="w-52"
        />
```

- [ ] **Step 10: `HorasPage` — nombrar el `Segmented` de período**

Aprovecha el `aria-label` que agregó T9: hoy ese `role="radiogroup"` no tiene nombre accesible.

Reemplazar:

```tsx
        <Segmented
          value={periodo}
          onChange={(p) => {
```

por:

```tsx
        <Segmented
          aria-label="Período"
          value={periodo}
          onChange={(p) => {
```

- [ ] **Step 11: Confirmar que no quedan hex fuera de tokens ni la variante vieja**

```bash
rg -n "#[0-9a-fA-F]{6}" src --glob '!index.css'
rg -n '"chip"' src
```

Expected: la primera solo muestra la constante `ACCENT = "#047857"` de `MapaUbicacion.tsx` (con su comentario explicando por qué). La segunda, cero coincidencias.

- [ ] **Step 12: Verificar typecheck y build**

```bash
npx tsc -b --force
npm run build
```

Expected: ambos exit 0. `tsc` tiene que fallar si quedó algún `variant="chip"` (ya no está en el tipo). `HorariosTab.tsx:630` no pasa `variant`, así que sigue en `"field"` y no cambia.

- [ ] **Step 13: Commit**

```bash
git add src/components/MapaUbicacion.tsx src/components/CommandPalette.tsx src/components/ui/multi-select.tsx src/pages/horas/HorasPage.tsx
git commit -m "fix: geocerca en el color de marca, Command Palette con estado de carga y scroll al item activo, y el MultiSelect de Horas con aspecto de Select compacto (Etapa 8 rediseño R1/R3)"
```

---

## Verificación final de la etapa

Después de la Task 15, correr una pasada completa sobre todo el trabajo:

- [ ] **Typecheck y build limpios desde cero**

```bash
rm -f tsconfig.tsbuildinfo tsconfig.*.tsbuildinfo
npx tsc -b --force
npm run build
```

Expected: ambos exit 0.

- [ ] **Barridos de disciplina del sistema**

```bash
# 1. Cero SVG inline como icono (los iconos son todos de lucide)
rg -n "<svg" src

# 2. Cero radius fuera de los dos tiers
rg -n "rounded-\[20px\]|rounded-\[12px\]|rounded-xl|rounded-2xl|rounded-3xl" src

# 3. Cero hex fuera de tokens (salvo la constante ACCENT del SDK de Maps)
rg -n "#[0-9a-fA-F]{6}" src --glob '!index.css'

# 4. Cero kicker en páginas
rg -n "kicker" src/pages

# 5. Un solo spinner
rg -n "animate-spin" src | rg -v "Loader2"

# 6. Sombras solo en overlays
rg -n "shadow-\[" src
```

Expected:
1. **una sola** coincidencia: `src/components/ui/sparkline.tsx:20`, que es un `<svg>` legítimo — dibuja el gráfico, no es un icono. Cualquier otra coincidencia es un icono que quedó sin migrar;
2. cero coincidencias. (Nota: `rounded-[4px]` sigue existiendo en `src/pages/turnos/HorariosTab.tsx:128` y `:450` y `rounded-md` en `src/components/ui/filter-chip.tsx:47` — la auditoría **no** los flaggeó y Turnos ya pasó por el pase de fidelidad, así que quedan fuera del alcance de esta etapa. No incluirlos en el patrón de búsqueda ni "arreglarlos" de paso.);
3. solo `src/components/MapaUbicacion.tsx` con `const ACCENT = "#047857";`;
4. cero coincidencias;
5. cero coincidencias;
6. solo `dialog.tsx`, `side-panel.tsx`, `CommandPalette.tsx`, `toast.tsx`, `AccountMenu.tsx`, `NotificationBell.tsx`, `MapaUbicacion.tsx` (popover de sugerencias y controles del mapa), `filter-chip.tsx`, `multi-select.tsx` — todos overlays. Ninguna sombra sobre card/tabla/toolbar/input.

- [ ] **Repaso visual en el navegador**

```bash
npm run dev
```

Recorrer `/`, `/asistencia`, `/empleados`, `/empleados/:id`, `/sucursales`, `/sucursales/:id`, `/horas`, `/turnos`, `/rrhh`, `/configuracion`, `/plan`, `/admin`, `/admin/organizaciones/:id`, `/marcar/:org/:sucursal`, `/login`, `/set-password`. Chequear que no haya saltos de layout, badges rotos ni tablas desalineadas.

---

## Nota sobre `.env.local`

Los worktrees de este rediseño se crean sin copiar `.env.local` (el archivo está bloqueado por la configuración de permisos del entorno de estas sesiones — no es un problema del repo). `npx tsc -b --force` y `npm run build` no lo necesitan. Antes de levantar `npm run dev` para el chequeo manual de teclado de las Tasks 2 y 3 y para el repaso visual final, copiar manualmente `.env.local` desde otro worktree del proyecto (por ejemplo `.worktrees/rediseno-r1-r3-etapa4/.env.local`). Sin él, `MapaUbicacion` va a mostrar "Falta configurar la API key de Google Maps", que es un estado esperado y no una regresión.
