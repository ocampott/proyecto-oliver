# Módulo Turnos y Cumplimiento Horario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar la lógica funcional del módulo "Turnos y cumplimiento horario" (commit `2ee7647` del remote git `externo`, repo Next.js pre-migración) al stack actual — horarios semanales por empleado, plantillas de turno, asignación masiva y comparación de cumplimiento — sin portar nada visual del repo externo.

**Architecture:** `server/` gana `lib/turnos.ts` (CRUD de horarios/plantillas/tolerancia + `calcularCumplimiento`, que reusa `calcularHoras` de `lib/asistencia.ts` tal cual está) y `routes/turnos.ts` (11 rutas, wiring puro). `web/` gana una página `/turnos` con 2 tabs construidos desde cero con los componentes `ui/*` ya existentes (mismo lenguaje visual que Asistencia/Horas/Empleados/Sucursales) — nada del `Sidebar`/colores del repo externo se porta.

**Tech Stack:** Sin dependencias nuevas — Fastify + Supabase (server), React Query + Tailwind (web), ya presentes.

**Spec:** `docs/superpowers/specs/2026-08-20-turnos-cumplimiento-design.md`

## Global Constraints

- **Matching de cumplimiento por `empleado_id` (FK real), no por nombre normalizado** — a diferencia del repo externo (SQLite, sin relación limpia entre tablas), acá `horarios_empleado.empleado_id` referencia `empleados.id` directamente.
- **`calcularCumplimiento` reusa `calcularHoras` de `server/src/lib/asistencia.ts` sin modificarlo** — ese archivo y `routes/horas.ts` no se tocan en este plan. `calcularHoras` no acepta filtro de `empleadoId`; el filtro por empleado en cumplimiento se aplica en memoria sobre el resultado, dentro de `calcularCumplimiento`.
- **Los timestamps de Supabase son ISO string** (`created_at`/`entrada_at`/`salida_at`), no unix seconds como en el repo externo — los helpers de minutos-del-día/día-de-semana operan sobre `new Date(iso)` con el mismo offset fijo `-03:00` (sin DST) que ya usa `asistencia.ts`.
- **`turno_templates.dias_semana` es `integer[]` nativo de Postgres** — `supabase-js` lo devuelve como array de JS directo, sin el CSV-en-TEXT que manejaba el repo externo (`diasToText`/`textToDias` no aplican acá).
- **Las rutas `POST` que crean una fila en este módulo devuelven `{ ok: true }`**, no la entidad creada — la UI ya refresca la lista invalidando la query correspondiente (mismo patrón que `insertHorariosBulk`/`resolverRechazada`/`deleteAsistencia`, no el de `createEmpleado`/`createSucursal`, que sí devuelven la fila para otros consumidores que este plan no toca).
- **`DELETE` con id en el path** (RESTful), mismo patrón ya establecido en `sucursales.ts`/`empleados.ts`/`asistencia.ts`.
- Cada mutación de TanStack Query invalida la(s) query key(s) relacionadas al completarse.
- **Sin tests automatizados** (convención del repo: `server/`/`web/` no tienen suite de tests) — verificación vía `typecheck`/`build` por task y checklist manual en navegador al final.
- **`sucursal_id` en `horarios_empleado` es opcional** — el cálculo de cumplimiento ignora la sucursal, compara solo empleado + día + hora.
- **Puertos de dev de este worktree** (`.worktrees/turnos-cumplimiento`, rama `turnos-cumplimiento`, creado desde `main` local): server `3011` (`server/.env.local` ya seteado, `PORT=3011`/`CORS_ORIGIN=http://localhost:5175`), web `5175` (arrancar con `npx vite --port 5175` — `web/vite.config.ts` no se toca, sigue en `5173` para no generar diff con `main`; `web/.env.local` ya apunta `VITE_API_URL=http://localhost:3011`). Los otros worktrees del repo (`modern-soft-redesign`: server 3010/web 5173; `modernist-pixel-perfect`: server 3001/web 5173) pueden seguir corriendo en paralelo sin choque de puertos.
- **Supabase de este proyecto es un proyecto remoto real** (`SUPABASE_URL=https://utgjmreanqbzncvykqgd.supabase.co` en `server/.env.local`/`web/.env.local`), no el stack local de Docker que documenta el README — no hay `supabase_db_proyecto-oliver` corriendo ni proyecto linkeado (`npx supabase link`). Las migraciones se aplican pegando el SQL a mano en el SQL Editor del Dashboard de Supabase (https://supabase.com/dashboard/project/utgjmreanqbzncvykqgd/sql/new) — acción que solo puede hacer el usuario, no el agente. Ver Task 1 Step 2.

---

## Task 1: Migración SQL — `horarios_empleado`, `turno_templates`, `org_settings.tolerancia_min`

**Files:**
- Create: `supabase/migrations/0004_turnos.sql`

**Interfaces:**
- Consumes: tablas `organizations`, `empleados`, `sucursales`, `org_settings` (ya existen, `supabase/migrations/0001..0003`).
- Produces: tablas `horarios_empleado`, `turno_templates`; columna `org_settings.tolerancia_min` — usadas por `server/src/lib/turnos.ts` en la Task 2.

- [ ] **Step 1: Crear `supabase/migrations/0004_turnos.sql`**

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

- [ ] **Step 2: Pedirle al usuario que aplique la migración en el Dashboard de Supabase**

Este proyecto usa un Supabase remoto real, no un stack local — el agente no tiene forma de correr la migración por su cuenta. Pedirle al usuario, explícitamente, que:

1. Abra el SQL Editor del proyecto: https://supabase.com/dashboard/project/utgjmreanqbzncvykqgd/sql/new
2. Pegue el contenido completo de `supabase/migrations/0004_turnos.sql` (Step 1) y lo ejecute.
3. Confirme acá que corrió sin errores.

Esperar la confirmación explícita antes de seguir al Step 3 — no asumir que ya está aplicada.

- [ ] **Step 3: Verificar contra la API REST (no requiere psql/Docker)**

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_SERVICE_ROLE_KEY" server/.env.local | sed 's/^/export /')

echo "--- horarios_empleado existe (200 + [] o filas) ---"
curl -s -w " [%{http_code}]" "$SUPABASE_URL/rest/v1/horarios_empleado?select=id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
echo

echo "--- turno_templates existe (200 + [] o filas) ---"
curl -s -w " [%{http_code}]" "$SUPABASE_URL/rest/v1/turno_templates?select=id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
echo

echo "--- org_settings.tolerancia_min existe con default 30 ---"
curl -s -w " [%{http_code}]" "$SUPABASE_URL/rest/v1/org_settings?select=org_id,tolerancia_min&limit=5" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
echo
```

Esperado: las tres llamadas devuelven `[200]`; la primera y segunda dan `[]` (tablas nuevas, sin filas todavía) o `403`/`404` si la migración no se aplicó (en ese caso, volver al Step 2); la tercera devuelve las orgs existentes, todas con `tolerancia_min: 30`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_turnos.sql
git commit -m "feat(db): tablas horarios_empleado, turno_templates y org_settings.tolerancia_min"
```

---

## Task 2: CRUD de horarios, plantillas y tolerancia en `server/src/lib/turnos.ts`

**Files:**
- Create: `server/src/lib/turnos.ts`

**Interfaces:**
- Consumes: `createServiceClient` (`server/src/lib/supabase-service.js`, ya existe — mismo uso que en `lib/sucursales.ts`).
- Produces: `HorarioEmpleado`, `TurnoTemplate` (interfaces); `listHorarios(orgId, empleadoId?)`, `insertHorario(orgId, params)`, `updateHorario(orgId, id, patch)`, `deleteHorario(orgId, id)`, `insertHorariosBulk(orgId, params)`, `listTurnoTemplates(orgId)`, `insertTurnoTemplate(orgId, input)` (throw `Error("Ya existe una plantilla con ese nombre")` en conflicto), `deleteTurnoTemplate(orgId, id)`, `getTolerancia(orgId)`, `setTolerancia(orgId, min)` — consumidos por `routes/turnos.ts` (Task 3) y por `calcularCumplimiento` (Task 3, mismo archivo).

- [ ] **Step 1: Crear `server/src/lib/turnos.ts`**

```ts
import { createServiceClient } from "./supabase-service.js";

// ── Horarios esperados por empleado ─────────────────────────────────────────
// Franjas definidas a mano (día de semana + hora inicio/fin). Un empleado
// puede tener varias filas: turno partido (mismo día, dos franjas) y/o
// trabajar en más de una sucursal. dia_semana sigue Date.getUTCDay():
// 0=domingo ... 6=sábado. sucursal_id es opcional y solo informativo — el
// cumplimiento (ver más abajo en este archivo) compara únicamente
// empleado + día + hora, sin importar dónde marcó.

export interface HorarioEmpleado {
  id: string;
  empleado_id: string;
  sucursal_id: string | null;
  sucursal_nombre: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  tolerancia_min: number | null;
}

interface HorarioRow {
  id: string;
  empleado_id: string;
  sucursal_id: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  tolerancia_min: number | null;
  sucursales: { nombre: string } | { nombre: string }[] | null;
}

function nombreDe(rel: { nombre: string } | { nombre: string }[] | null): string | null {
  return (Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre) ?? null;
}

export async function listHorarios(orgId: string, empleadoId?: string): Promise<HorarioEmpleado[]> {
  const service = createServiceClient();
  let query = service
    .from("horarios_empleado")
    .select("id, empleado_id, sucursal_id, dia_semana, hora_inicio, hora_fin, tolerancia_min, sucursales(nombre)")
    .eq("org_id", orgId)
    .order("dia_semana")
    .order("hora_inicio");
  if (empleadoId) query = query.eq("empleado_id", empleadoId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as HorarioRow[]).map((r) => ({
    id: r.id,
    empleado_id: r.empleado_id,
    sucursal_id: r.sucursal_id,
    sucursal_nombre: nombreDe(r.sucursales),
    dia_semana: r.dia_semana,
    hora_inicio: r.hora_inicio,
    hora_fin: r.hora_fin,
    tolerancia_min: r.tolerancia_min,
  }));
}

export async function insertHorario(
  orgId: string,
  params: {
    empleado_id: string;
    sucursal_id?: string | null;
    dia_semana: number;
    hora_inicio: string;
    hora_fin: string;
    tolerancia_min?: number | null;
  }
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("horarios_empleado").insert({
    org_id: orgId,
    empleado_id: params.empleado_id,
    sucursal_id: params.sucursal_id ?? null,
    dia_semana: params.dia_semana,
    hora_inicio: params.hora_inicio,
    hora_fin: params.hora_fin,
    tolerancia_min: params.tolerancia_min ?? null,
  });
  if (error) throw error;
}

export async function updateHorario(
  orgId: string,
  id: string,
  patch: {
    sucursal_id?: string | null;
    dia_semana?: number;
    hora_inicio?: string;
    hora_fin?: string;
    tolerancia_min?: number | null;
  }
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("horarios_empleado").update(patch).eq("org_id", orgId).eq("id", id);
  if (error) throw error;
}

export async function deleteHorario(orgId: string, id: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("horarios_empleado").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw error;
}

// Asigna el mismo turno a varios empleados y varios días en un solo paso —
// una fila en horarios_empleado por cada combinación empleado × día.
export async function insertHorariosBulk(
  orgId: string,
  params: {
    empleado_ids: string[];
    dias_semana: number[];
    hora_inicio: string;
    hora_fin: string;
    tolerancia_min?: number | null;
  }
): Promise<void> {
  const service = createServiceClient();
  const rows = params.empleado_ids.flatMap((empleado_id) =>
    params.dias_semana.map((dia_semana) => ({
      org_id: orgId,
      empleado_id,
      dia_semana,
      hora_inicio: params.hora_inicio,
      hora_fin: params.hora_fin,
      tolerancia_min: params.tolerancia_min ?? null,
    }))
  );
  const { error } = await service.from("horarios_empleado").insert(rows);
  if (error) throw error;
}

// ── Plantillas de turno ──────────────────────────────────────────────────────
// Molde con nombre reutilizable (horario + opcionalmente los días habituales)
// para no tipear el horario cada vez al asignar. Sin sucursal a propósito:
// eso se elige al momento de asignar, no queda atado a la plantilla.

export interface TurnoTemplate {
  id: string;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  dias_semana: number[];
  tolerancia_min: number | null;
}

export async function listTurnoTemplates(orgId: string): Promise<TurnoTemplate[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("turno_templates")
    .select("id, nombre, hora_inicio, hora_fin, dias_semana, tolerancia_min")
    .eq("org_id", orgId)
    .order("nombre");
  if (error) throw error;
  return data as TurnoTemplate[];
}

export async function insertTurnoTemplate(
  orgId: string,
  input: {
    nombre: string;
    hora_inicio: string;
    hora_fin: string;
    dias_semana: number[];
    tolerancia_min?: number | null;
  }
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("turno_templates").insert({
    org_id: orgId,
    nombre: input.nombre,
    hora_inicio: input.hora_inicio,
    hora_fin: input.hora_fin,
    dias_semana: input.dias_semana,
    tolerancia_min: input.tolerancia_min ?? null,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe una plantilla con ese nombre");
    throw error;
  }
}

export async function deleteTurnoTemplate(orgId: string, id: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("turno_templates").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw error;
}

// ── Tolerancia general de la org ─────────────────────────────────────────────
// Vive en org_settings.tolerancia_min (columna agregada en la migración
// 0004) en vez de una tabla "settings" singleton propia — cada org ya tiene
// su fila de org_settings creada al alta (server/src/lib/organizations.ts).

export async function getTolerancia(orgId: string): Promise<number> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("org_settings")
    .select("tolerancia_min")
    .eq("org_id", orgId)
    .single();
  if (error) throw error;
  return data.tolerancia_min;
}

export async function setTolerancia(orgId: string, min: number): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("org_settings").update({ tolerancia_min: min }).eq("org_id", orgId);
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd server && npm run typecheck
```

Esperado: sin errores. Sin rutas todavía (se conectan en la Task 3), así que no hay verificación funcional posible en este paso.

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/turnos.ts
git commit -m "feat(server): CRUD de horarios, plantillas y tolerancia"
```

---

## Task 3: `calcularCumplimiento` + rutas de `server/`

**Files:**
- Modify: `server/src/lib/turnos.ts` (agregar `calcularCumplimiento` al final)
- Create: `server/src/routes/turnos.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: todo lo producido en la Task 2 (mismo archivo); `calcularHoras`, `Turno` (`server/src/lib/asistencia.js`, ya existen — firma `calcularHoras(orgId, {desde, hasta, sucursalId?})` → `Turno[]` con `{empleado_id, nombre, sucursal_id, sucursal_nombre, entrada_at, salida_at, horas}`); `requireAuth`/`requireOrg` (`server/src/plugins/*.js`).
- Produces: `CumplimientoRow`, `calcularCumplimiento(orgId, filters)` (mismo archivo que Task 2); `turnosRoutes` (Fastify plugin) con las 11 rutas del módulo — consumido por `web/src/lib/api.ts` (Task 4).

- [ ] **Step 1: Agregar `calcularCumplimiento` al final de `server/src/lib/turnos.ts`**

```ts
import { calcularHoras } from "./asistencia.js";

// ── Cumplimiento de horarios ─────────────────────────────────────────────────
// Compara cada turno real (calcularHoras, ya existente) contra el horario
// esperado del empleado ese día de semana, con tolerancia en minutos
// (particular de la franja si está definida, si no la general de la org).
// Todo el cálculo de hora/día usa el mismo offset fijo AR (-03:00, sin
// horario de verano) que lib/asistencia.ts — nunca la TZ del sistema
// operativo. A diferencia del repo externo (que matcheaba por nombre
// normalizado), acá se matchea por empleado_id — FK real.

const AR_OFFSET_MIN = 3 * 60;

function aHoraAR(iso: string): Date {
  return new Date(new Date(iso).getTime() - AR_OFFSET_MIN * 60000);
}

function minutosDelDia(iso: string): number {
  const d = aHoraAR(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function diaSemanaAR(iso: string): number {
  return aHoraAR(iso).getUTCDay();
}

function fechaAR(iso: string): string {
  return aHoraAR(iso).toISOString().slice(0, 10);
}

function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

interface HorarioParaMatch {
  empleado_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  tolerancia_min: number | null;
}

export interface CumplimientoRow {
  empleado_id: string;
  nombre: string;
  sucursal_nombre: string;
  fecha: string;
  entrada_real: string;
  entrada_esperada: string | null;
  diff_entrada_min: number | null;
  salida_real: string | null;
  salida_esperada: string | null;
  diff_salida_min: number | null;
  en_curso: boolean;
  estado: "a_horario" | "tarde" | "salida_anticipada" | "tarde_y_anticipada" | "sin_horario";
  tolerancia_aplicada: number | null;
}

export async function calcularCumplimiento(
  orgId: string,
  filters: { desde: string; hasta: string; sucursalId?: string; empleadoId?: string }
): Promise<CumplimientoRow[]> {
  const service = createServiceClient();

  const [toleranciaGeneral, turnosTodos, horariosRes] = await Promise.all([
    getTolerancia(orgId),
    calcularHoras(orgId, { desde: filters.desde, hasta: filters.hasta, sucursalId: filters.sucursalId }),
    service
      .from("horarios_empleado")
      .select("empleado_id, dia_semana, hora_inicio, hora_fin, tolerancia_min")
      .eq("org_id", orgId),
  ]);
  if (horariosRes.error) throw horariosRes.error;
  const horarios = horariosRes.data as HorarioParaMatch[];
  const turnos = filters.empleadoId ? turnosTodos.filter((t) => t.empleado_id === filters.empleadoId) : turnosTodos;

  return turnos.map((t): CumplimientoRow => {
    const dia = diaSemanaAR(t.entrada_at);
    const diaAnterior = (dia + 6) % 7;
    const entradaMin = minutosDelDia(t.entrada_at);

    // Turnos nocturnos (hora_fin <= hora_inicio, ej. 22:00→06:00) se cargan
    // bajo el día en que ARRANCAN. Si el empleado marca después de
    // medianoche, la entrada cae del lado de "hoy" en el calendario — para
    // poder emparejarla con el turno nocturno de "ayer" se suman 1440 min
    // al comparar, y se toma el candidato (de hoy o de ayer) más cercano.
    const candidatosHoy = horarios
      .filter((h) => h.empleado_id === t.empleado_id && h.dia_semana === dia)
      .map((h) => ({ h, diff: entradaMin - horaAMinutos(h.hora_inicio) }));
    const candidatosAyerNocturno = horarios
      .filter(
        (h) =>
          h.empleado_id === t.empleado_id &&
          h.dia_semana === diaAnterior &&
          horaAMinutos(h.hora_fin) <= horaAMinutos(h.hora_inicio)
      )
      .map((h) => ({ h, diff: entradaMin + 1440 - horaAMinutos(h.hora_inicio) }));
    const candidatos = [...candidatosHoy, ...candidatosAyerNocturno];

    if (candidatos.length === 0) {
      return {
        empleado_id: t.empleado_id,
        nombre: t.nombre,
        sucursal_nombre: t.sucursal_nombre,
        fecha: fechaAR(t.entrada_at),
        entrada_real: t.entrada_at,
        entrada_esperada: null,
        diff_entrada_min: null,
        salida_real: t.salida_at,
        salida_esperada: null,
        diff_salida_min: null,
        en_curso: t.salida_at === null,
        estado: "sin_horario",
        tolerancia_aplicada: null,
      };
    }

    const mejor = candidatos.reduce((mejor, c) => (Math.abs(c.diff) < Math.abs(mejor.diff) ? c : mejor));
    const horario = mejor.h;
    const tolerancia = horario.tolerancia_min ?? toleranciaGeneral;
    const diffEntrada = mejor.diff;
    const tarde = diffEntrada > tolerancia;

    let diffSalida: number | null = null;
    let anticipada = false;
    if (t.salida_at !== null) {
      const salidaMin = minutosDelDia(t.salida_at);
      diffSalida = horaAMinutos(horario.hora_fin) - salidaMin;
      anticipada = diffSalida > tolerancia;
    }

    const estado: CumplimientoRow["estado"] =
      tarde && anticipada ? "tarde_y_anticipada" : tarde ? "tarde" : anticipada ? "salida_anticipada" : "a_horario";

    return {
      empleado_id: t.empleado_id,
      nombre: t.nombre,
      sucursal_nombre: t.sucursal_nombre,
      fecha: fechaAR(t.entrada_at),
      entrada_real: t.entrada_at,
      entrada_esperada: horario.hora_inicio,
      diff_entrada_min: diffEntrada,
      salida_real: t.salida_at,
      salida_esperada: horario.hora_fin,
      diff_salida_min: diffSalida,
      en_curso: t.salida_at === null,
      estado,
      tolerancia_aplicada: tolerancia,
    };
  });
}
```

Agregar el import `import { calcularHoras } from "./asistencia.js";` junto a los demás imports, arriba del archivo.

- [ ] **Step 2: Crear `server/src/routes/turnos.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import {
  listHorarios,
  insertHorario,
  updateHorario,
  deleteHorario,
  insertHorariosBulk,
  listTurnoTemplates,
  insertTurnoTemplate,
  deleteTurnoTemplate,
  getTolerancia,
  setTolerancia,
  calcularCumplimiento,
} from "../lib/turnos.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

interface HorariosQuery {
  empleadoId?: string;
}

interface CrearHorarioBody {
  empleado_id?: string;
  sucursal_id?: string | null;
  dia_semana?: number;
  hora_inicio?: string;
  hora_fin?: string;
  tolerancia_min?: number | null;
}

interface EditarHorarioBody {
  sucursal_id?: string | null;
  dia_semana?: number;
  hora_inicio?: string;
  hora_fin?: string;
  tolerancia_min?: number | null;
}

interface BulkBody {
  empleado_ids?: string[];
  dias_semana?: number[];
  hora_inicio?: string;
  hora_fin?: string;
  tolerancia_min?: number | null;
}

interface TemplateBody {
  nombre?: string;
  hora_inicio?: string;
  hora_fin?: string;
  dias_semana?: number[];
  tolerancia_min?: number | null;
}

interface ToleranciaBody {
  tolerancia_min?: number;
}

interface CumplimientoQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  empleadoId?: string;
}

interface IdParams {
  id: string;
}

export async function turnosRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: HorariosQuery }>(
    "/api/horarios",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => listHorarios(request.org!.id, request.query.empleadoId)
  );

  app.post<{ Body: CrearHorarioBody }>(
    "/api/horarios",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { empleado_id, sucursal_id, dia_semana, hora_inicio, hora_fin, tolerancia_min } = request.body ?? {};
      if (!empleado_id || dia_semana === undefined || !hora_inicio || !hora_fin) {
        return reply.code(400).send({ error: "Faltan datos del turno" });
      }
      await insertHorario(request.org!.id, { empleado_id, sucursal_id, dia_semana, hora_inicio, hora_fin, tolerancia_min });
      return { ok: true };
    }
  );

  app.patch<{ Params: IdParams; Body: EditarHorarioBody }>(
    "/api/horarios/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const body = request.body ?? {};
      const patch: Parameters<typeof updateHorario>[2] = {};
      if (body.sucursal_id !== undefined) patch.sucursal_id = body.sucursal_id;
      if (body.dia_semana !== undefined) patch.dia_semana = body.dia_semana;
      if (body.hora_inicio !== undefined) patch.hora_inicio = body.hora_inicio;
      if (body.hora_fin !== undefined) patch.hora_fin = body.hora_fin;
      if (body.tolerancia_min !== undefined) patch.tolerancia_min = body.tolerancia_min;
      await updateHorario(request.org!.id, request.params.id, patch);
      return { ok: true };
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/horarios/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      await deleteHorario(request.org!.id, request.params.id);
      return { ok: true };
    }
  );

  app.post<{ Body: BulkBody }>(
    "/api/horarios/bulk",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { empleado_ids, dias_semana, hora_inicio, hora_fin, tolerancia_min } = request.body ?? {};
      if (!empleado_ids?.length || !dias_semana?.length || !hora_inicio || !hora_fin) {
        return reply.code(400).send({ error: "Faltan datos para asignar el turno" });
      }
      await insertHorariosBulk(request.org!.id, { empleado_ids, dias_semana, hora_inicio, hora_fin, tolerancia_min });
      return { ok: true };
    }
  );

  app.get("/api/turno-templates", { preHandler: [requireAuth, requireOrg] }, async (request) =>
    listTurnoTemplates(request.org!.id)
  );

  app.post<{ Body: TemplateBody }>(
    "/api/turno-templates",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { nombre, hora_inicio, hora_fin, dias_semana, tolerancia_min } = request.body ?? {};
      if (!nombre?.trim() || !hora_inicio || !hora_fin) {
        return reply.code(400).send({ error: "Faltan datos de la plantilla" });
      }
      try {
        await insertTurnoTemplate(request.org!.id, {
          nombre: nombre.trim(),
          hora_inicio,
          hora_fin,
          dias_semana: dias_semana ?? [],
          tolerancia_min,
        });
      } catch (e) {
        return reply.code(409).send({ error: e instanceof Error ? e.message : "No se pudo crear la plantilla" });
      }
      return { ok: true };
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/turno-templates/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      await deleteTurnoTemplate(request.org!.id, request.params.id);
      return { ok: true };
    }
  );

  app.get("/api/turnos/tolerancia", { preHandler: [requireAuth, requireOrg] }, async (request) => ({
    tolerancia_min: await getTolerancia(request.org!.id),
  }));

  app.patch<{ Body: ToleranciaBody }>(
    "/api/turnos/tolerancia",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const min = Number(request.body?.tolerancia_min);
      if (!Number.isFinite(min) || min < 0) {
        return reply.code(400).send({ error: "tolerancia_min inválida" });
      }
      await setTolerancia(request.org!.id, Math.round(min));
      return { ok: true };
    }
  );

  app.get<{ Querystring: CumplimientoQuery }>(
    "/api/turnos/cumplimiento",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const desde = request.query.desde ?? inicioDeMesAR();
      const hasta = request.query.hasta ?? hoyAR();
      return calcularCumplimiento(request.org!.id, {
        desde,
        hasta,
        sucursalId: request.query.sucursalId,
        empleadoId: request.query.empleadoId,
      });
    }
  );
}
```

- [ ] **Step 3: Registrar la ruta en `server/src/index.ts`**

Agregar el import `import { turnosRoutes } from "./routes/turnos.js";` junto a los demás, y `await app.register(turnosRoutes);` junto a los demás `await app.register(...)` (después de `horasRoutes`).

- [ ] **Step 4: Verificar manualmente**

Con el server corriendo (`cd server && npm run dev`), y con al menos un empleado y una sucursal ya cargados (seed demo):

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

EMPLEADO_ID=$(curl -s http://localhost:3001/api/empleados -H "Authorization: Bearer $TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d)[0].id))')

echo "--- tolerancia general (default) ---"
curl -s http://localhost:3001/api/turnos/tolerancia -H "Authorization: Bearer $TOKEN"
echo

echo "--- crear franja horaria ---"
curl -s -w " [%{http_code}]" -X POST http://localhost:3001/api/horarios \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"empleado_id\":\"$EMPLEADO_ID\",\"dia_semana\":1,\"hora_inicio\":\"08:00\",\"hora_fin\":\"14:00\"}"
echo

echo "--- listar horarios del empleado ---"
curl -s "http://localhost:3001/api/horarios?empleadoId=$EMPLEADO_ID" -H "Authorization: Bearer $TOKEN"
echo

echo "--- crear plantilla ---"
curl -s -w " [%{http_code}]" -X POST http://localhost:3001/api/turno-templates \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Turno mañana","hora_inicio":"08:00","hora_fin":"14:00","dias_semana":[1,2,3,4,5]}'
echo

echo "--- crear plantilla duplicada (esperado 409) ---"
curl -s -w " [%{http_code}]" -X POST http://localhost:3001/api/turno-templates \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Turno mañana","hora_inicio":"09:00","hora_fin":"15:00"}'
echo

echo "--- cumplimiento (rango del mes) ---"
curl -s "http://localhost:3001/api/turnos/cumplimiento" -H "Authorization: Bearer $TOKEN"
echo
```

Esperado: tolerancia default `{"tolerancia_min":30}`; crear franja da `[200]` con `{"ok":true}`; listar horarios devuelve un array con la franja creada (`dia_semana:1`, `hora_inicio:"08:00"`); crear plantilla da `[200]`; la plantilla duplicada da `[409]` con `{"error":"Ya existe una plantilla con ese nombre"}`; cumplimiento devuelve `200` con un array (vacío si no hay marcaciones de asistencia todavía — no es un error).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/turnos.ts server/src/routes/turnos.ts server/src/index.ts
git commit -m "feat(server): rutas de turnos y cálculo de cumplimiento"
```

---

## Task 4: Funciones de `web/src/lib/api.ts` + `web/src/pages/turnos/hooks.ts`

**Files:**
- Modify: `web/src/lib/api.ts`
- Create: `web/src/pages/turnos/hooks.ts`

**Interfaces:**
- Consumes: `request<T>` (`web/src/lib/api.ts`, ya existe — helper interno que agrega el `Authorization: Bearer` y tira `ApiError` si `!res.ok`); las 11 rutas de la Task 3.
- Produces: `HorarioEmpleado`, `CrearHorarioInput`, `EditarHorarioInput`, `AsignarHorariosInput`, `TurnoTemplate`, `CrearTurnoTemplateInput`, `CumplimientoRow` (tipos); `getHorarios`, `createHorario`, `updateHorario`, `deleteHorario`, `asignarHorarios`, `getTurnoTemplates`, `createTurnoTemplate`, `deleteTurnoTemplate`, `getTolerancia`, `setTolerancia`, `getCumplimiento` (funciones en `api.ts`); `useHorarios`, `useCrearHorario`, `useEditarHorario`, `useBorrarHorario`, `useAsignarHorarios`, `useTurnoTemplates`, `useCrearPlantilla`, `useBorrarPlantilla`, `useTolerancia`, `useGuardarTolerancia`, `useCumplimiento` (hooks) — consumidos por `HorariosTab`/`CumplimientoTab` (Tasks 5 y 6).

- [ ] **Step 1: Agregar al final de `web/src/lib/api.ts`**

```ts
export interface HorarioEmpleado {
  id: string;
  empleado_id: string;
  sucursal_id: string | null;
  sucursal_nombre: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  tolerancia_min: number | null;
}

export function getHorarios(empleadoId: string): Promise<HorarioEmpleado[]> {
  return request(`/api/horarios?empleadoId=${empleadoId}`);
}

export interface CrearHorarioInput {
  empleado_id: string;
  sucursal_id?: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  tolerancia_min?: number | null;
}

export function createHorario(input: CrearHorarioInput): Promise<{ ok: true }> {
  return request("/api/horarios", { method: "POST", body: JSON.stringify(input) });
}

export interface EditarHorarioInput {
  sucursal_id?: string | null;
  dia_semana?: number;
  hora_inicio?: string;
  hora_fin?: string;
  tolerancia_min?: number | null;
}

export function updateHorario(id: string, patch: EditarHorarioInput): Promise<{ ok: true }> {
  return request(`/api/horarios/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteHorario(id: string): Promise<{ ok: true }> {
  return request(`/api/horarios/${id}`, { method: "DELETE" });
}

export interface AsignarHorariosInput {
  empleado_ids: string[];
  dias_semana: number[];
  hora_inicio: string;
  hora_fin: string;
  tolerancia_min?: number | null;
}

export function asignarHorarios(input: AsignarHorariosInput): Promise<{ ok: true }> {
  return request("/api/horarios/bulk", { method: "POST", body: JSON.stringify(input) });
}

export interface TurnoTemplate {
  id: string;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  dias_semana: number[];
  tolerancia_min: number | null;
}

export function getTurnoTemplates(): Promise<TurnoTemplate[]> {
  return request("/api/turno-templates");
}

export interface CrearTurnoTemplateInput {
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  dias_semana: number[];
  tolerancia_min?: number | null;
}

export function createTurnoTemplate(input: CrearTurnoTemplateInput): Promise<{ ok: true }> {
  return request("/api/turno-templates", { method: "POST", body: JSON.stringify(input) });
}

export function deleteTurnoTemplate(id: string): Promise<{ ok: true }> {
  return request(`/api/turno-templates/${id}`, { method: "DELETE" });
}

export function getTolerancia(): Promise<{ tolerancia_min: number }> {
  return request("/api/turnos/tolerancia");
}

export function setTolerancia(tolerancia_min: number): Promise<{ ok: true }> {
  return request("/api/turnos/tolerancia", { method: "PATCH", body: JSON.stringify({ tolerancia_min }) });
}

export interface CumplimientoRow {
  empleado_id: string;
  nombre: string;
  sucursal_nombre: string;
  fecha: string;
  entrada_real: string;
  entrada_esperada: string | null;
  diff_entrada_min: number | null;
  salida_real: string | null;
  salida_esperada: string | null;
  diff_salida_min: number | null;
  en_curso: boolean;
  estado: "a_horario" | "tarde" | "salida_anticipada" | "tarde_y_anticipada" | "sin_horario";
  tolerancia_aplicada: number | null;
}

export function getCumplimiento(filters: {
  desde: string;
  hasta: string;
  sucursalId?: string;
  empleadoId?: string;
}): Promise<CumplimientoRow[]> {
  const params = new URLSearchParams({ desde: filters.desde, hasta: filters.hasta });
  if (filters.sucursalId) params.set("sucursalId", filters.sucursalId);
  if (filters.empleadoId) params.set("empleadoId", filters.empleadoId);
  return request(`/api/turnos/cumplimiento?${params}`);
}
```

- [ ] **Step 2: Crear `web/src/pages/turnos/hooks.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getHorarios,
  createHorario,
  updateHorario,
  deleteHorario,
  asignarHorarios,
  getTurnoTemplates,
  createTurnoTemplate,
  deleteTurnoTemplate,
  getTolerancia,
  setTolerancia,
  getCumplimiento,
  type CrearHorarioInput,
  type EditarHorarioInput,
  type AsignarHorariosInput,
  type CrearTurnoTemplateInput,
} from "../../lib/api";

export function useHorarios(empleadoId: string) {
  return useQuery({
    queryKey: ["horarios", empleadoId],
    queryFn: () => getHorarios(empleadoId),
    enabled: !!empleadoId,
  });
}

export function useCrearHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearHorarioInput) => createHorario(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["horarios"] }),
  });
}

export function useEditarHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarHorarioInput }) => updateHorario(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["horarios"] }),
  });
}

export function useBorrarHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHorario(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["horarios"] }),
  });
}

export function useAsignarHorarios() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AsignarHorariosInput) => asignarHorarios(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["horarios"] }),
  });
}

export function useTurnoTemplates() {
  return useQuery({ queryKey: ["turno-templates"], queryFn: getTurnoTemplates });
}

export function useCrearPlantilla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearTurnoTemplateInput) => createTurnoTemplate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["turno-templates"] }),
  });
}

export function useBorrarPlantilla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTurnoTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["turno-templates"] }),
  });
}

export function useTolerancia() {
  return useQuery({ queryKey: ["tolerancia"], queryFn: getTolerancia });
}

export function useGuardarTolerancia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (min: number) => setTolerancia(min),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tolerancia"] });
      queryClient.invalidateQueries({ queryKey: ["cumplimiento"] });
    },
  });
}

export function useCumplimiento(filters: { desde: string; hasta: string; sucursalId?: string; empleadoId?: string }) {
  return useQuery({
    queryKey: ["cumplimiento", filters],
    queryFn: () => getCumplimiento(filters),
  });
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web && npm run build
```

Esperado: sin errores. Sin páginas todavía que usen estas funciones/hooks (se conectan en las Tasks 5 y 6) — `tsc -b` igual las tipa porque están exportadas.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/api.ts web/src/pages/turnos/hooks.ts
git commit -m "feat(web): funciones de API y hooks de turnos"
```

---

## Task 5: `HorariosTab` (franjas por empleado, plantillas, asignación masiva)

**Files:**
- Create: `web/src/pages/turnos/HorariosTab.tsx`

**Interfaces:**
- Consumes: `useEmpleados` (`web/src/pages/empleados/hooks.ts`, ya existe, devuelve `Empleado[]` con `{id, nombre, ...}`); `useSucursales` (`web/src/pages/sucursales/hooks.ts`, ya existe, devuelve `Sucursal[]` con `{id, nombre, ...}`); `useHorarios`, `useCrearHorario`, `useEditarHorario`, `useBorrarHorario`, `useAsignarHorarios`, `useTurnoTemplates`, `useCrearPlantilla`, `useBorrarPlantilla` (Task 4); `Button`, `Field`, `Select`, `Card`, `Dialog`, `IconButton`, `Table*` (`web/src/components/ui/*`, ya existen).
- Produces: `HorariosTab` (default export) — consumido por `TurnosPage` (Task 6).

- [ ] **Step 1: Crear `web/src/pages/turnos/HorariosTab.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { IconButton } from "../../components/ui/icon-button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { HorarioEmpleado } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import {
  useHorarios,
  useCrearHorario,
  useEditarHorario,
  useBorrarHorario,
  useAsignarHorarios,
  useTurnoTemplates,
  useCrearPlantilla,
  useBorrarPlantilla,
} from "./hooks";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

const emptyForm = { dia_semana: 1, sucursal_id: "", hora_inicio: "08:00", hora_fin: "14:00", tolerancia_min: "" };
const emptyPlantillaForm = { nombre: "", hora_inicio: "08:00", hora_fin: "14:00", dias_semana: [] as number[], tolerancia_min: "" };

function ordenarHorarios(horarios: HorarioEmpleado[]): HorarioEmpleado[] {
  return [...horarios].sort(
    (a, b) => ORDEN_DIAS.indexOf(a.dia_semana) - ORDEN_DIAS.indexOf(b.dia_semana) || a.hora_inicio.localeCompare(b.hora_inicio)
  );
}

function DiaToggle({ dias, onToggle }: { dias: number[]; onToggle: (d: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ORDEN_DIAS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onToggle(d)}
          className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
            dias.includes(d) ? "border-accent bg-accent-100 text-accent-800" : "border-border text-text-secondary hover:bg-black/[.03]"
          }`}
        >
          {DIAS[d].slice(0, 3)}
        </button>
      ))}
    </div>
  );
}

export default function HorariosTab() {
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursales = [] } = useSucursales();
  const { data: templates = [] } = useTurnoTemplates();

  const [empleadoIdManual, setEmpleadoIdManual] = useState("");
  const empleadoId = empleadoIdManual || empleados[0]?.id || "";

  const { data: horarios = [], isLoading } = useHorarios(empleadoId);
  const crearHorario = useCrearHorario();
  const editarHorario = useEditarHorario();
  const borrarHorario = useBorrarHorario();
  const asignar = useAsignarHorarios();
  const crearPlantilla = useCrearPlantilla();
  const borrarPlantilla = useBorrarPlantilla();

  const [altaOpen, setAltaOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const [plantillaOpen, setPlantillaOpen] = useState(false);
  const [plantillaForm, setPlantillaForm] = useState(emptyPlantillaForm);
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null);

  const [asignEmpleados, setAsignEmpleados] = useState<string[]>([]);
  const [asignDias, setAsignDias] = useState<number[]>([]);
  const [asignHoraInicio, setAsignHoraInicio] = useState("08:00");
  const [asignHoraFin, setAsignHoraFin] = useState("14:00");
  const [asignTolerancia, setAsignTolerancia] = useState("");
  const [asignOk, setAsignOk] = useState<string | null>(null);
  const [errorAsign, setErrorAsign] = useState<string | null>(null);

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crearHorario.mutateAsync({
        empleado_id: empleadoId,
        sucursal_id: form.sucursal_id || null,
        dia_semana: form.dia_semana,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        tolerancia_min: form.tolerancia_min ? Number(form.tolerancia_min) : null,
      });
      setForm(emptyForm);
      setAltaOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  function startEdit(h: HorarioEmpleado) {
    setEditandoId(h.id);
    setEditForm({
      dia_semana: h.dia_semana,
      sucursal_id: h.sucursal_id ?? "",
      hora_inicio: h.hora_inicio,
      hora_fin: h.hora_fin,
      tolerancia_min: h.tolerancia_min?.toString() ?? "",
    });
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editarHorario.mutateAsync({
        id,
        patch: {
          sucursal_id: editForm.sucursal_id || null,
          dia_semana: editForm.dia_semana,
          hora_inicio: editForm.hora_inicio,
          hora_fin: editForm.hora_fin,
          tolerancia_min: editForm.tolerancia_min ? Number(editForm.tolerancia_min) : null,
        },
      });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleBorrar(id: string) {
    if (!confirm("¿Borrar esta franja horaria?")) return;
    await borrarHorario.mutateAsync(id);
  }

  async function handleCrearPlantilla(e: FormEvent) {
    e.preventDefault();
    setErrorPlantilla(null);
    try {
      await crearPlantilla.mutateAsync({
        nombre: plantillaForm.nombre,
        hora_inicio: plantillaForm.hora_inicio,
        hora_fin: plantillaForm.hora_fin,
        dias_semana: plantillaForm.dias_semana,
        tolerancia_min: plantillaForm.tolerancia_min ? Number(plantillaForm.tolerancia_min) : null,
      });
      setPlantillaForm(emptyPlantillaForm);
      setPlantillaOpen(false);
    } catch (err) {
      setErrorPlantilla(err instanceof Error ? err.message : "No se pudo crear la plantilla.");
    }
  }

  async function handleBorrarPlantilla(id: string) {
    if (!confirm("¿Borrar esta plantilla?")) return;
    await borrarPlantilla.mutateAsync(id);
  }

  function elegirTemplate(templateId: string) {
    const t = templates.find((t) => t.id === templateId);
    if (!t) return;
    setAsignHoraInicio(t.hora_inicio);
    setAsignHoraFin(t.hora_fin);
    if (t.dias_semana.length > 0) setAsignDias(t.dias_semana);
    if (t.tolerancia_min !== null) setAsignTolerancia(t.tolerancia_min.toString());
  }

  function toggleAsignEmpleado(id: string) {
    setAsignEmpleados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleAsignar() {
    setErrorAsign(null);
    setAsignOk(null);
    if (asignEmpleados.length === 0 || asignDias.length === 0) {
      setErrorAsign("Elegí al menos un empleado y un día.");
      return;
    }
    try {
      await asignar.mutateAsync({
        empleado_ids: asignEmpleados,
        dias_semana: asignDias,
        hora_inicio: asignHoraInicio,
        hora_fin: asignHoraFin,
        tolerancia_min: asignTolerancia ? Number(asignTolerancia) : null,
      });
      setAsignOk(`Turno asignado a ${asignEmpleados.length} empleado(s).`);
      setAsignEmpleados([]);
      setAsignDias([]);
    } catch (err) {
      setErrorAsign(err instanceof Error ? err.message : "No se pudo asignar el turno.");
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Select
          label="Empleado"
          value={empleadoId}
          onChange={(e) => setEmpleadoIdManual(e.target.value)}
          options={empleados.map((e) => ({ value: e.id, label: e.nombre }))}
          containerClassName="w-64"
        />
        <Button variant="primary" className="ml-auto" onClick={() => setAltaOpen(true)} disabled={!empleadoId}>
          <Plus className="h-4 w-4" />
          Nueva franja
        </Button>
      </div>

      {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Día</TableHead>
            <TableHead>Horario</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Tolerancia</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={5} />}
          {!isLoading &&
            ordenarHorarios(horarios).map((h) =>
              editandoId === h.id ? (
                <TableRow key={h.id}>
                  <TableCell>
                    <Select
                      label="Día"
                      value={editForm.dia_semana.toString()}
                      onChange={(e) => setEditForm({ ...editForm, dia_semana: Number(e.target.value) })}
                      options={ORDEN_DIAS.map((d) => ({ value: d.toString(), label: DIAS[d] }))}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Field label="Inicio" type="time" value={editForm.hora_inicio} onChange={(e) => setEditForm({ ...editForm, hora_inicio: e.target.value })} containerClassName="w-24" />
                      <Field label="Fin" type="time" value={editForm.hora_fin} onChange={(e) => setEditForm({ ...editForm, hora_fin: e.target.value })} containerClassName="w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      label="Sucursal"
                      value={editForm.sucursal_id}
                      onChange={(e) => setEditForm({ ...editForm, sucursal_id: e.target.value })}
                      options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
                    />
                  </TableCell>
                  <TableCell>
                    <Field label="Min." type="number" value={editForm.tolerancia_min} onChange={(e) => setEditForm({ ...editForm, tolerancia_min: e.target.value })} containerClassName="w-20" />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" onClick={() => handleGuardarEdicion(h.id)}>Guardar</Button>
                      <Button variant="ghost" onClick={() => setEditandoId(null)}>Cancelar</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={h.id}>
                  <TableCell>{DIAS[h.dia_semana]}</TableCell>
                  <TableCell>{h.hora_inicio}–{h.hora_fin}</TableCell>
                  <TableCell>{h.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>{h.tolerancia_min ?? "General"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <IconButton onClick={() => startEdit(h)} icon={<Pencil className="h-3.5 w-3.5" />} label="Editar" />
                      <IconButton onClick={() => handleBorrar(h.id)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Borrar" />
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          {!isLoading && horarios.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">Sin franjas cargadas para este empleado.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-extrabold text-text">Plantillas</h2>
          <Button variant="secondary" onClick={() => setPlantillaOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </Button>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg border border-border-soft px-3 py-2 text-[14px]">
              <span>
                <strong className="font-semibold">{t.nombre}</strong> — {t.hora_inicio}–{t.hora_fin}
                {t.dias_semana.length > 0 && ` (${t.dias_semana.map((d) => DIAS[d].slice(0, 3)).join(", ")})`}
              </span>
              <IconButton onClick={() => handleBorrarPlantilla(t.id)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Borrar plantilla" />
            </li>
          ))}
          {templates.length === 0 && <p className="text-[14px] text-text/60">Todavía no hay plantillas.</p>}
        </ul>
      </Card>

      <Card className="mt-6">
        <h2 className="text-[18px] font-extrabold text-text">Asignar turno</h2>
        <p className="mt-1 text-[13.5px] text-text/60">Asigná el mismo horario a varios empleados y días de una vez.</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {empleados.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => toggleAsignEmpleado(e.id)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                asignEmpleados.includes(e.id) ? "border-accent bg-accent-100 text-accent-800" : "border-border text-text-secondary hover:bg-black/[.03]"
              }`}
            >
              {e.nombre}
            </button>
          ))}
        </div>

        <Select
          label="Plantilla (opcional)"
          value=""
          onChange={(e) => elegirTemplate(e.target.value)}
          options={[{ value: "", label: "Sin plantilla" }, ...templates.map((t) => ({ value: t.id, label: t.nombre }))]}
          containerClassName="mt-3 w-64"
        />

        <div className="mt-3">
          <DiaToggle dias={asignDias} onToggle={(d) => setAsignDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))} />
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Hora inicio" type="time" value={asignHoraInicio} onChange={(e) => setAsignHoraInicio(e.target.value)} containerClassName="w-32" />
          <Field label="Hora fin" type="time" value={asignHoraFin} onChange={(e) => setAsignHoraFin(e.target.value)} containerClassName="w-32" />
          <Field label="Tolerancia (min, opcional)" type="number" value={asignTolerancia} onChange={(e) => setAsignTolerancia(e.target.value)} containerClassName="w-44" />
          <Button variant="primary" onClick={handleAsignar} disabled={asignar.isPending}>
            Asignar
          </Button>
        </div>

        {errorAsign && <p className="mt-2 text-[15px] text-accent-700">{errorAsign}</p>}
        {asignOk && <p className="mt-2 text-[15px] text-text">{asignOk}</p>}
      </Card>

      <Dialog open={altaOpen} onClose={() => { setAltaOpen(false); setError(null); }} title="Nueva franja horaria">
        <form onSubmit={handleAlta} className="flex flex-col gap-3">
          <Select
            label="Día"
            value={form.dia_semana.toString()}
            onChange={(e) => setForm({ ...form, dia_semana: Number(e.target.value) })}
            options={ORDEN_DIAS.map((d) => ({ value: d.toString(), label: DIAS[d] }))}
          />
          <div className="flex gap-3">
            <Field label="Hora inicio" type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} containerClassName="w-full" />
            <Field label="Hora fin" type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} containerClassName="w-full" />
          </div>
          <Select
            label="Sucursal (opcional)"
            value={form.sucursal_id}
            onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
            options={[{ value: "", label: "Sin especificar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          />
          <Field label="Tolerancia en minutos (opcional)" type="number" value={form.tolerancia_min} onChange={(e) => setForm({ ...form, tolerancia_min: e.target.value })} containerClassName="w-full" />
          {error && <p className="text-[15px] text-accent-700">{error}</p>}
          <Button type="submit" variant="primary" block disabled={crearHorario.isPending}>
            Agregar
          </Button>
        </form>
      </Dialog>

      <Dialog open={plantillaOpen} onClose={() => { setPlantillaOpen(false); setErrorPlantilla(null); }} title="Nueva plantilla">
        <form onSubmit={handleCrearPlantilla} className="flex flex-col gap-3">
          <Field label="Nombre" required value={plantillaForm.nombre} onChange={(e) => setPlantillaForm({ ...plantillaForm, nombre: e.target.value })} containerClassName="w-full" />
          <div className="flex gap-3">
            <Field label="Hora inicio" type="time" value={plantillaForm.hora_inicio} onChange={(e) => setPlantillaForm({ ...plantillaForm, hora_inicio: e.target.value })} containerClassName="w-full" />
            <Field label="Hora fin" type="time" value={plantillaForm.hora_fin} onChange={(e) => setPlantillaForm({ ...plantillaForm, hora_fin: e.target.value })} containerClassName="w-full" />
          </div>
          <DiaToggle
            dias={plantillaForm.dias_semana}
            onToggle={(d) =>
              setPlantillaForm((prev) => ({
                ...prev,
                dias_semana: prev.dias_semana.includes(d) ? prev.dias_semana.filter((x) => x !== d) : [...prev.dias_semana, d],
              }))
            }
          />
          <Field label="Tolerancia en minutos (opcional)" type="number" value={plantillaForm.tolerancia_min} onChange={(e) => setPlantillaForm({ ...plantillaForm, tolerancia_min: e.target.value })} containerClassName="w-full" />
          {errorPlantilla && <p className="text-[15px] text-accent-700">{errorPlantilla}</p>}
          <Button type="submit" variant="primary" block disabled={crearPlantilla.isPending}>
            Crear plantilla
          </Button>
        </form>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web && npm run build
```

Esperado: sin errores. Sin ruta todavía (se conecta en la Task 6).

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/turnos/HorariosTab.tsx
git commit -m "feat(web): HorariosTab (franjas, plantillas, asignación masiva)"
```

---

## Task 6: `CumplimientoTab` + `TurnosPage` + ruta `/turnos` + nav

**Files:**
- Create: `web/src/pages/turnos/CumplimientoTab.tsx`
- Create: `web/src/pages/turnos/TurnosPage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/PanelNav.tsx`

**Interfaces:**
- Consumes: `useCumplimiento`, `useTolerancia`, `useGuardarTolerancia` (Task 4); `useSucursales`, `useEmpleados` (ya existen); `HorariosTab` (Task 5); `Status`, `StatusProps` (`web/src/components/ui/status.tsx`, ya existe).
- Produces: `TurnosPage` (default export) — consumido por `App.tsx`.

- [ ] **Step 1: Crear `web/src/pages/turnos/CumplimientoTab.tsx`**

```tsx
import { useState } from "react";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Status, type StatusProps } from "../../components/ui/status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { CumplimientoRow } from "../../lib/api";
import { useSucursales } from "../sucursales/hooks";
import { useEmpleados } from "../empleados/hooks";
import { useCumplimiento, useTolerancia, useGuardarTolerancia } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: AR_TZ, hour: "2-digit", minute: "2-digit" });
}

function diffLabel(min: number | null): string {
  if (min === null) return "—";
  if (min <= 0) return "a tiempo";
  return `+${min} min`;
}

const ESTADO_INFO: Record<CumplimientoRow["estado"], { label: string; tone: StatusProps["tone"] }> = {
  a_horario: { label: "A horario", tone: "success" },
  tarde: { label: "Tarde", tone: "warning" },
  salida_anticipada: { label: "Salida anticipada", tone: "warning" },
  tarde_y_anticipada: { label: "Tarde y salida anticipada", tone: "warning" },
  sin_horario: { label: "Sin horario definido", tone: "neutral" },
};

export default function CumplimientoTab() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [sucursalId, setSucursalId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [toleranciaInput, setToleranciaInput] = useState("");
  const [guardadoOk, setGuardadoOk] = useState(false);

  const { data: sucursales = [] } = useSucursales();
  const { data: empleados = [] } = useEmpleados();
  const { data: filas = [], isLoading } = useCumplimiento({
    desde,
    hasta,
    sucursalId: sucursalId || undefined,
    empleadoId: empleadoId || undefined,
  });
  const { data: toleranciaData } = useTolerancia();
  const guardarTolerancia = useGuardarTolerancia();

  const toleranciaActual = toleranciaInput || toleranciaData?.tolerancia_min?.toString() || "";

  async function handleGuardarTolerancia() {
    setGuardadoOk(false);
    await guardarTolerancia.mutateAsync(Number(toleranciaActual));
    setGuardadoOk(true);
  }

  return (
    <>
      <Card className="mt-4">
        <h2 className="text-[16px] font-extrabold text-text">Tolerancia general</h2>
        <p className="mt-1 text-[13.5px] text-text/60">
          Minutos de margen antes de marcar un turno como "tarde" o "salida anticipada" — aplica salvo que la franja tenga su propia tolerancia.
        </p>
        <div className="mt-3 flex items-end gap-3">
          <Field label="Minutos" type="number" value={toleranciaActual} onChange={(e) => { setToleranciaInput(e.target.value); setGuardadoOk(false); }} containerClassName="w-32" />
          <Button variant="secondary" onClick={handleGuardarTolerancia} disabled={guardarTolerancia.isPending}>
            Guardar
          </Button>
          {guardadoOk && <span className="text-[13.5px] text-text/60">Guardado.</span>}
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Field label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-40" />
        <Field label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-40" />
        <Select
          label="Sucursal"
          value={sucursalId}
          onChange={(e) => setSucursalId(e.target.value)}
          options={[{ value: "", label: "Todas" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-48"
        />
        <Select
          label="Empleado"
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
          options={[{ value: "", label: "Todos" }, ...empleados.map((e) => ({ value: e.id, label: e.nombre }))]}
          containerClassName="w-48"
        />
      </div>

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Salida</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            filas.map((f, i) => (
              <TableRow key={i}>
                <TableCell>{f.nombre}</TableCell>
                <TableCell>{f.sucursal_nombre}</TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell>
                  {horaLocal(f.entrada_real)}
                  {f.entrada_esperada && <span className="text-text/55"> (esperado {f.entrada_esperada}, {diffLabel(f.diff_entrada_min)})</span>}
                </TableCell>
                <TableCell>
                  {f.en_curso ? "En curso" : f.salida_real ? horaLocal(f.salida_real) : "—"}
                  {f.salida_esperada && f.salida_real && <span className="text-text/55"> (esperado {f.salida_esperada}, {diffLabel(f.diff_salida_min)})</span>}
                </TableCell>
                <TableCell>
                  <Status tone={ESTADO_INFO[f.estado].tone}>{ESTADO_INFO[f.estado].label}</Status>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && filas.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">Sin turnos en este rango.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
```

- [ ] **Step 2: Crear `web/src/pages/turnos/TurnosPage.tsx`**

```tsx
import { useState } from "react";
import { Button } from "../../components/ui/button";
import HorariosTab from "./HorariosTab";
import CumplimientoTab from "./CumplimientoTab";

type Tab = "horarios" | "cumplimiento";

export default function TurnosPage() {
  const [tab, setTab] = useState<Tab>("horarios");

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Turnos</h1>

      <div className="mt-4 flex gap-2">
        <Button variant={tab === "horarios" ? "primary" : "secondary"} onClick={() => setTab("horarios")}>
          Horarios
        </Button>
        <Button variant={tab === "cumplimiento" ? "primary" : "secondary"} onClick={() => setTab("cumplimiento")}>
          Cumplimiento
        </Button>
      </div>

      {tab === "horarios" ? <HorariosTab /> : <CumplimientoTab />}
    </>
  );
}
```

- [ ] **Step 3: Agregar la ruta en `web/src/App.tsx`**

Agregar el import `import TurnosPage from "./pages/turnos/TurnosPage";` junto a los demás, y este bloque de `<Route>` después del de `/horas` y antes del de `/admin`:

```tsx
            <Route
              path="/turnos"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <TurnosPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 4: Agregar el link en `web/src/components/PanelNav.tsx`**

En el array `LINKS`, agregar `{ href: "/turnos", label: "Turnos" }` después de `{ href: "/horas", label: "Horas" }`.

- [ ] **Step 5: Verificar que compila**

```bash
cd web && npm run build
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/turnos/CumplimientoTab.tsx web/src/pages/turnos/TurnosPage.tsx web/src/App.tsx web/src/components/PanelNav.tsx
git commit -m "feat(web): TurnosPage (tab Cumplimiento) + ruta y nav"
```

---

## Task 7: Verificación E2E

**Files:** ninguno — es la tarea de cierre, sin cambios de código.

**Interfaces:** ninguna.

- [ ] **Step 1: Confirmar que `server/` y `web/` corren**

```bash
curl -s http://localhost:3001/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

Si alguno no responde, levantarlo (`npm run dev` en `server/` y en `web/`, o `npm run dev:all` desde la raíz).

- [ ] **Step 2: Checklist manual (para el usuario en el navegador)**

1. Entrar a `http://localhost:5173/turnos` logueado (`demo@test.local`) — confirmar que el link "Turnos" aparece en el nav junto a los demás, y que la página abre en el tab "Horarios".
2. Elegir un empleado, agregar una franja horaria nueva (día + horario) con el botón "Nueva franja" — confirmar que aparece en la tabla sin recargar la página.
3. Editar esa franja desde la fila (ícono lápiz) y guardar — confirmar que el cambio se refleja.
4. Borrar la franja (ícono tacho) — confirmar que desaparece de la tabla.
5. Crear una plantilla nueva desde "Nueva plantilla" — confirmar que aparece en la lista de Plantillas.
6. Usar "Asignar turno": elegir 2+ empleados, elegir la plantilla creada (precompleta horario/días), tocar "Asignar" — confirmar el mensaje de éxito y que las franjas nuevas aparecen si se vuelve a esos empleados en el selector de arriba.
7. Pasar al tab "Cumplimiento" — confirmar que carga (vacío está bien si no hay marcaciones de asistencia en el rango).
8. Si hay datos de asistencia cargados para un empleado con horario asignado (marcar entrada/salida desde `/marcar` como en el flujo de la sección "Probar el marcado de asistencia" del README, con un horario ya asignado a ese empleado en `/turnos`), confirmar que la fila de Cumplimiento muestra el estado correcto (a horario / tarde / etc.) según la hora real vs. la esperada.
9. Cambiar la "Tolerancia general" y guardar — confirmar que persiste al recargar la página.
10. Confirmar que el resto del panel (`/`, `/sucursales`, `/empleados`, `/asistencia`, `/horas`) sigue funcionando sin cambios.

Esperar la confirmación explícita del usuario antes de dar la etapa por cerrada.
