# Migración a Vite — Etapa 1 (fundaciones + /marcar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el nuevo stack (`web/` en Vite+React+Tailwind+shadcn, `server/` en Fastify) con el sistema de diseño del PDF aplicado, y migrar de punta a punta el flujo público `/marcar/:org/:sucursal`, borrando su equivalente en Next.js al final.

**Architecture:** Dos proyectos nuevos e independientes en el mismo repo (`web/`, `server/`), cada uno con su propio `package.json`. El backend Fastify expone las mismas 4 operaciones que hoy expone Next (`estado`, `identificar`, `verificar`, `registrar`) reutilizando la lógica de negocio existente casi sin cambios. El frontend Vite consume esa API por HTTP y reproduce las 5 pantallas del PDF con componentes shadcn reskineados a los tokens del sistema de diseño. El resto del panel (login, home, sucursales, empleados, asistencia, horas) sigue en Next.js sin tocar hasta su propia etapa.

**Tech Stack:** Vite 8 + React 19 + TypeScript + Tailwind CSS 4 (`@tailwindcss/vite`) + shadcn-style components (Radix + CVA) + React Router 7 + Lucide. Fastify 5 + TypeScript + `@fastify/cors` + `@fastify/cookie` + `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-08-13-vite-migration-design.md`

## Global Constraints

- Color de acento: `#dc2626`. Fondo `#f3f2f2`, superficie `#eae9e9`, tinta `#201e1d` (spec §4.1).
- Tipografía Archivo (Google Fonts): H1 42px/800, H2 32px/800, H4 20px/800, Body 15px/400, Caption 11px uppercase (spec §4.2).
- Sistema mono-acento: los badges de estado usan tinta llena / contorno / accent — nunca una paleta semántica nueva (spec §4.3).
- Librería de componentes: shadcn-style (Radix + Tailwind + CVA), solo el subset Button/Input/Card/Badge/Table (spec §3.3).
- Backend: Fastify, no Express (spec §2).
- Migración por reemplazo directo: el código viejo de Next.js para lo que se migra en esta etapa se borra al final de la etapa, no convive (spec §2).
- **Sin tests automatizados nuevos.** El usuario pidió explícitamente QA manual en vez de suites automatizadas para este proyecto. Cada task se verifica con `curl`/build/typecheck y, en la tarea final, con una pasada manual del propio usuario — no se escriben specs de Vitest nuevas en este plan.
- Versiones exactas a instalar (verificadas contra el registro de npm el día de este plan): `fastify@5.12.0`, `@fastify/cors@11.3.0`, `@fastify/cookie@11.1.2`, `@supabase/supabase-js@^2.112.3`, `typescript@7.0.2`, `tsx@4.23.12`, `@types/node@26.2.0`, `vite@8.2.1`, `react@19.2.8`, `react-dom@19.2.8`, `@vitejs/plugin-react@6.0.5`, `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `react-router-dom@7.18.2`, `class-variance-authority@0.7.1`, `clsx@2.1.1`, `tailwind-merge@3.6.0`, `@radix-ui/react-slot@1.3.3`, `lucide-react@1.31.0`, `concurrently@10.0.4`.
- Todos los imports relativos en `server/` llevan extensión `.js` (proyecto ESM + `moduleResolution: NodeNext` — Node resuelve el `.js` al `.ts` transpilado en runtime vía `tsx`).
- Datos demo para verificar manualmente cada task: org `cliente-prueba`, usuario `demo@test.local` / `demo123456`, empleado "Empleado Demo", sucursal "Casa Central" (lat -34.6037, lon -58.3816, radio 100m). Si no existen, correr `node scripts/seed-demo.js` desde la raíz del repo (requiere Supabase local corriendo: `npx supabase start`).

---

## Task 1: Bootstrap de `server/` — Fastify con health check y CORS

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/.env.local` (no versionado — copia de `.env.example` con los valores reales)
- Create: `server/src/env.ts`
- Create: `server/src/index.ts`
- Modify: `.gitignore` (raíz) — agregar `server/.env.local` y `server/dist`

**Interfaces:**
- Produces: `env` (objeto en `src/env.ts`) con `{ port, corsOrigin, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, nodeEnv }`, consumido por todas las tareas siguientes de `server/`.

- [ ] **Step 1: Inicializar el proyecto**

```bash
mkdir -p server/src
cd server
npm init -y
npm pkg set type="module"
npm pkg set scripts.dev="tsx watch --env-file=.env.local src/index.ts"
npm pkg set scripts.build="tsc"
npm pkg set scripts.start="node --env-file=.env.local dist/index.js"
npm pkg set scripts.typecheck="tsc --noEmit"
npm install fastify@5.12.0 @fastify/cors@11.3.0 @supabase/supabase-js@^2.112.3
npm install -D typescript@7.0.2 tsx@4.23.12 @types/node@26.2.0
```

- [ ] **Step 2: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Crear `.env.example` y `.env.local`**

`server/.env.example`:
```
PORT=3001
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`server/.env.local` — copiar el `.env.example` y completar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` con los mismos valores que ya están en el `.env.local` de la raíz del repo (son el mismo stack de Supabase local; ahí las variables se llaman `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — mismos valores, nombres sin el prefijo `NEXT_PUBLIC_` porque acá no hay nada que exponer al cliente).

- [ ] **Step 4: Agregar las rutas nuevas a `.gitignore` de la raíz**

Agregar al final de `.gitignore` (raíz del repo):
```
server/.env.local
server/dist
web/.env.local
web/dist
```

- [ ] **Step 5: Crear `src/env.ts`**

```ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  nodeEnv: process.env.NODE_ENV ?? "development",
};
```

- [ ] **Step 6: Crear `src/index.ts`**

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.corsOrigin, credentials: true });

app.get("/api/health", async () => ({ ok: true }));

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 7: Verificar manualmente**

```bash
cd server
npm run dev > /tmp/oliver-server.log 2>&1 &
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:3001/api/health)
  if [ "$code" = "200" ]; then echo "server OK"; break; fi
  sleep 1
done
curl -s http://localhost:3001/api/health
echo
curl -s -i -H "Origin: http://localhost:5173" http://localhost:3001/api/health | grep -i "access-control-allow-origin"
```

Esperado: `{"ok":true}` y un header `access-control-allow-origin: http://localhost:5173`. Dejar el proceso corriendo en background para las tareas siguientes (no matarlo).

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/package-lock.json server/tsconfig.json server/.env.example server/src/env.ts server/src/index.ts .gitignore
git commit -m "feat(server): bootstrap Fastify con health check y CORS"
```

---

## Task 2: Portar la lógica de negocio a `server/`

**Files:**
- Create: `server/src/lib/supabase-service.ts`
- Create: `server/src/lib/org.ts`
- Create: `server/src/lib/sucursales.ts`
- Create: `server/src/lib/empleados.ts`
- Create: `server/src/lib/otp.ts`
- Create: `server/src/lib/nomina.ts`
- Create: `server/src/lib/geo.ts`
- Create: `server/src/lib/asistencia.ts`

**Interfaces:**
- Consumes: `env` de `server/src/env.ts` (Task 1).
- Produces: `createServiceClient()`, `getOrgBySlug()`, `getCurrentOrg()`, `getSucursal()`, `listSucursales()`, `createSucursal()`, `updateSucursal()`, `getEmpleadoById()`, `getEmpleadoByToken()`, `getEmpleadoByDeviceToken()`, `buscarEnNomina()`, `vincularDispositivo()`, `desvincularDispositivo()`, `generarOtp()`, `verificarOtp()`, `getOtpVigente()`, `registrarMarca()`, `registrarRechazo()`, `listAsistencia()`, `calcularHoras()`, `aprobarRechazada()`, `descartarRechazada()`, `listRechazadas()`, `deleteAsistencia()` — todas consumidas por las Tasks 3 a 7 de esta etapa (solo un subconjunto) y por etapas futuras (el resto).

Es un port 1:1 del contenido de `src/lib/*.ts` de la app Next actual — la única diferencia es el import del cliente de Supabase (nombre de archivo y variables de entorno).

- [ ] **Step 1: Crear `src/lib/supabase-service.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";

export function createServiceClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 2: Crear `src/lib/geo.ts`** (idéntico a `src/lib/geo.ts` de la raíz, sin cambios)

```ts
export function haversineMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface Geocerca {
  lat: number;
  lon: number;
  radio_metros: number;
}

export function dentroDeGeocerca(
  sucursal: Geocerca,
  lat: number,
  lon: number
): { ok: boolean; distancia: number } {
  const distancia = haversineMetros(lat, lon, sucursal.lat, sucursal.lon);
  return { ok: distancia <= sucursal.radio_metros, distancia };
}
```

- [ ] **Step 3: Crear `src/lib/nomina.ts`** (idéntico a `src/lib/nomina.ts` de la raíz, sin cambios)

```ts
export function normalizeNombre(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

function sameWords(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((w, i) => w === b[i]);
}

function subsetWords(a: string[], b: string[]): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length > 0 && shorter.every((w) => longer.includes(w));
}

export function validarEmpleado(nombres: string[], input: string): string | null {
  const target = normalizeNombre(input);
  if (target.length === 0) return null;

  const exactas = nombres.filter((n) => sameWords(normalizeNombre(n), target));
  if (exactas.length === 1) return exactas[0];
  if (exactas.length > 1) return null;

  const parciales = nombres.filter((n) => subsetWords(normalizeNombre(n), target));
  if (parciales.length === 1) return parciales[0];
  return null;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function umbralPalabra(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

function palabrasParecidas(a: string, b: string): boolean {
  if (a === b) return true;
  const umbral = Math.min(umbralPalabra(a.length), umbralPalabra(b.length));
  return levenshtein(a, b) <= umbral;
}

function subsetParecido(shorter: string[], longer: string[]): boolean {
  return shorter.length > 0 && shorter.every((w) => longer.some((lw) => palabrasParecidas(w, lw)));
}

export function buscarEmpleadoParecido(nombres: string[], input: string): string | null {
  const target = normalizeNombre(input);
  if (target.length === 0) return null;

  const candidatos = nombres.filter((n) => {
    const palabras = normalizeNombre(n);
    const [shorter, longer] = target.length <= palabras.length ? [target, palabras] : [palabras, target];
    return subsetParecido(shorter, longer);
  });

  if (candidatos.length === 1) return candidatos[0];
  return null;
}
```

- [ ] **Step 4: Crear `src/lib/org.ts`** (mismo contenido que `src/lib/org.ts` de la raíz, solo cambia el import del cliente)

```ts
import { createServiceClient } from "./supabase-service.js";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("organizations")
    .select("id, name, slug, plan")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
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

- [ ] **Step 5: Crear `src/lib/sucursales.ts`** (mismo contenido que `src/lib/sucursales.ts` de la raíz, solo cambia el import)

```ts
import { createServiceClient } from "./supabase-service.js";

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

export async function listSucursales(orgId: string): Promise<Sucursal[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select("*")
    .eq("org_id", orgId)
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function createSucursal(
  orgId: string,
  input: { nombre: string; lat?: number; lon?: number; radio_metros?: number }
): Promise<Sucursal> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .insert({
      org_id: orgId,
      nombre: input.nombre,
      lat: input.lat ?? null,
      lon: input.lon ?? null,
      radio_metros: input.radio_metros ?? 100,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSucursal(
  orgId: string,
  id: string,
  patch: {
    nombre?: string;
    lat?: number | null;
    lon?: number | null;
    radio_metros?: number;
    activa?: boolean;
  }
): Promise<Sucursal> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSucursal(orgId: string, id: string): Promise<Sucursal | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 6: Crear `src/lib/empleados.ts`** (mismo contenido que `src/lib/empleados.ts` de la raíz, solo cambian los imports)

```ts
import { createServiceClient } from "./supabase-service.js";
import { validarEmpleado, buscarEmpleadoParecido } from "./nomina.js";

export interface Empleado {
  id: string;
  org_id: string;
  nombre: string;
  celular: string | null;
  device_token: string | null;
  activo: boolean;
  created_at: string;
}

export async function listEmpleados(orgId: string): Promise<Empleado[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .select("*")
    .eq("org_id", orgId)
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function createEmpleado(
  orgId: string,
  input: { nombre: string; celular?: string }
): Promise<Empleado> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .insert({ org_id: orgId, nombre: input.nombre, celular: input.celular ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmpleado(
  orgId: string,
  id: string,
  patch: { nombre?: string; celular?: string | null }
): Promise<Empleado> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setEmpleadoActivo(orgId: string, id: string, activo: boolean): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("empleados")
    .update({ activo })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw error;
}

export async function getEmpleadoById(id: string): Promise<Empleado | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEmpleadoByToken(token: string): Promise<Empleado | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .select("*")
    .eq("device_token", token)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEmpleadoByDeviceToken(
  orgId: string,
  token: string
): Promise<Empleado | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .select("*")
    .eq("org_id", orgId)
    .eq("device_token", token)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function vincularDispositivo(
  orgId: string,
  empleadoId: string,
  token: string
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("empleados")
    .update({ device_token: token })
    .eq("org_id", orgId)
    .eq("id", empleadoId);
  if (error) throw error;
}

export async function desvincularDispositivo(orgId: string, empleadoId: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("empleados")
    .update({ device_token: null })
    .eq("org_id", orgId)
    .eq("id", empleadoId);
  if (error) throw error;
}

export interface ResultadoNomina {
  empleado: Empleado;
  exacto: boolean;
}

export async function buscarEnNomina(
  orgId: string,
  input: string
): Promise<ResultadoNomina | null> {
  const service = createServiceClient();
  const { data: activos, error } = await service
    .from("empleados")
    .select("*")
    .eq("org_id", orgId)
    .eq("activo", true);
  if (error) throw error;

  const nombres = activos.map((e) => e.nombre);

  const exacto = validarEmpleado(nombres, input);
  if (exacto) {
    return { empleado: activos.find((e) => e.nombre === exacto)!, exacto: true };
  }

  const parecido = buscarEmpleadoParecido(nombres, input);
  if (parecido) {
    return { empleado: activos.find((e) => e.nombre === parecido)!, exacto: false };
  }

  return null;
}
```

- [ ] **Step 7: Crear `src/lib/otp.ts`** (mismo contenido que `src/lib/otp.ts` de la raíz, solo cambia el import)

```ts
import { randomInt } from "node:crypto";
import { createServiceClient } from "./supabase-service.js";

const OTP_TTL_MINUTOS = 10;
const OTP_MAX_INTENTOS = 5;
export const CANAL_ASISTENCIA_WEB = "asistencia_web";

export interface OtpCode {
  id: string;
  empleado_id: string;
  canal: string;
  code: string;
  intentos: number;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export async function generarOtp(orgId: string, empleadoId: string): Promise<string> {
  const service = createServiceClient();

  const { data: empleado, error: empErr } = await service
    .from("empleados")
    .select("id")
    .eq("org_id", orgId)
    .eq("id", empleadoId)
    .maybeSingle();
  if (empErr) throw empErr;
  if (!empleado) throw new Error("Empleado no encontrado en la organización");

  const { error: delErr } = await service
    .from("otp_codes")
    .delete()
    .eq("empleado_id", empleadoId)
    .eq("canal", CANAL_ASISTENCIA_WEB)
    .is("used_at", null);
  if (delErr) throw delErr;

  const code = randomInt(0, 1000000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTOS * 60 * 1000).toISOString();

  const { error } = await service.from("otp_codes").insert({
    empleado_id: empleadoId,
    canal: CANAL_ASISTENCIA_WEB,
    code,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return code;
}

export type VerificarOtpResult =
  | { ok: true }
  | { ok: false; motivo: "incorrecto" | "expirado" | "bloqueado" };

export async function verificarOtp(
  empleadoId: string,
  code: string
): Promise<VerificarOtpResult> {
  const service = createServiceClient();

  const { data: otp, error } = await service
    .from("otp_codes")
    .select("*")
    .eq("empleado_id", empleadoId)
    .eq("canal", CANAL_ASISTENCIA_WEB)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (!otp || new Date(otp.expires_at) < new Date()) {
    return { ok: false, motivo: "expirado" };
  }
  if (otp.intentos >= OTP_MAX_INTENTOS) {
    return { ok: false, motivo: "bloqueado" };
  }
  if (otp.code !== code.trim()) {
    const { error: updErr } = await service
      .from("otp_codes")
      .update({ intentos: otp.intentos + 1 })
      .eq("id", otp.id);
    if (updErr) throw updErr;
    return { ok: false, motivo: "incorrecto" };
  }

  const { error: useErr } = await service
    .from("otp_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", otp.id);
  if (useErr) throw useErr;
  return { ok: true };
}

export async function getOtpVigente(empleadoId: string): Promise<OtpCode | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("otp_codes")
    .select("*")
    .eq("empleado_id", empleadoId)
    .eq("canal", CANAL_ASISTENCIA_WEB)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 8: Crear `src/lib/asistencia.ts`** (mismo contenido que `src/lib/asistencia.ts` de la raíz, solo cambian los imports del cliente y de `geo`/`sucursales`)

```ts
import { createServiceClient } from "./supabase-service.js";
import { dentroDeGeocerca } from "./geo.js";
import type { Sucursal } from "./sucursales.js";

export type TipoMarca = "entrada" | "salida";

export interface Asistencia {
  id: string;
  org_id: string;
  empleado_id: string;
  sucursal_id: string;
  tipo: TipoMarca;
  lat: number;
  lon: number;
  created_at: string;
}

export type MotivoRechazo =
  | "fuera_de_rango"
  | "sucursal_sin_gps"
  | "nombre_no_encontrado"
  | "dispositivo_ya_vinculado";

export async function registrarRechazo(
  orgId: string,
  input: {
    empleado_id?: string | null;
    sucursal_id?: string | null;
    tipo?: TipoMarca | null;
    lat?: number | null;
    lon?: number | null;
    distancia_metros?: number | null;
    motivo: MotivoRechazo;
  }
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("asistencia_rechazada").insert({
    org_id: orgId,
    empleado_id: input.empleado_id ?? null,
    sucursal_id: input.sucursal_id ?? null,
    tipo: input.tipo ?? null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    distancia_metros: input.distancia_metros ?? null,
    motivo: input.motivo,
  });
  if (error) throw error;
}

export type RegistrarResult =
  | { ok: true; asistencia: Asistencia }
  | { ok: false; motivo: "sucursal_sin_gps" }
  | { ok: false; motivo: "fuera_de_rango"; distancia: number };

export async function registrarMarca(
  orgId: string,
  empleadoId: string,
  sucursal: Sucursal,
  tipo: TipoMarca,
  lat: number,
  lon: number
): Promise<RegistrarResult> {
  const service = createServiceClient();

  const latSucursal = sucursal.lat;
  const lonSucursal = sucursal.lon;
  if (latSucursal == null || lonSucursal == null) {
    await registrarRechazo(orgId, {
      empleado_id: empleadoId,
      sucursal_id: sucursal.id,
      tipo,
      lat,
      lon,
      motivo: "sucursal_sin_gps",
    });
    return { ok: false, motivo: "sucursal_sin_gps" };
  }

  const { ok, distancia } = dentroDeGeocerca(
    { lat: latSucursal, lon: lonSucursal, radio_metros: sucursal.radio_metros },
    lat,
    lon
  );
  if (!ok) {
    await registrarRechazo(orgId, {
      empleado_id: empleadoId,
      sucursal_id: sucursal.id,
      tipo,
      lat,
      lon,
      distancia_metros: Math.round(distancia),
      motivo: "fuera_de_rango",
    });
    return { ok: false, motivo: "fuera_de_rango", distancia: Math.round(distancia) };
  }

  const { data, error } = await service
    .from("asistencia")
    .insert({
      org_id: orgId,
      empleado_id: empleadoId,
      sucursal_id: sucursal.id,
      tipo,
      lat,
      lon,
    })
    .select()
    .single();
  if (error) throw error;
  return { ok: true, asistencia: data };
}

const AR_OFFSET = "-03:00";

function diaUtcInicio(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00${AR_OFFSET}`).toISOString();
}

function diaUtcFin(isoDate: string): string {
  return new Date(`${isoDate}T23:59:59.999${AR_OFFSET}`).toISOString();
}

export interface AsistenciaConNombres extends Asistencia {
  empleado_nombre: string | null;
  sucursal_nombre: string | null;
}

export async function listAsistencia(
  orgId: string,
  filters: { desde: string; hasta: string; sucursalId?: string; empleadoId?: string }
): Promise<AsistenciaConNombres[]> {
  const service = createServiceClient();
  let query = service
    .from("asistencia")
    .select("*, empleados(nombre), sucursales(nombre)")
    .eq("org_id", orgId)
    .gte("created_at", diaUtcInicio(filters.desde))
    .lte("created_at", diaUtcFin(filters.hasta))
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.sucursalId) query = query.eq("sucursal_id", filters.sucursalId);
  if (filters.empleadoId) query = query.eq("empleado_id", filters.empleadoId);

  const { data, error } = await query;
  if (error) throw error;
  return data.map((r) => ({
    ...r,
    empleado_nombre: r.empleados?.nombre ?? null,
    sucursal_nombre: r.sucursales?.nombre ?? null,
    empleados: undefined,
    sucursales: undefined,
  }));
}

export async function deleteAsistencia(orgId: string, id: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("asistencia")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw error;
}

export interface Rechazada {
  id: string;
  org_id: string;
  empleado_id: string | null;
  sucursal_id: string | null;
  tipo: TipoMarca | null;
  lat: number | null;
  lon: number | null;
  distancia_metros: number | null;
  motivo: MotivoRechazo;
  resuelto: boolean;
  created_at: string;
  empleado_nombre: string | null;
  sucursal_nombre: string | null;
}

export async function listRechazadas(orgId: string): Promise<Rechazada[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("asistencia_rechazada")
    .select("*, empleados(nombre), sucursales(nombre)")
    .eq("org_id", orgId)
    .eq("resuelto", false)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map((r) => ({
    ...r,
    empleado_nombre: r.empleados?.nombre ?? null,
    sucursal_nombre: r.sucursales?.nombre ?? null,
    empleados: undefined,
    sucursales: undefined,
  }));
}

export async function aprobarRechazada(orgId: string, id: string): Promise<void> {
  const service = createServiceClient();
  const { data: row, error } = await service
    .from("asistencia_rechazada")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Intento no encontrado");
  if (!row.empleado_id || !row.sucursal_id || !row.tipo || row.lat == null || row.lon == null) {
    throw new Error("Este intento no tiene empleado/sucursal/tipo/ubicación completos — no se puede aprobar directamente.");
  }

  const { error: insErr } = await service.from("asistencia").insert({
    org_id: orgId,
    empleado_id: row.empleado_id,
    sucursal_id: row.sucursal_id,
    tipo: row.tipo,
    lat: row.lat,
    lon: row.lon,
    created_at: row.created_at,
  });
  if (insErr) throw insErr;

  const { error: updErr } = await service
    .from("asistencia_rechazada")
    .update({ resuelto: true })
    .eq("id", id);
  if (updErr) throw updErr;
}

export async function descartarRechazada(orgId: string, id: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("asistencia_rechazada")
    .update({ resuelto: true })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw error;
}

export interface Turno {
  empleado_id: string;
  nombre: string;
  sucursal_id: string;
  sucursal_nombre: string;
  entrada_at: string;
  salida_at: string | null;
  horas: number | null;
}

export async function calcularHoras(
  orgId: string,
  filters: { desde: string; hasta: string; sucursalId?: string }
): Promise<Turno[]> {
  const service = createServiceClient();
  let query = service
    .from("asistencia")
    .select("empleado_id, sucursal_id, tipo, created_at, empleados(nombre), sucursales(nombre)")
    .eq("org_id", orgId)
    .gte("created_at", diaUtcInicio(filters.desde))
    .lte("created_at", diaUtcFin(filters.hasta))
    .order("created_at", { ascending: true });
  if (filters.sucursalId) query = query.eq("sucursal_id", filters.sucursalId);

  const { data, error } = await query;
  if (error) throw error;

  interface Reg {
    empleado_id: string;
    sucursal_id: string;
    tipo: TipoMarca;
    created_at: string;
    nombre: string;
    sucursal_nombre: string;
  }
  const nombreDe = (rel: { nombre: string } | { nombre: string }[] | null): string =>
    (Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre) ?? "?";

  const regs: Reg[] = data.map((r) => ({
    empleado_id: r.empleado_id,
    sucursal_id: r.sucursal_id,
    tipo: r.tipo,
    created_at: r.created_at,
    nombre: nombreDe(r.empleados),
    sucursal_nombre: nombreDe(r.sucursales),
  }));

  const porPar = new Map<string, Reg[]>();
  for (const r of regs) {
    const key = `${r.empleado_id}:${r.sucursal_id}`;
    if (!porPar.has(key)) porPar.set(key, []);
    porPar.get(key)!.push(r);
  }

  const turnos: Turno[] = [];
  for (const regsDelPar of porPar.values()) {
    let pendiente: Reg | null = null;
    const aTurno = (entrada: Reg, salida: Reg | null): Turno => ({
      empleado_id: entrada.empleado_id,
      nombre: entrada.nombre,
      sucursal_id: entrada.sucursal_id,
      sucursal_nombre: entrada.sucursal_nombre,
      entrada_at: entrada.created_at,
      salida_at: salida?.created_at ?? null,
      horas: salida
        ? Math.round(
            ((new Date(salida.created_at).getTime() - new Date(entrada.created_at).getTime()) / 3600000) * 100
          ) / 100
        : null,
    });

    for (const r of regsDelPar) {
      if (r.tipo === "entrada") {
        if (pendiente) turnos.push(aTurno(pendiente, null));
        pendiente = r;
      } else if (pendiente) {
        turnos.push(aTurno(pendiente, r));
        pendiente = null;
      }
    }
    if (pendiente) turnos.push(aTurno(pendiente, null));
  }

  return turnos.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.entrada_at.localeCompare(b.entrada_at));
}
```

- [ ] **Step 9: Verificar que compila**

```bash
cd server
npm run typecheck
```

Esperado: sin errores. Este task no tiene verificación funcional propia (no hay ninguna ruta HTTP que use estas funciones todavía) — la lógica se ejercita indirectamente en las Tasks 4 a 7 cuando se conecta a las rutas de `/marcar`.

- [ ] **Step 10: Commit**

```bash
git add server/src/lib
git commit -m "feat(server): portar lógica de negocio (org, sucursales, empleados, otp, nomina, geo, asistencia)"
```

---

## Task 3: Auth plugin (Bearer token) + `GET /api/me`

**Files:**
- Create: `server/src/lib/supabase-anon.ts`
- Create: `server/src/plugins/auth.ts`
- Create: `server/src/routes/me.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `env` (Task 1).
- Produces: `requireAuth` (preHandler de Fastify, usado por rutas protegidas de etapas futuras), `request.user` (decorador de tipos sobre `FastifyRequest`).

- [ ] **Step 1: Crear `src/lib/supabase-anon.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";

export function createAnonClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 2: Crear `src/plugins/auth.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@supabase/supabase-js";
import { createAnonClient } from "../lib/supabase-anon.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    return reply.code(401).send({ error: "No autorizado" });
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return reply.code(401).send({ error: "No autorizado" });
  }

  request.user = data.user;
}
```

- [ ] **Step 3: Crear `src/routes/me.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/me", { preHandler: requireAuth }, async (request) => {
    return { id: request.user!.id, email: request.user!.email };
  });
}
```

- [ ] **Step 4: Registrar la ruta en `src/index.ts`**

Reemplazar el contenido completo de `server/src/index.ts` por:

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { meRoutes } from "./routes/me.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.corsOrigin, credentials: true });

app.get("/api/health", async () => ({ ok: true }));

await app.register(meRoutes);

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Verificar manualmente**

`tsx watch` ya recargó el server solo (queda corriendo desde el Task 1). Verificar:

```bash
echo "--- sin token ---"
curl -s -i http://localhost:3001/api/me | head -1

echo "--- obtener un token real del usuario demo ---"
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

echo "--- con token ---"
curl -s http://localhost:3001/api/me -H "Authorization: Bearer $TOKEN"
echo
```

Esperado: la primera llamada devuelve `401 {"error":"No autorizado"}`; la segunda devuelve `200 {"id":"...","email":"demo@test.local"}`.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/supabase-anon.ts server/src/plugins server/src/routes/me.ts server/src/index.ts
git commit -m "feat(server): auth plugin con Bearer token + GET /api/me"
```

---

## Task 4: Cookie de dispositivo + `GET /api/marcar/estado`

**Files:**
- Create: `server/src/lib/device-token.ts`
- Create: `server/src/routes/marcar.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `getOrgBySlug` (Task 2), `getSucursal` (Task 2), `getEmpleadoByToken` (Task 2), `env` (Task 1).
- Produces: `getDeviceToken(request)`, `setDeviceCookie(reply, token)`, `nuevoDeviceToken()` — consumidos por las Tasks 6 y 7. `marcarRoutes` (Fastify plugin) — se sigue extendiendo en las Tasks 5 a 7.

- [ ] **Step 1: Instalar `@fastify/cookie`**

```bash
cd server
npm install @fastify/cookie@11.1.2
```

- [ ] **Step 2: Crear `src/lib/device-token.ts`**

```ts
import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";

export const DEVICE_COOKIE = "oliver_device";
const UN_ANIO_SEGUNDOS = 60 * 60 * 24 * 365;

export function getDeviceToken(request: FastifyRequest): string | null {
  return request.cookies[DEVICE_COOKIE] ?? null;
}

export function nuevoDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

export function setDeviceCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: UN_ANIO_SEGUNDOS,
    path: "/",
  });
}
```

- [ ] **Step 3: Crear `src/routes/marcar.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { getOrgBySlug } from "../lib/org.js";
import { getSucursal } from "../lib/sucursales.js";
import { getEmpleadoByToken } from "../lib/empleados.js";
import { getDeviceToken } from "../lib/device-token.js";

interface EstadoQuery {
  org: string;
  sucursal: string;
}

export async function marcarRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: EstadoQuery }>("/api/marcar/estado", async (request, reply) => {
    const { org: orgSlug, sucursal: sucursalId } = request.query;
    if (!orgSlug || !sucursalId) {
      return reply.code(400).send({ error: "Faltan datos" });
    }

    const org = await getOrgBySlug(orgSlug);
    const sucursal = org ? await getSucursal(org.id, sucursalId) : null;
    if (!org || !sucursal || !sucursal.activa) {
      return reply.code(404).send({
        error: "Este enlace no es válido o la sucursal está desactivada. Pedile el QR correcto a tu encargado.",
      });
    }

    const token = getDeviceToken(request);
    const empleado = token ? await getEmpleadoByToken(token) : null;
    const nombre = empleado && empleado.org_id === org.id ? empleado.nombre : null;

    return { sucursalNombre: sucursal.nombre, empleadoNombre: nombre };
  });
}
```

- [ ] **Step 4: Registrar el plugin de cookies y las rutas en `src/index.ts`**

Reemplazar el contenido completo de `server/src/index.ts` por:

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { env } from "./env.js";
import { meRoutes } from "./routes/me.js";
import { marcarRoutes } from "./routes/marcar.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.corsOrigin, credentials: true });
await app.register(cookie);

app.get("/api/health", async () => ({ ok: true }));

await app.register(meRoutes);
await app.register(marcarRoutes);

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Verificar manualmente**

Necesita la sucursal demo real. Obtener su id:

```bash
SUCURSAL_ID=$(node -e '
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(Boolean).map(l=>l.split("=").map(s=>s.trim())));
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
c.from("sucursales").select("id").eq("nombre","Casa Central").maybeSingle().then(({data}) => console.log(data.id));
')
echo "sucursal: $SUCURSAL_ID"

curl -s "http://localhost:3001/api/marcar/estado?org=cliente-prueba&sucursal=$SUCURSAL_ID"
echo
curl -s -i "http://localhost:3001/api/marcar/estado?org=no-existe&sucursal=$SUCURSAL_ID" | head -1
```

Esperado: la primera devuelve `200 {"sucursalNombre":"Casa Central","empleadoNombre":null}` (o el nombre del empleado si ya está vinculado de pruebas anteriores); la segunda devuelve `404`.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/device-token.ts server/src/routes/marcar.ts server/src/index.ts server/package.json server/package-lock.json
git commit -m "feat(server): cookie de dispositivo + GET /api/marcar/estado"
```

---

## Task 5: `POST /api/marcar/identificar`

**Files:**
- Modify: `server/src/routes/marcar.ts`

**Interfaces:**
- Consumes: `buscarEnNomina` (Task 2), `generarOtp` (Task 2), `registrarRechazo` (Task 2), `getOrgBySlug`/`getSucursal` (Task 2).
- Produces: nada nuevo consumido por otras tasks — es la primera pantalla del flujo, la consume `web/` en la Task 10.

- [ ] **Step 1: Agregar la ruta a `src/routes/marcar.ts`**

Agregar estos imports al principio del archivo (junto a los que ya están):

```ts
import { buscarEnNomina } from "../lib/empleados.js";
import { generarOtp } from "../lib/otp.js";
import { registrarRechazo } from "../lib/asistencia.js";
```

Agregar dentro de `marcarRoutes`, después de la ruta `estado`:

```ts
  interface IdentificarBody {
    orgSlug?: string;
    sucursalId?: string;
    nombre?: string;
  }

  app.post<{ Body: IdentificarBody }>("/api/marcar/identificar", async (request, reply) => {
    const { orgSlug, sucursalId, nombre } = request.body ?? {};
    if (!orgSlug || !sucursalId || !nombre?.trim()) {
      return reply.code(400).send({ error: "Faltan datos" });
    }

    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return reply.code(404).send({ error: "Organización no encontrada" });
    }
    const sucursal = await getSucursal(org.id, sucursalId);
    if (!sucursal || !sucursal.activa) {
      return reply.code(404).send({ error: "Sucursal no encontrada" });
    }

    const resultado = await buscarEnNomina(org.id, nombre.trim());
    if (!resultado) {
      await registrarRechazo(org.id, {
        sucursal_id: sucursal.id,
        motivo: "nombre_no_encontrado",
      });
      return reply.code(404).send({
        error: "No encontramos ese nombre en la nómina. Escribilo como figura en tu recibo o avisale a tu encargado.",
      });
    }

    const { empleado, exacto } = resultado;

    if (empleado.device_token) {
      await registrarRechazo(org.id, {
        empleado_id: empleado.id,
        sucursal_id: sucursal.id,
        motivo: "dispositivo_ya_vinculado",
      });
      return reply.code(409).send({
        error: "Este nombre ya está vinculado a otro dispositivo. Avisale a tu encargado.",
      });
    }

    if (!exacto) {
      return { sugerencia: empleado.nombre };
    }

    await generarOtp(org.id, empleado.id);
    return { empleadoId: empleado.id };
  });
```

- [ ] **Step 2: Verificar manualmente**

```bash
curl -s -X POST http://localhost:3001/api/marcar/identificar \
  -H "Content-Type: application/json" \
  -d "{\"orgSlug\":\"cliente-prueba\",\"sucursalId\":\"$SUCURSAL_ID\",\"nombre\":\"Empleado Demo\"}"
echo
curl -s -X POST http://localhost:3001/api/marcar/identificar \
  -H "Content-Type: application/json" \
  -d "{\"orgSlug\":\"cliente-prueba\",\"sucursalId\":\"$SUCURSAL_ID\",\"nombre\":\"Nombre Que No Existe\"}"
echo
```

Esperado: la primera devuelve `{"empleadoId":"..."}` si "Empleado Demo" todavía no tiene dispositivo vinculado, o `409` si ya lo tiene (de pruebas anteriores — en ese caso confirmar que el mensaje de error sea el de "ya vinculado"). La segunda devuelve `404` con el mensaje de nombre no encontrado.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/marcar.ts
git commit -m "feat(server): POST /api/marcar/identificar"
```

---

## Task 6: `POST /api/marcar/verificar`

**Files:**
- Modify: `server/src/routes/marcar.ts`

**Interfaces:**
- Consumes: `verificarOtp` (Task 2), `getEmpleadoById`/`vincularDispositivo` (Task 2), `nuevoDeviceToken`/`setDeviceCookie` (Task 4).

- [ ] **Step 1: Agregar la ruta**

Agregar estos imports:

```ts
import { verificarOtp } from "../lib/otp.js";
import { getEmpleadoById, vincularDispositivo } from "../lib/empleados.js";
import { nuevoDeviceToken, setDeviceCookie } from "../lib/device-token.js";
```

Agregar dentro de `marcarRoutes`, después de la ruta `identificar`:

```ts
  interface VerificarBody {
    empleadoId?: string;
    code?: string;
  }

  app.post<{ Body: VerificarBody }>("/api/marcar/verificar", async (request, reply) => {
    const { empleadoId, code } = request.body ?? {};
    if (!empleadoId || !code?.trim()) {
      return reply.code(400).send({ error: "Faltan datos" });
    }

    const empleado = await getEmpleadoById(empleadoId);
    if (!empleado || !empleado.activo) {
      return reply.code(404).send({ error: "Empleado no encontrado" });
    }

    const resultado = await verificarOtp(empleado.id, code);
    if (!resultado.ok) {
      if (resultado.motivo === "incorrecto") {
        return reply.code(400).send({ error: "Código incorrecto. Revisalo y probá de nuevo." });
      }
      return reply.code(400).send({
        error: "El código venció o quedó bloqueado. Pedile uno nuevo a tu encargado.",
      });
    }

    const token = nuevoDeviceToken();
    await vincularDispositivo(empleado.org_id, empleado.id, token);
    setDeviceCookie(reply, token);

    return { ok: true, nombre: empleado.nombre };
  });
```

- [ ] **Step 2: Verificar manualmente**

```bash
EMPLEADO_ID=$(node -e '
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(Boolean).map(l=>l.split("=").map(s=>s.trim())));
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
c.from("empleados").select("id").eq("nombre","Empleado Demo").maybeSingle().then(({data}) => console.log(data.id));
')

CODE=$(node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(Boolean).map(l=>l.split('=').map(s=>s.trim())));
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
c.from('otp_codes').select('code').eq('empleado_id','$EMPLEADO_ID').is('used_at', null).order('created_at',{ascending:false}).limit(1).maybeSingle().then(({data}) => console.log(data.code));
")

curl -s -i -c /tmp/oliver-server-cookies.txt -X POST http://localhost:3001/api/marcar/verificar \
  -H "Content-Type: application/json" \
  -d "{\"empleadoId\":\"$EMPLEADO_ID\",\"code\":\"$CODE\"}"
echo
cat /tmp/oliver-server-cookies.txt
```

Esperado: `200 {"ok":true,"nombre":"Empleado Demo"}` con un header `set-cookie: oliver_device=...; HttpOnly`. Si `EMPLEADO_ID` ya tenía el dispositivo vinculado de una prueba anterior (Task 5 puede haber devuelto 409 en vez de generar OTP), desvincularlo primero a mano:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(Boolean).map(l=>l.split('=').map(s=>s.trim())));
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
c.from('empleados').update({device_token: null}).eq('id','$EMPLEADO_ID').then(() => console.log('desvinculado'));
"
```
y repetir la Task 5 antes de este step.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/marcar.ts
git commit -m "feat(server): POST /api/marcar/verificar"
```

---

## Task 7: `POST /api/marcar/registrar`

**Files:**
- Modify: `server/src/routes/marcar.ts`

**Interfaces:**
- Consumes: `getEmpleadoByToken` (Task 2), `getSucursal` (Task 2), `registrarMarca` (Task 2), `getDeviceToken` (Task 4).

- [ ] **Step 1: Agregar la ruta**

Agregar este import:

```ts
import { registrarMarca, type TipoMarca } from "../lib/asistencia.js";
```

Agregar dentro de `marcarRoutes`, después de la ruta `verificar`:

```ts
  interface RegistrarBody {
    sucursalId?: string;
    tipo?: string;
    lat?: number;
    lon?: number;
  }

  app.post<{ Body: RegistrarBody }>("/api/marcar/registrar", async (request, reply) => {
    const token = getDeviceToken(request);
    if (!token) {
      return reply.code(401).send({ error: "Dispositivo no vinculado" });
    }

    const { sucursalId, tipo, lat, lon } = request.body ?? {};
    if (
      !sucursalId ||
      (tipo !== "entrada" && tipo !== "salida") ||
      typeof lat !== "number" ||
      typeof lon !== "number"
    ) {
      return reply.code(400).send({ error: "Faltan datos" });
    }

    const empleado = await getEmpleadoByToken(token);
    if (!empleado) {
      return reply.code(401).send({ error: "Dispositivo no vinculado" });
    }

    const sucursal = await getSucursal(empleado.org_id, sucursalId);
    if (!sucursal || !sucursal.activa) {
      return reply.code(404).send({ error: "Sucursal no encontrada" });
    }

    const resultado = await registrarMarca(
      empleado.org_id,
      empleado.id,
      sucursal,
      tipo as TipoMarca,
      lat,
      lon
    );

    if (!resultado.ok) {
      if (resultado.motivo === "sucursal_sin_gps") {
        return reply.code(422).send({
          error: "Esta sucursal no tiene la ubicación configurada. Avisale a tu encargado.",
        });
      }
      return reply.code(422).send({
        error: `Estás a ${resultado.distancia} m de la sucursal (máximo ${sucursal.radio_metros} m).`,
      });
    }

    return { ok: true, tipo, hora: resultado.asistencia.created_at };
  });
```

- [ ] **Step 2: Verificar manualmente**

```bash
echo "--- dentro de la geocerca ---"
curl -s -b /tmp/oliver-server-cookies.txt -X POST http://localhost:3001/api/marcar/registrar \
  -H "Content-Type: application/json" \
  -d '{"sucursalId":"'"$SUCURSAL_ID"'","tipo":"entrada","lat":-34.6037,"lon":-58.3816}'
echo
echo "--- fuera de la geocerca ---"
curl -s -b /tmp/oliver-server-cookies.txt -X POST http://localhost:3001/api/marcar/registrar \
  -H "Content-Type: application/json" \
  -d '{"sucursalId":"'"$SUCURSAL_ID"'","tipo":"salida","lat":-34.70,"lon":-58.50}'
echo
```

Esperado: la primera `200 {"ok":true,"tipo":"entrada","hora":"..."}`; la segunda `422` con el mensaje de distancia.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/marcar.ts
git commit -m "feat(server): POST /api/marcar/registrar"
```

Con esto `server/` cubre las 4 operaciones completas del flujo de marcado. `web/` empieza en la Task 8.

---

## Task 8: Scaffold de `web/` — Vite + React + Tailwind con los tokens del sistema de diseño

**Files:**
- Create: `web/` (scaffold de Vite)
- Modify: `web/vite.config.ts`
- Modify: `web/index.html`
- Modify: `web/src/index.css`
- Modify: `web/src/App.tsx`
- Create: `web/.env.example`

**Interfaces:**
- Produces: tokens de diseño como utilities de Tailwind (`bg-bg`, `bg-surface`, `text-text`, `bg-accent`/`text-accent`, fuente `font-sans` = Archivo) consumidos por todos los componentes de las Tasks 9 y 10.

- [ ] **Step 1: Crear el proyecto**

```bash
cd /Users/tomasocampo/Documents/personal/proyecto-oliver
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install tailwindcss@4.3.3 @tailwindcss/vite@4.3.3
```

- [ ] **Step 2: Configurar el plugin de Tailwind en Vite**

Reemplazar `web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
```

- [ ] **Step 3: Cargar la fuente Archivo y el título en `index.html`**

Reemplazar el `<head>` de `web/index.html` por:

```html
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;800&display=swap"
      rel="stylesheet"
    />
    <title>Oliver</title>
  </head>
```

- [ ] **Step 4: Tokens de diseño en `src/index.css`**

Reemplazar todo el contenido de `web/src/index.css` por:

```css
@import "tailwindcss";

@theme {
  --color-bg: #f3f2f2;
  --color-surface: #eae9e9;
  --color-text: #201e1d;
  --color-accent: #dc2626;
  --font-sans: "Archivo", sans-serif;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}
```

- [ ] **Step 5: Limpiar el boilerplate default de Vite**

```bash
cd web
rm -f src/App.css src/assets/react.svg
rmdir src/assets 2>/dev/null || true
```

Reemplazar `web/src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg text-text">
      <div className="rounded-lg bg-surface p-8">
        <h1 className="text-[42px] font-extrabold">Oliver</h1>
        <p className="mt-2 text-[15px]">Scaffold de Vite + Tailwind listo.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Crear `.env.example`**

`web/.env.example`:
```
VITE_API_URL=http://localhost:3001
```

- [ ] **Step 7: Verificar manualmente**

```bash
cd web
npm run build
npm run dev > /tmp/oliver-web.log 2>&1 &
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:5173/)
  if [ "$code" = "200" ]; then echo "web OK"; break; fi
  sleep 1
done
curl -s http://localhost:5173/ | grep -o "<title>[^<]*</title>"
```

Esperado: `npm run build` sin errores (confirma que TS + Tailwind v4 están bien conectados) y `<title>Oliver</title>` en la respuesta. La verificación visual (que el fondo/tipografía/colores se vean como en el PDF) queda para el usuario en la Task 11 — `curl` no puede confirmar estilos.

- [ ] **Step 8: Commit**

```bash
git add web/package.json web/package-lock.json web/vite.config.ts web/index.html web/src/index.css web/src/App.tsx web/.env.example web/tsconfig*.json web/src/main.tsx web/public
git commit -m "feat(web): bootstrap Vite + React + Tailwind con tokens del sistema de diseño"
```

---

## Task 9: Componentes base (Button, Input, Card, Badge, Table)

**Files:**
- Create: `web/src/lib/utils.ts`
- Create: `web/src/components/ui/button.tsx`
- Create: `web/src/components/ui/input.tsx`
- Create: `web/src/components/ui/card.tsx`
- Create: `web/src/components/ui/badge.tsx`
- Create: `web/src/components/ui/table.tsx`

**Interfaces:**
- Consumes: tokens de Tailwind de la Task 8 (`bg-text`, `bg-accent`, `bg-surface`, etc.).
- Produces: `cn()`, `Button`/`buttonVariants`, `Input`, `Card`/`CardTitle`, `Badge`/`badgeVariants`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` — consumidos por `MarcarPage` (Task 10) y por las páginas del panel en etapas futuras.

- [ ] **Step 1: Instalar dependencias**

```bash
cd web
npm install class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.6.0 @radix-ui/react-slot@1.3.3 lucide-react@1.31.0
mkdir -p src/lib src/components/ui
```

- [ ] **Step 2: Crear `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Crear `src/components/ui/button.tsx`**

Variantes mapeadas al sistema mono-acento del PDF: `default` (tinta llena), `outline` (contorno), `accent` (el CTA que "pide atención", ej. "Marcar entrada"), `ghost` (texto simple, ej. "No"/"Cancelar").

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-[15px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-text text-bg hover:opacity-90",
        outline: "border border-text bg-transparent text-text hover:bg-surface",
        accent: "bg-accent text-white hover:opacity-90",
        ghost: "bg-transparent text-text hover:bg-surface",
      },
      size: {
        default: "h-10 px-4 py-2",
        lg: "h-14 w-full px-4 text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 4: Crear `src/components/ui/input.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-text/20 bg-bg px-3 py-2 text-[15px] text-text placeholder:text-text/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 5: Crear `src/components/ui/card.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg bg-surface p-6", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-[11px] font-medium uppercase tracking-wide text-text/60", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

export { Card, CardTitle };
```

- [ ] **Step 6: Crear `src/components/ui/badge.tsx`**

Sistema mono-acento: `filled` (resuelto/activo), `outline` (pendiente), `accent` (rechazado — lo único que usa el color de marca).

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
  {
    variants: {
      variant: {
        filled: "bg-text text-bg",
        outline: "border border-text text-text",
        accent: "bg-accent text-white",
      },
    },
    defaultVariants: { variant: "outline" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 7: Crear `src/components/ui/table.tsx`**

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn("w-full text-left text-[15px]", className)} {...props} />
  )
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("text-[11px] uppercase tracking-wide text-text/60", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />);
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("border-b border-text/10", className)} {...props} />
  )
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <th ref={ref} className={cn("p-2 font-medium", className)} {...props} />
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn("p-2", className)} {...props} />
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

- [ ] **Step 8: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores. `Table` y `Badge` todavía no tienen consumidor en esta etapa (los usan las páginas del panel en etapas futuras) — es esperable que el build pase igual, TypeScript no falla por exports sin usar.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/utils.ts web/src/components/ui web/package.json web/package-lock.json
git commit -m "feat(web): componentes base (Button, Input, Card, Badge, Table) con el sistema mono-acento"
```

---

## Task 10: Cliente de API + página `/marcar/:org/:sucursal`

**Files:**
- Create: `web/src/lib/api.ts`
- Create: `web/src/pages/MarcarPage.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Card` (Task 9); rutas `GET /api/marcar/estado`, `POST /api/marcar/identificar`, `POST /api/marcar/verificar`, `POST /api/marcar/registrar` (Tasks 4 a 7).

- [ ] **Step 1: Instalar React Router**

```bash
cd web
npm install react-router-dom@7.18.2
```

- [ ] **Step 2: Crear `src/lib/api.ts`**

```ts
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? "Algo salió mal. Probá de nuevo.");
  }
  return body as T;
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

- [ ] **Step 3: Crear `src/pages/MarcarPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { getEstadoMarcado, identificar, verificar, registrarMarca } from "../lib/api";

type Etapa =
  | { tipo: "cargando" }
  | { tipo: "invalido" }
  | { tipo: "identificar" }
  | { tipo: "confirmar"; sugerencia: string }
  | { tipo: "codigo"; empleadoId: string }
  | { tipo: "marcar"; nombre: string };

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function MarcarPage() {
  const { org, sucursal } = useParams<{ org: string; sucursal: string }>();
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "cargando" });
  const [nombre, setNombre] = useState("");
  const [code, setCode] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!org || !sucursal) return;
    getEstadoMarcado(org, sucursal)
      .then((estado) => {
        setSucursalNombre(estado.sucursalNombre);
        setEtapa(
          estado.empleadoNombre
            ? { tipo: "marcar", nombre: estado.empleadoNombre }
            : { tipo: "identificar" }
        );
      })
      .catch(() => setEtapa({ tipo: "invalido" }));
  }, [org, sucursal]);

  async function handleIdentificar(nombreAUsar: string) {
    if (!org || !sucursal) return;
    setLoading(true);
    setError(null);
    try {
      const body = await identificar(org, sucursal, nombreAUsar);
      if (body.sugerencia) {
        setEtapa({ tipo: "confirmar", sugerencia: body.sugerencia });
      } else if (body.empleadoId) {
        setEtapa({ tipo: "codigo", empleadoId: body.empleadoId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificar(empleadoId: string) {
    setLoading(true);
    setError(null);
    try {
      const body = await verificar(empleadoId, code);
      setEtapa({ tipo: "marcar", nombre: body.nombre });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleMarcar(tipo: "entrada" | "salida") {
    if (!sucursal) return;
    setLoading(true);
    setError(null);
    setMensaje(null);

    if (!navigator.geolocation) {
      setError("Este navegador no soporta geolocalización. Probá con Chrome o Safari.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const body = await registrarMarca(sucursal, tipo, pos.coords.latitude, pos.coords.longitude);
          const label = body.tipo === "entrada" ? "Entrada" : "Salida";
          setMensaje(`${label} registrada a las ${horaLocal(body.hora)} ✔`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(
          "Necesitamos tu ubicación para registrar la marca. Habilitá la geolocalización en el navegador y probá de nuevo."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  if (etapa.tipo === "cargando") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8">
        <p className="text-text/60">Cargando...</p>
      </main>
    );
  }

  if (etapa.tipo === "invalido") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8">
        <p className="max-w-sm text-center text-text">
          Este enlace no es válido o la sucursal está desactivada. Pedile el QR correcto a tu encargado.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-8">
      <Card className="w-full max-w-sm">
        <h1 className="text-[20px] font-extrabold text-text">{sucursalNombre}</h1>

        {etapa.tipo === "identificar" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleIdentificar(nombre);
            }}
            className="mt-4 space-y-4"
          >
            <p className="text-[15px] text-text/60">
              Escribí tu nombre y apellido como figura en la nómina.
            </p>
            <Input
              required
              placeholder="Tu nombre y apellido"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Button type="submit" variant="accent" size="lg" disabled={loading}>
              Continuar
            </Button>
          </form>
        )}

        {etapa.tipo === "confirmar" && (
          <div className="mt-4 space-y-4">
            <p className="text-text">
              ¿Sos <strong>{etapa.sugerencia}</strong>?
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => handleIdentificar(etapa.sugerencia)}
                variant="accent"
                disabled={loading}
                className="flex-1"
              >
                Sí, soy yo
              </Button>
              <Button
                onClick={() => setEtapa({ tipo: "identificar" })}
                variant="outline"
                className="flex-1"
              >
                No
              </Button>
            </div>
          </div>
        )}

        {etapa.tipo === "codigo" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerificar(etapa.empleadoId);
            }}
            className="mt-4 space-y-4"
          >
            <p className="text-[15px] text-text/60">
              Pedile el código de vinculación a tu encargado e ingresalo acá. Se hace una sola vez en
              este dispositivo.
            </p>
            <Input
              required
              inputMode="numeric"
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center text-lg tracking-widest"
            />
            <Button type="submit" variant="accent" size="lg" disabled={loading}>
              Vincular
            </Button>
          </form>
        )}

        {etapa.tipo === "marcar" && (
          <div className="mt-4 space-y-4">
            <p className="text-text">
              Hola, <strong>{etapa.nombre}</strong>
            </p>
            <Button onClick={() => handleMarcar("entrada")} variant="accent" size="lg" disabled={loading}>
              Marcar entrada
            </Button>
            <Button onClick={() => handleMarcar("salida")} variant="outline" size="lg" disabled={loading}>
              Marcar salida
            </Button>
          </div>
        )}

        {mensaje && <p className="mt-4 text-[15px] text-green-700">{mensaje}</p>}
        {error && <p className="mt-4 text-[15px] text-accent">{error}</p>}
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Conectar el router en `src/App.tsx`**

Reemplazar `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MarcarPage from "./pages/MarcarPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
        <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores. La verificación funcional completa (clickear el flujo de las 5 pantallas en el navegador) se hace en la Task 11, junto con el resto del checklist manual.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/api.ts web/src/pages web/src/App.tsx web/package.json web/package-lock.json
git commit -m "feat(web): página /marcar/:org/:sucursal con las 5 pantallas del flujo"
```

---

## Task 11: Verificación manual end-to-end + borrado del `/marcar` viejo de Next.js

**Files:**
- Delete: `src/app/marcar/`
- Delete: `src/app/api/marcar/`
- Modify: `src/lib/auth/public-paths.ts`
- Modify: `src/lib/auth/__tests__/public-paths.test.ts`

**Interfaces:** ninguna — es la tarea de cierre de la etapa.

- [ ] **Step 1: Confirmar que `server/` y `web/` siguen corriendo**

```bash
curl -s http://localhost:3001/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

Si alguno no responde, levantarlo de nuevo (`npm run dev` en `server/` y en `web/`).

- [ ] **Step 2: Dejar el empleado demo sin vincular para probar el flujo completo**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(Boolean).map(l=>l.split('=').map(s=>s.trim())));
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
c.from('empleados').update({device_token: null}).eq('nombre','Empleado Demo').then(() => console.log('desvinculado'));
"
```

- [ ] **Step 3: Pasarle al usuario el checklist manual y esperar su confirmación**

Este checklist es para que lo corra el usuario en el navegador (no algo que se pueda automatizar con curl — es la verificación visual contra el PDF):

1. Abrir `http://localhost:5173/marcar/cliente-prueba/<SUCURSAL_ID>` (el id de "Casa Central" obtenido en la Task 4).
2. Confirmar que el fondo, la tarjeta y la tipografía coinciden con el mockup del PDF (sección 03, mobile): fondo gris claro, tarjeta blanca/gris con esquinas redondeadas, título en Archivo bold.
3. Escribir "Empleado Demo" → Continuar.
4. Ir a `/empleados` en el panel viejo (`http://localhost:3000/empleados`, todavía en Next) y generar el código para "Empleado Demo".
5. Cargar el código en la pantalla de Vite → Vincular.
6. Confirmar que aparece "Hola, Empleado Demo" con los dos botones grandes.
7. Tocar "Marcar entrada", permitir la geolocalización del navegador → confirmar el mensaje de éxito con la hora.
8. Recargar la página (F5) → confirmar que ahora entra directo a la pantalla "Hola, Empleado Demo" (sin pedir nombre de nuevo — el estado inicial vía `/api/marcar/estado` funciona).

Esperar la confirmación explícita del usuario antes de continuar al Step 4 (borrar el código viejo).

- [ ] **Step 4: Borrar el `/marcar` viejo de Next.js**

```bash
git rm -r src/app/marcar src/app/api/marcar
```

- [ ] **Step 5: Sacar `/marcar` de las rutas públicas de Next**

Reemplazar `src/lib/auth/public-paths.ts`:

```ts
const PUBLIC_PATHS = ["/login", "/api/auth/callback"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
```

Reemplazar `src/lib/auth/__tests__/public-paths.test.ts`:

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

  it("trata /empleados como protegida", () => {
    expect(isPublicPath("/empleados")).toBe(false);
  });
});
```

- [ ] **Step 6: Confirmar que el panel viejo sigue compilando sin el código borrado**

```bash
rm -rf .next
npx tsc --noEmit
```

Esperado: sin errores (nada del panel actual importaba código de `src/app/marcar/` ni de `src/app/api/marcar/`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: borrar /marcar de Next.js — migrado a web/+server/ (Etapa 1)"
```

---

## Task 12: Script de dev conjunto + README

**Files:**
- Modify: `package.json` (raíz)
- Modify: `README.md`

**Interfaces:** ninguna.

- [ ] **Step 1: Agregar `concurrently` y el script `dev:all` al `package.json` de la raíz**

```bash
npm install -D concurrently@10.0.4
npm pkg set scripts.dev:all="concurrently -n next,server,web -c blue,green,magenta \"npm run dev\" \"npm run dev --prefix server\" \"npm run dev --prefix web\""
```

- [ ] **Step 2: Actualizar el README**

Agregar esta sección al `README.md`, después de "## Estado del refactor":

```markdown
## Migración a Vite (en curso)

El panel se está migrando de Next.js a **Vite + React** (frontend, carpeta
`web/`) y **Fastify** (backend, carpeta `server/`), con el sistema de
diseño de `docs/superpowers/specs/2026-08-13-vite-migration-design.md`
aplicado. La migración es **por etapas** y **por reemplazo directo**: cada
pantalla se borra de Next.js en el momento en que su versión nueva queda
lista, así que durante la migración el panel vive parcialmente en cada
stack.

**Estado actual:** el flujo público `/marcar` ya vive en `web/` + `server/`
y fue borrado de Next.js. El resto del panel (login, home, sucursales,
empleados, asistencia, horas) sigue en Next.js.

### Correr todo en dev

```bash
# Con Supabase local corriendo (npx supabase start):
npm run dev:all
```

Esto levanta los tres procesos a la vez: Next.js (`:3000`, el resto del
panel), Fastify (`:3001`, la API de `web/`) y Vite (`:5173`, el flujo de
`/marcar`). También se pueden levantar por separado con `npm run dev`,
`npm run dev --prefix server` y `npm run dev --prefix web`.

Cada proyecto tiene su propio `.env.local`:
- Raíz (`​.env.local`): igual que antes, lo usa Next.js.
- `server/.env.local`: mismas credenciales de Supabase, nombres de
  variable sin el prefijo `NEXT_PUBLIC_` (ver `server/.env.example`).
- `web/.env.local`: opcional, solo si `server/` no corre en el puerto
  default (ver `web/.env.example`).
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json README.md
git commit -m "chore: script dev:all + documentar el flujo de dev de tres procesos"
```

---

## Al terminar la Etapa 1

- `web/` corre solo con `npm run dev --prefix web`.
- `server/` corre solo con `npm run dev --prefix server`.
- `/marcar/:org/:sucursal` funciona de punta a punta en `http://localhost:5173`, visualmente alineado al PDF, contra los datos demo reales.
- `src/app/marcar/` y `src/app/api/marcar/` ya no existen en el repo.
- Quedan pendientes las Etapas 2 a 5 (spec §5) — cada una arranca con su propio brainstorming cuando el usuario lo pida.
