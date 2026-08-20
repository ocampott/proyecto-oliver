# Rediseño moderno/suave de web/ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los tokens visuales planos del retrofit Modernist
(esquinas rectas, sin sombra, `Badge` sólido/mayúscula, contenedor gris)
por el lenguaje "moderno y cómodo" aprobado en el canvas de Claude Design
(`https://claude.ai/code/artifact/693d9ac0-9696-4fa5-97d9-b5938ccd1a77`,
página "Rediseño completo — Reimaginado (D)"): fondo neutro claro, cards
blancas con radio y sombra suaves, tablas de densidad cómoda con estados
como punto+etiqueta, navbar superior con pastillas a la derecha y un
popover de cuenta nuevo.

**Architecture:** Reescritura de tokens (`index.css`) y de los componentes
compartidos existentes (`Button`, `Card`, `Field`/`Select`/`Input`,
`Badge`, `Dialog`, `Table`) para que reflejen los valores nuevos, más tres
componentes nuevos (`IconButton`, `Status`, `AccountMenu`) y una reescritura
de `PanelNav`. Después, una pasada pantalla por pantalla adoptando esos
componentes — sin tocar lógica de negocio salvo el nuevo popover de cuenta
(nombre de org + email + cerrar sesión).

**Tech Stack:** Sin dependencias nuevas — Tailwind v4 + `cva` +
`class-variance-authority` + `lucide-react`, todo ya instalado en `web/`.
`AccountMenu` es hecho a mano (mismo criterio que `Dialog`, que tampoco
usa Radix).

**Spec:** `docs/superpowers/specs/2026-08-19-modern-soft-redesign-design.md`

## Global Constraints

- **Sin migración de tipografía** — el usuario eligió mantener Archivo.
  Sin cambios a la fuente en ningún archivo.
- **Sin cambios de comportamiento** salvo: el popover de cuenta nuevo
  (`AccountMenu`) y que "Cerrar sesión" ahí llama a
  `supabase.auth.signOut()` + redirige a `/login`. Todo lo demás es
  visual — mismos handlers, misma lógica de filtrado, mismos hooks.
- **`Login` está fuera de alcance** — el mock aprobado no lo tocó. No
  modificar `web/src/pages/LoginPage.tsx` en este plan.
- **`PanelLayout` no cambia** — sigue proveyendo
  `<main className="mx-auto w-full max-w-[1440px] px-8 py-8">`. Este plan
  toca el `<nav>` (vía `PanelNav`) y el contenido de cada página, nunca el
  contenedor.
- **`Admin` no lleva `PanelNav`/`AccountMenu`** — no está envuelta en
  `PanelLayout` (sin cambios respecto a hoy), mantiene su propio header
  de breadcrumb + pill "Platform admin".
- **"Configuración" en el popover queda sin destino funcional** — se
  muestra pero no navega a ningún lado (decisión del spec §2/§4.7).
- **Sin tests automatizados nuevos** — verificación manual (`npm run
  build` + pasada del usuario en el navegador contra el canvas aprobado).
- Valores exactos (colores, radios, tamaños): citados en cada task desde
  el spec — no hace falta releerlo salvo para verificar algo no cubierto
  acá.

---

## Task 1: Tokens + Button + Card + Field/Select/Input + IconButton (nuevo)

**Files:**
- Modify: `web/src/index.css`
- Modify: `web/src/components/ui/button.tsx`
- Modify: `web/src/components/ui/card.tsx`
- Modify: `web/src/components/ui/field.tsx`
- Modify: `web/src/components/ui/select.tsx`
- Modify: `web/src/components/ui/input.tsx`
- Create: `web/src/components/ui/icon-button.tsx`

**Interfaces:**
- Consumes: `cn` de `web/src/lib/utils.ts` (ya existe).
- Produces: `Button` con los mismos variants (`primary`/`secondary`/
  `ghost`) pero radio 9px y `font-semibold` (600) en vez de
  `font-extrabold` (800). `IconButton` nuevo:
  `{ icon: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>`,
  30×30, sin variantes de color — consumido por los Tasks 7 y 8.

- [ ] **Step 1: Reescribir el bloque `@theme` de `index.css`**

```css
@import "tailwindcss";

@theme {
  --color-bg: #f7f7f8;
  --color-surface: #ffffff;
  --color-text: #18181b;
  --color-text-secondary: #55555d;
  --color-text-tertiary: #9a9aa2;
  --color-text-muted: #c4c4ca;
  --color-accent: #1d4ed8;
  --color-accent-100: color-mix(in oklch, var(--color-accent) 12%, white);
  --color-accent-200: color-mix(in oklch, var(--color-accent) 24%, white);
  --color-accent-300: color-mix(in oklch, var(--color-accent) 40%, white);
  --color-accent-400: color-mix(in oklch, var(--color-accent) 65%, white);
  --color-accent-500: var(--color-accent);
  --color-accent-600: color-mix(in oklch, var(--color-accent) 85%, black);
  --color-accent-700: color-mix(in oklch, var(--color-accent) 68%, black);
  --color-accent-800: color-mix(in oklch, var(--color-accent) 52%, black);
  --color-accent-900: color-mix(in oklch, var(--color-accent) 38%, black);
  --color-border: #e7e7ea;
  --color-border-soft: #f0f0f2;
  --color-success: #22c55e;
  --color-success-700: #15803d;
  --color-warning: #f59e0b;
  --color-alert: #c2410c;
  --color-alert-100: #fdf1e8;
  --color-divider: color-mix(in srgb, var(--color-text) 40%, transparent);
  --font-sans: "Archivo", sans-serif;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}
```

`--color-divider` se mantiene definido (no se borra) — `LoginPage.tsx`
sigue usando `border-divider` y está explícitamente fuera de alcance de
este plan (Global Constraints); borrar el token rompería su borde en
silencio sin que ningún task lo detecte. Ningún archivo tocado por este
plan debe seguir usando `border-divider`/`border-b-2 border-divider` —
pasan a `border-[--color-border]` (contenedores/inputs) o
`border-[--color-border-soft]` (divisores internos de fila, ver Task 4).
`--color-divider` queda así como un token "legacy" con un solo
consumidor (`LoginPage.tsx`), a propósito.

- [ ] **Step 2: Reescribir `button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-semibold text-[14px] transition-colors disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-600 active:bg-accent-700",
        secondary:
          "border border-[--color-border] bg-white text-text hover:bg-black/[.03] active:bg-black/[.06]",
        ghost: "bg-transparent text-accent-700 hover:bg-accent-100 active:bg-accent-200",
      },
      size: {
        default: "h-9 px-[14px] py-2",
        lg: "h-14 w-full px-4 text-[16px] rounded-[14px]",
        icon: "h-9 w-9 p-0",
      },
      block: {
        true: "w-full justify-center",
        false: "",
      },
    },
    compoundVariants: [{ variant: "ghost", size: "default", class: "px-1" }],
    defaultVariants: { variant: "primary", size: "default", block: false },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, block, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

(El `px-1` de `ghost` va en `compoundVariants`, no en la variante misma —
`cva` emite las clases de `variant` antes que las de `size` en el string
final, y `tailwind-merge` se queda con el último `px-*` en conflicto; si
`px-1` estuviera dentro de la variante `ghost`, `size.default`'s
`px-[14px]` lo pisaría silenciosamente. Mismo bug ya diagnosticado y
corregido hoy en el `button.tsx` del retrofit anterior — esta
reescritura ya nace con el fix aplicado.)

- [ ] **Step 3: Reescribir `card.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[14px] border border-[--color-border] bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,.06),0_10px_24px_rgba(24,24,27,.06)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
```

- [ ] **Step 4: Ajustar `field.tsx` — radio y borde nuevos**

Reemplazar solo la clase del `<label>` no cambia; el `Input` que envuelve
hereda los cambios del Step 6. Sin cambios de estructura en `field.tsx`
más allá de lo que ya trae `input.tsx`.

- [ ] **Step 5: Ajustar `select.tsx` — radio y borde nuevos**

Reemplazar la clase del `<select>`:

```tsx
className={cn(
  "flex h-10 w-full rounded-[9px] border border-[--color-border] bg-white px-3 py-2 text-[15px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
  className
)}
```

- [ ] **Step 6: Ajustar `input.tsx` — radio, borde y fondo blanco**

Reemplazar la clase del `<input>`:

```tsx
className={cn(
  "flex h-10 w-full rounded-[9px] border border-[--color-border] bg-white px-3 py-2 text-[15px] text-text placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
  className
)}
```

- [ ] **Step 7: Crear `icon-button.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[--color-border] bg-white text-text-secondary transition-colors hover:bg-black/[.03] disabled:pointer-events-none disabled:opacity-45",
        className
      )}
      {...props}
    >
      {icon}
    </button>
  )
);
IconButton.displayName = "IconButton";

export { IconButton };
```

- [ ] **Step 8: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores. Ningún archivo de página quedó tocado todavía —
las páginas siguen usando `Badge`/`Table` viejos hasta los Tasks 2-4, así
que el build puede mostrar visualmente inconsistente en `npm run dev`
(normal, se corrige task por task).

- [ ] **Step 9: Commit**

```bash
git add web/src/index.css web/src/components/ui/button.tsx web/src/components/ui/card.tsx \
  web/src/components/ui/field.tsx web/src/components/ui/select.tsx web/src/components/ui/input.tsx \
  web/src/components/ui/icon-button.tsx
git commit -m "feat(web): tokens del rediseño moderno + Button/Card/Field/Select/Input + IconButton nuevo"
```

---

## Task 2: Badge retocado + Status (nuevo)

**Files:**
- Modify: `web/src/components/ui/badge.tsx`
- Create: `web/src/components/ui/status.tsx`

**Interfaces:**
- Produces: `Badge` con un único uso previsto ahora (contador "N
  pendientes" en Asistencia) — variants `alert` (nuevo, reemplaza a
  `accent` para ese caso) y `outline`/`filled`/`neutral` quedan pero sin
  consumidores tras este plan (no borrarlos: no rompen nada, y evita un
  scope creep de auditar cada uso). `Status`
  (`{ tone: "success" | "warning" | "neutral" | "accent"; children:
  ReactNode }`) — consumido por los Tasks 7, 8, 9, 10.

- [ ] **Step 1: Agregar variant `alert` a `badge.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold",
  {
    variants: {
      variant: {
        filled: "bg-text text-white",
        outline: "border border-accent-700 text-accent-700",
        accent: "bg-accent-100 text-accent-800",
        neutral: "bg-black/[.06] text-text-secondary",
        alert: "bg-[--color-alert-100] text-[--color-alert]",
      },
    },
    defaultVariants: { variant: "outline" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

(Nota: se quita `uppercase tracking-wide` — el rediseño no usa mayúscula
en pastillas. `rounded-full` reemplaza al radio 0 anterior.)

- [ ] **Step 2: Crear `status.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

const DOT_COLOR = {
  success: "bg-[--color-success]",
  warning: "bg-[--color-warning]",
  neutral: "bg-[--color-text-muted]",
  accent: "bg-accent",
} as const;

const TEXT_COLOR = {
  success: "text-text",
  warning: "text-text",
  neutral: "text-text-muted",
  accent: "text-accent",
} as const;

export interface StatusProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: keyof typeof DOT_COLOR;
}

function Status({ tone, className, children, ...props }: StatusProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-[7px] text-[13px]", TEXT_COLOR[tone], className)}
      {...props}
    >
      <span className={cn("h-[7px] w-[7px] rounded-full", DOT_COLOR[tone])} />
      {children}
    </span>
  );
}

export { Status };
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ui/badge.tsx web/src/components/ui/status.tsx
git commit -m "feat(web): Badge sin mayúscula + variant alert, componente Status nuevo"
```

---

## Task 3: Dialog retocado

**Files:**
- Modify: `web/src/components/ui/dialog.tsx`

**Interfaces:** sin cambios de props (`open`/`onClose`/`title`/`children`/
`className`) — consumido igual por los Tasks 8 y 9.

- [ ] **Step 1: Reescribir `dialog.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Dialog({ open, onClose, title, children, className }: DialogProps) {
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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#18181b]/42 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex w-full max-w-[440px] flex-col gap-3 rounded-[18px] bg-white p-[26px] shadow-[0_24px_60px_rgba(24,24,27,.22),0_4px_14px_rgba(24,24,27,.08)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[19px] font-extrabold text-text">{title}</span>
          <button
            onClick={onClose}
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-black/[.05] text-text-secondary hover:bg-black/[.08]"
            aria-label="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { Dialog };
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ui/dialog.tsx
git commit -m "feat(web): Dialog con radio/sombra del rediseño y botón de cerrar como ícono"
```

---

## Task 4: Table retocada

**Files:**
- Modify: `web/src/components/ui/table.tsx`

**Interfaces:** mismos exports (`Table`, `TableHeader`, `TableBody`,
`TableRow`, `TableHead`, `TableCell`) — `Table` ahora incluye su propio
contenedor con borde/radio y una prop nueva opcional
`containerClassName?: string` para sobreescribir el borde del contenedor
en casos puntuales (antes cada página lo envolvía manualmente con un
`<div className="bg-surface border ...">`, ver Tasks 7-10 que sacan ese
wrapper redundante de cada página; Task 9 consume `containerClassName`
para el borde ámbar de "Intentos rechazados").

- [ ] **Step 1: Reescribir `table.tsx`**

`Table` acepta un `containerClassName` opcional para casos puntuales que
necesitan un borde distinto al estándar (ver Task 9, tabla de "Intentos
rechazados" con borde ámbar) — sin esa prop, el contenedor usa el borde
gris por default.

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn("overflow-hidden rounded-[14px] border border-[--color-border] bg-white", containerClassName)}>
      <table ref={ref} className={cn("w-full text-left text-[13.5px]", className)} {...props} />
    </div>
  )
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <thead ref={ref} className={className} {...props} />);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />);
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => <tr ref={ref} className={className} {...props} />
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "border-b border-[--color-border] px-[18px] py-[13px] text-[11.5px] font-semibold uppercase tracking-wide text-text-tertiary",
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("border-b border-[--color-border-soft] px-[18px] py-[15px]", className)}
      {...props}
    />
  )
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

**Nota para los Tasks 7-10**: como `Table` ahora trae su propio
contenedor con borde/radio, cada página debe sacar el `<div
className="... border ...">` que hoy envuelve manualmente a `<Table>` —
si no se saca, queda un contenedor duplicado (doble borde/radio anidado).

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ui/table.tsx
git commit -m "feat(web): Table con contenedor propio (borde+radio) y densidad cómoda"
```

---

## Task 5: `useOrgActual` compartido + `AccountMenu` (nuevo) + `PanelNav`

**Files:**
- Modify: `web/src/pages/sucursales/hooks.ts`
- Create: `web/src/lib/hooks.ts`
- Create: `web/src/components/AccountMenu.tsx`
- Modify: `web/src/components/PanelNav.tsx`

**Interfaces:**
- Produces: `useOrgActual()` movido a `web/src/lib/hooks.ts`
  (`useQuery({ queryKey: ["org"], queryFn: getOrgActual })`, sin cambios
  de comportamiento — mismo `queryKey`, así que el caché de react-query
  sigue compartido con cualquier otro consumidor). `AccountMenu`: sin
  props, componente autocontenido — consumido por `PanelNav` (este task).

- [ ] **Step 1: Crear `web/src/lib/hooks.ts` con `useOrgActual`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { getOrgActual } from "./api";

export function useOrgActual() {
  return useQuery({ queryKey: ["org"], queryFn: getOrgActual });
}
```

- [ ] **Step 2: Actualizar `web/src/pages/sucursales/hooks.ts` para reexportar**

Ubicar la definición actual de `useOrgActual` en ese archivo (es
`useQuery({ queryKey: ["org"], queryFn: getOrgActual })`) y reemplazarla
por:

```tsx
export { useOrgActual } from "../../lib/hooks";
```

Quitar el import de `getOrgActual` de ese archivo si queda sin otro uso
en el mismo (`useSucursales`/`useCrearSucursal`/etc. no lo usan). Verificar
con:

```bash
grep -n "getOrgActual" web/src/pages/sucursales/hooks.ts
```

Esperado: una sola línea, la del `export` nuevo (o ninguna si el import
directo ya no hace falta porque el reexport no requiere importar la
función).

- [ ] **Step 3: Crear `web/src/components/AccountMenu.tsx`**

Valores de referencia (spec §4.7): panel 232px, radio 14px, sombra igual
a `Dialog`, iniciales = primera letra de la primera palabra + primera
letra de la última palabra de `org.name`, mayúsculas.

```tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useOrgActual } from "../lib/hooks";
import { supabase } from "../lib/supabase";

function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/);
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

export function AccountMenu() {
  const { user } = useAuth();
  const { data: org } = useOrgActual();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleCerrarSesion() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  if (!org) return null;

  return (
    <div ref={ref} className="relative ml-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white"
      >
        {iniciales(org.name)}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+12px)] w-[232px] rounded-[14px] border border-[--color-border-soft] bg-white p-2 shadow-[0_16px_40px_rgba(24,24,27,.18),0_3px_10px_rgba(24,24,27,.06)]">
          <div className="mb-1.5 border-b border-[--color-border-soft] px-3 pb-3 pt-2.5">
            <p className="m-0 text-[13.5px] font-bold text-text">{org.name}</p>
            <p className="m-0.5 text-[12px] text-text-tertiary">{user?.email}</p>
          </div>
          <button
            disabled
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium text-text disabled:opacity-45"
          >
            Configuración
          </button>
          <button
            onClick={handleCerrarSesion}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium text-[--color-alert] hover:bg-black/[.03]"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Reescribir `PanelNav.tsx`**

```tsx
import { NavLink } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";

interface NavItem {
  href: string;
  label: string;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia" },
  { href: "/horas", label: "Horas" },
  { href: "/empleados", label: "Empleados" },
  { href: "/sucursales", label: "Sucursales" },
];

export function PanelNav() {
  return (
    <nav className="sticky top-0 z-20 flex items-center bg-white/90 px-8 py-3.5 shadow-[0_1px_0_rgba(24,24,27,0.07)] backdrop-blur-sm">
      <span className="text-[17px] font-extrabold tracking-tight text-text">oliver</span>
      <div className="ml-auto flex items-center gap-0.5">
        {LINKS.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end
            className={({ isActive }) =>
              isActive
                ? "rounded-full bg-accent-100 px-4 py-2 text-[13.5px] font-semibold text-accent-700"
                : "rounded-full px-4 py-2 text-[13.5px] font-medium text-text-secondary hover:text-text"
            }
          >
            {item.label}
          </NavLink>
        ))}
        <AccountMenu />
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/hooks.ts web/src/pages/sucursales/hooks.ts \
  web/src/components/AccountMenu.tsx web/src/components/PanelNav.tsx
git commit -m "feat(web): nav superior con pastillas a la derecha + popover de cuenta (AccountMenu)"
```

---

## Task 6: Home

**Files:**
- Modify: `web/src/pages/HomePage.tsx`

**Interfaces:** ninguna nueva — sigue usando `Card`/`Button` (ya
retocados en Task 1), sin `Status`/`Table`.

- [ ] **Step 1: Verificar que no necesita cambios propios**

`Card` y `Button` ya traen los estilos nuevos automáticamente (radio,
sombra, blanco). El contenido de `HomePage.tsx` (grilla `sm:grid-cols-2
lg:grid-cols-4`, tamaños de ícono/título/descripción) no cambia — es
puramente el componente `Card` el que se ve distinto. No hay diff que
aplicar en este archivo.

- [ ] **Step 2: Verificar visualmente**

```bash
npm run dev:all
```

Contra `http://localhost:5173`, confirmar que las 4 cards de Home ya se
ven blancas con radio 14px y sombra, sin tocar el archivo.

- [ ] **Step 3: Sin commit**

Este task no genera cambios de código — es una verificación. Si al mirar
`HomePage.tsx` aparece algo que dependa de un token eliminado (por
ejemplo `border-divider`), corregirlo acá y sí commitear:

```bash
grep -n "border-divider\|bg-surface" web/src/pages/HomePage.tsx
```

Esperado: sin resultados. Si hay resultados, reemplazar por los tokens
nuevos del Task 1 y commitear con:
`git commit -m "fix(web): Home sin tokens retirados"`.

---

## Task 7: Sucursales — IconButton, Status, buscador con ícono

**Files:**
- Modify: `web/src/pages/sucursales/SucursalesPage.tsx`

**Interfaces:** Consumes: `IconButton` (Task 1), `Status` (Task 2).

- [ ] **Step 1: Actualizar imports**

```tsx
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Status } from "../../components/ui/status";
import { IconButton } from "../../components/ui/icon-button";
import { Dialog } from "../../components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
```

(Se quita el import de `Badge`, que deja de usarse en este archivo.)

- [ ] **Step 2: Reemplazar la celda "Activa"**

De:
```tsx
<Badge variant={suc.activa ? "filled" : "neutral"}>{suc.activa ? "Sí" : "No"}</Badge>
```
A:
```tsx
<Status tone={suc.activa ? "success" : "neutral"}>{suc.activa ? "Activa" : "Inactiva"}</Status>
```

- [ ] **Step 3: Reemplazar los botones de acción de fila**

De (dentro de la rama `else` del `editandoId === suc.id ? ... : (...)`):
```tsx
<Button
  variant="ghost"
  onClick={() => {
    setEditandoId(suc.id);
    setEdit({ ... });
  }}
>
  Editar
</Button>
<Button variant="ghost" onClick={() => handleToggleActiva(suc)} disabled={loading}>
  {suc.activa ? "Desactivar" : "Activar"}
</Button>
<Button variant="ghost" onClick={() => setQrId(suc.id)}>
  Ver QR
</Button>
```
A:
```tsx
<IconButton
  onClick={() => {
    setEditandoId(suc.id);
    setEdit({
      nombre: suc.nombre,
      lat: suc.lat?.toString() ?? "",
      lon: suc.lon?.toString() ?? "",
      radio: suc.radio_metros.toString(),
    });
  }}
  icon={
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  }
  aria-label="Editar"
/>
<IconButton
  onClick={() => handleToggleActiva(suc)}
  disabled={loading}
  icon={
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </svg>
  }
  aria-label={suc.activa ? "Desactivar" : "Activar"}
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
  aria-label="Ver QR"
/>
```

Envolver el grupo en `<div className="flex justify-end gap-1.5">` (antes
`gap-2 flex-wrap`) — sin `flex-wrap`, ya no hace falta con botones de
30px.

- [ ] **Step 4: Sacar el wrapper manual de la tabla si existe**

Confirmar que `<Table className="mt-4">` NO está envuelto en un `<div
className="border ...">` adicional (`Table` ya trae su propio contenedor
desde el Task 4). Si lo está, sacar el `<div>` externo y dejar `<Table>`
directo.

- [ ] **Step 5: Ajustar el eyebrow/título del `Dialog` de QR**

De:
```tsx
<Dialog open={qrSucursal != null} onClose={() => setQrId(null)} title={`QR — ${qrSucursal?.nombre ?? ""}`}>
```
A:
```tsx
<Dialog open={qrSucursal != null} onClose={() => setQrId(null)} title={qrSucursal?.nombre ?? ""}>
  <p className="m-0 -mt-2 text-[11.5px] font-semibold uppercase tracking-wide text-text-tertiary">Código QR</p>
```

(La primera línea dentro de `Dialog` pasa a ser el eyebrow "Código QR";
el resto del contenido del diálogo —imagen, URL, botón "Descargar
PNG"— no cambia.)

- [ ] **Step 6: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/sucursales/SucursalesPage.tsx
git commit -m "feat(web): Sucursales con Status, IconButton y Dialog de QR del rediseño"
```

---

## Task 8: Empleados — IconButton, Status, código sin pastilla

**Files:**
- Modify: `web/src/pages/empleados/EmpleadosPage.tsx`

**Interfaces:** Consumes: `IconButton`, `Status` (mismos que Task 7).

- [ ] **Step 1: Actualizar imports** (mismo patrón que Task 7 Step 1,
  agregando `IconButton`/`Status`, quitando `Badge`).

- [ ] **Step 2: Reemplazar la celda "Dispositivo"**

De:
```tsx
{emp.device_token ? (
  <Badge variant="filled">Vinculado</Badge>
) : emp.otp ? (
  <Badge variant="outline">
    {formatCode(emp.otp.code)}{" "}
    <span className="font-normal opacity-70">
      ({minutosRestantes(emp.otp.expires_at)} min)
    </span>
  </Badge>
) : (
  <Badge variant="neutral">Sin vincular</Badge>
)}
```
A:
```tsx
{emp.device_token ? (
  <Status tone="success">Vinculado</Status>
) : emp.otp ? (
  <span className="inline-flex items-center gap-[7px] text-[13px] text-text">
    <span className="h-[7px] w-[7px] rounded-full bg-[--color-warning]" />
    <span className="font-mono tracking-wide">{formatCode(emp.otp.code)}</span>
    <span className="text-text-tertiary">({minutosRestantes(emp.otp.expires_at)} min)</span>
  </span>
) : (
  <Status tone="neutral">Sin vincular</Status>
)}
```

- [ ] **Step 3: Reemplazar la celda "Activo"**

De:
```tsx
<Badge variant={emp.activo ? "filled" : "neutral"}>{emp.activo ? "Sí" : "No"}</Badge>
```
A:
```tsx
<Status tone={emp.activo ? "success" : "neutral"}>{emp.activo ? "Activo" : "Inactivo"}</Status>
```

- [ ] **Step 4: Reemplazar los botones de acción de fila**

Mismo patrón que Task 7 Step 3: `Button variant="ghost"` con texto
("Editar", "Desactivar"/"Activar", "Desvincular", "Generar código"/
"Código nuevo") pasan a `IconButton` con ícono + `aria-label`. Íconos:
- Editar: mismo lápiz del Task 7.
- Activar/Desactivar: mismo power-icon del Task 7.
- Desvincular:
  ```tsx
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
  ```
- Generar código / Código nuevo:
  ```tsx
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
  ```

El `title="..."` HTML nativo que puedan llevar estos botones se reemplaza
por `aria-label` (accesibilidad, no tooltip visual — consistente con
Task 7).

- [ ] **Step 5: Sacar el wrapper manual de la tabla si existe** (igual
  que Task 7 Step 4).

- [ ] **Step 6: Ajustar el `Dialog` de código de vinculación**

Mantiene su contenido (código grande + texto de vencimiento) — agregar
arriba un ícono en cuadrado `accent-100`:

```tsx
<Dialog open={codigoDialog != null} onClose={() => setCodigoDialog(null)} title="Código de vinculación">
  <div className="mx-auto -mt-1 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-accent-100">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  </div>
  <div className="text-center text-[38px] font-extrabold tracking-[0.14em] text-text">
    {codigoDialog?.code}
  </div>
  <p className="text-center text-[13.5px] text-text-secondary">
    Vence en 10 minutos. Dictáselo a {codigoDialog?.nombre}.
  </p>
  <Button variant="secondary" block onClick={() => setCodigoDialog(null)}>
    Cerrar
  </Button>
</Dialog>
```

- [ ] **Step 7: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat(web): Empleados con Status, IconButton y Dialog de código del rediseño"
```

---

## Task 9: Asistencia — Status, borde de alerta en rechazados

**Files:**
- Modify: `web/src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:** Consumes: `Status`. `Badge` se mantiene solo para el
contador "N pendientes" (variant `alert`, Task 2).

- [ ] **Step 1: Actualizar el import de `Badge`** — mantiene el import
  (sigue en uso), agregar `Status`.

- [ ] **Step 2: Cambiar el contador de "Intentos rechazados" a `variant="alert"`**

De:
```tsx
<Badge variant="accent">{rechazadas.length} pendientes</Badge>
```
A:
```tsx
<Badge variant="alert">{rechazadas.length} pendientes</Badge>
```

- [ ] **Step 3: Borde ámbar en la tabla de rechazados**

`Table` (Task 4) ya acepta `containerClassName` para este caso puntual —
pasar el borde ámbar directo, sin envolver en un `<div>` extra:

```tsx
<Table className="mt-2" containerClassName="border-[#f3ddc9]">
```

- [ ] **Step 4: Reemplazar la celda "Tipo" (Entrada/Salida) de la tabla principal**

De:
```tsx
{r.tipo === "entrada" ? (
  <Badge variant="filled" className="gap-1">
    <LogIn className="h-3 w-3" /> Entrada
  </Badge>
) : (
  <Badge variant="outline" className="gap-1">
    <LogOut className="h-3 w-3" /> Salida
  </Badge>
)}
```
A:
```tsx
{r.tipo === "entrada" ? (
  <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-[--color-success-700]">
    <LogIn className="h-3 w-3" /> Entrada
  </span>
) : (
  <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-text-secondary">
    <LogOut className="h-3 w-3" /> Salida
  </span>
)}
```

- [ ] **Step 5: Reemplazar los botones de acción**

"Aprobar"/"Descartar" (rechazados) y "Borrar" (tabla principal) se
mantienen como `Button variant="ghost"` de texto — **no** pasan a
`IconButton`: el mock los muestra como botones de texto (`height: 30px`,
borde `1px solid #e7e7ea`), a diferencia de Sucursales/Empleados. Ajustar
solo el tamaño:

```tsx
<Button variant="secondary" size="default" onClick={() => handleResolver(r.id, "aprobar")}>
  Aprobar
</Button>
```

(reemplaza `variant="ghost"` por `variant="secondary"` en "Aprobar",
"Descartar" y "Borrar" — el `ghost` de antes se veía como link de texto
suelto, el mock los muestra con borde.)

- [ ] **Step 6: Sacar el wrapper manual de la tabla principal si existe**
  (igual que Task 7 Step 4).

- [ ] **Step 7: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/asistencia/AsistenciaPage.tsx
git commit -m "feat(web): Asistencia con Status, borde de alerta en rechazados y botones del rediseño"
```

---

## Task 10: Horas — Status para "Turno en curso"/"En curso"

**Files:**
- Modify: `web/src/pages/horas/HorasPage.tsx`

**Interfaces:** Consumes: `Status`.

- [ ] **Step 1: Actualizar imports** — quitar `Badge`, agregar `Status`.

- [ ] **Step 2: Reemplazar "Turno en curso" (resumen) y "En curso" (turnos)**

De:
```tsx
<TableCell>{r.enCurso ? <Badge variant="outline">Turno en curso</Badge> : "—"}</TableCell>
```
A:
```tsx
<TableCell>{r.enCurso ? <Status tone="accent">Turno en curso</Status> : "—"}</TableCell>
```

Y, en la tabla de Turnos:
```tsx
<TableCell>
  {t.salida_at ? fechaHoraLocal(t.salida_at) : <Status tone="accent">En curso</Status>}
</TableCell>
```

- [ ] **Step 3: Sacar el wrapper manual de las tablas si existe** (dos
  tablas en este archivo — Resumen y Turnos, igual que Task 7 Step 4).

- [ ] **Step 4: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/horas/HorasPage.tsx
git commit -m "feat(web): Horas con Status para turno en curso"
```

---

## Task 11: Admin — hereda Card/Table/Field, sin nav

**Files:**
- Modify: `web/src/pages/admin/AdminPage.tsx`

**Interfaces:** ninguna nueva.

- [ ] **Step 1: Sacar el wrapper manual de la tabla si existe** (igual
  que Task 7 Step 4 — `Table` ya trae su contenedor).

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit** (solo si el Step 1 encontró algo que sacar)

```bash
git add web/src/pages/admin/AdminPage.tsx
git commit -m "fix(web): Admin sin contenedor de tabla duplicado"
```

---

## Task 12: Marcar — card redondeada, banner de éxito suave

**Files:**
- Modify: `web/src/pages/MarcarPage.tsx`

**Interfaces:** ninguna nueva — sin cambios de lógica/estado (`Etapa`,
`handleMarcar`, el mensaje neutro de rechazo ya implementado hoy no
cambia).

- [ ] **Step 1: Ajustar el borde/radio de la card**

De:
```tsx
<Card className="w-full max-w-sm border-2 border-divider">
```
A:
```tsx
<Card className="w-full max-w-sm rounded-[20px]">
```

(Se saca el borde grueso manual de 2px del retrofit anterior. `Card`, ya
retocado en Task 1, trae radio 14px + sombra propios por default — acá
se sobreescribe puntualmente a 20px vía `className`, el valor exacto del
mock para esta pantalla mobile-first, sin tocar el componente compartido
que el resto de la app usa a 14px.)

- [ ] **Step 2: Ajustar los botones "Marcar entrada"/"Marcar salida"**

Agregar `className="h-[52px] rounded-[14px]"` a ambos botones (por
encima del `size="lg"` que ya traen, para el radio/alto más grandes que
usa específicamente esta pantalla).

- [ ] **Step 3: Reemplazar el banner de éxito**

De:
```tsx
{mensaje && (
  <div className="mt-4 flex items-center gap-2 bg-text px-[14px] py-3 text-[13px] text-bg">
    <CheckCircle className="h-4 w-4 flex-none" />
    {mensaje}
  </div>
)}
```
A:
```tsx
{mensaje && (
  <div className="mt-4 flex items-center gap-[10px] rounded-xl bg-[#eafaf0] px-[14px] py-[13px] text-[13.5px] font-semibold text-[--color-success-700]">
    <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[--color-success-700]">
      <CheckCircle className="h-3.5 w-3.5 text-white" />
    </span>
    {mensaje}
  </div>
)}
```

- [ ] **Step 4: Ajustar el ícono de la pantalla de rechazo**

De:
```tsx
<TriangleAlert className="h-7 w-7 text-accent-700" />
```
A (envolver en círculo ámbar claro, mismo tratamiento que el mock):
```tsx
<span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[--color-alert-100]">
  <TriangleAlert className="h-[26px] w-[26px] text-[--color-alert]" />
</span>
```

El resto del bloque de rechazo (heading "No pudimos registrar la marca",
mensaje, botón "Volver a intentar") no cambia — ya tiene el texto neutro
correcto del fix de hoy.

- [ ] **Step 5: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/MarcarPage.tsx
git commit -m "feat(web): Marcar con card redondeada y banner de éxito suave del rediseño"
```

---

## Task 13: Verificación final

**Files:** ninguno — solo verificación.

- [ ] **Step 1: Build limpio de punta a punta**

```bash
cd web
npm run build
```

- [ ] **Step 2: Grep de tokens retirados**

```bash
grep -rn "border-divider\|bg-surface\b" web/src --include="*.tsx" --include="*.ts"
```

Esperado: sin resultados (fuera de `LoginPage.tsx`, explícitamente fuera
de alcance de este plan — si aparece ahí, es esperado y no se toca).

- [ ] **Step 3: Levantar `web/` y `server/` en dev**

```bash
npm run dev:all
```

- [ ] **Step 4: Checklist manual (para el usuario en el navegador)**

Contra `http://localhost:5173`, comparar cada pantalla con el artboard
correspondiente del canvas aprobado
(`https://claude.ai/code/artifact/693d9ac0-9696-4fa5-97d9-b5938ccd1a77`,
página "Rediseño completo — Reimaginado (D)"):

1. Home (`/`): nav superior con "oliver" a la izquierda, pastillas a la
   derecha, avatar con iniciales al final.
2. Popover de cuenta: click en el avatar abre el panel con nombre de
   organización + email + "Configuración" (inerte) + "Cerrar sesión";
   cierra con click afuera y con Escape; "Cerrar sesión" desloguea y
   redirige a `/login`.
3. Sucursales/Empleados: filtros con ícono de lupa, tabla con filas más
   altas, estados como punto+etiqueta, acciones como íconos sin acentos
   de color, modales con radio/sombra nuevos.
4. Asistencia: tabla de rechazados con borde ámbar, "N pendientes" como
   pastilla ámbar clara.
5. Horas: "Turno en curso"/"En curso" como punto azul + texto.
6. Admin: sin nav (sigue así), header propio, tabla con el mismo
   tratamiento que el resto.
7. Marcar (`/marcar/{org}/{sucursal}`): card redondeada, banner de éxito
   verde suave, pantalla de rechazo con ícono en círculo ámbar y el
   título neutro ya corregido hoy.

Esperar la confirmación explícita del usuario antes de dar el rediseño
por cerrado — no hay Step de commit acá, ya quedó commiteado task por
task arriba.

---

## Al terminar

- Las 6 pantallas del panel + Marcar quedan con el lenguaje visual
  aprobado en el canvas (fondo neutro, cards blancas con radio/sombra,
  tablas cómodas con estados punto+etiqueta, nav superior con popover de
  cuenta).
- `Login` queda sin tocar (fuera de alcance, explícito en el spec).
- `IconButton`, `Status` y `AccountMenu` quedan como componentes
  reutilizables para pantallas futuras.
- Sin dependencias nuevas, sin tests automatizados nuevos.
- Único cambio de comportamiento real: "Cerrar sesión" ahora funciona
  desde el popover de cuenta (antes no existía ningún botón de logout en
  la UI).
