# Rediseño de shell: Sidebar claro + Topbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el sidebar oscuro (identidad R1 original) por un sidebar
claro integrado visualmente con el fondo de la app, y reintroducir un
topbar persistente con título de página, búsqueda, notificaciones y menú
de usuario — revirtiendo deliberadamente la decisión de Etapa 2 de sacar
el TopBar, a pedido explícito del usuario con una referencia visual nueva
("Elera", dos capturas de un dashboard SaaS de salud).

**Architecture:** Tres tasks. (1) `Sidebar.tsx` se reescribe por completo
manteniendo el 100% de su lógica (colapso, drawer mobile, gating por plan/
rol, tooltips) — solo cambia la paleta de oscuro a claro, y se le saca la
búsqueda/notificaciones/cuenta de adentro (se van al topbar). También
exporta un helper `tituloDeRuta` que el topbar usa para saber qué título
mostrar según la ruta actual. (2) `AccountMenu.tsx`/`NotificationBell.tsx`
se adaptan de gatillo-de-sidebar-oscuro a gatillo-de-topbar-claro (su
popover ya es claro, no cambia — solo el botón que lo abre y hacia dónde
se abre el popover). (3) `Topbar.tsx` nuevo + `PanelLayout.tsx`
reestructurado + se retira `MobileHeader.tsx` (su función queda absorbida
por el topbar unificado).

**Tech Stack:** Sin dependencias nuevas. Reusa tokens existentes
(`--color-bg`, `--color-accent`, `--color-border-soft`, escala de radius),
`react-router-dom` (`useLocation`, `NavLink`), `lucide-react`.

**Spec:** No hay spec previa para este cambio — es una decisión tomada en
conversación directa con el usuario (capturas de referencia "Elera" +
lista de requerimientos), documentada acá como el registro de esa
decisión. La spec original del rediseño R1/R3
(`docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md`) pedía lo
opuesto (sidebar oscuro R1, sin topbar) — este plan reemplaza esa parte
puntual de la spec, el resto de la spec (Toolbar/tablas/etc. de cada
página) sigue vigente sin cambios.

## Global Constraints

- **Sin cambios de rutas, de lógica de negocio ni de hooks de datos** — es
  puramente shell visual.
- **Se preserva toda la funcionalidad existente del sidebar**: colapso en
  desktop (con persistencia en `localStorage`), drawer en mobile (abre/
  cierra, cierra con Escape, overlay), gating por plan (ícono `Lock` +
  tooltip) y por rol (`soloGestion`, texto disabled), tooltips al pasar el
  mouse cuando está colapsado, indicador de item activo, tooltip del botón
  de colapsar/expandir posicionado con portal (ese mecanismo no se toca).
- **Búsqueda, notificaciones y menú de usuario conservan su funcionalidad
  actual** — Command Palette (⌘K) sigue siendo el mecanismo real de
  búsqueda (no se reimplementa), `NotificationBell` sigue usando los
  mismos datos mock documentados con su propio comentario explicando que
  no hay backend de notificaciones todavía, `AccountMenu` conserva
  exactamente las mismas 3 opciones (Mi plan, Panel admin si
  `ilimitado`, Cerrar sesión).
- **Sin agrupar la navegación en secciones** — el pedido original mencionaba
  "navegación organizada por grupos", pero la lista actual son 7 items
  planos (Inicio, Asistencia, Empleados, Sucursales, Horas, Turnos, RRHH):
  agruparlos en secciones inventadas no aporta nada a esa escala y es la
  clase de estructura que sí tiene sentido en la referencia (que muestra
  12+ items) pero no acá — decisión de alcance, no un olvido.
- **Responsive sin overflow horizontal**, funcional desde 320px — el
  topbar reduce/oculta elementos (texto de "Buscar…"/"⌘K", subtítulo de
  organización) en pantallas chicas en vez de desbordar.
- **Accesibilidad preservada**: landmarks (`<aside>`, `<nav>`, nuevo
  `<header>` para el topbar, `<main>` ya existente en `PanelLayout`),
  `NavLink` sigue seteando `aria-current="page"` automáticamente (no
  requiere cambio), `aria-label` en todos los botones de solo-ícono
  (colapsar sidebar, cerrar drawer, abrir menú mobile, buscar,
  notificaciones), foco visible ya cubierto por el token global
  `:focus-visible` de `index.css` (no se toca).
- **Sin tests automatizados de UI** — verificación es `npm run build`.

---

## Task 1: `Sidebar.tsx` — de oscuro a claro, sin búsqueda/notificaciones/cuenta adentro

**Files:**
- Modify: `src/components/Sidebar.tsx` (reemplazo completo del archivo)

**Interfaces:**
- Produces: `export function tituloDeRuta(pathname: string): string` — nueva
  exportación que el Task 3 (`Topbar.tsx`) consume para mostrar el título
  de la sección actual. Hace *prefix-match* contra `LINKS` (para que rutas
  como `/empleados/:id` resuelvan a "Empleados") más un mapa chico de
  rutas fuera de `LINKS` (`/configuracion`, `/plan`, `/admin`).
- `Sidebar` pierde la prop `onOpenSearch` (ya no tiene gatillo de búsqueda
  adentro) — `PanelLayout` (Task 3) deja de pasarla.
- Sigue exportando `export function Sidebar({ mobileOpen, onMobileClose })`.

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
// src/components/Sidebar.tsx
import * as React from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Home,
  ClipboardCheck,
  Users,
  Building2,
  Clock,
  CalendarDays,
  HeartHandshake,
  Settings,
  LifeBuoy,
  Lock,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
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

const EXTRA_TITULOS: Record<string, string> = {
  "/configuracion": "Configuración",
  "/plan": "Mi plan",
  "/admin": "Administración",
};

/** Título de sección para el topbar, a partir de la ruta actual. */
export function tituloDeRuta(pathname: string): string {
  if (EXTRA_TITULOS[pathname]) return EXTRA_TITULOS[pathname];
  const item = [...LINKS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((l) => pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`)));
  return item?.label ?? "oliver";
}

const STORAGE_KEY = "oliver:sidebar-collapsed";

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
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
      setTogglePos({ left: rect.right, top: rect.top + 72 });
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
          "fixed inset-y-0 left-0 z-40 flex w-[220px] shrink-0 flex-col border-r border-border-soft bg-bg transition-transform duration-200 md:relative md:z-auto md:translate-x-0 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-16" : "md:w-[220px]"
        )}
      >
        <div className="flex items-center justify-end px-3 py-3 md:hidden">
          <button
            onClick={onMobileClose}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-text-secondary hover:bg-text/[.04]"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className={cn("flex items-center gap-2.5 px-4 pb-4 pt-2", collapsed && "md:justify-center md:px-0")}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-accent">
            <Activity className="h-3.5 w-3.5 text-white" />
          </span>
          <div className={cn("min-w-0", collapsed && "md:hidden")}>
            <p className="truncate text-[14px] font-semibold leading-tight text-text">oliver</p>
            <p className="truncate text-[11.5px] leading-tight text-text-tertiary">
              {isLoading ? "Cargando…" : (org?.name ?? "")}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1">
          {isLoading
            ? LINKS.map((item) => (
                <span
                  key={item.href}
                  className={cn("flex items-center gap-2.5 px-3 py-2.5", collapsed && "md:justify-center md:px-0")}
                >
                  <span className={cn("h-[13px] animate-pulse rounded-full bg-text/10", collapsed ? "w-6" : "w-24")} />
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
          <SidebarFooterLink
            href="/configuracion"
            label="Configuración"
            icon={Settings}
            collapsed={collapsed}
            onClick={onMobileClose}
          />
          <SidebarFooterAnchor href="mailto:soporte@oliver.app" label="Soporte" icon={LifeBuoy} collapsed={collapsed} />
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
            isActive ? "bg-accent-100 text-accent-800" : "text-text-secondary hover:bg-text/[.04] hover:text-text"
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-accent")} />
            <span className={cn("flex-1", collapsed && "md:hidden")}>{label}</span>
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
          "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-text/[.04] hover:text-text",
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
            "flex cursor-not-allowed select-none items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-text-muted",
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
            "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-text/[.04] hover:text-text",
            collapsed && "md:justify-center md:px-0"
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className={cn("flex flex-1 items-center gap-1.5", collapsed && "md:hidden")}>
            {item.label}
            <span className="flex items-center gap-1 rounded-[6px] bg-text/[.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary">
              <Lock className="h-2.5 w-2.5" />
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
            isActive ? "bg-accent-100 text-accent-800" : "text-text-secondary hover:bg-text/[.04] hover:text-text"
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-accent")} />
            <span className={cn("flex-1", collapsed && "md:hidden")}>{label}</span>
          </>
        )}
      </NavLink>
      {collapsed && normalTooltip.tooltipNode}
    </>
  );
}
```

Nota sobre el punto verde/dot de estado activo que existía en la versión
oscura (`isActive && !collapsed && <span className="h-[6px] w-[6px] ... bg-accent" />`):
se elimina — con la pastilla `bg-accent-100` de fondo ya queda clarísimo
cuál es el item activo (es redundante tenerlo dos veces, y en la versión
clara un punto de acento al lado de una pastilla ya acentuada es ruido
visual, no señal).

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: **falla** — `PanelLayout.tsx` todavía pasa `onOpenSearch` a
`Sidebar` (prop que ya no existe) y todavía importa `MobileHeader`. Eso lo
arregla el Task 3. Confirmar que el único error es justamente ese (prop
`onOpenSearch` no reconocida en `Sidebar`), no otra cosa — si aparece
cualquier otro error, es un problema real de este Step 1 y hay que
corregirlo acá antes de seguir.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: sidebar claro integrado al fondo, sin busqueda/notificaciones/cuenta adentro"
```

(El build sigue roto a propósito hasta el Task 3 — es esperado, cada task
de este plan es un paso intermedio del mismo cambio de shell, se revisa
en conjunto al final como viene pasando en las etapas anteriores.)

---

## Task 2: `AccountMenu.tsx` / `NotificationBell.tsx` — de gatillo de sidebar oscuro a gatillo de topbar claro

**Files:**
- Modify: `src/components/AccountMenu.tsx`
- Modify: `src/components/NotificationBell.tsx`

**Interfaces:**
- `AccountMenu` pierde la prop `collapsed` (ya no vive en un sidebar
  colapsable, vive en un topbar de altura fija) — pasa a ser
  `export function AccountMenu()` sin props. `Topbar.tsx` (Task 3) lo
  monta como `<AccountMenu />`.
- `NotificationBell` no cambia su firma (`export function NotificationBell()`,
  sin props) — solo su estilo interno.
- Ambos popovers pasan de abrirse hacia arriba-izquierda (apropiado para
  un trigger al pie de un sidebar) a abrirse hacia abajo-derecha
  (apropiado para un trigger en la esquina superior derecha de un
  topbar).

- [ ] **Step 1: `AccountMenu.tsx` — trigger compacto, sin texto de org/rol, popover hacia abajo-derecha**

Buscar:

```tsx
export function AccountMenu({ collapsed = false }: { collapsed?: boolean }) {
```

Reemplazar por:

```tsx
export function AccountMenu() {
```

Buscar:

```tsx
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
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-[212px] rounded-[10px] border border-border bg-surface-raised p-1.5 shadow-[0_8px_24px_rgba(13,13,17,.1)]">
```

Reemplazar por:

```tsx
  if (isLoading) {
    return <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-text/10" aria-hidden="true" />;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta"
        className="flex shrink-0 cursor-pointer items-center rounded-full hover:opacity-85"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">
          {org ? iniciales(org.name) : (user?.email?.slice(0, 2).toUpperCase() ?? "?")}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[212px] rounded-[10px] border border-border bg-surface-raised p-1.5 shadow-[0_8px_24px_rgba(13,13,17,.1)]">
```

`cn` import queda sin uso tras este cambio (era solo para el `collapsed &&`
condicional que se eliminó) — sacarlo del import de `../lib/utils` si el
build lo marca como no usado.

- [ ] **Step 2: `NotificationBell.tsx` — trigger claro, popover hacia abajo-derecha**

Buscar:

```tsx
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[8px] text-white/45 transition-colors hover:bg-white/[.04] hover:text-white/80"
      >
        <Bell className="h-[18px] w-[18px]" />
        {noLeidas.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-alert" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-[320px] rounded-[10px] border border-border bg-surface-raised p-1.5 shadow-[0_8px_24px_rgba(13,13,17,.1)]">
```

Reemplazar por:

```tsx
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[8px] text-text-secondary transition-colors hover:bg-text/[.04] hover:text-text"
      >
        <Bell className="h-[18px] w-[18px]" />
        {noLeidas.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-alert" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[320px] rounded-[10px] border border-border bg-surface-raised p-1.5 shadow-[0_8px_24px_rgba(13,13,17,.1)]">
```

- [ ] **Step 3: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sigue fallando por lo mismo del Task 1 (`PanelLayout.tsx`
todavía no actualizado) — confirmar que no aparece ningún error nuevo
relacionado a estos dos archivos (en particular, que `cn` no haya quedado
como import sin usar en `AccountMenu.tsx` — si el build lo marca,
sacarlo).

- [ ] **Step 4: Commit**

```bash
git add src/components/AccountMenu.tsx src/components/NotificationBell.tsx
git commit -m "feat: AccountMenu y NotificationBell como gatillos de topbar (popover hacia abajo-derecha)"
```

---

## Task 3: `Topbar.tsx` nuevo + `PanelLayout.tsx` reestructurado + retiro de `MobileHeader.tsx`

**Files:**
- Create: `src/components/Topbar.tsx`
- Modify: `src/components/PanelLayout.tsx`
- Delete: `src/components/MobileHeader.tsx`

**Interfaces:**
- Consumes: `tituloDeRuta` (Task 1, exportado desde `Sidebar.tsx`),
  `AccountMenu`/`NotificationBell` (Task 2, ya sin props).
- Produces: `export function Topbar({ onMenuClick, onOpenSearch }: { onMenuClick: () => void; onOpenSearch: () => void })`.

- [ ] **Step 1: Crear `src/components/Topbar.tsx`**

```tsx
import { Menu, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useOrgActual } from "../lib/hooks";
import { NotificationBell } from "./NotificationBell";
import { AccountMenu } from "./AccountMenu";
import { tituloDeRuta } from "./Sidebar";

export function Topbar({
  onMenuClick,
  onOpenSearch,
}: {
  onMenuClick: () => void;
  onOpenSearch: () => void;
}) {
  const location = useLocation();
  const { data: org } = useOrgActual();
  const titulo = tituloDeRuta(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border-soft bg-bg px-4 md:px-8">
      <button
        onClick={onMenuClick}
        aria-label="Abrir menú"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-text-secondary hover:bg-text/[.04] md:hidden"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight text-text">{titulo}</p>
        <p className="hidden truncate text-[11.5px] leading-tight text-text-tertiary sm:block">{org?.name ?? ""}</p>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Buscar"
        className="flex h-8 shrink-0 items-center gap-2 rounded-[8px] border border-border bg-surface-raised px-3 text-[13px] text-text-tertiary hover:bg-surface hover:text-text-secondary"
      >
        <Search className="h-[15px] w-[15px] shrink-0" />
        <span className="hidden sm:inline">Buscar…</span>
        <span className="hidden font-mono text-[10.5px] text-text-muted sm:inline">⌘K</span>
      </button>

      <NotificationBell />
      <AccountMenu />
    </header>
  );
}
```

- [ ] **Step 2: Reemplazar `PanelLayout.tsx` completo**

```tsx
import { useEffect, useState, type ReactNode } from "react";
import { Topbar } from "./Topbar";
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
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} onOpenSearch={() => setPaletteOpen(true)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-10">{children}</div>
        </main>
      </div>
      {paletteOpen && <CommandPalette open onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 3: Borrar `MobileHeader.tsx`**

```bash
git rm src/components/MobileHeader.tsx
```

- [ ] **Step 4: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores — esto cierra el build roto a propósito desde el
Task 1.

- [ ] **Step 5: Commit**

```bash
git add src/components/Topbar.tsx src/components/PanelLayout.tsx
git commit -m "feat: topbar persistente reemplaza MobileHeader, shell final (sidebar claro + topbar)"
```

---

## Al terminar

Con esto el shell queda: sidebar claro integrado al fondo (`--color-bg`),
sin búsqueda/notificaciones/cuenta adentro; topbar sticky con título de
sección, búsqueda (abre el Command Palette existente), notificaciones y
cuenta. Ninguna ruta, hook de datos ni lógica de negocio cambió.

La próxima etapa (fidelidad de componentes — Toolbar compacto, densidad
de tabla, Avatar/PersonCell, Badge de tono, hover en acciones de fila,
contadores en Tabs) se planifica después de revisar este shell, para que
esos ajustes se verifiquen contra la base visual final y no contra la que
se está reemplazando acá.
