# Migración a Vite — Etapa 3 (Sucursales + Empleados) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar las pantallas de Sucursales y Empleados de Next.js a `web/` + `server/`, con TanStack Query como capa de datos, y borrar el código viejo de Next.js al final.

**Architecture:** `server/` gana un preHandler `requireOrg` reusable (encadenado después de `requireAuth`) y dos módulos de rutas nuevos (`sucursales.ts`, `empleados.ts`) que portan 1:1 la lógica ya existente en `server/src/lib/{sucursales,empleados,otp}.ts` (portada en la Etapa 1, sin uso hasta ahora). `web/` gana TanStack Query como capa de cache/mutaciones, reemplazando el patrón manual `fetch` + `router.refresh()` de Next.js — cada mutación invalida la query de la lista correspondiente.

**Tech Stack:** `@tanstack/react-query` en `web/`. `qrcode` en `server/` (generación de PNG, ya se usaba en Next.js).

**Spec:** `docs/superpowers/specs/2026-08-14-vite-migration-etapa3-design.md`

## Global Constraints

- Borrado de código viejo al final: **solo** `src/app/(panel)/sucursales/`,
  `src/app/(panel)/empleados/`, `src/app/api/sucursales/`,
  `src/app/api/empleados/`. **NO** se tocan `src/lib/sucursales.ts`,
  `src/lib/empleados.ts` ni `src/lib/otp.ts` — `src/lib/asistencia.ts`
  (Asistencia, todavía en Next.js) importa el tipo `Sucursal` de
  `src/lib/sucursales.ts`, así que ese archivo tiene que seguir vivo hasta
  que Asistencia también migre (Etapa 4).
- QR de sucursal: el endpoint sigue protegido con Bearer token. El
  frontend lo pide con `fetch()` + token, arma un blob URL
  (`URL.createObjectURL`), y esa es la URL que usa el `<img>` — nunca un
  `<img src="/api/...">` directo (no puede mandar el header).
- Versiones exactas: `@tanstack/react-query@5.101.4`, `qrcode@1.5.4`,
  `@types/qrcode@1.5.6` (verificadas contra el registro de npm el día de
  este plan).
- Sin tests automatizados nuevos — verificación manual vía curl/build, y
  al final una pasada del usuario en el navegador.
- Cada mutación de TanStack Query invalida la query de lista
  correspondiente al completarse (`queryClient.invalidateQueries`) — así
  las tablas se actualizan solas, sin recargar la página.

---

## Task 1: `requireOrg` preHandler en `server/`

**Files:**
- Create: `server/src/plugins/require-org.ts`

**Interfaces:**
- Consumes: `getCurrentOrg` y el tipo `Organization` (`server/src/lib/org.ts`, ya existen), `request.user` (decorado por `requireAuth`, Etapa 1).
- Produces: `requireOrg` (preHandler) y el decorador `request.org: Organization`. Debe usarse siempre DESPUÉS de `requireAuth` en la cadena: `{ preHandler: [requireAuth, requireOrg] }` — asume que `request.user` ya está resuelto. Consumido por las Tasks 2 a 5.

- [ ] **Step 1: Crear `server/src/plugins/require-org.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Organization } from "../lib/org.js";
import { getCurrentOrg } from "../lib/org.js";

declare module "fastify" {
  interface FastifyRequest {
    org?: Organization;
  }
}

/**
 * Debe encadenarse siempre después de requireAuth (necesita request.user
 * ya resuelto): `{ preHandler: [requireAuth, requireOrg] }`.
 */
export async function requireOrg(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const org = await getCurrentOrg(request.user!.id);
  if (!org) {
    reply.code(403).send({ error: "Tu cuenta todavía no está asociada a ninguna organización." });
    return;
  }
  request.org = org;
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd server
npm run typecheck
```

Esperado: sin errores. Sin consumidor todavía (ninguna ruta lo usa hasta la Task 2) — es esperable.

- [ ] **Step 3: Commit**

```bash
git add server/src/plugins/require-org.ts
git commit -m "feat(server): preHandler requireOrg"
```

---

## Task 2: Rutas CRUD de Sucursales en `server/`

**Files:**
- Create: `server/src/routes/sucursales.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth` (Etapa 1), `requireOrg` (Task 1), `listSucursales`/`createSucursal`/`updateSucursal` (`server/src/lib/sucursales.ts`, ya existen).
- Produces: `sucursalesRoutes` (Fastify plugin) con `GET/POST /api/sucursales`, `PATCH/DELETE /api/sucursales/:id`. Se sigue extendiendo en la Task 3 (ruta del QR, mismo archivo).

- [ ] **Step 1: Crear `server/src/routes/sucursales.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { listSucursales, createSucursal, updateSucursal } from "../lib/sucursales.js";

interface CrearBody {
  nombre?: string;
  lat?: number;
  lon?: number;
  radio_metros?: number;
}

interface EditarBody {
  nombre?: string;
  lat?: number | null;
  lon?: number | null;
  radio_metros?: number;
  activa?: boolean;
}

interface IdParams {
  id: string;
}

export async function sucursalesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/sucursales", { preHandler: [requireAuth, requireOrg] }, async (request) => {
    return listSucursales(request.org!.id);
  });

  app.post<{ Body: CrearBody }>(
    "/api/sucursales",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { nombre, lat, lon, radio_metros } = request.body ?? {};
      if (!nombre?.trim()) {
        return reply.code(400).send({ error: "El nombre es requerido" });
      }
      const sucursal = await createSucursal(request.org!.id, {
        nombre: nombre.trim(),
        lat,
        lon,
        radio_metros,
      });
      return reply.code(201).send(sucursal);
    }
  );

  app.patch<{ Params: IdParams; Body: EditarBody }>(
    "/api/sucursales/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      const body = request.body ?? {};
      const patch: Parameters<typeof updateSucursal>[2] = {};
      if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
      if (body.lat !== undefined) patch.lat = body.lat;
      if (body.lon !== undefined) patch.lon = body.lon;
      if (body.radio_metros !== undefined) patch.radio_metros = body.radio_metros;
      if (typeof body.activa === "boolean") patch.activa = body.activa;

      return updateSucursal(request.org!.id, id, patch);
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/sucursales/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      await updateSucursal(request.org!.id, id, { activa: false });
      return { ok: true };
    }
  );
}
```

- [ ] **Step 2: Registrar la ruta en `server/src/index.ts`**

Reemplazar el contenido completo de `server/src/index.ts`:

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { env } from "./env.js";
import { meRoutes } from "./routes/me.js";
import { orgRoutes } from "./routes/org.js";
import { marcarRoutes } from "./routes/marcar.js";
import { sucursalesRoutes } from "./routes/sucursales.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.corsOrigin, credentials: true });
await app.register(cookie);

app.get("/api/health", async () => ({ ok: true }));

await app.register(meRoutes);
await app.register(orgRoutes);
await app.register(marcarRoutes);
await app.register(sucursalesRoutes);

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.status(500).send({ error: "Algo salió mal. Probá de nuevo." });
});

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Verificar manualmente**

Con el server corriendo (`cd server && npm run dev`) y un token del usuario demo (mismo patrón de curl que las etapas anteriores: password grant contra Supabase con `demo@test.local`/`demo123456`, leyendo `SUPABASE_URL`/`SUPABASE_ANON_KEY` de `server/.env.local`):

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

echo "--- crear ---"
SUC=$(curl -s -X POST http://localhost:3001/api/sucursales \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Sucursal de prueba","lat":-34.6,"lon":-58.4,"radio_metros":150}')
echo "$SUC"
SUC_ID=$(echo "$SUC" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).id))')

echo "--- listar ---"
curl -s http://localhost:3001/api/sucursales -H "Authorization: Bearer $TOKEN"
echo

echo "--- editar ---"
curl -s -X PATCH "http://localhost:3001/api/sucursales/$SUC_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"radio_metros":200}'
echo

echo "--- desactivar (borrado lógico) ---"
curl -s -X DELETE "http://localhost:3001/api/sucursales/$SUC_ID" -H "Authorization: Bearer $TOKEN"
echo
```

Esperado: crear devuelve `201` con la sucursal; listar la incluye; editar devuelve `radio_metros: 200`; desactivar devuelve `{"ok":true}` (y un GET posterior la muestra con `activa: false`, no desaparece de la lista).

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/sucursales.ts server/src/index.ts
git commit -m "feat(server): rutas CRUD de sucursales"
```

---

## Task 3: Ruta del QR de sucursal en `server/`

**Files:**
- Modify: `server/src/routes/sucursales.ts`
- Modify: `server/src/env.ts`
- Modify: `server/.env.example`
- Modify: `server/.env.local` (no versionado)
- Modify: `server/package.json` (nueva dependencia)

**Interfaces:**
- Consumes: `getSucursal` (`server/src/lib/sucursales.ts`, ya existe), `env.marcarBaseUrl` (nuevo, este task).
- Produces: la ruta `GET /api/sucursales/:id/qr` — consumida por `useQrBlob` en `web/` (Task 7).

- [ ] **Step 1: Instalar `qrcode`**

```bash
cd server
npm install qrcode@1.5.4
npm install -D @types/qrcode@1.5.6
```

- [ ] **Step 2: Agregar `marcarBaseUrl` a `server/src/env.ts`**

Reemplazar el contenido completo de `server/src/env.ts`:

```ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  marcarBaseUrl: process.env.MARCAR_BASE_URL ?? "http://localhost:5173",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  nodeEnv: process.env.NODE_ENV ?? "development",
};
```

- [ ] **Step 3: Agregar la variable a `server/.env.example` y a `server/.env.local`**

Agregar esta línea a ambos archivos (`server/.env.example` y `server/.env.local`):
```
MARCAR_BASE_URL=http://localhost:5173
```

- [ ] **Step 4: Agregar la ruta del QR a `server/src/routes/sucursales.ts`**

Agregar este import al principio del archivo (junto a los que ya están):

```ts
import QRCode from "qrcode";
import { getSucursal } from "../lib/sucursales.js";
import { env } from "../env.js";
```

Agregar dentro de `sucursalesRoutes`, después de la ruta `DELETE`:

```ts
  app.get<{ Params: IdParams }>(
    "/api/sucursales/:id/qr",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { id } = request.params;
      const sucursal = await getSucursal(request.org!.id, id);
      if (!sucursal) {
        return reply.code(404).send({ error: "Sucursal no encontrada" });
      }
      const url = `${env.marcarBaseUrl}/marcar/${request.org!.slug}/${sucursal.id}`;
      const png = await QRCode.toBuffer(url, { width: 600, margin: 2 });
      reply.header("Content-Type", "image/png");
      reply.header("Content-Disposition", `inline; filename="qr-${sucursal.nombre}.png"`);
      return reply.send(png);
    }
  );
```

- [ ] **Step 5: Verificar manualmente**

```bash
curl -s "http://localhost:3001/api/sucursales/$SUC_ID/qr" -H "Authorization: Bearer $TOKEN" -o /tmp/qr-test.png
file /tmp/qr-test.png
```

Esperado: `file` reporta `PNG image data, 600 x 600`. (`$SUC_ID` y `$TOKEN` son los de la Task 2 — si ya no están en el shell, repetir esos pasos.)

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/sucursales.ts server/src/env.ts server/.env.example server/package.json server/package-lock.json
git commit -m "feat(server): GET /api/sucursales/:id/qr"
```

---

## Task 4: Rutas CRUD de Empleados en `server/`

**Files:**
- Create: `server/src/routes/empleados.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireOrg` (Task 1), `listEmpleados`/`createEmpleado`/`updateEmpleado`/`setEmpleadoActivo` (`server/src/lib/empleados.ts`, ya existen), `getOtpVigente` (`server/src/lib/otp.ts`, ya existe).
- Produces: `empleadosRoutes` (Fastify plugin) con `GET/POST /api/empleados`, `PATCH/DELETE /api/empleados/:id`. Se sigue extendiendo en la Task 5 (desvincular + otp, mismo archivo).

- [ ] **Step 1: Crear `server/src/routes/empleados.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { listEmpleados, createEmpleado, updateEmpleado, setEmpleadoActivo } from "../lib/empleados.js";
import { getOtpVigente } from "../lib/otp.js";

interface CrearBody {
  nombre?: string;
  celular?: string;
}

interface EditarBody {
  nombre?: string;
  celular?: string | null;
  activo?: boolean;
}

interface IdParams {
  id: string;
}

export async function empleadosRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/empleados", { preHandler: [requireAuth, requireOrg] }, async (request) => {
    const empleados = await listEmpleados(request.org!.id);
    return Promise.all(
      empleados.map(async (e) => {
        if (e.device_token) return { ...e, otp: null };
        const otp = await getOtpVigente(e.id);
        return { ...e, otp: otp ? { code: otp.code, expires_at: otp.expires_at } : null };
      })
    );
  });

  app.post<{ Body: CrearBody }>(
    "/api/empleados",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { nombre, celular } = request.body ?? {};
      if (!nombre?.trim()) {
        return reply.code(400).send({ error: "El nombre es requerido" });
      }
      const empleado = await createEmpleado(request.org!.id, {
        nombre: nombre.trim(),
        celular: celular?.trim() || undefined,
      });
      return reply.code(201).send(empleado);
    }
  );

  app.patch<{ Params: IdParams; Body: EditarBody }>(
    "/api/empleados/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      const body = request.body ?? {};

      if (typeof body.activo === "boolean") {
        await setEmpleadoActivo(request.org!.id, id, body.activo);
      }

      const patch: { nombre?: string; celular?: string | null } = {};
      if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
      if (body.celular !== undefined) patch.celular = body.celular?.trim() || null;

      if (Object.keys(patch).length > 0) {
        return updateEmpleado(request.org!.id, id, patch);
      }
      return { ok: true };
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/empleados/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      await setEmpleadoActivo(request.org!.id, id, false);
      return { ok: true };
    }
  );
}
```

- [ ] **Step 2: Registrar la ruta en `server/src/index.ts`**

Agregar el import `import { empleadosRoutes } from "./routes/empleados.js";` junto a los demás, y la línea `await app.register(empleadosRoutes);` junto a los demás `await app.register(...)`.

- [ ] **Step 3: Verificar manualmente**

```bash
echo "--- crear ---"
EMP=$(curl -s -X POST http://localhost:3001/api/empleados \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Empleado de Prueba Etapa 3"}')
echo "$EMP"
EMP_ID=$(echo "$EMP" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).id))')

echo "--- listar (debe incluir otp: null, sin vincular todavía) ---"
curl -s http://localhost:3001/api/empleados -H "Authorization: Bearer $TOKEN"
echo

echo "--- editar ---"
curl -s -X PATCH "http://localhost:3001/api/empleados/$EMP_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"celular":"1122334455"}'
echo

echo "--- desactivar ---"
curl -s -X DELETE "http://localhost:3001/api/empleados/$EMP_ID" -H "Authorization: Bearer $TOKEN"
echo
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/empleados.ts server/src/index.ts
git commit -m "feat(server): rutas CRUD de empleados"
```

---

## Task 5: Acciones de Empleados (desvincular, generar OTP) en `server/`

**Files:**
- Modify: `server/src/routes/empleados.ts`

**Interfaces:**
- Consumes: `desvincularDispositivo` (`server/src/lib/empleados.ts`), `generarOtp` (`server/src/lib/otp.ts`).

- [ ] **Step 1: Agregar las rutas**

Agregar estos imports al principio del archivo:

```ts
import { desvincularDispositivo } from "../lib/empleados.js";
import { generarOtp } from "../lib/otp.js";
```

Agregar dentro de `empleadosRoutes`, después de la ruta `DELETE`:

```ts
  app.post<{ Params: IdParams }>(
    "/api/empleados/:id/desvincular",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      await desvincularDispositivo(request.org!.id, id);
      return { ok: true };
    }
  );

  app.post<{ Params: IdParams }>(
    "/api/empleados/:id/otp",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { id } = request.params;
      try {
        const code = await generarOtp(request.org!.id, id);
        return { code };
      } catch {
        return reply.code(404).send({ error: "Empleado no encontrado" });
      }
    }
  );
```

- [ ] **Step 2: Verificar manualmente**

```bash
echo "--- generar código ---"
curl -s -X POST "http://localhost:3001/api/empleados/$EMP_ID/otp" -H "Authorization: Bearer $TOKEN"
echo
echo "--- listar (ahora debe mostrar el otp generado) ---"
curl -s http://localhost:3001/api/empleados -H "Authorization: Bearer $TOKEN"
echo
echo "--- desvincular (no tiene dispositivo vinculado todavía, igual debe devolver ok) ---"
curl -s -X POST "http://localhost:3001/api/empleados/$EMP_ID/desvincular" -H "Authorization: Bearer $TOKEN"
echo
```

Esperado: generar código devuelve `{"code":"123456"}` (6 dígitos); el listado posterior muestra ese `otp.code` en el empleado; desvincular devuelve `{"ok":true}`.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/empleados.ts
git commit -m "feat(server): desvincular dispositivo + generar OTP"
```

Con esto `server/` cubre las 9 rutas nuevas completas. `web/` empieza en la Task 6.

---

## Task 6: TanStack Query + funciones de Sucursales en `web/src/lib/api.ts`

**Files:**
- Modify: `web/package.json` (nueva dependencia)
- Modify: `web/src/App.tsx`
- Modify: `web/src/lib/api.ts`

**Interfaces:**
- Produces: `QueryClientProvider` montado — consumido por los hooks de las Tasks 8 y 9. `Sucursal`, `CrearSucursalInput`, `EditarSucursalInput`, `listSucursales()`, `createSucursal()`, `updateSucursal()`, `deactivateSucursal()` — consumidos por `web/src/pages/sucursales/hooks.ts` (Task 8).

- [ ] **Step 1: Instalar `@tanstack/react-query`**

```bash
cd web
npm install @tanstack/react-query@5.101.4
```

- [ ] **Step 2: Montar `QueryClientProvider` en `web/src/App.tsx`**

Reemplazar el contenido completo de `web/src/App.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PanelLayout } from "./components/PanelLayout";
import MarcarPage from "./pages/MarcarPage";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <HomePage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
            <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

(Las rutas de `/sucursales` y `/empleados` se agregan recién en la Task 10 — este paso solo monta el provider.)

- [ ] **Step 3: Agregar las funciones de sucursales a `web/src/lib/api.ts`**

Reemplazar el contenido completo de `web/src/lib/api.ts`:

```ts
import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.headers) Object.assign(headers, init.headers);
  if (session) headers["Authorization"] = `Bearer ${session.access_token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? "Algo salió mal. Probá de nuevo.", res.status);
  }
  return body as T;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export function getOrgActual(): Promise<Organization> {
  return request("/api/org/current");
}

export interface Sucursal {
  id: string;
  org_id: string;
  nombre: string;
  lat: number | null;
  lon: number | null;
  radio_metros: number;
  activa: boolean;
  created_at: string;
}

export function listSucursales(): Promise<Sucursal[]> {
  return request("/api/sucursales");
}

export interface CrearSucursalInput {
  nombre: string;
  lat?: number;
  lon?: number;
  radio_metros?: number;
}

export function createSucursal(input: CrearSucursalInput): Promise<Sucursal> {
  return request("/api/sucursales", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface EditarSucursalInput {
  nombre?: string;
  lat?: number | null;
  lon?: number | null;
  radio_metros?: number;
  activa?: boolean;
}

export function updateSucursal(id: string, patch: EditarSucursalInput): Promise<Sucursal> {
  return request(`/api/sucursales/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deactivateSucursal(id: string): Promise<{ ok: true }> {
  return request(`/api/sucursales/${id}`, { method: "DELETE" });
}

export interface EstadoMarcado {
  sucursalNombre: string;
  empleadoNombre: string | null;
}

export function getEstadoMarcado(org: string, sucursal: string): Promise<EstadoMarcado> {
  return request(
    `/api/marcar/estado?org=${encodeURIComponent(org)}&sucursal=${encodeURIComponent(sucursal)}`
  );
}

export interface IdentificarResponse {
  empleadoId?: string;
  sugerencia?: string;
}

export function identificar(
  orgSlug: string,
  sucursalId: string,
  nombre: string
): Promise<IdentificarResponse> {
  return request("/api/marcar/identificar", {
    method: "POST",
    body: JSON.stringify({ orgSlug, sucursalId, nombre }),
  });
}

export interface VerificarResponse {
  ok: true;
  nombre: string;
}

export function verificar(empleadoId: string, code: string): Promise<VerificarResponse> {
  return request("/api/marcar/verificar", {
    method: "POST",
    body: JSON.stringify({ empleadoId, code }),
  });
}

export interface RegistrarResponse {
  ok: true;
  tipo: "entrada" | "salida";
  hora: string;
}

export function registrarMarca(
  sucursalId: string,
  tipo: "entrada" | "salida",
  lat: number,
  lon: number
): Promise<RegistrarResponse> {
  return request("/api/marcar/registrar", {
    method: "POST",
    body: JSON.stringify({ sucursalId, tipo, lat, lon }),
  });
}
```

- [ ] **Step 4: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/src/App.tsx web/src/lib/api.ts
git commit -m "feat(web): TanStack Query + funciones de sucursales en api.ts"
```

---

## Task 7: Funciones de Empleados en `api.ts` + `useQrBlob`

**Files:**
- Modify: `web/src/lib/api.ts`
- Create: `web/src/pages/sucursales/useQrBlob.ts`

**Interfaces:**
- Produces: `Empleado`, `EmpleadoOtp`, `CrearEmpleadoInput`, `EditarEmpleadoInput`, `listEmpleados()`, `createEmpleado()`, `updateEmpleado()`, `deactivateEmpleado()`, `desvincularDispositivo()`, `generarOtp()` — consumidos por `web/src/pages/empleados/hooks.ts` (Task 9). `useQrBlob(sucursalId)` — consumido por `SucursalesPage` (Task 8).

- [ ] **Step 1: Agregar las funciones de empleados a `web/src/lib/api.ts`**

Agregar al final de `web/src/lib/api.ts` (después de `registrarMarca`):

```ts

export interface EmpleadoOtp {
  code: string;
  expires_at: string;
}

export interface Empleado {
  id: string;
  org_id: string;
  nombre: string;
  celular: string | null;
  device_token: string | null;
  activo: boolean;
  created_at: string;
  otp: EmpleadoOtp | null;
}

export function listEmpleados(): Promise<Empleado[]> {
  return request("/api/empleados");
}

export interface CrearEmpleadoInput {
  nombre: string;
  celular?: string;
}

export function createEmpleado(input: CrearEmpleadoInput): Promise<Empleado> {
  return request("/api/empleados", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface EditarEmpleadoInput {
  nombre?: string;
  celular?: string | null;
  activo?: boolean;
}

export function updateEmpleado(id: string, patch: EditarEmpleadoInput): Promise<Empleado | { ok: true }> {
  return request(`/api/empleados/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deactivateEmpleado(id: string): Promise<{ ok: true }> {
  return request(`/api/empleados/${id}`, { method: "DELETE" });
}

export function desvincularDispositivo(id: string): Promise<{ ok: true }> {
  return request(`/api/empleados/${id}/desvincular`, { method: "POST" });
}

export interface GenerarOtpResponse {
  code: string;
}

export function generarOtp(id: string): Promise<GenerarOtpResponse> {
  return request(`/api/empleados/${id}/otp`, { method: "POST" });
}
```

- [ ] **Step 2: Crear `web/src/pages/sucursales/useQrBlob.ts`**

```ts
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/**
 * Pide el PNG del QR de una sucursal mandando el Bearer token (un <img
 * src="..."> directo no puede mandar headers), y devuelve un blob URL
 * listo para usar en <img src={...}>. null mientras no hay sucursalId o
 * todavía no cargó.
 */
export function useQrBlob(sucursalId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sucursalId) {
      setUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function cargar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/api/sucursales/${sucursalId}/qr`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok || cancelled) return;

      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setUrl(objectUrl);
    }

    cargar();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sucursalId]);

  return url;
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/api.ts web/src/pages/sucursales/useQrBlob.ts
git commit -m "feat(web): funciones de empleados en api.ts + useQrBlob"
```

---

## Task 8: `SucursalesPage` + hooks

**Files:**
- Create: `web/src/pages/sucursales/hooks.ts`
- Create: `web/src/pages/sucursales/SucursalesPage.tsx`

**Interfaces:**
- Consumes: `listSucursales`/`createSucursal`/`updateSucursal`/`deactivateSucursal`/`getOrgActual` (`web/src/lib/api.ts`, Task 6), `useQrBlob` (Task 7), `Button`/`Input`/`Card`/`Table*` (Etapa 1).
- Produces: `SucursalesPage` (default export) — consumido por `App.tsx` en la Task 10.

- [ ] **Step 1: Crear `web/src/pages/sucursales/hooks.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSucursales,
  createSucursal,
  updateSucursal,
  deactivateSucursal,
  getOrgActual,
  type CrearSucursalInput,
  type EditarSucursalInput,
} from "../../lib/api";

const QUERY_KEY = ["sucursales"];

export function useSucursales() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listSucursales });
}

export function useOrgActual() {
  return useQuery({ queryKey: ["org"], queryFn: getOrgActual });
}

export function useCrearSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearSucursalInput) => createSucursal(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useEditarSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarSucursalInput }) => updateSucursal(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDesactivarSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateSucursal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
```

- [ ] **Step 2: Crear `web/src/pages/sucursales/SucursalesPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import type { Sucursal } from "../../lib/api";
import { useSucursales, useOrgActual, useCrearSucursal, useEditarSucursal, useDesactivarSucursal } from "./hooks";
import { useQrBlob } from "./useQrBlob";

interface EditState {
  nombre: string;
  lat: string;
  lon: string;
  radio: string;
}

function parseNumero(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export default function SucursalesPage() {
  const { data: sucursales = [], isLoading } = useSucursales();
  const { data: org } = useOrgActual();
  const crear = useCrearSucursal();
  const editar = useEditarSucursal();
  const desactivar = useDesactivarSucursal();

  const [nombre, setNombre] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radio, setRadio] = useState("100");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ nombre: "", lat: "", lon: "", radio: "100" });
  const [qrId, setQrId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qrUrl = useQrBlob(qrId);
  const qrSucursal = sucursales.find((s) => s.id === qrId) ?? null;

  const loading = crear.isPending || editar.isPending || desactivar.isPending;

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({
        nombre,
        lat: parseNumero(lat),
        lon: parseNumero(lon),
        radio_metros: parseNumero(radio),
      });
      setNombre("");
      setLat("");
      setLon("");
      setRadio("100");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editar.mutateAsync({
        id,
        patch: {
          nombre: edit.nombre,
          lat: parseNumero(edit.lat) ?? null,
          lon: parseNumero(edit.lon) ?? null,
          radio_metros: parseNumero(edit.radio),
        },
      });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleToggleActiva(suc: Sucursal) {
    setError(null);
    try {
      await editar.mutateAsync({ id: suc.id, patch: { activa: !suc.activa } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl">
        <h1 className="text-[32px] font-extrabold text-text">Sucursales</h1>

        <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
          <Input required placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input placeholder="Latitud" value={lat} onChange={(e) => setLat(e.target.value)} className="w-32" />
          <Input placeholder="Longitud" value={lon} onChange={(e) => setLon(e.target.value)} className="w-32" />
          <Input placeholder="Radio (m)" value={radio} onChange={(e) => setRadio(e.target.value)} className="w-24" />
          <Button type="submit" variant="accent" disabled={loading}>
            Agregar
          </Button>
        </form>
        <p className="mt-1 text-[15px] text-text/60">
          Sacá las coordenadas de Google Maps: click derecho sobre el local → copiar los números.
        </p>

        {error && <p className="mt-2 text-[15px] text-accent">{error}</p>}

        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Coordenadas</TableHead>
              <TableHead>Radio</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              sucursales.map((suc) => (
                <TableRow key={suc.id} className={suc.activa ? "" : "text-text/40"}>
                  <TableCell>
                    {editandoId === suc.id ? (
                      <Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
                    ) : (
                      suc.nombre
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === suc.id ? (
                      <div className="flex gap-1">
                        <Input
                          value={edit.lat}
                          onChange={(e) => setEdit({ ...edit, lat: e.target.value })}
                          placeholder="Lat"
                          className="w-28"
                        />
                        <Input
                          value={edit.lon}
                          onChange={(e) => setEdit({ ...edit, lon: e.target.value })}
                          placeholder="Lon"
                          className="w-28"
                        />
                      </div>
                    ) : suc.lat != null && suc.lon != null ? (
                      `${suc.lat}, ${suc.lon}`
                    ) : (
                      "Sin configurar"
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === suc.id ? (
                      <Input value={edit.radio} onChange={(e) => setEdit({ ...edit, radio: e.target.value })} className="w-20" />
                    ) : (
                      `${suc.radio_metros} m`
                    )}
                  </TableCell>
                  <TableCell>{suc.activa ? "Sí" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {editandoId === suc.id ? (
                        <>
                          <Button variant="ghost" onClick={() => handleGuardarEdicion(suc.id)} disabled={loading}>
                            Guardar
                          </Button>
                          <Button variant="ghost" onClick={() => setEditandoId(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditandoId(suc.id);
                              setEdit({
                                nombre: suc.nombre,
                                lat: suc.lat?.toString() ?? "",
                                lon: suc.lon?.toString() ?? "",
                                radio: suc.radio_metros.toString(),
                              });
                            }}
                          >
                            Editar
                          </Button>
                          <Button variant="ghost" onClick={() => handleToggleActiva(suc)} disabled={loading}>
                            {suc.activa ? "Desactivar" : "Activar"}
                          </Button>
                          <Button variant="ghost" onClick={() => setQrId(suc.id)}>
                            Ver QR
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && sucursales.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  Todavía no hay sucursales cargadas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {qrSucursal && (
          <div className="mt-6 max-w-md rounded-lg border border-text/10 bg-surface p-4">
            <div className="flex items-start justify-between">
              <h2 className="text-[20px] font-extrabold text-text">QR — {qrSucursal.nombre}</h2>
              <Button variant="ghost" onClick={() => setQrId(null)}>
                Cerrar
              </Button>
            </div>
            {qrUrl ? (
              <img src={qrUrl} alt={`QR de ${qrSucursal.nombre}`} className="mt-2 w-full" />
            ) : (
              <p className="mt-2 text-[15px] text-text/60">Generando QR...</p>
            )}
            {org && (
              <p className="mt-2 break-all text-[15px] text-text/60">
                {`${window.location.origin}/marcar/${org.slug}/${qrSucursal.id}`}
              </p>
            )}
            {qrUrl && (
              <Button asChild variant="default" className="mt-2">
                <a href={qrUrl} download={`qr-${qrSucursal.nombre}.png`}>
                  Descargar PNG
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores. Sin ruta todavía (se conecta en la Task 10) — la verificación funcional completa se hace en la Task 11.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/sucursales/hooks.ts web/src/pages/sucursales/SucursalesPage.tsx
git commit -m "feat(web): SucursalesPage"
```

---

## Task 9: `EmpleadosPage` + hooks

**Files:**
- Create: `web/src/pages/empleados/hooks.ts`
- Create: `web/src/pages/empleados/EmpleadosPage.tsx`

**Interfaces:**
- Consumes: `listEmpleados`/`createEmpleado`/`updateEmpleado`/`deactivateEmpleado`/`desvincularDispositivo`/`generarOtp` (`web/src/lib/api.ts`, Task 7), `Button`/`Input`/`Table*` (Etapa 1).
- Produces: `EmpleadosPage` (default export) — consumido por `App.tsx` en la Task 10.

- [ ] **Step 1: Crear `web/src/pages/empleados/hooks.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEmpleados,
  createEmpleado,
  updateEmpleado,
  deactivateEmpleado,
  desvincularDispositivo,
  generarOtp,
  type CrearEmpleadoInput,
  type EditarEmpleadoInput,
} from "../../lib/api";

const QUERY_KEY = ["empleados"];

export function useEmpleados() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listEmpleados });
}

export function useCrearEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearEmpleadoInput) => createEmpleado(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useEditarEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarEmpleadoInput }) => updateEmpleado(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDesactivarEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateEmpleado(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDesvincularDispositivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => desvincularDispositivo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useGenerarOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => generarOtp(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
```

- [ ] **Step 2: Crear `web/src/pages/empleados/EmpleadosPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import type { Empleado } from "../../lib/api";
import {
  useEmpleados,
  useCrearEmpleado,
  useEditarEmpleado,
  useDesactivarEmpleado,
  useDesvincularDispositivo,
  useGenerarOtp,
} from "./hooks";

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function minutosRestantes(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

export default function EmpleadosPage() {
  const { data: empleados = [], isLoading } = useEmpleados();
  const crear = useCrearEmpleado();
  const editar = useEditarEmpleado();
  const desactivar = useDesactivarEmpleado();
  const desvincular = useDesvincularDispositivo();
  const generarCodigo = useGenerarOtp();

  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loading =
    crear.isPending || editar.isPending || desactivar.isPending || desvincular.isPending || generarCodigo.isPending;

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({ nombre, celular: celular || undefined });
      setNombre("");
      setCelular("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editar.mutateAsync({ id, patch: { nombre: editNombre, celular: editCelular || null } });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleToggleActivo(emp: Empleado) {
    setError(null);
    try {
      await editar.mutateAsync({ id: emp.id, patch: { activo: !emp.activo } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleDesvincular(emp: Empleado) {
    if (!confirm(`¿Desvincular el dispositivo de ${emp.nombre}? Va a tener que revincular con un código nuevo.`)) {
      return;
    }
    setError(null);
    try {
      await desvincular.mutateAsync(emp.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGenerarCodigo(id: string) {
    setError(null);
    try {
      await generarCodigo.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl">
        <h1 className="text-[32px] font-extrabold text-text">Empleados</h1>

        <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
          <Input required placeholder="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input placeholder="Celular (opcional)" value={celular} onChange={(e) => setCelular(e.target.value)} />
          <Button type="submit" variant="accent" disabled={loading}>
            Agregar
          </Button>
        </form>

        {error && <p className="mt-2 text-[15px] text-accent">{error}</p>}

        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Dispositivo</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              empleados.map((emp) => (
                <TableRow key={emp.id} className={emp.activo ? "" : "text-text/40"}>
                  <TableCell>
                    {editandoId === emp.id ? (
                      <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                    ) : (
                      emp.nombre
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === emp.id ? (
                      <Input value={editCelular} onChange={(e) => setEditCelular(e.target.value)} />
                    ) : (
                      emp.celular ?? "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {emp.device_token ? (
                      "Vinculado"
                    ) : emp.otp ? (
                      <span>
                        Código: <strong className="text-[15px] tracking-wide">{formatCode(emp.otp.code)}</strong>{" "}
                        <span className="text-text/60">(vence en {minutosRestantes(emp.otp.expires_at)} min)</span>
                      </span>
                    ) : (
                      "Sin vincular"
                    )}
                  </TableCell>
                  <TableCell>{emp.activo ? "Sí" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {editandoId === emp.id ? (
                        <>
                          <Button variant="ghost" onClick={() => handleGuardarEdicion(emp.id)} disabled={loading}>
                            Guardar
                          </Button>
                          <Button variant="ghost" onClick={() => setEditandoId(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditandoId(emp.id);
                              setEditNombre(emp.nombre);
                              setEditCelular(emp.celular ?? "");
                            }}
                          >
                            Editar
                          </Button>
                          <Button variant="ghost" onClick={() => handleToggleActivo(emp)} disabled={loading}>
                            {emp.activo ? "Desactivar" : "Activar"}
                          </Button>
                          {emp.device_token ? (
                            <Button variant="ghost" onClick={() => handleDesvincular(emp)} disabled={loading}>
                              Desvincular
                            </Button>
                          ) : (
                            <Button variant="ghost" onClick={() => handleGenerarCodigo(emp.id)} disabled={loading}>
                              {emp.otp ? "Código nuevo" : "Generar código"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && empleados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  Todavía no hay empleados cargados.
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

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/empleados/hooks.ts web/src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat(web): EmpleadosPage"
```

---

## Task 10: Activar Sucursales/Empleados en el nav y el Home + rutas finales

**Files:**
- Modify: `web/src/components/PanelNav.tsx`
- Modify: `web/src/pages/HomePage.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `SucursalesPage` (Task 8), `EmpleadosPage` (Task 9).

- [ ] **Step 1: Habilitar los links en `web/src/components/PanelNav.tsx`**

Reemplazar el array `LINKS`:

```ts
const LINKS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia", disabled: true },
  { href: "/horas", label: "Horas", disabled: true },
  { href: "/empleados", label: "Empleados" },
  { href: "/sucursales", label: "Sucursales" },
];
```

- [ ] **Step 2: Habilitar las tarjetas correspondientes en `web/src/pages/HomePage.tsx`**

Reemplazar el contenido completo de `web/src/pages/HomePage.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { getOrgActual, ApiError, type Organization } from "../lib/api";
import { TOOLTIP_DESHABILITADO } from "../components/PanelNav";

const ACCESOS = [
  {
    href: "/asistencia",
    label: "Asistencia",
    detalle: "Registros de entrada/salida e intentos rechazados",
    disabled: true,
  },
  { href: "/horas", label: "Horas", detalle: "Turnos y horas trabajadas por empleado", disabled: true },
  {
    href: "/empleados",
    label: "Empleados",
    detalle: "Nómina, vínculo de dispositivos y códigos",
    disabled: false,
  },
  {
    href: "/sucursales",
    label: "Sucursales",
    detalle: "Ubicaciones, geocercas y códigos QR",
    disabled: false,
  },
];

export default function HomePage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [sinOrg, setSinOrg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    setSinOrg(false);
    getOrgActual()
      .then(setOrg)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setSinOrg(true);
        } else {
          setError(
            err instanceof Error ? err.message : "No pudimos cargar tus datos. Probá de nuevo."
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-text/60">Cargando...</p>
      </main>
    );
  }

  if (sinOrg) {
    return (
      <main className="p-8">
        <p className="text-text">
          Tu cuenta todavía no está asociada a ninguna organización. Contactá a soporte.
        </p>
      </main>
    );
  }

  if (error || !org) {
    return (
      <main className="p-8">
        <p className="text-text">{error ?? "No pudimos cargar tus datos. Probá de nuevo."}</p>
        <Button onClick={cargar} variant="outline" className="mt-4">
          Reintentar
        </Button>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-[32px] font-extrabold text-text">{org.name}</h1>
      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        {ACCESOS.map((a) =>
          a.disabled ? (
            <Card key={a.href} title={TOOLTIP_DESHABILITADO} className="cursor-not-allowed opacity-60">
              <h2 className="text-[15px] font-extrabold text-text">{a.label}</h2>
              <p className="mt-1 text-[15px] text-text/60">{a.detalle}</p>
            </Card>
          ) : (
            <Link key={a.href} to={a.href}>
              <Card className="transition-colors hover:bg-text/5">
                <h2 className="text-[15px] font-extrabold text-text">{a.label}</h2>
                <p className="mt-1 text-[15px] text-text/60">{a.detalle}</p>
              </Card>
            </Link>
          )
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Agregar las rutas a `web/src/App.tsx`**

Reemplazar el contenido completo de `web/src/App.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PanelLayout } from "./components/PanelLayout";
import MarcarPage from "./pages/MarcarPage";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import SucursalesPage from "./pages/sucursales/SucursalesPage";
import EmpleadosPage from "./pages/empleados/EmpleadosPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <HomePage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sucursales"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <SucursalesPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/empleados"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <EmpleadosPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
            <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/PanelNav.tsx web/src/pages/HomePage.tsx web/src/App.tsx
git commit -m "feat(web): activar Sucursales y Empleados en nav/home + rutas finales"
```

---

## Task 11: Verificación E2E + borrado de Sucursales/Empleados viejos de Next.js

**Files:**
- Delete: `src/app/(panel)/sucursales/`
- Delete: `src/app/(panel)/empleados/`
- Delete: `src/app/api/sucursales/`
- Delete: `src/app/api/empleados/`

**Interfaces:** ninguna — es la tarea de cierre de la etapa.

- [ ] **Step 1: Confirmar que `server/` y `web/` siguen corriendo**

```bash
curl -s http://localhost:3001/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

Si alguno no responde, levantarlo de nuevo (`npm run dev` en `server/` y en `web/`).

- [ ] **Step 2: Checklist manual (para el usuario en el navegador)**

1. Entrar a `http://localhost:5173/` logueado, confirmar que "Empleados" y "Sucursales" ya son clickeables en el nav y en las tarjetas del Home (Asistencia y Horas siguen deshabilitadas).
2. En `/sucursales`: crear una sucursal con nombre + lat/lon + radio. Confirmar que aparece en la tabla sin recargar la página.
3. Editar esa sucursal (cambiar el radio), guardar, confirmar que se actualiza en la tabla.
4. Tocar "Ver QR" → confirmar que se ve la imagen del QR y el link de texto debajo con la URL correcta (`/marcar/cliente-prueba/...`). Tocar "Descargar PNG" y confirmar que baja el archivo.
5. Desactivar la sucursal → confirmar que se ve grisada pero sigue en la tabla (no desaparece).
6. En `/empleados`: crear un empleado. Confirmar que aparece en la tabla.
7. Tocar "Generar código" → confirmar que se ve el código de 6 dígitos con el tiempo de vencimiento.
8. Tocar "Desvincular" en un empleado sin dispositivo vinculado (debería funcionar igual, sin romper nada, aunque no tenga nada que desvincular).
9. Desactivar el empleado → confirmar que se ve grisado pero sigue en la tabla.
10. Confirmar que `http://localhost:3000/asistencia` y `http://localhost:3000/horas` (Next.js, todavía sin migrar) siguen funcionando igual que antes.

Esperar la confirmación explícita del usuario antes de continuar al Step 3.

- [ ] **Step 3: Borrar el código viejo de Next.js**

```bash
git rm -r "src/app/(panel)/sucursales" "src/app/(panel)/empleados" src/app/api/sucursales src/app/api/empleados
```

**No borrar** `src/lib/sucursales.ts`, `src/lib/empleados.ts` ni `src/lib/otp.ts` — `src/lib/asistencia.ts` (Asistencia, todavía en Next.js) importa el tipo `Sucursal` de `src/lib/sucursales.ts`.

- [ ] **Step 4: Confirmar que el resto de Next.js sigue compilando**

```bash
rm -rf .next
npx tsc --noEmit
```

Esperado: sin errores (Asistencia y Horas no importan nada de las carpetas borradas — solo el tipo `Sucursal`, que sigue existiendo).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: borrar Sucursales y Empleados de Next.js — migrados a web/+server/ (Etapa 3)"
```

---

## Al terminar la Etapa 3

- `/sucursales` y `/empleados` funcionan de punta a punta en `web/` + `server/`, con TanStack Query manejando cache e invalidación.
- El QR de sucursal funciona vía blob URL con Bearer token.
- `src/app/(panel)/sucursales/`, `src/app/(panel)/empleados/`, `src/app/api/sucursales/`, `src/app/api/empleados/` quedan borrados de Next.js. `src/lib/{sucursales,empleados,otp}.ts` siguen vivos (los usa Asistencia).
- Quedan pendientes las Etapas 4 y 5 (spec de la Etapa 1, §5).
