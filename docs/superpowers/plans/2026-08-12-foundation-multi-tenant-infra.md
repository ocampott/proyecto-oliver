# Foundation: Infraestructura Multi-Tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reemplazar la base actual (SQLite + Baileys + auth casera, hecha a
medida para un solo cliente) por una base multi-tenant real sobre Supabase
(Postgres + Auth), y dejar el repositorio limpio de todo el código
específico de un cliente. Este es el Plan 1 de 4 — los planes de Canal de
WhatsApp + Agente IA, Asistencia, y RRHH se construyen encima de esta base
en planes separados.

**Architecture:** Una sola app Next.js (sin proceso de bot separado).
Persistencia y autenticación en Supabase (Postgres con Row Level Security
para aislar cada organización, Supabase Auth para las cuentas). El
middleware verifica sesión; la resolución de a qué organización pertenece
un usuario vive en un helper de servidor, no en el middleware.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase
(`@supabase/supabase-js`, `@supabase/ssr`, CLI local para desarrollo/tests),
Vitest para tests.

**Spec:** `docs/superpowers/specs/2026-08-12-whatsapp-saas-platform-design.md`

## Global Constraints

- Node.js >= 22.5.0 (ya fijado en `.nvmrc` y `package.json` — no tocar).
- Toda tabla de negocio nueva lleva `org_id` y Row Level Security
  habilitado (spec §4).
- v1: un usuario (login) pertenece a una sola organización — se refuerza
  con `unique(user_id)` en `org_members` (spec §8).
- Sin proceso de bot separado: toda la lógica corre dentro de rutas de la
  app Next.js (spec §3).
- Persistencia exclusivamente en Supabase Postgres — al final de este plan
  no debe quedar ningún uso de `node:sqlite` en el repo.

---

## Prerrequisitos manuales (antes de empezar)

Estos pasos no son código — los hace la persona que ejecuta el plan, una
sola vez:

1. Tener Docker corriendo (Supabase CLI levanta Postgres/Auth local en
   contenedores para desarrollo y tests — no hace falta un proyecto de
   Supabase en la nube todavía para este plan).
2. Confirmar que `npx` funciona (`node -v` debe dar >= 22.5.0).

## Task 1: Herramienta de testing (Vitest)

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/lib/__tests__/sanity.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: comando `npm test` corriendo Vitest, usado por todas las
  tareas siguientes.

- [x] **Step 1: Instalar dependencias**

```bash
npm install --save-dev vitest dotenv
```

- [x] **Step 2: Crear configuración de Vitest**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`vitest.setup.ts`:
```ts
import { config } from "dotenv";

// Se crea en la Task 2. Si todavía no existe, dotenv no hace nada.
config({ path: ".env.test.local" });
```

- [x] **Step 3: Agregar script de test**

En `package.json`, dentro de `"scripts"`, agregar:
```json
"test": "vitest run"
```

- [x] **Step 4: Escribir un test que falla a propósito**

`src/lib/__tests__/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("suma 1 + 1", () => {
    expect(1 + 1).toBe(3);
  });
});
```

- [x] **Step 5: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `expected 2 to be 3`

- [x] **Step 6: Corregir el test**

Cambiar `expect(1 + 1).toBe(3);` por `expect(1 + 1).toBe(2);`.

- [x] **Step 7: Correr y verificar que pasa**

Run: `npm test`
Expected: PASS (1 test)

- [x] **Step 8: Commit**

```bash
git add vitest.config.ts vitest.setup.ts src/lib/__tests__/sanity.test.ts package.json package-lock.json
git commit -m "test: agregar Vitest como test runner"
```

## Task 2: Entorno local de Supabase

**Files:**
- Create: `supabase/config.toml` (generado por el CLI)
- Create: `.env.test.local` (gitignored)
- Modify: `.gitignore`
- Modify: `.env.example`

**Interfaces:**
- Produces: stack local de Supabase (Postgres + Auth + API) corriendo en
  `http://127.0.0.1:54321`, con credenciales en `.env.test.local`, usado
  por todas las tareas siguientes que hablan con la base.

- [x] **Step 1: Instalar el CLI de Supabase como dependencia de desarrollo**

```bash
npm install --save-dev supabase
```

- [x] **Step 2: Inicializar el proyecto Supabase**

```bash
npx supabase init
```

Esto crea `supabase/config.toml`, `supabase/migrations/` (vacía) y agrega
su propio `.gitignore` dentro de `supabase/`.

- [x] **Step 3: Levantar el stack local**

```bash
npx supabase start
```

Esto tarda unos minutos la primera vez (baja las imágenes de Docker). Al
terminar, imprime en la terminal algo como:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
```

- [x] **Step 4: Verificar que el stack está corriendo**

Run: `npx supabase status`
Expected: lista de servicios (`API`, `DB`, `Studio`, `Auth`, etc.) todos
con estado activo, mostrando las mismas URLs y keys del paso anterior.

- [x] **Step 5: Guardar las credenciales locales para los tests**

Crear `.env.test.local` (con los valores reales impresos en el Step 3):
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key del Step 3>
SUPABASE_SERVICE_ROLE_KEY=<service_role key del Step 3>
```

- [x] **Step 6: Actualizar `.gitignore`**

Agregar al final de `.gitignore`:
```
# supabase local
.env.test.local
supabase/.branches
supabase/.temp
```

- [x] **Step 7: Documentar las variables en `.env.example`**

Agregar a `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [x] **Step 8: Commit**

```bash
git add supabase/config.toml supabase/migrations .gitignore .env.example
git commit -m "chore: inicializar entorno local de Supabase"
```

## Task 3: Cliente de Supabase (service role) y verificación de conexión

**Files:**
- Create: `src/lib/supabase/service.ts`
- Test: `src/lib/supabase/__tests__/service.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `.env.test.local` (Task 2)
- Produces: `createServiceClient(): SupabaseClient` — cliente con
  privilegios de service role (sin RLS), usado por rutas de servidor
  (webhooks, envío de OTP) y por los tests de integración de las
  siguientes tareas.

- [x] **Step 1: Instalar dependencias**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [x] **Step 2: Escribir el test (falla porque el archivo no existe todavía)**

`src/lib/supabase/__tests__/service.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createServiceClient } from "../service";

describe("createServiceClient", () => {
  it("se conecta al Supabase local y puede listar usuarios", async () => {
    const client = createServiceClient();
    const { data, error } = await client.auth.admin.listUsers();
    expect(error).toBeNull();
    expect(Array.isArray(data?.users)).toBe(true);
  });
});
```

- [x] **Step 3: Correr y verificar que falla**

Run: `npm test -- service.test.ts`
Expected: FAIL — no se puede resolver el módulo `../service`

- [x] **Step 4: Implementar el cliente**

`src/lib/supabase/service.ts`:
```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [x] **Step 5: Correr y verificar que pasa**

Run: `npm test -- service.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/lib/supabase/service.ts src/lib/supabase/__tests__/service.test.ts package.json package-lock.json
git commit -m "feat: cliente de Supabase con service role"
```

## Task 4: Migración — organizations y org_members (con RLS)

**Files:**
- Create: `supabase/migrations/0001_organizations.sql`
- Test: `src/lib/supabase/__tests__/organizations-rls.test.ts`

**Interfaces:**
- Consumes: `createServiceClient` (Task 3)
- Produces: tablas `organizations`, `org_members`, tipo `org_role`. Usado
  por todas las tablas y helpers de tareas siguientes que referencian
  `org_id`.

- [x] **Step 1: Escribir la migración**

`supabase/migrations/0001_organizations.sql`:
```sql
create extension if not exists pgcrypto;

create type org_role as enum ('owner', 'admin', 'agent');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'trial',
  created_at timestamptz not null default now()
);

create table org_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  role org_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (user_id, org_id),
  -- v1: un usuario pertenece a una sola organización (spec §8).
  unique (user_id)
);

alter table organizations enable row level security;
alter table org_members enable row level security;

create policy "members can read their own organization"
  on organizations for select
  using (id in (select org_id from org_members where user_id = auth.uid()));

create policy "members can read their own membership"
  on org_members for select
  using (user_id = auth.uid());
```

- [x] **Step 2: Aplicar la migración al stack local**

Run: `npx supabase db reset`
Expected: termina sin errores, aplicando `0001_organizations.sql` sobre
una base limpia.

- [x] **Step 3: Escribir el test de aislamiento (falla porque `.from("organizations")` todavía no tiene RLS que probar en un entorno vacío — en este caso el test en sí no existe hasta ahora)**

`src/lib/supabase/__tests__/organizations-rls.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "../service";

describe("RLS de organizations", () => {
  const password = "test-password-123";
  const userAEmail = `user-a-${Date.now()}@test.local`;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const service = createServiceClient();

    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: "Org A", slug: `org-a-${Date.now()}` })
      .select()
      .single();
    if (orgAErr) throw orgAErr;
    orgAId = orgA.id;

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: "Org B", slug: `org-b-${Date.now()}` })
      .select()
      .single();
    if (orgBErr) throw orgBErr;
    orgBId = orgB.id;

    const { data: userA, error: userAErr } = await service.auth.admin.createUser(
      { email: userAEmail, password, email_confirm: true }
    );
    if (userAErr) throw userAErr;

    const { error: memberErr } = await service
      .from("org_members")
      .insert({ user_id: userA.user.id, org_id: orgAId, role: "owner" });
    if (memberErr) throw memberErr;
  });

  it("un usuario solo ve su propia organización", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: signInErr } = await anon.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (signInErr) throw signInErr;

    const { data, error } = await anon.from("organizations").select("id");
    expect(error).toBeNull();
    const ids = data?.map((o) => o.id) ?? [];
    expect(ids).toContain(orgAId);
    expect(ids).not.toContain(orgBId);
  });
});
```

- [x] **Step 4: Correr y verificar que pasa**

Run: `npm test -- organizations-rls.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/0001_organizations.sql src/lib/supabase/__tests__/organizations-rls.test.ts
git commit -m "feat: tablas organizations/org_members con RLS"
```

## Task 5: Migración — org_settings y platform_admins (con RLS)

**Files:**
- Create: `supabase/migrations/0002_org_settings_and_admins.sql`
- Test: `src/lib/supabase/__tests__/org-settings-rls.test.ts`

**Interfaces:**
- Consumes: tablas de Task 4
- Produces: tablas `org_settings`, `platform_admins`. Usado por el módulo
  del agente de IA (prompt por organización, Plan 2) y por el panel de
  superadmin (Task 9 de este plan).

- [x] **Step 1: Escribir la migración**

`supabase/migrations/0002_org_settings_and_admins.sql`:
```sql
create table org_settings (
  org_id uuid primary key references organizations (id) on delete cascade,
  system_prompt text not null default '',
  llm_model text not null default 'openai/gpt-4o-mini',
  bot_name text not null default 'Asistente',
  rrhh_categorias jsonb not null default
    '["Enfermedad", "Motivo Personal", "Licencia", "Urgencia"]'::jsonb
);

alter table org_settings enable row level security;

create policy "members can read their org settings"
  on org_settings for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "members can update their org settings"
  on org_settings for update
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

-- Tabla de superadmins de la plataforma (vos, no un cliente). Sin policies
-- de lectura para clientes: solo se consulta desde el servidor con la
-- service role key.
create table platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table platform_admins enable row level security;
```

- [x] **Step 2: Aplicar la migración**

Run: `npx supabase db reset`
Expected: aplica `0001` y `0002` sin errores.

- [x] **Step 3: Escribir el test de aislamiento**

`src/lib/supabase/__tests__/org-settings-rls.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "../service";

describe("RLS de org_settings", () => {
  const password = "test-password-123";
  const userAEmail = `settings-user-a-${Date.now()}@test.local`;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const service = createServiceClient();

    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: "Org Settings A", slug: `org-settings-a-${Date.now()}` })
      .select()
      .single();
    if (orgAErr) throw orgAErr;
    orgAId = orgA.id;

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: "Org Settings B", slug: `org-settings-b-${Date.now()}` })
      .select()
      .single();
    if (orgBErr) throw orgBErr;
    orgBId = orgB.id;

    const { error: settingsErr } = await service
      .from("org_settings")
      .insert([{ org_id: orgAId }, { org_id: orgBId }]);
    if (settingsErr) throw settingsErr;

    const { data: userA, error: userAErr } = await service.auth.admin.createUser(
      { email: userAEmail, password, email_confirm: true }
    );
    if (userAErr) throw userAErr;

    const { error: memberErr } = await service
      .from("org_members")
      .insert({ user_id: userA.user.id, org_id: orgAId, role: "owner" });
    if (memberErr) throw memberErr;
  });

  it("un usuario solo ve la configuración de su propia organización", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: signInErr } = await anon.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (signInErr) throw signInErr;

    const { data, error } = await anon.from("org_settings").select("org_id");
    expect(error).toBeNull();
    const orgIds = data?.map((s) => s.org_id) ?? [];
    expect(orgIds).toContain(orgAId);
    expect(orgIds).not.toContain(orgBId);
  });
});
```

- [x] **Step 4: Correr y verificar que pasa**

Run: `npm test -- org-settings-rls.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/0002_org_settings_and_admins.sql src/lib/supabase/__tests__/org-settings-rls.test.ts
git commit -m "feat: tablas org_settings y platform_admins con RLS"
```

## Task 6: Helpers de organización y superadmin

**Files:**
- Create: `src/lib/org.ts`
- Create: `src/lib/admin.ts`
- Create: `src/lib/organizations.ts`
- Test: `src/lib/__tests__/org.test.ts`
- Test: `src/lib/__tests__/admin.test.ts`
- Test: `src/lib/__tests__/organizations.test.ts`

**Interfaces:**
- Consumes: `createServiceClient` (Task 3), tablas de Task 4/5
- Produces:
  - `getCurrentOrg(userId: string): Promise<Organization | null>` — usado
    por el middleware/páginas (Task 7, Task 8) y por planes futuros.
  - `isPlatformAdmin(userId: string): Promise<boolean>` — usado por la
    ruta de superadmin (Task 9).
  - `createOrganization(input: { name: string; slug: string }): Promise<Organization>`
    — usado por la ruta de superadmin (Task 9).
  - `interface Organization { id: string; name: string; slug: string; plan: string }`

- [x] **Step 1: Test de `getCurrentOrg` (falla, no existe el módulo)**

`src/lib/__tests__/org.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getCurrentOrg } from "../org";
import { createServiceClient } from "../supabase/service";

describe("getCurrentOrg", () => {
  it("devuelve la organización del usuario", async () => {
    const service = createServiceClient();
    const { data: org, error: orgErr } = await service
      .from("organizations")
      .insert({ name: "Org Helper", slug: `org-helper-${Date.now()}` })
      .select()
      .single();
    if (orgErr) throw orgErr;

    const { data: user, error: userErr } = await service.auth.admin.createUser({
      email: `org-helper-${Date.now()}@test.local`,
      password: "test-password-123",
      email_confirm: true,
    });
    if (userErr) throw userErr;

    await service
      .from("org_members")
      .insert({ user_id: user.user.id, org_id: org.id, role: "owner" });

    const result = await getCurrentOrg(user.user.id);
    expect(result?.id).toBe(org.id);
    expect(result?.name).toBe("Org Helper");
  });

  it("devuelve null si el usuario no tiene organización", async () => {
    const service = createServiceClient();
    const { data: user, error: userErr } = await service.auth.admin.createUser({
      email: `org-helper-none-${Date.now()}@test.local`,
      password: "test-password-123",
      email_confirm: true,
    });
    if (userErr) throw userErr;

    const result = await getCurrentOrg(user.user.id);
    expect(result).toBeNull();
  });
});
```

- [x] **Step 2: Run — verificar que falla**

Run: `npm test -- org.test.ts`
Expected: FAIL — módulo `../org` no existe

- [x] **Step 3: Implementar `org.ts`**

`src/lib/org.ts`:
```ts
import { createServiceClient } from "./supabase/service";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export async function getCurrentOrg(userId: string): Promise<Organization | null> {
  const service = createServiceClient();

  const { data: membership, error: membershipErr } = await service
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipErr) throw membershipErr;
  if (!membership) return null;

  const { data: org, error: orgErr } = await service
    .from("organizations")
    .select("id, name, slug, plan")
    .eq("id", membership.org_id)
    .single();
  if (orgErr) throw orgErr;
  return org;
}
```

- [x] **Step 4: Run — verificar que pasa**

Run: `npm test -- org.test.ts`
Expected: PASS (2 tests)

- [x] **Step 5: Test de `isPlatformAdmin` (falla, no existe el módulo)**

`src/lib/__tests__/admin.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { isPlatformAdmin } from "../admin";
import { createServiceClient } from "../supabase/service";

describe("isPlatformAdmin", () => {
  it("es true para un usuario en platform_admins", async () => {
    const service = createServiceClient();
    const { data: user, error } = await service.auth.admin.createUser({
      email: `admin-${Date.now()}@test.local`,
      password: "test-password-123",
      email_confirm: true,
    });
    if (error) throw error;

    await service.from("platform_admins").insert({ user_id: user.user.id });

    expect(await isPlatformAdmin(user.user.id)).toBe(true);
  });

  it("es false para un usuario cualquiera", async () => {
    expect(await isPlatformAdmin(randomUUID())).toBe(false);
  });
});
```

- [x] **Step 6: Run — verificar que falla**

Run: `npm test -- admin.test.ts`
Expected: FAIL — módulo `../admin` no existe

- [x] **Step 7: Implementar `admin.ts`**

`src/lib/admin.ts`:
```ts
import { createServiceClient } from "./supabase/service";

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
```

- [x] **Step 8: Run — verificar que pasa**

Run: `npm test -- admin.test.ts`
Expected: PASS (2 tests)

- [x] **Step 9: Test de `createOrganization` (falla, no existe el módulo)**

`src/lib/__tests__/organizations.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createOrganization } from "../organizations";
import { createServiceClient } from "../supabase/service";

describe("createOrganization", () => {
  it("crea la organización y su fila de settings por defecto", async () => {
    const org = await createOrganization({
      name: "Test Co",
      slug: `test-co-${Date.now()}`,
    });
    expect(org.id).toBeTruthy();
    expect(org.name).toBe("Test Co");

    const service = createServiceClient();
    const { data: settings, error } = await service
      .from("org_settings")
      .select("org_id, bot_name")
      .eq("org_id", org.id)
      .single();
    if (error) throw error;
    expect(settings.bot_name).toBe("Asistente");
  });
});
```

- [x] **Step 10: Run — verificar que falla**

Run: `npm test -- organizations.test.ts`
Expected: FAIL — módulo `../organizations` no existe

- [x] **Step 11: Implementar `organizations.ts`**

`src/lib/organizations.ts`:
```ts
import { createServiceClient } from "./supabase/service";
import type { Organization } from "./org";

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<Organization> {
  const service = createServiceClient();

  const { data: org, error: orgErr } = await service
    .from("organizations")
    .insert({ name: input.name, slug: input.slug })
    .select()
    .single();
  if (orgErr) throw orgErr;

  const { error: settingsErr } = await service
    .from("org_settings")
    .insert({ org_id: org.id });
  if (settingsErr) throw settingsErr;

  return org;
}
```

- [x] **Step 12: Run — verificar que pasa**

Run: `npm test -- organizations.test.ts`
Expected: PASS

- [x] **Step 13: Commit**

```bash
git add src/lib/org.ts src/lib/admin.ts src/lib/organizations.ts src/lib/__tests__/org.test.ts src/lib/__tests__/admin.test.ts src/lib/__tests__/organizations.test.ts
git commit -m "feat: helpers de organización, superadmin y alta de organizaciones"
```

## Task 7: Middleware de sesión con Supabase Auth

**Files:**
- Create: `src/lib/auth/public-paths.ts`
- Create: `src/lib/supabase/server.ts`
- Test: `src/lib/auth/__tests__/public-paths.test.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores directamente (usa `@supabase/ssr`)
- Produces:
  - `isPublicPath(pathname: string): boolean` — usado por el middleware.
  - `createServerClient(): Promise<SupabaseClient>` — cliente de servidor
    con sesión, usado por páginas y route handlers (Task 8, Task 9, y
    planes futuros).

- [x] **Step 1: Test de `isPublicPath` (falla, no existe el módulo)**

`src/lib/auth/__tests__/public-paths.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isPublicPath } from "../public-paths";

describe("isPublicPath", () => {
  it("trata /login como pública", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("trata el callback de auth como público, incluidas subrutas", () => {
    expect(isPublicPath("/api/auth/callback")).toBe(true);
    expect(isPublicPath("/api/auth/callback/whatever")).toBe(true);
  });

  it("trata la raíz del dashboard como protegida", () => {
    expect(isPublicPath("/")).toBe(false);
  });

  it("trata /admin como protegida", () => {
    expect(isPublicPath("/admin")).toBe(false);
  });
});
```

- [x] **Step 2: Run — verificar que falla**

Run: `npm test -- public-paths.test.ts`
Expected: FAIL — módulo `../public-paths` no existe

- [x] **Step 3: Implementar `public-paths.ts`**

`src/lib/auth/public-paths.ts`:
```ts
const PUBLIC_PATHS = ["/login", "/api/auth/callback"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
```

- [x] **Step 4: Run — verificar que pasa**

Run: `npm test -- public-paths.test.ts`
Expected: PASS (4 tests)

- [x] **Step 5: Crear el cliente de servidor**

`src/lib/supabase/server.ts`:
```ts
import { cookies } from "next/headers";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se llama desde un Server Component sin permiso de escritura
            // de cookies; el middleware ya refresca la sesión en ese caso.
          }
        },
      },
    }
  );
}
```

Este cliente depende de `next/headers` y solo funciona dentro de un
request de Next.js — se verifica manualmente en la Task 8 (login) y Task 9
(superadmin), no con Vitest.

- [x] **Step 6: Reescribir el middleware**

Reemplazar todo el contenido de `src/middleware.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isPublicPath } from "@/lib/auth/public-paths";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [x] **Step 7: Commit**

```bash
git add src/lib/auth/public-paths.ts src/lib/auth/__tests__/public-paths.test.ts src/lib/supabase/server.ts src/middleware.ts
git commit -m "feat: middleware de sesión con Supabase Auth"
```

## Task 8: Página de login

**Files:**
- Create: `src/lib/supabase/client.ts`
- Modify: `src/app/login/page.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: nada de tareas anteriores directamente (usa `@supabase/ssr` en
  el navegador)
- Produces: `createBrowserSupabaseClient(): SupabaseClient` — usado por
  cualquier componente cliente que necesite auth (esta página, y planes
  futuros).

- [x] **Step 1: Crear el cliente de navegador**

`src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [x] **Step 2: Reemplazar la página de login**

Reemplazar todo el contenido de `src/app/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      setError("Email o contraseña incorrectos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border p-6"
      >
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
```

- [x] **Step 3: Verificación manual**

Esta página depende de cookies/sesión real de navegador — no se cubre con
Vitest. Verificar a mano:

1. Run: `npm run dev`
2. Crear un usuario de prueba: `npx supabase status` para confirmar la
   Studio URL local (normalmente `http://127.0.0.1:54323`), abrir
   Authentication → Add user, cargar email/contraseña.
3. Visitar `http://localhost:3000/login`, loguearse con ese usuario.
4. Confirmar que redirige a `/` (aunque esa página todavía no exista de
   forma completa hasta la Task 10 — puede dar 404 por ahora, lo que
   importa acá es que la sesión se haya creado sin error).

- [x] **Step 4: Commit**

```bash
git add src/lib/supabase/client.ts src/app/login/page.tsx
git commit -m "feat: página de login con Supabase Auth"
```

## Task 9: Panel de superadmin básico

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/app/api/admin/organizations/route.ts`

**Interfaces:**
- Consumes: `createServerClient` (Task 7), `isPlatformAdmin`,
  `createOrganization` (Task 6)
- Produces: ruta `/admin` (UI) y `POST /api/admin/organizations`

- [x] **Step 1: Implementar la ruta de API**

`src/app/api/admin/organizations/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { createOrganization } from "@/lib/organizations";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isPlatformAdmin(user.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { name?: string; slug?: string }
    | null;
  if (!body?.name || !body?.slug) {
    return NextResponse.json(
      { error: "name y slug son requeridos" },
      { status: 400 }
    );
  }

  try {
    const org = await createOrganization({ name: body.name, slug: body.slug });
    return NextResponse.json({ organization: org });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear la organización";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [x] **Step 2: Implementar la página**

`src/app/admin/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin } from "@/lib/admin";

export default async function AdminPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (!(await isPlatformAdmin(user.id))) {
    redirect("/");
  }

  const service = createServiceClient();
  const { data: organizations, error } = await service
    .from("organizations")
    .select("id, name, slug, plan, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Organizaciones</h1>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nombre</th>
            <th className="border-b p-2">Slug</th>
            <th className="border-b p-2">Plan</th>
            <th className="border-b p-2">Alta</th>
          </tr>
        </thead>
        <tbody>
          {organizations?.map((org) => (
            <tr key={org.id}>
              <td className="border-b p-2">{org.name}</td>
              <td className="border-b p-2">{org.slug}</td>
              <td className="border-b p-2">{org.plan}</td>
              <td className="border-b p-2">
                {new Date(org.created_at).toLocaleDateString("es-AR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

Nota: el alta de organizaciones vía `POST /api/admin/organizations` se
usa por ahora con `curl`/Postman (Step 3) — un formulario en esta página
es una mejora de UI que no bloquea el resto del plan; se puede sumar sin
tocar la API.

- [x] **Step 3: Verificación manual**

1. En Supabase Studio local, insertar manualmente una fila en
   `platform_admins` con el `user_id` del usuario de prueba creado en la
   Task 8 (tabla `platform_admins`, columna `user_id`).
2. Con `npm run dev` corriendo y logueado como ese usuario, visitar
   `http://localhost:3000/admin` — debe mostrar la tabla (vacía al
   principio).
3. Probar el alta:
   ```bash
   curl -X POST http://localhost:3000/api/admin/organizations \
     -H "Content-Type: application/json" \
     -H "Cookie: <cookies de la sesión del navegador logueado>" \
     -d '{"name": "Cliente de prueba", "slug": "cliente-prueba"}'
   ```
   Expected: `{"organization": {...}}` y la nueva fila aparece al
   refrescar `/admin`.
4. Deslogueado (o con un usuario sin fila en `platform_admins`), visitar
   `/admin` — debe redirigir a `/` (o a `/login` si no hay sesión).

- [x] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/app/api/admin/organizations/route.ts
git commit -m "feat: panel de superadmin básico"
```

## Task 10: Limpieza de código legado

**Files:**
- Delete: `src/lib/baileys/` (directorio completo)
- Delete: `scripts/` (directorio completo)
- Delete: `ecosystem.config.js`, `Procfile`, `nixpacks.toml`
- Delete: `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/nomina.ts`,
  `src/lib/system-prompt.ts`, `src/lib/rrhh-flow.ts`
- Delete: `src/components/QRScreen.tsx`, `src/components/ConnectionGate.tsx`,
  `src/components/ConversationList.tsx`, `src/components/ConversationPanel.tsx`,
  `src/components/MessageBubble.tsx`, `src/components/ModeToggle.tsx`,
  `src/components/DashboardHeader.tsx`, `src/components/PageHeader.tsx`,
  `src/components/EmpleadoMultiSelect.tsx`
- Delete: `src/app/api/asistencia/`, `src/app/api/empleados/`,
  `src/app/api/rrhh/`, `src/app/api/sucursales/`, `src/app/api/connection/`,
  `src/app/api/conversations/`, `src/app/api/messages/`, `src/app/api/mode/`
  (directorios completos)
- Delete: `src/app/asistencia/`, `src/app/empleados/`, `src/app/rrhh/`,
  `src/app/horas/`, `src/app/sucursales/` (directorios completos)
- Delete: `Informe_Sanca_SanCayetano.docx`, `CLAUDE PROYECTO.code-workspace`
- Modify: `src/lib/openrouter.ts`, `src/app/layout.tsx`, `src/app/page.tsx`,
  `package.json`

**Interfaces:**
- Consumes: `getCurrentOrg` (Task 6)
- Produces: `generateReply(history: ChatMessage[], systemPrompt: string): Promise<string>`
  — firma nueva que usará el Plan 2 para pasar el prompt de
  `org_settings` en vez de un import estático.

> Nota: los componentes de conversaciones que se borran acá
> (`ConversationList`, `ConversationPanel`, `MessageBubble`, `ModeToggle`,
> `DashboardHeader`, `PageHeader`) siguen disponibles en el historial de
> git (commits previos a este) como referencia — el Plan 2 los reconstruye
> contra el esquema nuevo de `conversations`/`messages` en vez de intentar
> mantenerlos compilando a medio camino sin esas tablas.

- [x] **Step 1: Borrar los directorios y archivos de infraestructura vieja**

```bash
git rm -r src/lib/baileys scripts
git rm ecosystem.config.js Procfile nixpacks.toml
```

- [x] **Step 2: Borrar el acceso a datos y lógica de negocio vieja**

```bash
git rm src/lib/db.ts src/lib/auth.ts src/lib/nomina.ts src/lib/system-prompt.ts src/lib/rrhh-flow.ts
```

- [x] **Step 3: Borrar componentes acoplados al flujo viejo**

```bash
git rm src/components/QRScreen.tsx src/components/ConnectionGate.tsx \
  src/components/ConversationList.tsx src/components/ConversationPanel.tsx \
  src/components/MessageBubble.tsx src/components/ModeToggle.tsx \
  src/components/DashboardHeader.tsx src/components/PageHeader.tsx \
  src/components/EmpleadoMultiSelect.tsx
```

- [x] **Step 4: Borrar rutas de API y páginas del cliente anterior**

```bash
git rm -r src/app/api/asistencia src/app/api/empleados src/app/api/rrhh \
  src/app/api/sucursales src/app/api/connection src/app/api/conversations \
  src/app/api/messages src/app/api/mode
git rm -r src/app/asistencia src/app/empleados src/app/rrhh src/app/horas src/app/sucursales
```

- [x] **Step 5: Borrar archivos sueltos sin relación con el producto**

```bash
git rm "Informe_Sanca_SanCayetano.docx" "CLAUDE PROYECTO.code-workspace"
```

- [x] **Step 6: Adaptar `openrouter.ts` para no depender del prompt hardcodeado**

En `src/lib/openrouter.ts`, quitar el import `import { SYSTEM_PROMPT } from
"./system-prompt";` y cambiar la firma de `generateReply`:

Antes:
```ts
export async function generateReply(history: ChatMessage[]): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    max_tokens: 600,
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}
```

Después:
```ts
export async function generateReply(
  history: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...history],
    max_tokens: 600,
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}
```

`parseDetalle` no cambia — no depende de `SYSTEM_PROMPT`.

- [x] **Step 7: Genericizar el layout raíz**

En `src/app/layout.tsx`, reemplazar el `metadata` hardcodeado:

Antes:
```ts
export const metadata: Metadata = {
  title: "Sanca — Panadería San Cayetano II",
  description: "Dashboard de gestión de conversaciones — Panadería San Cayetano II",
};
```

Después:
```ts
export const metadata: Metadata = {
  title: "Dashboard",
  description: "Panel de gestión de conversaciones de WhatsApp",
};
```

- [x] **Step 8: Reemplazar la página de inicio**

Reemplazar todo el contenido de `src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

export default async function Home() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const org = await getCurrentOrg(user.id);
  if (!org) {
    return (
      <main className="p-8">
        <p>
          Tu cuenta todavía no está asociada a ninguna organización.
          Contactá a soporte.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{org.name}</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Dashboard en construcción — el módulo de conversaciones se suma en
        la próxima etapa.
      </p>
    </main>
  );
}
```

- [x] **Step 9: Limpiar `package.json`**

Quitar del bloque `"scripts"`:
```json
"start:bot": "tsx scripts/start-bot.ts",
"start:all": "concurrently --kill-others --names BOT,WEB --prefix-colors yellow,cyan \"npm run start:bot\" \"npm run dev\""
```

Quitar el bloque `"overrides"` completo (era solo para fijar una
dependencia transitiva de Baileys):
```json
"overrides": {
  "whatsapp-rust-bridge": "0.5.5"
},
```

Correr:
```bash
npm uninstall @whiskeysockets/baileys concurrently pino qrcode-terminal @types/qrcode-terminal
```

`qrcode` y `exceljs` se mantienen — los va a necesitar el módulo de
Asistencia (Plan 3, QR propio) y RRHH (Plan 4, exportar a Excel).

- [x] **Step 10: Verificar que el proyecto compila**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [x] **Step 11: Verificar que los tests siguen pasando**

Run: `npm test`
Expected: todos los tests de las Tasks 1–9 en verde.

- [x] **Step 12: Verificación manual del arranque**

1. Run: `npm run dev`
2. Visitar `/login`, loguearse con el usuario de prueba.
3. Confirmar que `/` muestra el nombre de una organización (si el usuario
   de prueba tiene `org_members`) o el mensaje de "sin organización".
4. Confirmar que `/admin` sigue funcionando igual que en la Task 9.

- [x] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: eliminar código específico de San Cayetano y stack de Baileys/PM2"
```

---

## Qué queda listo después de este plan

- Multi-tenancy real (`organizations`, `org_members`, `org_settings`,
  `platform_admins`) con RLS probado.
- Login funcional vía Supabase Auth.
- Panel de superadmin mínimo.
- Repositorio sin ningún rastro de Baileys, PM2, SQLite, ni código
  específico de San Cayetano.
- `openrouter.ts` listo para recibir el prompt por parámetro (lo que el
  Plan 2 necesita para leerlo de `org_settings`).

## Qué NO incluye este plan (queda para los siguientes)

- Plan 2: canal de WhatsApp Cloud API, webhook, Embedded Signup,
  dashboard de conversaciones, modo IA/Humano.
- Plan 3: módulo de Asistencia (sucursales, empleados, QR propio,
  vinculación por OTP, geocerca, horas).
- Plan 4: módulo de RRHH (ausencias/licencias/urgencias, reutilizando
  identidad y sucursales del Plan 3).
