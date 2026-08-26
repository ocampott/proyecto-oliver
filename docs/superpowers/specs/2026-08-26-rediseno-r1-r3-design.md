# Rediseño visual y de UX del panel — combinando R1 (Figma Make) y R3 (Magic Patterns)

## Contexto

Se pidió rediseñar el panel actual de Oliver tomando como referencia dos
mockups externos, sin crear un frontend nuevo ni copiar ninguno de los
dos literalmente:

- **R1** (`~/Desktop/R1`, export de Figma Make): define la **identidad
  visual** — paleta, tipografía, radius, sombras, spacing, jerarquía,
  sensación de producto premium — y la **sidebar**.
- **R3** (`~/Desktop/R3`, export de Magic Patterns): define la **UX,
  estructura, información y componentes** de cada módulo, la búsqueda
  integrada a la sidebar, y el sistema de iconos (`lucide-react`, ya en
  uso en Oliver).

Regla de conflicto: cuando R1 y R3 chocan, gana la asignación explícita
del pedido original (visual→R1, UX/estructura→R3). Dos decisiones que no
estaban explícitas se confirmaron con el usuario:

- **Filtros**: se adopta el Toolbar literal de R3 (Search + `Select`
  nativos + inputs de fecha + Segmented + "Limpiar filtros" + contador),
  reemplazando el patrón `FilterChip` (pill + popover estilo Stripe) que
  hoy es el estándar del proyecto. Es una reversión consciente de esa
  decisión previa, confirmada para este rediseño.
- **Búsqueda**: Command Palette completo (⌘K) — navegación entre
  páginas, acciones rápidas y búsqueda de empleados/sucursales — no una
  versión simplificada solo de navegación.

## Alcance

**Repo frontend** (`proyecto-oliver`) únicamente. Sin cambios de schema,
backend ni endpoints nuevos, salvo lo que ya exponen los hooks actuales.
Página nueva: detalle de empleado (`/empleados/:id`) — funcionalidad que
no existe hoy (hoy la edición es un modal sobre la tabla), ya anotada
como idea futura del usuario y ahora incorporada en este rediseño con la
estructura de R3.

No se elimina ninguna funcionalidad de negocio existente por no aparecer
en los mockups (ver sección "Se preserva sin excepción").

## Sistema visual (tokens, base R1)

Se reemplaza la paleta "editorial oliva" actual (`src/index.css`,
`@theme`) por la paleta monocromo + acento de R1:

- `--background: #F7F7FA`, `--foreground: #0D0D11`
- `--card` / `--popover`: `#FFFFFF`
- `--primary: #0D0D11` / `--primary-foreground: #FFFFFF`
- `--accent: #059669` (verde esmeralda — único color de marca, reemplaza
  el verde oliva `#4c5a31` actual)
- `--muted: #EEEEF2`, `--muted-foreground: #6C6C7A`
- `--destructive: #DC2626`
- `--border: rgba(13,13,17,0.08)` (borde sutil semitransparente, no gris
  plano)
- `--ring: rgba(5,150,105,0.3)`
- Estados: ámbar para pendientes/advertencia, esmeralda para
  positivo/en vivo, rojo para destructivo/ausencia injustificada.

Radius: 10px en cards/dialogs/popovers, 6-8px en inputs/botones/chips/
badges. **Sin `box-shadow`** salvo en overlays flotantes (popover, dialog,
command palette) — la superficie se distingue por el borde sutil, no por
sombra, siguiendo la filosofía flat de R1.

Tipografía: se mantienen **Archivo** (sans) e **IBM Plex Mono** (mono),
ya cargadas en el proyecto — no se suman Plus Jakarta Sans ni DM Mono de
R1. Se ajustan pesos/tamaños para lograr el mismo efecto de R1 (base
14px, mono para números/timestamps/datos técnicos en tamaño grande en
KPIs). Si al implementar no convence la fidelidad, es un cambio de una
línea (swap de font-family), no de arquitectura.

Sin cambios en el stack técnico: Tailwind v4 + `@theme` inline, `cva`
para variantes, `cn()` (clsx + tailwind-merge) para merge de clases.

## Iconografía (R3)

Ya resuelto de base: Oliver y R3 usan `lucide-react`. Trabajo real:

- Reemplazar los SVG inline hardcodeados en acciones de fila de
  `EmpleadosPage.tsx` y `SucursalesPage.tsx` por sus equivalentes
  `lucide-react`.
- Sumar ícono `Lock` en ítems de sidebar bloqueados por plan (hoy el
  bloqueo se indica solo con badge/tooltip).
- `public/icons.svg` (sprite de redes sociales, sin uso real) se
  elimina — no forma parte del sistema activo de iconos.

## Layout global

- **`TopBar.tsx` se elimina por completo** junto con `NotificationBell`
  y `AccountMenu` en su forma actual de topbar — su contenido (avatar,
  cerrar sesión, notificaciones) se reubica al footer de la sidebar.
- **`Sidebar.tsx`**: se conserva la estructura de R1 (header con
  logo+selector de organización, nav, footer con
  configuración+usuario), reskineada con los tokens nuevos (fondo
  `#0D0D11`, ítem activo con `bg-white/8` + ícono acento + punto verde,
  inactivo `text-white/45`). **Se mantiene el collapse 220px↔64px** que
  ya existe hoy con persistencia en `localStorage`
  (`oliver:sidebar-collapsed`) — ni R1 ni R3 tienen esta capacidad, pero
  es funcionalidad actual que no se pierde (spec previo:
  `2026-08-24-sidebar-navegacion-design.md`). Tooltips en modo colapsado
  se mantienen igual que hoy (a la derecha).
- Arriba de la nav, dentro de la sidebar, se agrega un botón
  **"Buscar…"** (estilo R3) que abre el Command Palette.
- **Command Palette (`CommandPalette.tsx`, nuevo)**, atajo `⌘K`/`Ctrl+K`:
  - Grupo "Ir a": todas las páginas del panel accesibles según plan/rol
    del usuario actual (mismo gating que la sidebar).
  - Grupo "Acciones": Nuevo empleado, Registrar ausencia, Revisar
    rechazadas — cada una navega a la página correspondiente con el
    modal/tab ya abierto (vía query param o estado de navegación).
  - Grupo "Empleados" / "Sucursales": búsqueda por nombre, usando los
    mismos hooks de listado que ya usan `EmpleadosPage`/`SucursalesPage`
    (fetch on-demand con debounce ~250ms si la lista no está ya en
    memoria; sin nuevo endpoint).
  - Navegación con teclado (flechas/Enter/Escape), cierre con click
    afuera.
- **`PageHeader.tsx`**: se simplifica respecto al actual (kicker mono +
  título 4xl/5xl) a un header más compacto: breadcrumb (solo en páginas
  de detalle), título, texto meta opcional, acciones a la derecha —
  con la tipografía/paleta nueva.

## Componentes nuevos o reemplazados (`src/components/ui`)

- **Toolbar de filtros** (nuevo, reemplaza `FilterChip` como patrón de
  listados): Search input con lupa + `Select` nativos estilizados +
  inputs `date` sueltos para rangos + Segmented control + botón "Limpiar
  filtros" (solo visible con filtros activos) + contador de resultados
  a la derecha. Se restylea con los tokens nuevos (sin sombra, borde
  sutil, radius 6-8px). Antes de borrar `filter-chip.tsx` y
  `multi-select.tsx` (variante chip), verificar con grep que no queden
  usos huérfanos.
- **Segmented** (nuevo): pill-group de 2-3 opciones (ej. Todos/Con
  desvío, Mes/Quincena/Semana).
- **SidePanel** (nuevo): panel lateral deslizante para ver/editar un
  registro puntual (detalle de asistencia, horario de turno, detalle de
  ausencia), con footer de acciones. Convive con `Dialog` (que se
  mantiene para altas/formularios modales cortos).
- **StatRow** (nuevo): fila de KPIs inline (no cards), números grandes
  en mono.
- **Meter** (nuevo): barra de avance horizontal (horas trabajadas vs.
  esperadas).
- **Sparkline** (nuevo): mini gráfico de línea para serie diaria simple,
  sin librería externa (SVG a mano, dataset chico).
- **Tabs** (reemplaza el patrón de botones toggle usado hoy en Turnos):
  subrayado inferior + badge de contador opcional.
- `Table`, `Badge`, `Status`, `Dialog`, `Toast`, `Pagination`,
  `IconButton`, `Field`, `Input`, `PasswordField` se mantienen tal cual
  a nivel de lógica/props, solo cambian los tokens visuales que
  consumen.

## Mapeo por módulo

- **Dashboard (`HomePage.tsx`)**: `StatRow` (adentro ahora, ausentes
  hoy, llegadas tarde, marcas rechazadas) + "Ahora mismo" y "Ausencias
  de hoy" (R3, por sucursal/lista) + "Pendientes de revisión" (R1: tabla
  de rechazados con Aprobar/Descartar) + "Últimos movimientos". Todo
  sobre los hooks ya existentes (`useAsistenciaEnVivo`,
  `useAusenciasHoy`, `useOlvidaronSalida`) más la lógica de
  aprobar/descartar que ya vive en `asistencia/hooks.ts`.
- **Asistencia**: tabs Registros/Rechazadas (contador de pendientes en
  el tab), Toolbar de filtros (empleado, sucursal, tipo, rango de
  fechas), tabla agrupada por fecha, `SidePanel` de detalle con bloque
  de validación de geocerca (distancia vs. radio configurado). Reusa
  íntegra la lógica de aprobar/descartar/eliminar/export de
  `asistencia/hooks.ts`.
- **Turnos**: `Tabs` Cumplimiento/Horarios (con contador de desvíos),
  `Segmented` Todos/Con desvío en Cumplimiento, `SidePanel` editable con
  inputs `time` por día en Horarios. Misma lógica de
  `HorariosTab`/`CumplimientoTab` actuales, solo cambia el shell visual.
- **Horas**: `StatRow` (horas totales, extra, por debajo de lo
  esperado) + `Sparkline` de horas por día + `Segmented`
  Mes/Quincena/Semana + tabla con `Meter` de avance por empleado. Si
  `horas/hooks.ts` no expone ya una serie diaria agregada, se deriva
  client-side de los datos por empleado existentes (sin tocar backend).
- **Empleados**: Toolbar (search por nombre/CUIL, sucursal, estado,
  dispositivo) + tabla con `EstadoEmpleadoBadge`. Se mantiene intacta la
  lógica de alta/edición/baja/eliminar, vinculación de dispositivo por
  OTP, y validación/formateo de CUIL.
- **Detalle de empleado** (`/empleados/:id`, **página nueva**):
  breadcrumb, header con acciones (vincular dispositivo, editar,
  suspender/dar de baja), `StatRow` (horas del período, extras, desvíos,
  ausencias), 4 tabs: Resumen (datos personales + últimas marcas +
  cumplimiento de hoy), Asistencia (historial completo), Horario
  (semana vigente con barra visual por día), Ausencias (tabla). Todos
  los datos salen de las mismas APIs que ya consumen Asistencia/
  Turnos/Ausencias, filtrados por `empleado_id` — sin endpoints nuevos.
- **Ausencias** (`RrhhPage.tsx`): `StatRow` (en curso, programadas,
  injustificadas, días acumulados), Toolbar, tabla, `SidePanel` de
  detalle con nota interna, y **tab nuevo "Categorías"** — la gestión de
  categorías de motivo ya vive acá (`RrhhPage`, no en Configuración,
  que hoy solo linkea); se formaliza como tab explícito. Se quita el
  link a esta sección desde `ConfiguracionPage.tsx`.
- **Sucursales**: listado con Toolbar + tabla (dirección, radio,
  **columna "Empleados"** = plantel total asignado, **columna "Activos
  ahora"** = conteo en vivo de marcados dentro — este segundo dato es el
  aporte específico de R1, adicional al de R3) + QR descargable.
  Detalle: `StatRow` (adentro ahora, marcas de hoy, radio, alta) + tabla
  de plantel asignado + bloque de marcado por QR + mapa de geocerca
  (reusa `MapaUbicacion.tsx` existente).
- **Configuración**: tabs Organización (datos generales editables por
  owner + zona sensible) y Miembros (invitar/quitar, gated a owner) —
  sin sección de categorías (se removió el link, la gestión real vive
  en Ausencias).
- **Plan**: uso actual (barras de progreso empleados/sucursales) +
  comparación de planes + info de suscripción, sobre los datos reales de
  `PlanPage.tsx` actual (sin billing real, como hoy).
- **Admin** (superadmin, `AdminPage.tsx`/`OrganizacionDetallePage.tsx`):
  no está en el pedido original — se re-skinea con los tokens y
  componentes nuevos por consistencia visual, sin cambios de UX/lógica.

## Se preserva sin excepción

Gating por plan (`tieneModulo`, `entitlements.maxEmpleados/
maxSucursales`, `ilimitado`) y por rol (`tieneRol`, `puedeGestionar`,
`soloGestion`); realtime de Supabase (`useAsistenciaEnVivo`); flujo OTP
de vinculación de dispositivo; exportación a Excel (asistencia, horas,
ausencias, gated por plan `reportes`); geocerca + mapa + QR de
sucursales; formateo/validación de CUIL argentino; timezone fijo
`America/Argentina/Buenos_Aires`; estados especiales (turno en curso,
"olvidaron salida", certificado pendiente, empleado de baja sin
asistencia habilita eliminar); accesibilidad existente (`aria-*`,
`role="tablist"`, `focus-visible`, `prefers-reduced-motion`).

## Riesgos

- **Detalle de empleado** es superficie nueva (ruta, componente, tabs),
  no un simple reskin — mayor esfuerzo relativo que el resto de los
  módulos.
- **Migración de `FilterChip` a Toolbar nativo** revierte una decisión
  de UI previamente documentada como estándar del proyecto — confirmado
  explícitamente por el usuario para este rediseño, no es un olvido.
- **Command Palette con búsqueda de entidades**: si las listas de
  empleados/sucursales no están precargadas al abrir el palette desde
  otra página, hay una consulta on-demand adicional — mitigado con
  debounce, no bloqueante para el diseño pero sí una decisión de
  implementación a definir en el plan (cachear vs. refetch).
- Alcance grande y transversal (toca casi todas las páginas del panel).

## Plan de fases (alto nivel — el detalle va en el implementation plan)

1. Sistema base: tokens, iconografía, componentes UI nuevos/reemplazados.
2. Layout global: Sidebar reskineada + Command Palette, remoción de TopBar.
3. Dashboard + Asistencia.
4. Turnos + Horas.
5. Empleados + Detalle de empleado (nuevo).
6. Ausencias (+ tab Categorías) + Sucursales.
7. Configuración + Plan + Admin (re-skin).
8. Revisión visual completa cruzada contra R1/R3 y polish final.

Cada fase debe compilar y ser revisable de forma independiente.

## Testing

Sin tests automatizados de UI en el proyecto hoy (no hay suite de
componentes) — validación manual en navegador por fase:

- Cada página nueva/retocada recorrida con las 4 cuentas de prueba
  (gratis/básico/pro/superadmin) para confirmar que el gating por
  plan/rol se ve y funciona igual que antes del rediseño.
- Verificación cruzada de consistencia visual (colores, tipografía,
  spacing, radius, sombras, botones, inputs, tabs, filtros, tablas,
  cards, iconos, modales, estados, navegación) recorriendo **todas** las
  páginas al final de la fase 8, comparando contra R1/R3.
- Estados loading/empty/error de cada listado y del Command Palette.
- Responsive: sidebar en drawer mobile, Toolbar de filtros en columna
  angosta, tablas con scroll horizontal propio.
- `tsc -b` con rebuild limpio antes de dar por buena cualquier fase
  (el cache incremental de `.tsbuildinfo` puede reportar falsos "0
  errores").
