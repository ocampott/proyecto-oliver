# Sidebar de navegación colapsable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el navbar horizontal (`PanelNav.tsx`) por una topbar delgada + sidebar vertical colapsable, con una campanita de notificaciones placeholder y Configuración/Soporte fijos en el pie del sidebar.

**Architecture:** `PanelLayout.tsx` pasa de `<PanelNav/> + <main>` a un app-shell de dos niveles: `TopBar` (fila fija, ancho completo) arriba de un `flex` con `Sidebar` (columna fija, colapsable en desktop, drawer off-canvas en mobile) + `<main>` scrolleable. Toda la lógica de gating de plan/rol que hoy vive en `PanelNav.tsx` se traslada intacta a `Sidebar.tsx`. La lógica de tooltip con portal que ya tiene `IconButton` se extrae a un hook compartido para que el rail colapsado del sidebar la reuse con `side="right"`.

**Tech Stack:** React 19 + TypeScript, react-router-dom v6 (`NavLink`), Tailwind v4 (tokens en `src/index.css`), lucide-react (íconos), sin test runner configurado — verificación manual en `npm run dev` + `tsc -b` + `oxlint`.

**Spec:** `docs/superpowers/specs/2026-08-24-sidebar-navegacion-design.md`

## Global Constraints

- Breakpoint mobile/desktop: `md:` (768px), el mismo que usa `PanelNav.tsx` hoy — no introducir un breakpoint nuevo.
- El estado colapsado/expandido se persiste solo en `localStorage` (clave `oliver:sidebar-collapsed`), nunca en backend/DB.
- La lógica de gating (`tieneModulo`, `tieneRol`, badge de plan requerido, link a `/plan`) se reutiliza tal cual desde `src/lib/hooks.ts` — no se reimplementa.
- `/admin` (`AdminPage`) no usa `PanelLayout` hoy y sigue sin usarlo — este plan no lo toca.
- Sin cambios de backend, DB ni endpoints.
- Cada task termina con `npx tsc -b` limpio y una verificación manual en `npm run dev` antes de comitear.

---

## Task 1: Hook de tooltip compartido + `side="right"` en `IconButton`

**Files:**
- Create: `src/components/ui/tooltip.tsx`
- Modify: `src/components/ui/icon-button.tsx` (refactor completo, mismo comportamiento visible)

**Interfaces:**
- Produces: `useHoverTooltip<T extends HTMLElement>(label: string, side?: "top" | "right")` → `{ triggerProps: { ref, onMouseEnter, onMouseLeave, onFocus, onBlur }, tooltipNode: React.ReactNode }`. `tooltipNode` es `null` si no está visible; si está visible, es un `createPortal` de un `<span role="tooltip">` con el mismo estilo que usa `IconButton` hoy. Es un **valor**, no un componente — se inserta directo (`{tooltipNode}`), nunca como `<Tooltip .../>`, para no crear un tipo de componente distinto en cada render (ver Step 1: eso fue un hallazgo Important del review de este task, corregido antes de que Task 3/4 lo heredaran).
- `IconButton` gana un prop opcional `side?: "top" | "right"` (default `"top"`), sin cambiar su firma existente (`icon`, `label`, resto de `ButtonHTMLAttributes`).

- [ ] **Step 1: Crear el hook `useHoverTooltip`**

Extrae la lógica de `src/components/ui/icon-button.tsx` líneas 18-55 y 86-97 (estado `visible`/`style`, `show`/`hide` con delay, posicionamiento vía `useLayoutEffect`, portal) a un hook reusable que además soporta `side: "right"`.

```tsx
// src/components/ui/tooltip.tsx
import * as React from "react";
import { createPortal } from "react-dom";

const GAP = 6;
const MARGIN = 8;
const SHOW_DELAY = 300;

interface TriggerProps<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

export function useHoverTooltip<T extends HTMLElement>(label: string, side: "top" | "right" = "top") {
  const triggerRef = React.useRef<T>(null);
  const tooltipRef = React.useRef<HTMLSpanElement>(null);
  const timeoutRef = React.useRef<number | undefined>(undefined);
  const [visible, setVisible] = React.useState(false);
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  function show() {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setVisible(true), SHOW_DELAY);
  }
  function hide() {
    window.clearTimeout(timeoutRef.current);
    setVisible(false);
  }

  React.useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  React.useLayoutEffect(() => {
    if (!visible) return;
    const trigger = triggerRef.current;
    const tip = tooltipRef.current;
    if (!trigger || !tip) return;
    const t = trigger.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;

    if (side === "right") {
      const left = Math.min(Math.max(t.right + GAP, MARGIN), window.innerWidth - tw - MARGIN);
      const top = Math.min(Math.max(t.top + t.height / 2 - th / 2, MARGIN), window.innerHeight - th - MARGIN);
      setStyle({ left, top });
      return;
    }

    const placeAbove = t.top >= th + GAP + MARGIN;
    let left = t.left + t.width / 2 - tw / 2;
    left = Math.min(Math.max(left, MARGIN), window.innerWidth - tw - MARGIN);
    const top = placeAbove ? t.top - th - GAP : t.bottom + GAP;
    setStyle({ left, top });
  }, [visible, side]);

  const triggerProps: TriggerProps<T> = {
    ref: triggerRef,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  };

  // tooltipNode es un VALOR (React.ReactNode), no un componente — nunca
  // definir una función-componente acá adentro. Una función anidada
  // definida en cada corrida del hook cambia de identidad en cada render,
  // lo que hace que React desmonte/remonte el <span> portaleado en
  // cualquier re-render del componente que llama al hook mientras el
  // tooltip está visible, no solo cuando cambia el estado hover.
  const tooltipNode: React.ReactNode = visible
    ? createPortal(
        <span
          ref={tooltipRef}
          role="tooltip"
          style={style}
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-text px-2 py-1 text-[11.5px] font-medium text-white"
        >
          {label}
        </span>,
        document.body
      )
    : null;

  return { triggerProps, tooltipNode };
}
```

- [ ] **Step 2: Refactorizar `IconButton` para usar el hook**

Reemplazar todo el cuerpo de `src/components/ui/icon-button.tsx` por:

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";
import { useHoverTooltip } from "./tooltip";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  side?: "top" | "right";
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, side = "top", className, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, forwardedRef) => {
    const { triggerProps, tooltipNode } = useHoverTooltip<HTMLButtonElement>(label, side);

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        triggerProps.ref.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.RefObject<HTMLButtonElement | null>).current = node;
      },
      [forwardedRef, triggerProps.ref]
    );

    return (
      <>
        <button
          ref={setRefs}
          aria-label={label}
          onMouseEnter={(e) => {
            triggerProps.onMouseEnter();
            onMouseEnter?.(e);
          }}
          onMouseLeave={(e) => {
            triggerProps.onMouseLeave();
            onMouseLeave?.(e);
          }}
          onFocus={(e) => {
            triggerProps.onFocus();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            triggerProps.onBlur();
            onBlur?.(e);
          }}
          className={cn(
            "inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:bg-black/[.03] disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-45",
            className
          )}
          {...props}
        >
          {icon}
        </button>
        {tooltipNode}
      </>
    );
  }
);
IconButton.displayName = "IconButton";

export { IconButton };
```

- [ ] **Step 3: Verificar que no rompió nada existente**

Run: `npx tsc -b`
Expected: sin errores.

Run: `npm run dev`, abrir cualquier página con un `IconButton` existente (ej. `/empleados`, botón de borrar/desactivar) y confirmar que el tooltip sigue apareciendo arriba/abajo del botón igual que antes (ahora vía el hook, mismo comportamiento visual).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/tooltip.tsx src/components/ui/icon-button.tsx
git commit -m "refactor: extraer tooltip de IconButton a hook reusable con soporte side=right"
```

---

## Task 2: `NotificationBell.tsx` (placeholder)

**Files:**
- Create: `src/components/NotificationBell.tsx`

**Interfaces:**
- Produces: `NotificationBell()` — componente sin props, sin estado. Se usa en `TopBar.tsx` (Task 4).

- [ ] **Step 1: Crear el componente**

```tsx
// src/components/NotificationBell.tsx
import { Bell } from "lucide-react";
import { IconButton } from "./ui/icon-button";

// Placeholder visual — sin dropdown ni contador todavía.
// Se completa cuando se implemente el spec de notificaciones.
export function NotificationBell() {
  return <IconButton icon={<Bell className="h-[18px] w-[18px]" />} label="Notificaciones" />;
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc -b`
Expected: sin errores (el componente no se usa todavía en ningún lado hasta Task 4, así que no hay verificación visual posible aún — solo type-check).

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationBell.tsx
git commit -m "feat: componente NotificationBell placeholder"
```

---

## Task 3: `Sidebar.tsx`

**Files:**
- Create: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `useOrgActual`, `tieneModulo`, `tieneRol` de `src/lib/hooks.ts`; tipos `Modulo`, `PlanSlug`, `Entitlements`, `Organization` de `src/lib/api.ts`; `useHoverTooltip` de `src/components/ui/tooltip.tsx` (Task 1); `cn` de `src/lib/utils.ts`; `Badge` de `src/components/ui/badge.tsx`.
- Produces: `Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void })`. Consumido por `PanelLayout.tsx` en Task 5.

- [ ] **Step 1: Crear el archivo con la lista de items, gating e íconos (sin colapso todavía)**

Portar `LINKS`, `PLAN_REQUERIDO`, `PLAN_NOMBRE` y la lógica de `NavLinkItem` de `src/components/PanelNav.tsx` (líneas 19-41 y 133-211), sumando un ícono por item y layout vertical:

```tsx
// src/components/Sidebar.tsx
import * as React from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  ClipboardCheck,
  Users,
  Building2,
  Clock,
  CalendarDays,
  HeartHandshake,
  Settings,
  LifeBuoy,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import { useOrgActual, tieneModulo, tieneRol } from "../lib/hooks";
import { useHoverTooltip } from "./ui/tooltip";
import type { Modulo, PlanSlug, Entitlements, Organization } from "../lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  modulo?: Modulo;
  /** true si solo owner/admin pueden acceder (agent queda afuera). */
  soloGestion?: boolean;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/asistencia", label: "Asistencia", icon: ClipboardCheck, modulo: "asistencia" },
  { href: "/empleados", label: "Empleados", icon: Users },
  { href: "/sucursales", label: "Sucursales", icon: Building2 },
  { href: "/horas", label: "Horas", icon: Clock, modulo: "horas", soloGestion: true },
  { href: "/turnos", label: "Turnos", icon: CalendarDays, modulo: "turnos", soloGestion: true },
  { href: "/rrhh", label: "RRHH", icon: HeartHandshake, modulo: "rrhh", soloGestion: true },
];

const PLAN_REQUERIDO: Record<Modulo, PlanSlug> = {
  asistencia: "gratis",
  horas: "basico",
  turnos: "basico",
  rrhh: "basico",
  reportes: "basico",
};

const PLAN_NOMBRE: Record<PlanSlug, string> = {
  gratis: "Gratis",
  basico: "Básico",
  pro: "Pro",
};

const STORAGE_KEY = "oliver:sidebar-collapsed";

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const { data: org, isLoading } = useOrgActual();
  const ent = org?.entitlements ?? null;
  const orgOrNull = org ?? null;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-border-soft bg-white transition-transform duration-200 md:static md:z-auto md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-end px-3 py-3 md:hidden">
          <button onClick={onMobileClose} aria-label="Cerrar menú" className="rounded-lg p-1.5 hover:bg-black/[.03]">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
          {isLoading
            ? LINKS.map((item) => (
                <span key={item.href} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="h-[13px] w-24 animate-pulse rounded-full bg-text/10" />
                </span>
              ))
            : LINKS.map((item) => (
                <SidebarNavLink key={item.href} item={item} ent={ent} org={orgOrNull} onClick={onMobileClose} />
              ))}
        </nav>
        <div className="border-t border-border-soft p-2">
          <SidebarFooterLink href="/configuracion" label="Configuración" icon={Settings} onClick={onMobileClose} />
          <a
            href="mailto:soporte@oliver.app"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-black/[.03] hover:text-text"
          >
            <LifeBuoy className="h-[18px] w-[18px] shrink-0" />
            <span>Soporte</span>
          </a>
        </div>
      </aside>
    </>
  );
}

function SidebarFooterLink({
  href,
  label,
  icon: Icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <NavLink
      to={href}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
          isActive ? "bg-accent-100 font-semibold text-accent-700" : "text-text-secondary hover:bg-black/[.03] hover:text-text"
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

function SidebarNavLink({
  item,
  ent,
  org,
  onClick,
}: {
  item: NavItem;
  ent: Entitlements | null;
  org: Organization | null;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const sinPermiso = item.soloGestion ? !tieneRol(org, ["owner", "admin"]) : false;
  const bloqueado = item.modulo ? !tieneModulo(ent, item.modulo) : false;
  const planReq = item.modulo ? PLAN_REQUERIDO[item.modulo] : null;
  const aviso =
    bloqueado && planReq ? `Disponible con el plan ${PLAN_NOMBRE[planReq]}. Hacé click para ver los planes.` : undefined;

  if (sinPermiso) {
    return (
      <span
        title="Tu rol no tiene acceso a esta sección."
        aria-disabled="true"
        className="flex cursor-not-allowed select-none items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary opacity-40"
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span>{item.label}</span>
      </span>
    );
  }

  if (bloqueado && planReq) {
    return (
      <NavLink
        to="/plan"
        onClick={onClick}
        title={aviso}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-black/[.03] hover:text-text"
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex items-center gap-1.5">
          {item.label}
          <Badge variant="outline" className="text-[10px]">
            {PLAN_NOMBRE[planReq]}
          </Badge>
        </span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to={item.href}
      end
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
          isActive ? "bg-accent-100 font-semibold text-accent-700" : "text-text-secondary hover:bg-black/[.03] hover:text-text"
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}
```

- [ ] **Step 2: Verificar el estado sin colapso**

Run: `npx tsc -b` — esperado sin errores (aunque `Sidebar` todavía no se usa en `PanelLayout`, debe compilar solo).

No hay verificación visual posible todavía (no está montado) — se verifica junto con Task 5.

- [ ] **Step 3: Agregar colapso (icon-rail) + persistencia en localStorage**

Modificar `Sidebar.tsx`: agregar estado `collapsed`, botón de toggle, y usar `md:w-16`/`md:hidden` en los labels cuando está colapsado. Reemplazar la función `Sidebar` completa:

```tsx
export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const { data: org, isLoading } = useOrgActual();
  const ent = org?.entitlements ?? null;
  const orgOrNull = org ?? null;

  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onMobileClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-border-soft bg-white transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-16" : "md:w-[220px]"
        )}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className={cn("hidden rounded-lg p-1.5 text-text-secondary hover:bg-black/[.03] md:flex", collapsed && "mx-auto")}
          >
            {collapsed ? <ChevronRight className="h-[18px] w-[18px]" /> : <ChevronLeft className="h-[18px] w-[18px]" />}
          </button>
          <button onClick={onMobileClose} aria-label="Cerrar menú" className="ml-auto rounded-lg p-1.5 hover:bg-black/[.03] md:hidden">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
          {isLoading
            ? LINKS.map((item) => (
                <span key={item.href} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="h-[13px] w-24 animate-pulse rounded-full bg-text/10" />
                </span>
              ))
            : LINKS.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  ent={ent}
                  org={orgOrNull}
                  collapsed={collapsed}
                  onClick={onMobileClose}
                />
              ))}
        </nav>
        <div className="border-t border-border-soft p-2">
          <SidebarFooterLink href="/configuracion" label="Configuración" icon={Settings} collapsed={collapsed} onClick={onMobileClose} />
          <SidebarFooterAnchor href="mailto:soporte@oliver.app" label="Soporte" icon={LifeBuoy} collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}
```

Agregar `collapsed` a las firmas de `SidebarFooterLink` y `SidebarNavLink`, condicionando el label con `cn("...", collapsed && "md:hidden")` y agregando el tooltip con `side="right"` solo cuando `collapsed` (el hook siempre se llama con el `label` correspondiente, pero `tooltipNode` es `null` si `visible` es `false`, así que no hace falta condicionar el llamado al hook — solo mostrar/ocultar el trigger's `title` nativo cuando no está colapsado). `tooltipNode` se inserta directo como `{collapsed && tooltipNode}` — nunca como `<Tooltip .../>` (ver la corrección de Task 1 arriba):

```tsx
function SidebarFooterLink({
  href,
  label,
  icon: Icon,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  onClick: () => void;
}) {
  const { triggerProps, tooltipNode } = useHoverTooltip<HTMLAnchorElement>(label, "right");
  return (
    <>
      <NavLink
        ref={triggerProps.ref}
        to={href}
        onClick={onClick}
        onMouseEnter={triggerProps.onMouseEnter}
        onMouseLeave={triggerProps.onMouseLeave}
        onFocus={triggerProps.onFocus}
        onBlur={triggerProps.onBlur}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
            isActive ? "bg-accent-100 font-semibold text-accent-700" : "text-text-secondary hover:bg-black/[.03] hover:text-text"
          )
        }
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className={cn(collapsed && "md:hidden")}>{label}</span>
      </NavLink>
      {collapsed && tooltipNode}
    </>
  );
}

function SidebarFooterAnchor({
  href,
  label,
  icon: Icon,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
}) {
  const { triggerProps, tooltipNode } = useHoverTooltip<HTMLAnchorElement>(label, "right");
  return (
    <>
      <a
        ref={triggerProps.ref}
        href={href}
        onMouseEnter={triggerProps.onMouseEnter}
        onMouseLeave={triggerProps.onMouseLeave}
        onFocus={triggerProps.onFocus}
        onBlur={triggerProps.onBlur}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-black/[.03] hover:text-text"
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className={cn(collapsed && "md:hidden")}>{label}</span>
      </a>
      {collapsed && tooltipNode}
    </>
  );
}
```

Reemplazar la función `SidebarNavLink` completa (agrega el prop `collapsed`, oculta el label cuando corresponde, y agrega el tooltip `side="right"` en las tres ramas):

```tsx
function SidebarNavLink({
  item,
  ent,
  org,
  collapsed,
  onClick,
}: {
  item: NavItem;
  ent: Entitlements | null;
  org: Organization | null;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const sinPermiso = item.soloGestion ? !tieneRol(org, ["owner", "admin"]) : false;
  const bloqueado = item.modulo ? !tieneModulo(ent, item.modulo) : false;
  const planReq = item.modulo ? PLAN_REQUERIDO[item.modulo] : null;
  const aviso =
    bloqueado && planReq ? `Disponible con el plan ${PLAN_NOMBRE[planReq]}. Hacé click para ver los planes.` : undefined;

  const disabledTooltip = useHoverTooltip<HTMLSpanElement>("Tu rol no tiene acceso a esta sección.", "right");
  const lockedTooltip = useHoverTooltip<HTMLAnchorElement>(aviso ?? item.label, "right");
  const normalTooltip = useHoverTooltip<HTMLAnchorElement>(item.label, "right");

  if (sinPermiso) {
    return (
      <>
        <span
          ref={disabledTooltip.triggerProps.ref}
          onMouseEnter={disabledTooltip.triggerProps.onMouseEnter}
          onMouseLeave={disabledTooltip.triggerProps.onMouseLeave}
          onFocus={disabledTooltip.triggerProps.onFocus}
          onBlur={disabledTooltip.triggerProps.onBlur}
          title={collapsed ? undefined : "Tu rol no tiene acceso a esta sección."}
          aria-disabled="true"
          className="flex cursor-not-allowed select-none items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary opacity-40"
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
        </span>
        {collapsed && disabledTooltip.tooltipNode}
      </>
    );
  }

  if (bloqueado && planReq) {
    return (
      <>
        <NavLink
          ref={lockedTooltip.triggerProps.ref}
          to="/plan"
          onClick={onClick}
          onMouseEnter={lockedTooltip.triggerProps.onMouseEnter}
          onMouseLeave={lockedTooltip.triggerProps.onMouseLeave}
          onFocus={lockedTooltip.triggerProps.onFocus}
          onBlur={lockedTooltip.triggerProps.onBlur}
          title={collapsed ? undefined : aviso}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-black/[.03] hover:text-text"
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className={cn("flex items-center gap-1.5", collapsed && "md:hidden")}>
            {item.label}
            <Badge variant="outline" className="text-[10px]">
              {PLAN_NOMBRE[planReq]}
            </Badge>
          </span>
        </NavLink>
        {collapsed && lockedTooltip.tooltipNode}
      </>
    );
  }

  return (
    <>
      <NavLink
        ref={normalTooltip.triggerProps.ref}
        to={item.href}
        end
        onClick={onClick}
        onMouseEnter={normalTooltip.triggerProps.onMouseEnter}
        onMouseLeave={normalTooltip.triggerProps.onMouseLeave}
        onFocus={normalTooltip.triggerProps.onFocus}
        onBlur={normalTooltip.triggerProps.onBlur}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
            isActive ? "bg-accent-100 font-semibold text-accent-700" : "text-text-secondary hover:bg-black/[.03] hover:text-text"
          )
        }
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
      </NavLink>
      {collapsed && normalTooltip.tooltipNode}
    </>
  );
}
```

Nota: los tres hooks (`disabledTooltip`, `lockedTooltip`, `normalTooltip`) se llaman incondicionalmente arriba de los `if` — nunca dentro de una rama condicional — para respetar las reglas de hooks de React (`SidebarNavLink` siempre ejecuta las mismas ramas de `if` en cada render dado un `item` fijo, pero React exige que el número de hooks llamados no dependa del resultado de un `if` dentro del mismo componente).

- [ ] **Step 4: Verificar tooltips y colapso**

Run: `npx tsc -b` — sin errores.

Verificación visual junto con Task 5 (el sidebar aún no está montado en ningún layout).

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: componente Sidebar con gating, colapso icon-rail y drawer mobile"
```

---

## Task 4: `TopBar.tsx`

**Files:**
- Create: `src/components/TopBar.tsx`

**Interfaces:**
- Consumes: `AccountMenu` (existente, `src/components/AccountMenu.tsx`), `NotificationBell` (Task 2).
- Produces: `TopBar({ onMenuClick }: { onMenuClick: () => void })`. Consumido por `PanelLayout.tsx` en Task 5.

- [ ] **Step 1: Crear el componente**

Portar el logo y la estructura de `<nav>` de `PanelNav.tsx` (líneas 79-84, 102-108), sacando los links (ahora en `Sidebar`) y agregando `NotificationBell`:

```tsx
// src/components/TopBar.tsx
import { Menu } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { NotificationBell } from "./NotificationBell";
import { IconButton } from "./ui/icon-button";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center bg-white/90 px-4 py-3.5 shadow-[0_1px_0_rgba(24,24,27,0.07)] backdrop-blur-sm md:px-6">
      <IconButton
        className="mr-2 md:hidden"
        onClick={onMenuClick}
        label="Abrir menú"
        icon={<Menu className="h-[18px] w-[18px]" />}
      />
      <span className="text-[17px] font-extrabold tracking-tight text-text">oliver</span>
      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <AccountMenu />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc -b` — sin errores. Verificación visual junto con Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "feat: componente TopBar con logo, campanita y menú de cuenta"
```

---

## Task 5: Rewire `PanelLayout.tsx` + borrar `PanelNav.tsx`

**Files:**
- Modify: `src/components/PanelLayout.tsx`
- Delete: `src/components/PanelNav.tsx`

**Interfaces:**
- Consumes: `TopBar` (Task 4), `Sidebar` (Task 3).

- [ ] **Step 1: Reescribir `PanelLayout.tsx`**

```tsx
// src/components/PanelLayout.tsx
import { useState, type ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

export function PanelLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <TopBar onMenuClick={() => setMobileOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Borrar el archivo viejo**

```bash
rm src/components/PanelNav.tsx
```

- [ ] **Step 3: Verificar que nada más importa `PanelNav`**

Run: `grep -rn "PanelNav" src/`
Expected: sin resultados.

Run: `npx tsc -b`
Expected: sin errores.

- [ ] **Step 4: Verificación manual completa (todo el flujo del spec)**

Run: `npm run dev`, loguearse con una cuenta de prueba y verificar en el navegador:
- Desktop: sidebar visible a la izquierda, topbar arriba con logo/campanita/avatar.
- Click en el botón de colapsar: sidebar se angosta a solo íconos, tooltips aparecen a la derecha de cada ícono al hacer hover.
- Recargar la página con el sidebar colapsado: sigue colapsado (persistencia en localStorage).
- Reducir el viewport a mobile (`<768px`): sidebar desaparece, aparece el botón hamburguesa en la topbar; al tocarlo se abre el sidebar como overlay con label visible (no colapsado); click afuera o Escape lo cierra.
- Con las 4 cuentas de prueba (gratis/básico/pro/superadmin@test.local, password `demo123456`): confirmar que el gating de módulos (badge de plan, link a `/plan`) y de rol (`agent` sin acceso a Horas/Turnos/RRHH) se ve igual que antes del refactor, tanto expandido como colapsado.
- Configuración y Soporte visibles y funcionales en el pie del sidebar, en los tres estados (expandido, colapsado, drawer mobile).

- [ ] **Step 5: Commit**

```bash
git add src/components/PanelLayout.tsx
git rm src/components/PanelNav.tsx
git commit -m "feat(nav): reemplazar navbar horizontal por sidebar colapsable + topbar"
```

---

## Task 6: Sacar "Configuración" de `AccountMenu`

**Files:**
- Modify: `src/components/AccountMenu.tsx:68-76`

**Interfaces:** Ninguna — cambio interno, no afecta consumidores de `AccountMenu`.

- [ ] **Step 1: Eliminar el botón**

En `src/components/AccountMenu.tsx`, borrar el bloque del botón "Configuración" (líneas 68-76 del archivo actual):

```tsx
          <button
            onClick={() => {
              setOpen(false);
              navigate("/configuracion");
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] font-medium text-text hover:bg-black/[.03]"
          >
            Configuración
          </button>
```

El dropdown queda con: encabezado (nombre org + email), "Mi plan", "Panel admin" (si superadmin), "Cerrar sesión".

- [ ] **Step 2: Verificar**

Run: `npx tsc -b` — sin errores.

Run: `npm run dev`, abrir el dropdown del avatar y confirmar que "Configuración" ya no aparece, y que sigue accesible desde el pie del sidebar.

- [ ] **Step 3: Commit**

```bash
git add src/components/AccountMenu.tsx
git commit -m "refactor: sacar Configuración del menú de cuenta (ahora vive en el sidebar)"
```

---

## Task 7: Lint final y verificación completa del spec

**Files:** Ninguno nuevo — solo verificación.

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: sin errores nuevos introducidos por este trabajo (si `oxlint` reporta preexistentes de otras partes del código, no son responsabilidad de este plan).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript ni de Vite.

- [ ] **Step 3: Repasar la sección "Testing" del spec línea por línea**

Contra `docs/superpowers/specs/2026-08-24-sidebar-navegacion-design.md`, confirmar cada punto de su sección "Testing" (expandir/colapsar, persistencia, drawer mobile, gating con las 4 cuentas, Configuración/Soporte en los tres estados) — ya cubiertos en Task 5 Step 4, este paso es una repasada final antes de dar el feature por cerrado.

- [ ] **Step 4: Commit final (si hubo fixes de lint/build)**

```bash
git add -A
git commit -m "fix: ajustes finales de lint/build del sidebar colapsable"
```

(Si no hubo cambios, omitir este commit.)
