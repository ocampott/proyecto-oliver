# Migración a Vite — Etapa 4: Asistencia + Horas + retrofit Modernist

Fecha: 2026-08-18
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

Continuación de `docs/superpowers/specs/2026-08-14-vite-migration-etapa3-design.md`.
Las Etapas 1-3 dejaron `/marcar`, `/login`, Home, `/sucursales` y
`/empleados` funcionando de punta a punta en `web/` (Vite+React+Tailwind)
+ `server/` (Fastify). Esta etapa migra las últimas dos pantallas del
panel que seguían en Next.js: **Asistencia** (registros de entrada/salida
+ intentos rechazados) y **Horas** (reporte de horas trabajadas).

A diferencia de las etapas anteriores, la lógica de negocio de Asistencia
**ya está portada**: `server/src/lib/asistencia.ts` es prácticamente un
calco de `src/lib/asistencia.ts` (Next.js) — se copió en la Etapa 1 porque
`/marcar` la necesitaba (`registrarMarca`, `registrarRechazo`). Ya expone
`listAsistencia`, `deleteAsistencia`, `listRechazadas`, `aprobarRechazada`,
`descartarRechazada` y `calcularHoras`. Esta etapa es mayormente wiring:
rutas Fastify nuevas + pantallas nuevas en `web/`.

Además, el usuario trajo un rediseño hifi completo desde Claude Design
("Modernist", proyecto `8f3e8aba-017d-4ccb-942e-1d6234146c10`, acento azul
`#1d4ed8`) que originalmente se había decidido implementar como plan
separado, después de Etapa 3, solo sobre las pantallas ya migradas. Al
llegar el momento, se decidió adelantarlo: las pantallas de Asistencia y
Horas se construyen directo en Modernist, y como los tokens/componentes
son compartidos por todo `web/`, el resto del panel (Login, Home,
Sucursales, Empleados) queda actualizado al mismo tiempo. Esto reemplaza
al plan de rediseño separado que estaba pendiente.

## 2. Decisiones tomadas con el usuario

- **Estilo visual: Modernist ya, no Tailwind plano.** Se prefirió no
  construir estas dos pantallas con el estilo "provisorio" de las Etapas
  2/3 para no tener que rehacerlas después.
- **Tokens compartidos se actualizan globalmente**, no solo dentro de
  Asistencia/Horas — deja el panel entero (Login/Home/Sucursales/
  Empleados incluidos) con acento azul y radio 0, en vez de una mezcla de
  dos lenguajes visuales.
- **Borrado de código viejo:** al final de la etapa, una vez verificado en
  el navegador, se borran `src/app/(panel)/asistencia/`,
  `src/app/(panel)/horas/`, `src/app/api/asistencia/`,
  `src/app/api/horas/` de Next.js — mismo patrón que la Etapa 3.
- **El grupo de rutas `(panel)` de Next.js queda vacío tras el borrado**
  (su `layout.tsx`/`page.tsx`/`org-nav.tsx` solo enlazaban a Asistencia y
  Horas, ya migradas en etapas anteriores todo lo demás). Se borran
  también `src/app/(panel)/layout.tsx`, `src/app/(panel)/page.tsx` y
  `src/components/org-nav.tsx` en esta misma etapa, y con ellos
  `src/lib/asistencia.ts` (Next.js), que se queda sin consumidores.
  `src/app/login/` y `src/app/admin/` quedan intactos — no dependen de
  nada de esto y no forman parte de esta etapa.

## 3. Arquitectura

### 3.1 Backend (`server/`)

- **`server/src/routes/asistencia.ts`** (nuevo), todas con
  `requireAuth`+`requireOrg` (mismo preHandler de la Etapa 3):
  - `GET /api/asistencia?desde&hasta&sucursalId&empleadoId` — lista
    (default: hoy AR–hoy AR si no se pasan fechas).
  - `DELETE /api/asistencia/:id` — borra un registro.
  - `GET /api/asistencia/rechazadas` — lista de intentos rechazados
    pendientes.
  - `POST /api/asistencia/rechazadas/:id?accion=aprobar|descartar` —
    resuelve un intento; 400 con el mensaje de `Error` si la acción falla
    (p. ej. nombre ambiguo al aprobar).
- **`server/src/routes/horas.ts`** (nuevo), mismos preHandlers:
  - `GET /api/horas?desde&hasta&sucursalId` — llama `calcularHoras`,
    devuelve `{ desde, hasta, turnos, resumen }` con el mismo cálculo de
    resumen por empleado (total de horas, `enCurso`) que hace hoy
    `src/app/api/horas/route.ts` en Next.js (default: inicio de mes AR–hoy
    AR).
- Ambas rutas se registran en `server/src/index.ts` junto a las
  existentes. Sin dependencias nuevas — reusan `server/src/lib/asistencia.ts`
  tal cual está.

### 3.2 Frontend (`web/`)

- **`web/src/lib/api.ts`**: se agregan `listAsistencia`, `deleteAsistencia`,
  `listRechazadas`, `resolverRechazada(id, accion)`, `getHoras` — mismo
  patrón que las funciones de sucursales/empleados (pasan por `request()`).
- **`web/src/pages/asistencia/hooks.ts`**: `useAsistencia({desde,hasta})`
  y `useRechazadas()` (`useQuery`), `useBorrarAsistencia` y
  `useResolverRechazada` (`useMutation`, invalidan ambas queries al
  completarse).
- **`web/src/pages/horas/hooks.ts`**: `useHoras({desde,hasta})`
  (`useQuery`).
- **`/asistencia`** (`AsistenciaPage.tsx`): sección "Intentos rechazados"
  (tabla, oculta si no hay ninguno, con Aprobar/Descartar por fila) +
  selector de fechas + tabla de registros con Borrar por fila. Mismo
  comportamiento que `asistencia-client.tsx` de Next.js.
- **`/horas`** (`HorasPage.tsx`): selector de fechas + tabla de resumen
  por empleado (total horas, "Turno en curso") + tabla de turnos
  individuales (entrada, salida o "En curso", horas). Mismo comportamiento
  que `horas-client.tsx` de Next.js.
- **Rutas**: `/asistencia` y `/horas` se agregan a `App.tsx` dentro del
  mismo `ProtectedRoute` + `PanelLayout`.
- **Nav y Home**: los links/tarjetas de "Asistencia" y "Horas" pasan de
  deshabilitados a activos en `PanelNav.tsx` y `HomePage.tsx` — ya no
  queda ningún acceso deshabilitado, se puede borrar `TOOLTIP_DESHABILITADO`
  y la rama condicional que lo usa en ambos archivos.

### 3.3 Retrofit del design system (Modernist)

Fuente de verdad: proyecto Claude Design `8f3e8aba-017d-4ccb-942e-1d6234146c10`,
archivo `design_handoff_ui_oliver/Oliver - UI Completa.dc.html` (markup
final de las 8 pantallas + 2 modales) y
`design_handoff_ui_oliver/_ds/modernist-.../styles.css` (tokens/clases de
referencia — con acento rojo; el azul solo vive inline en el `.dc.html`).
Antes de implementar, releer ambos vía `DesignSync get_file` — no
re-derivar los tokens de memoria.

- **`web/src/index.css`**:
  - `--color-accent: #1d4ed8` (era `#dc2626`).
  - Rampa nueva `--color-accent-100` … `--color-accent-900`, vía
    `color-mix()` en oklch sobre `--color-accent`, misma fórmula que el
    handoff: 100/200/300/400 = mezcla con blanco (12/24/40/65%), 500 =
    base, 600/700/800/900 = mezcla con negro (85/68/52/38%).
  - Regla del handoff: texto de tamaño párrafo en acento usa el paso
    **700**, nunca el 500 (contraste).
- **`web/src/components/ui/*`**: sacar todo `rounded-*` (radio 0 en
  button, input, card, badge, table — ninguna excepción).
  - `button.tsx`: variant `ghost` pasa de `text-text` a `text-accent-700`
    (con hover en un fill tenue de acento) — así se ven las acciones de
    fila (Editar/Desactivar/Borrar/etc.) en el handoff. Variant `accent`
    (ya usada para los CTA primarios) no cambia de rol, solo de color vía
    el token.
  - `badge.tsx`/`table.tsx`: bordes estructurales (header de tabla, nav)
    a 2px; filas de cuerpo se mantienen en 1px — como
    `.table th { border-bottom: 2px }` / `.table td { border-bottom: 1px }`
    del handoff.
- Alcance: **todo `web/`**, no solo Asistencia/Horas — Login, Home,
  Sucursales y Empleados quedan con el mismo acento/radio automáticamente
  al compartir los mismos componentes y tokens. No se toca su lógica ni
  su estructura, solo su estilo.
- Este retrofit reemplaza al plan de rediseño "Modernist" que estaba
  pendiente como workstream separado — con esto, ese plan queda cerrado
  (no hace falta ejecutarlo aparte después).

## 4. Alcance de la Etapa 4

### Dentro de alcance

- `server/src/routes/asistencia.ts` + `server/src/routes/horas.ts` (5
  rutas nuevas), registradas en `server/src/index.ts`.
- Hooks + páginas `/asistencia` y `/horas` completas en `web/`.
- Activar los últimos links deshabilitados en `PanelNav`/`HomePage`
  (queda sin ninguno deshabilitado).
- Retrofit de tokens/componentes compartidos a Modernist (acento azul,
  radio 0) — aplica a todo `web/`.
- Borrar de Next.js: `src/app/(panel)/` completo (`layout.tsx`,
  `page.tsx`, `asistencia/`, `horas/`), `src/app/api/asistencia/`,
  `src/app/api/horas/`, `src/components/org-nav.tsx`,
  `src/lib/asistencia.ts` — una vez verificado en el navegador.

### Fuera de alcance

- `src/app/login/` y `src/app/admin/` de Next.js (no dependen de nada de
  esta etapa, quedan para una etapa de baja completa de Next.js si
  corresponde).
- Cualquier feature nueva sobre Asistencia/Horas que no exista hoy en
  Next.js (export, filtros nuevos, edición de registros).
- Cambios de comportamiento del cálculo de horas o de la resolución de
  rechazados — se porta tal cual está.

### QA

Sin tests automatizados nuevos — verificación manual del usuario al
final (patrón de las etapas anteriores). Dado lo encontrado en la Etapa 3
(bugs de Content-Type/CORS que curl no detecta), la verificación en
navegador real es obligatoria antes de borrar el código viejo, no
opcional. Barrer imports/links muertos hacia todo lo borrado antes de
cerrar (gap que se escapó en la revisión por-task de la Etapa 3).

### Criterio de "listo"

- Desde `web/` se puede: ver registros de asistencia filtrados por fecha,
  borrar un registro, ver y resolver (aprobar/descartar) intentos
  rechazados, y ver el reporte de horas (resumen + turnos) filtrado por
  fecha.
- Los datos persisten y las listas se refrescan solas tras cada acción,
  sin recargar la página.
- Todo `web/` (Login, Home, Sucursales, Empleados, Asistencia, Horas) se
  ve con acento azul y sin bordes redondeados, consistente con el handoff.
- `src/app/(panel)/`, `src/app/api/asistencia/`, `src/app/api/horas/`,
  `src/components/org-nav.tsx` y `src/lib/asistencia.ts` quedan borrados
  de Next.js; `src/app/login/` y `src/app/admin/` siguen funcionando sin
  cambios.

## 5. Explícitamente fuera de alcance de este documento

- Baja completa de Next.js (`src/app/login/`, `src/app/admin/`,
  configuración de deploy, dependencias) — si hace falta, es una etapa
  propia posterior.
- Cualquier ajuste visual fuera de lo que ya define el handoff Modernist
  (no se inventan variantes nuevas de componentes).
