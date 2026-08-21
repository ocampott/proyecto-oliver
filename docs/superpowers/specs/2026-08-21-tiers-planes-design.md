# Sistema de Tiers y Planes (suscripción)

Fecha: 2026-08-21
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

La app ya es multi-tenant de punta a punta (orgs, membresías, RLS), pero
hoy todas las organizaciones ven y pueden usar todo. La columna
`organizations.plan` existe desde la migración `0001_organizations.sql`
con default `'trial'` y **nunca se usa** — no hay catálogo de planes, ni
enforcement de límites, ni gating de módulos, ni registro de pagos.

El modelo de negocio decidido es **SaaS por suscripción**: el cliente paga
un plan mensual, con opción de pagar 1, 3 o 12 meses por adelantado y un
descuento mayor cuanto más largo el período. La app es **modular según
plan**: cada plan habilita un conjunto de módulos y límites de uso
(sucursales, empleados).

Esta spec diseña el sistema de tiers: catálogo de planes, modelo de datos
de suscripciones, enforcement de límites y módulos en el server, gating en
el frontend, y gestión manual de suscripciones desde el panel de
superadmin. **No** diseña la integración de cobros (Mercado Pago) — queda
para una iteración posterior (ver §5).

## 2. Decisiones tomadas con el usuario

- **Tres planes**: `gratis`, `basico`, `pro` (slugs en minúscula).
- **Períodos de pago**: 1, 3 o 12 meses por adelantado, con descuento
  creciente por período (sugerido: trimestral ~10 %, anual ~20 % — los
  números finales son configuración, no código).
- **El QR no es un diferencial de plan**: es inherente al marcado de
  asistencia, así que está en todos los planes. El diferencial del plan
  básico es multi-sucursal + módulos de gestión.
- **Catálogo de planes en código del server** (`lib/planes.ts`), no en una
  tabla: es la única fuente de verdad de límites, módulos y precios; el
  frontend lo consume vía API. Cambiar un precio o límite es un deploy,
  no una migración.
- **Gestión de suscripciones manual** desde el panel de superadmin (el
  cliente paga por fuera — transferencia, Mercado Pago manual — y el
  superadmin registra la suscripción). El checkout self-service queda
  fuera de alcance.
- **Al vencer una suscripción paga, la org pasa a `gratis` de forma lazy**
  (se evalúa al leer, sin cron): los módulos pagos dejan de funcionar pero
  **los datos no se tocan ni se borran** — si renueva, vuelve todo como
  estaba.
- **Límite excedido por downgrade no borra nada**: si una org baja de plan
  y tiene más sucursales/empleados que el límite nuevo, no puede crear
  más, pero los existentes siguen operando.

## 3. Catálogo de planes

Definido en `server/src/lib/planes.ts` como constante tipada:

```ts
type PlanSlug = "gratis" | "basico" | "pro";

interface PlanDef {
  slug: PlanSlug;
  nombre: string;              // "Gratis" | "Básico" | "Pro"
  maxSucursales: number | null; // null = ilimitado
  maxEmpleados: number | null;
  modulos: Modulo[];           // lista cerrada, ver abajo
  precioMensual: number | null; // null en gratis; valores finales a definir
}

type Modulo =
  | "asistencia"   // marcado QR + geocerca + rechazados — core, todos los planes
  | "horas"        // horas trabajadas
  | "turnos"       // turnos y cumplimiento horario (spec 2026-08-20, sin implementar)
  | "rrhh"         // ausencias y licencias (spec 2026-08-20, sin implementar)
  | "reportes"     // exportación CSV/Excel (spec pendiente)
  | "liquidacion"  // liquidación de sueldos (spec pendiente)
  | "alertas"      // notificaciones en tiempo real (futuro)
  | "whatsapp"     // canal WhatsApp + OTP por WhatsApp (futuro)
  | "ia";          // asistente IA (futuro)
```

| | Gratis | Básico | Pro |
|---|---|---|---|
| Sucursales | 1 | 3 | ilimitadas |
| Empleados | 5 | 30 | ilimitados |
| Asistencia (QR + geocerca) | ✓ | ✓ | ✓ |
| Horas | — | ✓ | ✓ |
| Turnos y cumplimiento | — | ✓ | ✓ |
| RRHH (ausencias) | — | ✓ | ✓ |
| Reportes / exportación | — | ✓ | ✓ |
| Liquidación de sueldos | — | — | ✓ |
| Alertas | — | — | ✓ |
| WhatsApp | — | — | ✓ |
| Asistente IA | — | — | ✓ |

Los módulos marcados como "sin implementar/futuro" se declaran ya en el
catálogo: el sistema de gating los soporta desde el día uno, y cada módulo
nuevo se conecta con una línea (`requireModulo("rrhh")`) cuando se
implemente. Mientras no existan, simplemente no aparecen en la UI.

**Descuentos por período** en el mismo archivo de config:

```ts
const PERIODOS = [
  { meses: 1, descuento: 0 },
  { meses: 3, descuento: 0.10 },
  { meses: 12, descuento: 0.20 },
];
```

Precio de un período: `precioMensual * meses * (1 - descuento)`. El plan
gratis no tiene precio ni vencimiento.

## 4. Arquitectura

### 4.1 Base de datos (`supabase/migrations/0006_suscripciones.sql`)

```sql
create table suscripciones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  plan text not null check (plan in ('basico', 'pro')),
  periodo_meses int not null check (periodo_meses in (1, 3, 12)),
  precio_total numeric(10, 2),
  inicia_at timestamptz not null default now(),
  vence_at timestamptz not null,
  estado text not null default 'activa' check (estado in ('activa', 'vencida', 'cancelada')),
  notas text,  -- uso interno del superadmin: "pagó por transferencia", etc.
  created_at timestamptz not null default now()
);

create index on suscripciones (org_id, estado);

alter table suscripciones enable row level security;

create policy "members can read their org suscripciones"
  on suscripciones for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));
```

Notas:

- El plan `gratis` **no tiene fila en `suscripciones`**: es el estado por
  defecto de una org sin suscripción activa. Esto evita filas eternas que
  hay que mantener.
- `organizations.plan` queda como **plan efectivo cacheado**: lo actualiza
  el server cuando el superadmin registra/cancela una suscripción, y es lo
  que lee el resto del código. `suscripciones` es el historial de
  facturación. El valor `'trial'` existente se migra a `'gratis'` en la
  misma migración (`update organizations set plan = 'gratis' where plan = 'trial'`),
  y el default de la columna pasa a `'gratis'`.
- Escritura solo vía service role desde el server (mismo patrón que
  `asistencia`/`ausencias`).

### 4.2 Backend (`server/`)

**`server/src/lib/planes.ts`** (nuevo):

- Catálogo `PLANES: Record<PlanSlug, PlanDef>` + `PERIODOS` (§3).
- `getEntitlements(orgId): Promise<Entitlements>` — resuelve el plan
  efectivo de la org: lee `organizations.plan` y la suscripción activa;
  si la suscripción está vencida (`vence_at < now()`), la marca
  `vencida`, baja `organizations.plan` a `'gratis'` y devuelve los
  entitlements del plan gratis (evaluación lazy, sin cron). Devuelve:
  ```ts
  interface Entitlements {
    plan: PlanDef;
    suscripcion: { venceAt: string; periodoMeses: number } | null;
    maxSucursales: number | null;
    maxEmpleados: number | null;
    modulos: Modulo[];
  }
  ```
- `tieneModulo(ent, modulo)`, `puedeCrearSucursal(ent, cantidadActual)`,
  `puedeCrearEmpleado(ent, cantidadActual)` — helpers puros.
- `precioPeriodo(plan, meses): number` — precio con descuento aplicado.

**`server/src/plugins/require-modulo.ts`** (nuevo) — preHandler de Fastify
mismo estilo que `require-org.ts`:

```ts
requireModulo("horas") // → 403 { error: "modulo_no_incluido", modulo, planRequerido: "basico" }
```

**Enforcement en rutas existentes**:

- `POST /api/sucursales`: contar sucursales activas de la org; si alcanzó
  `maxSucursales` → `403 { error: "limite_plan", recurso: "sucursales", max }`.
- `POST /api/empleados`: ídem con `maxEmpleados`.
- `GET /api/horas`: `requireModulo("horas")`.
- `DELETE /api/asistencia/:id`, rechazadas, etc.: quedan en todos los
  planes (son parte del core de asistencia).

**Rutas nuevas**:

```
GET   /api/planes                          — catálogo + precios por período (auth, para pantalla de upgrade)
GET   /api/org/current                     — se extiende: devuelve también Entitlements
GET   /api/admin/organizations/:id/suscripciones   — historial (platform admin)
POST  /api/admin/organizations/:id/suscripciones   — registrar suscripción manual:
      { plan, periodoMeses, precioTotal?, notas? } — setea organizations.plan,
      cancela la activa anterior si existe
PATCH /api/admin/suscripciones/:id                  — cancelar (estado: 'cancelada',
      organizations.plan → 'gratis')
```

Todas las rutas `/api/admin/*` ya están detrás de `requirePlatformAdmin`.

### 4.3 Frontend (`web/`)

- **`web/src/lib/api.ts`**: tipos `Plan`, `Entitlements`, `Suscripcion`;
  `getPlanes()`; extender `useOrgActual` para exponer `entitlements`.
- **Gating de navegación** en `PanelNav.tsx`: los links de módulos no
  incluidos en el plan se muestran con un badge con el nombre del plan
  requerido ("Básico", "Pro") y llevan a `/plan` en vez de a la página.
  Los módulos todavía no implementados no aparecen en absoluto (regla
  actual: solo se listan páginas existentes).
- **`web/src/pages/plan/PlanPage.tsx`** (nueva, ruta `/plan`): pantalla
  simple con:
  - Plan actual, uso (`3 de 5 empleados`, `1 de 1 sucursales`) y
    vencimiento de la suscripción si tiene.
  - Comparativa de los 3 planes (módulos y límites, de `GET /api/planes`).
  - Precios 1 / 3 / 12 meses con el descuento visible ("ahorrás 20 %").
  - CTA: "Contactanos para cambiar de plan" (gestión manual — no hay
    checkout en esta iteración).
- **Manejo de errores de plan**: si una llamada a la API devuelve
  `modulo_no_incluido` o `limite_plan`, mostrar un mensaje claro con link
  a `/plan` (ej. "Llegaste al máximo de 5 empleados de tu plan. Pasate a
  Básico para sumar más.").
- **`web/src/pages/admin/AdminPage.tsx`**: extender la tabla de orgs con
  columna plan + vencimiento, y un `Dialog` por org para registrar/cambiar
  suscripción (Select plan, Select período, precio calculado editable,
  notas) o cancelarla. Es la herramienta de gestión manual de cobros.

## 4bis. Superadmin: siempre ilimitado, sin plan

**Regla del proyecto, no negociable**: un usuario en `platform_admins` no
tiene plan ni vencimiento — puede hacer todo, sin límites, siempre. No es
"le asignamos el plan Pro", es que los límites de plan no le aplican en
absoluto, sin importar el plan de la organización a la que pertenezca.

**Implementación** (`server/src/lib/planes.ts`): `Entitlements` tiene un
campo `ilimitado: boolean`. `getEntitlements(orgId, userId)` chequea
`isPlatformAdmin(userId)` primero — si es true, devuelve
`ENTITLEMENTS_SUPERADMIN` (`ilimitado: true`, sin mirar el plan de la org)
sin pisar nada en la base. `tieneModulo`/`puedeCrearSucursal`/
`puedeCrearEmpleado` chequean `ent.ilimitado` antes que cualquier otra
condición.

**Convención para todo lo que se agregue a futuro**: cualquier función
nueva que decida algo en base a `Entitlements` (un módulo nuevo, un límite
nuevo, lo que sea) DEBE chequear `ilimitado` primero y devolver "permitido"
sin evaluar el resto. No hay que mantener una lista de módulos/límites que
el superadmin tiene "habilitados" — el bypass es incondicional, no
enumerado. Todo call site de `getEntitlements` debe pasarle el `userId`
del request (`request.user!.id`), no solo el `orgId`.

## 5. Alcance

### Dentro de alcance

- Migración `0006_suscripciones.sql` (tabla + RLS + normalización de
  `organizations.plan`).
- `lib/planes.ts` (catálogo, entitlements, precios) + plugin
  `require-modulo.ts`.
- Enforcement de límites en sucursales/empleados y gating de `horas`.
- `GET /api/planes` + extensión de `GET /api/org/current` + rutas admin de
  suscripciones.
- Pantalla `/plan` con comparativa y precios; gating del nav; manejo de
  errores de plan; gestión de suscripciones en `/admin`.

### Fuera de alcance

- **Integración de cobros** (Mercado Pago u otro): el registro de
  suscripciones es manual vía superadmin. La tabla `suscripciones` ya
  queda lista para guardar `external_id` del procesador el día que se
  integre (agregar columna, sin rediseño).
- **Los módulos en sí mismos** (turnos, RRHH, reportes, liquidación,
  WhatsApp, IA): cada uno tiene o tendrá su propia spec; acá solo se
  define cómo se los gatea.
- Roles por sucursal / permisos finos dentro de una org.
- Emails de aviso de vencimiento, renovación automática, prorrateo de
  cambios de plan a mitad de período (en la gestión manual, cambiar de
  plan registra una suscripción nueva desde hoy).
- Signup self-service: las orgs siguen creándose a mano desde `/admin`.

### QA

Sin tests automatizados (convención del repo) — verificación manual en
navegador, mismo patrón que las etapas anteriores.

### Criterio de "listo"

- Con una org en plan `gratis`: no se puede crear la 2.ª sucursal ni el
  6.º empleado (mensaje claro con link a `/plan`); `/horas` no aparece en
  el nav y la API devuelve `modulo_no_incluido`.
- Desde `/admin` se registra una suscripción Básico a 3 meses con
  descuento aplicado; la org ve inmediatamente los módulos de su plan y el
  vencimiento en `/plan`.
- Con la suscripción vencida (forzando `vence_at` a mano), la org vuelve
  a comportarse como `gratis` sin perder datos.
- `GET /api/planes` devuelve el catálogo completo con precios por período.

## 6. Explícitamente fuera de alcance de este documento

- Módulo Turnos y Cumplimiento Horario — spec propia
  (`2026-08-20-turnos-cumplimiento-design.md`).
- Módulo RRHH — spec propia (`2026-08-20-rrhh-ausencias-design.md`).
- Exportación a Excel/CSV, Liquidación de sueldos, WhatsApp + IA — specs
  propias a futuro.
- Checkout y procesador de pagos — iteración posterior a esta spec.
