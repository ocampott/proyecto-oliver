# Pixel-perfect Modernist — retrofit fino sobre web/ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que las 8 pantallas de `web/` (Login, Home, Sucursales,
Empleados, Asistencia, Horas, Marcar público, Admin) y sus 2 modales (Ver
QR, Generar código) matcheen pixel-a-pixel el mockup "Oliver - UI
Completa.dc.html", en vez de solo compartir los tokens de color/tipografía
que dejó la Etapa 4.

**Architecture:** Reescritura de los componentes compartidos
(`web/src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`) para que sus
`cva` variants matcheen los valores exactos de
`_ds/modernist-.../styles.css`, más dos componentes nuevos (`field.tsx`
con label, `dialog.tsx` con backdrop) — y después una pasada pantalla por
pantalla adoptando esos componentes y ajustando spacing/tipografía puntual
sin tocar lógica de negocio, salvo la apertura de los 2 modales.

**Tech Stack:** Sin dependencias nuevas — Tailwind v4 + `cva` +
`class-variance-authority` + `lucide-react`, todo ya instalado en `web/`.

**Spec:** `docs/superpowers/specs/2026-08-19-modernist-pixel-perfect-design.md`

## Global Constraints

- **Sin theming por organización** — acento fijo `#1d4ed8`, sin
  `accentColor`/`density` configurables.
- **Sin cambios de comportamiento** salvo que "Ver QR" y "Generar código"
  pasan de panel inline / sin feedback a modales reales (`Dialog`) — todo
  lo demás es visual.
- **Sin tests automatizados nuevos** — verificación manual (`npm run
  build` + pasada del usuario en el navegador al final).
- Fuente de verdad de valores: proyecto Claude Design
  `8f3e8aba-017d-4ccb-942e-1d6234146c10`, archivo
  `design_handoff_ui_oliver/_ds/modernist-.../styles.css` — los valores ya
  están citados en cada task de este plan, no hace falta re-leer el
  archivo salvo para verificar algo no cubierto acá.

---

## Task 1: Componentes compartidos — `Button`, `Card`, `Badge`, `Field` (nuevo), `Dialog` (nuevo)

**Files:**
- Modify: `web/src/components/ui/button.tsx`
- Modify: `web/src/components/ui/card.tsx`
- Modify: `web/src/components/ui/badge.tsx`
- Create: `web/src/components/ui/field.tsx`
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
  existentes. `Field` (`{ label: string } & InputProps`, forwardRef a
  `HTMLInputElement`) — consumido por los Tasks 3, 5, 6, 7, 8, 10.
  `Dialog` (`{ open: boolean; onClose: () => void; title: string;
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

- [ ] **Step 6: Crear `dialog.tsx`**

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

- [ ] **Step 7: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores de TypeScript. `Field` y `Dialog` van a quedar sin
consumidores todavía (Tasks 3, 5, 6, 7, 8, 10) — es esperable, igual que
en las etapas anteriores de este proyecto.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/ui/button.tsx web/src/components/ui/card.tsx \
  web/src/components/ui/badge.tsx web/src/components/ui/field.tsx web/src/components/ui/dialog.tsx \
  web/src/pages/LoginPage.tsx web/src/pages/HomePage.tsx web/src/pages/MarcarPage.tsx \
  web/src/pages/sucursales/SucursalesPage.tsx web/src/pages/empleados/EmpleadosPage.tsx \
  web/src/pages/admin/AdminPage.tsx
git commit -m "feat(web): componentes Button/Card/Badge pixel-perfect + Field y Dialog nuevos"
```

---

## Task 2: Nav — wordmark, sticky, link activo

**Files:**
- Modify: `web/src/components/PanelNav.tsx`

**Interfaces:** ninguna — consume `NavLink` de `react-router-dom` (ya en
uso).

- [ ] **Step 1: Reescribir `PanelNav.tsx`**

Valores de referencia: `.nav` tiene `border-bottom: 2px solid
var(--color-divider)`, padding `12px 16px` (`--space-3 --space-4`);
`.nav-brand` peso 800, 18px, `margin-right: auto`; los links en 14px,
`aria-current="page"` (o hover) en color acento.

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
    <nav className="sticky top-0 z-20 flex items-center gap-4 border-b-2 border-divider bg-bg px-4 py-3">
      <span className="mr-auto text-[18px] font-extrabold text-text">Oliver</span>
      {LINKS.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end
          className={({ isActive }) =>
            isActive ? "text-[14px] text-accent-700" : "text-[14px] text-text hover:text-accent-700"
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
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
git add web/src/components/PanelNav.tsx
git commit -m "feat(web): nav con wordmark, sticky y link activo en acento"
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

**Interfaces:** ninguna nueva — solo ajusta tamaños dentro del `Card` ya
retocado en Task 1.

- [ ] **Step 1: Ajustar tamaños de ícono/título/descripción al valor exacto del mock**

Valores de referencia: ícono 22×22 con `margin-bottom: 4px`, `card-title`
17px peso 800, `card-body` 13px opacidad `.8`.

Reemplazar el `.map` de `ACCESOS`:

```tsx
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
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/HomePage.tsx
git commit -m "feat(web): Home con tamaños de card pixel-perfect"
```

---

## Task 5: Sucursales — Field, Badge, Dialog de QR

**Files:**
- Modify: `web/src/pages/sucursales/SucursalesPage.tsx`

**Interfaces:** Consumes: `Field`, `Dialog` (Task 1), `Badge` (Task 1,
variant `neutral` nueva).

- [ ] **Step 1: Adoptar `Field` en el form de alta**

Reemplazar el `<form onSubmit={handleAlta} ...>`:

```tsx
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
```

- [ ] **Step 2: Adoptar `Field` en la fila de edición inline**

Reemplazar el contenido de la celda "Nombre" en edición:

```tsx
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
```

Reemplazar el contenido de la celda "Coordenadas" en edición:

```tsx
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
```

Reemplazar el contenido de la celda "Radio" en edición:

```tsx
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
```

- [ ] **Step 3: Reemplazar el texto plano de "Activa" por `Badge`**

```tsx
                  <TableCell>
                    <Badge variant={suc.activa ? "filled" : "neutral"}>{suc.activa ? "Sí" : "No"}</Badge>
                  </TableCell>
```

- [ ] **Step 4: Reemplazar el panel inline de QR por `Dialog`**

Reemplazar el bloque `{qrSucursal && (...)}` al final del componente:

```tsx
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
```

- [ ] **Step 5: Actualizar imports**

```tsx
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Badge } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
```

(quita el import de `Input`, que deja de usarse directo en este archivo).

- [ ] **Step 6: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/sucursales/SucursalesPage.tsx
git commit -m "feat(web): Sucursales con Field, Badge y modal de QR pixel-perfect"
```

---

## Task 6: Empleados — Field, Badge, Dialog de código

**Files:**
- Modify: `web/src/pages/empleados/EmpleadosPage.tsx`

**Interfaces:** Consumes: `Field`, `Dialog`, `Badge` (Task 1).

- [ ] **Step 1: Adoptar `Field` en el form de alta**

```tsx
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
```

- [ ] **Step 2: Adoptar `Field` en la fila de edición inline**

Reemplazar la celda "Nombre" en edición:

```tsx
                  <TableCell>
                    {editandoId === emp.id ? (
                      <Field label="Nombre" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                    ) : (
                      emp.nombre
                    )}
                  </TableCell>
```

Reemplazar la celda "Celular" en edición:

```tsx
                  <TableCell>
                    {editandoId === emp.id ? (
                      <Field label="Celular" value={editCelular} onChange={(e) => setEditCelular(e.target.value)} />
                    ) : (
                      emp.celular ?? "—"
                    )}
                  </TableCell>
```

- [ ] **Step 3: Reemplazar "Dispositivo" y "Activo" por `Badge`**

```tsx
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
```

- [ ] **Step 4: Agregar estado y `Dialog` de código generado**

Agregar el estado, arriba del `return`:

```tsx
  const [codigoDialog, setCodigoDialog] = useState<{ nombre: string; code: string } | null>(null);
```

Reemplazar `handleGenerarCodigo`:

```tsx
  async function handleGenerarCodigo(emp: Empleado) {
    setError(null);
    try {
      const otp = await generarCodigo.mutateAsync(emp.id);
      setCodigoDialog({ nombre: emp.nombre, code: formatCode(otp.code) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }
```

Esto cambia la firma de `handleGenerarCodigo` de `(id: string)` a
`(emp: Empleado)` — actualizar el único call site:

```tsx
                            <Button variant="ghost" onClick={() => handleGenerarCodigo(emp)} disabled={loading}>
                              {emp.otp ? "Código nuevo" : "Generar código"}
                            </Button>
```

Y agregar el `Dialog` al final del JSX, antes del cierre de `</Table>`'s
`main`/`div` wrapper (mismo nivel que la `Table`):

```tsx
        <Dialog
          open={codigoDialog != null}
          onClose={() => setCodigoDialog(null)}
          title="Código de vinculación"
        >
          <div className="text-center text-[40px] font-extrabold tracking-[0.15em] text-text">
            {codigoDialog?.code}
          </div>
          <p className="text-center text-[13px] text-text/85">
            Vence en 10 minutos. Dictáselo a {codigoDialog?.nombre}.
          </p>
        </Dialog>
```

`generarCodigo.mutateAsync(emp.id)` resuelve a `GenerarOtpResponse`
(`web/src/lib/api.ts:205-207`, `{ code: string }`), de ahí `otp.code` en
el step de arriba.

- [ ] **Step 5: Actualizar imports**

```tsx
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Badge } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
```

- [ ] **Step 6: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat(web): Empleados con Field, Badge y modal de código pixel-perfect"
```

---

## Task 7: Asistencia

**Files:**
- Modify: `web/src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:** Consumes: `Field` (Task 1). Ya usa `Badge` correctamente
(sin cambios ahí, sirve de referencia).

- [ ] **Step 1: Reemplazar el `<label>` manual de fechas por `Field`**

Reemplazar el bloque de selectores de fecha:

```tsx
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
```

- [ ] **Step 2: Actualizar imports**

```tsx
import { LogIn, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Badge } from "../../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
```

(quita el import de `Input`, que deja de usarse directo en este archivo).

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/asistencia/AsistenciaPage.tsx
git commit -m "feat(web): Asistencia con Field para el rango de fechas"
```

---

## Task 8: Horas

**Files:**
- Modify: `web/src/pages/horas/HorasPage.tsx`

**Interfaces:** Consumes: `Field` (Task 1).

- [ ] **Step 1: Reemplazar el `<label>` manual de fechas por `Field`**

```tsx
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
```

- [ ] **Step 2: Actualizar imports**

```tsx
import { Field } from "../../components/ui/field";
import { Badge } from "../../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
```

(quita el import de `Input`).

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/horas/HorasPage.tsx
git commit -m "feat(web): Horas con Field para el rango de fechas"
```

---

## Task 9: Marcar público

**Files:**
- Modify: `web/src/pages/MarcarPage.tsx`

**Interfaces:** ninguna nueva — el mock NO usa `Field`/labels en estas
pantallas (son inputs mobile-first solo con placeholder, confirmado en el
`.dc.html`), así que este task no toca `Field`.

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

**Interfaces:** Consumes: `Field` (Task 1).

- [ ] **Step 1: Adoptar `Field` en el form de alta**

```tsx
        <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Slug" required value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Button type="submit" variant="primary" disabled={crear.isPending}>
            Agregar
          </Button>
        </form>
```

- [ ] **Step 2: Actualizar imports**

```tsx
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import { ApiError } from "../../lib/api";
import { useOrganizacionesAdmin, useCrearOrganizacionAdmin } from "./hooks";
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/admin/AdminPage.tsx
git commit -m "feat(web): Admin con Field pixel-perfect"
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

Contra `http://localhost:5173`, comparar cada pantalla con la sección
correspondiente de `Oliver - UI Completa.dc.html`:

1. Login (`/login`): card con borde, labels visibles, botón bold full
   width.
2. Home (`/`): nav con wordmark "Oliver" sticky, grilla de 4 tarjetas con
   tamaños ajustados.
3. Sucursales (`/sucursales`): form con labels, tags "Sí"/"No", modal de
   QR con backdrop (clickear "Ver QR", confirmar que cierra con
   backdrop/Escape/botón Cerrar).
4. Empleados (`/empleados`): form con labels, tags de estado, modal de
   código al generar uno nuevo.
5. Asistencia (`/asistencia`) y Horas (`/horas`): selectores de fecha con
   `Field`, tags sin cambios de comportamiento.
6. Marcar público (`/marcar/{org}/{sucursal}`): ícono en "Continuar",
   íconos en "Marcar entrada"/"Marcar salida", banner de éxito oscuro con
   check, y provocar un rechazo (marcar desde fuera del radio de la
   sucursal, o con geolocalización simulada) para ver la pantalla de
   "Estás fuera de rango" con "Volver a intentar".
7. Admin (`/admin`): form con labels (requiere ser platform admin, ver
   README §"Probar el panel de superadmin").

Esperar la confirmación explícita del usuario antes de dar la etapa por
cerrada — no hay Step de commit acá, la etapa ya quedó commiteada
task por task arriba.

---

## Al terminar

- Las 8 pantallas + 2 modales matchean el mockup en tipografía, spacing,
  variantes de botón/tag y estructura de nav/forms.
- `Field` y `Dialog` quedan como componentes reutilizables para pantallas
  futuras (Plan 3, Plan 4).
- Sin cambios de comportamiento salvo que "Ver QR" y "Generar código" son
  ahora modales reales.
- Sin dependencias nuevas, sin tests automatizados nuevos.
