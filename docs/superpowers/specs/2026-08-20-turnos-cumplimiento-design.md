# Módulo Turnos y Cumplimiento Horario

Fecha: 2026-08-20
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

El remote git `externo` (repo Next.js pre-migración, single-tenant, SQLite
vía `better-sqlite3`) tiene un commit que main todavía no tiene:
`2ee7647 Agregar modulo de turnos y cumplimiento horario`. Agrega:

- **Turnos**: horarios semanales por empleado (franjas día+hora, turno
  partido, más de una sucursal), plantillas de turno reutilizables,
  asignación masiva a varios empleados/días a la vez.
- **Cumplimiento horario**: compara cada turno real trabajado (entrada/
  salida) contra el horario esperado del empleado ese día, con tolerancia
  configurable en minutos, y clasifica el resultado (a horario / tarde /
  salida anticipada / ambos / sin horario definido).

Esta spec cubre **únicamente la migración funcional** de ese módulo al
stack actual (Vite + Fastify + Supabase, ya con Asistencia/Horas migrados
en la Etapa 4 y el rediseño "modern-soft" ya mergeado a main). **No se
porta nada visual** del repo externo — ni sus colores/clases Tailwind, ni
el `Sidebar`/`AppShell` colapsable que trae ese mismo commit (eso es un
cambio de layout aparte, fuera de alcance). La UI nueva se construye con
los componentes `ui/*` y los patrones ya establecidos en Asistencia/Horas/
Empleados/Sucursales.

Diferencia estructural importante con el repo externo: ahí, `asistencia`
y `horarios_empleado` no compartían una relación limpia entre sí, así que
`calcularCumplimiento` emparejaba turnos con horarios por **nombre de
empleado normalizado** (`LOWER+TRIM`). En el repo actual, `empleados` es
una tabla propia con FKs reales usadas en todos lados
(`asistencia.empleado_id`, etc.) — el cumplimiento acá empareja por
**`empleado_id`** directamente, sin el hack de nombre.

## 2. Decisiones tomadas con el usuario

- **Alcance: solo lógica funcional**, no visual. La UI se construye con
  `ui/*` (`Table`, `Dialog`, `Field`, `Select`, `Status`, `Badge`, `Card`),
  mismo lenguaje visual que Asistencia/Horas/Empleados/Sucursales.
- **Estructura de página: una sola página `/turnos` con 2 tabs** —
  "Horarios" y "Cumplimiento" —, igual a como está organizado en el repo
  externo. La página "Horas" existente no se toca.
- **Se migran las plantillas de turno** (no se recorta a MVP sin
  plantillas): es funcionalidad ya construida y probada en el repo
  externo, el costo incremental es bajo comparado con el resto del
  módulo.
- **Tolerancia general por org**: se agrega como columna a la tabla
  `org_settings` que ya existe (mismo patrón que `rrhh_categorias`), en
  vez de crear una tabla `settings` singleton nueva como tenía el repo
  externo (ahí no había multi-tenant).
- **`sucursal_id` en `horarios_empleado` queda opcional** (igual que
  terminó el repo externo tras su propia migración interna) — el cálculo
  de cumplimiento compara solo empleado + día + hora, sin importar dónde
  marcó.

## 3. Arquitectura

### 3.1 Base de datos (`supabase/migrations/0004_turnos.sql`)

```sql
create table horarios_empleado (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  empleado_id uuid not null references empleados (id) on delete cascade,
  sucursal_id uuid references sucursales (id) on delete set null,
  dia_semana integer not null check (dia_semana between 0 and 6),
  hora_inicio text not null,
  hora_fin text not null,
  tolerancia_min integer,
  created_at timestamptz not null default now()
);
create index on horarios_empleado (empleado_id, dia_semana);

create table turno_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  nombre text not null,
  hora_inicio text not null,
  hora_fin text not null,
  dias_semana integer[] not null default '{}',
  tolerancia_min integer,
  created_at timestamptz not null default now(),
  unique (org_id, nombre)
);

alter table org_settings add column tolerancia_min integer not null default 30;

alter table horarios_empleado enable row level security;
alter table turno_templates enable row level security;

create policy "members can read their org horarios_empleado"
  on horarios_empleado for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "members can read their org turno_templates"
  on turno_templates for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));
```

Escritura desde el servidor con service role (mismo patrón que
`asistencia`/`sucursales`: las rutas de API filtran por `org_id`
explícito, las policies de RLS solo cubren lectura de clientes).

`dias_semana` en `turno_templates` es un array nativo de Postgres
(`integer[]`), no el CSV-en-TEXT que usaba SQLite — evita el
`diasToText`/`textToDias` del repo externo.

### 3.2 Backend (`server/`)

**`server/src/lib/turnos.ts`** (nuevo), siguiendo el patrón de
`lib/asistencia.ts` (`createServiceClient()` + `org_id` explícito en
cada función):

- `listHorarios(orgId, empleadoId?)`, `insertHorario(orgId, params)`,
  `updateHorario(orgId, id, patch)`, `deleteHorario(orgId, id)`.
- `insertHorariosBulk(orgId, { empleado_ids, dias_semana, hora_inicio,
  hora_fin, tolerancia_min })` — un insert por combinación
  empleado × día, misma semántica que el repo externo.
- `listTurnoTemplates(orgId)`, `insertTurnoTemplate(orgId, ...)` (409 si
  el nombre ya existe en la org — `unique (org_id, nombre)`),
  `deleteTurnoTemplate(orgId, id)`.
- `getTolerancia(orgId)` / `setTolerancia(orgId, min)` — leen/escriben
  `org_settings.tolerancia_min`.
- `calcularCumplimiento(orgId, filters)` — **reusa `calcularHoras` de
  `lib/asistencia.ts` tal cual está** (ya devuelve `Turno[]` con
  `entrada_at`/`salida_at`/`horas` por `empleado_id`+`sucursal_id`) y lo
  enriquece: para cada turno, busca los `horarios_empleado` del mismo
  `empleado_id` en ese día de semana (más los de ayer si son turno
  nocturno, `hora_fin <= hora_inicio`, para poder emparejar entradas que
  cruzan medianoche), elige el candidato con `diff` de entrada más
  chico, y calcula `estado`/`diff_entrada_min`/`diff_salida_min` con la
  misma lógica de tolerancia (particular del horario si está definida,
  si no la general de la org) que el repo externo. Los timestamps de
  Supabase son ISO string (`created_at`), no unix seconds — el cálculo
  de minutos-del-día/día-de-semana AR se adapta a `Date` sobre el ISO
  string con el mismo offset fijo `-03:00` que ya usa `asistencia.ts`
  (sin DST, igual criterio en todo el archivo).

**`server/src/routes/turnos.ts`** (nuevo), todas con
`requireAuth`+`requireOrg`:

```
GET    /api/horarios?empleadoId=
POST   /api/horarios
PATCH  /api/horarios/:id
DELETE /api/horarios/:id
POST   /api/horarios/bulk
GET    /api/turno-templates
POST   /api/turno-templates
DELETE /api/turno-templates/:id
GET    /api/turnos/tolerancia
PATCH  /api/turnos/tolerancia
GET    /api/turnos/cumplimiento?desde=&hasta=&sucursalId=&empleadoId=
```

Registrado en `server/src/index.ts` junto a las rutas existentes.

### 3.3 Frontend (`web/`)

- **`web/src/lib/api.ts`**: se agregan las funciones tipadas
  correspondientes a cada endpoint de arriba (`getHorarios`,
  `insertHorario`, `updateHorario`, `deleteHorario`,
  `insertHorariosBulk`, `getTurnoTemplates`, `insertTurnoTemplate`,
  `deleteTurnoTemplate`, `getTolerancia`, `setTolerancia`,
  `getCumplimiento`), mismo patrón que las de `horas`/`asistencia`
  (pasan por `request()`).
- **`web/src/pages/turnos/hooks.ts`**: `useHorarios(empleadoId)`,
  `useTurnoTemplates()`, `useTolerancia()`, `useCumplimiento(filters)`
  (`useQuery`); `useCrearHorario`, `useActualizarHorario`,
  `useBorrarHorario`, `useAsignarHorarios`, `useCrearPlantilla`,
  `useBorrarPlantilla`, `useGuardarTolerancia` (`useMutation`, invalidan
  las queries relacionadas al completarse — mismo patrón que
  `useResolverRechazada` en Asistencia).
- **`web/src/pages/turnos/TurnosPage.tsx`**: tabs "Horarios" /
  "Cumplimiento".
  - **Horarios**: `Select` de empleado → `Table` de sus franjas
    (día/hora inicio/hora fin/tolerancia) con editar (`Dialog`) y borrar
    por fila, mismo patrón de alta-con-botón-y-`Dialog` ya establecido
    en Empleados/Sucursales. Sección "Plantillas" (lista + crear vía
    `Dialog` + borrar, mismo patrón). Sección "Asignar turno": lista de
    checkboxes de empleados dentro de un `Card` (no existe un
    `MultiSelect` en `ui/` — no se introduce un componente nuevo de
    librería para esto, se resuelve con checkboxes simples), selector
    de plantilla opcional (precompleta horario/tolerancia/días),
    toggle de días (badges Lun–Dom), campos de horario, botón asignar.
  - **Cumplimiento**: mismos `Field` de fecha desde/hasta que Horas +
    `Select` de sucursal/empleado. `Table` de resultados con `Status`
    por fila coloreado según `estado` (reusa el componente `Status`
    existente, no las clases Tailwind hardcodeadas del repo externo).
    Card de "Tolerancia general" con `Field` numérico + guardar.
- **Ruta**: `/turnos` se agrega a `App.tsx` dentro del mismo
  `ProtectedRoute` que el resto.
- **Nav**: entrada nueva `{ href: "/turnos", label: "Turnos" }` en
  `PanelNav.tsx` (`LINKS`), mismo estilo que las demás — sin tocar el
  componente de nav en sí.

## 4. Alcance

### Dentro de alcance

- Migración `0004_turnos.sql` (`horarios_empleado`, `turno_templates`,
  columna `tolerancia_min` en `org_settings`, RLS).
- `server/src/lib/turnos.ts` + `server/src/routes/turnos.ts` (11 rutas),
  registradas en `server/src/index.ts`.
- Página `/turnos` completa en `web/` (tabs Horarios + Cumplimiento),
  hooks y funciones de `api.ts` correspondientes.
- Entrada "Turnos" en `PanelNav`.

### Fuera de alcance

- Cualquier cosa visual del commit externo: `Sidebar`/`AppShell`
  colapsable, iconos emoji en el nav, colores `#2C1810`/`#D4A843`, etc.
  La UI usa los componentes y el lenguaje visual ya establecidos en el
  repo actual.
- Cambios de comportamiento respecto al cálculo del repo externo (mismo
  criterio de tolerancia, turno nocturno, elección del candidato más
  cercano) — se porta la lógica tal cual, adaptada al matching por FK.
- Exportar reportes, notificaciones, o cualquier feature que no exista
  hoy en el commit externo.
- Tests automatizados (convención ya establecida en todo el repo:
  `server/`/`web/` no tienen tests).

### QA

Sin tests automatizados — verificación manual del usuario en navegador
al final, mismo patrón que las etapas anteriores.

### Criterio de "listo"

- Desde `/turnos`, tab Horarios: se puede ver/crear/editar/borrar
  franjas horarias de un empleado, crear/borrar plantillas, y asignar un
  turno a varios empleados y días de una vez.
- Tab Cumplimiento: se puede filtrar por fecha/sucursal/empleado y ver
  el estado de cumplimiento de cada turno trabajado, con la tolerancia
  general editable y persistida por org.
- Los datos persisten y las listas se refrescan solas tras cada acción,
  sin recargar la página (React Query).
- El nav muestra "Turnos" con el mismo estilo que el resto de los links.

## 5. Explícitamente fuera de alcance de este documento

- Cualquier rediseño de layout (sidebar colapsable, etc.) — si se quiere
  en algún momento, es una iniciativa de diseño aparte.
- Cerrar o sincronizar el remote `externo` — esta spec solo consume el
  commit puntual `2ee7647` como referencia de lógica, no gestiona el
  remote en sí.
