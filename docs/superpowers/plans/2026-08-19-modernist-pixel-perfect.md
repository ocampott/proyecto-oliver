# Pixel-perfect Modernist — retrofit fino sobre web/ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que las 8 pantallas de `web/` (Login, Home, Sucursales,
Empleados, Asistencia, Horas, Marcar público, Admin) y sus 2 modales (Ver
QR, Generar código) matcheen pixel-a-pixel el mockup "Oliver - UI
Completa.dc.html" **y** que las 6 pantallas del panel (todas salvo Login y
Marcar) usen el espacio de pantalla disponible en vez de quedar en una
columna angosta sin contenedor compartido, con filtros de búsqueda/estado
en Sucursales y Empleados y un navbar más grande.

**Architecture:** Reescritura de los componentes compartidos
(`web/src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`) para que sus
`cva` variants matcheen los valores exactos de
`_ds/modernist-.../styles.css`, más tres componentes nuevos (`field.tsx`
con label, `select.tsx` con label para los filtros, `dialog.tsx` con
backdrop). `PanelLayout.tsx` pasa a proveer un único `<main>` centrado de
ancho máximo compartido por las 5 páginas que ya lo usan (Home,
Sucursales, Empleados, Asistencia, Horas); cada una de esas páginas deja
de definir su propio `<main>`. Admin no está envuelto en `PanelLayout` (no
tiene nav, ver §4 de la Task 10) así que aplica el mismo ancho máximo en
su propio `<main>`. Después, una pasada pantalla por pantalla adoptando
esos componentes, agregando los filtros donde corresponde, y ajustando
spacing/tipografía puntual sin tocar lógica de negocio salvo la apertura
de los 2 modales y el filtrado en memoria de las 2 tablas.

**Tech Stack:** Sin dependencias nuevas — Tailwind v4 + `cva` +
`class-variance-authority` + `lucide-react`, todo ya instalado en `web/`.

**Spec:** `docs/superpowers/specs/2026-08-19-modernist-pixel-perfect-design.md`
(incluye §7, agregado 2026-08-19, con el layout macro y los filtros)

## Global Constraints

- **Sin theming por organización** — acento fijo `#1d4ed8`, sin
  `accentColor`/`density` configurables.
- **Sin cambios de comportamiento** salvo: "Ver QR" y "Generar código"
  pasan de panel inline / sin feedback a modales reales (`Dialog`); y
  Sucursales/Empleados ganan filtrado en memoria (búsqueda por nombre +
  estado) sobre los datos ya cargados por `react-query` — sin pegarle al
  server. Todo lo demás es visual.
- **Sin tests automatizados nuevos** — verificación manual (`npm run
  build` + pasada del usuario en el navegador al final).
- **Contenedor de página**: `mx-auto w-full max-w-[1440px] px-8 py-8`,
  centrado (no full-bleed), compartido por Home/Sucursales/Empleados/
  Asistencia/Horas vía `PanelLayout`, y aplicado directo en Admin (no
  pasa por `PanelLayout`). Login y Marcar no lo usan — son pantallas
  públicas centradas tipo tarjeta, fuera de alcance de este cambio.
- **Filtros solo en Sucursales y Empleados** — Asistencia/Horas ya tienen
  su propio filtro de rango de fechas, Admin no lleva filtro nuevo.
- **Navbar más grande que los valores del mock** — `py-5 px-6` (vs `12px
  16px` del mock), wordmark `22px` (vs `18px`), links `15px` (vs `14px`),
  `gap-6` (vs `--space-4`/16px). Decisión de producto tomada con el
  usuario, no una lectura literal de `styles.css`.
- Fuente de verdad de valores de componentes (botones, cards, tags,
  diálogos): proyecto Claude Design
  `8f3e8aba-017d-4ccb-942e-1d6234146c10`, archivo
  `design_handoff_ui_oliver/_ds/modernist-.../styles.css` — ya citados en
  cada task, no hace falta re-leer el archivo salvo para verificar algo
  no cubierto acá. El layout macro (contenedor, filtros, navbar grande)
  no sale de ese archivo — es una decisión de producto documentada en el
  spec §7.

---

## Task 1: Componentes compartidos — `Button`, `Card`, `Badge`, `Field` (nuevo), `Select` (nuevo), `Dialog` (nuevo)

**Files:**
- Modify: `web/src/components/ui/button.tsx`
- Modify: `web/src/components/ui/card.tsx`
- Modify: `web/src/components/ui/badge.tsx`
- Create: `web/src/components/ui/field.tsx`
- Create: `web/src/components/ui/select.tsx`
- Create: `web/src/components/ui/dialog.tsx`
- Modify: `web/src/pages/LoginPage.tsx`, `web/src/pages/HomePage.tsx`,
  `web/src/pages/MarcarPage.tsx`,
  `web/src/pages/sucursales/SucursalesPage.tsx`,
  `web/src/pages/empleados/EmpleadosPage.tsx`,
  `web/src/pages/admin/AdminPage.tsx` (solo renombrar `variant=` de
  `Button`, ningún otro cambio — el resto de cada pantalla se retoca en su
  propio task; `AsistenciaPage.tsx` y `HorasPage.tsx` no se tocan en este
  task, ver Step 2)

**Interfaces:**
- Consumes: nada nuevo — `cn` de `web/src/lib/utils.ts` (ya existe).
- Produces: `Button` con variants `"primary" | "secondary" | "ghost"`
  (reemplazan a `"default" | "accent" | "outline" | "ghost"`), prop
  `size?: "default" | "lg" | "icon"` (se agrega `"icon"`), prop
  `block?: boolean` (nueva). `Card` sin `CardTitle` (dead code, sin
  consumidores). `Badge` con variant `"neutral"` nueva, sumada a las tres
  existentes. `Field` (`{ label: string; containerClassName?: string } &
  InputProps`, forwardRef a `HTMLInputElement`) — consumido por los Tasks
  3, 4, 5, 6, 7, 8, 10. `Select` (`{ label: string; options: { value:
  string; label: string }[]; containerClassName?: string } &
  SelectHTMLAttributes<HTMLSelectElement>`, forwardRef a
  `HTMLSelectElement`) — consumido por los Tasks 5 y 6 para el filtro de
  estado. `Dialog` (`{ open: boolean; onClose: () => void; title: string;
  children: ReactNode; className?: string }`) — consumido por los Tasks 5
  y 6.

- [ ] **Step 1: Reescribir `button.tsx`**

Valores de referencia (`styles.css`): `.btn` es `font-family:
var(--font-heading)` peso 800, `font-size: 14px`; `.btn-primary` fondo
acento sólido; `.btn-secondary` contorno `--color-divider`; `.btn-ghost`
solo texto en acento-700; `.btn-icon` 36×36 sin padding; `.btn-block`
ancho 100%. La clase `.btn-block` del mock define `justify-content:
flex-start` por default, pero las 7 veces que el `.dc.html` la usa trae un
override inline — 6 en `justify-content:center`, 1 (el "Continuar" del
Task 9) en `justify-content:space-between` — así que acá `block` centra
por default (matchea el uso real) y el único caso `space-between` se
resuelve con un `className` puntual en el Task 9.

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-extrabold text-[14px] transition-colors disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-accent text-bg hover:bg-accent-600 active:bg-accent-700",
        secondary:
          "border border-divider bg-transparent text-text hover:bg-text/[.07] active:bg-text/[.14]",
        ghost: "bg-transparent text-accent-700 px-1 hover:bg-accent-100 active:bg-accent-200",
      },
      size: {
        default: "h-9 px-[14px] py-2",
        lg: "h-14 w-full px-4 text-[16px]",
        icon: "h-9 w-9 p-0",
      },
      block: {
        true: "w-full justify-center",
        false: "",
      },
    },
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

- [ ] **Step 2: Renombrar todos los `variant=` de `Button` en las páginas**

Mapeo: `"accent"` → `"primary"`, `"outline"` → `"secondary"`,
`"default"` → `"primary"`, `"ghost"` se mantiene igual. Correr **solo**
sobre los archivos donde el texto `variant="accent"`/`"outline"`/
`"default"` pertenece exclusivamente a `Button` (verificado con el grep
de abajo):

```bash
cd web/src
sed -i '' 's/variant="accent"/variant="primary"/g; s/variant="outline"/variant="secondary"/g; s/variant="default"/variant="primary"/g' \
  pages/LoginPage.tsx pages/HomePage.tsx pages/MarcarPage.tsx \
  pages/sucursales/SucursalesPage.tsx pages/empleados/EmpleadosPage.tsx \
  pages/admin/AdminPage.tsx
```

**No correr sobre `pages/asistencia/AsistenciaPage.tsx` ni
`pages/horas/HorasPage.tsx`**: ambos usan `Badge` (que sí tiene variants
`"accent"` y `"outline"`, sin equivalentes `"primary"`/`"secondary"`), y
el `sed` no distingue `Button` de `Badge` — correrlo ahí renombraría los
`Badge` también y rompería el build. `AsistenciaPage.tsx` no lo necesita
igual: sus tres `Button` ya son todos `variant="ghost"` (sin `accent`/
`outline`/`default` que migrar), verificable con:

```bash
grep -n 'Button variant=' web/src/pages/asistencia/AsistenciaPage.tsx
```

Esperado: las tres líneas dicen `variant="ghost"` — nada que tocar en
`Button` en este archivo. `HorasPage.tsx` no tiene ningún `Button` con
variant (no le corresponde ningún cambio en este task).

- [ ] **Step 3: Ajustar `card.tsx` — remover `CardTitle` (sin uso), padding a 22px**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("bg-surface p-[22px]", className)} {...props} />
  )
);
Card.displayName = "Card";

export { Card };
```

- [ ] **Step 4: Agregar variant `neutral` a `badge.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center px-2.5 py-0.5 text-[11px] font-normal uppercase tracking-wide",
  {
    variants: {
      variant: {
        filled: "bg-text text-bg",
        outline: "border border-accent-700 text-accent-700",
        accent: "bg-accent-100 text-accent-800",
        neutral: "bg-text/10 text-text/70",
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

- [ ] **Step 5: Crear `field.tsx`**

```tsx
import * as React from "react";
import { Input, type InputProps } from "./input";
import { cn } from "../../lib/utils";

export interface FieldProps extends InputProps {
  label: string;
  containerClassName?: string;
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, containerClassName, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
      <div className={cn("flex flex-col gap-[5px]", containerClassName)}>
        <label htmlFor={inputId} className="text-[12px] text-text/70">
          {label}
        </label>
        <Input id={inputId} ref={ref} {...props} />
      </div>
    );
  }
);
Field.displayName = "Field";

export { Field };
```

- [ ] **Step 6: Crear `select.tsx`**

Filtro de estado nuevo (Task 5, Task 6) — no viene del mock (que no
define un componente de filtros, ver spec §7.1), así que en vez de
inventar un tratamiento visual aparte copia el mismo `className` que usa
hoy `input.tsx` (`h-10 border border-divider bg-bg px-3 py-2 text-[15px]`)
para que quede visualmente idéntico al lado de los `Field` de búsqueda en
la misma fila de filtros.

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  containerClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, containerClassName, className, id, ...props }, ref) => {
    const autoId = React.useId();
    const selectId = id ?? autoId;
    return (
      <div className={cn("flex flex-col gap-[5px]", containerClassName)}>
        <label htmlFor={selectId} className="text-[12px] text-text/70">
          {label}
        </label>
        <select
          id={selectId}
          ref={ref}
          className={cn(
            "flex h-10 w-full border border-divider bg-bg px-3 py-2 text-[15px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
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
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
```

- [ ] **Step 7: Crear `dialog.tsx`**

Valores de referencia: `.dialog-backdrop` fondo
`color-mix(in srgb, var(--color-neutral-900) 50%, transparent)` — como no
tenemos escala neutral, se usa el mismo tinte de `--color-text`
(`#201e1d`) al 50%. `.dialog` ancho `min(440px, 100%)`, padding 16px
(`--space-4`), gap 12px (`--space-3`), fondo `--color-surface`.

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#201e1d]/50 p-4" onClick={onClose}>
      <div
        className={cn(
          "flex w-full max-w-[440px] flex-col gap-3 bg-surface p-4 shadow-[0_12px_32px_rgba(32,30,29,0.22)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[20px] font-extrabold text-text">{title}</span>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { Dialog };
```

- [ ] **Step 8: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores de TypeScript. `Field`, `Select` y `Dialog` van a
quedar sin consumidores todavía (Tasks 3, 5, 6, 7, 8, 10) — es esperable,
igual que en las etapas anteriores de este proyecto.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/ui/button.tsx web/src/components/ui/card.tsx \
  web/src/components/ui/badge.tsx web/src/components/ui/field.tsx \
  web/src/components/ui/select.tsx web/src/components/ui/dialog.tsx \
  web/src/pages/LoginPage.tsx web/src/pages/HomePage.tsx web/src/pages/MarcarPage.tsx \
  web/src/pages/sucursales/SucursalesPage.tsx web/src/pages/empleados/EmpleadosPage.tsx \
  web/src/pages/admin/AdminPage.tsx
git commit -m "feat(web): componentes Button/Card/Badge pixel-perfect + Field, Select y Dialog nuevos"
```

---

## Task 2: Nav y layout compartido — wordmark, sticky, navbar más grande, contenedor de página

**Files:**
- Modify: `web/src/components/PanelNav.tsx`
- Modify: `web/src/components/PanelLayout.tsx`

**Interfaces:** ninguna nueva — `PanelNav` sigue sin props. `PanelLayout`
mantiene su firma `({ children }: { children: ReactNode })`; las 5 rutas
que ya lo usan en `App.tsx` (Home, Sucursales, Empleados, Asistencia,
Horas) no necesitan ningún cambio ahí. A partir de este task,
`PanelLayout` es quien provee el único `<main>` de esas 5 páginas — los
Tasks 4, 5, 6, 7, 8 asumen que ya no hace falta que cada página abra su
propio `<main>`.

- [ ] **Step 1: Reescribir `PanelNav.tsx`**

Valores base del mock (`styles.css`): `.nav` `padding: var(--space-3)
var(--space-4)` (12px/16px), `.nav-brand` peso 800 18px con
`margin-right: auto`, links 14px, `aria-current="page"` (o hover) en
color acento. Sobre esa base, el navbar sube de tamaño por decisión de
producto (spec §7.4): padding vertical/horizontal `py-5 px-6` (20px/24px),
wordmark `22px`, links `15px`, `gap-6` (24px) en vez de `gap-4`.

```tsx
import { NavLink } from "react-router-dom";

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
    <nav className="sticky top-0 z-20 flex items-center gap-6 border-b-2 border-divider bg-bg px-6 py-5">
      <span className="mr-auto text-[22px] font-extrabold text-text">Oliver</span>
      {LINKS.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end
          className={({ isActive }) =>
            isActive ? "text-[15px] text-accent-700" : "text-[15px] text-text hover:text-accent-700"
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Reescribir `PanelLayout.tsx` — agregar el contenedor compartido**

```tsx
import type { ReactNode } from "react";
import { PanelNav } from "./PanelNav";

export function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PanelNav />
      <main className="mx-auto w-full max-w-[1440px] px-8 py-8">{children}</main>
    </>
  );
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores. Las páginas que aún tienen su propio `<main
className="p-8">` (Home, Sucursales, Empleados, Asistencia, Horas) van a
quedar con `<main>` anidado hasta que se retoquen en sus propios tasks —
no rompe el build, es HTML inválido temporal que se corrige en los Tasks
4-8 de este mismo plan.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/PanelNav.tsx web/src/components/PanelLayout.tsx
git commit -m "feat(web): nav con wordmark, sticky y tamaño mayor + contenedor compartido en PanelLayout"
```

---

## Task 3: Login

**Files:**
- Modify: `web/src/pages/LoginPage.tsx`

**Interfaces:** Consumes: `Field` (Task 1).

- [ ] **Step 1: Adoptar `Field` y agregar el borde de la card**

Reemplazar el bloque del `form` completo:

```tsx
      <Card className="w-full max-w-sm border-2 border-divider p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h1 className="text-[20px] font-extrabold text-text">Iniciar sesión</h1>
          <p className="text-[15px] text-text/60">
            Ingresá con tu email y contraseña para acceder al panel.
          </p>
          <Field
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Contraseña"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-[15px] text-accent-700">{error}</p>}
          <Button type="submit" variant="primary" size="lg" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
```

Y actualizar el import de `Input` por `Field`:

```tsx
import { Field } from "../components/ui/field";
```

(reemplaza a `import { Input } from "../components/ui/input";`, que deja
de usarse en este archivo).

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/LoginPage.tsx
git commit -m "feat(web): Login con Field y card con borde, pixel-perfect"
```

---

## Task 4: Home

**Files:**
- Modify: `web/src/pages/HomePage.tsx`

**Interfaces:** ninguna nueva — consume el `<main>` que ahora provee
`PanelLayout` (Task 2), ya no abre el suyo propio.

- [ ] **Step 1: Reemplazar el archivo completo**

Cambios sobre el archivo actual: se quita el `<main className="p-8">` de
los 4 `return` (loading, sin org, error, contenido — ahora lo provee
`PanelLayout`); la grilla pasa de `max-w-3xl sm:grid-cols-2` fija a
`sm:grid-cols-2 lg:grid-cols-4` sin `max-w`, para ocupar el ancho del
contenedor de 1440px (spec §7.6); tamaños de ícono/título/descripción
ajustados al mock (ícono 22×22 con `margin-bottom: 4px`, `card-title`
17px peso 800, `card-body` 13px opacidad `.8`, spec §4.3).

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Clock, Users, MapPin, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { getOrgActual, ApiError, type Organization } from "../lib/api";

const ACCESOS = [
  {
    href: "/asistencia",
    label: "Asistencia",
    detalle: "Registros de entrada/salida e intentos rechazados",
    icon: CalendarClock,
  },
  {
    href: "/horas",
    label: "Horas",
    detalle: "Turnos y horas trabajadas por empleado",
    icon: Clock,
  },
  {
    href: "/empleados",
    label: "Empleados",
    detalle: "Nómina, vínculo de dispositivos y códigos",
    icon: Users,
  },
  {
    href: "/sucursales",
    label: "Sucursales",
    detalle: "Ubicaciones, geocercas y códigos QR",
    icon: MapPin,
  },
];

export default function HomePage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [sinOrg, setSinOrg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    setSinOrg(false);
    getOrgActual()
      .then(setOrg)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setSinOrg(true);
        } else {
          setError(
            err instanceof Error ? err.message : "No pudimos cargar tus datos. Probá de nuevo."
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return <p className="text-text/60">Cargando...</p>;
  }

  if (sinOrg) {
    return (
      <p className="text-text">
        Tu cuenta todavía no está asociada a ninguna organización. Contactá a soporte.
      </p>
    );
  }

  if (error || !org) {
    return (
      <>
        <p className="text-text">{error ?? "No pudimos cargar tus datos. Probá de nuevo."}</p>
        <Button onClick={cargar} variant="secondary" className="mt-4">
          Reintentar
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">{org.name}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACCESOS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} to={a.href}>
              <Card className="relative transition-colors hover:bg-text/5">
                <ChevronRight className="absolute right-4 top-4 h-4 w-4 text-text/40" />
                <Icon className="mb-1 h-[22px] w-[22px] text-accent-700" />
                <h2 className="text-[17px] font-extrabold text-text">{a.label}</h2>
                <p className="mt-1 text-[13px] text-text/80">{a.detalle}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/HomePage.tsx
git commit -m "feat(web): Home con grilla de 4 columnas usando el contenedor compartido"
```

---

## Task 5: Sucursales — Field, Select, Badge, Dialog de QR, filtros, contenedor compartido

**Files:**
- Modify: `web/src/pages/sucursales/SucursalesPage.tsx`

**Interfaces:** Consumes: `Field`, `Select`, `Dialog` (Task 1), `Badge`
(Task 1, variant `neutral` nueva). Ya no abre su propio `<main>` — lo
provee `PanelLayout` (Task 2).

- [ ] **Step 1: Reemplazar el archivo completo**

Cambios sobre el archivo actual: se quita `<main className="p-8">` +
`<div className="max-w-4xl">`; el form de alta y las celdas en edición
pasan de `Input` suelto a `Field`; la columna "Activa" pasa a `Badge`; se
agrega una fila de filtros (búsqueda por nombre + `Select` de estado)
entre el mensaje de error y la tabla, con estado `busqueda`/
`estadoFiltro` y la lista filtrada `sucursalesFiltradas` (spec §7.5); el
panel inline de QR se reemplaza por `Dialog`.

```tsx
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import type { Sucursal } from "../../lib/api";
import { useSucursales, useOrgActual, useCrearSucursal, useEditarSucursal, useDesactivarSucursal } from "./hooks";
import { useQrBlob } from "./useQrBlob";

interface EditState {
  nombre: string;
  lat: string;
  lon: string;
  radio: string;
}

type EstadoFiltro = "todos" | "activos" | "inactivos";

function parseNumero(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export default function SucursalesPage() {
  const { data: sucursales = [], isLoading } = useSucursales();
  const { data: org } = useOrgActual();
  const crear = useCrearSucursal();
  const editar = useEditarSucursal();
  const desactivar = useDesactivarSucursal();

  const [nombre, setNombre] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radio, setRadio] = useState("100");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ nombre: "", lat: "", lon: "", radio: "100" });
  const [qrId, setQrId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [error, setError] = useState<string | null>(null);

  const qrUrl = useQrBlob(qrId);
  const qrSucursal = sucursales.find((s) => s.id === qrId) ?? null;

  const loading = crear.isPending || editar.isPending || desactivar.isPending;

  const sucursalesFiltradas = sucursales.filter((s) => {
    const matchNombre = s.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado =
      estadoFiltro === "todos" || (estadoFiltro === "activos" ? s.activa : !s.activa);
    return matchNombre && matchEstado;
  });

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({
        nombre,
        lat: parseNumero(lat),
        lon: parseNumero(lon),
        radio_metros: parseNumero(radio),
      });
      setNombre("");
      setLat("");
      setLon("");
      setRadio("100");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editar.mutateAsync({
        id,
        patch: {
          nombre: edit.nombre,
          lat: parseNumero(edit.lat) ?? null,
          lon: parseNumero(edit.lon) ?? null,
          radio_metros: parseNumero(edit.radio),
        },
      });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleToggleActiva(suc: Sucursal) {
    setError(null);
    try {
      await editar.mutateAsync({ id: suc.id, patch: { activa: !suc.activa } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Sucursales</h1>

      <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Nombre"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          containerClassName="w-[200px]"
        />
        <Field
          label="Latitud"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          containerClassName="w-[130px]"
        />
        <Field
          label="Longitud"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          containerClassName="w-[130px]"
        />
        <Field
          label="Radio (m)"
          value={radio}
          onChange={(e) => setRadio(e.target.value)}
          containerClassName="w-[100px]"
        />
        <Button type="submit" variant="primary" disabled={loading}>
          Agregar
        </Button>
      </form>
      <p className="mt-1 text-[15px] text-text/60">
        Sacá las coordenadas de Google Maps: click derecho sobre el local → copiar los números.
      </p>

      {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Buscar"
          placeholder="Nombre de la sucursal"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          containerClassName="w-64"
        />
        <Select
          label="Estado"
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activos", label: "Activos" },
            { value: "inactivos", label: "Inactivos" },
          ]}
          containerClassName="w-40"
        />
      </div>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Coordenadas</TableHead>
            <TableHead>Radio</TableHead>
            <TableHead>Activa</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            sucursalesFiltradas.map((suc) => (
              <TableRow key={suc.id} className={suc.activa ? "" : "text-text/40"}>
                <TableCell>
                  {editandoId === suc.id ? (
                    <Field
                      label="Nombre"
                      value={edit.nombre}
                      onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                    />
                  ) : (
                    suc.nombre
                  )}
                </TableCell>
                <TableCell>
                  {editandoId === suc.id ? (
                    <div className="flex gap-1">
                      <Field
                        label="Lat"
                        value={edit.lat}
                        onChange={(e) => setEdit({ ...edit, lat: e.target.value })}
                        containerClassName="w-28"
                      />
                      <Field
                        label="Lon"
                        value={edit.lon}
                        onChange={(e) => setEdit({ ...edit, lon: e.target.value })}
                        containerClassName="w-28"
                      />
                    </div>
                  ) : suc.lat != null && suc.lon != null ? (
                    `${suc.lat}, ${suc.lon}`
                  ) : (
                    "Sin configurar"
                  )}
                </TableCell>
                <TableCell>
                  {editandoId === suc.id ? (
                    <Field
                      label="Radio"
                      value={edit.radio}
                      onChange={(e) => setEdit({ ...edit, radio: e.target.value })}
                      containerClassName="w-20"
                    />
                  ) : (
                    `${suc.radio_metros} m`
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={suc.activa ? "filled" : "neutral"}>{suc.activa ? "Sí" : "No"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {editandoId === suc.id ? (
                      <>
                        <Button variant="ghost" onClick={() => handleGuardarEdicion(suc.id)} disabled={loading}>
                          Guardar
                        </Button>
                        <Button variant="ghost" onClick={() => setEditandoId(null)}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditandoId(suc.id);
                            setEdit({
                              nombre: suc.nombre,
                              lat: suc.lat?.toString() ?? "",
                              lon: suc.lon?.toString() ?? "",
                              radio: suc.radio_metros.toString(),
                            });
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
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && sucursales.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">
                Todavía no hay sucursales cargadas.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && sucursales.length > 0 && sucursalesFiltradas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">
                Ninguna sucursal coincide con el filtro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={qrSucursal != null} onClose={() => setQrId(null)} title={`QR — ${qrSucursal?.nombre ?? ""}`}>
        {qrUrl ? (
          <img src={qrUrl} alt={`QR de ${qrSucursal?.nombre}`} className="w-full" />
        ) : (
          <p className="text-[15px] text-text/60">Generando QR...</p>
        )}
        {org && qrSucursal && (
          <p className="break-all text-[15px] text-text/60">
            {`${window.location.origin}/marcar/${org.slug}/${qrSucursal.id}`}
          </p>
        )}
        {qrUrl && (
          <Button asChild variant="primary" block>
            <a href={qrUrl} download={`qr-${qrSucursal?.nombre}.png`}>
              Descargar PNG
            </a>
          </Button>
        )}
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/sucursales/SucursalesPage.tsx
git commit -m "feat(web): Sucursales con Field, Badge, filtros y modal de QR pixel-perfect"
```

---

## Task 6: Empleados — Field, Select, Badge, Dialog de código, filtros, contenedor compartido

**Files:**
- Modify: `web/src/pages/empleados/EmpleadosPage.tsx`

**Interfaces:** Consumes: `Field`, `Select`, `Dialog`, `Badge` (Task 1).
Ya no abre su propio `<main>` — lo provee `PanelLayout` (Task 2).

- [ ] **Step 1: Reemplazar el archivo completo**

Mismos cambios que en Sucursales (Task 5), adaptados a Empleados: `Field`
en form de alta y edición inline, `Badge` para "Dispositivo"/"Activo",
fila de filtros (búsqueda + `Select` de estado) con
`empleadosFiltrados`, y `Dialog` de código al generar uno nuevo
(`handleGenerarCodigo` cambia su firma de `(id: string)` a `(emp:
Empleado)` para poder mostrar el nombre en el modal).

```tsx
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import type { Empleado } from "../../lib/api";
import {
  useEmpleados,
  useCrearEmpleado,
  useEditarEmpleado,
  useDesactivarEmpleado,
  useDesvincularDispositivo,
  useGenerarOtp,
} from "./hooks";

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function minutosRestantes(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

type EstadoFiltro = "todos" | "activos" | "inactivos";

export default function EmpleadosPage() {
  const { data: empleados = [], isLoading } = useEmpleados();
  const crear = useCrearEmpleado();
  const editar = useEditarEmpleado();
  const desactivar = useDesactivarEmpleado();
  const desvincular = useDesvincularDispositivo();
  const generarCodigo = useGenerarOtp();

  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [codigoDialog, setCodigoDialog] = useState<{ nombre: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading =
    crear.isPending || editar.isPending || desactivar.isPending || desvincular.isPending || generarCodigo.isPending;

  const empleadosFiltrados = empleados.filter((emp) => {
    const matchNombre = emp.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado =
      estadoFiltro === "todos" || (estadoFiltro === "activos" ? emp.activo : !emp.activo);
    return matchNombre && matchEstado;
  });

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({ nombre, celular: celular || undefined });
      setNombre("");
      setCelular("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editar.mutateAsync({ id, patch: { nombre: editNombre, celular: editCelular || null } });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleToggleActivo(emp: Empleado) {
    setError(null);
    try {
      await editar.mutateAsync({ id: emp.id, patch: { activo: !emp.activo } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleDesvincular(emp: Empleado) {
    if (!confirm(`¿Desvincular el dispositivo de ${emp.nombre}? Va a tener que revincular con un código nuevo.`)) {
      return;
    }
    setError(null);
    try {
      await desvincular.mutateAsync(emp.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGenerarCodigo(emp: Empleado) {
    setError(null);
    try {
      const otp = await generarCodigo.mutateAsync(emp.id);
      setCodigoDialog({ nombre: emp.nombre, code: formatCode(otp.code) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Empleados</h1>

      <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Nombre y apellido"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          containerClassName="w-[220px]"
        />
        <Field
          label="Celular (opcional)"
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          containerClassName="w-[180px]"
        />
        <Button type="submit" variant="primary" disabled={loading}>
          Agregar
        </Button>
      </form>

      {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Buscar"
          placeholder="Nombre del empleado"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          containerClassName="w-64"
        />
        <Select
          label="Estado"
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activos", label: "Activos" },
            { value: "inactivos", label: "Inactivos" },
          ]}
          containerClassName="w-40"
        />
      </div>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Celular</TableHead>
            <TableHead>Dispositivo</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            empleadosFiltrados.map((emp) => (
              <TableRow key={emp.id} className={emp.activo ? "" : "text-text/40"}>
                <TableCell>
                  {editandoId === emp.id ? (
                    <Field label="Nombre" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                  ) : (
                    emp.nombre
                  )}
                </TableCell>
                <TableCell>
                  {editandoId === emp.id ? (
                    <Field label="Celular" value={editCelular} onChange={(e) => setEditCelular(e.target.value)} />
                  ) : (
                    emp.celular ?? "—"
                  )}
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  <Badge variant={emp.activo ? "filled" : "neutral"}>{emp.activo ? "Sí" : "No"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {editandoId === emp.id ? (
                      <>
                        <Button variant="ghost" onClick={() => handleGuardarEdicion(emp.id)} disabled={loading}>
                          Guardar
                        </Button>
                        <Button variant="ghost" onClick={() => setEditandoId(null)}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditandoId(emp.id);
                            setEditNombre(emp.nombre);
                            setEditCelular(emp.celular ?? "");
                          }}
                        >
                          Editar
                        </Button>
                        <Button variant="ghost" onClick={() => handleToggleActivo(emp)} disabled={loading}>
                          {emp.activo ? "Desactivar" : "Activar"}
                        </Button>
                        {emp.device_token ? (
                          <Button variant="ghost" onClick={() => handleDesvincular(emp)} disabled={loading}>
                            Desvincular
                          </Button>
                        ) : (
                          <Button variant="ghost" onClick={() => handleGenerarCodigo(emp)} disabled={loading}>
                            {emp.otp ? "Código nuevo" : "Generar código"}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && empleados.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">
                Todavía no hay empleados cargados.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && empleados.length > 0 && empleadosFiltrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">
                Ningún empleado coincide con el filtro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={codigoDialog != null} onClose={() => setCodigoDialog(null)} title="Código de vinculación">
        <div className="text-center text-[40px] font-extrabold tracking-[0.15em] text-text">
          {codigoDialog?.code}
        </div>
        <p className="text-center text-[13px] text-text/85">
          Vence en 10 minutos. Dictáselo a {codigoDialog?.nombre}.
        </p>
      </Dialog>
    </>
  );
}
```

`generarCodigo.mutateAsync(emp.id)` resuelve a `GenerarOtpResponse`
(`web/src/lib/api.ts:205-207`, `{ code: string }`), de ahí `otp.code` en
`handleGenerarCodigo`.

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat(web): Empleados con Field, Badge, filtros y modal de código pixel-perfect"
```

---

## Task 7: Asistencia

**Files:**
- Modify: `web/src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:** Consumes: `Field` (Task 1). Ya usa `Badge` correctamente
(sin cambios ahí, sirve de referencia). Ya no abre su propio `<main>` —
lo provee `PanelLayout` (Task 2). Sin filtros nuevos — ya tiene su propio
filtro de rango de fechas (spec §7.2, fuera de alcance del §7.5).

- [ ] **Step 1: Reemplazar el archivo completo**

Cambios: se quita `<main className="p-8">` + `<div className="max-w-4xl">`;
el selector de fechas pasa de `<label>` manual a `Field`.

```tsx
import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Badge } from "../../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import type { MotivoRechazo } from "../../lib/api";
import { useAsistencia, useRechazadas, useBorrarAsistencia, useResolverRechazada } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

const MOTIVOS: Record<MotivoRechazo, string> = {
  fuera_de_rango: "Fuera de rango",
  sucursal_sin_gps: "Sucursal sin GPS configurado",
  nombre_no_encontrado: "Nombre no encontrado en la nómina",
  dispositivo_ya_vinculado: "Ya vinculado a otro dispositivo",
};

export default function AsistenciaPage() {
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());

  const { data: registros = [], isLoading, isError } = useAsistencia(desde, hasta);
  const { data: rechazadas = [] } = useRechazadas();
  const borrar = useBorrarAsistencia();
  const resolver = useResolverRechazada();
  const [error, setError] = useState<string | null>(null);

  async function handleBorrar(id: string) {
    if (!confirm("¿Borrar este registro?")) return;
    setError(null);
    try {
      await borrar.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el registro.");
    }
  }

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    setError(null);
    try {
      await resolver.mutateAsync({ id, accion });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo resolver el intento.");
    }
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Asistencia</h1>

      {rechazadas.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-extrabold text-text">Intentos rechazados</h2>
            <Badge variant="accent">{rechazadas.length} pendientes</Badge>
          </div>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rechazadas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{horaLocal(r.created_at)}</TableCell>
                  <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                  <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>
                    {MOTIVOS[r.motivo] ?? r.motivo}
                    {r.motivo === "fuera_de_rango" && r.distancia_metros != null && (
                      <span className="text-text/55"> (a {r.distancia_metros} m)</span>
                    )}
                    {r.tipo && <span className="text-text/55"> — {r.tipo}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => handleResolver(r.id, "aprobar")}>
                        Aprobar
                      </Button>
                      <Button variant="ghost" onClick={() => handleResolver(r.id, "descartar")}>
                        Descartar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-end gap-4">
          <Field
            label="Desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            containerClassName="w-40"
          />
          <Field
            label="Hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            containerClassName="w-40"
          />
          {isLoading && <span className="text-[15px] text-text/60">Cargando...</span>}
        </div>

        {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}
        {isError && (
          <p className="mt-2 text-[15px] text-accent-700">
            No se pudieron cargar los registros. Probá de nuevo.
          </p>
        )}

        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{horaLocal(r.created_at)}</TableCell>
                <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                <TableCell>
                  {r.tipo === "entrada" ? (
                    <Badge variant="filled" className="gap-1">
                      <LogIn className="h-3 w-3" /> Entrada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <LogOut className="h-3 w-3" /> Salida
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" onClick={() => handleBorrar(r.id)}>
                    Borrar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && registros.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  No hay registros en este rango.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/asistencia/AsistenciaPage.tsx
git commit -m "feat(web): Asistencia con Field para el rango de fechas, sin main propio"
```

---

## Task 8: Horas

**Files:**
- Modify: `web/src/pages/horas/HorasPage.tsx`

**Interfaces:** Consumes: `Field` (Task 1). Ya no abre su propio
`<main>` — lo provee `PanelLayout` (Task 2).

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
import { useState } from "react";
import { Field } from "../../components/ui/field";
import { Badge } from "../../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import { useHoras } from "./hooks";

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

export default function HorasPage() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());

  const { data, isLoading, isError } = useHoras(desde, hasta);
  const turnos = data?.turnos ?? [];
  const resumen = data?.resumen ?? [];

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Horas trabajadas</h1>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Field
          label="Desde"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          containerClassName="w-40"
        />
        <Field
          label="Hasta"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          containerClassName="w-40"
        />
        {isLoading && <span className="text-[15px] text-text/60">Cargando...</span>}
      </div>

      {isError && (
        <p className="mt-2 text-[15px] text-accent-700">
          No se pudieron cargar los datos. Probá de nuevo.
        </p>
      )}

      {resumen.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[20px] font-extrabold text-text">Resumen por empleado</h2>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Total horas</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumen.map((r) => (
                <TableRow key={r.nombre}>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell>{r.totalHoras.toFixed(2)}</TableCell>
                  <TableCell>{r.enCurso ? <Badge variant="outline">Turno en curso</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-[20px] font-extrabold text-text">Turnos</h2>
        <Table className="mt-2">
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
            {turnos.map((t, i) => (
              <TableRow key={`${t.empleado_id}-${t.entrada_at}-${i}`}>
                <TableCell>{t.nombre}</TableCell>
                <TableCell>{t.sucursal_nombre}</TableCell>
                <TableCell>{fechaHoraLocal(t.entrada_at)}</TableCell>
                <TableCell>
                  {t.salida_at ? fechaHoraLocal(t.salida_at) : <Badge variant="outline">En curso</Badge>}
                </TableCell>
                <TableCell>{t.horas !== null ? t.horas.toFixed(2) : "—"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && turnos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  No hay turnos en este rango.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/horas/HorasPage.tsx
git commit -m "feat(web): Horas con Field para el rango de fechas, sin main propio"
```

---

## Task 9: Marcar público

**Files:**
- Modify: `web/src/pages/MarcarPage.tsx`

**Interfaces:** ninguna nueva — el mock NO usa `Field`/labels en estas
pantallas (son inputs mobile-first solo con placeholder, confirmado en el
`.dc.html`), así que este task no toca `Field`. Fuera de alcance del
contenedor de 1440px (spec §7.2) — es pantalla pública centrada, no
panel.

- [ ] **Step 1: Agregar el borde de card (igual que Marcar en el mock)**

Reemplazar la apertura del `<Card>`:

```tsx
      <Card className="w-full max-w-sm border-2 border-divider">
```

- [ ] **Step 2: Agregar ícono al botón "Continuar" (paso Identificar)**

El mock pone este botón en `justify-content: space-between` (label a la
izquierda, ícono pegado al borde derecho) — el único caso de los 7
`.btn-block` del mock que no centra. `size="lg"` ya da `w-full`, así que
alcanza con el override de `justify-between` sin usar la prop `block`:

```tsx
            <Button type="submit" variant="primary" size="lg" className="justify-between" disabled={loading}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
```

- [ ] **Step 3: Agregar íconos a los botones de Marcar entrada/salida**

```tsx
            <Button onClick={() => handleMarcar("entrada")} variant="primary" size="lg" disabled={loading}>
              <LogIn className="h-[18px] w-[18px]" /> Marcar entrada
            </Button>
            <Button onClick={() => handleMarcar("salida")} variant="secondary" size="lg" disabled={loading}>
              <LogOut className="h-[18px] w-[18px]" /> Marcar salida
            </Button>
```

- [ ] **Step 4: Reemplazar el mensaje de éxito por el banner del mock**

Reemplazar la línea `{mensaje && ...}`:

```tsx
        {mensaje && (
          <div className="mt-4 flex items-center gap-2 bg-text px-[14px] py-3 text-[13px] text-bg">
            <CheckCircle className="h-4 w-4 flex-none" />
            {mensaje}
          </div>
        )}
```

Y en `handleMarcar`, sacar el "✔" del texto (el ícono ya lo reemplaza):

```tsx
          setMensaje(`${label} registrada a las ${horaLocal(body.hora)}`);
```

- [ ] **Step 5: Agregar la pantalla de rechazo ("fuera de rango") en vez de mostrar el error como texto plano**

Agregar un nuevo tipo a `Etapa`:

```tsx
type Etapa =
  | { tipo: "cargando" }
  | { tipo: "invalido" }
  | { tipo: "identificar" }
  | { tipo: "confirmar"; sugerencia: string }
  | { tipo: "codigo"; empleadoId: string }
  | { tipo: "marcar"; nombre: string }
  | { tipo: "rechazado"; nombreMarcar: string; mensaje: string };
```

En `handleMarcar`, cuando `registrarMarca` rechaza el intento, pasar a
`"rechazado"` en vez de solo setear `error` — reemplazar el `catch` del
bloque de geolocalización:

```tsx
        try {
          const body = await registrarMarca(sucursal, tipo, pos.coords.latitude, pos.coords.longitude);
          const label = body.tipo === "entrada" ? "Entrada" : "Salida";
          setMensaje(`${label} registrada a las ${horaLocal(body.hora)}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.";
          if (etapa.tipo === "marcar") {
            setEtapa({ tipo: "rechazado", nombreMarcar: etapa.nombre, mensaje: msg });
          } else {
            setError(msg);
          }
        } finally {
          setLoading(false);
        }
```

Agregar el render de la pantalla de rechazo, junto a los otros bloques
`{etapa.tipo === "..." && (...)}` dentro del `<Card>`:

```tsx
        {etapa.tipo === "rechazado" && (
          <div className="mt-4 flex flex-col gap-3">
            <TriangleAlert className="h-7 w-7 text-accent-700" />
            <h4 className="text-[20px] font-extrabold text-text">Estás fuera de rango</h4>
            <p className="text-[13px] text-text/75">{etapa.mensaje}</p>
            <Button
              variant="secondary"
              block
              onClick={() => setEtapa({ tipo: "marcar", nombre: etapa.nombreMarcar })}
            >
              <RotateCcw className="h-4 w-4" /> Volver a intentar
            </Button>
          </div>
        )}
```

- [ ] **Step 6: Actualizar imports**

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowRight, CheckCircle, LogIn, LogOut, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { getEstadoMarcado, identificar, verificar, registrarMarca } from "../lib/api";
```

- [ ] **Step 7: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/MarcarPage.tsx
git commit -m "feat(web): Marcar público con íconos, banner de éxito y pantalla de rechazo pixel-perfect"
```

---

## Task 10: Admin

**Files:**
- Modify: `web/src/pages/admin/AdminPage.tsx`

**Interfaces:** Consumes: `Field` (Task 1). No pasa por `PanelLayout`
(`App.tsx` renderiza `<AdminPage />` directo, sin nav) — mantiene su
propio `<main>`, pero con el mismo ancho máximo de 1440px que las demás
páginas del panel (spec §7.3). Sin filtro nuevo (decisión de producto,
solo Sucursales/Empleados lo llevan).

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import { ApiError } from "../../lib/api";
import { useOrganizacionesAdmin, useCrearOrganizacionAdmin } from "./hooks";

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

export default function AdminPage() {
  const { data: organizaciones = [], isLoading, isError, error } = useOrganizacionesAdmin();
  const crear = useCrearOrganizacionAdmin();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await crear.mutateAsync({ name, slug });
      setName("");
      setSlug("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  if (isError) {
    const noAutorizado = error instanceof ApiError && error.status === 403;
    return (
      <main className="mx-auto w-full max-w-[1440px] px-8 py-8">
        <p className="text-[15px] text-text">
          {noAutorizado
            ? "No tenés acceso a esta sección."
            : "No se pudieron cargar las organizaciones. Probá de nuevo."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-8 py-8">
      <h1 className="text-[32px] font-extrabold text-text">Organizaciones</h1>

      <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
        <Field label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Slug" required value={slug} onChange={(e) => setSlug(e.target.value)} />
        <Button type="submit" variant="primary" disabled={crear.isPending}>
          Agregar
        </Button>
      </form>

      {formError && <p className="mt-2 text-[15px] text-accent-700">{formError}</p>}

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Alta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={4} className="text-text/60">
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            organizaciones.map((org) => (
              <TableRow key={org.id}>
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.slug}</TableCell>
                <TableCell>{org.plan}</TableCell>
                <TableCell>{fechaLocal(org.created_at)}</TableCell>
              </TableRow>
            ))}
          {!isLoading && organizaciones.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-text/60">
                Todavía no hay organizaciones.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/admin/AdminPage.tsx
git commit -m "feat(web): Admin con Field y contenedor de 1440px pixel-perfect"
```

---

## Task 11: Verificación final

**Files:** ninguno — solo verificación.

- [ ] **Step 1: Build limpio de punta a punta**

```bash
cd web
npm run build
```

Esperado: sin errores ni warnings de TypeScript.

- [ ] **Step 2: Levantar `web/` y `server/` en dev**

```bash
npm run dev:all
```

- [ ] **Step 3: Checklist manual (para el usuario en el navegador)**

Contra `http://localhost:5173`, con la ventana en un ancho grande (>1440px,
para validar el contenedor centrado) y comparando cada pantalla con la
sección correspondiente de `Oliver - UI Completa.dc.html` donde
corresponda:

1. Login (`/login`): card con borde, labels visibles, botón bold full
   width. Sin cambios de layout (pantalla pública, fuera de alcance del
   contenedor).
2. Home (`/`): nav más grande con wordmark "Oliver" sticky; grilla de 4
   tarjetas en una sola fila ocupando el ancho del contenedor centrado de
   1440px (sin quedar pegado a la izquierda ni desbordar en pantallas más
   angostas — probar también en una ventana angosta para confirmar el
   fallback a 2 y 1 columna).
3. Sucursales (`/sucursales`): form con labels, fila de filtros
   (buscar por nombre + estado) arriba de la tabla, la tabla usa el
   ancho del contenedor, tags "Sí"/"No", modal de QR con backdrop
   (clickear "Ver QR", confirmar que cierra con backdrop/Escape/botón
   Cerrar). Probar el filtro: buscar un nombre parcial, cambiar el
   estado a "Inactivos" y confirmar que la tabla se actualiza sin
   pegarle al server (Network tab).
4. Empleados (`/empleados`): form con labels, filtros de búsqueda/estado,
   tags de estado, modal de código al generar uno nuevo.
5. Asistencia (`/asistencia`) y Horas (`/horas`): selectores de fecha con
   `Field`, tablas usando el ancho del contenedor, tags sin cambios de
   comportamiento (sin filtro de búsqueda nuevo, solo el de fechas que ya
   tenían).
6. Marcar público (`/marcar/{org}/{sucursal}`): ícono en "Continuar",
   íconos en "Marcar entrada"/"Marcar salida", banner de éxito oscuro con
   check, y provocar un rechazo (marcar desde fuera del radio de la
   sucursal, o con geolocalización simulada) para ver la pantalla de
   "Estás fuera de rango" con "Volver a intentar". Sin nav ni contenedor
   de 1440px (pantalla pública).
7. Admin (`/admin`): form con labels, tabla usando el ancho de 1440px
   (requiere ser platform admin, ver README §"Probar el panel de
   superadmin"). Nota: esta pantalla no tiene nav (no pasa por
   `PanelLayout`), eso ya era así antes de este plan y no cambia acá.

Esperar la confirmación explícita del usuario antes de dar la etapa por
cerrada — no hay Step de commit acá, la etapa ya quedó commiteada
task por task arriba.

---

## Al terminar

- Las 8 pantallas + 2 modales matchean el mockup en tipografía, spacing,
  variantes de botón/tag y estructura de nav/forms.
- Home, Sucursales, Empleados, Asistencia, Horas y Admin comparten un
  contenedor centrado de 1440px en vez de columnas angostas ad hoc — el
  espacio de pantalla se aprovecha mejor en monitores grandes.
- Sucursales y Empleados tienen filtro de búsqueda por nombre + estado
  sobre sus tablas, filtrando en memoria sin pegarle al server.
- El navbar es más grande que lo que especifica el mock (decisión de
  producto), con wordmark, sticky y link activo en acento.
- `Field`, `Select` y `Dialog` quedan como componentes reutilizables para
  pantallas futuras (Plan 3, Plan 4).
- Sin cambios de comportamiento salvo que "Ver QR" y "Generar código" son
  ahora modales reales, y Sucursales/Empleados filtran en memoria.
- Sin dependencias nuevas, sin tests automatizados nuevos.
