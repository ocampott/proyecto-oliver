# Dashboard "Pulso operativo del día" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "pulso operativo del día" section above the module menu on `/` (Inicio), showing who's currently clocked in (live, via Supabase Realtime), who forgot to clock out, today's pending absences/certificates, and quick employee/sucursal counts.

**Architecture:** Frontend-only feature (`proyecto-oliver`) plus one Supabase migration (`proyecto-oliver-api`) enabling Realtime replication on the `asistencia` table. No new backend endpoints or code — the widgets compose existing REST hooks (`useAsistencia`, `useHoras`, `useAusencias`, `useEmpleados`, `useSucursales`) and one new client-side Supabase Realtime subscription on top of the already-authenticated `supabase` client. RLS (already scoped by `org_id`) is the only authorization boundary for the realtime channel.

**Tech Stack:** React + TypeScript + TanStack Query (frontend), `@supabase/supabase-js` Realtime channels, Express/Supabase (backend, migration only).

**Spec:** `docs/superpowers/specs/2026-08-21-dashboard-pulso-operativo-design.md`

## Global Constraints

- No new backend endpoints or backend code changes — only a SQL migration.
- Reuse existing data hooks (`useAsistencia`, `useHoras`, `useAusencias`, `useEmpleados`, `useSucursales`) unmodified; do not touch their files.
- The whole dashboard section is gated by `tieneRol(org, ["owner", "admin"])` (same `soloGestion` gate already used for Horas/Turnos/RRHH cards in `HomePage.tsx`) — not shown to `agent`.
- Neither repo has an automated test suite (`proyecto-oliver-api`'s `npm test` is `echo "Sin tests automatizados"`; `proyecto-oliver` has no test script at all — only `lint`/`build`/`dev`/`preview`). Per this codebase's existing convention, verification is: `tsc`/typecheck passing + manual verification in the browser (dev server), not new unit tests. Every task below follows that pattern instead of a TDD red/green cycle.
- Do not run `npm run build` / `vite build` concurrently with other agents in the same working tree if this plan is executed with subagent-driven-development and other unrelated work is in flight — coordinate as this repo's existing convention (see prior session) does.

---

### Task 1: Enable Supabase Realtime on `asistencia`

**Files:**
- Create: `proyecto-oliver-api/supabase/migrations/0010_asistencia_realtime.sql`

**Interfaces:**
- Produces: the `asistencia` table becomes a member of the `supabase_realtime` publication, so `postgres_changes` subscriptions on it start receiving events. No code-level interface — this is purely a DB-level capability that Task 3 depends on.

- [ ] **Step 1: Write the migration**

```sql
-- 0010_asistencia_realtime.sql
alter publication supabase_realtime add table asistencia;
```

- [ ] **Step 2: Apply it**

Run (from `proyecto-oliver-api`): `supabase db push`

Expected: migration `0010_asistencia_realtime.sql` applied with no errors. (The Supabase CLI is already authorized for this project — apply directly, no need to ask the user to use the Dashboard.)

- [ ] **Step 3: Verify**

Run: `supabase db push` again (idempotency check) — expected: no pending migrations reported, confirming it applied cleanly the first time.

- [ ] **Step 4: Commit**

```bash
cd /Users/tomasocampo/Documents/personal/proyecto-oliver-api
git add supabase/migrations/0010_asistencia_realtime.sql
git commit -m "feat: habilitar Supabase Realtime en la tabla asistencia"
```

---

### Task 2: `useAsistenciaEnVivo` — live "who's checked in" hook

**Files:**
- Create: `src/components/dashboard/useAsistenciaEnVivo.ts`

**Interfaces:**
- Consumes: `useAsistencia(desde, hasta)` from `src/pages/asistencia/hooks.ts` (returns `{ data, isLoading, isError }` where `data: AsistenciaRegistro[]`, each with `{ id, empleado_id, sucursal_id, tipo: "entrada" | "salida", created_at, empleado_nombre: string | null, sucursal_nombre: string | null }` — `src/lib/api.ts:304-315`). Consumes `supabase` client from `src/lib/supabase.ts`. Consumes `org.id` (caller passes it in).
- Produces: `useAsistenciaEnVivo(orgId: string)` returning `{ isLoading: boolean; isError: boolean; porSucursal: Array<{ sucursalId: string; sucursalNombre: string; empleados: Array<{ empleadoId: string; empleadoNombre: string; desde: string }> }>; conectado: boolean }` — consumed by Task 5.

- [ ] **Step 1: Write the hook**

```typescript
// src/components/dashboard/useAsistenciaEnVivo.ts
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAsistencia } from "../../pages/asistencia/hooks";
import { supabase } from "../../lib/supabase";
import type { AsistenciaRegistro } from "../../lib/api";

function hoyAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

interface EmpleadoAdentro {
  empleadoId: string;
  empleadoNombre: string;
  desde: string;
}

interface SucursalGrupo {
  sucursalId: string;
  sucursalNombre: string;
  empleados: EmpleadoAdentro[];
}

function derivarAdentro(registros: AsistenciaRegistro[]): SucursalGrupo[] {
  const ultimoPorEmpleado = new Map<string, AsistenciaRegistro>();
  const ordenados = [...registros].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const r of ordenados) {
    ultimoPorEmpleado.set(r.empleado_id, r);
  }

  const porSucursal = new Map<string, SucursalGrupo>();
  for (const r of ultimoPorEmpleado.values()) {
    if (r.tipo !== "entrada") continue;
    const grupo = porSucursal.get(r.sucursal_id) ?? {
      sucursalId: r.sucursal_id,
      sucursalNombre: r.sucursal_nombre ?? "Sin sucursal",
      empleados: [],
    };
    grupo.empleados.push({
      empleadoId: r.empleado_id,
      empleadoNombre: r.empleado_nombre ?? "Empleado",
      desde: r.created_at,
    });
    porSucursal.set(r.sucursal_id, grupo);
  }
  return Array.from(porSucursal.values());
}

export function useAsistenciaEnVivo(orgId: string) {
  const hoy = hoyAR();
  const { data, isLoading, isError } = useAsistencia(hoy, hoy);
  const queryClient = useQueryClient();
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`asistencia-org-${orgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "asistencia", filter: `org_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["asistencia", hoy, hoy] });
        }
      )
      .subscribe((status) => setConectado(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, hoy, queryClient]);

  const porSucursal = useMemo(() => derivarAdentro(data ?? []), [data]);

  return { isLoading, isError, porSucursal, conectado };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit` (from `proyecto-oliver`)
Expected: no errors referencing `useAsistenciaEnVivo.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/useAsistenciaEnVivo.ts
git commit -m "feat(dashboard): hook de asistencia en vivo via Supabase Realtime"
```

---

### Task 3: `useOlvidaronSalida` — stale open shifts hook

**Files:**
- Create: `src/components/dashboard/useOlvidaronSalida.ts`

**Interfaces:**
- Consumes: `useHoras(desde, hasta)` from `src/pages/horas/hooks.ts` (returns `{ data, isLoading, isError }` where `data: HorasResponse = { desde, hasta, turnos: Turno[], resumen: ResumenEmpleado[] }`, `Turno = { empleado_id, nombre, sucursal_id, sucursal_nombre, entrada_at, salida_at: string | null, horas: number | null }` — `src/lib/api.ts:355-378`).
- Produces: `useOlvidaronSalida()` returning `{ isLoading: boolean; isError: boolean; turnos: Array<{ empleadoId: string; nombre: string; sucursalNombre: string; entradaAt: string }> }` — consumed by Task 5.

- [ ] **Step 1: Write the hook**

```typescript
// src/components/dashboard/useOlvidaronSalida.ts
import { useMemo } from "react";
import { useHoras } from "../../pages/horas/hooks";

function hoyAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function fechaAR(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function hace7Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function useOlvidaronSalida() {
  const hoy = hoyAR();
  const { data, isLoading, isError } = useHoras(hace7Dias(), hoy);

  const turnos = useMemo(() => {
    const abiertos = (data?.turnos ?? []).filter(
      (t) => t.salida_at === null && fechaAR(t.entrada_at) !== hoy
    );
    return abiertos.map((t) => ({
      empleadoId: t.empleado_id,
      nombre: t.nombre,
      sucursalNombre: t.sucursal_nombre,
      entradaAt: t.entrada_at,
    }));
  }, [data, hoy]);

  return { isLoading, isError, turnos };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `useOlvidaronSalida.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/useOlvidaronSalida.ts
git commit -m "feat(dashboard): hook de turnos abiertos de dias anteriores"
```

---

### Task 4: `useAusenciasHoy` — today's pending absences/certificates hook

**Files:**
- Create: `src/components/dashboard/useAusenciasHoy.ts`

**Interfaces:**
- Consumes: `useAusencias(filters)` from `src/pages/rrhh/hooks.ts` (returns `{ data, isLoading, isError }` where `data: AusenciasResponse = { ausencias: Ausencia[], resumen: ResumenAusencias }`, `Ausencia = { id, empleado_id, empleado_nombre, sucursal_id, sucursal_nombre, fecha_desde, fecha_hasta, motivo, detalle, contacto, certificado_pendiente, created_at }` — `src/lib/api.ts:567-580`).
- Produces: `useAusenciasHoy()` returning `{ isLoading: boolean; isError: boolean; ausencias: Ausencia[] }` — consumed by Task 5.

- [ ] **Step 1: Write the hook**

```typescript
// src/components/dashboard/useAusenciasHoy.ts
import { useAusencias } from "../../pages/rrhh/hooks";

function hoyAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function useAusenciasHoy() {
  const hoy = hoyAR();
  const { data, isLoading, isError } = useAusencias({ desde: hoy, hasta: hoy });
  return { isLoading, isError, ausencias: data?.ausencias ?? [] };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `useAusenciasHoy.ts`. If `useAusencias`'s filter param types don't accept a plain `{ desde, hasta }` object, adjust the call to match the actual signature in `src/pages/rrhh/hooks.ts:13` exactly — do not change that file.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/useAusenciasHoy.ts
git commit -m "feat(dashboard): hook de ausencias/certificados pendientes hoy"
```

---

### Task 5: `PulsoOperativo` component (composes all 4 widgets)

**Files:**
- Create: `src/components/dashboard/PulsoOperativo.tsx`

**Interfaces:**
- Consumes: `useAsistenciaEnVivo(orgId)` (Task 2), `useOlvidaronSalida()` (Task 3), `useAusenciasHoy()` (Task 4), `useEmpleados()` (`src/pages/empleados/hooks.ts`, returns `{ data: Empleado[] }`, `Empleado = { id, nombre, activo, ... }` — `src/lib/api.ts:245-255`), `useSucursales()` (`src/pages/sucursales/hooks.ts`, returns `{ data: Sucursal[] }`, `Sucursal = { id, nombre, activa, ... }` — `src/lib/api.ts:131-142`). UI: `Card` (`src/components/ui/card.tsx`), `Status` (`src/components/ui/status.tsx`, props `{ tone: "success"|"warning"|"neutral"|"accent", children }`).
- Produces: `export function PulsoOperativo({ orgId }: { orgId: string })` — a default-exportable section component. Consumed by Task 6 (`HomePage.tsx`).

- [ ] **Step 1: Write the component**

```tsx
// src/components/dashboard/PulsoOperativo.tsx
import { Card } from "../ui/card";
import { Status } from "../ui/status";
import { useAsistenciaEnVivo } from "./useAsistenciaEnVivo";
import { useOlvidaronSalida } from "./useOlvidaronSalida";
import { useAusenciasHoy } from "./useAusenciasHoy";
import { useEmpleados } from "../../pages/empleados/hooks";
import { useSucursales } from "../../pages/sucursales/hooks";

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function PulsoOperativo({ orgId }: { orgId: string }) {
  const enVivo = useAsistenciaEnVivo(orgId);
  const olvidaron = useOlvidaronSalida();
  const ausenciasHoy = useAusenciasHoy();
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursales = [] } = useSucursales();

  const totalAdentro = enVivo.porSucursal.reduce((acc, g) => acc + g.empleados.length, 0);
  const empleadosActivos = empleados.filter((e) => e.activo).length;
  const sucursalesActivas = sucursales.filter((s) => s.activa).length;

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-text">Adentro ahora</h2>
          <Status tone={enVivo.conectado ? "success" : "neutral"}>
            {enVivo.conectado ? "En vivo" : "Actualizando…"}
          </Status>
        </div>
        {enVivo.isLoading && <p className="mt-3 text-[13px] text-text/60">Cargando…</p>}
        {enVivo.isError && <p className="mt-3 text-[13px] text-alert">No pudimos cargar asistencia.</p>}
        {!enVivo.isLoading && !enVivo.isError && (
          <>
            <p className="mt-2 text-[28px] font-extrabold text-text">{totalAdentro}</p>
            <ul className="mt-3 space-y-2">
              {enVivo.porSucursal.map((g) => (
                <li key={g.sucursalId} className="text-[13px] text-text/80">
                  <span className="font-semibold text-text">{g.sucursalNombre}:</span>{" "}
                  {g.empleados.map((e) => e.empleadoNombre).join(", ")}
                </li>
              ))}
              {enVivo.porSucursal.length === 0 && (
                <li className="text-[13px] text-text/60">Nadie marcado por ahora.</li>
              )}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-[15px] font-bold text-text">Olvidaron marcar salida</h2>
        {olvidaron.isLoading && <p className="mt-3 text-[13px] text-text/60">Cargando…</p>}
        {olvidaron.isError && <p className="mt-3 text-[13px] text-alert">No pudimos cargar horas.</p>}
        {!olvidaron.isLoading && !olvidaron.isError && (
          <ul className="mt-3 space-y-2">
            {olvidaron.turnos.map((t) => (
              <li key={`${t.empleadoId}-${t.entradaAt}`} className="text-[13px] text-text/80">
                <span className="font-semibold text-text">{t.nombre}</span> — {t.sucursalNombre}, entró{" "}
                {fechaLocal(t.entradaAt)} {horaLocal(t.entradaAt)}
              </li>
            ))}
            {olvidaron.turnos.length === 0 && (
              <li className="text-[13px] text-text/60">Ninguno pendiente.</li>
            )}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-[15px] font-bold text-text">Ausencias hoy</h2>
        {ausenciasHoy.isLoading && <p className="mt-3 text-[13px] text-text/60">Cargando…</p>}
        {ausenciasHoy.isError && <p className="mt-3 text-[13px] text-alert">No pudimos cargar RRHH.</p>}
        {!ausenciasHoy.isLoading && !ausenciasHoy.isError && (
          <ul className="mt-3 space-y-2">
            {ausenciasHoy.ausencias.map((a) => (
              <li key={a.id} className="text-[13px] text-text/80">
                <span className="font-semibold text-text">{a.empleado_nombre}</span> — {a.motivo}
                {a.certificado_pendiente && (
                  <Status tone="warning" className="ml-2 inline-flex">
                    Certificado pendiente
                  </Status>
                )}
              </li>
            ))}
            {ausenciasHoy.ausencias.length === 0 && (
              <li className="text-[13px] text-text/60">Sin ausencias hoy.</li>
            )}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-[15px] font-bold text-text">Resumen</h2>
        <div className="mt-3 space-y-2 text-[13px] text-text/80">
          <p>
            <span className="font-semibold text-text">{empleadosActivos}</span> / {empleados.length} empleados
            activos
          </p>
          <p>
            <span className="font-semibold text-text">{sucursalesActivas}</span> / {sucursales.length} sucursales
            activas
          </p>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `PulsoOperativo.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/PulsoOperativo.tsx
git commit -m "feat(dashboard): componente PulsoOperativo con los 4 widgets"
```

---

### Task 6: Wire `PulsoOperativo` into `HomePage.tsx`

**Files:**
- Modify: `src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `PulsoOperativo` (Task 5), `tieneRol` (`src/lib/hooks.ts:26`), the existing `org` from `useOrgActual()` already in scope in this file.

- [ ] **Step 1: Import and render, gated by role**

In `src/pages/HomePage.tsx`, add the import near the other local imports:

```typescript
import { PulsoOperativo } from "../components/dashboard/PulsoOperativo";
```

Then, in the success-path JSX (the `return` block starting with `<h1 className="text-[32px] font-extrabold text-text">{org.name}</h1>`), insert the gated section right after the `<h1>` and before the `<div className="mt-6 grid ...">` tarjetas grid:

```tsx
<h1 className="text-[32px] font-extrabold text-text">{org.name}</h1>
{tieneRol(org, ["owner", "admin"]) && <PulsoOperativo orgId={org.id} />}
<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

(`tieneRol` is already imported in this file per the existing `import { useOrgActual, useEntitlements, tieneModulo, tieneRol } from "../lib/hooks";` line — no new import needed for it.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification in the browser**

1. From `proyecto-oliver-api`: `npm run dev` (port 3020).
2. From `proyecto-oliver`: `npm run dev`.
3. Log in as an owner/admin of an org with existing empleados/sucursales/asistencia data. Confirm the 4 cards render above the module menu with real data (or empty states if no data for today).
4. Log in as (or switch to) an `agent`-role user in the same org and confirm the section does NOT render.
5. From `MarcarPage` (or by calling `POST /marcar/registrar` for a test empleado), register an entrada. Confirm the "Adentro ahora" card updates within a few seconds without a page reload, and the `Status` badge shows "En vivo".
6. Register the matching salida for that empleado and confirm they disappear from the "Adentro ahora" list live.
7. If a second org is available, log in as a member of that other org in a separate session and confirm they do not see the first org's live updates (RLS check).

- [ ] **Step 4: Full build**

Run: `npm run build` (from `proyecto-oliver`)
Expected: builds cleanly, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(dashboard): montar PulsoOperativo en Inicio para owner/admin"
```

---

## Self-Review Notes

- **Spec coverage:** all 4 widgets (adentro ahora, olvidaron salida, ausencias/certificados hoy, contadores), the Realtime mechanism, the migration, the `soloGestion` gating, and the error-per-widget handling from the spec each map to a task above.
- **Placeholder scan:** no TBD/TODO; every step has real code.
- **Type consistency:** `useAsistenciaEnVivo(orgId: string)` return shape (`porSucursal`, `conectado`, `isLoading`, `isError`) matches exactly what `PulsoOperativo.tsx` destructures. Same check passed for `useOlvidaronSalida` (`turnos`) and `useAusenciasHoy` (`ausencias`). `org.id` (Task 6) matches the `orgId: string` param `PulsoOperativo` and `useAsistenciaEnVivo` expect.
