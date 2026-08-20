# Módulo RRHH (Ausencias y Licencias) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el módulo RRHH (ausencias/licencias) del repo externo al stack actual, rediseñado como carga manual desde el panel (sin depender de WhatsApp) — CRUD de ausencias por empleado, resumen y filtros, reusando `org_settings.rrhh_categorias`.

**Architecture:** `server/` gana `lib/rrhh.ts` (CRUD de `ausencias` + lectura/escritura de `org_settings.rrhh_categorias` + cálculo de resumen puro) y `routes/rrhh.ts` (6 rutas, wiring puro). `web/` gana una página `/rrhh` (sin tabs, vista única) construida con los mismos componentes `ui/*` ya usados en Turnos — mismo lenguaje visual, mismo patrón de alta con botón + `Dialog`.

**Tech Stack:** Sin dependencias nuevas — Fastify + Supabase (server), React Query + Tailwind (web), ya presentes.

**Spec:** `docs/superpowers/specs/2026-08-20-rrhh-ausencias-design.md`

## Global Constraints

- **Carga 100% manual desde el panel** — sin ningún acceso nuevo para empleados, sin parseo de WhatsApp.
- **`fecha_desde`/`fecha_hasta`** (tipo `date`, no timestamp) — una ausencia de un solo día tiene ambas fechas iguales.
- **Motivo**: `Select` con `org_settings.rrhh_categorias` + opción "Otro" que revela un campo de texto libre. El valor final que se guarda en `ausencias.motivo` es siempre texto plano (la categoría elegida, o lo que se tipeó en "Otro") — la tabla no tiene FK a una lista de categorías.
- **`sucursal_id` en `ausencias` es opcional** (mismo patrón que `horarios_empleado.sucursal_id` del módulo Turnos) — `empleados` no tiene sucursal fija.
- **`certificado_pendiente` es un booleano simple** — sin subida de archivo.
- **Validación cross-org de `empleado_id`/`sucursal_id`** en las rutas de creación/edición — mismo patrón ya usado en `server/src/routes/turnos.ts` (`getEmpleadoById` + chequeo de `org_id`, `getSucursal(orgId, id)`), agregado ahí tras la revisión final de esa etapa. No repetir el hueco multi-tenant que se corrigió en Turnos.
- **Las rutas `POST`/`PATCH` que escriben devuelven `{ ok: true }`**, no la entidad — mismo patrón que Turnos.
- **`DELETE` con id en el path** (RESTful), mismo patrón ya establecido en todo `server/`.
- Cada mutación de TanStack Query invalida la(s) query key(s) relacionadas al completarse.
- **Sin tests automatizados** (convención del repo) — verificación vía `typecheck`/`build` por task y checklist manual en navegador al final.
- **Supabase de este proyecto es un proyecto remoto real** (no Docker local) — las migraciones se aplican con `npx supabase db push` (CLI ya logueado con un token persistido en `~/.supabase`, proyecto linkeado `utgjmreanqbzncvykqgd`), no con `npx supabase db reset` ni `psql`. Verificación vía API REST (`$SUPABASE_URL/rest/v1/<tabla>` con `SUPABASE_SERVICE_ROLE_KEY`).
- **Worktree**: este plan se ejecuta en `.worktrees/rrhh-ausencias` (rama `rrhh-ausencias`, creada desde `main` local). El repo principal (`/Users/tomasocampo/Documents/personal/proyecto-oliver`) tiene **otra sesión activa en paralelo** en la rama `feat/sucursales-mapa-ubicacion` — no correr ningún comando `git` fuera de este worktree, y no asumir que el directorio principal está en `main`.
- **Puertos de dev**: verificar con `lsof -iTCP -sTCP:LISTEN -P` antes de levantar `server`/`web` en este worktree — no asumir que un puerto default o el usado por Turnos (3011/5175) sigue libre, puede haber cambiado.

---

## Task 1: Migración SQL — tabla `ausencias`

**Files:**
- Create: `supabase/migrations/0005_rrhh.sql`

**Interfaces:**
- Consumes: tablas `organizations`, `empleados`, `sucursales` (ya existen); columna `org_settings.rrhh_categorias` (ya existe desde `0002_org_settings_and_admins.sql`, no se toca en esta migración).
- Produces: tabla `ausencias` — usada por `server/src/lib/rrhh.ts` en la Task 2.

- [ ] **Step 1: Crear `supabase/migrations/0005_rrhh.sql`**

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

- [ ] **Step 2: Aplicar la migración con el CLI**

```bash
npx supabase db push
```

Esperado: `{"upToDate":false,...,"migrations":["0005_rrhh.sql"],"message":"Finished supabase db push."}` (puede aparecer un warning de "failed to cache migrations catalog" — es un problema de red del propio comando de caché, no de la migración; ignorarlo si el resto del output es exitoso, ya pasó igual en la Task 1 de Turnos).

- [ ] **Step 3: Verificar contra la API REST**

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_SERVICE_ROLE_KEY" server/.env.local | sed 's/^/export /')

echo "--- ausencias existe (200 + []) ---"
curl -s -w " [%{http_code}]" "$SUPABASE_URL/rest/v1/ausencias?select=id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
echo
```

Esperado: `[200]` con `[]` (tabla nueva, sin filas todavía).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_rrhh.sql
git commit -m "feat(db): tabla ausencias"
```

---

## Task 2: CRUD de ausencias + rutas de `server/`

**Files:**
- Create: `server/src/lib/rrhh.ts`
- Create: `server/src/routes/rrhh.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `createServiceClient` (`server/src/lib/supabase-service.js`); `getEmpleadoById` (`server/src/lib/empleados.js`, ya existe — `getEmpleadoById(id): Promise<Empleado | null>`, `Empleado` tiene `org_id`); `getSucursal` (`server/src/lib/sucursales.js`, ya existe — `getSucursal(orgId, id): Promise<Sucursal | null>`); `requireAuth`/`requireOrg` (`server/src/plugins/*.js`).
- Produces: `Ausencia`, `ResumenAusencias` (interfaces); `listAusencias(orgId, filters?)`, `insertAusencia(orgId, input)`, `updateAusencia(orgId, id, patch)`, `deleteAusencia(orgId, id)`, `getRrhhCategorias(orgId)`, `setRrhhCategorias(orgId, categorias)`, `calcularResumenAusencias(ausencias)` (funciones); `rrhhRoutes` (Fastify plugin) con las 6 rutas del módulo — consumido por `web/src/lib/api.ts` (Task 3).

- [ ] **Step 1: Crear `server/src/lib/rrhh.ts`**

```ts
import { createServiceClient } from "./supabase-service.js";

// ── Ausencias y licencias ────────────────────────────────────────────────────
// Reemplazo standalone del RRHH del repo externo (que parseaba mensajes de
// WhatsApp) — acá la carga es siempre manual, desde el panel. sucursal_id es
// opcional a propósito: empleados no tiene sucursal fija (un empleado puede
// marcar en más de una).

export interface Ausencia {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  sucursal_id: string | null;
  sucursal_nombre: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  motivo: string;
  detalle: string | null;
  contacto: string | null;
  certificado_pendiente: boolean;
  created_at: string;
}

interface AusenciaRow {
  id: string;
  empleado_id: string;
  sucursal_id: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  motivo: string;
  detalle: string | null;
  contacto: string | null;
  certificado_pendiente: boolean;
  created_at: string;
  empleados: { nombre: string } | { nombre: string }[] | null;
  sucursales: { nombre: string } | { nombre: string }[] | null;
}

function nombreDe(rel: { nombre: string } | { nombre: string }[] | null): string | null {
  return (Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre) ?? null;
}

export async function listAusencias(
  orgId: string,
  filters?: { desde?: string; hasta?: string; sucursalId?: string; motivo?: string; empleadoId?: string }
): Promise<Ausencia[]> {
  const service = createServiceClient();
  let query = service
    .from("ausencias")
    .select(
      "id, empleado_id, sucursal_id, fecha_desde, fecha_hasta, motivo, detalle, contacto, certificado_pendiente, created_at, empleados(nombre), sucursales(nombre)"
    )
    .eq("org_id", orgId)
    .order("fecha_desde", { ascending: false });
  // Overlap con el rango filtrado: la ausencia no terminó antes de "desde" y no empieza después de "hasta".
  if (filters?.desde) query = query.gte("fecha_hasta", filters.desde);
  if (filters?.hasta) query = query.lte("fecha_desde", filters.hasta);
  if (filters?.sucursalId) query = query.eq("sucursal_id", filters.sucursalId);
  if (filters?.motivo) query = query.eq("motivo", filters.motivo);
  if (filters?.empleadoId) query = query.eq("empleado_id", filters.empleadoId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as AusenciaRow[]).map((r) => ({
    id: r.id,
    empleado_id: r.empleado_id,
    empleado_nombre: nombreDe(r.empleados) ?? "?",
    sucursal_id: r.sucursal_id,
    sucursal_nombre: nombreDe(r.sucursales),
    fecha_desde: r.fecha_desde,
    fecha_hasta: r.fecha_hasta,
    motivo: r.motivo,
    detalle: r.detalle,
    contacto: r.contacto,
    certificado_pendiente: r.certificado_pendiente,
    created_at: r.created_at,
  }));
}

export async function insertAusencia(
  orgId: string,
  input: {
    empleado_id: string;
    sucursal_id?: string | null;
    fecha_desde: string;
    fecha_hasta: string;
    motivo: string;
    detalle?: string | null;
    contacto?: string | null;
    certificado_pendiente?: boolean;
  }
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("ausencias").insert({
    org_id: orgId,
    empleado_id: input.empleado_id,
    sucursal_id: input.sucursal_id ?? null,
    fecha_desde: input.fecha_desde,
    fecha_hasta: input.fecha_hasta,
    motivo: input.motivo,
    detalle: input.detalle ?? null,
    contacto: input.contacto ?? null,
    certificado_pendiente: input.certificado_pendiente ?? false,
  });
  if (error) throw error;
}

export async function updateAusencia(
  orgId: string,
  id: string,
  patch: {
    sucursal_id?: string | null;
    fecha_desde?: string;
    fecha_hasta?: string;
    motivo?: string;
    detalle?: string | null;
    contacto?: string | null;
    certificado_pendiente?: boolean;
  }
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("ausencias").update(patch).eq("org_id", orgId).eq("id", id);
  if (error) throw error;
}

export async function deleteAusencia(orgId: string, id: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("ausencias").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw error;
}

// ── Categorías de motivo (org_settings.rrhh_categorias) ─────────────────────
// La columna ya existe desde 0002_org_settings_and_admins.sql — acá se
// empieza a usar por primera vez.

export async function getRrhhCategorias(orgId: string): Promise<string[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("org_settings")
    .select("rrhh_categorias")
    .eq("org_id", orgId)
    .single();
  if (error) throw error;
  return data.rrhh_categorias;
}

export async function setRrhhCategorias(orgId: string, categorias: string[]): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("org_settings").update({ rrhh_categorias: categorias }).eq("org_id", orgId);
  if (error) throw error;
}

// ── Resumen ───────────────────────────────────────────────────────────────────

export interface ResumenAusencias {
  total: number;
  certificadosPendientes: number;
  porSucursal: Record<string, number>;
  porMotivo: Record<string, number>;
}

export function calcularResumenAusencias(ausencias: Ausencia[]): ResumenAusencias {
  const porSucursal: Record<string, number> = {};
  const porMotivo: Record<string, number> = {};
  let certificadosPendientes = 0;

  for (const a of ausencias) {
    const sucursal = a.sucursal_nombre ?? "Sin sucursal";
    porSucursal[sucursal] = (porSucursal[sucursal] ?? 0) + 1;
    porMotivo[a.motivo] = (porMotivo[a.motivo] ?? 0) + 1;
    if (a.certificado_pendiente) certificadosPendientes++;
  }

  return { total: ausencias.length, certificadosPendientes, porSucursal, porMotivo };
}
```

- [ ] **Step 2: Crear `server/src/routes/rrhh.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import {
  listAusencias,
  insertAusencia,
  updateAusencia,
  deleteAusencia,
  getRrhhCategorias,
  setRrhhCategorias,
  calcularResumenAusencias,
} from "../lib/rrhh.js";
import { getEmpleadoById } from "../lib/empleados.js";
import { getSucursal } from "../lib/sucursales.js";

interface ListQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
}

interface CrearAusenciaBody {
  empleado_id?: string;
  sucursal_id?: string | null;
  fecha_desde?: string;
  fecha_hasta?: string;
  motivo?: string;
  detalle?: string | null;
  contacto?: string | null;
  certificado_pendiente?: boolean;
}

interface EditarAusenciaBody {
  sucursal_id?: string | null;
  fecha_desde?: string;
  fecha_hasta?: string;
  motivo?: string;
  detalle?: string | null;
  contacto?: string | null;
  certificado_pendiente?: boolean;
}

interface CategoriasBody {
  categorias?: string[];
}

interface IdParams {
  id: string;
}

export async function rrhhRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ListQuery }>(
    "/api/ausencias",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const ausencias = await listAusencias(request.org!.id, request.query);
      return { ausencias, resumen: calcularResumenAusencias(ausencias) };
    }
  );

  app.post<{ Body: CrearAusenciaBody }>(
    "/api/ausencias",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { empleado_id, sucursal_id, fecha_desde, fecha_hasta, motivo, detalle, contacto, certificado_pendiente } =
        request.body ?? {};
      if (!empleado_id || !fecha_desde || !fecha_hasta || !motivo?.trim()) {
        return reply.code(400).send({ error: "Faltan datos de la ausencia" });
      }
      const empleado = await getEmpleadoById(empleado_id);
      if (!empleado || empleado.org_id !== request.org!.id) {
        return reply.code(400).send({ error: "Empleado inválido" });
      }
      if (sucursal_id) {
        const sucursal = await getSucursal(request.org!.id, sucursal_id);
        if (!sucursal) {
          return reply.code(400).send({ error: "Sucursal inválida" });
        }
      }
      await insertAusencia(request.org!.id, {
        empleado_id,
        sucursal_id,
        fecha_desde,
        fecha_hasta,
        motivo: motivo.trim(),
        detalle,
        contacto,
        certificado_pendiente,
      });
      return { ok: true };
    }
  );

  app.patch<{ Params: IdParams; Body: EditarAusenciaBody }>(
    "/api/ausencias/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const body = request.body ?? {};
      if (body.sucursal_id !== undefined && body.sucursal_id !== null) {
        const sucursal = await getSucursal(request.org!.id, body.sucursal_id);
        if (!sucursal) {
          return reply.code(400).send({ error: "Sucursal inválida" });
        }
      }
      const patch: Parameters<typeof updateAusencia>[2] = {};
      if (body.sucursal_id !== undefined) patch.sucursal_id = body.sucursal_id;
      if (body.fecha_desde !== undefined) patch.fecha_desde = body.fecha_desde;
      if (body.fecha_hasta !== undefined) patch.fecha_hasta = body.fecha_hasta;
      if (body.motivo !== undefined) patch.motivo = body.motivo;
      if (body.detalle !== undefined) patch.detalle = body.detalle;
      if (body.contacto !== undefined) patch.contacto = body.contacto;
      if (body.certificado_pendiente !== undefined) patch.certificado_pendiente = body.certificado_pendiente;
      await updateAusencia(request.org!.id, request.params.id, patch);
      return { ok: true };
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/ausencias/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      await deleteAusencia(request.org!.id, request.params.id);
      return { ok: true };
    }
  );

  app.get("/api/settings/rrhh-categorias", { preHandler: [requireAuth, requireOrg] }, async (request) => ({
    categorias: await getRrhhCategorias(request.org!.id),
  }));

  app.patch<{ Body: CategoriasBody }>(
    "/api/settings/rrhh-categorias",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const categorias = request.body?.categorias;
      if (!Array.isArray(categorias) || categorias.some((c) => typeof c !== "string" || !c.trim())) {
        return reply.code(400).send({ error: "Categorías inválidas" });
      }
      await setRrhhCategorias(request.org!.id, categorias);
      return { ok: true };
    }
  );
}
```

- [ ] **Step 3: Registrar la ruta en `server/src/index.ts`**

Agregar el import `import { rrhhRoutes } from "./routes/rrhh.js";` junto a los demás, y `await app.register(rrhhRoutes);` junto a los demás `await app.register(...)` (después de `turnosRoutes`).

- [ ] **Step 4: Verificar manualmente**

Con el server corriendo (`cd server && npm run dev`, puerto según lo que confirmaste con `lsof` — asumido `3011` en los comandos de abajo, ajustar si es otro):

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

EMPLEADO_ID=$(curl -s http://localhost:3011/api/empleados -H "Authorization: Bearer $TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d)[0].id))')
FAKE_ID="00000000-0000-0000-0000-000000000000"

echo "--- categorías default ---"
curl -s http://localhost:3011/api/settings/rrhh-categorias -H "Authorization: Bearer $TOKEN"
echo

echo "--- crear ausencia válida ---"
curl -s -w " [%{http_code}]" -X POST http://localhost:3011/api/ausencias \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"empleado_id\":\"$EMPLEADO_ID\",\"fecha_desde\":\"2026-08-20\",\"fecha_hasta\":\"2026-08-22\",\"motivo\":\"Enfermedad\",\"certificado_pendiente\":true}"
echo

echo "--- empleado ajeno a la org: debe rechazar (400) ---"
curl -s -w " [%{http_code}]" -X POST http://localhost:3011/api/ausencias \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"empleado_id\":\"$FAKE_ID\",\"fecha_desde\":\"2026-08-20\",\"fecha_hasta\":\"2026-08-20\",\"motivo\":\"Otro\"}"
echo

echo "--- listar con resumen ---"
curl -s http://localhost:3011/api/ausencias -H "Authorization: Bearer $TOKEN"
echo

echo "--- cleanup ---"
AUSENCIA_ID=$(curl -s http://localhost:3011/api/ausencias -H "Authorization: Bearer $TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).ausencias[0].id))')
curl -s -w " [%{http_code}]" -X DELETE "http://localhost:3011/api/ausencias/$AUSENCIA_ID" -H "Authorization: Bearer $TOKEN"
echo
```

Esperado: categorías default `{"categorias":["Enfermedad","Motivo Personal","Licencia","Urgencia"]}`; crear válida da `[200]` con `{"ok":true}`; empleado ajeno da `[400]` con `{"error":"Empleado inválido"}`; listar devuelve `{"ausencias":[...1 fila...],"resumen":{"total":1,"certificadosPendientes":1,...}}`; cleanup da `[200]`.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/rrhh.ts server/src/routes/rrhh.ts server/src/index.ts
git commit -m "feat(server): CRUD de ausencias y rutas de RRHH"
```

---

## Task 3: Funciones de `web/src/lib/api.ts` + `web/src/pages/rrhh/hooks.ts`

**Files:**
- Modify: `web/src/lib/api.ts`
- Create: `web/src/pages/rrhh/hooks.ts`

**Interfaces:**
- Consumes: `request<T>` (`web/src/lib/api.ts`, ya existe); las 6 rutas de la Task 2.
- Produces: `Ausencia`, `ResumenAusencias`, `AusenciasResponse`, `CrearAusenciaInput`, `EditarAusenciaInput` (tipos); `getAusencias`, `createAusencia`, `updateAusencia`, `deleteAusencia`, `getRrhhCategorias`, `setRrhhCategorias` (funciones en `api.ts`); `useAusencias`, `useCrearAusencia`, `useEditarAusencia`, `useBorrarAusencia`, `useRrhhCategorias`, `useGuardarCategorias` (hooks) — consumidos por `RrhhPage` (Task 4).

- [ ] **Step 1: Agregar al final de `web/src/lib/api.ts`**

```ts
export interface Ausencia {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  sucursal_id: string | null;
  sucursal_nombre: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  motivo: string;
  detalle: string | null;
  contacto: string | null;
  certificado_pendiente: boolean;
  created_at: string;
}

export interface ResumenAusencias {
  total: number;
  certificadosPendientes: number;
  porSucursal: Record<string, number>;
  porMotivo: Record<string, number>;
}

export interface AusenciasResponse {
  ausencias: Ausencia[];
  resumen: ResumenAusencias;
}

export function getAusencias(filters: {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
}): Promise<AusenciasResponse> {
  const params = new URLSearchParams();
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  if (filters.sucursalId) params.set("sucursalId", filters.sucursalId);
  if (filters.motivo) params.set("motivo", filters.motivo);
  if (filters.empleadoId) params.set("empleadoId", filters.empleadoId);
  return request(`/api/ausencias?${params}`);
}

export interface CrearAusenciaInput {
  empleado_id: string;
  sucursal_id?: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  motivo: string;
  detalle?: string | null;
  contacto?: string | null;
  certificado_pendiente?: boolean;
}

export function createAusencia(input: CrearAusenciaInput): Promise<{ ok: true }> {
  return request("/api/ausencias", { method: "POST", body: JSON.stringify(input) });
}

export interface EditarAusenciaInput {
  sucursal_id?: string | null;
  fecha_desde?: string;
  fecha_hasta?: string;
  motivo?: string;
  detalle?: string | null;
  contacto?: string | null;
  certificado_pendiente?: boolean;
}

export function updateAusencia(id: string, patch: EditarAusenciaInput): Promise<{ ok: true }> {
  return request(`/api/ausencias/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteAusencia(id: string): Promise<{ ok: true }> {
  return request(`/api/ausencias/${id}`, { method: "DELETE" });
}

export function getRrhhCategorias(): Promise<{ categorias: string[] }> {
  return request("/api/settings/rrhh-categorias");
}

export function setRrhhCategorias(categorias: string[]): Promise<{ ok: true }> {
  return request("/api/settings/rrhh-categorias", { method: "PATCH", body: JSON.stringify({ categorias }) });
}
```

- [ ] **Step 2: Crear `web/src/pages/rrhh/hooks.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAusencias,
  createAusencia,
  updateAusencia,
  deleteAusencia,
  getRrhhCategorias,
  setRrhhCategorias,
  type CrearAusenciaInput,
  type EditarAusenciaInput,
} from "../../lib/api";

export function useAusencias(filters: {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
}) {
  return useQuery({
    queryKey: ["ausencias", filters],
    queryFn: () => getAusencias(filters),
  });
}

export function useCrearAusencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearAusenciaInput) => createAusencia(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ausencias"] }),
  });
}

export function useEditarAusencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarAusenciaInput }) => updateAusencia(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ausencias"] }),
  });
}

export function useBorrarAusencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAusencia(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ausencias"] }),
  });
}

export function useRrhhCategorias() {
  return useQuery({ queryKey: ["rrhh-categorias"], queryFn: getRrhhCategorias });
}

export function useGuardarCategorias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categorias: string[]) => setRrhhCategorias(categorias),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rrhh-categorias"] }),
  });
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web && npm run build
```

Esperado: sin errores. Sin página todavía que use estas funciones/hooks (se conecta en la Task 4).

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/api.ts web/src/pages/rrhh/hooks.ts
git commit -m "feat(web): funciones de API y hooks de RRHH"
```

---

## Task 4: `RrhhPage` (resumen, filtros, tabla, alta/edición) + ruta `/rrhh` + nav

**Files:**
- Create: `web/src/pages/rrhh/RrhhPage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/PanelNav.tsx`

**Interfaces:**
- Consumes: `useEmpleados` (`web/src/pages/empleados/hooks.ts`, ya existe); `useSucursales` (`web/src/pages/sucursales/hooks.ts`, ya existe); `useAusencias`, `useCrearAusencia`, `useEditarAusencia`, `useBorrarAusencia`, `useRrhhCategorias` (Task 3); `Button`, `Field`, `Select`, `Card`, `Dialog`, `IconButton`, `Status`, `Table*` (`web/src/components/ui/*`, ya existen).
- Produces: `RrhhPage` (default export) — consumido por `App.tsx`.

- [ ] **Step 1: Crear `web/src/pages/rrhh/RrhhPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { IconButton } from "../../components/ui/icon-button";
import { Status } from "../../components/ui/status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { Ausencia } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { useAusencias, useCrearAusencia, useEditarAusencia, useBorrarAusencia, useRrhhCategorias } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";
const OTRO = "__otro__";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

const emptyForm = {
  empleado_id: "",
  sucursal_id: "",
  fecha_desde: hoyAR(),
  fecha_hasta: hoyAR(),
  motivoSeleccionado: "",
  motivoLibre: "",
  detalle: "",
  contacto: "",
  certificado_pendiente: false,
};

type FormState = typeof emptyForm;

function motivoFinal(f: FormState): string {
  return f.motivoSeleccionado === OTRO ? f.motivoLibre.trim() : f.motivoSeleccionado;
}

export default function RrhhPage() {
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursales = [] } = useSucursales();
  const { data: categoriasData } = useRrhhCategorias();
  const categorias = categoriasData?.categorias ?? [];
  const opcionesMotivo = [...categorias.map((c) => ({ value: c, label: c })), { value: OTRO, label: "Otro" }];

  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [motivoFiltro, setMotivoFiltro] = useState("");

  const { data, isLoading } = useAusencias({
    desde,
    hasta,
    sucursalId: sucursalFiltro || undefined,
    motivo: motivoFiltro || undefined,
  });
  const ausencias = data?.ausencias ?? [];
  const resumen = data?.resumen;

  const crear = useCrearAusencia();
  const editar = useEditarAusencia();
  const borrar = useBorrarAusencia();

  const [altaOpen, setAltaOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({
        empleado_id: form.empleado_id,
        sucursal_id: form.sucursal_id || null,
        fecha_desde: form.fecha_desde,
        fecha_hasta: form.fecha_hasta,
        motivo: motivoFinal(form),
        detalle: form.detalle || null,
        contacto: form.contacto || null,
        certificado_pendiente: form.certificado_pendiente,
      });
      setForm(emptyForm);
      setAltaOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  function startEdit(a: Ausencia) {
    setEditandoId(a.id);
    setEditForm({
      empleado_id: a.empleado_id,
      sucursal_id: a.sucursal_id ?? "",
      fecha_desde: a.fecha_desde,
      fecha_hasta: a.fecha_hasta,
      motivoSeleccionado: categorias.includes(a.motivo) ? a.motivo : OTRO,
      motivoLibre: categorias.includes(a.motivo) ? "" : a.motivo,
      detalle: a.detalle ?? "",
      contacto: a.contacto ?? "",
      certificado_pendiente: a.certificado_pendiente,
    });
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editar.mutateAsync({
        id,
        patch: {
          sucursal_id: editForm.sucursal_id || null,
          fecha_desde: editForm.fecha_desde,
          fecha_hasta: editForm.fecha_hasta,
          motivo: motivoFinal(editForm),
          detalle: editForm.detalle || null,
          contacto: editForm.contacto || null,
          certificado_pendiente: editForm.certificado_pendiente,
        },
      });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleBorrar(id: string) {
    if (!confirm("¿Borrar esta ausencia?")) return;
    await borrar.mutateAsync(id);
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">RRHH</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <p className="text-[12px] text-text/60">Total</p>
          <p className="text-[24px] font-extrabold text-text">{resumen?.total ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-[12px] text-text/60">Certificados pendientes</p>
          <p className="text-[24px] font-extrabold text-text">{resumen?.certificadosPendientes ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-[12px] text-text/60">Por sucursal</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-text-secondary">
            {resumen &&
              Object.entries(resumen.porSucursal).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
          </ul>
        </Card>
        <Card>
          <p className="text-[12px] text-text/60">Por motivo</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-text-secondary">
            {resumen &&
              Object.entries(resumen.porMotivo).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Field label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-40" />
        <Field label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-40" />
        <Select
          label="Sucursal"
          value={sucursalFiltro}
          onChange={(e) => setSucursalFiltro(e.target.value)}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-48"
        />
        <Select
          label="Motivo"
          value={motivoFiltro}
          onChange={(e) => setMotivoFiltro(e.target.value)}
          options={[{ value: "", label: "Todos" }, ...categorias.map((c) => ({ value: c, label: c }))]}
          containerClassName="w-48"
        />
        <Button variant="primary" className="ml-auto" onClick={() => setAltaOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva ausencia
        </Button>
      </div>

      {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Certificado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            ausencias.map((a) =>
              editandoId === a.id ? (
                <TableRow key={a.id}>
                  <TableCell colSpan={6}>
                    <div className="flex flex-wrap items-end gap-3 py-2">
                      <Select
                        label="Sucursal"
                        value={editForm.sucursal_id}
                        onChange={(e) => setEditForm({ ...editForm, sucursal_id: e.target.value })}
                        options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
                        containerClassName="w-40"
                      />
                      <Field label="Desde" type="date" value={editForm.fecha_desde} onChange={(e) => setEditForm({ ...editForm, fecha_desde: e.target.value })} containerClassName="w-36" />
                      <Field label="Hasta" type="date" value={editForm.fecha_hasta} onChange={(e) => setEditForm({ ...editForm, fecha_hasta: e.target.value })} containerClassName="w-36" />
                      <Select
                        label="Motivo"
                        value={editForm.motivoSeleccionado}
                        onChange={(e) => setEditForm({ ...editForm, motivoSeleccionado: e.target.value })}
                        options={opcionesMotivo}
                        containerClassName="w-40"
                      />
                      {editForm.motivoSeleccionado === OTRO && (
                        <Field label="Motivo (otro)" value={editForm.motivoLibre} onChange={(e) => setEditForm({ ...editForm, motivoLibre: e.target.value })} containerClassName="w-40" />
                      )}
                      <Field label="Detalle" value={editForm.detalle} onChange={(e) => setEditForm({ ...editForm, detalle: e.target.value })} containerClassName="w-40" />
                      <Field label="Contacto" value={editForm.contacto} onChange={(e) => setEditForm({ ...editForm, contacto: e.target.value })} containerClassName="w-40" />
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => handleGuardarEdicion(a.id)}>Guardar</Button>
                        <Button variant="ghost" onClick={() => setEditandoId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={a.id}>
                  <TableCell>{a.empleado_nombre}</TableCell>
                  <TableCell>{a.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>{a.fecha_desde === a.fecha_hasta ? a.fecha_desde : `${a.fecha_desde} – ${a.fecha_hasta}`}</TableCell>
                  <TableCell>{a.motivo}</TableCell>
                  <TableCell>{a.certificado_pendiente ? <Status tone="warning">Pendiente</Status> : "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <IconButton onClick={() => startEdit(a)} icon={<Pencil className="h-3.5 w-3.5" />} label="Editar" />
                      <IconButton onClick={() => handleBorrar(a.id)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Borrar" />
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          {!isLoading && ausencias.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">Sin ausencias en este rango.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={altaOpen} onClose={() => { setAltaOpen(false); setError(null); }} title="Nueva ausencia">
        <form onSubmit={handleAlta} className="flex flex-col gap-3">
          <Select
            label="Empleado"
            value={form.empleado_id}
            onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}
            options={[{ value: "", label: "Elegí un empleado" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
            required
          />
          <Select
            label="Sucursal (opcional)"
            value={form.sucursal_id}
            onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
            options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          />
          <div className="flex gap-3">
            <Field label="Desde" type="date" value={form.fecha_desde} onChange={(e) => setForm({ ...form, fecha_desde: e.target.value })} containerClassName="w-full" required />
            <Field label="Hasta" type="date" value={form.fecha_hasta} onChange={(e) => setForm({ ...form, fecha_hasta: e.target.value })} containerClassName="w-full" required />
          </div>
          <Select
            label="Motivo"
            value={form.motivoSeleccionado}
            onChange={(e) => setForm({ ...form, motivoSeleccionado: e.target.value })}
            options={[{ value: "", label: "Elegí un motivo" }, ...opcionesMotivo]}
            required
          />
          {form.motivoSeleccionado === OTRO && (
            <Field label="Motivo (otro)" value={form.motivoLibre} onChange={(e) => setForm({ ...form, motivoLibre: e.target.value })} containerClassName="w-full" required />
          )}
          <Field label="Detalle (opcional)" value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} containerClassName="w-full" />
          <Field label="Contacto (opcional)" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} containerClassName="w-full" />
          <label className="flex items-center gap-2 text-[14px] text-text">
            <input
              type="checkbox"
              checked={form.certificado_pendiente}
              onChange={(e) => setForm({ ...form, certificado_pendiente: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            Certificado pendiente
          </label>
          {error && <p className="text-[15px] text-accent-700">{error}</p>}
          <Button type="submit" variant="primary" block disabled={crear.isPending}>
            Agregar
          </Button>
        </form>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `web/src/App.tsx`**

Agregar el import `import RrhhPage from "./pages/rrhh/RrhhPage";` junto a los demás, y este bloque de `<Route>` después del de `/turnos` y antes del de `/admin`:

```tsx
            <Route
              path="/rrhh"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <RrhhPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 3: Agregar el link en `web/src/components/PanelNav.tsx`**

En el array `LINKS`, agregar `{ href: "/rrhh", label: "RRHH" }` después de `{ href: "/turnos", label: "Turnos" }`.

- [ ] **Step 4: Verificar que compila**

```bash
cd web && npm run build
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/rrhh/RrhhPage.tsx web/src/App.tsx web/src/components/PanelNav.tsx
git commit -m "feat(web): RrhhPage + ruta y nav"
```

---

## Task 5: Verificación E2E

**Files:** ninguno — es la tarea de cierre, sin cambios de código.

**Interfaces:** ninguna.

- [ ] **Step 1: Confirmar que `server/` y `web/` corren**

```bash
curl -s http://localhost:<puerto-server>/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<puerto-web>/
```

Usar los puertos verificados libres al arrancar (ver Global Constraints — no asumir 3011/5175). Si alguno no responde, levantarlo (`npm run dev` en `server/`, `npx vite --port <puerto>` en `web/`).

- [ ] **Step 2: Checklist manual (para el usuario en el navegador)**

1. Entrar a `http://localhost:<puerto-web>/rrhh` logueado (`demo@test.local`) — confirmar que el link "RRHH" aparece en el nav después de "Turnos", y que la página carga (resumen en 0/vacío si no hay datos todavía).
2. Cargar una ausencia nueva con "Nueva ausencia": elegir empleado, fechas desde/hasta distintas, un motivo de la lista — confirmar que aparece en la tabla y que el resumen (Total, por motivo) se actualiza sin recargar la página.
3. Cargar otra ausencia eligiendo motivo "Otro" y tipeando uno propio — confirmar que se guarda con ese texto y aparece correctamente en la tabla y en "Por motivo" del resumen.
4. Editar una ausencia desde la fila (ícono lápiz), cambiarle el motivo, guardar — confirmar que se refleja en la tabla y en el resumen.
5. Marcar "Certificado pendiente" en una ausencia — confirmar que la columna "Certificado" muestra el estado y que "Certificados pendientes" del resumen lo cuenta.
6. Borrar una ausencia (ícono tacho) — confirmar que desaparece de la tabla y del resumen.
7. Filtrar por sucursal y por motivo — confirmar que la tabla y el resumen se acotan al filtro.
8. Confirmar que el resto del panel (`/`, `/sucursales`, `/empleados`, `/asistencia`, `/horas`, `/turnos`) sigue funcionando sin cambios.

Esperar la confirmación explícita del usuario antes de dar la etapa por cerrada.
