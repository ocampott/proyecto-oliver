# Módulo Empleados — Paso 1 (identidad y estado) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el booleano `activo` de `empleados` por un modelo de identidad real (CUIL validado, apellido separado del nombre, fecha de ingreso, sucursal de base, estados) en los dos repos (`proyecto-oliver-api` y `proyecto-oliver`).

**Architecture:** Todo aditivo sobre la tabla `empleados` existente (sin tablas nuevas — eso es Paso 2). Lógica de validación pura y testeable (`cuil.ts`, `celular.ts`) separada de las funciones que tocan Supabase, siguiendo el patrón ya establecido en `proyecto-oliver-api/CLAUDE.md`. Los RPCs atómicos de límite de plan (`crear_empleado_con_limite`, `reactivar_empleado_con_limite`) se generalizan de `activo boolean` a `estado text`.

**Tech Stack:** Express + Supabase (Postgres) + zod + vitest en el backend; React + TanStack Query en el frontend.

**Spec:** `docs/superpowers/specs/2026-08-25-modulo-empleados-paso1-design.md`

## Global Constraints

- `estado` es `text + check`, nunca un enum de Postgres — valores: `'activo' | 'de_licencia' | 'suspendido' | 'baja'`.
- `activo` se **reemplaza** por `estado`, no coexisten en el código de la app (sí coexisten un tiempo a nivel de columna DB, ver Tarea 1 y Tarea 8).
- Solo `activo` y `de_licencia` pueden marcar entrada/salida (`/marcar/*`). `suspendido` y `baja` no.
- `countEmpleadosActivos` (tope del plan) cuenta `estado != 'baja'` — de licencia y suspendido siguen ocupando un lugar.
- CUIL: nullable, único por `(org_id, cuil)` entre no-nulos, validado con dígito verificador módulo 11 cuando se carga.
- `apellido` es obligatorio en alta nueva (no en edición de empleados ya migrados). `cuil`, `fecha_ingreso`, `sucursal_id` son opcionales.
- Celular se normaliza a `+54 9 <10 dígitos>` al guardar; si no normaliza, se rechaza con 400.
- Migraciones de schema hard-to-reverse van en dos pasos (agregar+backfill, verificar, recién después dropear) — nunca un solo paso destructivo.

---

### Task 1: Migración de base de datos y RPCs de límite de plan

**Files:**
- Create: `proyecto-oliver-api/supabase/migrations/0011_empleados_identidad.sql`

**Interfaces:**
- Produces: columnas `empleados.apellido`, `empleados.cuil`, `empleados.fecha_ingreso`, `empleados.sucursal_id`, `empleados.estado`; RPCs `crear_empleado_con_limite(p_org_id, p_nombre, p_celular, p_max, p_apellido, p_cuil, p_fecha_ingreso, p_sucursal_id)` y `reactivar_empleado_con_limite(p_org_id, p_id, p_max, p_nuevo_estado)`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Paso 1 del módulo de empleados
-- (docs/superpowers/specs/2026-08-25-modulo-empleados-paso1-design.md):
-- identidad (apellido, CUIL), sucursal de base, fecha de ingreso, y
-- estados en vez del booleano activo.

alter table empleados
  add column apellido text,
  add column cuil text,
  add column fecha_ingreso date,
  add column sucursal_id uuid references sucursales (id) on delete set null,
  add column estado text not null default 'activo'
    check (estado in ('activo', 'de_licencia', 'suspendido', 'baja'));

-- Único por org entre los valores cargados — permite CUIL nulo mientras
-- se completa la nómina existente. Se chequea contra TODOS los estados
-- (incluso 'baja') para detectar reingresos con el mismo CUIL.
create unique index empleados_cuil_key on empleados (org_id, cuil) where cuil is not null;

-- Backfill: activo=true → 'activo', activo=false → 'baja' (el mapeo más
-- cercano al significado que tenía activo=false hasta ahora). La columna
-- activo NO se dropea acá — ver 0012, se aplica después de verificar.
update empleados set estado = case when activo then 'activo' else 'baja' end;

-- RPCs de 0008_limites_atomic.sql: pasan de "activo boolean" a "estado".
-- "estado != 'baja'" es lo que ahora cuenta contra el tope del plan — de
-- licencia y suspendido siguen ocupando un lugar (siguen siendo personal).
create or replace function crear_empleado_con_limite(
  p_org_id uuid,
  p_nombre text,
  p_celular text,
  p_max int,
  p_apellido text default null,
  p_cuil text default null,
  p_fecha_ingreso date default null,
  p_sucursal_id uuid default null
)
returns empleados
language plpgsql
as $$
declare
  v_count int;
  v_row empleados;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  if p_max is not null then
    select count(*) into v_count from empleados where org_id = p_org_id and estado != 'baja';
    if v_count >= p_max then
      raise exception 'limite_plan';
    end if;
  end if;

  insert into empleados (org_id, nombre, celular, apellido, cuil, fecha_ingreso, sucursal_id)
  values (p_org_id, p_nombre, p_celular, p_apellido, p_cuil, p_fecha_ingreso, p_sucursal_id)
  returning * into v_row;

  return v_row;
end;
$$;

-- Generalizada de "reactivar" a "cambiar de estado con chequeo de tope":
-- el chequeo de límite solo corre si el empleado estaba en 'baja' (no
-- contaba) y pasa a un estado que sí cuenta. Entre activo/de_licencia/
-- suspendido, o hacia baja, es un update directo sin chequeo — ya estaba
-- contado, o se está liberando un lugar.
create or replace function reactivar_empleado_con_limite(
  p_org_id uuid,
  p_id uuid,
  p_max int,
  p_nuevo_estado text default 'activo'
)
returns empleados
language plpgsql
as $$
declare
  v_count int;
  v_row empleados;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  select * into v_row from empleados where org_id = p_org_id and id = p_id;
  if not found then
    raise exception 'empleado_no_encontrado';
  end if;

  if v_row.estado = 'baja' and p_nuevo_estado != 'baja' and p_max is not null then
    select count(*) into v_count from empleados where org_id = p_org_id and estado != 'baja';
    if v_count >= p_max then
      raise exception 'limite_plan';
    end if;
  end if;

  update empleados set estado = p_nuevo_estado where id = p_id returning * into v_row;
  return v_row;
end;
$$;
```

- [ ] **Step 2: Aplicar la migración**

Run: `cd proyecto-oliver-api && supabase db push`

- [ ] **Step 3: Verificar el backfill**

Run:
```bash
supabase db execute --sql "select estado, count(*) from empleados group by estado;"
```
Expected: la suma de `activo` y `de_licencia`/`suspendido`/`baja` que reporte coincide con lo que antes era `activo=true`/`activo=false` (en este punto todo lo que no era `true` cayó en `baja`, es esperable que no haya filas en `de_licencia`/`suspendido` todavía).

- [ ] **Step 4: Commit**

```bash
cd proyecto-oliver-api
git add supabase/migrations/0011_empleados_identidad.sql
git commit -m "feat(db): agrega identidad y estados a empleados (Paso 1 módulo empleados)"
```

---

### Task 2: `src/lib/cuil.ts` — validación de CUIL

**Files:**
- Create: `proyecto-oliver-api/src/lib/cuil.ts`
- Test: `proyecto-oliver-api/src/lib/cuil.test.ts`

**Interfaces:**
- Produces: `validarCuil(cuil: string): boolean`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import { validarCuil } from "./cuil.js";

describe("validarCuil", () => {
  it("acepta un CUIL con dígito verificador correcto", () => {
    expect(validarCuil("20123456786")).toBe(true);
  });

  it("acepta el mismo CUIL con guiones", () => {
    expect(validarCuil("20-12345678-6")).toBe(true);
  });

  it("rechaza un CUIL con el dígito verificador incorrecto", () => {
    expect(validarCuil("20123456780")).toBe(false);
  });

  it("rechaza algo que no tiene 11 dígitos", () => {
    expect(validarCuil("2012345678")).toBe(false);
  });

  it("rechaza texto sin dígitos", () => {
    expect(validarCuil("no-es-un-cuil")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd proyecto-oliver-api && npx vitest run src/lib/cuil.test.ts`
Expected: FAIL — `Cannot find module './cuil.js'`

- [ ] **Step 3: Implementar**

```ts
// Validación de CUIL con dígito verificador módulo 11 — sin DB, sin env.

const MULTIPLICADORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function validarCuil(cuil: string): boolean {
  const digitos = cuil.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digitos)) return false;

  const nums = digitos.split("").map(Number);
  const suma = MULTIPLICADORES.reduce((acc, mult, i) => acc + mult * nums[i], 0);
  const resto = suma % 11;
  let verificador = 11 - resto;
  if (verificador === 11) verificador = 0;
  if (verificador === 10) return false; // CUIL matemáticamente inválido

  return verificador === nums[10];
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/lib/cuil.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cuil.ts src/lib/cuil.test.ts
git commit -m "feat: agrega validarCuil (dígito verificador módulo 11)"
```

---

### Task 3: `src/lib/celular.ts` — normalización de celular

**Files:**
- Create: `proyecto-oliver-api/src/lib/celular.ts`
- Test: `proyecto-oliver-api/src/lib/celular.test.ts`

**Interfaces:**
- Produces: `normalizarCelular(input: string): string | null`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import { normalizarCelular } from "./celular.js";

describe("normalizarCelular", () => {
  it("normaliza un número sin prefijos", () => {
    expect(normalizarCelular("3411234567")).toBe("+54 9 3411234567");
  });

  it("saca el 0 de larga distancia", () => {
    expect(normalizarCelular("03411234567")).toBe("+54 9 3411234567");
  });

  it("normaliza un número con código de país sin el 9 de celular", () => {
    expect(normalizarCelular("+543411234567")).toBe("+54 9 3411234567");
  });

  it("normaliza un número ya completo con +54 9", () => {
    expect(normalizarCelular("+5493411234567")).toBe("+54 9 3411234567");
  });

  it("ignora espacios y guiones", () => {
    expect(normalizarCelular("341-123-4567")).toBe("+54 9 3411234567");
  });

  it("devuelve null si no reconoce el formato", () => {
    expect(normalizarCelular("12345")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/lib/celular.test.ts`
Expected: FAIL — `Cannot find module './celular.js'`

- [ ] **Step 3: Implementar**

```ts
// Normalización de celulares argentinos a +54 9 <10 dígitos> — sin DB,
// sin env. No intenta separar código de área de número local (variable
// entre 2 y 4 dígitos según la zona) — alcanza con un formato consistente
// para poder mandar WhatsApp más adelante.

export function normalizarCelular(input: string): string | null {
  let digitos = input.replace(/\D/g, "");

  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.startsWith("54")) digitos = digitos.slice(2);
  if (digitos.startsWith("9")) digitos = digitos.slice(1);

  if (!/^\d{10}$/.test(digitos)) return null;

  return `+54 9 ${digitos}`;
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/lib/celular.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/celular.ts src/lib/celular.test.ts
git commit -m "feat: agrega normalizarCelular"
```

---

### Task 4: `src/routes/empleados.schemas.ts` — validación zod

**Files:**
- Create: `proyecto-oliver-api/src/routes/empleados.schemas.ts`
- Test: `proyecto-oliver-api/src/routes/empleados.schemas.test.ts`

**Interfaces:**
- Consumes: `validarCuil` (Tarea 2), `normalizarCelular` (Tarea 3)
- Produces: `crearEmpleadoSchema`, `editarEmpleadoSchema` (zod)

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import { crearEmpleadoSchema, editarEmpleadoSchema } from "./empleados.schemas.js";

describe("crearEmpleadoSchema", () => {
  const base = { nombre: "Juan", apellido: "Pérez" };

  it("acepta el mínimo requerido", () => {
    expect(crearEmpleadoSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza si falta apellido", () => {
    expect(crearEmpleadoSchema.safeParse({ nombre: "Juan" }).success).toBe(false);
  });

  it("acepta y normaliza un CUIL válido con guiones", () => {
    const r = crearEmpleadoSchema.safeParse({ ...base, cuil: "20-12345678-6" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cuil).toBe("20123456786");
  });

  it("rechaza un CUIL con dígito verificador incorrecto", () => {
    expect(crearEmpleadoSchema.safeParse({ ...base, cuil: "20123456780" }).success).toBe(false);
  });

  it("acepta y normaliza un celular", () => {
    const r = crearEmpleadoSchema.safeParse({ ...base, celular: "03411234567" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.celular).toBe("+54 9 3411234567");
  });

  it("rechaza un celular no reconocible", () => {
    expect(crearEmpleadoSchema.safeParse({ ...base, celular: "12345" }).success).toBe(false);
  });
});

describe("editarEmpleadoSchema", () => {
  it("acepta un patch parcial sin apellido (empleados ya migrados pueden no tenerlo todavía)", () => {
    expect(editarEmpleadoSchema.safeParse({ estado: "de_licencia" }).success).toBe(true);
  });

  it("rechaza un estado que no existe", () => {
    expect(editarEmpleadoSchema.safeParse({ estado: "jubilado" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/routes/empleados.schemas.test.ts`
Expected: FAIL — `Cannot find module './empleados.schemas.js'`

- [ ] **Step 3: Implementar**

```ts
import { z } from "zod";
import { validarCuil } from "../lib/cuil.js";
import { normalizarCelular } from "../lib/celular.js";

// Acepta "20-12345678-6" o "20123456786".
const cuilSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[.\-\s]/g, ""))
  .refine((v) => /^\d{11}$/.test(v), "El CUIL tiene que tener 11 dígitos")
  .refine(validarCuil, "CUIL inválido (el dígito verificador no coincide)");

const celularSchema = z
  .string()
  .trim()
  .min(1)
  .transform((v, ctx) => {
    const normalizado = normalizarCelular(v);
    if (normalizado === null) {
      ctx.addIssue({ code: "custom", message: "No reconocemos ese celular como un número argentino válido" });
      return z.NEVER;
    }
    return normalizado;
  });

export const crearEmpleadoSchema = z.object({
  nombre: z.string().trim().min(1),
  apellido: z.string().trim().min(1),
  celular: celularSchema.optional(),
  cuil: cuilSchema.optional(),
  fecha_ingreso: z.string().date().optional(),
  sucursal_id: z.string().trim().min(1).optional(),
});

export const editarEmpleadoSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  apellido: z.string().trim().min(1).optional(),
  celular: celularSchema.nullable().optional(),
  cuil: cuilSchema.nullable().optional(),
  fecha_ingreso: z.string().date().nullable().optional(),
  sucursal_id: z.string().trim().min(1).nullable().optional(),
  estado: z.enum(["activo", "de_licencia", "suspendido", "baja"]).optional(),
});
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/routes/empleados.schemas.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/empleados.schemas.ts src/routes/empleados.schemas.test.ts
git commit -m "feat: agrega schemas zod de empleados (crear/editar)"
```

---

### Task 5: `src/lib/empleados.ts` — nuevos campos y estado

**Files:**
- Modify: `proyecto-oliver-api/src/lib/empleados.ts`

**Interfaces:**
- Consumes: RPCs de la Tarea 1
- Produces: `Empleado` (con `apellido`, `cuil`, `fecha_ingreso`, `sucursal_id`, `estado`; sin `activo`), `createEmpleadoConLimite`, `updateEmpleado`, `reactivarEmpleadoConLimite`, `countEmpleadosActivos`, `buscarEnNomina`, `getEmpleadoByToken`, `getEmpleadoByDeviceToken` actualizados

No hay test automatizado nuevo en esta tarea — son funciones DB-bound (mismo criterio que el resto de `lib/empleados.ts`, ya sin cobertura hoy). Se verifica manualmente en la Tarea 6.

- [ ] **Step 1: Actualizar el tipo `Empleado` y `listEmpleados`**

En `src/lib/empleados.ts`, reemplazar:

```ts
export interface Empleado {
  id: string;
  org_id: string;
  nombre: string;
  celular: string | null;
  device_token: string | null;
  activo: boolean;
  created_at: string;
}
```

por:

```ts
export type EstadoEmpleado = "activo" | "de_licencia" | "suspendido" | "baja";

export interface Empleado {
  id: string;
  org_id: string;
  nombre: string;
  apellido: string | null;
  celular: string | null;
  cuil: string | null;
  fecha_ingreso: string | null;
  sucursal_id: string | null;
  device_token: string | null;
  estado: EstadoEmpleado;
  created_at: string;
}
```

`listEmpleados` no cambia de cuerpo (usa `select("*")`), solo hereda el tipo nuevo.

- [ ] **Step 2: Actualizar `createEmpleado` y `createEmpleadoConLimite`**

Reemplazar ambas funciones:

```ts
export async function createEmpleado(
  orgId: string,
  input: {
    nombre: string;
    apellido?: string;
    celular?: string;
    cuil?: string;
    fecha_ingreso?: string;
    sucursal_id?: string;
  }
): Promise<Empleado> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .insert({
      org_id: orgId,
      nombre: input.nombre,
      apellido: input.apellido ?? null,
      celular: input.celular ?? null,
      cuil: input.cuil ?? null,
      fecha_ingreso: input.fecha_ingreso ?? null,
      sucursal_id: input.sucursal_id ?? null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("cuil_duplicado");
    throw error;
  }
  return data;
}

export async function createEmpleadoConLimite(
  orgId: string,
  input: {
    nombre: string;
    apellido?: string;
    celular?: string;
    cuil?: string;
    fecha_ingreso?: string;
    sucursal_id?: string;
  },
  max: number | null
): Promise<Empleado> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("crear_empleado_con_limite", {
    p_org_id: orgId,
    p_nombre: input.nombre,
    p_celular: input.celular ?? null,
    p_apellido: input.apellido ?? null,
    p_cuil: input.cuil ?? null,
    p_fecha_ingreso: input.fecha_ingreso ?? null,
    p_sucursal_id: input.sucursal_id ?? null,
    p_max: max,
  });
  if (error) {
    if (error.code === "23505") throw new Error("cuil_duplicado");
    throw error;
  }
  return data as Empleado;
}
```

- [ ] **Step 3: Reemplazar `reactivarEmpleadoConLimite` (generalizada a cualquier estado)**

```ts
export async function reactivarEmpleadoConLimite(
  orgId: string,
  id: string,
  nuevoEstado: EstadoEmpleado,
  max: number | null
): Promise<Empleado> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("reactivar_empleado_con_limite", {
    p_org_id: orgId,
    p_id: id,
    p_max: max,
    p_nuevo_estado: nuevoEstado,
  });
  if (error) throw error;
  return data as Empleado;
}
```

- [ ] **Step 4: Actualizar `updateEmpleado`**

```ts
export async function updateEmpleado(
  orgId: string,
  id: string,
  patch: {
    nombre?: string;
    apellido?: string | null;
    celular?: string | null;
    cuil?: string | null;
    fecha_ingreso?: string | null;
    sucursal_id?: string | null;
  }
): Promise<Empleado> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("empleados")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("cuil_duplicado");
    throw error;
  }
  return data;
}
```

- [ ] **Step 5: Reemplazar `countEmpleadosActivos` y borrar `setEmpleadoActivo`**

```ts
export async function countEmpleadosActivos(orgId: string): Promise<number> {
  const service = createServiceClient();
  const { count, error } = await service
    .from("empleados")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .neq("estado", "baja");
  if (error) throw error;
  return count ?? 0;
}
```

`setEmpleadoActivo` se borra entero — todas las transiciones de estado pasan ahora por `reactivarEmpleadoConLimite` (Step 3), que ya contempla el caso "no cruza el límite" con un update directo.

- [ ] **Step 6: Actualizar `getEmpleadoByToken` y `getEmpleadoByDeviceToken`**

Cambiar en las dos funciones `.eq("activo", true)` por `.in("estado", ["activo", "de_licencia"])`.

- [ ] **Step 7: Actualizar `buscarEnNomina`**

Reemplazar el cuerpo completo (el nombre completo para matchear ahora es `apellido + nombre`, y el filtro de estado cambia igual que en el Step 6):

```ts
export async function buscarEnNomina(
  orgId: string,
  input: string
): Promise<ResultadoNomina | null> {
  const service = createServiceClient();
  const { data: activos, error } = await service
    .from("empleados")
    .select("*")
    .eq("org_id", orgId)
    .in("estado", ["activo", "de_licencia"]);
  if (error) throw error;

  const nombreCompleto = (e: Empleado) => `${e.apellido ?? ""} ${e.nombre}`.trim();
  const nombres = activos.map(nombreCompleto);

  const exacto = validarEmpleado(nombres, input);
  if (exacto) {
    return { empleado: activos.find((e) => nombreCompleto(e) === exacto)!, exacto: true };
  }

  const parecido = buscarEmpleadoParecido(nombres, input);
  if (parecido) {
    return { empleado: activos.find((e) => nombreCompleto(e) === parecido)!, exacto: false };
  }

  return null;
}
```

- [ ] **Step 8: Typecheck**

Run: `cd proyecto-oliver-api && npm run typecheck`
Expected: van a aparecer errores en `src/routes/empleados.ts` (todavía usa `activo`/`setEmpleadoActivo`) — se resuelven en la Tarea 6, no hace falta que este typecheck dé limpio todavía.

- [ ] **Step 9: Commit**

```bash
git add src/lib/empleados.ts
git commit -m "feat: empleados.ts usa estado en vez de activo, suma apellido/cuil/fecha_ingreso/sucursal_id"
```

---

### Task 6: `src/routes/empleados.ts` — wiring de validación y estado

**Files:**
- Modify: `proyecto-oliver-api/src/routes/empleados.ts`

**Interfaces:**
- Consumes: `crearEmpleadoSchema`/`editarEmpleadoSchema` (Tarea 4), `validateBody` (ya existente en `src/lib/validation.ts`), funciones actualizadas de `src/lib/empleados.ts` (Tarea 5)

- [ ] **Step 1: Actualizar imports y borrar las interfaces de body manuales**

Reemplazar las líneas 1–28 (imports + `CrearBody`/`EditarBody`) por:

```ts
import { Router, type Request, type Response } from "express";
import type { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/require-org.js";
import { requireRole } from "../middleware/require-role.js";
import { validateBody } from "../lib/validation.js";
import { crearEmpleadoSchema, editarEmpleadoSchema } from "./empleados.schemas.js";
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
import { getEntitlements, esErrorLimitePlan } from "../lib/planes.js";
import { getOtpVigente, generarOtp } from "../lib/otp.js";

type CrearBody = z.infer<typeof crearEmpleadoSchema>;
type EditarBody = z.infer<typeof editarEmpleadoSchema>;
```

- [ ] **Step 2: Actualizar `POST /empleados`**

```ts
empleadosRouter.post(
  "/empleados",
  requireAuth,
  requireOrg,
  requireRole("owner", "admin"),
  validateBody(crearEmpleadoSchema),
  async (req: Request<unknown, unknown, CrearBody>, res: Response) => {
    const { nombre, apellido, celular, cuil, fecha_ingreso, sucursal_id } = req.body;

    const ent = await getEntitlements(req, req.org!);
    try {
      const empleado = await createEmpleadoConLimite(
        req.org!.id,
        { nombre, apellido, celular, cuil, fecha_ingreso, sucursal_id },
        ent.maxEmpleados
      );
      res.status(201).json(empleado);
    } catch (e) {
      if (esErrorLimitePlan(e)) {
        res.status(403).json({ error: "limite_plan", recurso: "empleados", max: ent.maxEmpleados });
        return;
      }
      if (e instanceof Error && e.message === "cuil_duplicado") {
        res.status(409).json({ error: "Ya existe un empleado con ese CUIL en esta organización." });
        return;
      }
      throw e;
    }
  }
);
```

- [ ] **Step 3: Actualizar `PATCH /empleados/:id`**

```ts
empleadosRouter.patch(
  "/empleados/:id",
  requireAuth,
  requireOrg,
  requireRole("owner", "admin"),
  validateBody(editarEmpleadoSchema),
  async (req: Request<{ id: string }, unknown, EditarBody>, res: Response) => {
    const { id } = req.params;
    const body = req.body;

    if (body.estado !== undefined) {
      const ent = await getEntitlements(req, req.org!);
      try {
        await reactivarEmpleadoConLimite(req.org!.id, id, body.estado, ent.maxEmpleados);
      } catch (e) {
        if (esErrorLimitePlan(e)) {
          res.status(403).json({ error: "limite_plan", recurso: "empleados", max: ent.maxEmpleados });
          return;
        }
        res.status(404).json({ error: "Empleado no encontrado" });
        return;
      }
    }

    const patch: Parameters<typeof updateEmpleado>[2] = {};
    if (body.nombre !== undefined) patch.nombre = body.nombre;
    if (body.apellido !== undefined) patch.apellido = body.apellido;
    if (body.celular !== undefined) patch.celular = body.celular;
    if (body.cuil !== undefined) patch.cuil = body.cuil;
    if (body.fecha_ingreso !== undefined) patch.fecha_ingreso = body.fecha_ingreso;
    if (body.sucursal_id !== undefined) patch.sucursal_id = body.sucursal_id;

    if (Object.keys(patch).length > 0) {
      try {
        const empleado = await updateEmpleado(req.org!.id, id, patch);
        res.json(empleado);
        return;
      } catch (e) {
        if (e instanceof Error && e.message === "cuil_duplicado") {
          res.status(409).json({ error: "Ya existe un empleado con ese CUIL en esta organización." });
          return;
        }
        throw e;
      }
    }
    res.json({ ok: true });
  }
);
```

- [ ] **Step 4: Actualizar el guard de `DELETE /empleados/:id`**

Cambiar:
```ts
if (empleado.activo) {
```
por:
```ts
if (empleado.estado !== "baja") {
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: limpio (0 errores).

- [ ] **Step 6: Correr toda la suite de tests**

Run: `npx vitest run`
Expected: todos los tests (los de antes + los nuevos de las Tareas 2-4) en verde.

- [ ] **Step 7: Verificación manual (curl)**

Con el server corriendo (`npm run dev`) y una sesión de owner/admin ya logueada en el panel (para tener la cookie), o directo por la UI en `/empleados`:
1. Crear un empleado sin apellido → 400 con `"El campo apellido es requerido"` (o el mensaje de zod equivalente).
2. Crear un empleado con CUIL `20123456780` (dígito verificador incorrecto) → 400.
3. Crear dos empleados con el mismo CUIL válido → el segundo da 409 `cuil_duplicado`.
4. Editar un empleado a `estado: "de_licencia"` → 200, y ese empleado sigue apareciendo si intentás marcar con su nombre en `/marcar`.
5. Editar un empleado a `estado: "baja"` y después intentar marcar con su nombre → rechazado (nombre no encontrado en la nómina activa).

- [ ] **Step 8: Commit**

```bash
git add src/routes/empleados.ts
git commit -m "feat: wire validación zod y estados en rutas de empleados"
```

---

### Task 7: Script de migración de datos — split apellido/nombre

**Files:**
- Create: `proyecto-oliver-api/scripts/split-apellido.js`

**Interfaces:**
- Ninguna (script one-off, no lo consume otro código).

- [ ] **Step 1: Escribir el script**

```js
// Uso:
//   node --env-file=.env.local scripts/split-apellido.js            (dry-run)
//   node --env-file=.env.local scripts/split-apellido.js --aplicar  (aplica)
//
// Separa el campo "nombre" (texto libre) de los empleados que todavía no
// tienen apellido cargado, con la heurística "última palabra = apellido,
// resto = nombre". Imprime la tabla de cambios propuestos para revisión —
// los apellidos compuestos van a salir mal separados y hay que corregirlos
// a mano desde /empleados después de correr esto.
import { createClient } from "@supabase/supabase-js";

const APLICAR = process.argv.includes("--aplicar");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function splitNombre(nombreCompleto) {
  const palabras = nombreCompleto.trim().split(/\s+/);
  if (palabras.length < 2) return { apellido: "", nombre: nombreCompleto.trim() };
  const apellido = palabras[palabras.length - 1];
  const nombre = palabras.slice(0, -1).join(" ");
  return { apellido, nombre };
}

async function main() {
  const { data: empleados, error } = await supabase
    .from("empleados")
    .select("id, nombre, apellido")
    .is("apellido", null);
  if (error) throw error;

  console.log(`${empleados.length} empleados sin apellido cargado.\n`);

  for (const e of empleados) {
    const { apellido, nombre } = splitNombre(e.nombre);
    console.log(`${e.id}  "${e.nombre}"  →  apellido="${apellido}" nombre="${nombre}"`);
    if (APLICAR) {
      const { error: updErr } = await supabase.from("empleados").update({ apellido, nombre }).eq("id", e.id);
      if (updErr) throw updErr;
    }
  }

  console.log(APLICAR ? "\nAplicado." : "\nDry-run — no se tocó nada. Corré con --aplicar para aplicar los cambios.");
}

main();
```

- [ ] **Step 2: Correr en dry-run y revisar la salida**

Run: `cd proyecto-oliver-api && node --env-file=.env.local scripts/split-apellido.js`
Expected: lista de empleados con el split propuesto, sin tocar la base. Revisar a ojo los casos con apellidos compuestos (van a quedar mal separados — anotarlos para corregir a mano después).

- [ ] **Step 3: Aplicar**

Run: `node --env-file=.env.local scripts/split-apellido.js --aplicar`

- [ ] **Step 4: Verificar**

Run: `supabase db execute --sql "select count(*) from empleados where apellido is null or apellido = '';"`
Expected: `0` (o solo los que se hayan creado después sin apellido, que no debería pasar una vez que la Tarea 6 esté deployada).

- [ ] **Step 5: Commit**

```bash
git add scripts/split-apellido.js
git commit -m "feat: script one-off para separar apellido/nombre en empleados existentes"
```

---

### Task 8: Migración de base de datos — dropear `activo`

**Files:**
- Create: `proyecto-oliver-api/supabase/migrations/0012_empleados_drop_activo.sql`

**Interfaces:** Ninguna nueva — cierra la migración en dos pasos de la Tarea 1.

**Aplicar solo después de:** Tareas 1–7 deployadas y verificadas en producción (nada en la app lee ni escribe `activo` — confirmado con `grep -rn "\.activo\b" src/` en `proyecto-oliver-api` y `grep -rn "\.activo\b" src/` en `proyecto-oliver` sin resultados relacionados a empleados).

- [ ] **Step 1: Escribir la migración**

```sql
-- Cierra la migración en dos pasos de 0011_empleados_identidad.sql.
-- Aplicar solo después de verificar en producción que estado quedó bien
-- backfilleado y que ningún código de la app lee/escribe activo.
alter table empleados drop column activo;
```

- [ ] **Step 2: Aplicar**

Run: `supabase db push`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_empleados_drop_activo.sql
git commit -m "feat(db): dropea empleados.activo (reemplazado por estado)"
```

---

### Task 9: `proyecto-oliver/src/lib/api.ts` — tipos del frontend

**Files:**
- Modify: `proyecto-oliver/src/lib/api.ts`

**Interfaces:**
- Produces: `Empleado`, `CrearEmpleadoInput`, `EditarEmpleadoInput` actualizados (usados por Tarea 10)

- [ ] **Step 1: Reemplazar `Empleado`, `CrearEmpleadoInput`, `EditarEmpleadoInput`**

```ts
export type EstadoEmpleado = "activo" | "de_licencia" | "suspendido" | "baja";

export interface Empleado {
  id: string;
  org_id: string;
  nombre: string;
  apellido: string | null;
  celular: string | null;
  cuil: string | null;
  fecha_ingreso: string | null;
  sucursal_id: string | null;
  device_token: string | null;
  estado: EstadoEmpleado;
  created_at: string;
  otp: EmpleadoOtp | null;
  tiene_asistencia: boolean;
}

export interface CrearEmpleadoInput {
  nombre: string;
  apellido: string;
  celular?: string;
  cuil?: string;
  fecha_ingreso?: string;
  sucursal_id?: string;
}

export interface EditarEmpleadoInput {
  nombre?: string;
  apellido?: string;
  celular?: string | null;
  cuil?: string | null;
  fecha_ingreso?: string | null;
  sucursal_id?: string | null;
  estado?: EstadoEmpleado;
}
```

Nota: el backend (Tarea 5/6) ya no manda `activo` en la respuesta, así que no queda declarado acá — mismo criterio que la Tarea 5 con `activo` en el backend, sin coexistencia.

- [ ] **Step 2: Typecheck**

Run: `cd proyecto-oliver && npx tsc -b --noEmit`
Expected: errores en `EmpleadosPage.tsx` (todavía referencia `emp.activo`, que ya no existe en el tipo) — se resuelven en la Tarea 10, es esperable que este typecheck no dé limpio todavía.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: tipos de Empleado con apellido/cuil/fecha_ingreso/sucursal_id/estado"
```

---

### Task 10: `proyecto-oliver/src/pages/empleados/EmpleadosPage.tsx` — formulario y tabla

**Files:**
- Modify: `proyecto-oliver/src/pages/empleados/EmpleadosPage.tsx`

**Interfaces:**
- Consumes: `Empleado`, `CrearEmpleadoInput`, `EditarEmpleadoInput` (Tarea 9), `useSucursales` (ya existente en `../sucursales/hooks`)

- [ ] **Step 1: Agregar el import de `useSucursales` y el estado local nuevo**

Agregar al import existente de hooks:
```ts
import { useSucursales } from "../sucursales/hooks";
```

Reemplazar los `useState` de apellido/CUIL/fecha/sucursal (agregar a los existentes `nombre`/`celular`):
```ts
const [apellido, setApellido] = useState("");
const [cuil, setCuil] = useState("");
const [fechaIngreso, setFechaIngreso] = useState("");
const [sucursalId, setSucursalId] = useState("");
const [editApellido, setEditApellido] = useState("");
const [editCuil, setEditCuil] = useState("");
const [editFechaIngreso, setEditFechaIngreso] = useState("");
const [editSucursalId, setEditSucursalId] = useState("");
const [editEstado, setEditEstado] = useState<Empleado["estado"]>("activo");
```

Agregar junto a `const { data: org } = useOrgActual();`:
```ts
const { data: sucursales = [] } = useSucursales();
```

- [ ] **Step 2: Reemplazar los usos de `emp.activo` para conteo y filtro de estado**

Cambiar:
```ts
const activosCount = empleados.filter((e) => e.activo).length;
```
por:
```ts
const activosCount = empleados.filter((e) => e.estado !== "baja").length;
```

Cambiar el filtro de la tabla:
```ts
const matchEstado =
  estadoFiltro === "todos" || (estadoFiltro === "activos" ? emp.activo : !emp.activo);
```
por:
```ts
const matchEstado =
  estadoFiltro === "todos" || (estadoFiltro === "activos" ? emp.estado !== "baja" : emp.estado === "baja");
```
(El filtro "activos"/"inactivos" de la UI se queda simple para este Paso 1 — un desglose por los 4 estados es Paso 4, "columnas configurables/filtros".)

- [ ] **Step 3: Actualizar `handleAlta`**

```ts
async function handleAlta(e: FormEvent) {
  e.preventDefault();
  setError(null);
  try {
    await crear.mutateAsync({
      nombre,
      apellido,
      celular: celular || undefined,
      cuil: cuil || undefined,
      fecha_ingreso: fechaIngreso || undefined,
      sucursal_id: sucursalId || undefined,
    });
    setNombre("");
    setApellido("");
    setCelular("");
    setCuil("");
    setFechaIngreso("");
    setSucursalId("");
    setAltaOpen(false);
    toast.success(`${apellido}, ${nombre} fue agregado a la nómina.`);
  } catch (err) {
    setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
  }
}
```

- [ ] **Step 4: Actualizar `abrirEdicion` y `handleGuardarEdicion`**

```ts
function abrirEdicion(emp: Empleado) {
  setError(null);
  setEditando(emp);
  setEditNombre(emp.nombre);
  setEditApellido(emp.apellido ?? "");
  setEditCelular(emp.celular ?? "");
  setEditCuil(emp.cuil ?? "");
  setEditFechaIngreso(emp.fecha_ingreso ?? "");
  setEditSucursalId(emp.sucursal_id ?? "");
  setEditEstado(emp.estado);
}

async function handleGuardarEdicion(e: FormEvent) {
  e.preventDefault();
  if (!editando) return;
  setError(null);
  try {
    await editar.mutateAsync({
      id: editando.id,
      patch: {
        nombre: editNombre,
        apellido: editApellido || undefined,
        celular: editCelular || null,
        cuil: editCuil || null,
        fecha_ingreso: editFechaIngreso || null,
        sucursal_id: editSucursalId || null,
        estado: editEstado,
      },
    });
    setEditando(null);
    toast.success("Empleado actualizado.");
  } catch (err) {
    setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
  }
}
```

- [ ] **Step 5: Reemplazar `handleToggleActivo` por `handleCambiarEstado`**

```ts
async function handleCambiarEstado(emp: Empleado, nuevoEstado: Empleado["estado"]) {
  setAccionandoId(emp.id);
  try {
    await editar.mutateAsync({ id: emp.id, patch: { estado: nuevoEstado } });
    toast.success(`${emp.nombre} pasó a estado "${nuevoEstado}".`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
  } finally {
    setAccionandoId(null);
  }
}
```

Todos los llamados a `handleToggleActivo(emp)` en el JSX (Step 7) pasan a `handleCambiarEstado(emp, emp.estado === "baja" ? "activo" : "baja")` para conservar el botón único de activar/dar de baja rápido; el cambio a `de_licencia`/`suspendido` se hace desde el formulario de edición (Step 4), no desde un botón de la tabla — no hace falta un control nuevo en la fila para esto en el Paso 1.

- [ ] **Step 6: Agregar los campos al formulario de alta y de edición**

En el `<Dialog title="Nuevo empleado">`, agregar después del `Field` de nombre:
```tsx
<Field
  label="Apellido"
  required
  value={apellido}
  onChange={(e) => setApellido(e.target.value)}
  containerClassName="w-full"
/>
```
Y después del `Field` de celular:
```tsx
<Field
  label="CUIL (opcional)"
  placeholder="20-12345678-6"
  value={cuil}
  onChange={(e) => setCuil(e.target.value)}
  containerClassName="w-full"
/>
<Field
  label="Fecha de ingreso (opcional)"
  type="date"
  value={fechaIngreso}
  onChange={(e) => setFechaIngreso(e.target.value)}
  containerClassName="w-full"
/>
<Select
  label="Sucursal (opcional)"
  value={sucursalId}
  onChange={(e) => setSucursalId(e.target.value)}
  options={[{ value: "", label: "Sin asignar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
  containerClassName="w-full"
/>
```

Mismo bloque (con `edit`-prefijo en value/onChange) en el `<Dialog title={...editar...}>`, más un `Select` de estado:
```tsx
<Select
  label="Estado"
  value={editEstado}
  onChange={(e) => setEditEstado(e.target.value as Empleado["estado"])}
  options={[
    { value: "activo", label: "Activo" },
    { value: "de_licencia", label: "De licencia" },
    { value: "suspendido", label: "Suspendido" },
    { value: "baja", label: "Baja" },
  ]}
  containerClassName="w-full"
/>
```

- [ ] **Step 7: Actualizar la tabla**

Cambiar el header:
```tsx
<TableHead>Nombre</TableHead>
<TableHead>Celular</TableHead>
<TableHead>Sucursal</TableHead>
<TableHead>Dispositivo</TableHead>
<TableHead>Estado</TableHead>
<TableHead className="text-right">Acciones</TableHead>
```

Cambiar la fila (`className`, celda de nombre, celda de sucursal nueva, celda de estado, y el botón de activar/desactivar):
La celda de "Dispositivo" (device_token/OTP) no cambia — se conserva tal cual está hoy. Reemplazar el resto de la fila:

```tsx
<TableRow key={emp.id} className={emp.estado === "baja" ? "text-text/40" : ""}>
  <TableCell>{emp.apellido ? `${emp.apellido}, ${emp.nombre}` : emp.nombre}</TableCell>
  <TableCell>{emp.celular ?? "—"}</TableCell>
  <TableCell>{sucursales.find((s) => s.id === emp.sucursal_id)?.nombre ?? "—"}</TableCell>
  <TableCell>
    {emp.device_token ? (
      <Status tone="success">Vinculado</Status>
    ) : emp.otp ? (
      <span className="inline-flex items-center gap-[7px] text-[13px] text-text">
        <span className="h-[7px] w-[7px] rounded-full bg-warning" />
        <span className="font-mono tracking-wide">{formatCode(emp.otp.code)}</span>
        <span className="text-text-tertiary">({minutosRestantes(emp.otp.expires_at)} min)</span>
      </span>
    ) : (
      <Status tone="neutral">Sin vincular</Status>
    )}
  </TableCell>
  <TableCell>
    <Status tone={emp.estado === "activo" ? "success" : emp.estado === "baja" ? "neutral" : "warning"}>
      {{ activo: "Activo", de_licencia: "De licencia", suspendido: "Suspendido", baja: "Baja" }[emp.estado]}
    </Status>
  </TableCell>
  <TableCell>
    <div className="flex justify-end gap-1.5">
      <IconButton
        onClick={() => abrirEdicion(emp)}
        disabled={loading || !gestionable}
        title={!gestionable ? "Tu rol no tiene acceso a editar empleados." : undefined}
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        }
        label="Editar"
      />
      <IconButton
        onClick={() => handleCambiarEstado(emp, emp.estado === "baja" ? "activo" : "baja")}
        disabled={loading || !gestionable}
        title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
        icon={
          accionandoId === emp.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v6" />
              <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
            </svg>
          )
        }
        label={emp.estado === "baja" ? "Activar" : "Dar de baja"}
      />
      {gestionable && emp.device_token && (
        <IconButton
          onClick={() => setDesvincularTarget(emp)}
          disabled={loading}
          icon={
            accionandoId === emp.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            )
          }
          label="Desvincular"
        />
      )}
      {gestionable && !emp.device_token && (
        <IconButton
          onClick={() => handleGenerarCodigo(emp)}
          disabled={loading}
          icon={
            accionandoId === emp.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )
          }
          label={emp.otp ? "Código nuevo" : "Generar código"}
        />
      )}
      {gestionable && emp.estado === "baja" && !emp.tiene_asistencia && (
        <IconButton
          onClick={() => setEliminarTarget(emp)}
          disabled={loading}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          }
          label="Eliminar"
        />
      )}
    </div>
  </TableCell>
</TableRow>
```

Esto ya incluye el guard de "Eliminar" actualizado (`emp.estado === "baja"` en vez de `!emp.activo`) — no hace falta el cambio aparte que se mencionaba antes.

Y el `colSpan={5}` de las dos filas de "sin resultados" pasa a `colSpan={6}` (una columna más).

- [ ] **Step 8: Typecheck**

Run: `cd proyecto-oliver && npx tsc -b --noEmit`
Expected: limpio. Si quedó el campo `activo` de la Tarea 9 sin usar en ningún lado, borrarlo de la interfaz `Empleado` en `api.ts` ahora.

- [ ] **Step 9: Verificación manual en navegador**

Con los dos servers corriendo:
1. `/empleados` → "Nuevo empleado" → cargar apellido, CUIL con formato `20-12345678-6`, fecha de ingreso, sucursal → guardar → aparece en la tabla con "Apellido, Nombre" y la sucursal correcta.
2. Cargar un CUIL con dígito verificador incorrecto → el submit falla con el mensaje de error del backend.
3. Editar un empleado, cambiar estado a "De licencia" → el badge de la tabla cambia y el estilo tachado no se aplica (solo "Baja" lo aplica).
4. Con un empleado en "Baja", confirmar que aparece el botón "Eliminar" (si no tiene asistencia) igual que antes.

- [ ] **Step 10: Commit**

```bash
git add src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat: formulario y tabla de empleados con apellido/cuil/fecha_ingreso/sucursal/estado"
```

---

## Orden de deploy sugerido

1. Tareas 1–7 en `proyecto-oliver-api` (schema + backend), deployado y verificado.
2. Tareas 9–10 en `proyecto-oliver` (frontend), deployado.
3. Confirmar en producción que nada lee/escribe `activo` (backend ni frontend).
4. Tarea 8 (`0012_empleados_drop_activo.sql`) — recién ahí.
