# Rediseño R1/R3 — Etapa 2: Layout global (Sidebar R1 + Command Palette) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la topbar actual por el layout de R1 — sidebar oscura
de ancho completo con búsqueda integrada que abre un Command Palette
(⌘K) — sin tocar ninguna página ni su contenido.

**Architecture:** Esta es la Etapa 2 de 8 del rediseño (spec, sección
"Plan de fases"), construida sobre la Etapa 1 (tokens + componentes UI,
ya mergeada en esta misma rama). Alcance cerrado a los archivos de
"chrome" del panel: `Sidebar.tsx`, `TopBar.tsx` (se borra),
`PanelLayout.tsx`, `AccountMenu.tsx`, `NotificationBell.tsx`, y dos
archivos nuevos (`CommandPalette.tsx`, `MobileHeader.tsx`). Ninguna
página ni `PageHeader.tsx` se toca en esta etapa — la simplificación de
`PageHeader` queda para cuando cada página se rehaga en sus propias
etapas (3 a 7), evitando un cambio de props de gran superficie ahora.

Tres tasks: (1) `CommandPalette`, componente nuevo y autocontenido, sin
consumidor todavía; (2) `Sidebar.tsx` con el tratamiento oscuro de R1,
más `AccountMenu.tsx`/`NotificationBell.tsx` reposicionados y
reestilizados para vivir en su pie — las tres cosas juntas en un mismo
task porque el reposicionamiento de sus popovers (de "arriba a la
derecha" a "abajo a la izquierda") solo tiene sentido sabiendo dónde van
a vivir; separarlas dejaría un estado intermedio con popovers
literalmente fuera de la pantalla; (3) `PanelLayout.tsx` +
`MobileHeader.tsx` (nuevo) + borrado de `TopBar.tsx`, que conecta todo:
sidebar con `onOpenSearch`, atajo global ⌘K, y el Command Palette
montado a nivel de layout.

**Tech Stack:** Sin dependencias nuevas — mismo stack de la Etapa 1
(Tailwind v4, `lucide-react`, `cn()`) más `react-router-dom` (`useNavigate`,
ya instalado) y `@tanstack/react-query` (los hooks de datos ya existentes).

**Spec:** `docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md`

## Global Constraints

- **Sin cambios de comportamiento de negocio** — gating por plan/rol
  (`tieneModulo`, `tieneRol`), colapso de sidebar (localStorage), y toda
  la lógica de auth/organización se preservan tal cual, solo cambia su
  presentación visual y ubicación en el layout.
- **Cero páginas tocadas** — ningún archivo bajo `src/pages/` se modifica
  en esta etapa.
- **`PageHeader.tsx` no se toca** — su simplificación queda para las
  etapas de cada módulo (3 a 7).
- **Sin dependencias nuevas.**
- **1 login = 1 organización** (ver `PRODUCT.md`) — no hay selector de
  organización en el header del sidebar (a diferencia de R1, que sí lo
  tiene); se muestra el nombre de la organización actual sin dropdown de
  cambio, porque no hay nada entre lo que cambiar.
- **Sidebar oscura hardcodeada, no tokens globales** — igual que R1 (que
  hardcodea `#0D0D11` en vez de usar sus tokens `--sidebar-*`), el fondo
  oscuro de `Sidebar.tsx` se hardcodea con clases Tailwind arbitrarias
  (`bg-[#0d0d11]`, `text-white/NN`) en vez de agregar tokens `@theme`
  nuevos — es la única superficie oscura de una app por lo demás clara,
  no un tema oscuro del sistema.
- **Colapso 220px↔64px se preserva** — misma persistencia en
  `localStorage` (`oliver:sidebar-collapsed`) y mismo mecanismo de
  posicionamiento del botón portaleado a `document.body`
  (`2026-08-24-sidebar-navegacion-design.md`).
- **Command Palette — alcance de acciones**: "Nuevo empleado", "Registrar
  ausencia" y "Revisar rechazadas" navegan a la página correspondiente
  (`/empleados`, `/rrhh`, `/asistencia`) — no abren un modal/tab
  específico vía query param. Esa plomería más fina se agrega cuando esas
  páginas se rehagan (Etapas 5 y 6) con los componentes `SidePanel`/`Tabs`
  de la Etapa 1; inventarla ahora sería una funcionalidad nueva no pedida.
- **Command Palette — alcance de búsqueda de entidades**: empleados sale
  de `useEmpleados()` (lista completa, ya cacheada por React Query, sin
  paginar). Sucursales sale de `useSucursales()` con sus params default
  (`{ page: 1, pageSize: 30 }`) — organizaciones con más de 30 sucursales
  no van a tener cobertura completa en el buscador; es un límite
  aceptado, no un bug (`ponytail: pageSize 30 fijo, cambiar a q server-side
  si una org real supera esto`). Ningún resultado de empleado/sucursal
  linkea a una página de detalle porque esa página (detalle de empleado)
  todavía no existe — navega al listado.

---

## Task 1: `CommandPalette` (nuevo)

**Files:**
- Create: `src/components/CommandPalette.tsx`

**Interfaces:**
- Consumes: `useOrgActual`, `tieneModulo`, `tieneRol` (`src/lib/hooks.ts`);
  `useEmpleados` (`src/pages/empleados/hooks.ts`); `useSucursales`
  (`src/pages/sucursales/hooks.ts`); `cn` (`src/lib/utils.ts`); `type Modulo`
  (`src/lib/api.ts`); `useNavigate` (`react-router-dom`).
- Produces: `CommandPalette` (`{ open: boolean; onClose: () => void }`).
  Sin consumidor todavía — se monta en `PanelLayout.tsx` en el Task 3, que
  también es quien va a manejar el atajo de teclado global ⌘K (este
  componente solo escucha `Escape` para cerrarse a sí mismo, no ⌘K para
  abrirse).

- [ ] **Step 1: Crear `CommandPalette.tsx`**

```tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Home,
  ClipboardCheck,
  Users,
  Building2,
  Clock,
  CalendarDays,
  HeartHandshake,
  Settings,
  CreditCard,
  UserPlus,
  CalendarPlus,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useOrgActual, tieneModulo, tieneRol } from "../lib/hooks";
import { useEmpleados } from "../pages/empleados/hooks";
import { useSucursales } from "../pages/sucursales/hooks";
import { cn } from "../lib/utils";
import type { Modulo } from "../lib/api";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface ResultItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta?: string;
  onSelect: () => void;
}

interface ResultGroup {
  heading: string;
  items: ResultItem[];
}

interface PaginaItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  modulo?: Modulo;
  soloGestion?: boolean;
}

const PAGINAS: PaginaItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/asistencia", label: "Asistencia", icon: ClipboardCheck, modulo: "asistencia" },
  { href: "/empleados", label: "Empleados", icon: Users },
  { href: "/sucursales", label: "Sucursales", icon: Building2 },
  { href: "/horas", label: "Horas", icon: Clock, modulo: "horas", soloGestion: true },
  { href: "/turnos", label: "Turnos", icon: CalendarDays, modulo: "turnos", soloGestion: true },
  { href: "/rrhh", label: "RRHH", icon: HeartHandshake, modulo: "rrhh", soloGestion: true },
  { href: "/configuracion", label: "Configuración", icon: Settings },
  { href: "/plan", label: "Mi plan", icon: CreditCard },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: org } = useOrgActual();
  const ent = org?.entitlements ?? null;
  const { data: empleados = [] } = useEmpleados();
  // ponytail: pageSize 30 fijo (default del hook) — orgs con más de 30
  // sucursales no van a tener cobertura completa acá; pasar a q server-side
  // si algún cliente real llega a ese tamaño.
  const { data: sucursalesPage } = useSucursales();
  const sucursales = sucursalesPage?.data ?? [];

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function go(path: string) {
    onClose();
    navigate(path);
  }

  const q = query.trim().toLowerCase();
  const puedeGestionar = tieneRol(org ?? null, ["owner", "admin"]);

  const paginas: ResultItem[] = PAGINAS.filter((p) => {
    if (p.soloGestion && !puedeGestionar) return false;
    if (p.modulo && !tieneModulo(ent, p.modulo)) return false;
    return !q || p.label.toLowerCase().includes(q);
  }).map((p) => ({ key: `pagina-${p.href}`, icon: p.icon, label: p.label, onSelect: () => go(p.href) }));

  const accionesBase: ResultItem[] = [
    { key: "accion-empleado", icon: UserPlus, label: "Nuevo empleado", onSelect: () => go("/empleados") },
    { key: "accion-ausencia", icon: CalendarPlus, label: "Registrar ausencia", onSelect: () => go("/rrhh") },
    { key: "accion-rechazadas", icon: AlertTriangle, label: "Revisar marcas rechazadas", onSelect: () => go("/asistencia") },
  ];
  const acciones = puedeGestionar ? accionesBase.filter((a) => !q || a.label.toLowerCase().includes(q)) : [];

  const empleadosResultados: ResultItem[] = q
    ? empleados
        .filter((e) => `${e.nombre} ${e.apellido ?? ""}`.toLowerCase().includes(q))
        .slice(0, 6)
        .map((e) => ({
          key: `empleado-${e.id}`,
          icon: Users,
          label: `${e.nombre} ${e.apellido ?? ""}`.trim(),
          meta: "Ver en Empleados",
          onSelect: () => go("/empleados"),
        }))
    : [];

  const sucursalesResultados: ResultItem[] = q
    ? sucursales
        .filter((s) => s.nombre.toLowerCase().includes(q))
        .slice(0, 6)
        .map((s) => ({
          key: `sucursal-${s.id}`,
          icon: Building2,
          label: s.nombre,
          meta: "Ver en Sucursales",
          onSelect: () => go("/sucursales"),
        }))
    : [];

  const grupos: ResultGroup[] = [
    { heading: "Ir a", items: paginas },
    { heading: "Acciones", items: acciones },
    { heading: "Empleados", items: empleadosResultados },
    { heading: "Sucursales", items: sucursalesResultados },
  ].filter((g) => g.items.length > 0);

  const flat = grupos.flatMap((g) => g.items);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIndex]?.onSelect();
    }
  }

  if (!open) return null;

  let renderedIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-text/40 pt-[12vh] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[10px] border border-border bg-surface-raised shadow-[0_16px_48px_rgba(13,13,17,.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, empleados, sucursales…"
            className="w-full bg-transparent text-[14px] text-text placeholder:text-text-tertiary focus:outline-none"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {flat.length === 0 && (
            <p className="px-3 py-6 text-center text-[13.5px] text-text-tertiary">Sin resultados.</p>
          )}
          {grupos.map((group) => (
            <div key={group.heading} className="mb-1 last:mb-0">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                {group.heading}
              </p>
              {group.items.map((item) => {
                renderedIndex += 1;
                const isActive = renderedIndex === activeIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setActiveIndex(renderedIndex)}
                    onClick={item.onSelect}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13.5px]",
                      isActive ? "bg-accent-100 text-accent-800" : "text-text hover:bg-text/[.04]"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.meta && <span className="shrink-0 text-[11.5px] text-text-tertiary">{item.meta}</span>}
                    {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent-700" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores. `CommandPalette` queda sin consumidores hasta el
Task 3 de este mismo plan — esperable.

- [ ] **Step 3: Commit**

```bash
git add src/components/CommandPalette.tsx
git commit -m "feat: componente CommandPalette (⌘K) — navegación, acciones y búsqueda de empleados/sucursales"
```

---

## Task 2: `Sidebar.tsx` (R1 oscuro) + `AccountMenu.tsx` + `NotificationBell.tsx` (reposicionados)

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/AccountMenu.tsx`
- Modify: `src/components/NotificationBell.tsx`

**Interfaces:**
- `Sidebar` gana un prop nuevo **opcional** `onOpenSearch?: () => void`
  (además de los ya existentes `mobileOpen`/`onMobileClose`) — opcional a
  propósito: `PanelLayout.tsx` todavía no pasa este prop en este punto del
  plan (se conecta recién en el Task 3); si fuera obligatorio, el
  call-site viejo de `PanelLayout.tsx` (`<Sidebar mobileOpen={...}
  onMobileClose={...} />`, sin `onOpenSearch`) dejaría de compilar antes
  de que el Task 3 lo actualice. El botón de búsqueda llama
  `onOpenSearch?.()` — un no-op inerte hasta que el Task 3 lo conecte de
  verdad.
- `AccountMenu` gana un prop nuevo **opcional** `collapsed?: boolean`
  (default `false`) — opcional a propósito: `TopBar.tsx` todavía existe
  en este punto del plan (se borra en el Task 3) y sigue llamando
  `<AccountMenu />` sin props; si `collapsed` fuera obligatorio ese
  call-site dejaría de compilar antes de que el Task 3 lo actualice.
- `NotificationBell` no cambia de firma (sigue sin props).
- Nota de estado intermedio: entre este task y el Task 3, `AccountMenu` y
  `NotificationBell` van a estar montados **dos veces** (una vez en la
  topbar vieja, una vez en el pie del sidebar nuevo) — es transitorio y
  se resuelve al borrar `TopBar.tsx` en el Task 3. No es un bug de este
  task.

- [ ] **Step 1: Reemplazar `Sidebar.tsx` completo**

```tsx
// src/components/Sidebar.tsx
import * as React from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Search,
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
import { cn } from "../lib/utils";
import { useOrgActual, tieneModulo, tieneRol } from "../lib/hooks";
import { useHoverTooltip } from "./ui/tooltip";
import { NotificationBell } from "./NotificationBell";
import { AccountMenu } from "./AccountMenu";
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

export function Sidebar({
  mobileOpen,
  onMobileClose,
  onOpenSearch,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
  onOpenSearch?: () => void;
}) {
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

  const asideRef = React.useRef<HTMLElement>(null);
  const [togglePos, setTogglePos] = React.useState<{ left: number; top: number } | null>(null);

  React.useLayoutEffect(() => {
    function medir() {
      const el = asideRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTogglePos({ left: rect.right, top: rect.top });
    }
    medir();
    window.addEventListener("resize", medir);

    // El <aside> anima su ancho con transition-[width] (200ms) al
    // colapsar/expandir. Medir una sola vez acá (al toggle) deja al botón
    // con una posición vieja mientras el borde real sigue animando —
    // queda "flotando" separado del sidebar durante la transición. Se
    // sigue el borde cuadro a cuadro con rAF mientras dura la animación,
    // en vez de dejar que el botón interpole su `left` por su cuenta.
    let rafId: number;
    function seguirTransicion() {
      medir();
      rafId = requestAnimationFrame(seguirTransicion);
    }
    rafId = requestAnimationFrame(seguirTransicion);
    const timeoutId = window.setTimeout(() => cancelAnimationFrame(rafId), 250);

    return () => {
      window.removeEventListener("resize", medir);
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [collapsed]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}
      {/* Portaleado a document.body: escapa del stacking/overflow del layout
          (sidebar/main) por completo, en vez de pelear con sus z-index —
          el mismo problema que resuelve useHoverTooltip. */}
      {togglePos &&
        createPortal(
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            style={{ left: togglePos.left, top: togglePos.top }}
            className="fixed z-30 hidden h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-none hover:bg-text/[.04] md:flex"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>,
          document.body
        )}
      <aside
        ref={asideRef}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[220px] shrink-0 flex-col border-r border-white/5 bg-[#0d0d11] transition-transform duration-200 md:relative md:z-auto md:translate-x-0 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-16" : "md:w-[220px]"
        )}
      >
        <div className="flex items-center justify-end px-3 py-3 md:hidden">
          <button
            onClick={onMobileClose}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/[.06]"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className={cn("flex items-center gap-2.5 px-4 pb-4 pt-2", collapsed && "md:justify-center md:px-0")}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-accent">
            <Activity className="h-3.5 w-3.5 text-white" />
          </span>
          <div className={cn("min-w-0", collapsed && "md:hidden")}>
            <p className="truncate text-[14px] font-semibold leading-tight text-white">oliver</p>
            <p className="truncate text-[11.5px] leading-tight text-white/40">
              {isLoading ? "Cargando…" : (org?.name ?? "")}
            </p>
          </div>
        </div>

        <div className={cn("px-3 pb-3", collapsed && "md:px-2")}>
          <button
            type="button"
            onClick={() => onOpenSearch?.()}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-[8px] border border-white/10 bg-white/[.04] px-3 text-[13px] text-white/45 hover:bg-white/[.07] hover:text-white/70",
              collapsed && "md:w-9 md:justify-center md:px-0"
            )}
          >
            <Search className="h-[15px] w-[15px] shrink-0" />
            <span className={cn("flex-1 text-left", collapsed && "md:hidden")}>Buscar…</span>
            <span className={cn("font-mono text-[10.5px] text-white/30", collapsed && "md:hidden")}>⌘K</span>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1">
          {isLoading
            ? LINKS.map((item) => (
                <span
                  key={item.href}
                  className={cn("flex items-center gap-2.5 px-3 py-2.5", collapsed && "md:justify-center md:px-0")}
                >
                  <span className={cn("h-[13px] animate-pulse rounded-full bg-white/10", collapsed ? "w-6" : "w-24")} />
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

        <div className="border-t border-white/5 p-2">
          <div className={cn("flex items-center px-1 py-1", collapsed && "md:justify-center")}>
            <NotificationBell />
          </div>
          <SidebarFooterLink
            href="/configuracion"
            label="Configuración"
            icon={Settings}
            collapsed={collapsed}
            onClick={onMobileClose}
          />
          <SidebarFooterAnchor href="mailto:soporte@oliver.app" label="Soporte" icon={LifeBuoy} collapsed={collapsed} />
          <div className="mt-1.5 border-t border-white/5 pt-1.5">
            <AccountMenu collapsed={collapsed} />
          </div>
        </div>
      </aside>
    </>
  );
}

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
        {...triggerProps}
        to={href}
        onClick={onClick}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
            collapsed && "md:justify-center md:px-0",
            isActive ? "bg-white/[.08] text-white" : "text-white/45 hover:bg-white/[.04] hover:text-white/75"
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-accent")} />
            <span className={cn("flex-1", collapsed && "md:hidden")}>{label}</span>
            {isActive && !collapsed && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />}
          </>
        )}
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
        {...triggerProps}
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-white/45 hover:bg-white/[.04] hover:text-white/75",
          collapsed && "md:justify-center md:px-0"
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className={cn(collapsed && "md:hidden")}>{label}</span>
      </a>
      {collapsed && tooltipNode}
    </>
  );
}

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
          {...disabledTooltip.triggerProps}
          title={collapsed ? undefined : "Tu rol no tiene acceso a esta sección."}
          aria-disabled="true"
          className={cn(
            "flex cursor-not-allowed select-none items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-white/25",
            collapsed && "md:justify-center md:px-0"
          )}
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
          {...lockedTooltip.triggerProps}
          to="/plan"
          onClick={onClick}
          title={collapsed ? undefined : aviso}
          className={cn(
            "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-white/45 hover:bg-white/[.04] hover:text-white/75",
            collapsed && "md:justify-center md:px-0"
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className={cn("flex flex-1 items-center gap-1.5", collapsed && "md:hidden")}>
            {item.label}
            <span className="rounded-[6px] bg-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/60">
              {PLAN_NOMBRE[planReq]}
            </span>
          </span>
        </NavLink>
        {collapsed && lockedTooltip.tooltipNode}
      </>
    );
  }

  return (
    <>
      <NavLink
        {...normalTooltip.triggerProps}
        to={item.href}
        end
        onClick={onClick}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
            collapsed && "md:justify-center md:px-0",
            isActive ? "bg-white/[.08] text-white" : "text-white/45 hover:bg-white/[.04] hover:text-white/75"
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-accent")} />
            <span className={cn("flex-1", collapsed && "md:hidden")}>{item.label}</span>
            {isActive && !collapsed && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />}
          </>
        )}
      </NavLink>
      {collapsed && normalTooltip.tooltipNode}
    </>
  );
}
```

- [ ] **Step 2: Reemplazar `AccountMenu.tsx` completo**

```tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useOrgActual } from "../lib/hooks";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import type { OrgRole } from "../lib/api";

function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/);
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

const ROL_NOMBRE: Record<OrgRole, string> = {
  owner: "Dueño",
  admin: "Administrador",
  agent: "Operador",
};

export function AccountMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useAuth();
  const { data: org, isLoading } = useOrgActual();
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

  if (isLoading) {
    return <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/10" aria-hidden="true" />;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-1 py-1 hover:bg-white/[.06]",
          collapsed && "md:justify-center"
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">
          {org ? iniciales(org.name) : (user?.email?.slice(0, 2).toUpperCase() ?? "?")}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[12.5px] font-medium text-white">{org?.name ?? ""}</span>
            <span className="block truncate text-[11px] text-white/40">
              {org?.role ? ROL_NOMBRE[org.role] : user?.email}
            </span>
          </span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 w-[212px] rounded-[10px] border border-border bg-surface-raised p-1.5 shadow-[0_8px_24px_rgba(13,13,17,.1)]">
          <div className="mb-1 border-b border-border px-2.5 pb-2 pt-1">
            {org && <p className="m-0 text-[13.5px] font-bold text-text">{org.name}</p>}
            <p className="m-0 text-[12px] text-text-tertiary">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/plan");
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13.5px] font-medium text-text hover:bg-text/[.04]"
          >
            Mi plan
          </button>
          {org?.entitlements.ilimitado && (
            <button
              onClick={() => {
                setOpen(false);
                navigate("/admin");
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13.5px] font-medium text-text hover:bg-text/[.04]"
            >
              Panel admin
            </button>
          )}
          <button
            onClick={handleCerrarSesion}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13.5px] font-medium text-alert hover:bg-text/[.04]"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Reemplazar `NotificationBell.tsx` completo**

```tsx
import * as React from "react";
import { Bell } from "lucide-react";
import { cn } from "../lib/utils";

interface NotificacionMock {
  id: string;
  titulo: string;
  detalle: string;
  hace: string;
}

// Datos de ejemplo — todavía no hay backend de notificaciones.
// Cuando se implemente, esto se reemplaza por datos reales (fetch/realtime)
// y el estado de leídas pasa a persistirse server-side en vez de en memoria.
const NOTIFICACIONES_MOCK: NotificacionMock[] = [
  {
    id: "1",
    titulo: "Nuevo empleado agregado",
    detalle: "Juan Pérez fue agregado a Sucursal Centro.",
    hace: "hace 2 horas",
  },
  {
    id: "2",
    titulo: "Ausencia pendiente de aprobación",
    detalle: "María González solicitó una licencia.",
    hace: "hace 5 horas",
  },
  {
    id: "3",
    titulo: "Límite de plan cerca",
    detalle: "Estás usando 4 de 5 empleados en el plan Gratis.",
    hace: "ayer",
  },
];

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [leidas, setLeidas] = React.useState<Set<string>>(new Set());
  const ref = React.useRef<HTMLDivElement>(null);

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

  const noLeidas = NOTIFICACIONES_MOCK.filter((n) => !leidas.has(n.id));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[8px] text-white/45 transition-colors hover:bg-white/[.08] hover:text-white/80"
      >
        <Bell className="h-[18px] w-[18px]" />
        {noLeidas.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-alert" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 w-[320px] rounded-[10px] border border-border bg-surface-raised p-1.5 shadow-[0_8px_24px_rgba(13,13,17,.1)]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 pb-2 pt-1">
            <p className="m-0 text-[13.5px] font-bold text-text">Notificaciones</p>
            {noLeidas.length > 0 && (
              <button
                onClick={() => setLeidas(new Set(NOTIFICACIONES_MOCK.map((n) => n.id)))}
                className="cursor-pointer whitespace-nowrap text-[12px] font-medium text-accent-700 hover:underline"
              >
                Marcar todas como vistas
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5 pt-1">
            {NOTIFICACIONES_MOCK.map((n) => {
              const esNoLeida = !leidas.has(n.id);
              return (
                <div key={n.id} className={cn("flex gap-2.5 rounded-[8px] px-2.5 py-2", esNoLeida && "bg-accent-100/50")}>
                  <span
                    className={cn(
                      "mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full",
                      esNoLeida ? "bg-alert" : "bg-transparent"
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="m-0 text-[13px] font-semibold text-text">{n.titulo}</p>
                    <p className="m-0 text-[12.5px] text-text-secondary">{n.detalle}</p>
                    <p className="m-0 text-[11.5px] text-text-tertiary">{n.hace}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores. `TopBar.tsx` (sin cambios en este task) sigue
llamando `<AccountMenu />`/`<NotificationBell />` sin props — compila
igual porque `collapsed` es opcional y `NotificationBell` no cambió de
firma.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/AccountMenu.tsx src/components/NotificationBell.tsx
git commit -m "feat: sidebar oscura estilo R1 (header+búsqueda+nav+pie) con AccountMenu/NotificationBell reposicionados"
```

---

## Task 3: `PanelLayout.tsx` + `MobileHeader.tsx` (nuevo) + borrado de `TopBar.tsx`

**Files:**
- Modify: `src/components/PanelLayout.tsx`
- Create: `src/components/MobileHeader.tsx`
- Delete: `src/components/TopBar.tsx`

**Interfaces:**
- Consumes: `Sidebar` (Task 2, acepta `onOpenSearch` opcional — este task
  es quien lo conecta de verdad por primera vez),
  `CommandPalette` (Task 1), `useOrgActual` (`src/lib/hooks.ts`).
- `PanelLayout` mantiene su firma pública (`{ children }: { children:
  ReactNode }`) — nada de lo que la consume en `src/App.tsx` (11 rutas)
  necesita cambiar.
- `MobileHeader` (`{ onMenuClick: () => void; onSearchClick: () => void
  }`) — solo lo consume `PanelLayout`.

- [ ] **Step 1: Crear `MobileHeader.tsx`**

```tsx
import { Menu, Search } from "lucide-react";
import { useOrgActual } from "../lib/hooks";

export function MobileHeader({
  onMenuClick,
  onSearchClick,
}: {
  onMenuClick: () => void;
  onSearchClick: () => void;
}) {
  const { data: org } = useOrgActual();
  return (
    <header className="flex items-center gap-3 border-b border-border-soft bg-surface-raised px-4 py-3 md:hidden">
      <button
        onClick={onMenuClick}
        aria-label="Abrir menú"
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-secondary hover:bg-text/[.04]"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>
      <span className="flex-1 truncate text-[14px] font-semibold text-text">{org?.name ?? "oliver"}</span>
      <button
        onClick={onSearchClick}
        aria-label="Buscar"
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-secondary hover:bg-text/[.04]"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>
    </header>
  );
}
```

- [ ] **Step 2: Reemplazar `PanelLayout.tsx` completo**

```tsx
import { useEffect, useState, type ReactNode } from "react";
import { MobileHeader } from "./MobileHeader";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

export function PanelLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onOpenSearch={() => setPaletteOpen(true)}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <MobileHeader onMenuClick={() => setMobileOpen(true)} onSearchClick={() => setPaletteOpen(true)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-10">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 3: Borrar `TopBar.tsx`**

```bash
rm src/components/TopBar.tsx
```

- [ ] **Step 4: Verificar que no queda ninguna referencia a `TopBar`**

```bash
grep -rn "TopBar" src
```

Esperado: sin salida (sin matches).

- [ ] **Step 5: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A src/components/PanelLayout.tsx src/components/MobileHeader.tsx src/components/TopBar.tsx
git commit -m "feat: PanelLayout sin topbar — sidebar+contenido, header mobile nuevo, Command Palette montado con atajo ⌘K"
```

---

## Al terminar esta etapa

Con esto queda cerrada la Etapa 2 (Layout global). La Etapa 3 (Dashboard
+ Asistencia) se planifica en su propio documento una vez revisada esta,
mismo patrón que la Etapa 1.
