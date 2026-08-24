# Sidebar de navegación colapsable — diseño

## Contexto

Hoy la navegación (`src/components/PanelNav.tsx`) es un navbar horizontal
sticky: logo a la izquierda, links de módulos en el centro/derecha,
`AccountMenu` (avatar con dropdown: Mi plan, Configuración, Panel admin,
Cerrar sesión) y un botón hamburguesa que despliega los links en un panel
vertical en mobile.

El pedido: reemplazar los links horizontales por un sidebar vertical
colapsable a la izquierda. La topbar se achica y conserva solo logo,
una campanita de notificaciones (nueva, placeholder en este spec) y el
`AccountMenu`. El sidebar tiene, siempre visibles en su pie, un acceso a
Configuración y un botón de Soporte.

Este spec es el primero de tres features relacionadas (sidebar →
notificaciones → paginación, decididas en orden con el usuario). Acá solo
se cubre el sidebar; la campanita queda como ícono sin dropdown ni datos,
para no rehacer el layout de la topbar cuando se diseñe notificaciones.

## Alcance

**Repo frontend** (`proyecto-oliver`) únicamente. Sin cambios de backend,
DB ni endpoints — es una reestructuración de layout y componentes React.

## Layout

`PanelLayout.tsx` deja de ser `<PanelNav /> + <main>` y pasa a ser un
app-shell de dos niveles:

```
<div class="flex h-screen flex-col">
  <TopBar />                          <!-- fila fija arriba, todo el ancho -->
  <div class="flex flex-1 overflow-hidden">
    <Sidebar />                       <!-- columna fija a la izquierda -->
    <main class="flex-1 overflow-y-auto">{children}</main>
  </div>
</div>
```

- `TopBar` es sticky/fija arriba, ocupa el ancho completo. Contenido: logo
  (izquierda), y a la derecha `NotificationBell` + `AccountMenu`. En mobile
  agrega el botón hamburguesa que abre el sidebar como drawer.
- `Sidebar` es una columna fija de alto completo (debajo de la topbar),
  con tres zonas verticales: header (botón colapsar/expandir), body
  (scrolleable si los links no entran — hoy no pasa, pero no hay que
  asumirlo), y footer fijo (no scrollea) con Configuración y Soporte.
- En desktop (`md:` en adelante, mismo breakpoint que usa `PanelNav` hoy)
  el sidebar es parte del layout (ancho variable, ver Colapso). En mobile
  el sidebar vive fuera del flujo normal: oculto por defecto, se abre como
  overlay a pantalla completa sobre el contenido al tocar la hamburguesa,
  con el mismo patrón de click-afuera/Escape-para-cerrar que ya usa
  `PanelNav.tsx:62-76`.

## Colapso (icon-rail)

Dos estados en desktop, alternados con un botón en el header del sidebar:

- **Expandido** (~220px): ícono + label por cada link, footer con
  ícono + label en Configuración/Soporte.
- **Colapsado** (~64px): solo íconos, centrados. Cada ícono muestra un
  tooltip con el label al hacer hover/focus, apareciendo a la
  **derecha** del ícono (no arriba/abajo, para no toparse con los ícones
  vecinos en una columna angosta).

En mobile no hay colapso — el drawer, cuando está abierto, siempre
muestra la versión expandida (con label); cuando está cerrado, no ocupa
espacio.

**Persistencia:** el estado colapsado/expandido se guarda en
`localStorage` (clave propia, ej. `oliver:sidebar-collapsed`), leído en
el primer render con fallback a expandido si no hay valor guardado. No
se persiste en backend — es una preferencia de navegador, no de cuenta.

## Componentes

- **`Sidebar.tsx`** (nuevo): contiene la lista de nav items, reemplaza el
  rol que hoy cumple `LINKS`/`NavLinkItem` dentro de `PanelNav.tsx`. La
  lógica de gating se reutiliza tal cual (`tieneModulo`, `tieneRol`,
  bloqueo con badge de plan requerido, link a `/plan`) — solo cambia el
  layout de cada item (vertical, con ícono) y se le suma el estado
  colapsado. Un ícono `lucide-react` por sección:
  - Inicio → `Home`
  - Asistencia → `ClipboardCheck`
  - Empleados → `Users`
  - Sucursales → `Building2`
  - Horas → `Clock`
  - Turnos → `CalendarDays`
  - RRHH → `HeartHandshake`

  Footer fijo con dos items siempre visibles (no gateados por plan/rol):
  - **Configuración** → navega a `/configuracion` (ícono `Settings`).
  - **Soporte** → `<a href="mailto:soporte@oliver.app">` (ícono
    `LifeBuoy`), mismo patrón que ya existe en
    `src/pages/plan/PlanPage.tsx:88`.

- **`TopBar.tsx`** (nuevo, reemplaza el `<nav>` actual de
  `PanelNav.tsx`): logo, `NotificationBell`, `AccountMenu`, hamburguesa
  mobile que controla el estado de apertura del drawer del `Sidebar`
  (state levantado a `PanelLayout` o compartido vía un hook simple, ya
  que tanto `TopBar` como `Sidebar` lo necesitan).

- **`NotificationBell.tsx`** (nuevo): botón ícono (`Bell` de
  lucide-react) sin dropdown ni contador todavía — placeholder visual
  puro. Se completa en el spec de notificaciones (próxima feature).

- **`AccountMenu.tsx`** (existente, editado): se elimina el botón
  "Configuración" del dropdown (ahora vive fijo en el sidebar). Queda:
  Mi plan, Panel admin (si superadmin), Cerrar sesión.

- **`IconButton` (`src/components/ui/icon-button.tsx`)** (existente,
  editado): hoy solo posiciona el tooltip arriba/abajo del trigger
  (`placeAbove`, línea 50). Se le agrega un prop opcional `side?: "top" |
  "right"` (default `"top"`, sin romper los usos actuales) para que el
  rail colapsado pueda pedir tooltip a la derecha sin duplicar la lógica
  de posicionamiento con portal que ya tiene.

- **`PanelNav.tsx`**: se elimina — su lógica se reparte entre `Sidebar.tsx`
  (links + gating) y `TopBar.tsx` (logo, avatar, hamburguesa mobile).

## Responsive

Mismo breakpoint `md:` (768px) que usa hoy `PanelNav.tsx`. Por debajo:
topbar se ve igual (logo, campanita, avatar, + hamburguesa), sidebar
pasa a ser el drawer descripto arriba. Por encima: layout de dos
columnas con colapso icon-rail.

## Fuera de alcance (a propósito)

- Contenido real de la campanita (lista de notificaciones, contador,
  marcar como leído) — spec aparte.
- Cualquier cambio de paginación en las tablas de cada módulo — spec
  aparte.
- Persistencia del colapso entre dispositivos (queda en localStorage).

## Testing

Manual en navegador (no hay lógica de negocio nueva, es layout/UI):
- Expandir/colapsar el sidebar en desktop, verificar que los tooltips
  del rail colapsado aparecen a la derecha y no se recortan cerca de los
  bordes de la ventana.
- Recargar la página y confirmar que el estado colapsado/expandido
  persiste (localStorage).
- Abrir/cerrar el drawer en mobile, click afuera y Escape lo cierran.
- Confirmar que el gating de módulos/roles se ve igual que hoy (badge de
  plan requerido, link a `/plan`, ítems deshabilitados por rol) tanto
  expandido como colapsado (tooltip debe mostrar el aviso de plan/rol,
  no solo el label).
- Configuración y Soporte visibles y funcionales en ambos estados de
  colapso y en el drawer mobile.
- Verificar con las 4 cuentas de prueba (gratis/básico/pro/superadmin)
  que el gating sigue siendo correcto tras el refactor.
