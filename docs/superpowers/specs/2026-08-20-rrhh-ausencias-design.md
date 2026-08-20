# Módulo RRHH (Ausencias y Licencias)

Fecha: 2026-08-20
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

El README del repo actual anota "Plan 4 — Módulo de RRHH: pendiente
(reutiliza `empleados`, `sucursales` y el vínculo de identidad de
Asistencia)". El remote git `externo` (repo Next.js pre-migración) tiene
un módulo RRHH, pero con un enfoque que no se puede portar tal cual: ahí
`/api/rrhh` parsea bloques `<ADMIN>` dentro de mensajes de WhatsApp que
manda un bot de IA (busca patrones tipo *"Aviso de Sanca: [Nombre] de
sucursal [Sucursal] comunica [Motivo]. Detalle: [Detalle]. Contacto:
[Contacto]"* en la tabla `messages`/`conversations` de la vieja base
SQLite) — depende enteramente del canal de WhatsApp Cloud API + agente
IA, que en el stack actual sigue sin construirse (queda para el futuro,
fuera de alcance de esta spec).

Esta spec rediseña RRHH como **módulo standalone**: un admin/RRHH carga
la ausencia/licencia de un empleado a mano desde el panel — mismo dato
final que antes generaba el bot al leer WhatsApp, pero cargado
directamente por una persona, sin depender de ningún canal externo. Los
empleados hoy no tienen login propio (solo se vinculan por OTP para
marcar asistencia en `/marcar`) — este módulo no cambia eso; la carga es
siempre desde el panel de organización.

`org_settings` ya tiene una columna `rrhh_categorias jsonb` (default
`["Enfermedad", "Motivo Personal", "Licencia", "Urgencia"]`) reservada
para esto desde la migración `0002_org_settings_and_admins.sql` —
nunca usada todavía.

Es el primero de dos subproyectos decididos con el usuario (el segundo,
exportar a Excel Asistencia/Horas/RRHH, se planifica después de este —
así el export de RRHH sale completo desde el principio en vez de
tener que volver a tocarlo).

## 2. Decisiones tomadas con el usuario

- **Carga 100% manual desde el panel** (admin/RRHH), nunca por el
  empleado — no se introduce ningún acceso nuevo para empleados.
- **Rango de fechas (`fecha_desde`/`fecha_hasta`)**, no un timestamp
  único como el repo viejo — representa mejor una licencia de varios
  días; una ausencia de un solo día simplemente tiene ambas fechas
  iguales.
- **Motivo: `Select` con las categorías de `org_settings.rrhh_categorias`
  + opción "Otro"** que revela un campo de texto libre — reusa la
  columna ya reservada en vez de dejarla sin usar.
- **`sucursal_id` opcional en `ausencias`** — `empleados` no tiene
  sucursal fija (un empleado puede marcar en más de una), así que no
  hay de dónde derivar automáticamente la sucursal de una ausencia;
  se agrega como campo opcional (mismo patrón que
  `horarios_empleado.sucursal_id` del módulo Turnos) para poder
  filtrar/resumir por sucursal cuando se carga.
- **`certificado_pendiente` como booleano simple**, sin subir archivo
  del certificado — evita meter Supabase Storage en esta vuelta; se
  puede sumar como iteración futura si hace falta.

## 3. Arquitectura

### 3.1 Base de datos (`supabase/migrations/0005_rrhh.sql`)

```sql
create table ausencias (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  empleado_id uuid not null references empleados (id) on delete cascade,
  sucursal_id uuid references sucursales (id) on delete set null,
  fecha_desde date not null,
  fecha_hasta date not null,
  motivo text not null,
  detalle text,
  contacto text,
  certificado_pendiente boolean not null default false,
  created_at timestamptz not null default now()
);

create index on ausencias (org_id, fecha_desde);

alter table ausencias enable row level security;

create policy "members can read their org ausencias"
  on ausencias for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));
```

Escritura desde el servidor con service role (mismo patrón que
`asistencia`/`horarios_empleado`: las rutas de API filtran por `org_id`
explícito, la policy de RLS solo cubre lectura de clientes).

No hay migración para `org_settings.rrhh_categorias` — la columna ya
existe desde `0002_org_settings_and_admins.sql`, esta spec solo la
empieza a usar.

### 3.2 Backend (`server/`)

**`server/src/lib/rrhh.ts`** (nuevo), patrón `createServiceClient()` +
`org_id` explícito (igual que `lib/turnos.ts`):

- `listAusencias(orgId, filters?: { desde?, hasta?, sucursalId?, motivo?, empleadoId? })`
  — join con `empleados`/`sucursales` para nombre (igual a
  `listHorarios`), ordenado por `fecha_desde` descendente.
- `insertAusencia(orgId, input)`, `updateAusencia(orgId, id, patch)`,
  `deleteAusencia(orgId, id)` — CRUD estándar org-scoped.
- `getRrhhCategorias(orgId): Promise<string[]>` /
  `setRrhhCategorias(orgId, categorias: string[]): Promise<void>` — leen/
  escriben `org_settings.rrhh_categorias`.
- `calcularResumenAusencias(ausencias: Ausencia[])` — función pura (sin
  DB) que recibe el resultado de `listAusencias` para el rango
  filtrado y devuelve `{ total, certificadosPendientes, porSucursal,
  porMotivo }`, mismo shape que el `Resumen` del repo viejo.

**`server/src/routes/rrhh.ts`** (nuevo), todas con
`requireAuth`+`requireOrg`:

```
GET    /api/ausencias?desde=&hasta=&sucursalId=&motivo=&empleadoId=
POST   /api/ausencias
PATCH  /api/ausencias/:id
DELETE /api/ausencias/:id
GET    /api/settings/rrhh-categorias
PATCH  /api/settings/rrhh-categorias
```

`GET /api/ausencias` devuelve `{ ausencias, resumen }` (aplicando
`calcularResumenAusencias` sobre el listado ya filtrado), igual al
`ApiResponse` del repo viejo. Registrado en `server/src/index.ts` junto
a las rutas existentes.

Validación de `empleado_id`/`sucursal_id` contra el org del caller
(mismo patrón agregado en Turnos tras la revisión final: `getEmpleadoById`
+ chequeo de `org_id`, `getSucursal(orgId, id)`) — no repetir el hueco
multi-tenant que se encontró y corrigió ahí.

### 3.3 Frontend (`web/`)

- **`web/src/lib/api.ts`**: funciones tipadas
  (`getAusencias`, `createAusencia`, `updateAusencia`, `deleteAusencia`,
  `getRrhhCategorias`, `setRrhhCategorias`) + tipos (`Ausencia`,
  `CrearAusenciaInput`, `EditarAusenciaInput`, `ResumenAusencias`).
- **`web/src/pages/rrhh/hooks.ts`**: `useAusencias(filters)`,
  `useRrhhCategorias()` (`useQuery`); `useCrearAusencia`,
  `useEditarAusencia`, `useBorrarAusencia`, `useGuardarCategorias`
  (`useMutation`, invalidan `["ausencias"]`/`["rrhh-categorias"]`).
- **`web/src/pages/rrhh/RrhhPage.tsx`**: una sola página (no tabs, a
  diferencia de Turnos — es una vista cohesiva).
  - Resumen: `Card` chicas en fila (total, certificados pendientes,
    por sucursal, por motivo).
  - Filtros: `Field` fecha desde/hasta + `Select` sucursal + `Select`
    motivo (misma lista de `org_settings.rrhh_categorias` + "Todos").
  - `Table` con empleado, sucursal, período (desde–hasta), motivo,
    detalle, certificado pendiente (`Status`/`Badge`), acciones
    (`IconButton` editar/borrar) + `TableSkeleton`.
  - Botón "Nueva ausencia" sobre la tabla → `Dialog` con `Select`
    empleado, `Select` sucursal (opcional), `Field` fecha_desde/
    fecha_hasta, `Select` motivo (+ "Otro" revela `Field` de texto
    libre), `Field` detalle, `Field` contacto, checkbox "Certificado
    pendiente".
- **Ruta**: `/rrhh` en `App.tsx`, dentro de `ProtectedRoute` +
  `PanelLayout`.
- **Nav**: entrada `{ href: "/rrhh", label: "RRHH" }` en
  `PanelNav.tsx`.

## 4. Alcance

### Dentro de alcance

- Migración `0005_rrhh.sql` (tabla `ausencias`, RLS).
- `server/src/lib/rrhh.ts` + `server/src/routes/rrhh.ts` (6 rutas),
  registradas en `server/src/index.ts`.
- Página `/rrhh` completa en `web/` con alta/edición/borrado, filtros,
  resumen, y edición de `rrhh_categorias`.
- Entrada "RRHH" en `PanelNav`.

### Fuera de alcance

- Cualquier integración con WhatsApp (parseo de mensajes, bot IA) —
  queda para el futuro, no forma parte de este módulo.
- Acceso propio para empleados (autoservicio de licencias) — la carga
  es siempre desde el panel.
- Subida de archivo del certificado médico — `certificado_pendiente`
  es un booleano simple.
- El export a Excel de RRHH — es el segundo subproyecto decidido con
  el usuario, se planifica aparte una vez este módulo esté armado
  (junto con el export de Asistencia y Horas).

### QA

Sin tests automatizados (convención del repo) — verificación manual en
navegador al final, mismo patrón que las etapas anteriores.

### Criterio de "listo"

- Desde `/rrhh` se puede cargar una ausencia/licencia para un empleado
  (con rango de fechas, motivo de la lista de la org o "Otro", detalle,
  contacto, certificado pendiente), editarla y borrarla.
- El resumen (total, certificados pendientes, por sucursal, por motivo)
  refleja el filtro activo.
- El nav muestra "RRHH" con el mismo estilo que el resto de los links.

## 5. Explícitamente fuera de alcance de este documento

- Exportar a Excel (Asistencia, Horas, RRHH) — spec propia, siguiente
  en la cola.
- Canal de WhatsApp Cloud API + agente IA — spec propia a futuro, sin
  fecha definida.
