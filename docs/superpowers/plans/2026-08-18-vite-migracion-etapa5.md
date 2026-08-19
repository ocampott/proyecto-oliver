# Migración a Vite — Etapa 5 (Admin + baja completa de Next.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el panel de superadmin (`/admin`, alta y listado de organizaciones) de Next.js a `web/`+`server/`, y dar de baja Next.js del repo por completo — es la última etapa, no queda nada del stack viejo al cerrar.

**Architecture:** `server/` gana un preHandler `requirePlatformAdmin` (encadenado después de `requireAuth`, sin `requireOrg` — un platform admin puede no tener organización) y un módulo de rutas nuevo (`admin.ts`) que porta 1:1 la lógica ya existente en `src/lib/{admin,organizations}.ts`. `web/` gana una pantalla nueva (`/admin`, sin link en el nav — acceso solo por URL directa) construida con los mismos componentes ya retocados a Modernist en la Etapa 4. Al final, todo `src/` de Next.js, sus configs y sus dependencias en el `package.json` raíz se borran.

**Tech Stack:** Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-08-18-vite-migration-etapa5-design.md`

## Global Constraints

- **Sin auto-redirect por rol tras el login** — un platform admin llega a
  `/admin` escribiendo la URL a mano, no hay detección de rol en el flujo
  de login de `web/`. Decisión explícita del usuario (YAGNI).
- **Sin link a `/admin` en `PanelNav`** — sigue siendo acceso directo, no
  parte de la navegación del panel de organización.
- **El rol de platform admin lo verifica el server, no el cliente** —
  `web/`'s `ProtectedRoute` solo chequea que haya sesión; si el usuario no
  es platform admin, el servidor devuelve 403 y `AdminPage` muestra el
  error, mismo patrón que `HomePage` con `getOrgActual`.
- Sin tests automatizados nuevos — verificación manual vía curl/build, y
  al final una pasada del usuario en el navegador (decisión explícita del
  usuario: sin inversión en tests automatizados en este proyecto por
  ahora).
- **Al borrar Next.js, `scripts/seed-demo.js` sigue vivo tal cual está** —
  lee `.env.local` (raíz) parseando el archivo a mano y usa
  `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` por nombre
  literal — esas dos variables (y el archivo `.env.local` raíz) **no se
  borran ni se renombran**, aunque el prefijo `NEXT_PUBLIC_` ya no
  signifique nada sin Next.js.
- Todo lo que se borra del `package.json` raíz está confirmado sin
  consumidores fuera de `src/` (verificado con grep antes de escribir este
  plan) — `@supabase/supabase-js` sigue siendo dependencia porque
  `scripts/seed-demo.js` la usa directo.

---

## Task 1: `requirePlatformAdmin` + libs de admin en `server/`

**Files:**
- Create: `server/src/plugins/require-platform-admin.ts`
- Create: `server/src/lib/admin.ts`
- Create: `server/src/lib/organizations.ts`

**Interfaces:**
- Consumes: `request.user` (decorado por `requireAuth`), `Organization` (`server/src/lib/org.ts`, ya existe).
- Produces: `requirePlatformAdmin` (preHandler) — se usa siempre después de `requireAuth`, NUNCA después de `requireOrg`: `{ preHandler: [requireAuth, requirePlatformAdmin] }`. `isPlatformAdmin(userId)`, `createOrganization({name, slug})` — consumidos por `server/src/routes/admin.ts` (Task 2).

- [ ] **Step 1: Crear `server/src/lib/admin.ts`**

```ts
import { createServiceClient } from "./supabase-service.js";

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

- [ ] **Step 2: Crear `server/src/lib/organizations.ts`**

```ts
import { createServiceClient } from "./supabase-service.js";
import type { Organization } from "./org.js";

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
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

- [ ] **Step 3: Crear `server/src/plugins/require-platform-admin.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import { isPlatformAdmin } from "../lib/admin.js";

/**
 * Debe encadenarse siempre después de requireAuth (necesita request.user
 * ya resuelto): `{ preHandler: [requireAuth, requirePlatformAdmin] }`.
 * A diferencia de requireOrg, NO requiere que el usuario tenga una
 * organización — un platform admin puede no tener ninguna.
 */
export async function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const isAdmin = await isPlatformAdmin(request.user!.id);
  if (!isAdmin) {
    reply.code(403).send({ error: "No autorizado" });
  }
}
```

- [ ] **Step 4: Verificar que compila**

```bash
cd server
npm run typecheck
```

Esperado: sin errores. Sin consumidor todavía (ninguna ruta lo usa hasta la Task 2) — es esperable.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/admin.ts server/src/lib/organizations.ts server/src/plugins/require-platform-admin.ts
git commit -m "feat(server): preHandler requirePlatformAdmin + libs de admin"
```

---

## Task 2: Rutas de admin en `server/`

**Files:**
- Create: `server/src/routes/admin.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth` (`server/src/plugins/auth.js`), `requirePlatformAdmin` (Task 1), `createOrganization` (Task 1), `createServiceClient` (`server/src/lib/supabase-service.js`, ya existe).
- Produces: `adminRoutes` (Fastify plugin) con `GET/POST /api/admin/organizations`.

- [ ] **Step 1: Crear `server/src/routes/admin.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requirePlatformAdmin } from "../plugins/require-platform-admin.js";
import { createServiceClient } from "../lib/supabase-service.js";
import { createOrganization } from "../lib/organizations.js";

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

interface CrearBody {
  name?: string;
  slug?: string;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/admin/organizations",
    { preHandler: [requireAuth, requirePlatformAdmin] },
    async (): Promise<OrganizationRow[]> => {
      const service = createServiceClient();
      const { data, error } = await service
        .from("organizations")
        .select("id, name, slug, plan, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  );

  app.post<{ Body: CrearBody }>(
    "/api/admin/organizations",
    { preHandler: [requireAuth, requirePlatformAdmin] },
    async (request, reply) => {
      const { name, slug } = request.body ?? {};
      if (!name?.trim() || !slug?.trim()) {
        return reply.code(400).send({ error: "name y slug son requeridos" });
      }
      try {
        const org = await createOrganization({ name: name.trim(), slug: slug.trim() });
        return reply.code(201).send(org);
      } catch (e) {
        return reply.code(400).send({
          error: e instanceof Error ? e.message : "Error al crear la organización",
        });
      }
    }
  );
}
```

- [ ] **Step 2: Registrar la ruta en `server/src/index.ts`**

Agregar el import `import { adminRoutes } from "./routes/admin.js";` junto a los demás, y `await app.register(adminRoutes);` junto a los demás `await app.register(...)`.

- [ ] **Step 3: Verificar manualmente (chequeo de seguridad — usuario NO admin)**

Con el server corriendo (`cd server && npm run dev`):

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

echo "--- demo@test.local NO es platform admin: debe dar 403 ---"
curl -s -w " [%{http_code}]" http://localhost:3001/api/admin/organizations -H "Authorization: Bearer $TOKEN"
echo
curl -s -w " [%{http_code}]" -X POST http://localhost:3001/api/admin/organizations \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"No debería crearse","slug":"no-deberia"}'
echo
```

Esperado: ambas responden `403 {"error":"No autorizado"}` (`demo@test.local` no está en `platform_admins`). El camino "sí es admin" (200/201) se verifica en la Task 5, con el usuario real del que hace la etapa dado de alta en `platform_admins`.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/admin.ts server/src/index.ts
git commit -m "feat(server): rutas de admin (listar/crear organizaciones)"
```

---

## Task 3: Funciones de admin en `web/src/lib/api.ts`

**Files:**
- Modify: `web/src/lib/api.ts`

**Interfaces:**
- Produces: `OrganizationAdmin`, `CrearOrganizacionInput`, `listOrganizationsAdmin()`, `createOrganizationAdmin(input)` — consumidos por `web/src/pages/admin/hooks.ts` (Task 4).

- [ ] **Step 1: Agregar las funciones al final de `web/src/lib/api.ts`**

Agregar después de `getHoras` (el final actual del archivo):

```ts

export interface OrganizationAdmin {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

export function listOrganizationsAdmin(): Promise<OrganizationAdmin[]> {
  return request("/api/admin/organizations");
}

export interface CrearOrganizacionInput {
  name: string;
  slug: string;
}

export function createOrganizationAdmin(input: CrearOrganizacionInput): Promise<OrganizationAdmin> {
  return request("/api/admin/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/api.ts
git commit -m "feat(web): funciones de admin en api.ts"
```

---

## Task 4: `AdminPage` + hooks + ruta

**Files:**
- Create: `web/src/pages/admin/hooks.ts`
- Create: `web/src/pages/admin/AdminPage.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `listOrganizationsAdmin`/`createOrganizationAdmin`/`ApiError` (Task 3), `Button`/`Input`/`Table*` (Etapa 4, ya retocados a Modernist).
- Produces: `AdminPage` (default export), ruta `/admin` en `App.tsx`.

- [ ] **Step 1: Crear `web/src/pages/admin/hooks.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listOrganizationsAdmin, createOrganizationAdmin, type CrearOrganizacionInput } from "../../lib/api";

const QUERY_KEY = ["admin-organizations"];

export function useOrganizacionesAdmin() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listOrganizationsAdmin });
}

export function useCrearOrganizacionAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearOrganizacionInput) => createOrganizationAdmin(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
```

- [ ] **Step 2: Crear `web/src/pages/admin/AdminPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import { ApiError } from "../../lib/api";
import { useOrganizacionesAdmin, useCrearOrganizacionAdmin } from "./hooks";

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

export default function AdminPage() {
  const { data: organizaciones = [], isLoading, isError, error } = useOrganizacionesAdmin();
  const crear = useCrearOrganizacionAdmin();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await crear.mutateAsync({ name, slug });
      setName("");
      setSlug("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  if (isError) {
    const noAutorizado = error instanceof ApiError && error.status === 403;
    return (
      <main className="p-8">
        <p className="text-[15px] text-text">
          {noAutorizado
            ? "No tenés acceso a esta sección."
            : "No se pudieron cargar las organizaciones. Probá de nuevo."}
        </p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl">
        <h1 className="text-[32px] font-extrabold text-text">Organizaciones</h1>

        <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
          <Input required placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input required placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Button type="submit" variant="accent" disabled={crear.isPending}>
            Agregar
          </Button>
        </form>

        {formError && <p className="mt-2 text-[15px] text-accent-700">{formError}</p>}

        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-text/60">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              organizaciones.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>{org.name}</TableCell>
                  <TableCell>{org.slug}</TableCell>
                  <TableCell>{org.plan}</TableCell>
                  <TableCell>{fechaLocal(org.created_at)}</TableCell>
                </TableRow>
              ))}
            {!isLoading && organizaciones.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-text/60">
                  Todavía no hay organizaciones.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Agregar la ruta a `web/src/App.tsx`**

Agregar el import `import AdminPage from "./pages/admin/AdminPage";` junto a los demás, y esta ruta dentro de `<Routes>` (junto a las demás, antes de `/marcar/:org/:sucursal`) — **sin `PanelLayout`**, a diferencia de las rutas del panel de organización:

```tsx
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 4: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/admin/hooks.ts web/src/pages/admin/AdminPage.tsx web/src/App.tsx
git commit -m "feat(web): AdminPage + ruta /admin"
```

---

## Task 5: Verificación E2E + baja completa de Next.js

**Files:**
- Delete: `src/` (completo), `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `tsconfig.json` (raíz), `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json` (raíz), `README.md`, `AGENTS.md`

**Interfaces:** ninguna — es la tarea de cierre de la etapa y del proyecto de migración completo.

- [ ] **Step 1: Confirmar que `server/` y `web/` siguen corriendo**

```bash
curl -s http://localhost:3001/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

Si alguno no responde, levantarlo de nuevo (`npm run dev` en `server/` y en `web/`).

- [ ] **Step 2: Dar de alta al usuario de prueba como platform admin**

Con Supabase local corriendo, abrir el Studio (http://127.0.0.1:54323) →
SQL Editor, y correr (reemplazando el email si se usa un usuario distinto
a `demo@test.local`):

```sql
insert into platform_admins (user_id)
select id from auth.users where email = 'demo@test.local';
```

- [ ] **Step 3: Verificar manualmente (chequeo — usuario SÍ admin)**

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

echo "--- listar (ahora sí admin) ---"
curl -s -w " [%{http_code}]" http://localhost:3001/api/admin/organizations -H "Authorization: Bearer $TOKEN"
echo

echo "--- crear ---"
curl -s -w " [%{http_code}]" -X POST http://localhost:3001/api/admin/organizations \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Org de Prueba Etapa 5","slug":"org-prueba-etapa-5"}'
echo
```

Esperado: listar da `200` con un array (incluye al menos la org demo); crear da `201` con la organización nueva.

- [ ] **Step 4: Checklist manual (para el usuario en el navegador)**

1. Entrar a `http://localhost:5173/admin` logueado como `demo@test.local` (ya dado de alta como platform admin en el Step 2) — confirmar que se ve el listado de organizaciones, incluida la creada por curl en el Step 3.
2. Dar de alta una organización nueva desde el form — confirmar que aparece en la tabla sin recargar la página.
3. Confirmar que `/admin` no aparece como link en el nav del panel (`http://localhost:5173/`) — sigue siendo acceso directo por URL.
4. Confirmar que el resto del panel (`/`, `/sucursales`, `/empleados`, `/asistencia`, `/horas`) sigue funcionando sin cambios.

Esperar la confirmación explícita del usuario antes de continuar al Step 5.

- [ ] **Step 5: Borrar Next.js — archivos**

```bash
git rm -r src next.config.ts next-env.d.ts postcss.config.mjs tsconfig.json vitest.config.ts vitest.setup.ts
```

**No borrar** `.env.local`, `.env.example`, `.env.test.local` (aunque `vitest.setup.ts` ya no exista, `.env.test.local` es un archivo local no versionado — no hace falta tocarlo) ni `scripts/seed-demo.js` — `.env.local` sigue siendo necesario para el seed script, con sus mismos nombres de variable (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

- [ ] **Step 6: Reemplazar `package.json` (raíz) completo**

```json
{
  "name": "agente-whatsapp",
  "version": "1.0.0",
  "private": true,
  "engines": {
    "node": ">=22.5.0"
  },
  "scripts": {
    "dev:all": "concurrently -n server,web -c green,magenta \"npm run dev --prefix server\" \"npm run dev --prefix web\""
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.112.3"
  },
  "devDependencies": {
    "concurrently": "^10.0.4",
    "supabase": "^2.114.0"
  }
}
```

Este reemplazo saca: `next`, `@supabase/ssr`, `exceljs`, `openai`,
`qrcode`, `react`, `react-dom`, `tsx` (dependencies — todas sin
consumidores fuera de `src/`, confirmado antes de escribir este plan) y
`@tailwindcss/postcss`, `@types/node`, `@types/qrcode`, `@types/react`,
`@types/react-dom`, `dotenv`, `tailwindcss`, `typescript`, `vitest`
(devDependencies — mismo motivo). Mantiene `@supabase/supabase-js`
(la usa `scripts/seed-demo.js` directo), `concurrently` (la usa
`dev:all`) y `supabase` (CLI, para `npx supabase start`/`db reset`
independientemente de qué frontend/backend haya).

- [ ] **Step 7: Regenerar `package-lock.json`**

```bash
npm install
```

- [ ] **Step 8: Reemplazar `README.md` completo**

```markdown
# Oliver

Plataforma multi-tenant (SaaS) para control de asistencia. **Vite + React**
(frontend, `web/`) y **Fastify** (backend, `server/`), con persistencia y
autenticación en Supabase (Postgres con Row Level Security + Supabase
Auth). Cada cliente tiene su propia organización con datos completamente
aislados.

El diseño completo está en
`docs/superpowers/specs/2026-08-12-whatsapp-saas-platform-design.md` y los
planes de implementación en `docs/superpowers/plans/`.

## Requisitos

- Node.js >= 22.5.0
- Docker corriendo (para el stack local de Supabase)

## Setup rápido

\`\`\`bash
# 1. Instalar dependencias (raíz, server/ y web/)
npm install
npm install --prefix server
npm install --prefix web

# 2. Levantar el stack local de Supabase (Postgres + Auth + API + Studio)
npx supabase start

# 3. Crear los archivos de variables de entorno con las keys locales
#    (las imprime `npx supabase status` -o env)
cp .env.example .env.local
cp server/.env.example server/.env.local
cp web/.env.example web/.env.local
# Editá los tres .env.local con los valores del paso anterior

# 4. Aplicar las migraciones (esto también borra todo dato existente)
npx supabase db reset

# 5. Crear el usuario/org/sucursal/empleado de prueba (idempotente)
node scripts/seed-demo.js

# 6. Levantar todo
npm run dev:all
\`\`\`

Después entrá a `http://localhost:5173`. Si tu usuario tiene rol de
platform admin (ver "Probar el panel de superadmin" más abajo), el panel
de superadmin está en `http://localhost:5173/admin` — sin link en el nav,
acceso directo por URL.

Studio de Supabase (UI de la base local): http://127.0.0.1:54323

## Variables de entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de la API de Supabase (`http://127.0.0.1:54321` en local) — nombre heredado de cuando el proyecto era Next.js; hoy la lee `scripts/seed-demo.js` desde `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Key de service role (solo servidor, salta RLS) — la lee `scripts/seed-demo.js` |

`server/.env.local` y `web/.env.local` tienen sus propias variables — ver
`server/.env.example` y `web/.env.example`. `web/.env.local` es
**requerido** (no opcional): `web/src/lib/supabase.ts` tira una excepción
al cargar el módulo si faltan `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`,
lo que rompe toda la SPA.

## Correr todo en dev

\`\`\`bash
# Con Supabase local corriendo (npx supabase start):
npm run dev:all
\`\`\`

Levanta Fastify (`:3001`, la API) y Vite (`:5173`, el panel de
organización completo, el panel de superadmin y el flujo público
`/marcar`). También se pueden levantar por separado con `npm run dev
--prefix server` y `npm run dev --prefix web`.

## Probar el marcado de asistencia localmente

1. Entrá con un usuario que tenga una organización (`demo@test.local` en el
   seed de pruebas, o creá la tuya).
2. En `/sucursales`, dale **Ver QR** a una sucursal con lat/lon cargados —
   la URL que apunta el QR es `/marcar/{orgSlug}/{sucursalId}`.
3. Abrí esa URL (podés escanear el QR o pegarla en otra pestaña/incógnito).
4. Escribí tu nombre y apellido tal como está cargado en `/empleados`. Si no
   matchea exacto te va a sugerir el más parecido.
5. Pedí el código de vinculación en `/empleados` (botón **Generar código**
   en la fila del empleado) y cargalo en la página de marcado.
6. Con el dispositivo ya vinculado, tocá **Marcar entrada** — el navegador
   va a pedir geolocalización (obligatoria: sin ubicación no se puede
   marcar). Si estás fuera del radio de la sucursal, el intento queda en
   "Intentos rechazados" en `/asistencia` para aprobar o descartar a mano.
7. Los turnos completos (entrada + salida) se ven en `/horas` con el total
   de horas por empleado.

## Probar el panel de superadmin localmente

`/admin` requiere que tu usuario esté en la tabla `platform_admins`. Para
dártelo de alta en local, abrí el Studio de Supabase
(http://127.0.0.1:54323) → SQL Editor, y corré:

\`\`\`sql
insert into platform_admins (user_id)
select id from auth.users where email = 'demo@test.local';
\`\`\`

Entrá a `http://localhost:5173/admin` — vas a ver el listado de
organizaciones y un form para dar de alta una nueva.

## Estado del refactor

- **Plan 1 — Foundation (hecho)**: multi-tenancy real (`organizations`,
  `org_members`, `org_settings`, `platform_admins`) con RLS probado, login
  con Supabase Auth, panel de superadmin, y repositorio limpio del stack
  anterior (Baileys, SQLite, PM2, código específico de un cliente).
- **Plan 2 — Módulo de Asistencia multi-sucursal (hecho)**: alta de
  sucursales y empleados con QR, vínculo dispositivo↔empleado por OTP,
  marcado público de entrada/salida con geocerca, revisión de intentos
  rechazados y cálculo de horas trabajadas. Detalle completo en
  `docs/superpowers/plans/2026-08-13-asistencia-multi-sucursal.md`.
- **Plan 3 — Canal de WhatsApp Cloud API + agente IA**: pendiente (Embedded
  Signup + webhook + dashboard de conversaciones, sin IA al principio).
- **Plan 4 — Módulo de RRHH**: pendiente (reutiliza `empleados`,
  `sucursales` y el vínculo de identidad de Asistencia).
- **Migración de Next.js a Vite + Fastify (hecho)**: el panel completo
  (organización + superadmin) y el flujo público `/marcar` viven en `web/`
  (Vite + React) + `server/` (Fastify), con el sistema de diseño
  "Modernist" aplicado. Detalle de las 5 etapas en
  `docs/superpowers/plans/` y `docs/superpowers/specs/` (archivos
  `vite-migra*`).

## Estructura

- `web/` — frontend (Vite + React + TypeScript + Tailwind v4)
- `server/` — backend (Fastify + TypeScript)
- `supabase/migrations` — migraciones de la base (se aplican con
  `npx supabase db reset`)
- `scripts/seed-demo.js` — datos de prueba idempotentes
```

- [ ] **Step 9: Reemplazar `AGENTS.md` completo**

```markdown
# AGENTS.md

## Contexto

Proyecto en refactor a plataforma multi-tenant (SaaS). La fuente de verdad
del diseño es `docs/superpowers/specs/2026-08-12-whatsapp-saas-platform-design.md`
y el plan de implementación activo está en `docs/superpowers/plans/`.

Stack: Vite + React (frontend, `web/`) + Fastify (backend, `server/`) +
TypeScript + Supabase (Postgres con RLS, Supabase Auth). Sin tests
automatizados — QA manual. Desarrollo local contra el stack local de
Supabase (`npx supabase start`).

## UI / UX

Línea a seguir en todo lo visual: **Keep it simple**.

- Simple, efectiva y amigable.
- Sencilla de comprender y de navegar para el usuario.
- Sin ornamentación innecesaria: pocas pantallas, pocos pasos, textos
  claros en español rioplatense.
- Preferir componentes planos con Tailwind por sobre librerías de UI
  pesadas o patrones rebuscados.
```

- [ ] **Step 10: Confirmar que `server/` y `web/` siguen compilando**

```bash
cd server && npm run typecheck
cd ../web && npm run build
```

Esperado: ambos sin errores (ninguno de los dos depende de nada de la
raíz salvo `npm run dev:all`, que no se está probando acá).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: baja completa de Next.js — migración a Vite+Fastify terminada (Etapa 5)"
```

---

## Al terminar la Etapa 5

- `/admin` funciona de punta a punta en `web/` + `server/` (listado + alta
  de organizaciones), protegido por `requirePlatformAdmin`.
- El repo ya no tiene ningún archivo de Next.js — `npm run dev:all`
  levanta solo `server/` + `web/`.
- `README.md` y `AGENTS.md` reflejan el stack actual, sin referencias a
  Next.js.
- La migración de Next.js a Vite + Fastify (Etapas 1 a 5) queda cerrada.
