# Migración a Vite — Etapa 4 (Asistencia + Horas + retrofit Modernist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar Asistencia y Horas de Next.js a `web/` + `server/`, y de paso retocar los tokens/componentes compartidos de `web/` al rediseño "Modernist" (acento azul, sin bordes redondeados) — cierra tanto la migración de esas dos pantallas como el plan de rediseño que estaba pendiente.

**Architecture:** `server/` gana dos módulos de rutas (`asistencia.ts`, `horas.ts`) que son wiring puro sobre `server/src/lib/asistencia.ts` (ya porta toda la lógica desde la Etapa 1). `web/` gana las dos pantallas nuevas construidas directo con el sistema de diseño retocado — los tokens de color/radio se actualizan una sola vez en `index.css` + `components/ui/*`, y como todas las pantallas comparten esos mismos componentes, Login/Home/Sucursales/Empleados quedan con el nuevo look sin tocar su lógica.

**Tech Stack:** Sin dependencias nuevas — `@tanstack/react-query` (Etapa 3) y `lucide-react` (ya en `web/package.json`, sin usar todavía) cubren todo lo necesario.

**Spec:** `docs/superpowers/specs/2026-08-18-vite-migration-etapa4-design.md`

## Global Constraints

- **`DELETE /api/asistencia/:id` es RESTful (id en el path), no `?id=` como en Next.js** — se desvía a propósito del endpoint viejo para seguir la convención ya establecida en `server/` por `sucursales.ts`/`empleados.ts` (`DELETE /api/sucursales/:id`).
- **Retrofit visual = solo color/radio/grosor de borde**, no una reescritura de mecanismos de interacción. El focus state sigue usando `ring` de Tailwind (ya en acento, ahora azul) en vez de reimplementar el `outline` del handoff — no es parte de lo que se decidió cambiar.
- **Radio 0 se logra sacando las clases `rounded-*`**, no agregando tokens de radio nuevos — los componentes de `web/` ya usan clases Tailwind literales (`rounded-md`, etc.), no pasan por un token de tema.
- Cada mutación de TanStack Query invalida la query de lista correspondiente al completarse, mismo patrón que la Etapa 3.
- Sin tests automatizados nuevos — verificación manual vía curl/build, y al final una pasada del usuario en el navegador (obligatoria antes de borrar código viejo, por los bugs de Content-Type/CORS que se escaparon del curl-testing en la Etapa 3).
- `src/app/login/` y `src/app/admin/` de Next.js **no se tocan** — no dependen de nada de esta etapa.
- Hallazgo de esta planificación (no estaba en el spec): al borrar `src/lib/asistencia.ts`, los archivos `src/lib/{sucursales,empleados,otp}.ts` y `src/lib/require-org.ts` (Next.js) quedan sin ningún consumidor — se confirma con grep en la Task 8 antes de borrarlos, no se asume.

---

## Task 1: Rutas de Asistencia en `server/`

**Files:**
- Create: `server/src/routes/asistencia.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth` (`server/src/plugins/auth.js`), `requireOrg` (`server/src/plugins/require-org.js`), `listAsistencia`, `deleteAsistencia`, `listRechazadas`, `aprobarRechazada`, `descartarRechazada` (`server/src/lib/asistencia.js`, ya existen desde la Etapa 1 — firmas: `listAsistencia(orgId, {desde,hasta,sucursalId?,empleadoId?})`, `deleteAsistencia(orgId, id)`, `listRechazadas(orgId)`, `aprobarRechazada(orgId, id)` (throw si el intento no tiene datos completos), `descartarRechazada(orgId, id)`).
- Produces: `asistenciaRoutes` (Fastify plugin) con `GET /api/asistencia`, `DELETE /api/asistencia/:id`, `GET /api/asistencia/rechazadas`, `POST /api/asistencia/rechazadas/:id?accion=aprobar|descartar`.

- [ ] **Step 1: Crear `server/src/routes/asistencia.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import {
  listAsistencia,
  deleteAsistencia,
  listRechazadas,
  aprobarRechazada,
  descartarRechazada,
} from "../lib/asistencia.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

interface ListQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  empleadoId?: string;
}

interface IdParams {
  id: string;
}

interface ResolverQuery {
  accion?: string;
}

export async function asistenciaRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ListQuery }>(
    "/api/asistencia",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { desde, hasta, sucursalId, empleadoId } = request.query;
      return listAsistencia(request.org!.id, {
        desde: desde ?? hoyAR(),
        hasta: hasta ?? hoyAR(),
        sucursalId,
        empleadoId,
      });
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/asistencia/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      await deleteAsistencia(request.org!.id, id);
      return { ok: true };
    }
  );

  app.get(
    "/api/asistencia/rechazadas",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      return listRechazadas(request.org!.id);
    }
  );

  app.post<{ Params: IdParams; Querystring: ResolverQuery }>(
    "/api/asistencia/rechazadas/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { id } = request.params;
      const { accion } = request.query;
      try {
        if (accion === "aprobar") {
          await aprobarRechazada(request.org!.id, id);
        } else if (accion === "descartar") {
          await descartarRechazada(request.org!.id, id);
        } else {
          return reply.code(400).send({ error: "Acción inválida" });
        }
      } catch (e) {
        return reply.code(400).send({
          error: e instanceof Error ? e.message : "No se pudo resolver el intento",
        });
      }
      return { ok: true };
    }
  );
}
```

- [ ] **Step 2: Registrar la ruta en `server/src/index.ts`**

Agregar el import `import { asistenciaRoutes } from "./routes/asistencia.js";` junto a los demás, y `await app.register(asistenciaRoutes);` junto a los demás `await app.register(...)`.

- [ ] **Step 3: Verificar manualmente**

Con el server corriendo (`cd server && npm run dev`):

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

echo "--- listar (rango de hoy por default) ---"
curl -s http://localhost:3001/api/asistencia -H "Authorization: Bearer $TOKEN"
echo

echo "--- listar con rango explícito ---"
curl -s "http://localhost:3001/api/asistencia?desde=2026-08-01&hasta=2026-08-18" -H "Authorization: Bearer $TOKEN"
echo

echo "--- rechazadas (vacío o lista, no debe romper) ---"
curl -s http://localhost:3001/api/asistencia/rechazadas -H "Authorization: Bearer $TOKEN"
echo

echo "--- resolver un id inexistente (debe dar 400 con mensaje) ---"
curl -s -w " [%{http_code}]" -X POST "http://localhost:3001/api/asistencia/rechazadas/00000000-0000-0000-0000-000000000000?accion=aprobar" \
  -H "Authorization: Bearer $TOKEN"
echo

echo "--- borrar un id inexistente (no debe tirar 500) ---"
curl -s -w " [%{http_code}]" -X DELETE "http://localhost:3001/api/asistencia/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $TOKEN"
echo
```

Esperado: listar devuelve `[]` o un array de registros (200); rechazadas devuelve `[]` o un array (200); resolver el id inexistente responde `400` con `{"error":"Intento no encontrado"}`; borrar el id inexistente responde `200 {"ok":true}` (el `DELETE` de Supabase no distingue "no encontrado" de "0 filas afectadas").

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/asistencia.ts server/src/index.ts
git commit -m "feat(server): rutas de asistencia"
```

---

## Task 2: Ruta de Horas en `server/`

**Files:**
- Create: `server/src/routes/horas.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireOrg`, `calcularHoras` (`server/src/lib/asistencia.js`, firma: `calcularHoras(orgId, {desde,hasta,sucursalId?}) => Promise<Turno[]>`, donde `Turno = {empleado_id, nombre, sucursal_id, sucursal_nombre, entrada_at, salida_at: string|null, horas: number|null}`).
- Produces: `horasRoutes` (Fastify plugin) con `GET /api/horas`, respuesta `{desde, hasta, turnos, resumen}`.

- [ ] **Step 1: Crear `server/src/routes/horas.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { calcularHoras } from "../lib/asistencia.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

interface HorasQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
}

interface ResumenEmpleado {
  nombre: string;
  totalHoras: number;
  enCurso: boolean;
}

export async function horasRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: HorasQuery }>(
    "/api/horas",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { sucursalId } = request.query;
      const desde = request.query.desde ?? inicioDeMesAR();
      const hasta = request.query.hasta ?? hoyAR();

      const turnos = await calcularHoras(request.org!.id, { desde, hasta, sucursalId });

      const porEmpleado = new Map<string, ResumenEmpleado>();
      for (const t of turnos) {
        let e = porEmpleado.get(t.empleado_id);
        if (!e) {
          e = { nombre: t.nombre, totalHoras: 0, enCurso: false };
          porEmpleado.set(t.empleado_id, e);
        }
        if (t.horas !== null) {
          e.totalHoras += t.horas;
        } else {
          e.enCurso = true;
        }
      }
      const resumen = Array.from(porEmpleado.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));

      return { desde, hasta, turnos, resumen };
    }
  );
}
```

- [ ] **Step 2: Registrar la ruta en `server/src/index.ts`**

Agregar el import `import { horasRoutes } from "./routes/horas.js";` junto a los demás, y `await app.register(horasRoutes);` junto a los demás `await app.register(...)`.

- [ ] **Step 3: Verificar manualmente**

```bash
echo "--- horas (rango de mes actual por default) ---"
curl -s http://localhost:3001/api/horas -H "Authorization: Bearer $TOKEN"
echo

echo "--- horas con rango explícito ---"
curl -s "http://localhost:3001/api/horas?desde=2026-08-01&hasta=2026-08-18" -H "Authorization: Bearer $TOKEN"
echo
```

Esperado: `200` con `{"desde":...,"hasta":...,"turnos":[...],"resumen":[...]}` — `resumen` con como máximo un objeto por `empleado_id` distinto presente en `turnos`, cada uno con `totalHoras` numérico y `enCurso` booleano. (`$TOKEN` es el de la Task 1 — si ya no está en el shell, repetir el bloque de auth de esa task.)

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/horas.ts server/src/index.ts
git commit -m "feat(server): ruta de horas"
```

Con esto `server/` cubre las 5 rutas nuevas completas. `web/` empieza en la Task 3.

---

## Task 3: Funciones de Asistencia y Horas en `web/src/lib/api.ts`

**Files:**
- Modify: `web/src/lib/api.ts`

**Interfaces:**
- Produces: `TipoMarca`, `AsistenciaRegistro`, `MotivoRechazo`, `Rechazada`, `Turno`, `ResumenEmpleado`, `HorasResponse`, `listAsistencia(desde, hasta)`, `deleteAsistencia(id)`, `listRechazadas()`, `resolverRechazada(id, accion)`, `getHoras(desde, hasta)` — consumidos por `web/src/pages/asistencia/hooks.ts` (Task 5) y `web/src/pages/horas/hooks.ts` (Task 6).

- [ ] **Step 1: Agregar las funciones al final de `web/src/lib/api.ts`**

Agregar después de `generarOtp` (el final actual del archivo):

```ts

export type TipoMarca = "entrada" | "salida";

export interface AsistenciaRegistro {
  id: string;
  org_id: string;
  empleado_id: string;
  sucursal_id: string;
  tipo: TipoMarca;
  lat: number;
  lon: number;
  created_at: string;
  empleado_nombre: string | null;
  sucursal_nombre: string | null;
}

export function listAsistencia(desde: string, hasta: string): Promise<AsistenciaRegistro[]> {
  return request(`/api/asistencia?desde=${desde}&hasta=${hasta}`);
}

export function deleteAsistencia(id: string): Promise<{ ok: true }> {
  return request(`/api/asistencia/${id}`, { method: "DELETE" });
}

export type MotivoRechazo =
  | "fuera_de_rango"
  | "sucursal_sin_gps"
  | "nombre_no_encontrado"
  | "dispositivo_ya_vinculado";

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

export function listRechazadas(): Promise<Rechazada[]> {
  return request("/api/asistencia/rechazadas");
}

export function resolverRechazada(id: string, accion: "aprobar" | "descartar"): Promise<{ ok: true }> {
  return request(`/api/asistencia/rechazadas/${id}?accion=${accion}`, { method: "POST" });
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

export interface ResumenEmpleado {
  nombre: string;
  totalHoras: number;
  enCurso: boolean;
}

export interface HorasResponse {
  desde: string;
  hasta: string;
  turnos: Turno[];
  resumen: ResumenEmpleado[];
}

export function getHoras(desde: string, hasta: string): Promise<HorasResponse> {
  return request(`/api/horas?desde=${desde}&hasta=${hasta}`);
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
git commit -m "feat(web): funciones de asistencia y horas en api.ts"
```

---

## Task 4: Retrofit del sistema de diseño a Modernist (acento azul, radio 0)

**Files:**
- Modify: `web/src/index.css`
- Modify: `web/src/components/ui/button.tsx`
- Modify: `web/src/components/ui/input.tsx`
- Modify: `web/src/components/ui/card.tsx`
- Modify: `web/src/components/ui/badge.tsx`
- Modify: `web/src/components/ui/table.tsx`
- Modify: `web/src/components/PanelNav.tsx`
- Modify: `web/src/pages/LoginPage.tsx`
- Modify: `web/src/pages/MarcarPage.tsx`
- Modify: `web/src/pages/sucursales/SucursalesPage.tsx`
- Modify: `web/src/pages/empleados/EmpleadosPage.tsx`

**Interfaces:**
- Produces: tokens `--color-accent-100`…`--color-accent-900` y `--color-divider` en `web/src/index.css` (y sus utilities Tailwind `bg-accent-*`/`text-accent-*`/`border-accent-*`/`border-divider`) — consumidos por todos los componentes de esta task y por `AsistenciaPage`/`HorasPage` (Tasks 5 y 6).
- No cambia ninguna firma ni comportamiento de componente — solo clases de estilo.

Fuente de los valores: `docs/superpowers/specs/2026-08-18-vite-migration-etapa4-design.md` §3.3 (ya extraídos del handoff de Claude Design — no hace falta releer el proyecto de diseño para este task).

- [ ] **Step 1: Actualizar tokens en `web/src/index.css`**

Reemplazar el contenido completo del archivo:

```css
@import "tailwindcss";

@theme {
  --color-bg: #f3f2f2;
  --color-surface: #eae9e9;
  --color-text: #201e1d;
  --color-accent: #1d4ed8;
  --color-accent-100: color-mix(in oklch, var(--color-accent) 12%, white);
  --color-accent-200: color-mix(in oklch, var(--color-accent) 24%, white);
  --color-accent-300: color-mix(in oklch, var(--color-accent) 40%, white);
  --color-accent-400: color-mix(in oklch, var(--color-accent) 65%, white);
  --color-accent-500: var(--color-accent);
  --color-accent-600: color-mix(in oklch, var(--color-accent) 85%, black);
  --color-accent-700: color-mix(in oklch, var(--color-accent) 68%, black);
  --color-accent-800: color-mix(in oklch, var(--color-accent) 52%, black);
  --color-accent-900: color-mix(in oklch, var(--color-accent) 38%, black);
  --color-divider: color-mix(in srgb, var(--color-text) 40%, transparent);
  --font-sans: "Archivo", sans-serif;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}
```

(Regla del handoff: para texto de tamaño párrafo en acento usar el paso 700, no el 500 — por contraste. Se aplica en el Step 8.)

- [ ] **Step 2: Sacar el radio y ajustar colores en `web/src/components/ui/button.tsx`**

Reemplazar el bloque `buttonVariants` (deja el resto del archivo — `ButtonProps`, el componente `Button`, el export — igual):

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-[15px] font-normal transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-text text-bg hover:opacity-90",
        outline: "border border-divider bg-transparent text-text hover:bg-surface",
        accent: "bg-accent text-bg hover:bg-accent-600 active:bg-accent-700",
        ghost: "bg-transparent text-accent-700 hover:bg-accent-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        lg: "h-14 w-full px-4 text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

- [ ] **Step 3: Sacar el radio y ajustar el borde en `web/src/components/ui/input.tsx`**

Reemplazar la línea de `className` dentro de `cn(...)`:

```tsx
        "flex h-10 w-full border border-divider bg-bg px-3 py-2 text-[15px] text-text placeholder:text-text/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
```

- [ ] **Step 4: Sacar el radio en `web/src/components/ui/card.tsx`**

Reemplazar la línea del `div` dentro de `Card`:

```tsx
    <div ref={ref} className={cn("bg-surface p-6", className)} {...props} />
```

- [ ] **Step 5: Sacar el radio y remapear colores en `web/src/components/ui/badge.tsx`**

Reemplazar el bloque `badgeVariants`:

```tsx
const badgeVariants = cva(
  "inline-flex items-center px-2.5 py-0.5 text-[11px] font-normal uppercase tracking-wide",
  {
    variants: {
      variant: {
        filled: "bg-text text-bg",
        outline: "border border-accent-700 text-accent-700",
        accent: "bg-accent-100 text-accent-800",
      },
    },
    defaultVariants: { variant: "outline" },
  }
);
```

- [ ] **Step 6: Mover el borde de fila a celda en `web/src/components/ui/table.tsx`**

Reemplazar el contenido completo del archivo:

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
  ({ className, ...props }, ref) => <tr ref={ref} className={className} {...props} />
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={cn("border-b-2 border-divider p-2 font-normal", className)} {...props} />
  )
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("border-b border-divider p-2", className)} {...props} />
  )
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

(`SucursalesPage.tsx`/`EmpleadosPage.tsx` pasan `className={suc.activa ? "" : "text-text/40"}` a `TableRow` — sigue funcionando igual, ese `className` ahora solo pone el color de texto, ya no pisa ningún borde.)

- [ ] **Step 7: Engrosar el borde del nav en `web/src/components/PanelNav.tsx`**

Cambiar la línea del `<nav>`:

```tsx
    <nav className="border-b-2 border-divider bg-surface px-8 py-3">
```

- [ ] **Step 8: Pasar los mensajes de error a `text-accent-700`**

En estos 4 archivos, cambiar `text-accent` por `text-accent-700` en la línea del mensaje de error (el resto de la línea no cambia):

- `web/src/pages/LoginPage.tsx:56`
- `web/src/pages/MarcarPage.tsx:225`
- `web/src/pages/empleados/EmpleadosPage.tsx:106`
- `web/src/pages/sucursales/SucursalesPage.tsx:106`

- [ ] **Step 9: Sacar el radio y aclarar el borde del panel de QR en `web/src/pages/sucursales/SucursalesPage.tsx`**

Cambiar la línea 216 (el `div` que envuelve el panel de "Ver QR"):

```tsx
          <div className="mt-6 max-w-md border border-divider bg-surface p-4">
```

- [ ] **Step 10: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 11: Verificar visualmente**

Con `web/` corriendo (`npm run dev`), abrir `http://localhost:5173/` logueado y recorrer Home, Sucursales, Empleados: confirmar que los botones primarios (Agregar) son azules, los botones de acción de fila (Editar/Desactivar/etc.) son texto azul (ya no negro), y no queda ninguna esquina redondeada en botones, inputs, tarjetas ni el panel de QR.

- [ ] **Step 12: Commit**

```bash
git add web/src/index.css web/src/components/ui/button.tsx web/src/components/ui/input.tsx web/src/components/ui/card.tsx web/src/components/ui/badge.tsx web/src/components/ui/table.tsx web/src/components/PanelNav.tsx web/src/pages/LoginPage.tsx web/src/pages/MarcarPage.tsx web/src/pages/sucursales/SucursalesPage.tsx web/src/pages/empleados/EmpleadosPage.tsx
git commit -m "feat(web): retrofit visual a Modernist (acento azul, radio 0)"
```

---

## Task 5: `AsistenciaPage` + hooks

**Files:**
- Create: `web/src/pages/asistencia/hooks.ts`
- Create: `web/src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:**
- Consumes: `listAsistencia`/`deleteAsistencia`/`listRechazadas`/`resolverRechazada` (Task 3), `Button`/`Input`/`Badge`/`Table*` (Task 4).
- Produces: `AsistenciaPage` (default export) — consumido por `App.tsx` en la Task 7.

- [ ] **Step 1: Crear `web/src/pages/asistencia/hooks.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAsistencia, deleteAsistencia, listRechazadas, resolverRechazada } from "../../lib/api";

export function useAsistencia(desde: string, hasta: string) {
  return useQuery({
    queryKey: ["asistencia", desde, hasta],
    queryFn: () => listAsistencia(desde, hasta),
  });
}

export function useRechazadas() {
  return useQuery({ queryKey: ["asistencia-rechazadas"], queryFn: listRechazadas });
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

- [ ] **Step 2: Crear `web/src/pages/asistencia/AsistenciaPage.tsx`**

```tsx
import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import type { MotivoRechazo } from "../../lib/api";
import { useAsistencia, useRechazadas, useBorrarAsistencia, useResolverRechazada } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

const MOTIVOS: Record<MotivoRechazo, string> = {
  fuera_de_rango: "Fuera de rango",
  sucursal_sin_gps: "Sucursal sin GPS configurado",
  nombre_no_encontrado: "Nombre no encontrado en la nómina",
  dispositivo_ya_vinculado: "Ya vinculado a otro dispositivo",
};

export default function AsistenciaPage() {
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());

  const { data: registros = [], isLoading } = useAsistencia(desde, hasta);
  const { data: rechazadas = [] } = useRechazadas();
  const borrar = useBorrarAsistencia();
  const resolver = useResolverRechazada();
  const [error, setError] = useState<string | null>(null);

  async function handleBorrar(id: string) {
    if (!confirm("¿Borrar este registro?")) return;
    setError(null);
    try {
      await borrar.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el registro.");
    }
  }

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    setError(null);
    try {
      await resolver.mutateAsync({ id, accion });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo resolver el intento.");
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl">
        <h1 className="text-[32px] font-extrabold text-text">Asistencia</h1>

        {rechazadas.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-extrabold text-text">Intentos rechazados</h2>
              <Badge variant="accent">{rechazadas.length} pendientes</Badge>
            </div>
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rechazadas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{horaLocal(r.created_at)}</TableCell>
                    <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                    <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                    <TableCell>
                      {MOTIVOS[r.motivo] ?? r.motivo}
                      {r.motivo === "fuera_de_rango" && r.distancia_metros != null && (
                        <span className="text-text/55"> (a {r.distancia_metros} m)</span>
                      )}
                      {r.tipo && <span className="text-text/55"> — {r.tipo}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => handleResolver(r.id, "aprobar")}>
                          Aprobar
                        </Button>
                        <Button variant="ghost" onClick={() => handleResolver(r.id, "descartar")}>
                          Descartar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        <section className="mt-6">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-[12px] text-text/70">
              Desde
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text/70">
              Hasta
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-40" />
            </label>
            {isLoading && <span className="text-[15px] text-text/60">Cargando...</span>}
          </div>

          {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}

          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{horaLocal(r.created_at)}</TableCell>
                  <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                  <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>
                    {r.tipo === "entrada" ? (
                      <Badge variant="filled" className="gap-1">
                        <LogIn className="h-3 w-3" /> Entrada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <LogOut className="h-3 w-3" /> Salida
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" onClick={() => handleBorrar(r.id)}>
                      Borrar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-text/60">
                    No hay registros en este rango.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
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

Esperado: sin errores. Sin ruta todavía (se conecta en la Task 7).

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/asistencia/hooks.ts web/src/pages/asistencia/AsistenciaPage.tsx
git commit -m "feat(web): AsistenciaPage"
```

---

## Task 6: `HorasPage` + hooks

**Files:**
- Create: `web/src/pages/horas/hooks.ts`
- Create: `web/src/pages/horas/HorasPage.tsx`

**Interfaces:**
- Consumes: `getHoras` (Task 3), `Input`/`Badge`/`Table*` (Task 4).
- Produces: `HorasPage` (default export) — consumido por `App.tsx` en la Task 7.

- [ ] **Step 1: Crear `web/src/pages/horas/hooks.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { getHoras } from "../../lib/api";

export function useHoras(desde: string, hasta: string) {
  return useQuery({ queryKey: ["horas", desde, hasta], queryFn: () => getHoras(desde, hasta) });
}
```

- [ ] **Step 2: Crear `web/src/pages/horas/HorasPage.tsx`**

```tsx
import { useState } from "react";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import { useHoras } from "./hooks";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function fechaHoraLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

export default function HorasPage() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());

  const { data, isLoading } = useHoras(desde, hasta);
  const turnos = data?.turnos ?? [];
  const resumen = data?.resumen ?? [];

  return (
    <main className="p-8">
      <div className="max-w-4xl">
        <h1 className="text-[32px] font-extrabold text-text">Horas trabajadas</h1>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-[12px] text-text/70">
            Desde
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text/70">
            Hasta
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-40" />
          </label>
          {isLoading && <span className="text-[15px] text-text/60">Cargando...</span>}
        </div>

        {resumen.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[20px] font-extrabold text-text">Resumen por empleado</h2>
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Total horas</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumen.map((r) => (
                  <TableRow key={r.nombre}>
                    <TableCell>{r.nombre}</TableCell>
                    <TableCell>{r.totalHoras.toFixed(2)}</TableCell>
                    <TableCell>{r.enCurso ? <Badge variant="outline">Turno en curso</Badge> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-[20px] font-extrabold text-text">Turnos</h2>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnos.map((t, i) => (
                <TableRow key={`${t.empleado_id}-${t.entrada_at}-${i}`}>
                  <TableCell>{t.nombre}</TableCell>
                  <TableCell>{t.sucursal_nombre}</TableCell>
                  <TableCell>{fechaHoraLocal(t.entrada_at)}</TableCell>
                  <TableCell>
                    {t.salida_at ? fechaHoraLocal(t.salida_at) : <Badge variant="outline">En curso</Badge>}
                  </TableCell>
                  <TableCell>{t.horas !== null ? t.horas.toFixed(2) : "—"}</TableCell>
                </TableRow>
              ))}
              {!isLoading && turnos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-text/60">
                    No hay turnos en este rango.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
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
git add web/src/pages/horas/hooks.ts web/src/pages/horas/HorasPage.tsx
git commit -m "feat(web): HorasPage"
```

---

## Task 7: Activar Asistencia/Horas en el nav y el Home + rutas finales

**Files:**
- Modify: `web/src/components/PanelNav.tsx`
- Modify: `web/src/pages/HomePage.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `AsistenciaPage` (Task 5), `HorasPage` (Task 6).
- Ya no queda ningún acceso deshabilitado — se elimina `TOOLTIP_DESHABILITADO` (`PanelNav.tsx`) y toda la lógica condicional que lo usaba.

- [ ] **Step 1: Reemplazar `web/src/components/PanelNav.tsx` completo**

```tsx
import { NavLink } from "react-router-dom";

interface NavItem {
  href: string;
  label: string;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia" },
  { href: "/horas", label: "Horas" },
  { href: "/empleados", label: "Empleados" },
  { href: "/sucursales", label: "Sucursales" },
];

export function PanelNav() {
  return (
    <nav className="border-b-2 border-divider bg-surface px-8 py-3">
      <div className="flex gap-4 text-[15px]">
        {LINKS.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end
            className={({ isActive }) =>
              isActive ? "font-extrabold text-text" : "text-text hover:underline"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Reemplazar `web/src/pages/HomePage.tsx` completo**

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Clock, Users, MapPin, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { getOrgActual, ApiError, type Organization } from "../lib/api";

const ACCESOS = [
  {
    href: "/asistencia",
    label: "Asistencia",
    detalle: "Registros de entrada/salida e intentos rechazados",
    icon: CalendarClock,
  },
  {
    href: "/horas",
    label: "Horas",
    detalle: "Turnos y horas trabajadas por empleado",
    icon: Clock,
  },
  {
    href: "/empleados",
    label: "Empleados",
    detalle: "Nómina, vínculo de dispositivos y códigos",
    icon: Users,
  },
  {
    href: "/sucursales",
    label: "Sucursales",
    detalle: "Ubicaciones, geocercas y códigos QR",
    icon: MapPin,
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
        {ACCESOS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} to={a.href}>
              <Card className="relative transition-colors hover:bg-text/5">
                <ChevronRight className="absolute right-4 top-4 h-4 w-4 text-text/40" />
                <Icon className="h-6 w-6 text-accent-700" />
                <h2 className="text-[15px] font-extrabold text-text">{a.label}</h2>
                <p className="mt-1 text-[15px] text-text/60">{a.detalle}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Agregar las rutas a `web/src/App.tsx`**

Reemplazar el contenido completo:

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
import AsistenciaPage from "./pages/asistencia/AsistenciaPage";
import HorasPage from "./pages/horas/HorasPage";

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
            <Route
              path="/asistencia"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <AsistenciaPage />
                  </PanelLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/horas"
              element={
                <ProtectedRoute>
                  <PanelLayout>
                    <HorasPage />
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
git commit -m "feat(web): activar Asistencia y Horas en nav/home + rutas finales"
```

---

## Task 8: Verificación E2E + borrado del panel viejo de Next.js

**Files:**
- Delete: `src/app/(panel)/` (completo: `layout.tsx`, `page.tsx`, `asistencia/`, `horas/`)
- Delete: `src/app/api/asistencia/`
- Delete: `src/app/api/horas/`
- Delete: `src/components/org-nav.tsx`
- Delete: `src/lib/asistencia.ts`
- Delete: `src/lib/require-org.ts`, `src/lib/sucursales.ts`, `src/lib/empleados.ts`, `src/lib/otp.ts` (solo si el Step 3 confirma que quedan sin consumidores)

**Interfaces:** ninguna — es la tarea de cierre de la etapa.

- [ ] **Step 1: Confirmar que `server/` y `web/` siguen corriendo**

```bash
curl -s http://localhost:3001/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

Si alguno no responde, levantarlo de nuevo (`npm run dev` en `server/` y en `web/`).

- [ ] **Step 2: Checklist manual (para el usuario en el navegador)**

1. Entrar a `http://localhost:5173/` logueado. Confirmar que Home ya no tiene ninguna tarjeta deshabilitada (las 4 son clickeables, con ícono) y que el nav tiene los 5 links activos.
2. Confirmar visualmente que Login, Home, Sucursales y Empleados se ven con acento azul y sin esquinas redondeadas (retrofit de la Task 4).
3. En `/asistencia`: si hay intentos rechazados, tocar "Aprobar" en uno con datos completos → confirmar que desaparece de "Intentos rechazados" y aparece un registro nuevo en la tabla de abajo. Tocar "Descartar" en otro → confirmar que desaparece sin crear ningún registro.
4. Cambiar el rango de fechas (Desde/Hasta) → confirmar que la tabla de registros se actualiza.
5. Tocar "Borrar" en un registro → confirmar que desaparece de la tabla sin recargar la página.
6. En `/horas`: confirmar que "Resumen por empleado" y "Turnos" muestran datos coherentes con lo que hay en `/asistencia` para el mismo rango (un turno con salida = horas calculadas; un turno sin salida = "Turno en curso"/"En curso").
7. Cambiar el rango de fechas en `/horas` → confirmar que ambas tablas se actualizan.
8. Confirmar que `http://localhost:3000/login` y `http://localhost:3000/admin` (Next.js, fuera de esta etapa) siguen funcionando igual que antes.

Esperar la confirmación explícita del usuario antes de continuar al Step 3.

- [ ] **Step 3: Confirmar que los libs candidatos a borrado quedan sin consumidores**

```bash
echo "--- require-org.ts ---"
grep -rn 'from "@/lib/require-org"\|from "\.\./require-org"\|from "\./require-org"' src --include="*.ts" --include="*.tsx"
echo "--- sucursales.ts ---"
grep -rn 'from "\./sucursales"\|from "\.\./lib/sucursales"' src --include="*.ts" --include="*.tsx"
echo "--- empleados.ts ---"
grep -rn 'from "\./empleados"\|from "\.\./lib/empleados"' src --include="*.ts" --include="*.tsx"
echo "--- otp.ts ---"
grep -rn 'from "\./otp"\|from "\.\./lib/otp"' src --include="*.ts" --include="*.tsx"
```

Esperado: cada bloque solo puede mostrar líneas dentro de `src/app/(panel)/` o `src/app/api/asistencia/` (los que se borran en el Step 4) o `src/lib/asistencia.ts` (también se borra) — si aparece cualquier otra línea, ese archivo tiene un consumidor real y **no** se borra en el Step 4 (sacarlo de la lista).

- [ ] **Step 4: Borrar el código viejo de Next.js**

```bash
git rm -r "src/app/(panel)" src/app/api/asistencia src/app/api/horas src/components/org-nav.tsx \
  src/lib/asistencia.ts src/lib/require-org.ts src/lib/sucursales.ts src/lib/empleados.ts src/lib/otp.ts
```

(Ajustar la lista según lo que haya confirmado el Step 3 — si algún archivo mostró un consumidor real, sacarlo de este comando.)

- [ ] **Step 5: Confirmar que el resto de Next.js sigue compilando**

```bash
rm -rf .next
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: borrar Asistencia/Horas y panel viejo de Next.js (Etapa 4)"
```

---

## Al terminar la Etapa 4

- `/asistencia` y `/horas` funcionan de punta a punta en `web/` + `server/`.
- Todo `web/` (Login, Home, Sucursales, Empleados, Asistencia, Horas) está en Modernist: acento azul, sin bordes redondeados — el plan de rediseño separado que estaba pendiente queda cerrado, no hace falta ejecutarlo aparte.
- `src/app/(panel)/`, `src/app/api/asistencia/`, `src/app/api/horas/`, `src/components/org-nav.tsx` y los libs de Next.js sin consumidores quedan borrados. `src/app/login/` y `src/app/admin/` siguen funcionando sin cambios.
- Con esto, el panel de Next.js queda reducido a `/login` y `/admin` — si en algún momento se decide dar de baja Next.js por completo, es una etapa propia posterior (fuera del alcance de esta).
