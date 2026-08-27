# Rediseño R1/R3 — Fidelidad del Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajustar `Sidebar.tsx` para que sea más fiel a la referencia
visual ("Elera") que el usuario ya usó para la etapa de shell — pidió
puntualmente más fidelidad en 4 cosas: colores del estado activo, el
ícono de marca de arriba, el botón y la posición de colapsar/expandir, y
tipografía puntual del sidebar (confirmado con el usuario: la fuente
global `Archivo` NO cambia, solo ajustes locales si hacen falta).

**Architecture:** Un solo task — todos los cambios viven en el mismo
bloque de encabezado de `Sidebar.tsx` y en el color del estado activo de
los links, así que separarlos en tasks distintos sería artificial. El
cambio más grande es estructural: el botón de colapsar deja de ser un
botón flotante posicionado por portal + `requestAnimationFrame` (mecanismo
que existía solo porque el botón vivía *fuera* del `<aside>`) y pasa a
vivir *adentro* de la fila del encabezado — eso elimina por completo ese
mecanismo de tracking, no lo reemplaza por otro.

**Tech Stack:** Sin dependencias nuevas — `PanelLeft` ya existe en
`lucide-react` (ya instalado).

**Spec:** Nace de una comparación directa del usuario contra la misma
referencia "Elera" ya usada en la etapa de shell
(`docs/superpowers/plans/2026-08-27-rediseno-r1-r3-shell-sidebar-topbar.md`) —
esta vez señalando específicamente el sidebar, no el shell completo.

## Global Constraints

- **Sin cambios de rutas, lógica de negocio ni hooks de datos.**
- **Se preserva toda la funcionalidad existente**: colapso persistente en
  `localStorage`, drawer mobile (abre/cierra, Escape, overlay), gating por
  plan (`Lock` + tooltip) y por rol (`soloGestion`), tooltips al pasar el
  mouse cuando está colapsado, `aria-current` automático de `NavLink`.
- **No se cambia la fuente global** (`--font-sans: "Archivo"` en
  `src/index.css`) — confirmado explícitamente con el usuario. Este plan
  no la toca.
- **No se agrega un dropdown de organizaciones** — la referencia muestra
  un chevron junto al nombre que sugiere un selector de org, pero esta
  app no tiene esa funcionalidad (una sola organización por sesión);
  agregar un chevron no funcional sería una afordancia falsa. Se omite a
  propósito, no es un olvido.
- **No se agrupa la navegación en secciones** — mismo criterio ya
  documentado en el plan de shell: la lista de 7 items es corta y ya
  escaneable, agruparla en secciones falsas no aporta a esta escala.
- **Sin tests automatizados de UI** — verificación es `npm run build`.

---

## Task 1: `Sidebar.tsx` — encabezado con botón de colapsar inline, logo oscuro, pastilla activa sólida

**Files:**
- Modify: `src/components/Sidebar.tsx` (reemplazo completo del archivo)

**Interfaces:**
- `export function Sidebar({ mobileOpen, onMobileClose })` — firma sin
  cambios.
- `export function tituloDeRuta(pathname: string): string` — sin
  cambios, sigue siendo consumida por `Topbar.tsx` (no se toca en este
  plan).

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
// src/components/Sidebar.tsx
import * as React from "react";
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
  PanelLeft,
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
  const extraKey = Object.keys(EXTRA_TITULOS).find(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
  if (extraKey) return EXTRA_TITULOS[extraKey];
  const item = LINKS.find(
    (l) => pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`))
  );
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

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}
      <aside
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

        <div
          className={cn(
            "flex items-center gap-2.5 px-4 pb-4 pt-3",
            collapsed && "md:flex-col md:gap-2 md:px-2"
          )}
        >
          <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", collapsed && "md:flex-none md:justify-center")}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-text">
              <Activity className="h-3.5 w-3.5 text-white" />
            </span>
            <p className={cn("truncate text-[14px] font-semibold leading-tight text-text", collapsed && "md:hidden")}>
              oliver
            </p>
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-text-tertiary hover:bg-text/[.06] hover:text-text-secondary md:flex"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
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
            isActive ? "bg-accent text-white" : "text-text-secondary hover:bg-text/[.04] hover:text-text"
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-white")} />
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
            isActive ? "bg-accent text-white" : "text-text-secondary hover:bg-text/[.04] hover:text-text"
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-white")} />
            <span className={cn("flex-1", collapsed && "md:hidden")}>{item.label}</span>
          </>
        )}
      </NavLink>
      {collapsed && normalTooltip.tooltipNode}
    </>
  );
}
```

**Resumen de lo que cambió respecto al archivo actual** (para que el
implementer entienda la intención, no solo copie):

1. **Botón de colapsar**: se sacó por completo el mecanismo de
   `createPortal` + `asideRef` + `togglePos` + el `useLayoutEffect` con
   `requestAnimationFrame` que perseguía el borde del `<aside>` durante
   la animación de ancho. Ese mecanismo solo existía porque el botón
   vivía *fuera* del sidebar (para no quedar cortado por su
   `overflow`). Ahora el botón vive *adentro* del encabezado, así que no
   hace falta perseguir nada — se simplifica solo. Nuevo ícono:
   `PanelLeft` de `lucide-react` (ya no hace falta togglear entre
   `ChevronLeft`/`ChevronRight`, un solo ícono estático alcanza).
2. **Logo**: el contenedor pasa de `bg-accent` (verde, color de marca) a
   `bg-text` (el `#0d0d11` casi negro) — en la referencia el acento se
   reserva para el estado activo de la navegación, no para elementos
   decorativos.
3. **Pastilla activa**: pasa de `bg-accent-100 text-accent-800` (verde
   pálido) a `bg-accent text-white` (verde sólido, texto blanco) — tanto
   en `SidebarNavLink` como en `SidebarFooterLink`. El ícono activo
   también pasa de `text-accent` a `text-white` (si seguía siendo verde
   sobre un fondo ahora también verde, sería invisible). Se saca el
   puntito verde (`<span className="h-[6px] w-[6px] ... bg-accent" />`)
   que marcaba el activo en la versión vieja — ya no hace falta, la
   pastilla sólida es señal de sobra y el puntito quedaría como ruido
   visual duplicado.
4. **Subtítulo de organización**: se saca del encabezado (antes aparecía
   como una segunda línea bajo "oliver"). Ya se ve en el subtítulo del
   Topbar y en el header del popover de `AccountMenu` — mantenerlo acá
   también era redundante, y la referencia no lo muestra en esta
   posición.
5. **Sin chevron de organizaciones**: la referencia tiene uno junto al
   nombre (sugiere un selector de org) — se omite a propósito, ver
   Global Constraints.
6. **Tipografía**: no se tocó ningún tamaño/peso de fuente en este
   reemplazo — la referencia y el sidebar actual ya están razonablemente
   cerca (`text-[14px] font-medium` en los links, `text-[14px]
   font-semibold` en "oliver"); si tras ver el resultado hace falta un
   ajuste puntual, es un cambio de una sola clase, no ameritó su propio
   diff acá.

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: sidebar mas fiel a la referencia (boton de colapsar inline, logo oscuro, pastilla activa solida)"
```

---

## Al terminar

Con esto el sidebar queda alineado con la referencia en los 4 puntos que
pidió el usuario. El resto del shell (Topbar, AccountMenu,
NotificationBell) no se toca en este plan — ya se ajustaron en la etapa
de shell anterior y no fueron parte de este pedido puntual.
