# Paginado de listados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server-side pagination (10/20/30 por página) para las tablas de Empleados, Asistencia (+rechazadas), RRHH/Ausencias, Sucursales y las vistas de Admin, en dos repos: `proyecto-oliver-api` (backend Express+Supabase) y `proyecto-oliver` (frontend Vite+React+TanStack Query).

**Architecture:** Un helper puro nuevo (`lib/pagination.ts`) parsea/clampea `page`/`pageSize` y arma el rango para `.range()` de Supabase. Cada `list*` de dominio pasa a devolver `{ data, pagination }` en vez de un array plano, y los filtros que hoy corren en el browser (Empleados, Sucursales, parte de Asistencia) se mueven a `WHERE` en la query. El frontend gana un componente `Pagination` reusable y cada hook pasa a aceptar `page`/`pageSize`/filtros como argumentos reactivos de la query key.

**Tech Stack:** Express, Supabase-js (PostgREST `.range()`/`count: "exact"`), Zod (solo donde ya se usaba), Vitest; React, TanStack Query v5 (`placeholderData`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-25-paginado-listados-design.md`

## Global Constraints

- Tamaños de página permitidos: **10, 20, 30** — default 20. Valores fuera de ese conjunto caen al default, no se rechaza con 400 (son query params de UI).
- Respuesta de cada endpoint paginado: `{ data: T[], pagination: { page, pageSize, total, totalPages } }`.
- Los endpoints de export (`/asistencia/export`, `/ausencias/export`) siguen devolviendo el dataset completo filtrado (sin paginar) — y de paso pierden el `.limit(500)`/`.limit(200)` hardcodeado que hoy truncaba silenciosamente.
- Filtro "Dispositivo" de Empleados: solo 2 opciones para el filtro server-side (`vinculado`/`no_vinculado`) — la fila de la tabla sigue mostrando el detalle completo (OTP pendiente con código, etc.), eso no cambia.
- Turnos/Horas (`/horas`, `/turnos`) quedan **fuera de alcance** — no tocar `calcularHoras`, `emparejarTurnos`, ni sus rutas.
- No introducir zod ni middleware de validación nuevo para `page`/`pageSize`/filtros de búsqueda — se clampean/normalizan inline, siguiendo el criterio del spec.
- `proyecto-oliver-api` corre en `../proyecto-oliver-api` relativo al repo del frontend (`proyecto-oliver`). Cada tarea indica en qué repo trabaja.

---

## Task 1: `lib/pagination.ts` — helper puro de paginado (backend)

**Repo:** `proyecto-oliver-api`

**Files:**
- Create: `src/lib/pagination.ts`
- Test: `src/lib/pagination.test.ts`

**Interfaces:**
- Produces: `PAGE_SIZES` (`readonly [10,20,30]`), `type PageSize`, `interface PaginationParams { page: number; pageSize: PageSize }`, `interface PaginationMeta extends PaginationParams { total: number; totalPages: number }`, `interface Paginated<T> { data: T[]; pagination: PaginationMeta }`, `parsePagination(query: Record<string, unknown>): PaginationParams`, `rangeFor(params: PaginationParams): { from: number; to: number }`, `buildMeta(params: PaginationParams, total: number): PaginationMeta`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/pagination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsePagination, rangeFor, buildMeta, PAGE_SIZES } from "./pagination.js";

describe("parsePagination", () => {
  it("usa page=1 y pageSize=20 por default sin query params", () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("acepta page y pageSize válidos", () => {
    expect(parsePagination({ page: "3", pageSize: "10" })).toEqual({ page: 3, pageSize: 10 });
  });

  it("clampea page inválido (negativo, cero, no numérico) a 1", () => {
    expect(parsePagination({ page: "-5" }).page).toBe(1);
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "abc" }).page).toBe(1);
  });

  it("clampea pageSize fuera de [10,20,30] al default (20)", () => {
    expect(parsePagination({ pageSize: "50" }).pageSize).toBe(20);
    expect(parsePagination({ pageSize: "0" }).pageSize).toBe(20);
    expect(parsePagination({ pageSize: "abc" }).pageSize).toBe(20);
  });

  it("acepta los tres tamaños permitidos", () => {
    for (const size of PAGE_SIZES) {
      expect(parsePagination({ pageSize: String(size) }).pageSize).toBe(size);
    }
  });
});

describe("rangeFor", () => {
  it("página 1 con pageSize 20 → from 0, to 19", () => {
    expect(rangeFor({ page: 1, pageSize: 20 })).toEqual({ from: 0, to: 19 });
  });

  it("página 3 con pageSize 10 → from 20, to 29", () => {
    expect(rangeFor({ page: 3, pageSize: 10 })).toEqual({ from: 20, to: 29 });
  });
});

describe("buildMeta", () => {
  it("calcula totalPages redondeando hacia arriba", () => {
    expect(buildMeta({ page: 1, pageSize: 20 }, 45)).toEqual({
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("total=0 da totalPages=1, no 0 (para no romper la UI de paginado)", () => {
    expect(buildMeta({ page: 1, pageSize: 20 }, 0).totalPages).toBe(1);
  });

  it("total múltiplo exacto de pageSize no suma una página de más", () => {
    expect(buildMeta({ page: 1, pageSize: 20 }, 40).totalPages).toBe(2);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd proyecto-oliver-api && npx vitest run src/lib/pagination.test.ts`
Expected: FAIL — `Cannot find module './pagination.js'`

- [ ] **Step 3: Implementar `src/lib/pagination.ts`**

```ts
// Paginado server-side puro — sin import de Supabase/env, mismo patrón que
// horas-calculo.ts/otp-logica.ts/cumplimiento-calculo.ts (spec §3.1).

export const PAGE_SIZES = [10, 20, 30] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
const DEFAULT_PAGE_SIZE: PageSize = 20;

export interface PaginationParams {
  page: number;
  pageSize: PageSize;
}

export interface PaginationMeta extends PaginationParams {
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

function isPageSize(n: number): n is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(n);
}

/**
 * Clampea page/pageSize a valores seguros en vez de rechazar con 400 — son
 * query params de UI (paginado), no datos de negocio que haya que validar
 * estrictamente.
 */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const rawPage = Number(query.page);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawPageSize = Number(query.pageSize);
  const pageSize = isPageSize(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE;

  return { page, pageSize };
}

export function rangeFor({ page, pageSize }: PaginationParams): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function buildMeta(params: PaginationParams, total: number): PaginationMeta {
  return { ...params, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd proyecto-oliver-api && npx vitest run src/lib/pagination.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
cd proyecto-oliver-api
git add src/lib/pagination.ts src/lib/pagination.test.ts
git commit -m "feat: agrega helper puro de paginado (parsePagination/rangeFor/buildMeta)"
```

---

## Task 2: `GET /org/resumen` — desacopla PlanPage de listEmpleados/listSucursales

**Contexto:** `PlanPage.tsx` (frontend) hoy llama a `listEmpleados()`/`listSucursales()` **sin** paginar solo para contar cuántos están activos (`empleados.filter(e => e.estado !== "baja").length`). Las Tasks 3 y 4 van a cambiar el contrato de esos endpoints a `{ data, pagination }`, lo que rompería `PlanPage.tsx` si no se desacopla primero. La función `getOrgResumen(orgId)` (`lib/organizations.ts`) ya calcula exactamente `empleadosActivos`/`sucursalesActivas`/`miembros` con queries de solo-conteo (`count: "exact", head: true`) — hoy solo está expuesta al panel de Admin (`GET /admin/organizations/:id/resumen`). Esta tarea la expone también para la propia organización del usuario.

**Repo:** ambos (`proyecto-oliver-api` primero, luego `proyecto-oliver`)

**Files:**
- Modify: `proyecto-oliver-api/src/routes/org.ts`
- Modify: `proyecto-oliver/src/lib/api.ts`
- Modify: `proyecto-oliver/src/pages/plan/PlanPage.tsx`

**Interfaces:**
- Consumes: `getOrgResumen(orgId: string): Promise<OrgResumen>` de `proyecto-oliver-api/src/lib/organizations.ts` (ya existe, sin cambios).
- Produces: ruta `GET /api/org/resumen` → `OrgResumen` (`{ empleadosActivos, sucursalesActivas, miembros }`); frontend `getOrgResumenActual(): Promise<OrgResumen>`.

- [ ] **Step 1: Agregar la ruta en `proyecto-oliver-api/src/routes/org.ts`**

Agregar el import y la ruta nueva (después de `GET /org/current`, antes de la sección de miembros):

```ts
import { getCurrentOrg } from "../lib/org.js";
import { getEntitlements } from "../lib/planes.js";
import { updateOrganization, getOrgResumen } from "../lib/organizations.js";
```

```ts
orgRouter.get("/org/resumen", requireAuth, requireOrg, async (req: Request, res: Response) => {
  const resumen = await getOrgResumen(req.org!.id);
  res.json(resumen);
});
```

- [ ] **Step 2: Verificar tipos y arrancar el server**

Run: `cd proyecto-oliver-api && npx tsc --noEmit`
Expected: sin errores

Run manual: con el server corriendo (`npm run dev`), `curl -s http://localhost:3020/api/org/resumen -H "Authorization: Bearer <token de un usuario logueado>"` devuelve `{"empleadosActivos":N,"sucursalesActivas":M,"miembros":K}`.

- [ ] **Step 3: Commit del backend**

```bash
cd proyecto-oliver-api
git add src/routes/org.ts
git commit -m "feat: agrega GET /org/resumen para exponer conteos de uso a la propia org"
```

- [ ] **Step 4: Agregar `getOrgResumenActual` en `proyecto-oliver/src/lib/api.ts`**

Junto a `getOrgResumenAdmin` (reusa el tipo `OrgResumen` ya definido ahí mismo, línea ~417):

```ts
export function getOrgResumenActual(): Promise<OrgResumen> {
  return request("/api/org/resumen");
}
```

- [ ] **Step 5: Actualizar `PlanPage.tsx` para usar el resumen en vez de las listas completas**

Reemplazar:

```ts
import { getPlanes, listEmpleados, listSucursales, type PlanDef } from "../../lib/api";
```

por:

```ts
import { getPlanes, getOrgResumenActual, type PlanDef } from "../../lib/api";
```

Reemplazar:

```ts
  const { data: empleados = [], isLoading: empLoading } = useQuery({
    queryKey: ["empleados"],
    queryFn: listEmpleados,
  });
  const { data: sucursales = [], isLoading: sucLoading } = useQuery({
    queryKey: ["sucursales"],
    queryFn: listSucursales,
  });
```

por:

```ts
  const { data: resumen, isLoading: resumenLoading } = useQuery({
    queryKey: ["org-resumen-actual"],
    queryFn: getOrgResumenActual,
  });
```

Más abajo, reemplazar:

```ts
  const empleadosActivos = empleados.filter((e) => e.estado !== "baja").length;
  const sucursalesActivas = sucursales.filter((s) => s.activa).length;
```

por:

```ts
  const empleadosActivos = resumen?.empleadosActivos ?? 0;
  const sucursalesActivas = resumen?.sucursalesActivas ?? 0;
```

Y donde el componente use `empLoading`/`sucLoading` (revisar el resto del archivo con `grep -n "empLoading\|sucLoading" src/pages/plan/PlanPage.tsx`), reemplazar ambos por `resumenLoading`.

- [ ] **Step 6: Typecheck y lint**

Run: `cd proyecto-oliver && npx tsc -b --force && npx oxlint src/pages/plan/PlanPage.tsx src/lib/api.ts`
Expected: sin errores

- [ ] **Step 7: Commit del frontend**

```bash
cd proyecto-oliver
git add src/lib/api.ts src/pages/plan/PlanPage.tsx
git commit -m "refactor: PlanPage usa GET /org/resumen en vez de listar empleados/sucursales completos"
```

---

## Task 3: Paginado de Empleados (backend)

**Repo:** `proyecto-oliver-api`

**Contexto:** `listEmpleados(orgId)` (sin params) se usa también desde `routes/turnos.ts` — **fuera de alcance**, no se toca. Se agrega una función nueva `listEmpleadosPaginado` para los dos consumidores que sí están en alcance (`routes/empleados.ts`, y `routes/admin.ts` en la Task 7).

**Files:**
- Modify: `src/lib/empleados.ts`
- Modify: `src/routes/empleados.ts`

**Interfaces:**
- Consumes: `PageSize`, `PaginationParams`, `Paginated<T>`, `rangeFor`, `buildMeta` de `./pagination.js` (Task 1).
- Produces: `listEmpleadosPaginado(orgId: string, params: ListEmpleadosParams): Promise<Paginated<Empleado & { tiene_asistencia: boolean }>>`, `interface ListEmpleadosParams extends PaginationParams { q?: string; estado?: EstadoEmpleado; sucursalId?: string; cuil?: "con" | "sin"; dispositivo?: "vinculado" | "no_vinculado" }`. Usado por Task 7 (Admin).

- [ ] **Step 1: Agregar `listEmpleadosPaginado` en `src/lib/empleados.ts`**

Agregar el import al tope del archivo:

```ts
import { rangeFor, buildMeta, type PaginationParams, type Paginated } from "./pagination.js";
```

Agregar, después de la función `listEmpleados` existente (no se toca, sigue usándola `routes/turnos.ts`):

```ts
export interface ListEmpleadosParams extends PaginationParams {
  q?: string;
  estado?: EstadoEmpleado;
  sucursalId?: string;
  cuil?: "con" | "sin";
  dispositivo?: "vinculado" | "no_vinculado";
}

export async function listEmpleadosPaginado(
  orgId: string,
  params: ListEmpleadosParams
): Promise<Paginated<Empleado & { tiene_asistencia: boolean }>> {
  const service = createServiceClient();
  const { from, to } = rangeFor(params);

  let query = service
    .from("empleados")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .order("apellido")
    .order("nombre")
    .range(from, to);

  if (params.q) {
    const qSafe = params.q.trim().replace(/[%,]/g, "");
    if (qSafe) query = query.or(`nombre.ilike.%${qSafe}%,apellido.ilike.%${qSafe}%`);
  }
  if (params.estado) query = query.eq("estado", params.estado);
  if (params.sucursalId) query = query.eq("sucursal_id", params.sucursalId);
  if (params.cuil === "con") query = query.not("cuil", "is", null);
  if (params.cuil === "sin") query = query.is("cuil", null);
  if (params.dispositivo === "vinculado") query = query.not("device_token", "is", null);
  if (params.dispositivo === "no_vinculado") query = query.is("device_token", null);

  const { data, error, count } = await query;
  if (error) throw error;

  // Igual que listEmpleados: solo hace falta tieneAsistencia para los
  // inactivos de la página actual (antes era sobre TODA la lista).
  const inactivos = data.filter((e) => e.estado === "baja");
  const flags = await Promise.all(inactivos.map((e) => tieneAsistencia(orgId, e.id)));
  const conAsistencia = new Set(inactivos.filter((_, i) => flags[i]).map((e) => e.id));

  return {
    data: data.map((e) => ({ ...e, tiene_asistencia: conAsistencia.has(e.id) })),
    pagination: buildMeta(params, count ?? 0),
  };
}
```

- [ ] **Step 2: Actualizar `GET /empleados` en `src/routes/empleados.ts`**

Reemplazar el import:

```ts
import {
  listEmpleados,
  createEmpleadoConLimite,
  reactivarEmpleadoConLimite,
  updateEmpleado,
  desvincularDispositivo,
  getEmpleadoScoped,
  tieneAsistencia,
  deleteEmpleado,
} from "../lib/empleados.js";
```

por:

```ts
import {
  listEmpleadosPaginado,
  createEmpleadoConLimite,
  reactivarEmpleadoConLimite,
  updateEmpleado,
  desvincularDispositivo,
  getEmpleadoScoped,
  tieneAsistencia,
  deleteEmpleado,
  type EstadoEmpleado,
} from "../lib/empleados.js";
import { parsePagination } from "../lib/pagination.js";
```

Reemplazar el handler:

```ts
empleadosRouter.get("/empleados", requireAuth, requireOrg, async (req: Request, res: Response) => {
  const empleados = await listEmpleados(req.org!.id);
  const data = await Promise.all(
    empleados.map(async (e) => {
      if (e.device_token) return { ...e, otp: null };
      const otp = await getOtpVigente(e.id);
      return { ...e, otp: otp ? { code: otp.code, expires_at: otp.expires_at } : null };
    })
  );
  res.json(data);
});
```

por:

```ts
interface EmpleadosListQuery {
  page?: string;
  pageSize?: string;
  q?: string;
  estado?: EstadoEmpleado;
  sucursalId?: string;
  cuil?: "con" | "sin";
  dispositivo?: "vinculado" | "no_vinculado";
}

empleadosRouter.get(
  "/empleados",
  requireAuth,
  requireOrg,
  async (req: Request<Record<string, never>, unknown, unknown, EmpleadosListQuery>, res: Response) => {
    const { q, estado, sucursalId, cuil, dispositivo } = req.query;
    const result = await listEmpleadosPaginado(req.org!.id, {
      ...parsePagination(req.query),
      q,
      estado,
      sucursalId,
      cuil,
      dispositivo,
    });
    const data = await Promise.all(
      result.data.map(async (e) => {
        if (e.device_token) return { ...e, otp: null };
        const otp = await getOtpVigente(e.id);
        return { ...e, otp: otp ? { code: otp.code, expires_at: otp.expires_at } : null };
      })
    );
    res.json({ data, pagination: result.pagination });
  }
);
```

- [ ] **Step 3: Typecheck y verificación manual**

Run: `cd proyecto-oliver-api && npx tsc --noEmit`
Expected: sin errores

Run manual (con el server corriendo y un token válido):
```bash
curl -s "http://localhost:3020/api/empleados?page=1&pageSize=10" -H "Authorization: Bearer <token>" | head -c 500
```
Expected: JSON con `{"data":[...],"pagination":{"page":1,"pageSize":10,"total":N,"totalPages":M}}`, como máximo 10 elementos en `data`.

- [ ] **Step 4: Commit**

```bash
cd proyecto-oliver-api
git add src/lib/empleados.ts src/routes/empleados.ts
git commit -m "feat: pagina y filtra GET /empleados server-side"
```

---

## Task 4: Paginado de Sucursales (backend)

**Repo:** `proyecto-oliver-api`

**Contexto:** A diferencia de Empleados, `listSucursales` solo tiene dos consumidores (`routes/sucursales.ts` y `routes/admin.ts`) y ambos están en alcance — se cambia la firma **en el lugar**, sin función paralela, y se actualizan los dos call-sites en esta misma tarea para no dejar el build roto entre tareas.

**Files:**
- Modify: `src/lib/sucursales.ts`
- Modify: `src/routes/sucursales.ts`
- Modify: `src/routes/admin.ts` (línea ~150-158, el handler `GET /admin/organizations/:id/sucursales`)

**Interfaces:**
- Consumes: `rangeFor`, `buildMeta`, `type Paginated`, `type PaginationParams`, `parsePagination` de `./pagination.js` (Task 1).
- Produces: `listSucursales(orgId: string, params: ListSucursalesParams): Promise<Paginated<Sucursal & { tiene_asistencia: boolean }>>`, `interface ListSucursalesParams extends PaginationParams { q?: string; estado?: "activos" | "inactivos" }`.

- [ ] **Step 1: Reescribir `listSucursales` en `src/lib/sucursales.ts`**

Agregar el import al tope:

```ts
import { rangeFor, buildMeta, type PaginationParams, type Paginated } from "./pagination.js";
```

Reemplazar:

```ts
export async function listSucursales(orgId: string): Promise<(Sucursal & { tiene_asistencia: boolean })[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select("*")
    .eq("org_id", orgId)
    .order("nombre");
  if (error) throw error;

  // Solo hace falta saber esto para las inactivas (es lo único que usa el
  // botón de eliminar) — evita traer toda la tabla de asistencia del org,
  // que con Supabase se corta en 1000 filas y daba falsos negativos.
  const inactivas = data.filter((s) => !s.activa);
  const flags = await Promise.all(inactivas.map((s) => tieneAsistencia(orgId, s.id)));
  const conAsistencia = new Set(inactivas.filter((_, i) => flags[i]).map((s) => s.id));

  return data.map((s) => ({ ...s, tiene_asistencia: conAsistencia.has(s.id) }));
}
```

por:

```ts
export interface ListSucursalesParams extends PaginationParams {
  q?: string;
  estado?: "activos" | "inactivos";
}

export async function listSucursales(
  orgId: string,
  params: ListSucursalesParams
): Promise<Paginated<Sucursal & { tiene_asistencia: boolean }>> {
  const service = createServiceClient();
  const { from, to } = rangeFor(params);

  let query = service
    .from("sucursales")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .order("nombre")
    .range(from, to);

  if (params.q) {
    const qSafe = params.q.trim().replace(/[%,]/g, "");
    if (qSafe) query = query.ilike("nombre", `%${qSafe}%`);
  }
  if (params.estado === "activos") query = query.eq("activa", true);
  if (params.estado === "inactivos") query = query.eq("activa", false);

  const { data, error, count } = await query;
  if (error) throw error;

  // Solo hace falta saber esto para las inactivas de la página actual (es
  // lo único que usa el botón de eliminar) — antes corría sobre toda la
  // lista, ahora el N+1 queda acotado a la página.
  const inactivas = data.filter((s) => !s.activa);
  const flags = await Promise.all(inactivas.map((s) => tieneAsistencia(orgId, s.id)));
  const conAsistencia = new Set(inactivas.filter((_, i) => flags[i]).map((s) => s.id));

  return {
    data: data.map((s) => ({ ...s, tiene_asistencia: conAsistencia.has(s.id) })),
    pagination: buildMeta(params, count ?? 0),
  };
}
```

- [ ] **Step 2: Actualizar `GET /sucursales` en `src/routes/sucursales.ts`**

Agregar el import:

```ts
import { parsePagination } from "../lib/pagination.js";
```

Reemplazar:

```ts
sucursalesRouter.get("/sucursales", requireAuth, requireOrg, async (req: Request, res: Response) => {
  const data = await listSucursales(req.org!.id);
  res.json(data);
});
```

por:

```ts
interface SucursalesListQuery {
  page?: string;
  pageSize?: string;
  q?: string;
  estado?: "activos" | "inactivos";
}

sucursalesRouter.get(
  "/sucursales",
  requireAuth,
  requireOrg,
  async (req: Request<Record<string, never>, unknown, unknown, SucursalesListQuery>, res: Response) => {
    const { q, estado } = req.query;
    const result = await listSucursales(req.org!.id, { ...parsePagination(req.query), q, estado });
    res.json(result);
  }
);
```

- [ ] **Step 3: Actualizar el handler de admin en `src/routes/admin.ts`**

Agregar el import de `parsePagination` junto a los otros imports de `admin.ts`:

```ts
import { parsePagination } from "../lib/pagination.js";
```

Reemplazar:

```ts
adminRouter.get(
  "/admin/organizations/:id/sucursales",
  requireAuth,
  requirePlatformAdmin,
  async (req: Request<{ id: string }>, res: Response) => {
    const sucursales = await listSucursales(req.params.id);
    res.json(sucursales);
  }
);
```

por:

```ts
adminRouter.get(
  "/admin/organizations/:id/sucursales",
  requireAuth,
  requirePlatformAdmin,
  async (req: Request<{ id: string }, unknown, unknown, { page?: string; pageSize?: string }>, res: Response) => {
    const result = await listSucursales(req.params.id, parsePagination(req.query));
    res.json(result);
  }
);
```

(Este handler no expone filtros — la pestaña de Sucursales en `OrganizacionDetallePage.tsx` no tiene UI de filtros, solo paginado, tal como lo definió el spec §2.)

- [ ] **Step 4: Typecheck y verificación manual**

Run: `cd proyecto-oliver-api && npx tsc --noEmit`
Expected: sin errores

Run manual:
```bash
curl -s "http://localhost:3020/api/sucursales?page=1&pageSize=10" -H "Authorization: Bearer <token>" | head -c 500
```
Expected: `{"data":[...],"pagination":{...}}`

- [ ] **Step 5: Commit**

```bash
cd proyecto-oliver-api
git add src/lib/sucursales.ts src/routes/sucursales.ts src/routes/admin.ts
git commit -m "feat: pagina y filtra GET /sucursales server-side (propio y admin)"
```

---

## Task 5: Paginado de Asistencia + Rechazadas (backend, corrige el truncado)

**Repo:** `proyecto-oliver-api`

**Contexto:** `listAsistencia`/`listRechazadas` se llaman también desde `GET /asistencia/export`, que necesita el dataset **completo** filtrado (no paginado) — por eso acá `params` es **opcional**: si no viene, no se aplica `.range()` (y se saca el `.limit(500)`/`.limit(200)` hardcodeado, que hoy trunca tanto la vista como el Excel).

**Files:**
- Modify: `src/lib/asistencia.ts`
- Modify: `src/routes/asistencia.ts`

**Interfaces:**
- Consumes: `rangeFor`, `buildMeta`, `type Paginated`, `type PaginationParams`, `parsePagination` de `./pagination.js` (Task 1).
- Produces: `listAsistencia(orgId, filters, params?: PaginationParams): Promise<AsistenciaConNombres[] | Paginated<AsistenciaConNombres>>`, `listRechazadas(orgId, params?: PaginationParams): Promise<Rechazada[] | Paginated<Rechazada>>` — el tipo de retorno depende de si se pasó `params` (ver Step 1, se resuelve con overloads).

- [ ] **Step 1: Reescribir `listAsistencia` y `listRechazadas` en `src/lib/asistencia.ts`**

Agregar el import al tope:

```ts
import { rangeFor, buildMeta, type PaginationParams, type Paginated } from "./pagination.js";
```

Reemplazar la función `listAsistencia` completa:

```ts
export async function listAsistencia(
  orgId: string,
  filters: { desde: string; hasta: string; sucursalId?: string; empleadoId?: string; tipo?: TipoMarca }
): Promise<AsistenciaConNombres[]>;
export async function listAsistencia(
  orgId: string,
  filters: { desde: string; hasta: string; sucursalId?: string; empleadoId?: string; tipo?: TipoMarca },
  params: PaginationParams
): Promise<Paginated<AsistenciaConNombres>>;
export async function listAsistencia(
  orgId: string,
  filters: { desde: string; hasta: string; sucursalId?: string; empleadoId?: string; tipo?: TipoMarca },
  params?: PaginationParams
): Promise<AsistenciaConNombres[] | Paginated<AsistenciaConNombres>> {
  const service = createServiceClient();
  let query = service
    .from("asistencia")
    .select("*, empleados(nombre), sucursales(nombre)", params ? { count: "exact" } : undefined)
    .eq("org_id", orgId)
    .gte("created_at", diaUtcInicio(filters.desde))
    .lte("created_at", diaUtcFin(filters.hasta))
    .order("created_at", { ascending: false });
  if (filters.sucursalId) query = query.eq("sucursal_id", filters.sucursalId);
  if (filters.empleadoId) query = query.eq("empleado_id", filters.empleadoId);
  if (filters.tipo) query = query.eq("tipo", filters.tipo);
  if (params) {
    const { from, to } = rangeFor(params);
    query = query.range(from, to);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const mapped = data.map((r) => ({
    ...r,
    empleado_nombre: r.empleados?.nombre ?? null,
    sucursal_nombre: r.sucursales?.nombre ?? null,
    empleados: undefined,
    sucursales: undefined,
  }));

  return params ? { data: mapped, pagination: buildMeta(params, count ?? 0) } : mapped;
}
```

Reemplazar la función `listRechazadas` completa:

```ts
export async function listRechazadas(orgId: string): Promise<Rechazada[]>;
export async function listRechazadas(orgId: string, params: PaginationParams): Promise<Paginated<Rechazada>>;
export async function listRechazadas(
  orgId: string,
  params?: PaginationParams
): Promise<Rechazada[] | Paginated<Rechazada>> {
  const service = createServiceClient();
  let query = service
    .from("asistencia_rechazada")
    .select("*, empleados(nombre), sucursales(nombre)", params ? { count: "exact" } : undefined)
    .eq("org_id", orgId)
    .eq("resuelto", false)
    .order("created_at", { ascending: false });
  if (params) {
    const { from, to } = rangeFor(params);
    query = query.range(from, to);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const mapped = data.map((r) => ({
    ...r,
    empleado_nombre: r.empleados?.nombre ?? null,
    sucursal_nombre: r.sucursales?.nombre ?? null,
    empleados: undefined,
    sucursales: undefined,
  }));

  return params ? { data: mapped, pagination: buildMeta(params, count ?? 0) } : mapped;
}
```

- [ ] **Step 2: Actualizar `src/routes/asistencia.ts`**

Agregar el import:

```ts
import { parsePagination } from "../lib/pagination.js";
```

Reemplazar el `ListQuery` y el handler `GET /asistencia`:

```ts
interface ListQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  empleadoId?: string;
}
```

por:

```ts
interface ListQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  empleadoId?: string;
  tipo?: "entrada" | "salida";
  page?: string;
  pageSize?: string;
}
```

Reemplazar:

```ts
asistenciaRouter.get(
  "/asistencia",
  requireAuth,
  requireOrg,
  async (req: Request<Record<string, never>, unknown, unknown, ListQuery>, res: Response) => {
    const { desde, hasta, sucursalId, empleadoId } = req.query;
    const data = await listAsistencia(req.org!.id, {
      desde: desde || hoyAR(),
      hasta: hasta || hoyAR(),
      sucursalId,
      empleadoId,
    });
    res.json(data);
  }
);
```

por:

```ts
asistenciaRouter.get(
  "/asistencia",
  requireAuth,
  requireOrg,
  async (req: Request<Record<string, never>, unknown, unknown, ListQuery>, res: Response) => {
    const { desde, hasta, sucursalId, empleadoId, tipo } = req.query;
    const result = await listAsistencia(
      req.org!.id,
      { desde: desde || hoyAR(), hasta: hasta || hoyAR(), sucursalId, empleadoId, tipo },
      parsePagination(req.query)
    );
    res.json(result);
  }
);
```

Reemplazar el handler `GET /asistencia/rechazadas`:

```ts
asistenciaRouter.get(
  "/asistencia/rechazadas",
  requireAuth,
  requireOrg,
  async (req, res) => {
    const data = await listRechazadas(req.org!.id);
    res.json(data);
  }
);
```

por:

```ts
asistenciaRouter.get(
  "/asistencia/rechazadas",
  requireAuth,
  requireOrg,
  async (req: Request<Record<string, never>, unknown, unknown, { page?: string; pageSize?: string }>, res: Response) => {
    const result = await listRechazadas(req.org!.id, parsePagination(req.query));
    res.json(result);
  }
);
```

El handler `GET /asistencia/export` (líneas ~122-178) **no se toca** — sigue llamando `listAsistencia(req.org!.id, { desde, hasta })` y `listRechazadas(req.org!.id)` sin tercer argumento, así que ahora trae el dataset completo sin el límite viejo (antes tenía `.limit(500)`/`.limit(200)` aplicado siempre; ahora esos límites no existen más en absoluto, y sin pasar `params` tampoco se aplica `.range()`).

- [ ] **Step 3: Typecheck y verificación manual**

Run: `cd proyecto-oliver-api && npx tsc --noEmit`
Expected: sin errores

Run manual:
```bash
curl -s "http://localhost:3020/api/asistencia?desde=2026-08-01&hasta=2026-08-25&page=1&pageSize=10" -H "Authorization: Bearer <token>" | head -c 500
curl -s "http://localhost:3020/api/asistencia/rechazadas?page=1&pageSize=10" -H "Authorization: Bearer <token>" | head -c 300
curl -s "http://localhost:3020/api/asistencia/export?desde=2026-08-01&hasta=2026-08-25" -H "Authorization: Bearer <token>" -o /tmp/test.xlsx && file /tmp/test.xlsx
```
Expected: los dos primeros devuelven `{"data":[...],"pagination":{...}}`; el export sigue devolviendo un `.xlsx` válido.

- [ ] **Step 4: Commit**

```bash
cd proyecto-oliver-api
git add src/lib/asistencia.ts src/routes/asistencia.ts
git commit -m "feat: pagina asistencia/rechazadas y saca el limit(500)/limit(200) que truncaba silenciosamente"
```

---

## Task 6: Paginado de RRHH/Ausencias (backend)

**Repo:** `proyecto-oliver-api`

**Contexto:** `GET /ausencias` devuelve `{ ausencias, resumen }`, donde `resumen` (`calcularResumenAusencias`) es un agregado (total, certificados pendientes, por sucursal, por motivo) calculado en JS sobre el array. Si `data` se pagina, `resumen` tiene que seguir calculándose sobre el **dataset filtrado completo**, no solo la página — por eso el handler hace dos llamadas a `listAusencias`: una sin `params` (para el resumen) y otra con `params` (para `data`). Mismo patrón opcional que Task 5.

**Files:**
- Modify: `src/lib/rrhh.ts`
- Modify: `src/routes/rrhh.ts`

**Interfaces:**
- Consumes: `rangeFor`, `buildMeta`, `type Paginated`, `type PaginationParams`, `parsePagination` de `./pagination.js` (Task 1).
- Produces: `listAusencias(orgId, filters?, params?: PaginationParams): Promise<Ausencia[] | Paginated<Ausencia>>`.

- [ ] **Step 1: Reescribir `listAusencias` en `src/lib/rrhh.ts`**

Agregar el import:

```ts
import { rangeFor, buildMeta, type PaginationParams, type Paginated } from "./pagination.js";
```

Reemplazar la función completa:

```ts
export async function listAusencias(
  orgId: string,
  filters?: { desde?: string; hasta?: string; sucursalId?: string; motivo?: string; empleadoId?: string }
): Promise<Ausencia[]>;
export async function listAusencias(
  orgId: string,
  filters: { desde?: string; hasta?: string; sucursalId?: string; motivo?: string; empleadoId?: string } | undefined,
  params: PaginationParams
): Promise<Paginated<Ausencia>>;
export async function listAusencias(
  orgId: string,
  filters?: { desde?: string; hasta?: string; sucursalId?: string; motivo?: string; empleadoId?: string },
  params?: PaginationParams
): Promise<Ausencia[] | Paginated<Ausencia>> {
  const service = createServiceClient();
  let query = service
    .from("ausencias")
    .select(
      "id, empleado_id, sucursal_id, fecha_desde, fecha_hasta, motivo, detalle, contacto, certificado_pendiente, created_at, empleados(nombre), sucursales(nombre)",
      params ? { count: "exact" } : undefined
    )
    .eq("org_id", orgId)
    .order("fecha_desde", { ascending: false });
  // Overlap con el rango filtrado: la ausencia no terminó antes de "desde" y no empieza después de "hasta".
  if (filters?.desde) query = query.gte("fecha_hasta", filters.desde);
  if (filters?.hasta) query = query.lte("fecha_desde", filters.hasta);
  if (filters?.sucursalId) query = query.eq("sucursal_id", filters.sucursalId);
  if (filters?.motivo) query = query.eq("motivo", filters.motivo);
  if (filters?.empleadoId) query = query.eq("empleado_id", filters.empleadoId);
  if (params) {
    const { from, to } = rangeFor(params);
    query = query.range(from, to);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const mapped = (data as AusenciaRow[]).map((r) => ({
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

  return params ? { data: mapped, pagination: buildMeta(params, count ?? 0) } : mapped;
}
```

- [ ] **Step 2: Actualizar `GET /ausencias` en `src/routes/rrhh.ts`**

Agregar el import:

```ts
import { parsePagination } from "../lib/pagination.js";
```

Actualizar `ListQuery`:

```ts
interface ListQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
}
```

por:

```ts
interface ListQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
  page?: string;
  pageSize?: string;
}
```

Reemplazar el handler (línea 54-64):

```ts
rrhhRouter.get(
  "/ausencias",
  requireAuth,
  requireOrg,
  requireModulo("rrhh"),
  requireRole("owner", "admin"),
  async (req: Request<Record<string, never>, unknown, unknown, ListQuery>, res: Response) => {
    const ausencias = await listAusencias(req.org!.id, req.query);
    res.json({ ausencias, resumen: calcularResumenAusencias(ausencias) });
  }
);
```

por:

```ts
rrhhRouter.get(
  "/ausencias",
  requireAuth,
  requireOrg,
  requireModulo("rrhh"),
  requireRole("owner", "admin"),
  async (req: Request<Record<string, never>, unknown, unknown, ListQuery>, res: Response) => {
    const [todasFiltradas, pagina] = await Promise.all([
      listAusencias(req.org!.id, req.query),
      listAusencias(req.org!.id, req.query, parsePagination(req.query)),
    ]);
    res.json({
      ausencias: pagina.data,
      pagination: pagina.pagination,
      resumen: calcularResumenAusencias(todasFiltradas),
    });
  }
);
```

El handler `GET /ausencias/export` (línea ~173-179) **no se toca** — sigue llamando `listAusencias(req.org!.id, req.query)` con un solo argumento después de `orgId`, así que sigue trayendo el dataset completo sin paginar (nunca tuvo el bug de límite hardcodeado que sí tenía asistencia, pero ahora comparte el mismo mecanismo opcional).

- [ ] **Step 3: Typecheck y verificación manual**

Run: `cd proyecto-oliver-api && npx tsc --noEmit`
Expected: sin errores

Run manual:
```bash
curl -s "http://localhost:3020/api/ausencias?page=1&pageSize=10" -H "Authorization: Bearer <token>" | head -c 600
curl -s "http://localhost:3020/api/ausencias/export" -H "Authorization: Bearer <token>" -o /tmp/ausencias.xlsx && file /tmp/ausencias.xlsx
```
Expected: la primera devuelve `{"ausencias":[...máx 10...],"pagination":{...},"resumen":{"total":N,...}}` donde `resumen.total` coincide con `pagination.total` (ambos cuentan el dataset filtrado completo); la segunda sigue devolviendo un `.xlsx` válido con el dataset completo (no se le pasa `params`, así que no queda afectada por el paginado).

- [ ] **Step 4: Commit**

```bash
cd proyecto-oliver-api
git add src/lib/rrhh.ts src/routes/rrhh.ts
git commit -m "feat: pagina GET /ausencias manteniendo el resumen sobre el dataset filtrado completo"
```

---

## Task 7: Paginado de Admin — Organizaciones y Miembros (backend)

**Repo:** `proyecto-oliver-api`

**Contexto:** La lista de Organizaciones hoy vive inline en `routes/admin.ts` (sin filtro de búsqueda) — se mueve a `lib/organizations.ts` como `listOrganizations`, junto a `createOrganization`/`updateOrganization`/`getOrgResumen` que ya están ahí. `listMiembros` tiene un consumidor fuera de alcance (`routes/org.ts`, el propio equipo de la org) — igual que Empleados en Task 3, se agrega una función paralela `listMiembrosPaginado` en vez de tocar la firma existente. El handler de Empleados-por-org reusa `listEmpleadosPaginado` (Task 3); el de Sucursales-por-org ya quedó resuelto en Task 4.

**Files:**
- Modify: `src/lib/organizations.ts`
- Modify: `src/lib/miembros.ts`
- Modify: `src/routes/admin.ts`

**Interfaces:**
- Consumes: `rangeFor`, `buildMeta`, `type Paginated`, `type PaginationParams`, `parsePagination` de `./pagination.js` (Task 1); `listEmpleadosPaginado` de `./empleados.js` (Task 3).
- Produces: `listOrganizations(params: ListOrganizationsParams): Promise<Paginated<OrganizationRow>>`, `listMiembrosPaginado(orgId: string, params: PaginationParams): Promise<Paginated<Miembro>>`.

- [ ] **Step 1: Agregar `listOrganizations` en `src/lib/organizations.ts`**

Agregar el import:

```ts
import { rangeFor, buildMeta, type PaginationParams, type Paginated } from "./pagination.js";
```

Agregar (junto a las demás funciones, reusando el shape que hoy arma `routes/admin.ts` inline):

```ts
export interface OrganizationListRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

export interface ListOrganizationsParams extends PaginationParams {
  q?: string;
}

export async function listOrganizations(params: ListOrganizationsParams): Promise<Paginated<OrganizationListRow>> {
  const service = createServiceClient();
  const { from, to } = rangeFor(params);

  let query = service
    .from("organizations")
    .select("id, name, slug, plan, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.q) {
    const qSafe = params.q.trim().replace(/[%,]/g, "");
    if (qSafe) query = query.or(`name.ilike.%${qSafe}%,slug.ilike.%${qSafe}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as OrganizationListRow[], pagination: buildMeta(params, count ?? 0) };
}
```

- [ ] **Step 2: Agregar `listMiembrosPaginado` en `src/lib/miembros.ts`**

Agregar el import:

```ts
import { rangeFor, buildMeta, type PaginationParams, type Paginated } from "./pagination.js";
```

Agregar, después de `listMiembros` (que se deja intacta, la sigue usando `routes/org.ts`):

```ts
export async function listMiembrosPaginado(orgId: string, params: PaginationParams): Promise<Paginated<Miembro>> {
  const service = createServiceClient();
  const { from, to } = rangeFor(params);

  const { data, error, count } = await service
    .from("org_members")
    .select("user_id, role, created_at", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at")
    .range(from, to);
  if (error) throw error;

  const rows = data as OrgMemberRow[];
  const miembros = await Promise.all(
    rows.map(async (row): Promise<Miembro> => {
      const { data: userData, error: userErr } = await service.auth.admin.getUserById(row.user_id);
      if (userErr) throw userErr;
      return {
        userId: row.user_id,
        email: userData.user?.email ?? "(sin email)",
        role: row.role,
        createdAt: row.created_at,
      };
    })
  );

  return { data: miembros, pagination: buildMeta(params, count ?? 0) };
}
```

- [ ] **Step 3: Actualizar `src/routes/admin.ts`**

Reemplazar los imports del tope:

```ts
import { createOrganization, updateOrganization, getOrgResumen } from "../lib/organizations.js";
import { PERIODOS, PLANES, type PlanSlug } from "../lib/planes.js";
import { listMiembros } from "../lib/miembros.js";
import { listEmpleados } from "../lib/empleados.js";
import { listSucursales } from "../lib/sucursales.js";
```

por:

```ts
import { createOrganization, updateOrganization, getOrgResumen, listOrganizations } from "../lib/organizations.js";
import { PERIODOS, PLANES, type PlanSlug } from "../lib/planes.js";
import { listMiembrosPaginado } from "../lib/miembros.js";
import { listEmpleadosPaginado } from "../lib/empleados.js";
import { listSucursales } from "../lib/sucursales.js";
import { parsePagination } from "../lib/pagination.js";
```

Se puede borrar la interfaz `OrganizationRow` (línea 11-17) — ahora vive como `OrganizationListRow` en `lib/organizations.ts`.

Reemplazar el handler `GET /admin/organizations` (línea 65-78):

```ts
adminRouter.get(
  "/admin/organizations",
  requireAuth,
  requirePlatformAdmin,
  async (_req: Request, res: Response) => {
    const service = createServiceClient();
    const { data, error } = await service
      .from("organizations")
      .select("id, name, slug, plan, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data as OrganizationRow[]);
  }
);
```

por:

```ts
adminRouter.get(
  "/admin/organizations",
  requireAuth,
  requirePlatformAdmin,
  async (req: Request<Record<string, never>, unknown, unknown, { page?: string; pageSize?: string; q?: string }>, res: Response) => {
    const result = await listOrganizations({ ...parsePagination(req.query), q: req.query.q });
    res.json(result);
  }
);
```

(`createServiceClient` puede dejar de importarse en este archivo si no lo usa nada más — verificar con `grep -n "createServiceClient" src/routes/admin.ts`; el resto del archivo sí lo sigue usando para suscripciones, así que el import se queda.)

Reemplazar el handler `GET /admin/organizations/:id/miembros` (línea 130-138):

```ts
adminRouter.get(
  "/admin/organizations/:id/miembros",
  requireAuth,
  requirePlatformAdmin,
  async (req: Request<{ id: string }>, res: Response) => {
    const miembros = await listMiembros(req.params.id);
    res.json(miembros);
  }
);
```

por:

```ts
adminRouter.get(
  "/admin/organizations/:id/miembros",
  requireAuth,
  requirePlatformAdmin,
  async (req: Request<{ id: string }, unknown, unknown, { page?: string; pageSize?: string }>, res: Response) => {
    const result = await listMiembrosPaginado(req.params.id, parsePagination(req.query));
    res.json(result);
  }
);
```

Reemplazar el handler `GET /admin/organizations/:id/empleados` (línea 140-148):

```ts
adminRouter.get(
  "/admin/organizations/:id/empleados",
  requireAuth,
  requirePlatformAdmin,
  async (req: Request<{ id: string }>, res: Response) => {
    const empleados = await listEmpleados(req.params.id);
    res.json(empleados);
  }
);
```

por:

```ts
adminRouter.get(
  "/admin/organizations/:id/empleados",
  requireAuth,
  requirePlatformAdmin,
  async (req: Request<{ id: string }, unknown, unknown, { page?: string; pageSize?: string }>, res: Response) => {
    const result = await listEmpleadosPaginado(req.params.id, parsePagination(req.query));
    res.json(result);
  }
);
```

El handler de `GET /admin/organizations/:id/sucursales` ya quedó actualizado en Task 4 — no se toca acá.

- [ ] **Step 4: Typecheck y verificación manual**

Run: `cd proyecto-oliver-api && npx tsc --noEmit`
Expected: sin errores

Run manual (con un usuario platform admin):
```bash
curl -s "http://localhost:3020/api/admin/organizations?page=1&pageSize=10" -H "Authorization: Bearer <token admin>" | head -c 400
```
Expected: `{"data":[...],"pagination":{...}}`

- [ ] **Step 5: Commit**

```bash
cd proyecto-oliver-api
git add src/lib/organizations.ts src/lib/miembros.ts src/routes/admin.ts
git commit -m "feat: pagina las listas de Admin (organizaciones, miembros, empleados por org)"
```

---

## Task 8: `src/components/ui/pagination.tsx` (frontend)

**Repo:** `proyecto-oliver`

**Files:**
- Create: `src/components/ui/pagination.tsx`

**Interfaces:**
- Produces: `interface PaginationMeta { page: number; pageSize: number; total: number; totalPages: number }`, `interface PaginationProps { pagination: PaginationMeta; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void; className?: string }`, component `Pagination`. Usado por Tasks 10-14. `PaginationMeta` es estructuralmente igual al `PaginationMeta` que va a definirse en `src/lib/api.ts` (Task 9) — no hace falta importar uno desde el otro, TypeScript los matchea por forma.

- [ ] **Step 1: Crear el componente**

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const;

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

function Pagination({ pagination, onPageChange, onPageSizeChange, className }: PaginationProps) {
  const { page, pageSize, total, totalPages } = pagination;
  if (total === 0) return null;

  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-text-secondary",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span>Por página</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 rounded-lg border border-border bg-white px-2 text-[13px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-text-tertiary">
          {desde}–{hasta} de {total}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-text-secondary hover:bg-black/[.03] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-text-tertiary">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-medium",
                p === page ? "bg-accent text-white" : "text-text-secondary hover:bg-black/[.03]"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-text-secondary hover:bg-black/[.03] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export { Pagination };
```

- [ ] **Step 2: Typecheck y lint**

Run: `cd proyecto-oliver && npx tsc -b --force && npx oxlint src/components/ui/pagination.tsx`
Expected: sin errores (el componente todavía no se usa en ninguna página, así que no hay verificación visual posible todavía — llega en las Tasks 10-14).

- [ ] **Step 3: Commit**

```bash
cd proyecto-oliver
git add src/components/ui/pagination.tsx
git commit -m "feat: agrega componente Pagination (selector 10/20/30 + navegación de página)"
```

---

## Task 9: `src/lib/api.ts` — tipos y firmas paginadas (frontend)

**Repo:** `proyecto-oliver`

**Files:**
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: contrato `{ data, pagination }` de Tasks 3-7.
- Produces: `interface PaginationMeta`, `interface Paginated<T>`; firmas nuevas de `listEmpleados`, `listSucursales`, `listAsistencia`, `listRechazadas`, `getAusencias`, `listOrganizationsAdmin`, `listMiembrosAdmin`, `listEmpleadosAdmin`, `listSucursalesAdmin`. Usado por Tasks 10-14.

- [ ] **Step 1: Agregar los tipos genéricos**

Cerca del tope del archivo (junto a otros tipos compartidos, antes del primer uso):

```ts
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}
```

- [ ] **Step 2: Actualizar `listEmpleados`**

Reemplazar:

```ts
export function listEmpleados(): Promise<Empleado[]> {
  return request("/api/empleados");
}
```

por:

```ts
export interface ListEmpleadosParams {
  page: number;
  pageSize: number;
  q?: string;
  estado?: EstadoEmpleado;
  sucursalId?: string;
  cuil?: "con" | "sin";
  dispositivo?: "vinculado" | "no_vinculado";
}

export function listEmpleados(params: ListEmpleadosParams): Promise<Paginated<Empleado>> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize));
  if (params.q) qs.set("q", params.q);
  if (params.estado) qs.set("estado", params.estado);
  if (params.sucursalId) qs.set("sucursalId", params.sucursalId);
  if (params.cuil) qs.set("cuil", params.cuil);
  if (params.dispositivo) qs.set("dispositivo", params.dispositivo);
  return request(`/api/empleados?${qs}`);
}
```

(`EstadoEmpleado` ya está definido más arriba en el archivo — es el mismo tipo que usa `Empleado["estado"]`.)

- [ ] **Step 3: Actualizar `listSucursales`**

Reemplazar:

```ts
export function listSucursales(): Promise<Sucursal[]> {
  return request("/api/sucursales");
}
```

por:

```ts
export interface ListSucursalesParams {
  page: number;
  pageSize: number;
  q?: string;
  estado?: "activos" | "inactivos";
}

export function listSucursales(params: ListSucursalesParams): Promise<Paginated<Sucursal>> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize));
  if (params.q) qs.set("q", params.q);
  if (params.estado) qs.set("estado", params.estado);
  return request(`/api/sucursales?${qs}`);
}
```

- [ ] **Step 4: Actualizar `listAsistencia` y `listRechazadas`**

Reemplazar:

```ts
export function listAsistencia(desde: string, hasta: string): Promise<AsistenciaRegistro[]> {
  return request(`/api/asistencia?desde=${desde}&hasta=${hasta}`);
}
```

por:

```ts
export interface ListAsistenciaParams {
  page: number;
  pageSize: number;
  sucursalId?: string;
  empleadoId?: string;
  tipo?: TipoMarca;
}

export function listAsistencia(
  desde: string,
  hasta: string,
  params: ListAsistenciaParams
): Promise<Paginated<AsistenciaRegistro>> {
  const qs = new URLSearchParams({ desde, hasta, page: String(params.page), pageSize: String(params.pageSize) });
  if (params.sucursalId) qs.set("sucursalId", params.sucursalId);
  if (params.empleadoId) qs.set("empleadoId", params.empleadoId);
  if (params.tipo) qs.set("tipo", params.tipo);
  return request(`/api/asistencia?${qs}`);
}
```

Reemplazar:

```ts
export function listRechazadas(): Promise<Rechazada[]> {
  return request("/api/asistencia/rechazadas");
}
```

por:

```ts
export function listRechazadas(params: { page: number; pageSize: number }): Promise<Paginated<Rechazada>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  return request(`/api/asistencia/rechazadas?${qs}`);
}
```

- [ ] **Step 5: Actualizar `AusenciasResponse` y `getAusencias`**

`interface AusenciasResponse` ya está definida inmediatamente antes de `getAusencias` en el archivo (línea ~620). Reemplazar el bloque completo:

```ts
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
```

por:

```ts
export interface AusenciasResponse {
  ausencias: Ausencia[];
  pagination: PaginationMeta;
  resumen: ResumenAusencias;
}

export function getAusencias(filters: {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
  page: number;
  pageSize: number;
}): Promise<AusenciasResponse> {
  const params = new URLSearchParams();
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  if (filters.sucursalId) params.set("sucursalId", filters.sucursalId);
  if (filters.motivo) params.set("motivo", filters.motivo);
  if (filters.empleadoId) params.set("empleadoId", filters.empleadoId);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  return request(`/api/ausencias?${params}`);
}
```

- [ ] **Step 6: Actualizar las 4 funciones de Admin**

Reemplazar:

```ts
export function listOrganizationsAdmin(): Promise<OrganizationAdmin[]> {
  return request("/api/admin/organizations");
}
```

por:

```ts
export function listOrganizationsAdmin(params: { page: number; pageSize: number; q?: string }): Promise<Paginated<OrganizationAdmin>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.q) qs.set("q", params.q);
  return request(`/api/admin/organizations?${qs}`);
}
```

Reemplazar:

```ts
export function listMiembrosAdmin(orgId: string): Promise<Miembro[]> {
  return request(`/api/admin/organizations/${orgId}/miembros`);
}

export function listEmpleadosAdmin(orgId: string): Promise<Empleado[]> {
  return request(`/api/admin/organizations/${orgId}/empleados`);
}

export function listSucursalesAdmin(orgId: string): Promise<Sucursal[]> {
  return request(`/api/admin/organizations/${orgId}/sucursales`);
}
```

por:

```ts
export function listMiembrosAdmin(orgId: string, params: { page: number; pageSize: number }): Promise<Paginated<Miembro>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  return request(`/api/admin/organizations/${orgId}/miembros?${qs}`);
}

export function listEmpleadosAdmin(orgId: string, params: { page: number; pageSize: number }): Promise<Paginated<Empleado>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  return request(`/api/admin/organizations/${orgId}/empleados?${qs}`);
}

export function listSucursalesAdmin(orgId: string, params: { page: number; pageSize: number }): Promise<Paginated<Sucursal>> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  return request(`/api/admin/organizations/${orgId}/sucursales?${qs}`);
}
```

- [ ] **Step 7: Typecheck**

Run: `cd proyecto-oliver && npx tsc -b --force`
Expected: errores en `pages/empleados/hooks.ts`, `pages/sucursales/hooks.ts`, `pages/asistencia/hooks.ts`, `pages/rrhh/hooks.ts`, `pages/admin/hooks.ts` y las páginas que los usan (todavía llaman a estas funciones con la firma vieja) — **son los que arreglan las Tasks 10-14**, no hace falta tocarlos acá. Confirmar que los errores están únicamente en esos archivos y no en `api.ts` mismo.

- [ ] **Step 8: Commit**

```bash
cd proyecto-oliver
git add src/lib/api.ts
git commit -m "feat: api.ts expone page/pageSize/filtros en las funciones de listado paginadas"
```

---

## Task 10: Empleados (frontend) — filtros server-side + paginado

**Repo:** `proyecto-oliver`

**Files:**
- Modify: `src/pages/empleados/hooks.ts`
- Modify: `src/pages/empleados/EmpleadosPage.tsx`

**Interfaces:**
- Consumes: `listEmpleados(params: ListEmpleadosParams): Promise<Paginated<Empleado>>` (Task 9), `Pagination` + `PaginationMeta` de `../../components/ui/pagination` (Task 8).

- [ ] **Step 1: Reescribir `useEmpleados` en `hooks.ts`**

Agregar el import de `keepPreviousData`:

```ts
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listEmpleados,
  createEmpleado,
  updateEmpleado,
  eliminarEmpleado,
  desvincularDispositivo,
  generarOtp,
  type CrearEmpleadoInput,
  type EditarEmpleadoInput,
  type ListEmpleadosParams,
} from "../../lib/api";
```

Reemplazar:

```ts
const QUERY_KEY = ["empleados"];

export function useEmpleados() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listEmpleados });
}
```

por:

```ts
const QUERY_KEY = "empleados";

export function useEmpleados(params: ListEmpleadosParams) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => listEmpleados(params),
    placeholderData: keepPreviousData,
  });
}
```

Las mutaciones (`useCrearEmpleado`, etc.) invalidan `queryKey: QUERY_KEY` — como `QUERY_KEY` pasó de array a string, TanStack Query igual invalida por prefijo (`[QUERY_KEY, params]` matchea contra `QUERY_KEY` como prefijo parcial). Reemplazar cada `queryKey: QUERY_KEY` de las mutaciones por `queryKey: [QUERY_KEY]` para que siga siendo un array (así lo espera `invalidateQueries`):

Buscar y reemplazar las 4 ocurrencias de `queryClient.invalidateQueries({ queryKey: QUERY_KEY })` por `queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })`.

- [ ] **Step 2: Wirear `EmpleadosPage.tsx` — estado de página y filtros server-side**

Reemplazar el import de hooks:

```ts
import {
  useEmpleados,
  useCrearEmpleado,
  useEditarEmpleado,
  useEliminarEmpleado,
  useDesvincularDispositivo,
  useGenerarOtp,
} from "./hooks";
```

sin cambios (misma lista), pero agregar el import del componente de paginado:

```ts
import { Pagination } from "../../components/ui/pagination";
```

Reemplazar el bloque de estado de filtros y el `useEmpleados()`:

```ts
export default function EmpleadosPage() {
  const { data: empleados = [], isLoading } = useEmpleados();
  const { data: org } = useOrgActual();
```

por:

```ts
export default function EmpleadosPage() {
  const { data: org } = useOrgActual();
```

Reemplazar:

```ts
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [dispositivoFiltro, setDispositivoFiltro] = useState<DispositivoFiltro>("todos");
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [cuilFiltro, setCuilFiltro] = useState<CuilFiltro>("todos");
```

por:

```ts
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [dispositivoFiltro, setDispositivoFiltro] = useState<DispositivoFiltro>("todos");
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [cuilFiltro, setCuilFiltro] = useState<CuilFiltro>("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useEmpleados({
    page,
    pageSize,
    q: busqueda || undefined,
    estado: estadoFiltro === "todos" ? undefined : estadoFiltro,
    sucursalId: sucursalFiltro || undefined,
    cuil: cuilFiltro === "todos" ? undefined : cuilFiltro,
    dispositivo: dispositivoFiltro === "todos" ? undefined : (dispositivoFiltro as "vinculado" | "no_vinculado"),
  });
  const empleados = data?.data ?? [];
```

Reemplazar la función `limpiarFiltros` para que también resetee la página:

```ts
  function limpiarFiltros() {
    setBusqueda("");
    setEstadoFiltro("todos");
    setDispositivoFiltro("todos");
    setSucursalFiltro("");
    setCuilFiltro("todos");
  }
```

por:

```ts
  function limpiarFiltros() {
    setBusqueda("");
    setEstadoFiltro("todos");
    setDispositivoFiltro("todos");
    setSucursalFiltro("");
    setCuilFiltro("todos");
    setPage(1);
  }
```

Borrar por completo el bloque de filtrado en memoria (ya no hace falta, el backend filtra):

```ts
  const empleadosFiltrados = empleados.filter((emp) => {
    const matchNombre = nombreCompleto(emp).toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado = estadoFiltro === "todos" || emp.estado === estadoFiltro;
    const matchDispositivo =
      dispositivoFiltro === "todos" ||
      (dispositivoFiltro === "vinculado"
        ? !!emp.device_token
        : dispositivoFiltro === "otp_pendiente"
          ? !emp.device_token && !!emp.otp
          : !emp.device_token && !emp.otp);
    const matchSucursal = sucursalFiltro === "" || emp.sucursal_id === sucursalFiltro;
    const matchCuil = cuilFiltro === "todos" || (cuilFiltro === "con" ? !!emp.cuil : !emp.cuil);
    return matchNombre && matchEstado && matchDispositivo && matchSucursal && matchCuil;
  });
```

En el JSX de la tabla, reemplazar todos los usos de `empleadosFiltrados` por `empleados` (ahora ya viene filtrado y paginado del backend): la línea `empleadosFiltrados.map((emp) => (` pasa a `empleados.map((emp) => (`, y las dos filas de "sin resultados" pasan a distinguir los casos usando `filtrosActivos` (ya que `empleadosFiltrados` deja de existir):

```ts
          {!isLoading && empleados.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-text/60">
                Todavía no hay empleados cargados.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && empleados.length > 0 && empleadosFiltrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-text/60">
                Ningún empleado coincide con el filtro.
              </TableCell>
            </TableRow>
          )}
```

por:

```ts
          {!isLoading && empleados.length === 0 && !filtrosActivos && (
            <TableRow>
              <TableCell colSpan={8} className="text-text/60">
                Todavía no hay empleados cargados.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && empleados.length === 0 && filtrosActivos && (
            <TableRow>
              <TableCell colSpan={8} className="text-text/60">
                Ningún empleado coincide con el filtro.
              </TableCell>
            </TableRow>
          )}
```

Después de la `</Table>` de cierre, agregar el componente de paginado:

```tsx
      </Table>

      {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
```

- [ ] **Step 2b: Resetear `page` a 1 cuando cambia cualquier filtro**

Cada `onChange` de los `FilterChip` y del campo "Buscar" tiene que resetear `page`. Reemplazar los 5 setters de filtro en el JSX:

```tsx
        <Field
          label="Buscar"
          placeholder="Nombre del empleado"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
```

por:

```tsx
        <Field
          label="Buscar"
          placeholder="Nombre del empleado"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
```

Y en cada `FilterChip` (Estado, Dispositivo, Sucursal, CUIL), envolver el `onChange` original para que también llame `setPage(1)`. Por ejemplo:

```tsx
        <FilterChip
          label="Estado"
          value={estadoFiltro}
          defaultValue="todos"
          onChange={(v) => setEstadoFiltro(v as EstadoFiltro)}
          options={[...]}
        />
```

pasa a:

```tsx
        <FilterChip
          label="Estado"
          value={estadoFiltro}
          defaultValue="todos"
          onChange={(v) => { setEstadoFiltro(v as EstadoFiltro); setPage(1); }}
          options={[...]}
        />
```

(mismo patrón para los otros tres `FilterChip` — Dispositivo, Sucursal, CUIL — envolviendo cada `onChange` existente.)

- [ ] **Step 3: Achicar las opciones del `FilterChip` de Dispositivo**

Reemplazar:

```tsx
type DispositivoFiltro = "todos" | "vinculado" | "otp_pendiente" | "sin_vincular";
```

por:

```tsx
type DispositivoFiltro = "todos" | "vinculado" | "no_vinculado";
```

Reemplazar las opciones del chip:

```tsx
        <FilterChip
          label="Dispositivo"
          value={dispositivoFiltro}
          defaultValue="todos"
          onChange={(v) => { setDispositivoFiltro(v as DispositivoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "vinculado", label: "Vinculado" },
            { value: "otp_pendiente", label: "OTP pendiente" },
            { value: "sin_vincular", label: "Sin vincular" },
          ]}
        />
```

por:

```tsx
        <FilterChip
          label="Dispositivo"
          value={dispositivoFiltro}
          defaultValue="todos"
          onChange={(v) => { setDispositivoFiltro(v as DispositivoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "vinculado", label: "Vinculado" },
            { value: "no_vinculado", label: "No vinculado" },
          ]}
        />
```

La columna "Dispositivo" de la tabla **no cambia** — sigue mostrando `Status "Vinculado"` / el código OTP pendiente / `Status "Sin vincular"` fila por fila, eso viene de `emp.device_token`/`emp.otp` como hoy, no del filtro.

- [ ] **Step 4: Typecheck**

Run: `cd proyecto-oliver && npx tsc -b --force`
Expected: sin errores en `pages/empleados/*` (pueden quedar errores en otros hooks/páginas todavía no migrados — Tasks 11-14 los resuelven).

- [ ] **Step 5: Verificación manual en el navegador**

Con `npm run dev` corriendo: abrir `/empleados`, confirmar que la tabla muestra como máximo el `pageSize` elegido, que cambiar de página trae otros registros, que combinar un filtro (ej. Estado=Activo) con paginado da un `total`/cantidad de páginas coherente, y que cambiar cualquier filtro vuelve a la página 1.

- [ ] **Step 6: Commit**

```bash
cd proyecto-oliver
git add src/pages/empleados/hooks.ts src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat: Empleados pagina server-side y mueve los filtros a la query"
```

---

## Task 11: Sucursales (frontend) — filtros server-side + paginado

**Repo:** `proyecto-oliver`

**Files:**
- Modify: `src/pages/sucursales/hooks.ts`
- Modify: `src/pages/sucursales/SucursalesPage.tsx`

**Interfaces:**
- Consumes: `listSucursales(params: ListSucursalesParams): Promise<Paginated<Sucursal>>` (Task 9), `Pagination` (Task 8).

- [ ] **Step 1: Reescribir `useSucursales` en `hooks.ts`**

Reemplazar:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSucursales,
  createSucursal,
  updateSucursal,
  deleteSucursal,
  type CrearSucursalInput,
  type EditarSucursalInput,
} from "../../lib/api";

export { useOrgActual } from "../../lib/hooks";

const QUERY_KEY = ["sucursales"];

export function useSucursales() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listSucursales });
}
```

por:

```ts
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listSucursales,
  createSucursal,
  updateSucursal,
  deleteSucursal,
  type CrearSucursalInput,
  type EditarSucursalInput,
  type ListSucursalesParams,
} from "../../lib/api";

export { useOrgActual } from "../../lib/hooks";

const QUERY_KEY = "sucursales";

export function useSucursales(params: ListSucursalesParams) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => listSucursales(params),
    placeholderData: keepPreviousData,
  });
}
```

Reemplazar las 3 ocurrencias de `queryClient.invalidateQueries({ queryKey: QUERY_KEY })` (en `useCrearSucursal`, `useEditarSucursal`, `useEliminarSucursal`) por `queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })`.

**Nota:** `EmpleadosPage.tsx` (Task 10) y otras páginas también importan `useSucursales` desde `../sucursales/hooks` para poblar selects de sucursal — ahora `useSucursales` exige `params`. Verificar con `grep -rn "useSucursales(" src/pages` y actualizar cada call-site que no sea `SucursalesPage.tsx` para pasarle un tamaño de página grande que cubra el uso típico, ya que ahí no se pagina, solo se listan sucursales para un `<select>`: `useSucursales({ page: 1, pageSize: 30 })`. Si algún caso necesitara más de 30 sucursales para el selector, es una limitación conocida — no está en alcance de este plan ampliarla (ver spec §4, Sucursales es de las listas chicas).

- [ ] **Step 2: Wirear `SucursalesPage.tsx`**

Reemplazar el import de hooks (agregar `Pagination`):

```ts
import { Pagination } from "../../components/ui/pagination";
```

Reemplazar:

```ts
export default function SucursalesPage() {
  const { data: sucursales = [], isLoading } = useSucursales();
  const { data: org } = useOrgActual();
```

por:

```ts
export default function SucursalesPage() {
  const { data: org } = useOrgActual();
```

Reemplazar el bloque de estado:

```ts
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
```

por:

```ts
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useSucursales({
    page,
    pageSize,
    q: busqueda || undefined,
    estado: estadoFiltro === "todos" ? undefined : estadoFiltro,
  });
  const sucursales = data?.data ?? [];
```

Reemplazar `limpiarFiltros`:

```ts
  function limpiarFiltros() {
    setBusqueda("");
    setEstadoFiltro("todos");
  }
```

por:

```ts
  function limpiarFiltros() {
    setBusqueda("");
    setEstadoFiltro("todos");
    setPage(1);
  }
```

Borrar el filtrado en memoria:

```ts
  const sucursalesFiltradas = sucursales.filter((s) => {
    const matchNombre = s.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado =
      estadoFiltro === "todos" || (estadoFiltro === "activos" ? s.activa : !s.activa);
    return matchNombre && matchEstado;
  });
```

En el JSX, reemplazar `sucursalesFiltradas.map((suc) => (` por `sucursales.map((suc) => (`. Reemplazar también las dos filas de "sin resultados":

```tsx
          {!isLoading && sucursales.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">
                Todavía no hay sucursales cargadas.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && sucursales.length > 0 && sucursalesFiltradas.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">
                Ninguna sucursal coincide con el filtro.
              </TableCell>
            </TableRow>
          )}
```

por:

```tsx
          {!isLoading && sucursales.length === 0 && !filtrosActivos && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">
                Todavía no hay sucursales cargadas.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && sucursales.length === 0 && filtrosActivos && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">
                Ninguna sucursal coincide con el filtro.
              </TableCell>
            </TableRow>
          )}
```

En el campo "Buscar" y en el `FilterChip` de Estado, envolver los `onChange` para que también reseteen `page` a 1. Reemplazar:

```tsx
        <Field
          label="Buscar"
          placeholder="Nombre de la sucursal"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
```

por:

```tsx
        <Field
          label="Buscar"
          placeholder="Nombre de la sucursal"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
```

Y reemplazar:

```tsx
        <FilterChip
          label="Estado"
          value={estadoFiltro}
          defaultValue="todos"
          onChange={(v) => setEstadoFiltro(v as EstadoFiltro)}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activos", label: "Activos" },
            { value: "inactivos", label: "Inactivos" },
          ]}
        />
```

por:

```tsx
        <FilterChip
          label="Estado"
          value={estadoFiltro}
          defaultValue="todos"
          onChange={(v) => { setEstadoFiltro(v as EstadoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activos", label: "Activos" },
            { value: "inactivos", label: "Inactivos" },
          ]}
        />
```

Después del cierre de `</Table>`, agregar:

```tsx
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
```

- [ ] **Step 3: Typecheck y verificación manual**

Run: `cd proyecto-oliver && npx tsc -b --force`
Expected: sin errores en `pages/sucursales/*` ni en los demás call-sites de `useSucursales` ya actualizados en este mismo Step 1.

Verificación manual: abrir `/sucursales`, cambiar de página y de tamaño de página, combinar con el filtro de Estado, y abrir el diálogo de "Nuevo empleado" en `/empleados` para confirmar que el `<Select>` de sucursal sigue poblado.

- [ ] **Step 4: Commit**

```bash
cd proyecto-oliver
git add src/pages/sucursales/hooks.ts src/pages/sucursales/SucursalesPage.tsx
git status  # confirmar si algún otro archivo quedó modificado por el Step 1 (call-sites de useSucursales)
git add -A
git commit -m "feat: Sucursales pagina server-side y mueve los filtros a la query"
```

---

## Task 12: Asistencia (frontend) — filtros server-side + paginado

**Repo:** `proyecto-oliver`

**Files:**
- Modify: `src/pages/asistencia/hooks.ts`
- Modify: `src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:**
- Consumes: `listAsistencia(desde, hasta, params: ListAsistenciaParams): Promise<Paginated<AsistenciaRegistro>>`, `listRechazadas(params): Promise<Paginated<Rechazada>>` (Task 9), `Pagination` (Task 8).

- [ ] **Step 1: Reescribir `hooks.ts`**

Reemplazar el archivo completo:

```ts
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listAsistencia,
  deleteAsistencia,
  listRechazadas,
  resolverRechazada,
  type ListAsistenciaParams,
} from "../../lib/api";

export function useAsistencia(desde: string, hasta: string, params: ListAsistenciaParams) {
  return useQuery({
    queryKey: ["asistencia", desde, hasta, params],
    queryFn: () => listAsistencia(desde, hasta, params),
    placeholderData: keepPreviousData,
  });
}

export function useRechazadas(params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: ["asistencia-rechazadas", params],
    queryFn: () => listRechazadas(params),
    placeholderData: keepPreviousData,
  });
}

export function useBorrarAsistencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAsistencia(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["asistencia"] }),
  });
}

export function useResolverRechazada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: "aprobar" | "descartar" }) => resolverRechazada(id, accion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asistencia-rechazadas"] });
      queryClient.invalidateQueries({ queryKey: ["asistencia"] });
    },
  });
}
```

- [ ] **Step 2: Wirear `AsistenciaPage.tsx`**

Agregar el import:

```ts
import { Pagination } from "../../components/ui/pagination";
```

Reemplazar el estado y las llamadas a los hooks:

```ts
export default function AsistenciaPage() {
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());

  const { data: registros = [], isLoading, isError } = useAsistencia(desde, hasta);
  const { data: rechazadas = [] } = useRechazadas();
```

por:

```ts
export default function AsistenciaPage() {
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [empleadoFiltro, setEmpleadoFiltro] = useState("todos");
  const [sucursalFiltro, setSucursalFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");

  const { data, isLoading, isError } = useAsistencia(desde, hasta, {
    page,
    pageSize,
    empleadoId: empleadoFiltro === "todos" ? undefined : empleadoFiltro,
    sucursalId: sucursalFiltro === "todos" ? undefined : sucursalFiltro,
    tipo: tipoFiltro === "todos" ? undefined : tipoFiltro,
  });
  const registros = data?.data ?? [];
  const { data: rechazadasData } = useRechazadas({ page: 1, pageSize: 30 });
  const rechazadas = rechazadasData?.data ?? [];
```

**Nota:** más abajo en el archivo ya existían `const [empleadoFiltro, setEmpleadoFiltro] = useState("todos");` y las otras dos — borrar esas declaraciones duplicadas (quedaron movidas arriba, junto a `page`/`pageSize`, para que el objeto de filtros de `useAsistencia` los tenga disponibles antes de usarlos).

Borrar el filtrado en memoria (ya no hace falta, el backend filtra):

```ts
  const registrosFiltrados = registros.filter((r) => {
    const matchEmpleado = empleadoFiltro === "todos" || r.empleado_id === empleadoFiltro;
    const matchSucursal = sucursalFiltro === "todos" || r.sucursal_id === sucursalFiltro;
    const matchTipo = tipoFiltro === "todos" || r.tipo === tipoFiltro;
    return matchEmpleado && matchSucursal && matchTipo;
  });
```

En el JSX de la tabla de registros, reemplazar `registrosFiltrados.map((r) => (` por `registros.map((r) => (`. Reemplazar también la fila de "sin resultados":

```tsx
            {!isLoading && registrosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  No hay registros en este rango.
                </TableCell>
```

por:

```tsx
            {!isLoading && registros.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  No hay registros en este rango.
                </TableCell>
```

(el resto de esa fila — cierre de `</TableRow>` y `)}` — no cambia.)

En los `Field` de Desde/Hasta y en los 3 `FilterChip` (Empleado, Sucursal, Tipo), envolver cada `onChange` para que también llamen `setPage(1)`. Reemplazar:

```tsx
          <Field
            label="Desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            containerClassName="w-40"
          />
          <Field
            label="Hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            containerClassName="w-40"
          />
```

por:

```tsx
          <Field
            label="Desde"
            type="date"
            value={desde}
            onChange={(e) => { setDesde(e.target.value); setPage(1); }}
            containerClassName="w-40"
          />
          <Field
            label="Hasta"
            type="date"
            value={hasta}
            onChange={(e) => { setHasta(e.target.value); setPage(1); }}
            containerClassName="w-40"
          />
```

Y reemplazar los tres `FilterChip`:

```tsx
          <FilterChip
            label="Empleado"
            value={empleadoFiltro}
            defaultValue="todos"
            onChange={setEmpleadoFiltro}
            options={[
              { value: "todos", label: "Todos" },
              ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre })),
            ]}
          />
          <FilterChip
            label="Sucursal"
            value={sucursalFiltro}
            defaultValue="todos"
            onChange={setSucursalFiltro}
            options={[
              { value: "todos", label: "Todos" },
              ...sucursales.map((suc) => ({ value: suc.id, label: suc.nombre })),
            ]}
          />
          <FilterChip
            label="Tipo"
            value={tipoFiltro}
            defaultValue="todos"
            onChange={(v) => setTipoFiltro(v as TipoFiltro)}
            options={[
              { value: "todos", label: "Todos" },
              { value: "entrada", label: "Entrada" },
              { value: "salida", label: "Salida" },
            ]}
          />
```

por:

```tsx
          <FilterChip
            label="Empleado"
            value={empleadoFiltro}
            defaultValue="todos"
            onChange={(v) => { setEmpleadoFiltro(v); setPage(1); }}
            options={[
              { value: "todos", label: "Todos" },
              ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre })),
            ]}
          />
          <FilterChip
            label="Sucursal"
            value={sucursalFiltro}
            defaultValue="todos"
            onChange={(v) => { setSucursalFiltro(v); setPage(1); }}
            options={[
              { value: "todos", label: "Todos" },
              ...sucursales.map((suc) => ({ value: suc.id, label: suc.nombre })),
            ]}
          />
          <FilterChip
            label="Tipo"
            value={tipoFiltro}
            defaultValue="todos"
            onChange={(v) => { setTipoFiltro(v as TipoFiltro); setPage(1); }}
            options={[
              { value: "todos", label: "Todos" },
              { value: "entrada", label: "Entrada" },
              { value: "salida", label: "Salida" },
            ]}
          />
```

Después del cierre de la `<Table containerClassName="mt-4">` de registros (no la de rechazadas), agregar:

```tsx
        {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
```

- [ ] **Step 3: Typecheck**

Run: `cd proyecto-oliver && npx tsc -b --force`
Expected: sin errores en `pages/asistencia/*`

- [ ] **Step 4: Verificación manual**

Abrir `/asistencia`, cambiar de página, combinar filtros de Empleado/Sucursal/Tipo con paginado, confirmar que "Descargar Excel" sigue funcionando (usa el endpoint de export, no tocado).

- [ ] **Step 5: Commit**

```bash
cd proyecto-oliver
git add src/pages/asistencia/hooks.ts src/pages/asistencia/AsistenciaPage.tsx
git commit -m "feat: Asistencia pagina server-side y mueve Empleado/Sucursal/Tipo a la query"
```

---

## Task 13: RRHH/Ausencias (frontend) — paginado (filtros ya eran server-side)

**Repo:** `proyecto-oliver`

**Files:**
- Modify: `src/pages/rrhh/hooks.ts`
- Modify: `src/pages/rrhh/RrhhPage.tsx`

**Interfaces:**
- Consumes: `getAusencias(filters): Promise<AusenciasResponse>` con `pagination` (Task 9), `Pagination` (Task 8).

- [ ] **Step 1: Actualizar `useAusencias` en `hooks.ts`**

Reemplazar:

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
```

por:

```ts
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: ["ausencias", filters],
    queryFn: () => getAusencias(filters),
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 2: Wirear `RrhhPage.tsx`**

Agregar el import:

```ts
import { Pagination } from "../../components/ui/pagination";
```

Agregar estado de página junto al resto del estado de filtros:

```ts
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [motivoFiltro, setMotivoFiltro] = useState("");
```

pasa a:

```ts
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [motivoFiltro, setMotivoFiltro] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
```

Actualizar la llamada a `useAusencias` para incluir `page`/`pageSize`:

```ts
  const { data, isLoading } = useAusencias({
    desde,
    hasta,
    sucursalId: sucursalFiltro || undefined,
    motivo: motivoFiltro || undefined,
  });
```

pasa a:

```ts
  const { data, isLoading } = useAusencias({
    desde,
    hasta,
    sucursalId: sucursalFiltro || undefined,
    motivo: motivoFiltro || undefined,
    page,
    pageSize,
  });
```

(Verificar el nombre exacto de esas variables con `grep -n "useAusencias(" src/pages/rrhh/RrhhPage.tsx` — si el destructuring actual usa otro nombre que no sea `data`, ajustar en consecuencia; lo que importa es agregar `page`/`pageSize` al objeto de filtros.)

En el `FilterChip` de Sucursal y de Motivo, y en los `Field` de Período/Desde/Hasta, envolver cada `onChange`/`onChange` de handler para llamar también `setPage(1)`.

Después del cierre de la `<Table>` que lista ausencias, agregar:

```tsx
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
```

- [ ] **Step 3: Typecheck y verificación manual**

Run: `cd proyecto-oliver && npx tsc -b --force`
Expected: sin errores en `pages/rrhh/*`

Verificación manual: abrir `/rrhh`, confirmar que el resumen (totales por sucursal/motivo) sigue reflejando el dataset filtrado completo aunque la tabla muestre una sola página, y que "Descargar Excel" sigue trayendo todo.

- [ ] **Step 4: Commit**

```bash
cd proyecto-oliver
git add src/pages/rrhh/hooks.ts src/pages/rrhh/RrhhPage.tsx
git commit -m "feat: RRHH/Ausencias pagina server-side"
```

---

## Task 14: Admin (frontend) — Organizaciones + tabs de detalle

**Repo:** `proyecto-oliver`

**Files:**
- Modify: `src/pages/admin/hooks.ts`
- Modify: `src/pages/admin/AdminPage.tsx`
- Modify: `src/pages/admin/OrganizacionDetallePage.tsx`

**Interfaces:**
- Consumes: `listOrganizationsAdmin(params)`, `listMiembrosAdmin(orgId, params)`, `listEmpleadosAdmin(orgId, params)`, `listSucursalesAdmin(orgId, params)` (Task 9), `Pagination` (Task 8).

- [ ] **Step 1: Actualizar `src/pages/admin/hooks.ts`**

Reemplazar:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOrganizationsAdmin,
  createOrganizationAdmin,
  updateOrganizationAdmin,
  getOrgResumenAdmin,
  getSuscripcionesAdmin,
  createSuscripcionAdmin,
  cancelSuscripcionAdmin,
  listMiembrosAdmin,
  listEmpleadosAdmin,
  listSucursalesAdmin,
  type CrearOrganizacionInput,
  type CrearSuscripcionAdminInput,
} from "../../lib/api";

const ORGS_KEY = ["admin-organizations"];

export function useOrganizacionesAdmin() {
  return useQuery({ queryKey: ORGS_KEY, queryFn: listOrganizationsAdmin });
}
```

por:

```ts
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listOrganizationsAdmin,
  createOrganizationAdmin,
  updateOrganizationAdmin,
  getOrgResumenAdmin,
  getSuscripcionesAdmin,
  createSuscripcionAdmin,
  cancelSuscripcionAdmin,
  listMiembrosAdmin,
  listEmpleadosAdmin,
  listSucursalesAdmin,
  type CrearOrganizacionInput,
  type CrearSuscripcionAdminInput,
} from "../../lib/api";

const ORGS_KEY = "admin-organizations";

export function useOrganizacionesAdmin(params: { page: number; pageSize: number; q?: string }) {
  return useQuery({
    queryKey: [ORGS_KEY, params],
    queryFn: () => listOrganizationsAdmin(params),
    placeholderData: keepPreviousData,
  });
}
```

Reemplazar las 2 ocurrencias de `queryClient.invalidateQueries({ queryKey: ORGS_KEY })` (en `useCrearOrganizacionAdmin` y `useEditarOrganizacionAdmin`) por `queryClient.invalidateQueries({ queryKey: [ORGS_KEY] })`.

Reemplazar:

```ts
export function useMiembrosAdminOrg(orgId: string) {
  return useQuery({ queryKey: ["admin-org-miembros", orgId], queryFn: () => listMiembrosAdmin(orgId) });
}

export function useEmpleadosAdminOrg(orgId: string) {
  return useQuery({ queryKey: ["admin-org-empleados", orgId], queryFn: () => listEmpleadosAdmin(orgId) });
}

export function useSucursalesAdminOrg(orgId: string) {
  return useQuery({ queryKey: ["admin-org-sucursales", orgId], queryFn: () => listSucursalesAdmin(orgId) });
}
```

por:

```ts
export function useMiembrosAdminOrg(orgId: string, params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: ["admin-org-miembros", orgId, params],
    queryFn: () => listMiembrosAdmin(orgId, params),
    placeholderData: keepPreviousData,
  });
}

export function useEmpleadosAdminOrg(orgId: string, params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: ["admin-org-empleados", orgId, params],
    queryFn: () => listEmpleadosAdmin(orgId, params),
    placeholderData: keepPreviousData,
  });
}

export function useSucursalesAdminOrg(orgId: string, params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: ["admin-org-sucursales", orgId, params],
    queryFn: () => listSucursalesAdmin(orgId, params),
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 2: Wirear `AdminPage.tsx`**

Agregar los imports:

```ts
import { Search } from "lucide-react";
import { Field } from "../../components/ui/field";
import { Pagination } from "../../components/ui/pagination";
```

(`Search` puede que ya no esté importado en este archivo — verificar con `grep -n "^import" src/pages/admin/AdminPage.tsx` antes de duplicar el import de `lucide-react`, y agregarlo al import existente en vez de crear uno nuevo si `lucide-react` ya se importa ahí.)

Reemplazar:

```ts
export default function AdminPage() {
  const { data: organizaciones = [], isLoading, isError, error } = useOrganizacionesAdmin();
```

por:

```ts
export default function AdminPage() {
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading, isError, error } = useOrganizacionesAdmin({ page, pageSize, q: busqueda || undefined });
  const organizaciones = data?.data ?? [];
```

Agregar un campo de búsqueda arriba de la tabla (después del `<div className="mt-4 flex justify-end">` del botón "Nueva organización", o como una fila propia antes de la `<Table>`):

```tsx
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Buscar"
          placeholder="Nombre o slug"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
      </div>
```

(insertar este bloque inmediatamente antes del `<Table containerClassName="mt-4">` existente; el botón "Nueva organización" que hoy vive en `<div className="mt-4 flex justify-end">` se deja donde está, arriba de este nuevo campo de búsqueda.)

Después del cierre de `</Table>`, agregar:

```tsx
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
```

- [ ] **Step 3: Wirear `OrganizacionDetallePage.tsx` — las 3 pestañas paginadas**

Cada una de `MiembrosTab`, `EmpleadosTab`, `SucursalesTab` gana su propio estado de página (son componentes separados, cada uno con su ciclo de vida independiente al cambiar de tab). Reemplazar `MiembrosTab`:

```tsx
function MiembrosTab({ orgId }: { orgId: string }) {
  const { data: miembros = [], isLoading } = useMiembrosAdminOrg(orgId);

  return (
    <Table containerClassName="mt-4">
```

por:

```tsx
function MiembrosTab({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading } = useMiembrosAdminOrg(orgId, { page, pageSize });
  const miembros = data?.data ?? [];

  return (
    <>
    <Table containerClassName="mt-4">
```

Y al final de la función, después del cierre de `</Table>`, agregar el paginado y cerrar el fragment:

```tsx
    </Table>
    {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
    </>
  );
}
```

(Localizar el `return (\n    <Table ...` y el `</Table>\n  );\n}` de cierre de `MiembrosTab` con `grep -n "function MiembrosTab" -A 40 src/pages/admin/OrganizacionDetallePage.tsx` para ubicar los límites exactos antes de envolver en el fragment.)

Aplicar exactamente el mismo cambio a `EmpleadosTab` (usa `useEmpleadosAdminOrg(orgId, { page, pageSize })`) y a `SucursalesTab` (usa `useSucursalesAdminOrg(orgId, { page, pageSize })`) — mismo patrón: `useState` de page/pageSize propio, `const { data, isLoading } = useXAdminOrg(orgId, { page, pageSize })`, `const xs = data?.data ?? []`, envolver el `<Table>` en un fragment y agregar `<Pagination>` después.

Agregar el import al tope del archivo:

```ts
import { Pagination } from "../../components/ui/pagination";
```

- [ ] **Step 4: Typecheck**

Run: `cd proyecto-oliver && npx tsc -b --force`
Expected: sin errores en todo el repo — esta es la última tarea, así que el build tiene que quedar completamente limpio.

- [ ] **Step 5: Verificación manual**

Abrir `/admin`, buscar por nombre/slug, paginar. Entrar al detalle de una organización, confirmar que las pestañas Miembros/Empleados/Sucursales paginan de forma independiente (cambiar de página en una no afecta a las otras) y que cambiar de tab y volver no pierde el estado raro (cada tab arranca en página 1 al montar, es lo esperado ya que son componentes separados).

- [ ] **Step 6: Commit**

```bash
cd proyecto-oliver
git add src/pages/admin/hooks.ts src/pages/admin/AdminPage.tsx src/pages/admin/OrganizacionDetallePage.tsx
git commit -m "feat: Admin pagina Organizaciones y los tabs de detalle (Miembros/Empleados/Sucursales)"
```

---

## Verificación final

Después de la Task 14:

```bash
cd proyecto-oliver-api && npm test && npx tsc --noEmit
cd ../proyecto-oliver && npx tsc -b --force && npx oxlint src
```

Ambos deberían pasar limpio. Repasar el criterio de "listo" del spec (§4): tablas mostrando 10/20/30 según lo elegido, filtros combinados con paginado dando totales correctos, y una organización con más de 500 marcaciones de asistencia (o 200 rechazadas) ya no pierde filas ni en pantalla ni en el Excel exportado.
